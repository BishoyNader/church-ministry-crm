import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
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
      .eq("servant_id", userId);

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

export async function createUser(
  input: CreateUserInput,
  assignedBy: string,
  churchId: string,
): Promise<{ data: { id: string } | null; error: string | null }> {
  const admin = createAdminClient();

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

    const userId = authData.user.id;

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .insert({
        id: userId,
        church_id: churchId,
        email: input.email,
        full_name_ar: input.full_name_ar,
        full_name_en: input.full_name_en ?? null,
        phone: input.phone ?? null,
        preferred_locale: input.preferred_locale ?? "ar",
      })
      .select("id, church_id")
      .single();

    if (profileError || !profile) {
      await admin.auth.admin.deleteUser(userId);
      return { data: null, error: "Failed to create user profile." };
    }

    if (input.roleIds.length > 0) {
      const rolesValid = await validateRolesInChurch(
        admin,
        profile.church_id,
        input.roleIds,
      );
      if (!rolesValid) {
        await admin.auth.admin.deleteUser(userId);
        return { data: null, error: "Selected roles do not belong to this church." };
      }
      await syncRoleGrants(admin, profile.church_id, userId, input.roleIds, assignedBy);
    }

    if (input.stageIds.length > 0) {
      const { data: stages } = await admin
        .from("stages")
        .select("id, service_id")
        .in("id", input.stageIds);

      const stageServiceMap = new Map(stages?.map((s) => [s.id, s.service_id]) ?? []);

      const stageInserts = input.stageIds.map((stageId) => ({
        church_id: profile.church_id,
        servant_id: userId,
        stage_id: stageId,
        service_id: stageServiceMap.get(stageId) ?? "",
        assigned_by: assignedBy,
      }));
      await admin.from("servant_stage_assignments").insert(stageInserts);
    }

    return { data: { id: userId }, error: null };
  } catch {
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

    if (!(await isSuperAdminOfChurch(admin, assignedBy, profile.church_id))) {
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

    await supabase
      .from("servant_stage_assignments")
      .delete()
      .eq("servant_id", input.userId)
      .eq("church_id", profile.church_id);

    if (input.stageIds.length > 0) {
      const { data: stages } = await supabase
        .from("stages")
        .select("id, service_id")
        .in("id", input.stageIds);

      const stageServiceMap = new Map(stages?.map((s) => [s.id, s.service_id]) ?? []);

      const inserts = input.stageIds.map((stageId) => ({
        church_id: profile.church_id,
        servant_id: input.userId,
        stage_id: stageId,
        service_id: stageServiceMap.get(stageId) ?? "",
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
