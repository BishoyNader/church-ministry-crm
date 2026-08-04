import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  ClassFilters,
  ClassListItem,
  ClassPageData,
  ClassRow,
  CreateClassInput,
  StageOption,
  UpdateClassInput,
} from "../types/classes.types";

const DEFAULT_PAGE_SIZE = 20;

type ClassResult<T> = { data: T | null; error: string | null };

type StageWithService = {
  id: string;
  name_ar: string;
  name_en: string | null;
  service_id: string;
  services:
    | { name_ar: string; name_en: string | null }
    | { name_ar: string; name_en: string | null }[]
    | null;
};

function normalizeStageWithService(row: unknown): StageWithService {
  return row as unknown as StageWithService;
}

function serviceNameOf(stage: StageWithService): string {
  const service = Array.isArray(stage.services) ? stage.services[0] : stage.services;
  return service?.name_ar ?? "";
}

async function fetchStageMap(
  supabase: SupabaseClient<Database>,
  churchId: string,
  stageIds: string[],
): Promise<Map<string, StageWithService>> {
  const map = new Map<string, StageWithService>();
  if (stageIds.length === 0) return map;

  const { data } = await supabase
    .from("stages")
    .select("id, name_ar, name_en, service_id, services:service_id(name_ar, name_en)")
    .eq("church_id", churchId)
    .in("id", stageIds)
    .is("deleted_at", null);

  for (const row of data ?? []) {
    const stage = normalizeStageWithService(row);
    map.set(stage.id, stage);
  }

  return map;
}

function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[()!,]/g, " ")
    .replace(/[%_\\]/g, (match) => `\\${match}`)
    .replace(/\s+/g, " ")
    .trim();
}

export async function listClasses(
  supabase: SupabaseClient<Database>,
  churchId: string,
  filters: ClassFilters = {},
): Promise<ClassResult<ClassPageData>> {
  try {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
    const from = (page - 1) * pageSize;
    const to = page * pageSize - 1;

    let query = supabase
      .from("classes")
      .select("*", { count: "exact" })
      .eq("church_id", churchId)
      .is("deleted_at", null);

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

    const classRows = data ?? [];
    const stageIds = classRows.map((classRow) => classRow.stage_id);

    const stageMap = await fetchStageMap(supabase, churchId, stageIds);

    const total = count ?? 0;
    const rows: ClassListItem[] = classRows.map((classRow) => {
      const stage = stageMap.get(classRow.stage_id);
      return {
        ...classRow,
        stageName: stage?.name_ar ?? "",
        serviceName: stage ? serviceNameOf(stage) : "",
      };
    });

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
    return { data: null, error: "Failed to list classes." };
  }
}

export async function listStageOptions(
  supabase: SupabaseClient<Database>,
  churchId: string,
): Promise<ClassResult<StageOption[]>> {
  try {
    const { data, error } = await supabase
      .from("stages")
      .select("id, name_ar, name_en, service_id, services:service_id(name_ar, name_en)")
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .order("sort_order")
      .order("name_ar");

    if (error) return { data: null, error: error.message };

    const options: StageOption[] = (data ?? []).map((row) => {
      const stage = normalizeStageWithService(row);
      return {
        id: stage.id,
        name_ar: stage.name_ar,
        name_en: stage.name_en,
        service_name_ar: serviceNameOf(stage),
        service_name_en: (Array.isArray(stage.services)
          ? stage.services[0]
          : stage.services)?.name_en ?? null,
      };
    });

    return { data: options, error: null };
  } catch {
    return { data: null, error: "Failed to load stage options." };
  }
}

export async function getClassById(
  supabase: SupabaseClient<Database>,
  classId: string,
  churchId: string,
): Promise<ClassResult<ClassRow>> {
  try {
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("id", classId)
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return { data: null, error: "Class not found." };
    }

    return { data, error: null };
  } catch {
    return { data: null, error: "Failed to load class." };
  }
}

export async function createClass(
  supabase: SupabaseClient<Database>,
  input: CreateClassInput,
): Promise<ClassResult<{ id: string }>> {
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
      .from("classes")
      .insert({
        church_id: profile.church_id,
        stage_id: input.stage_id,
        name_ar: input.name_ar,
        name_en: input.name_en ?? null,
        sort_order: input.sort_order ?? 0,
      })
      .select("id")
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: { id: data.id }, error: null };
  } catch {
    return { data: null, error: "Failed to create class." };
  }
}

export async function updateClass(
  supabase: SupabaseClient<Database>,
  classId: string,
  churchId: string,
  input: UpdateClassInput,
): Promise<ClassResult<boolean>> {
  try {
    const { error } = await supabase
      .from("classes")
      .update({
        stage_id: input.stage_id,
        name_ar: input.name_ar,
        name_en: input.name_en ?? null,
        sort_order: input.sort_order,
        is_active: input.is_active,
      })
      .eq("id", classId)
      .eq("church_id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to update class." };
  }
}

export async function setClassActive(
  supabase: SupabaseClient<Database>,
  classId: string,
  churchId: string,
  isActive: boolean,
): Promise<ClassResult<boolean>> {
  try {
    const { error } = await supabase
      .from("classes")
      .update({ is_active: isActive })
      .eq("id", classId)
      .eq("church_id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to update class." };
  }
}
