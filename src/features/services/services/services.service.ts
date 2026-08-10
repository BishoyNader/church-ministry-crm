import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  CreateServiceInput,
  ServiceFilters,
  ServiceListItem,
  ServicePageData,
  ServiceRow,
  UpdateServiceInput,
} from "../types/services.types";

const DEFAULT_PAGE_SIZE = 20;

type ServiceResult<T> = { data: T | null; error: string | null };

function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[()!,]/g, " ")
    .replace(/[%_\\]/g, (match) => `\\${match}`)
    .replace(/\s+/g, " ")
    .trim();
}

export async function listServices(
  supabase: SupabaseClient<Database>,
  churchId: string,
  filters: ServiceFilters = {},
  stageIds?: string[],
): Promise<ServiceResult<ServicePageData>> {
  try {
    const scoped = stageIds !== undefined;

    if (scoped && stageIds.length === 0) {
      return {
        data: { rows: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE, totalPages: 0 },
        error: null,
      };
    }

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
    const from = (page - 1) * pageSize;
    const to = page * pageSize - 1;

    // Stage-scoped actors may only see the services that contain at least one
    // of their assigned stages (server-enforced; never client-trusted).
    let allowedServiceIds: string[] | null = null;
    if (scoped) {
      const { data: scopedStages, error: scopedStagesError } = await supabase
        .from("stages")
        .select("service_id")
        .eq("church_id", churchId)
        .is("deleted_at", null)
        .in("id", stageIds);

      if (scopedStagesError) return { data: null, error: scopedStagesError.message };

      allowedServiceIds = [...new Set((scopedStages ?? []).map((row) => row.service_id as string))];
      if (allowedServiceIds.length === 0) {
        return {
          data: { rows: [], total: 0, page, pageSize, totalPages: 0 },
          error: null,
        };
      }
    }

    let query = supabase
      .from("services")
      .select("*", { count: "exact" })
      .eq("church_id", churchId)
      .is("deleted_at", null);

    if (scoped) {
      query = query.in("id", allowedServiceIds as string[]);
    }

    const search = filters.search?.trim();
    if (search) {
      const pattern = sanitizeSearchTerm(search);
      if (pattern) {
        query = query.or(`name_ar.ilike.%${pattern}%,name_en.ilike.%${pattern}%`);
      }
    }
    if (filters.status === "active") {
      query = query.eq("is_active", true);
    }
    if (filters.status === "inactive") {
      query = query.eq("is_active", false);
    }

    const { data, error, count } = await query
      .order("sort_order")
      .order("name_ar")
      .range(from, to);

    if (error) return { data: null, error: error.message };

    const serviceIds = (data ?? []).map((service) => service.id);

    let stageCountQuery = supabase
      .from("stages")
      .select("service_id")
      .eq("church_id", churchId)
      .is("deleted_at", null);

    if (serviceIds.length) {
      stageCountQuery = stageCountQuery.in("service_id", serviceIds);
    }

    if (scoped) {
      stageCountQuery = stageCountQuery.in("id", stageIds);
    }

    const { data: stageCountRows } = serviceIds.length
      ? await stageCountQuery
      : { data: [] as { service_id: string }[] };

    const countsByService = new Map<string, number>();
    for (const row of stageCountRows ?? []) {
      countsByService.set(
        row.service_id,
        (countsByService.get(row.service_id) ?? 0) + 1,
      );
    }

    const { data: eventCountRows } = serviceIds.length
      ? await supabase
          .from("events")
          .select("service_id")
          .eq("church_id", churchId)
          .is("deleted_at", null)
          .in("service_id", serviceIds)
      : { data: [] as { service_id: string }[] };

    const eventCountsByService = new Map<string, number>();
    for (const row of eventCountRows ?? []) {
      eventCountsByService.set(
        row.service_id,
        (eventCountsByService.get(row.service_id) ?? 0) + 1,
      );
    }

    const total = count ?? 0;
    const rows: ServiceListItem[] = (data ?? []).map((service) => ({
      ...service,
      stageCount: countsByService.get(service.id) ?? 0,
      eventCount: eventCountsByService.get(service.id) ?? 0,
    }));

    return {
      data: {
        rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to list services." };
  }
}

export async function getServiceById(
  supabase: SupabaseClient<Database>,
  serviceId: string,
  churchId: string,
): Promise<ServiceResult<ServiceRow>> {
  try {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return { data: null, error: "Service not found." };
    }

    return { data, error: null };
  } catch {
    return { data: null, error: "Failed to load service." };
  }
}

export async function createService(
  supabase: SupabaseClient<Database>,
  input: CreateServiceInput,
): Promise<ServiceResult<{ id: string }>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "You must be logged in." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("church_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return { data: null, error: "Profile not found." };
    }

    const { data, error } = await supabase
      .from("services")
      .insert({
        church_id: profile.church_id,
        name_ar: input.name_ar,
        name_en: input.name_en ?? null,
        description_ar: input.description_ar ?? null,
        description_en: input.description_en ?? null,
        sort_order: input.sort_order ?? 0,
      })
      .select("id")
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: { id: data.id }, error: null };
  } catch {
    return { data: null, error: "Failed to create service." };
  }
}

export async function updateService(
  supabase: SupabaseClient<Database>,
  serviceId: string,
  churchId: string,
  input: UpdateServiceInput,
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from("services")
      .update({
        name_ar: input.name_ar,
        name_en: input.name_en ?? null,
        description_ar: input.description_ar ?? null,
        description_en: input.description_en ?? null,
        sort_order: input.sort_order,
        is_active: input.is_active,
      })
      .eq("id", serviceId)
      .eq("church_id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to update service." };
  }
}

export async function setServiceActive(
  supabase: SupabaseClient<Database>,
  serviceId: string,
  churchId: string,
  isActive: boolean,
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from("services")
      .update({ is_active: isActive })
      .eq("id", serviceId)
      .eq("church_id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to update service." };
  }
}
