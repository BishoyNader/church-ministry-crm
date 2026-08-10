import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  CreateEventInput,
  EventFilters,
  EventListItem,
  EventPageData,
  EventRow,
  UpdateEventInput,
} from "../types/events.types";

const DEFAULT_PAGE_SIZE = 20;

type EventResult<T> = { data: T | null; error: string | null };

export type EventServiceOption = {
  id: string;
  name_ar: string;
  name_en: string | null;
};

export type EventStageOption = {
  id: string;
  name_ar: string;
  service_id: string;
};

export type EventOptions = {
  services: EventServiceOption[];
  stages: EventStageOption[];
};

export async function getEventOptions(
  supabase: SupabaseClient<Database>,
  churchId: string,
): Promise<EventResult<EventOptions>> {
  try {
    const [serviceResult, stageResult] = await Promise.all([
      supabase
        .from("services")
        .select("id, name_ar, name_en")
        .eq("church_id", churchId)
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("sort_order")
        .order("name_ar"),
      supabase
        .from("stages")
        .select("id, name_ar, service_id")
        .eq("church_id", churchId)
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("sort_order")
        .order("name_ar"),
    ]);

    if (serviceResult.error || stageResult.error) {
      return { data: null, error: "Failed to load event options." };
    }

    return {
      data: {
        services: (serviceResult.data ?? []).map((row) => ({
          id: row.id,
          name_ar: row.name_ar,
          name_en: row.name_en,
        })),
        stages: (stageResult.data ?? []).map((row) => ({
          id: row.id,
          name_ar: row.name_ar,
          service_id: row.service_id,
        })),
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load event options." };
  }
}

function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[()!,]/g, " ")
    .replace(/[%_\\]/g, (match) => `\\${match}`)
    .replace(/\s+/g, " ")
    .trim();
}

export async function listEvents(
  supabase: SupabaseClient<Database>,
  churchId: string,
  filters: EventFilters = {},
  stageIds?: string[],
): Promise<EventResult<EventPageData>> {
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

    // Stage-scoped actors may only see events attached to their services or
    // stages (mirrors listServices; RLS also enforces stage_scope on SELECT).
    let allowedServiceIds: string[] | null = null;
    let allowedStageIds: string[] | null = null;
    if (scoped) {
      const { data: scopedStages, error: scopedStagesError } = await supabase
        .from("stages")
        .select("id, service_id")
        .eq("church_id", churchId)
        .is("deleted_at", null)
        .in("id", stageIds);

      if (scopedStagesError) return { data: null, error: scopedStagesError.message };

      allowedStageIds = (scopedStages ?? []).map((row) => row.id);
      allowedServiceIds = [...new Set((scopedStages ?? []).map((row) => row.service_id as string))];

      if (allowedStageIds.length === 0) {
        return {
          data: { rows: [], total: 0, page, pageSize, totalPages: 0 },
          error: null,
        };
      }
    }

    let query = supabase
      .from("events")
      .select("*", { count: "exact" })
      .eq("church_id", churchId)
      .is("deleted_at", null);

    if (scoped) {
      query = query.or(
        `service_id.in.(${(allowedServiceIds as string[]).join(",")}),stage_id.in.(${(allowedStageIds as string[]).join(",")})`,
      );
    }

    const search = filters.search?.trim();
    if (search) {
      const pattern = sanitizeSearchTerm(search);
      if (pattern) {
        query = query.or(`title_ar.ilike.%${pattern}%,title_en.ilike.%${pattern}%`);
      }
    }
    if (filters.eventType && filters.eventType !== "all") {
      query = query.eq("event_type", filters.eventType);
    }
    if (filters.serviceId) {
      query = query.eq("service_id", filters.serviceId);
    }

    const { data, error, count } = await query
      .order("start_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) return { data: null, error: error.message };

    const eventIds = (data ?? []).map((event) => event.id);
    const serviceIds = [...new Set((data ?? []).map((event) => event.service_id))];
    const stageIdsSet = new Set(
      (data ?? []).map((event) => event.stage_id).filter((id): id is string => !!id),
    );

    const [serviceRows, stageRows, registrationRows] = await Promise.all([
      serviceIds.length
        ? supabase
            .from("services")
            .select("id, name_ar")
            .in("id", serviceIds)
        : { data: [] as { id: string; name_ar: string }[], error: null },
      stageIdsSet.size > 0
        ? supabase
            .from("stages")
            .select("id, name_ar")
            .in("id", [...stageIdsSet])
        : { data: [] as { id: string; name_ar: string }[], error: null },
      eventIds.length
        ? supabase
            .from("event_registrations")
            .select("event_id")
            .in("event_id", eventIds)
        : { data: [] as { event_id: string }[], error: null },
    ]);

    if (serviceRows.error || stageRows.error || registrationRows.error) {
      return { data: null, error: "Failed to enrich events." };
    }

    const serviceNameById = new Map<string, string>();
    for (const row of serviceRows.data ?? []) {
      serviceNameById.set(row.id, row.name_ar);
    }

    const stageNameById = new Map<string, string>();
    for (const row of stageRows.data ?? []) {
      stageNameById.set(row.id, row.name_ar);
    }

    const registrationsByEvent = new Map<string, number>();
    for (const row of registrationRows.data ?? []) {
      registrationsByEvent.set(
        row.event_id,
        (registrationsByEvent.get(row.event_id) ?? 0) + 1,
      );
    }

    const total = count ?? 0;
    const rows: EventListItem[] = (data ?? []).map((event) => ({
      ...event,
      serviceNameAr: serviceNameById.get(event.service_id) ?? null,
      stageNameAr: event.stage_id ? stageNameById.get(event.stage_id) ?? null : null,
      registrationsCount: registrationsByEvent.get(event.id) ?? 0,
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
    return { data: null, error: "Failed to list events." };
  }
}

export async function getEventById(
  supabase: SupabaseClient<Database>,
  eventId: string,
  churchId: string,
): Promise<EventResult<EventRow>> {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return { data: null, error: "Event not found." };
    }

    return { data, error: null };
  } catch {
    return { data: null, error: "Failed to load event." };
  }
}

export async function createEvent(
  supabase: SupabaseClient<Database>,
  input: CreateEventInput,
): Promise<EventResult<{ id: string }>> {
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
      .from("events")
      .insert({
        church_id: profile.church_id,
        created_by: user.id,
        service_id: input.service_id,
        stage_id: input.stage_id ?? null,
        title_ar: input.title_ar,
        title_en: input.title_en ?? null,
        description_ar: input.description_ar ?? null,
        description_en: input.description_en ?? null,
        location_ar: input.location_ar ?? null,
        event_type: input.event_type,
        start_at: input.start_at,
        end_at: input.end_at ?? null,
        capacity: input.capacity ?? null,
        is_active: input.is_active ?? true,
      })
      .select("id")
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: { id: data.id }, error: null };
  } catch {
    return { data: null, error: "Failed to create event." };
  }
}

export async function updateEvent(
  supabase: SupabaseClient<Database>,
  eventId: string,
  churchId: string,
  input: UpdateEventInput,
): Promise<EventResult<boolean>> {
  try {
    const { error } = await supabase
      .from("events")
      .update({
        service_id: input.service_id,
        stage_id: input.stage_id ?? null,
        title_ar: input.title_ar,
        title_en: input.title_en ?? null,
        description_ar: input.description_ar ?? null,
        description_en: input.description_en ?? null,
        location_ar: input.location_ar ?? null,
        event_type: input.event_type,
        start_at: input.start_at,
        end_at: input.end_at ?? null,
        capacity: input.capacity ?? null,
        is_active: input.is_active,
      })
      .eq("id", eventId)
      .eq("church_id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to update event." };
  }
}

export async function deleteEvent(
  supabase: SupabaseClient<Database>,
  eventId: string,
  churchId: string,
): Promise<EventResult<boolean>> {
  try {
    const { error } = await supabase
      .from("events")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", eventId)
      .eq("church_id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to delete event." };
  }
}
