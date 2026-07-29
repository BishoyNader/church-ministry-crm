import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MinistryListItem,
  MinistryDetail,
  StageListItem,
  StageUser,
  CreateMinistryInput,
  UpdateMinistryInput,
  CreateStageInput,
  UpdateStageInput,
} from "../types/stage.types";

type ServiceResult<T> = { data: T | null; error: string | null };

export async function listMinistries(
  supabase: SupabaseClient,
  churchId: string,
): Promise<ServiceResult<MinistryListItem[]>> {
  try {
    const { data: ministries, error } = await supabase
      .from("ministries")
      .select("*")
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .order("sort_order")
      .order("name_ar");

    if (error) {
      return { data: null, error: error.message };
    }

    const ministryIds = (ministries ?? []).map((m) => m.id);

    const { data: stageCounts } = ministryIds.length
      ? await supabase
          .from("stages")
          .select("ministry_id")
          .eq("church_id", churchId)
          .in("ministry_id", ministryIds)
          .is("deleted_at", null)
      : { data: [] };

    const countsByMinistry = new Map<string, number>();
    for (const stage of stageCounts ?? []) {
      countsByMinistry.set(
        stage.ministry_id,
        (countsByMinistry.get(stage.ministry_id) ?? 0) + 1,
      );
    }

    const result: MinistryListItem[] = (ministries ?? []).map((m) => ({
      ...m,
      stageCount: countsByMinistry.get(m.id) ?? 0,
    }));

    return { data: result, error: null };
  } catch {
    return { data: null, error: "Failed to list ministries." };
  }
}

export async function getMinistryById(
  supabase: SupabaseClient,
  ministryId: string,
  churchId: string,
): Promise<ServiceResult<MinistryDetail>> {
  try {
    const { data: ministry, error } = await supabase
      .from("ministries")
      .select("*")
      .eq("id", ministryId)
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .single();

    if (error || !ministry) {
      return { data: null, error: "Ministry not found." };
    }

    const { data: stages } = await supabase
      .from("stages")
      .select("*")
      .eq("ministry_id", ministryId)
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .order("sort_order")
      .order("name_ar");

    const stageIds = (stages ?? []).map((s) => s.id);

    const [childrenCounts, usersCounts] = await Promise.all([
      stageIds.length
        ? supabase
            .from("children")
            .select("stage_id")
            .eq("church_id", churchId)
            .in("stage_id", stageIds)
            .eq("status", "active")
        : { data: [] as { stage_id: string }[] },
      stageIds.length
        ? supabase
            .from("user_stage_assignments")
            .select("stage_id")
            .eq("church_id", churchId)
            .in("stage_id", stageIds)
        : { data: [] as { stage_id: string }[] },
    ]);

    const childrenByStage = new Map<string, number>();
    for (const row of childrenCounts.data ?? []) {
      childrenByStage.set(
        row.stage_id,
        (childrenByStage.get(row.stage_id) ?? 0) + 1,
      );
    }

    const usersByStage = new Map<string, number>();
    for (const row of usersCounts.data ?? []) {
      usersByStage.set(
        row.stage_id,
        (usersByStage.get(row.stage_id) ?? 0) + 1,
      );
    }

    const stagesResult: StageListItem[] = (stages ?? []).map((s) => ({
      ...s,
      childrenCount: childrenByStage.get(s.id) ?? 0,
      usersCount: usersByStage.get(s.id) ?? 0,
    }));

    return {
      data: { ...ministry, stages: stagesResult },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load ministry." };
  }
}

export async function createMinistry(
  supabase: SupabaseClient,
  input: CreateMinistryInput,
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
      .from("ministries")
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
    return { data: null, error: "Failed to create ministry." };
  }
}

export async function updateMinistry(
  supabase: SupabaseClient,
  ministryId: string,
  churchId: string,
  input: UpdateMinistryInput,
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from("ministries")
      .update({
        name_ar: input.name_ar,
        name_en: input.name_en ?? null,
        description_ar: input.description_ar ?? null,
        description_en: input.description_en ?? null,
        sort_order: input.sort_order,
        is_active: input.is_active,
      })
      .eq("id", ministryId)
      .eq("church_id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to update ministry." };
  }
}

export async function deactivateMinistry(
  supabase: SupabaseClient,
  ministryId: string,
  churchId: string,
): Promise<ServiceResult<boolean>> {
  try {
    const { data: stages } = await supabase
      .from("stages")
      .select("id")
      .eq("ministry_id", ministryId)
      .eq("church_id", churchId)
      .is("deleted_at", null);

    const stageIds = (stages ?? []).map((s) => s.id);

    if (stageIds.length > 0) {
      const { count } = await supabase
        .from("children")
        .select("id", { count: "exact", head: true })
        .in("stage_id", stageIds)
        .eq("status", "active");

      if ((count ?? 0) > 0) {
        return {
          data: null,
          error: "Cannot deactivate ministry because it has stages with active beneficiaries.",
        };
      }
    }

    const now = new Date().toISOString();

    if (stageIds.length > 0) {
      await supabase
        .from("stages")
        .update({ deleted_at: now })
        .in("id", stageIds);
    }

    const { error } = await supabase
      .from("ministries")
      .update({ deleted_at: now })
      .eq("id", ministryId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to deactivate ministry." };
  }
}

export async function listStages(
  supabase: SupabaseClient,
  churchId: string,
  ministryId?: string,
): Promise<ServiceResult<StageListItem[]>> {
  try {
    let query = supabase
      .from("stages")
      .select("*")
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .order("sort_order")
      .order("name_ar");

    if (ministryId) {
      query = query.eq("ministry_id", ministryId);
    }

    const { data: stages, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    const stageIds = (stages ?? []).map((s) => s.id);

    const [childrenCounts, usersCounts] = await Promise.all([
      stageIds.length
        ? supabase
            .from("children")
            .select("stage_id")
            .eq("church_id", churchId)
            .in("stage_id", stageIds)
            .eq("status", "active")
        : { data: [] as { stage_id: string }[] },
      stageIds.length
        ? supabase
            .from("user_stage_assignments")
            .select("stage_id")
            .eq("church_id", churchId)
            .in("stage_id", stageIds)
        : { data: [] as { stage_id: string }[] },
    ]);

    const childrenByStage = new Map<string, number>();
    for (const row of childrenCounts.data ?? []) {
      childrenByStage.set(
        row.stage_id,
        (childrenByStage.get(row.stage_id) ?? 0) + 1,
      );
    }

    const usersByStage = new Map<string, number>();
    for (const row of usersCounts.data ?? []) {
      usersByStage.set(
        row.stage_id,
        (usersByStage.get(row.stage_id) ?? 0) + 1,
      );
    }

    const result: StageListItem[] = (stages ?? []).map((s) => ({
      ...s,
      childrenCount: childrenByStage.get(s.id) ?? 0,
      usersCount: usersByStage.get(s.id) ?? 0,
    }));

    return { data: result, error: null };
  } catch {
    return { data: null, error: "Failed to list stages." };
  }
}

export async function getStageById(
  supabase: SupabaseClient,
  stageId: string,
  churchId: string,
): Promise<ServiceResult<StageListItem>> {
  try {
    const { data: stage, error } = await supabase
      .from("stages")
      .select("*")
      .eq("id", stageId)
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .single();

    if (error || !stage) {
      return { data: null, error: "Stage not found." };
    }

    const [childrenResult, usersResult] = await Promise.all([
      supabase
        .from("children")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .eq("stage_id", stageId)
        .eq("status", "active"),
      supabase
        .from("user_stage_assignments")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .eq("stage_id", stageId),
    ]);

    return {
      data: {
        ...stage,
        childrenCount: childrenResult.count ?? 0,
        usersCount: usersResult.count ?? 0,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load stage." };
  }
}

export async function createStage(
  supabase: SupabaseClient,
  input: CreateStageInput,
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
      .from("stages")
      .insert({
        church_id: profile.church_id,
        ministry_id: input.ministry_id,
        name_ar: input.name_ar,
        name_en: input.name_en ?? null,
        description_ar: input.description_ar ?? null,
        description_en: input.description_en ?? null,
        age_min: input.age_min ?? null,
        age_max: input.age_max ?? null,
        sort_order: input.sort_order ?? 0,
      })
      .select("id")
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: { id: data.id }, error: null };
  } catch {
    return { data: null, error: "Failed to create stage." };
  }
}

export async function updateStage(
  supabase: SupabaseClient,
  stageId: string,
  churchId: string,
  input: UpdateStageInput,
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from("stages")
      .update({
        name_ar: input.name_ar,
        name_en: input.name_en ?? null,
        description_ar: input.description_ar ?? null,
        description_en: input.description_en ?? null,
        age_min: input.age_min ?? null,
        age_max: input.age_max ?? null,
        sort_order: input.sort_order,
        is_active: input.is_active,
      })
      .eq("id", stageId)
      .eq("church_id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to update stage." };
  }
}

export async function deactivateStage(
  supabase: SupabaseClient,
  stageId: string,
  churchId: string,
): Promise<ServiceResult<boolean>> {
  try {
    const { count } = await supabase
      .from("children")
      .select("id", { count: "exact", head: true })
      .eq("church_id", churchId)
      .eq("stage_id", stageId)
      .eq("status", "active");

    if ((count ?? 0) > 0) {
      return {
        data: null,
        error: "Cannot deactivate stage because it has active beneficiaries.",
      };
    }

    const { error } = await supabase
      .from("stages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", stageId)
      .eq("church_id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to deactivate stage." };
  }
}

export async function getStageUsers(
  supabase: SupabaseClient,
  stageId: string,
  churchId: string,
): Promise<ServiceResult<StageUser[]>> {
  try {
    const { data: assignments, error } = await supabase
      .from("user_stage_assignments")
      .select("user_id, profiles:user_id(id, full_name_ar, full_name_en, email, avatar_url)")
      .eq("stage_id", stageId)
      .eq("church_id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    const users: StageUser[] = (assignments ?? [])
      .map((a) => a.profiles)
      .filter(Boolean)
      .map((p) => p as unknown as StageUser);

    return { data: users, error: null };
  } catch {
    return { data: null, error: "Failed to load stage users." };
  }
}

export async function assignUsersToStage(
  supabase: SupabaseClient,
  stageId: string,
  userIds: string[],
  assignedBy: string,
): Promise<ServiceResult<boolean>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "You must be logged in." };
    }

    const { data: stage } = await supabase
      .from("stages")
      .select("church_id")
      .eq("id", stageId)
      .single();

    if (!stage) {
      return { data: null, error: "Stage not found." };
    }

    await supabase
      .from("user_stage_assignments")
      .delete()
      .eq("stage_id", stageId)
      .eq("church_id", stage.church_id);

    if (userIds.length > 0) {
      const inserts = userIds.map((userId) => ({
        church_id: stage.church_id,
        stage_id: stageId,
        user_id: userId,
        assigned_by: assignedBy,
      }));

      const { error } = await supabase
        .from("user_stage_assignments")
        .insert(inserts);

      if (error) {
        return { data: null, error: error.message };
      }
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to assign users to stage." };
  }
}

export async function listAllUsers(
  supabase: SupabaseClient,
  churchId: string,
): Promise<ServiceResult<Pick<import("../types/stage.types").ProfileRow, "id" | "full_name_ar" | "full_name_en" | "email" | "avatar_url">[]>> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name_ar, full_name_en, email, avatar_url")
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("full_name_ar");

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
  } catch {
    return { data: null, error: "Failed to list users." };
  }
}
