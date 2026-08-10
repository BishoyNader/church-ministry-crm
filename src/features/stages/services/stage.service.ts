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
  stageIds?: string[],
): Promise<ServiceResult<MinistryListItem[]>> {
  try {
    const scoped = stageIds !== undefined;

    if (scoped && stageIds.length === 0) {
      return { data: [], error: null };
    }

    let allowedMinistryIds: Set<string> | null = null;

    if (scoped) {
      const { data: scopedStages } = await supabase
        .from("stages")
        .select("service_id")
        .eq("church_id", churchId)
        .is("deleted_at", null)
        .in("id", stageIds);

      allowedMinistryIds = new Set((scopedStages ?? []).map((s) => s.service_id as string));
    }

    const ministriesQuery = supabase
      .from("services")
      .select("*")
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .order("sort_order")
      .order("name_ar");

    const { data: ministries, error } = await ministriesQuery;

    if (error) {
      return { data: null, error: error.message };
    }

    const scopedMinistries = (ministries ?? []).filter(
      (m) => !allowedMinistryIds || allowedMinistryIds.has(m.id as string),
    );

    const ministryIds = scopedMinistries.map((m) => m.id);

    let stageCountsQuery = supabase
      .from("stages")
      .select("service_id")
      .eq("church_id", churchId)
      .is("deleted_at", null);

    if (ministryIds.length) {
      stageCountsQuery = stageCountsQuery.in("service_id", ministryIds);
    }

    if (scoped) {
      stageCountsQuery = stageCountsQuery.in("id", stageIds);
    }

    const { data: stageCounts } = ministryIds.length
      ? await stageCountsQuery
      : { data: [] };

    const countsByService = new Map<string, number>();
    for (const stage of stageCounts ?? []) {
      countsByService.set(
        stage.service_id,
        (countsByService.get(stage.service_id) ?? 0) + 1,
      );
    }

    const { data: eventCounts } = ministryIds.length
      ? await supabase
          .from("events")
          .select("service_id")
          .eq("church_id", churchId)
          .is("deleted_at", null)
          .in("service_id", ministryIds)
      : { data: [] };

    const eventCountsByService = new Map<string, number>();
    for (const event of eventCounts ?? []) {
      eventCountsByService.set(
        event.service_id,
        (eventCountsByService.get(event.service_id) ?? 0) + 1,
      );
    }

    const result: MinistryListItem[] = scopedMinistries.map((m) => ({
      ...m,
      stageCount: countsByService.get(m.id) ?? 0,
      eventCount: eventCountsByService.get(m.id) ?? 0,
    }));

    return { data: result, error: null };
  } catch {
    return { data: null, error: "Failed to list services." };
  }
}

export async function getMinistryById(
  supabase: SupabaseClient,
  ministryId: string,
  churchId: string,
): Promise<ServiceResult<MinistryDetail>> {
  try {
    const { data: ministry, error } = await supabase
      .from("services")
      .select("*")
      .eq("id", ministryId)
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .single();

    if (error || !ministry) {
      return { data: null, error: "Service not found." };
    }

    const { data: stages } = await supabase
      .from("stages")
      .select("*")
      .eq("service_id", ministryId)
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .order("sort_order")
      .order("name_ar");

    const stageIds = (stages ?? []).map((s) => s.id);

    const [childrenCounts, usersCounts] = await Promise.all([
      stageIds.length
        ? supabase
            .from("beneficiaries")
            .select("stage_id")
            .eq("church_id", churchId)
            .in("stage_id", stageIds)
            .eq("status", "active")
        : { data: [] as { stage_id: string }[] },
      stageIds.length
          ? supabase
            .from("servant_stage_assignments")
            .select("stage_id")
            .eq("church_id", churchId)
            .in("stage_id", stageIds)
            .eq("is_active", true)
            .is("end_date", null)
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
      return { data: null, error: "Failed to load service." };
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

export async function updateMinistry(
  supabase: SupabaseClient,
  ministryId: string,
  churchId: string,
  input: UpdateMinistryInput,
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
      .eq("id", ministryId)
      .eq("church_id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
      return { data: null, error: "Failed to update service." };
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
      .eq("service_id", ministryId)
      .eq("church_id", churchId)
      .is("deleted_at", null);

    const stageIds = (stages ?? []).map((s) => s.id);

    if (stageIds.length > 0) {
      const { count } = await supabase
        .from("beneficiaries")
        .select("id", { count: "exact", head: true })
        .in("stage_id", stageIds)
        .eq("status", "active");

      if ((count ?? 0) > 0) {
        return {
          data: null,
          error: "Cannot deactivate service because it has stages with active beneficiaries.",
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
      .from("services")
      .update({ deleted_at: now })
      .eq("id", ministryId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
      return { data: null, error: "Failed to deactivate service." };
  }
}

export async function listStages(
  supabase: SupabaseClient,
  churchId: string,
  ministryId?: string,
  stageIds?: string[],
): Promise<ServiceResult<StageListItem[]>> {
  try {
    const scoped = stageIds !== undefined;

    if (scoped && stageIds.length === 0) {
      return { data: [], error: null };
    }

    let query = supabase
      .from("stages")
      .select("*")
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .order("sort_order")
      .order("name_ar");

    if (ministryId) {
      query = query.eq("service_id", ministryId);
    }

    if (scoped) {
      query = query.in("id", stageIds);
    }

    const { data: stages, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    const fetchedStageIds = (stages ?? []).map((s) => s.id);

    const [childrenCounts, usersCounts] = await Promise.all([
      fetchedStageIds.length
        ? supabase
            .from("beneficiaries")
            .select("stage_id")
            .eq("church_id", churchId)
            .in("stage_id", fetchedStageIds)
            .eq("status", "active")
        : { data: [] as { stage_id: string }[] },
      fetchedStageIds.length
          ? supabase
            .from("servant_stage_assignments")
            .select("stage_id")
            .eq("church_id", churchId)
            .in("stage_id", fetchedStageIds)
            .eq("is_active", true)
            .is("end_date", null)
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
        .from("beneficiaries")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .eq("stage_id", stageId)
        .eq("status", "active"),
      supabase
        .from("servant_stage_assignments")
        .select("id", { count: "exact", head: true })
        .eq("church_id", churchId)
        .eq("stage_id", stageId)
        .eq("is_active", true)
        .is("end_date", null),
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

    // Server-side validation (never client-trusted): the stage's service must
    // belong to the actor's church, otherwise the child row would reference a
    // service outside the church's tenant boundary.
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id")
      .eq("id", input.service_id)
      .eq("church_id", profile.church_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (serviceError) {
      return { data: null, error: serviceError.message };
    }

    if (!service) {
      return { data: null, error: "Service not found." };
    }

    const { data, error } = await supabase
      .from("stages")
      .insert({
        church_id: profile.church_id,
        service_id: input.service_id,
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
      .from("beneficiaries")
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
      .from("servant_stage_assignments")
      .select("user_id, profiles:user_id(id, full_name_ar, full_name_en, email, avatar_url)")
      .eq("stage_id", stageId)
      .eq("church_id", churchId)
      .eq("is_active", true)
      .is("end_date", null);

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
      .from("servant_stage_assignments")
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
        .from("servant_stage_assignments")
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
