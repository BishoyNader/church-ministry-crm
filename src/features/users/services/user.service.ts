import { createAdminClient } from "@/lib/supabase/admin";
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
  params: UserListParams,
): Promise<{ data: UserListResult | null; error: string | null }> {
  const admin = createAdminClient();
  const { page, pageSize, search, roleFilter } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = admin
      .from("profiles")
      .select(
        "id, church_id, email, full_name_ar, full_name_en, phone, preferred_locale, is_active, avatar_url, last_login_at, created_at, updated_at, deleted_at",
        { count: "exact" },
      )
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

      const { data: userRoles } = await admin
        .from("user_roles")
        .select("user_id, role_id, roles(id, name_ar, name_en, role_type)")
        .in("user_id", userIds);

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
  userId: string,
): Promise<{ data: UserDetail | null; error: string | null }> {
  const admin = createAdminClient();

  try {
    const { data: profile, error } = await admin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .is("deleted_at", null)
      .single();

    if (error || !profile) {
      return { data: null, error: "User not found." };
    }

    const { data: userRoles } = await admin
      .from("user_roles")
      .select("role_id, roles(*)")
      .eq("user_id", userId);

    const roles = (userRoles ?? [])
      .map((ur) => ur.roles)
      .filter(Boolean) as unknown as RoleRow[];

    const { data: stageAssignments } = await admin
      .from("user_stage_assignments")
      .select("*, stages(id, name_ar, name_en)")
      .eq("user_id", userId);

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
        church_id: (await getChurchId(admin, assignedBy))!,
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
      const roleInserts = input.roleIds.map((roleId) => ({
        church_id: profile.church_id,
        user_id: userId,
        role_id: roleId,
        assigned_by: assignedBy,
      }));
      await admin.from("user_roles").insert(roleInserts);
    }

    if (input.stageIds.length > 0) {
      const stageInserts = input.stageIds.map((stageId) => ({
        church_id: profile.church_id,
        user_id: userId,
        stage_id: stageId,
        assigned_by: assignedBy,
      }));
      await admin.from("user_stage_assignments").insert(stageInserts);
    }

    return { data: { id: userId }, error: null };
  } catch {
    return { data: null, error: "Failed to create user." };
  }
}

export async function updateUser(
  userId: string,
  input: UpdateUserInput,
): Promise<{ data: boolean; error: string | null }> {
  const admin = createAdminClient();

  try {
    const { error } = await admin
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
  userId: string,
): Promise<{ data: boolean; error: string | null }> {
  const admin = createAdminClient();

  try {
    const { error } = await admin
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

export async function assignRoles(
  input: AssignRolesInput,
  assignedBy: string,
): Promise<{ data: boolean; error: string | null }> {
  const admin = createAdminClient();

  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("church_id")
      .eq("id", input.userId)
      .single();

    if (!profile) {
      return { data: false, error: "User not found." };
    }

    await admin
      .from("user_roles")
      .delete()
      .eq("user_id", input.userId)
      .eq("church_id", profile.church_id);

    if (input.roleIds.length > 0) {
      const inserts = input.roleIds.map((roleId) => ({
        church_id: profile.church_id,
        user_id: input.userId,
        role_id: roleId,
        assigned_by: assignedBy,
      }));
      await admin.from("user_roles").insert(inserts);
    }

    return { data: true, error: null };
  } catch {
    return { data: false, error: "Failed to assign roles." };
  }
}

export async function assignStages(
  input: AssignStagesInput,
  assignedBy: string,
): Promise<{ data: boolean; error: string | null }> {
  const admin = createAdminClient();

  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("church_id")
      .eq("id", input.userId)
      .single();

    if (!profile) {
      return { data: false, error: "User not found." };
    }

    await admin
      .from("user_stage_assignments")
      .delete()
      .eq("user_id", input.userId)
      .eq("church_id", profile.church_id);

    if (input.stageIds.length > 0) {
      const inserts = input.stageIds.map((stageId) => ({
        church_id: profile.church_id,
        user_id: input.userId,
        stage_id: stageId,
        assigned_by: assignedBy,
      }));
      await admin.from("user_stage_assignments").insert(inserts);
    }

    return { data: true, error: null };
  } catch {
    return { data: false, error: "Failed to assign stages." };
  }
}

export async function listRoles(
  churchId: string,
): Promise<{ data: RoleRow[] | null; error: string | null }> {
  const admin = createAdminClient();

  const { data, error } = await admin
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
  churchId: string,
): Promise<{ data: StageRow[] | null; error: string | null }> {
  const admin = createAdminClient();

  const { data, error } = await admin
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

async function getChurchId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("church_id")
    .eq("id", userId)
    .single();
  return data?.church_id ?? null;
}
