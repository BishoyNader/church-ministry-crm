import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toRegistrationError } from "@/types/registration";
import type { RegistrationFunctions } from "@/types/registration";
import type {
  AssignRolesInput,
  AssignStagesInput,
  CreateUserInput,
  RoleRow,
  StageRow,
  UpdateUserInput,
  UserDetail,
  UserListParams,
  UserListResult,
  UserListItem,
} from "../types/user.types";

/**
 * Splits the requested role IDs for the Church Manager replacement flow.
 *
 * Invariant: the new user must NEVER hold an active super_admin grant before
 * change_church_manager runs — that RPC's `SELECT ... LIMIT 1` "current manager"
 * lookup (035) could otherwise select the new user's own just-created grant and
 * early-return, leaving the real manager's grant active (two active Church
 * Managers). super_admin is therefore excluded from the initial grant and
 * change_church_manager is the ONLY operation that assigns the manager role.
 * Because create_church_user requires at least one role, when super_admin was
 * the ONLY requested role the church's servant role is used as a temporary
 * membership placeholder (revoked right after the swap).
 */
export function splitManagerReplacementRoles(
  requestedRoleIds: string[],
  superAdminRoleId: string | null,
  placeholderRoleId: string | null,
): { initialRoleIds: string[]; placeholderRoleId: string | null } {
  if (!superAdminRoleId || !requestedRoleIds.includes(superAdminRoleId)) {
    return { initialRoleIds: requestedRoleIds, placeholderRoleId: null };
  }
  const nonManagerRoleIds = requestedRoleIds.filter(
    (roleId) => roleId !== superAdminRoleId,
  );
  if (nonManagerRoleIds.length > 0) {
    return { initialRoleIds: nonManagerRoleIds, placeholderRoleId: null };
  }
  return {
    initialRoleIds: placeholderRoleId ? [placeholderRoleId] : [],
    placeholderRoleId,
  };
}

export async function listUsers(
  supabase: SupabaseClient,
  churchId: string,
  params: UserListParams,
): Promise<{ data: UserListResult | null; error: string | null }> {
  const { page, pageSize, search, roleFilter } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = supabase
      .from("profiles")
      .select(
        "id, church_id, email, full_name_ar, full_name_en, phone, preferred_locale, is_active, avatar_url, last_login_at, created_at, updated_at, deleted_at",
        { count: "exact" },
      )
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(
        `full_name_ar.ilike.%${search}%,full_name_en.ilike.%${search}%,email.ilike.%${search}%`,
      );
    }

    const { data: profiles, count, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    let users: UserListItem[] = (profiles ?? []) as UserListItem[];

    if (users.length > 0) {
      const userIds = users.map((u) => u.id);

      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id, role_id, roles(id, name_ar, name_en, role_type)")
        .in("user_id", userIds)
        .is("end_date", null);

      const rolesByUser = new Map<string, UserListItem["roles"]>();
      for (const ur of userRoles ?? []) {
        const existing = rolesByUser.get(ur.user_id) ?? [];
        if (ur.roles) {
          existing.push(ur.roles as unknown as UserListItem["roles"][number]);
        }
        rolesByUser.set(ur.user_id, existing);
      }

      users = users.map((u) => ({
        ...u,
        roles: rolesByUser.get(u.id) ?? [],
      }));
    }

    if (roleFilter) {
      users = users.filter((u) =>
        u.roles.some((r) => r.role_type === roleFilter),
      );
    }

    return {
      data: {
        users,
        total: count ?? 0,
        page,
        pageSize,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to list users." };
  }
}

export async function getUserById(
  supabase: SupabaseClient,
  churchId: string,
  userId: string,
): Promise<{ data: UserDetail | null; error: string | null }> {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .single();

    if (error || !profile) {
      return { data: null, error: "User not found." };
    }

    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role_id, roles(*)")
      .eq("user_id", userId)
      .is("end_date", null);

    const roles = (userRoles ?? [])
      .map((ur) => ur.roles)
      .filter(Boolean) as unknown as RoleRow[];

    const { data: stageAssignments } = await supabase
      .from("servant_stage_assignments")
      .select("*, stages(id, name_ar, name_en)")
      .eq("servant_id", userId)
      .eq("is_active", true)
      .is("end_date", null);

    return {
      data: {
        ...profile,
        roles,
        stageAssignments: (stageAssignments ?? []) as unknown as UserDetail["stageAssignments"],
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load user." };
  }
}

/**
 * createUser — creates a fully provisioned church user.
 *
 * Invariant (Phase 4): every church-scoped user must have a profile row, an
 * approved servants row, and at least one role grant — otherwise the proxy
 * access gate (get_my_access_state) would redirect the user to
 * /pending-approval forever. The profile + servant + roles + stages writes are
 * performed atomically inside the SECURITY DEFINER RPC create_church_user
 * (migration 034), which also validates role/stage church scope and audits.
 *
 * This service only creates the auth account (service role) and then delegates
 * to the RPC through the session client so auth.uid() inside the RPC resolves
 * to the acting user (PO or church super_admin).
 */
export async function createUser(
  supabase: SupabaseClient,
  input: CreateUserInput,
  churchId: string,
): Promise<{ data: { id: string } | null; error: string | null }> {
  const admin = createAdminClient();
  let userId: string | null = null;

  try {
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          full_name_ar: input.full_name_ar,
          full_name_en: input.full_name_en,
        },
      });

    if (authError || !authData.user) {
      return { data: null, error: authError?.message ?? "Failed to create auth user." };
    }

    userId = authData.user.id;

    const { error: rpcError } = await supabase.rpc<
      "create_church_user",
      RegistrationFunctions["create_church_user"]["Args"]
    >("create_church_user", {
      p_church_id: churchId,
      p_auth_user_id: userId,
      p_full_name_ar: input.full_name_ar,
      p_full_name_en: input.full_name_en ?? null,
      p_email: input.email,
      p_phone: input.phone ?? null,
      p_preferred_locale: input.preferred_locale ?? "ar",
      p_role_ids: input.roleIds,
      p_stage_ids: input.stageIds && input.stageIds.length > 0 ? input.stageIds : null,
    });

    if (rpcError) {
      await admin.auth.admin.deleteUser(userId);
      return { data: null, error: toRegistrationError(rpcError).message };
    }

    return { data: { id: userId }, error: null };
  } catch {
    if (userId) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    return { data: null, error: "Failed to create user." };
  }
}

export async function updateUser(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateUserInput,
): Promise<{ data: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name_ar: input.full_name_ar,
        full_name_en: input.full_name_en ?? null,
        phone: input.phone ?? null,
        preferred_locale: input.preferred_locale ?? "ar",
        is_active: input.is_active,
      })
      .eq("id", userId);

    if (error) {
      return { data: false, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: false, error: "Failed to update user." };
  }
}

export async function deactivateUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("id", userId);

    if (error) {
      return { data: false, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: false, error: "Failed to deactivate user." };
  }
}

function toDateOnly(date: Date): string {
  return date.toISOString().split("T")[0];
}

async function isSuperAdminOfChurch(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  churchId: string,
): Promise<boolean> {
  const { data: grants } = await admin
    .from("user_roles")
    .select("role_id, roles(role_type)")
    .eq("user_id", userId)
    .eq("church_id", churchId)
    .is("end_date", null);

  return (grants ?? []).some(
    (g) => (g as { roles?: { role_type?: string } | null })?.roles?.role_type === "super_admin",
  );
}

/**
 * The Platform Owner is a GLOBAL role (church_id NULL, is_system). The PO has
 * no church-scoped servants.* permissions, so role/stage management by the PO
 * is gated by the platform tenants bundle in the actions layer; this helper
 * lets the service skip the church super_admin-only check for the PO.
 */
async function isPlatformOwner(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<boolean> {
  const { data: grants } = await admin
    .from("user_roles")
    .select("role_id, roles(role_type)")
    .eq("user_id", userId)
    .is("church_id", null)
    .is("end_date", null);

  return (grants ?? []).some(
    (g) => (g as { roles?: { role_type?: string } | null })?.roles?.role_type === "platform_owner",
  );
}

async function getSuperAdminRoleId(
  admin: ReturnType<typeof createAdminClient>,
  churchId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("roles")
    .select("id")
    .eq("church_id", churchId)
    .eq("role_type", "super_admin")
    .maybeSingle();

  return data?.id ?? null;
}

async function countActiveSuperAdmins(
  admin: ReturnType<typeof createAdminClient>,
  churchId: string,
): Promise<number> {
  const superAdminRoleId = await getSuperAdminRoleId(admin, churchId);
  if (!superAdminRoleId) return 0;

  const { count } = await admin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("church_id", churchId)
    .eq("role_id", superAdminRoleId)
    .is("end_date", null);

  return count ?? 0;
}

async function validateRolesInChurch(
  admin: ReturnType<typeof createAdminClient>,
  churchId: string,
  roleIds: string[],
): Promise<boolean> {
  if (roleIds.length === 0) return true;

  const { data: roles } = await admin
    .from("roles")
    .select("id")
    .eq("church_id", churchId)
    .in("id", roleIds);

  return (roles ?? []).length === roleIds.length;
}

async function syncRoleGrants(
  admin: ReturnType<typeof createAdminClient>,
  churchId: string,
  userId: string,
  roleIds: string[],
  assignedBy: string,
): Promise<void> {
  const target = new Set(roleIds);

  const { data: existing } = await admin
    .from("user_roles")
    .select("id, role_id, end_date")
    .eq("church_id", churchId)
    .eq("user_id", userId);

  const existingByRole = new Map<string, { id: string; role_id: string; end_date: string | null }>(
    (existing ?? []).map((g) => [g.role_id as string, g]),
  );

  const archiveRoleIds = [...existingByRole.values()]
    .filter((g) => g.end_date === null && !target.has(g.role_id as string))
    .map((g) => g.role_id as string);

  if (archiveRoleIds.length > 0) {
    await admin
      .from("user_roles")
      .update({ end_date: toDateOnly(new Date()) })
      .eq("church_id", churchId)
      .eq("user_id", userId)
      .is("end_date", null)
      .in("role_id", archiveRoleIds);
  }

  const reactivateRoleIds = [...existingByRole.values()]
    .filter((g) => g.end_date !== null && target.has(g.role_id as string))
    .map((g) => g.role_id as string);

  if (reactivateRoleIds.length > 0) {
    await admin
      .from("user_roles")
      .update({ end_date: null })
      .eq("church_id", churchId)
      .eq("user_id", userId)
      .not("end_date", "is", null)
      .in("role_id", reactivateRoleIds);
  }

  const insertRoleIds = roleIds.filter((roleId) => !existingByRole.has(roleId));

  if (insertRoleIds.length > 0) {
    await admin.from("user_roles").insert(
      insertRoleIds.map((roleId) => ({
        church_id: churchId,
        user_id: userId,
        role_id: roleId,
        assigned_by: assignedBy,
        start_date: toDateOnly(new Date()),
      })),
    );
  }
}

export async function assignRoles(
  supabase: SupabaseClient,
  input: AssignRolesInput,
  assignedBy: string,
): Promise<{ data: boolean; error: string | null }> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("church_id")
      .eq("id", input.userId)
      .single();

    if (!profile) {
      return { data: false, error: "User not found." };
    }

    const admin = createAdminClient();

    const isPo = await isPlatformOwner(admin, assignedBy);
    if (
      !isPo &&
      !(await isSuperAdminOfChurch(admin, assignedBy, profile.church_id))
    ) {
      return { data: false, error: "Only a super admin can manage roles." };
    }

    if (!(await validateRolesInChurch(admin, profile.church_id, input.roleIds))) {
      return { data: false, error: "Selected roles do not belong to this church." };
    }

    const superAdminRoleId = await getSuperAdminRoleId(admin, profile.church_id);
    const targetIsSuperAdmin = await isSuperAdminOfChurch(
      admin,
      input.userId,
      profile.church_id,
    );
    const targetKeepsSuperAdmin = superAdminRoleId
      ? input.roleIds.includes(superAdminRoleId)
      : true;

    if (targetIsSuperAdmin && !targetKeepsSuperAdmin) {
      const activeSuperAdmins = await countActiveSuperAdmins(admin, profile.church_id);
      if (activeSuperAdmins <= 1) {
        return { data: false, error: "Cannot remove the last super admin." };
      }
    }

    await syncRoleGrants(admin, profile.church_id, input.userId, input.roleIds, assignedBy);

    return { data: true, error: null };
  } catch {
    return { data: false, error: "Failed to assign roles." };
  }
}

export async function assignStages(
  supabase: SupabaseClient,
  input: AssignStagesInput,
  assignedBy: string,
): Promise<{ data: boolean; error: string | null }> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("church_id")
      .eq("id", input.userId)
      .single();

    if (!profile) {
      return { data: false, error: "User not found." };
    }

    const now = new Date().toISOString();

    await supabase
      .from("servant_stage_assignments")
      .update({ is_active: false, end_date: now })
      .eq("servant_id", input.userId)
      .eq("church_id", profile.church_id)
      .eq("is_active", true)
      .is("end_date", null);

    if (input.stageIds.length > 0) {
      const { data: stages, error: stagesError } = await supabase
        .from("stages")
        .select("id, service_id")
        .eq("church_id", profile.church_id)
        .in("id", input.stageIds);

      if (stagesError) {
        return { data: false, error: stagesError.message };
      }

      if ((stages?.length ?? 0) !== input.stageIds.length) {
        return { data: false, error: "Some stages are not valid for this church." };
      }

      const stageServiceMap = new Map(stages?.map((s) => [s.id, s.service_id]) ?? []);

      const inserts = input.stageIds.map((stageId) => ({
        church_id: profile.church_id,
        servant_id: input.userId,
        stage_id: stageId,
        service_id: stageServiceMap.get(stageId) ?? "",
        is_active: true,
        start_date: now,
        end_date: null,
        assigned_by: assignedBy,
      }));
      await supabase.from("servant_stage_assignments").insert(inserts);
    }

    return { data: true, error: null };
  } catch {
    return { data: false, error: "Failed to assign stages." };
  }
}

export async function listRoles(
  supabase: SupabaseClient,
  churchId: string,
): Promise<{ data: RoleRow[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from("roles")
    .select("id, church_id, role_type, name_ar, name_en, description_ar, is_system, created_at, updated_at")
    .eq("church_id", churchId)
    .order("name_ar");

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? []) as unknown as RoleRow[], error: null };
}

export async function listStages(
  supabase: SupabaseClient,
  churchId: string,
): Promise<{ data: StageRow[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from("stages")
    .select("*")
    .eq("church_id", churchId)
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: (data ?? []) as unknown as StageRow[], error: null };
}
