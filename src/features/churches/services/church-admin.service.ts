import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  ChurchFilters,
  ChurchListItem,
  ChurchDetail,
  ChurchStats,
  ChurchSummary,
  ChurchStatus,
  ChurchUserRow,
  ChurchUsersPageData,
  ChurchAuditEvent,
  ChurchAuditPageData,
  ChurchAdminListRow,
  CreateChurchInput,
  UpdateChurchInput,
} from "../types/church.types";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const CHURCH_STATUSES: readonly ChurchStatus[] = [
  "active",
  "inactive",
  "suspended",
  "disabled",
];

type ServiceResult<T> = { data: T | null; error: string | null };

function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[()!,]/g, " ")
    .replace(/[%_\\]/g, (match) => `\\${match}`)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePage(pageSizeInput: number | undefined, pageInput: number | undefined) {
  const page = Math.max(1, pageInput ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeInput ?? DEFAULT_PAGE_SIZE));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

async function buildCountsMap(
  supabase: SupabaseClient<Database>,
  churchIds: string[],
): Promise<{
  memberCounts: Map<string, number>;
  servantCounts: Map<string, number>;
  childCounts: Map<string, number>;
  serviceCounts: Map<string, number>;
  stageCounts: Map<string, number>;
  classCounts: Map<string, number>;
}> {
  const empty = () => new Map<string, number>();

  if (churchIds.length === 0) {
    return {
      memberCounts: empty(),
      servantCounts: empty(),
      childCounts: empty(),
      serviceCounts: empty(),
      stageCounts: empty(),
      classCounts: empty(),
    };
  }

  const countByChurch = (rows: { church_id: string }[] | null) => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      map.set(row.church_id, (map.get(row.church_id) ?? 0) + 1);
    }
    return map;
  };

  const [members, servants, children, services, stages, classes] = await Promise.all([
    supabase
      .from("profiles")
      .select("church_id")
      .in("church_id", churchIds)
      .is("deleted_at", null),
    supabase
      .from("servants")
      .select("church_id")
      .in("church_id", churchIds)
      .is("deleted_at", null),
    supabase
      .from("beneficiaries")
      .select("church_id")
      .in("church_id", churchIds)
      .is("deleted_at", null),
    supabase
      .from("services")
      .select("church_id")
      .in("church_id", churchIds)
      .is("deleted_at", null),
    supabase
      .from("stages")
      .select("church_id")
      .in("church_id", churchIds)
      .is("deleted_at", null),
    supabase
      .from("classes")
      .select("church_id")
      .in("church_id", churchIds)
      .is("deleted_at", null),
  ]);

  if (
    members.error ||
    servants.error ||
    children.error ||
    services.error ||
    stages.error ||
    classes.error
  ) {
    return {
      memberCounts: empty(),
      servantCounts: empty(),
      childCounts: empty(),
      serviceCounts: empty(),
      stageCounts: empty(),
      classCounts: empty(),
    };
  }

  return {
    memberCounts: countByChurch(members.data),
    servantCounts: countByChurch(servants.data),
    childCounts: countByChurch(children.data),
    serviceCounts: countByChurch(services.data),
    stageCounts: countByChurch(stages.data),
    classCounts: countByChurch(classes.data),
  };
}

async function buildManagersMap(
  supabase: SupabaseClient<Database>,
  churchIds: string[],
): Promise<Map<string, ChurchListItem["manager"]>> {
  const map = new Map<string, ChurchListItem["manager"]>();

  if (churchIds.length === 0) return map;

  const { data: grants, error: grantsError } = await supabase
    .from("user_roles")
    .select("user_id, church_id, roles!inner(role_type)")
    .in("church_id", churchIds)
    .is("end_date", null)
    .eq("roles.role_type", "super_admin");

  if (grantsError || !grants || grants.length === 0) return map;

  const userIds = Array.from(new Set(grants.map((g) => g.user_id)));
  const managerByUser = new Map(grants.map((g) => [g.user_id, g.church_id]));

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(
      "id, full_name_ar, full_name_en, email, phone, avatar_url, last_login_at, is_active",
    )
    .in("id", userIds)
    .is("deleted_at", null);

  if (profilesError || !profiles) return map;

  for (const profile of profiles) {
    const churchId = managerByUser.get(profile.id);
    if (!churchId) continue;
    map.set(churchId, {
      userId: profile.id,
      fullNameAr: profile.full_name_ar,
      fullNameEn: profile.full_name_en,
      email: profile.email,
      phone: profile.phone,
      avatarUrl: profile.avatar_url,
      lastLoginAt: profile.last_login_at,
      isActive: profile.is_active,
    });
  }

  return map;
}

async function buildLastActivityMap(
  supabase: SupabaseClient<Database>,
  churchIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();

  if (churchIds.length === 0) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("church_id, updated_at")
    .in("church_id", churchIds)
    .is("deleted_at", null);

  if (error || !data) return map;

  for (const row of data) {
    const current = map.get(row.church_id) ?? null;
    if (!current || row.updated_at > current) {
      map.set(row.church_id, row.updated_at);
    }
  }

  return map;
}

export async function listChurches(
  supabase: SupabaseClient<Database>,
  filters: ChurchFilters = {},
): Promise<ServiceResult<{ rows: ChurchListItem[]; total: number }>> {
  try {
    const { from, to } = normalizePage(filters.pageSize, filters.page);

    let query = supabase
      .from("churches")
      .select("*", { count: "exact" })
      .is("deleted_at", null);

    const search = filters.search?.trim();
    if (search) {
      const pattern = sanitizeSearchTerm(search);
      if (pattern) {
        query = query.or(`name_ar.ilike.%${pattern}%,slug.ilike.%${pattern}%`);
      }
    }

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return { data: null, error: error.message };
    }

    const rows = (data ?? []) as ChurchListItem[];
    const churchIds = rows.map((row) => row.id);

    const [counts, managers, lastActivity] = await Promise.all([
      buildCountsMap(supabase, churchIds),
      buildManagersMap(supabase, churchIds),
      buildLastActivityMap(supabase, churchIds),
    ]);

    const enriched = rows.map((row) => ({
      ...row,
      status: (row.status as ChurchStatus) ?? (row.is_active ? "active" : "inactive"),
      memberCount: counts.memberCounts.get(row.id) ?? 0,
      servantCount: counts.servantCounts.get(row.id) ?? 0,
      childCount: counts.childCounts.get(row.id) ?? 0,
      serviceCount: counts.serviceCounts.get(row.id) ?? 0,
      stageCount: counts.stageCounts.get(row.id) ?? 0,
      classCount: counts.classCounts.get(row.id) ?? 0,
      manager: managers.get(row.id) ?? null,
      lastActivityAt: lastActivity.get(row.id) ?? row.updated_at,
    })) as unknown as ChurchListItem[];

    return { data: { rows: enriched, total: count ?? enriched.length }, error: null };
  } catch {
    return { data: null, error: "Failed to list churches." };
  }
}

export async function getChurchById(
  supabase: SupabaseClient<Database>,
  churchId: string,
): Promise<ServiceResult<ChurchDetail>> {
  try {
    const { data: church, error: churchError } = await supabase
      .from("churches")
      .select("*")
      .eq("id", churchId)
      .is("deleted_at", null)
      .single();

    if (churchError || !church) {
      return { data: null, error: "Church not found." };
    }

    const [counts, managers, lastActivity] = await Promise.all([
      buildCountsMap(supabase, [churchId]),
      buildManagersMap(supabase, [churchId]),
      buildLastActivityMap(supabase, [churchId]),
    ]);

    const detail: ChurchDetail = {
      ...church,
      status: (church.status as ChurchStatus) ?? (church.is_active ? "active" : "inactive"),
      memberCount: counts.memberCounts.get(churchId) ?? 0,
      servantCount: counts.servantCounts.get(churchId) ?? 0,
      childCount: counts.childCounts.get(churchId) ?? 0,
      serviceCount: counts.serviceCounts.get(churchId) ?? 0,
      stageCount: counts.stageCounts.get(churchId) ?? 0,
      classCount: counts.classCounts.get(churchId) ?? 0,
      manager: managers.get(churchId) ?? null,
      lastActivityAt: lastActivity.get(churchId) ?? church.updated_at,
    };

    return { data: detail, error: null };
  } catch {
    return { data: null, error: "Failed to load church details." };
  }
}

export async function createChurch(
  supabase: SupabaseClient<Database>,
  input: CreateChurchInput,
): Promise<ServiceResult<{ id: string }>> {
  try {
    const { data, error } = await supabase
      .from("churches")
      .insert({
        name_ar: input.name_ar,
        slug: input.slug,
        contact_email: input.contact_email ?? null,
        contact_phone: input.contact_phone ?? null,
        address_ar: input.address_ar ?? null,
        address_en: input.address_en ?? null,
        subscription_tier: input.subscription_tier ?? "trial",
        subscription_status: input.subscription_status ?? "active",
        locale: input.locale ?? "ar",
      })
      .select("id")
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: { id: data.id }, error: null };
  } catch {
    return { data: null, error: "Failed to create church." };
  }
}

export async function updateChurch(
  supabase: SupabaseClient<Database>,
  churchId: string,
  input: UpdateChurchInput,
): Promise<ServiceResult<boolean>> {
  try {
    const updatePayload: Database["public"]["Tables"]["churches"]["Update"] = {};

    if (input.name_ar !== undefined) updatePayload.name_ar = input.name_ar;
    if (input.slug !== undefined) updatePayload.slug = input.slug;
    if (input.contact_email !== undefined) updatePayload.contact_email = input.contact_email;
    if (input.contact_phone !== undefined) updatePayload.contact_phone = input.contact_phone;
    if (input.address_ar !== undefined) updatePayload.address_ar = input.address_ar;
    if (input.address_en !== undefined) updatePayload.address_en = input.address_en;
    if (input.is_active !== undefined) updatePayload.is_active = input.is_active;
    if (input.status !== undefined) updatePayload.status = input.status;
    if (input.subscription_tier !== undefined) updatePayload.subscription_tier = input.subscription_tier;
    if (input.subscription_status !== undefined) updatePayload.subscription_status = input.subscription_status;
    if (input.locale !== undefined) updatePayload.locale = input.locale;

    const { error } = await supabase
      .from("churches")
      .update(updatePayload)
      .eq("id", churchId)
      .is("deleted_at", null);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to update church." };
  }
}

export async function setChurchActive(
  supabase: SupabaseClient<Database>,
  churchId: string,
  isActive: boolean,
): Promise<ServiceResult<boolean>> {
  return setChurchStatus(supabase, churchId, isActive ? "active" : "inactive");
}

export async function setChurchStatus(
  supabase: SupabaseClient<Database>,
  churchId: string,
  status: ChurchStatus,
): Promise<ServiceResult<boolean>> {
  try {
    if (!CHURCH_STATUSES.includes(status)) {
      return { data: null, error: "Invalid church status." };
    }

    const { error } = await supabase
      .from("churches")
      .update({ status })
      .eq("id", churchId)
      .is("deleted_at", null);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to update church status." };
  }
}

export async function getChurchStats(
  supabase: SupabaseClient<Database>,
  churchId: string,
): Promise<ServiceResult<ChurchStats>> {
  try {
    const [counts, attendanceResult] = await Promise.all([
      buildCountsMap(supabase, [churchId]),
      supabase.from("attendance_records").select("status").eq("church_id", churchId),
    ]);

    if (attendanceResult.error) {
      return { data: null, error: attendanceResult.error.message };
    }

    const records = attendanceResult.data ?? [];
    const present = records.filter((record) => record.status === "present").length;

    const stats: ChurchStats = {
      memberCount: counts.memberCounts.get(churchId) ?? 0,
      servantCount: counts.servantCounts.get(churchId) ?? 0,
      childCount: counts.childCounts.get(churchId) ?? 0,
      serviceCount: counts.serviceCounts.get(churchId) ?? 0,
      stageCount: counts.stageCounts.get(churchId) ?? 0,
      classCount: counts.classCounts.get(churchId) ?? 0,
      attendanceRate: records.length > 0 ? Math.round((present / records.length) * 100) : null,
      attendancePresent: present,
      attendanceTotal: records.length,
    };

    return { data: stats, error: null };
  } catch {
    return { data: null, error: "Failed to load church statistics." };
  }
}

export async function getChurchSummary(
  supabase: SupabaseClient<Database>,
): Promise<ServiceResult<ChurchSummary>> {
  try {
    const { data, error } = await supabase
      .from("churches")
      .select("status, is_active")
      .is("deleted_at", null);

    if (error) {
      return { data: null, error: error.message };
    }

    const summary: ChurchSummary = {
      total: 0,
      active: 0,
      inactive: 0,
      suspended: 0,
      disabled: 0,
    };

    for (const row of data ?? []) {
      summary.total += 1;
      const status = (row.status as ChurchStatus) ?? (row.is_active ? "active" : "inactive");
      if (status === "active") summary.active += 1;
      else if (status === "inactive") summary.inactive += 1;
      else if (status === "suspended") summary.suspended += 1;
      else if (status === "disabled") summary.disabled += 1;
    }

    return { data: summary, error: null };
  } catch {
    return { data: null, error: "Failed to load church summary." };
  }
}

export async function listChurchUsers(
  supabase: SupabaseClient<Database>,
  churchId: string,
  filters: ChurchFilters = {},
): Promise<ServiceResult<ChurchUsersPageData>> {
  try {
    const { page, pageSize, from, to } = normalizePage(filters.pageSize, filters.page);

    let query = supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .eq("church_id", churchId)
      .is("deleted_at", null);

    const search = filters.search?.trim();
    if (search) {
      const pattern = sanitizeSearchTerm(search);
      if (pattern) {
        query = query.or(`full_name_ar.ilike.%${pattern}%,full_name_en.ilike.%${pattern}%,email.ilike.%${pattern}%`);
      }
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return { data: null, error: error.message };
    }

    const profiles = data ?? [];
    const userIds = profiles.map((profile) => profile.id);

    const roleTypesByUser = new Map<string, string[]>();
    if (userIds.length > 0) {
      const { data: grants, error: grantsError } = await supabase
        .from("user_roles")
        .select("user_id, roles!inner(role_type)")
        .eq("church_id", churchId)
        .is("end_date", null)
        .in("user_id", userIds);

      if (!grantsError && grants) {
        for (const grant of grants) {
          const existing = roleTypesByUser.get(grant.user_id) ?? [];
          roleTypesByUser.set(grant.user_id, [...existing, grant.roles?.role_type ?? ""].filter(Boolean));
        }
      }
    }

    const rows: ChurchUserRow[] = profiles.map((profile) => ({
      id: profile.id,
      fullNameAr: profile.full_name_ar,
      fullNameEn: profile.full_name_en,
      email: profile.email,
      phone: profile.phone,
      isActive: profile.is_active,
      lastLoginAt: profile.last_login_at,
      roleTypes: roleTypesByUser.get(profile.id) ?? [],
      createdAt: profile.created_at,
    }));

    const total = count ?? rows.length;
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: { rows, total, page, pageSize, totalPages },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load church users." };
  }
}

async function listChurchEntityRows(
  supabase: SupabaseClient<Database>,
  churchId: string,
  table: "services" | "stages" | "classes",
): Promise<ServiceResult<ChurchAdminListRow[]>> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("id, name_ar, name_en, is_active, sort_order, created_at")
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    const rows: ChurchAdminListRow[] = (data ?? []).map((row) => ({
      id: row.id,
      nameAr: row.name_ar,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      createdAt: row.created_at,
    }));

    return { data: rows, error: null };
  } catch {
    return { data: null, error: "Failed to load church data." };
  }
}

export function listChurchServices(
  supabase: SupabaseClient<Database>,
  churchId: string,
): Promise<ServiceResult<ChurchAdminListRow[]>> {
  return listChurchEntityRows(supabase, churchId, "services");
}

export function listChurchStages(
  supabase: SupabaseClient<Database>,
  churchId: string,
): Promise<ServiceResult<ChurchAdminListRow[]>> {
  return listChurchEntityRows(supabase, churchId, "stages");
}

export function listChurchClasses(
  supabase: SupabaseClient<Database>,
  churchId: string,
): Promise<ServiceResult<ChurchAdminListRow[]>> {
  return listChurchEntityRows(supabase, churchId, "classes");
}

export async function getChurchAuditPage(
  supabase: SupabaseClient<Database>,
  churchId: string,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<ServiceResult<ChurchAuditPageData>> {
  try {
    const { from, to } = normalizePage(pageSize, page);

    const { data, error, count } = await supabase
      .from("audit_logs")
      .select(
        "id, actor_id, action, entity_type, entity_id, created_at, profiles(full_name_ar, full_name_en, email)",
        { count: "exact" },
      )
      .eq("church_id", churchId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return { data: null, error: error.message };
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const rows: ChurchAuditEvent[] = (data ?? []).map((row) => {
      const actor = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id,
        actorId: row.actor_id,
        actorName: actor?.full_name_ar ?? null,
        actorEmail: actor?.email ?? null,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        createdAt: row.created_at,
      };
    });

    return {
      data: { rows, total, page, pageSize, totalPages },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load church audit log." };
  }
}

export async function changeChurchManager(
  supabase: SupabaseClient<Database>,
  churchId: string,
  newUserId: string,
): Promise<ServiceResult<string>> {
  try {
    const { data, error } = await supabase.rpc("change_church_manager", {
      p_church_id: churchId,
      p_new_user_id: newUserId,
    });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as string, error: null };
  } catch {
    return { data: null, error: "Failed to change church manager." };
  }
}

export async function deactivateChurchUser(
  supabase: SupabaseClient<Database>,
  churchId: string,
  userId: string,
): Promise<ServiceResult<string>> {
  try {
    const { data, error } = await supabase.rpc("deactivate_church_user", {
      p_church_id: churchId,
      p_user_id: userId,
    });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as string, error: null };
  } catch {
    return { data: null, error: "Failed to deactivate church user." };
  }
}
