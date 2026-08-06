import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  ChurchFilters,
  ChurchListItem,
  ChurchDetail,
  ChurchStats,
  CreateChurchInput,
  UpdateChurchInput,
} from "../types/church.types";

const DEFAULT_PAGE_SIZE = 20;

type ServiceResult<T> = { data: T | null; error: string | null };

function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[()!,]/g, " ")
    .replace(/[%_\\]/g, (match) => `\\${match}`)
    .replace(/\s+/g, " ")
    .trim();
}

export async function listChurches(
  supabase: SupabaseClient<Database>,
  filters: ChurchFilters = {},
): Promise<ServiceResult<ChurchListItem[]>> {
  try {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
    const from = (page - 1) * pageSize;
    const to = page * pageSize - 1;

    let query = supabase
      .from("churches")
      .select("*", { count: "exact" })
      .is("deleted_at", null);

    const search = filters.search?.trim();
    if (search) {
      const pattern = sanitizeSearchTerm(search);
      if (pattern) {
        query = query.or(`name_ar.ilike.%${pattern}%,name_en.ilike.%${pattern}%,slug.ilike.%${pattern}%`);
      }
    }

    if (filters.status === "active") {
      query = query.eq("is_active", true);
    }
    if (filters.status === "inactive") {
      query = query.eq("is_active", false);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return { data: null, error: error.message };
    }

    return {
      data: (data ?? []) as ChurchListItem[],
      error: null,
    };
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

    const [
      memberCountResult,
      servantCountResult,
      serviceCountResult,
      stageCountResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .is("deleted_at", null),
      supabase
        .from("servants")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .is("deleted_at", null),
      supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .is("deleted_at", null),
      supabase
        .from("stages")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .is("deleted_at", null),
    ]);

    if (memberCountResult.error) {
      return { data: null, error: memberCountResult.error.message };
    }
    if (servantCountResult.error) {
      return { data: null, error: servantCountResult.error.message };
    }
    if (serviceCountResult.error) {
      return { data: null, error: serviceCountResult.error.message };
    }
    if (stageCountResult.error) {
      return { data: null, error: stageCountResult.error.message };
    }

    const detail: ChurchDetail = {
      ...church,
      memberCount: memberCountResult.count ?? 0,
      servantCount: servantCountResult.count ?? 0,
      serviceCount: serviceCountResult.count ?? 0,
      stageCount: stageCountResult.count ?? 0,
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
        name_en: input.name_en ?? null,
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
    if (input.name_en !== undefined) updatePayload.name_en = input.name_en;
    if (input.slug !== undefined) updatePayload.slug = input.slug;
    if (input.contact_email !== undefined) updatePayload.contact_email = input.contact_email;
    if (input.contact_phone !== undefined) updatePayload.contact_phone = input.contact_phone;
    if (input.address_ar !== undefined) updatePayload.address_ar = input.address_ar;
    if (input.address_en !== undefined) updatePayload.address_en = input.address_en;
    if (input.is_active !== undefined) updatePayload.is_active = input.is_active;
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
  try {
    const { error } = await supabase
      .from("churches")
      .update({ is_active: isActive })
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
    const [
      memberCountResult,
      servantCountResult,
      serviceCountResult,
      stageCountResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .is("deleted_at", null),
      supabase
        .from("servants")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .is("deleted_at", null),
      supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .is("deleted_at", null),
      supabase
        .from("stages")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .is("deleted_at", null),
    ]);

    if (memberCountResult.error) {
      return { data: null, error: memberCountResult.error.message };
    }
    if (servantCountResult.error) {
      return { data: null, error: servantCountResult.error.message };
    }
    if (serviceCountResult.error) {
      return { data: null, error: serviceCountResult.error.message };
    }
    if (stageCountResult.error) {
      return { data: null, error: stageCountResult.error.message };
    }

    const stats: ChurchStats = {
      memberCount: memberCountResult.count ?? 0,
      servantCount: servantCountResult.count ?? 0,
      serviceCount: serviceCountResult.count ?? 0,
      stageCount: stageCountResult.count ?? 0,
    };

    return { data: stats, error: null };
  } catch {
    return { data: null, error: "Failed to load church statistics." };
  }
}