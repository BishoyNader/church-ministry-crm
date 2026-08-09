import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ServantDetail,
  ServantListParams,
  ServantListResult,
  ServantListItem,
  ServantRole,
  ServantStage,
  ServantStageAssignment,
  UpdateServantInput,
} from "../types/servant.types";

type ServiceResult<T> = { data: T | null; error: string | null };

const PROFILES_SELECT = "id, full_name_ar, full_name_en, email, phone, is_active, avatar_url, created_at";

async function hydrateServants(
  supabase: SupabaseClient,
  servants: ServantListItem[],
): Promise<ServantListItem[]> {
  if (servants.length === 0) return servants;

  const servantIds = servants.map((servant) => servant.id);

  const [{ data: userRoles }, { data: assignments }] = await Promise.all([
    supabase
      .from("user_roles")
      .select("user_id, roles(id, name_ar, name_en, role_type)")
      .in("user_id", servantIds)
      .is("end_date", null),
    supabase
      .from("servant_stage_assignments")
      .select("id, servant_id, stage_id, is_active, start_date, end_date, stages(id, name_ar, name_en)")
      .in("servant_id", servantIds)
      .eq("is_active", true)
      .is("end_date", null),
  ]);

  const rolesByServant = new Map<string, ServantRole[]>();
  for (const ur of userRoles ?? []) {
    const current = rolesByServant.get(ur.user_id) ?? [];
    if (ur.roles) {
      current.push(ur.roles as unknown as ServantRole);
    }
    rolesByServant.set(ur.user_id, current);
  }

  const assignmentsByServant = new Map<string, ServantStageAssignment[]>();
  for (const row of assignments ?? []) {
    const current = assignmentsByServant.get(row.servant_id as string) ?? [];
    current.push(row as unknown as ServantStageAssignment);
    assignmentsByServant.set(row.servant_id as string, current);
  }

  return servants.map((servant) => ({
    ...servant,
    roles: rolesByServant.get(servant.id) ?? [],
    stageAssignments: assignmentsByServant.get(servant.id) ?? [],
  }));
}

export async function listServants(
  supabase: SupabaseClient,
  churchId: string,
  params: ServantListParams,
  stageIds?: string[],
): Promise<ServiceResult<ServantListResult>> {
  const { page, pageSize, search, approvalStatus, stageId } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    if (stageIds && stageIds.length === 0) {
      return { data: { servants: [], total: 0, page, pageSize }, error: null };
    }

    const scoped = stageIds !== undefined;
    const assignmentEmbed = `servant_stage_assignments${scoped ? "!inner" : ""}(stage_id)`;

    let query = supabase
      .from("servants")
      .select(`id, church_id, approval_status, confession_father_name, join_date, notes, approved_by, approved_at, deleted_at, created_at, updated_at, profiles!servants_id_fkey(${PROFILES_SELECT}), ${assignmentEmbed}`, {
        count: "exact",
      })
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (approvalStatus) {
      query = query.eq("approval_status", approvalStatus);
    }

    if (search) {
      query = query.or(
        `profiles.full_name_ar.ilike.%${search}%,profiles.full_name_en.ilike.%${search}%,profiles.email.ilike.%${search}%`,
      );
    }

    if (stageId) {
      query = query.in("servant_stage_assignments.stage_id", [stageId]);
    } else if (stageIds) {
      query = query.in("servant_stage_assignments.stage_id", stageIds);
    }

    const { data, count, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    const servants = (data ?? []) as unknown as ServantListItem[];
    const hydrated = await hydrateServants(supabase, servants);

    return {
      data: {
        servants: hydrated,
        total: count ?? 0,
        page,
        pageSize,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to list servants." };
  }
}

export async function getServantById(
  supabase: SupabaseClient,
  churchId: string,
  servantId: string,
  stageIds?: string[],
): Promise<ServiceResult<ServantDetail>> {
  try {
    if (stageIds && stageIds.length === 0) {
      return { data: null, error: "Servant not found." };
    }

    const scoped = stageIds !== undefined;
    const assignmentEmbed = `servant_stage_assignments${scoped ? "!inner" : ""}(stage_id)`;

    let query = supabase
      .from("servants")
      .select(`id, church_id, approval_status, confession_father_name, join_date, notes, approved_by, approved_at, deleted_at, created_at, updated_at, profiles!servants_id_fkey(${PROFILES_SELECT}), ${assignmentEmbed}`)
      .eq("id", servantId)
      .eq("church_id", churchId)
      .is("deleted_at", null);

    if (stageIds) {
      query = query.in("servant_stage_assignments.stage_id", stageIds);
    }

    const { data: servant, error } = await query.single();

    if (error || !servant) {
      return { data: null, error: "Servant not found." };
    }

    const hydrated = await hydrateServants(supabase, [servant as unknown as ServantListItem]);
    const detail = hydrated[0] ?? null;

    return { data: detail, error: detail ? null : "Servant not found." };
  } catch {
    return { data: null, error: "Failed to load servant." };
  }
}

export async function updateServant(
  supabase: SupabaseClient,
  servantId: string,
  input: UpdateServantInput,
): Promise<ServiceResult<boolean>> {
  const updates: Record<string, string | null> = {};

  if (input.confession_father_name !== undefined) {
    updates.confession_father_name = input.confession_father_name.trim() || null;
  }
  if (input.join_date !== undefined) {
    updates.join_date = input.join_date.trim() || null;
  }
  if (input.notes !== undefined) {
    updates.notes = input.notes.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return { data: false, error: "No changes to save." };
  }

  try {
    const { error } = await supabase
      .from("servants")
      .update(updates)
      .eq("id", servantId)
      .is("deleted_at", null);

    if (error) {
      return { data: false, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: false, error: "Failed to update servant." };
  }
}

export async function assignStages(
  supabase: SupabaseClient,
  churchId: string,
  servantId: string,
  stageIds: string[],
  assignedBy: string,
): Promise<ServiceResult<boolean>> {
  try {
    const { data: servant } = await supabase
      .from("servants")
      .select("id")
      .eq("id", servantId)
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .single();

    if (!servant) {
      return { data: false, error: "Servant not found." };
    }

    const now = new Date().toISOString();

    await supabase
      .from("servant_stage_assignments")
      .update({ is_active: false, end_date: now })
      .eq("servant_id", servantId)
      .eq("church_id", churchId)
      .eq("is_active", true)
      .is("end_date", null);

    if (stageIds.length > 0) {
      const { data: stages, error: stagesError } = await supabase
        .from("stages")
        .select("id, service_id")
        .eq("church_id", churchId)
        .in("id", stageIds);

      if (stagesError) {
        return { data: false, error: stagesError.message };
      }

      if ((stages?.length ?? 0) !== stageIds.length) {
        return { data: false, error: "Some stages are not valid for this church." };
      }

      const stageServiceMap = new Map(
        (stages ?? []).map((stage) => [stage.id, stage.service_id as string | null]),
      );

      const inserts = stageIds.map((stageId) => ({
        church_id: churchId,
        servant_id: servantId,
        stage_id: stageId,
        service_id: stageServiceMap.get(stageId) ?? "",
        is_active: true,
        start_date: now,
        end_date: null,
        assigned_by: assignedBy,
      }));

      const { error } = await supabase.from("servant_stage_assignments").insert(inserts);

      if (error) {
        return { data: false, error: error.message };
      }
    }

    return { data: true, error: null };
  } catch {
    return { data: false, error: "Failed to assign stages." };
  }
}

export async function archiveServant(
  supabase: SupabaseClient,
  churchId: string,
  servantId: string,
): Promise<ServiceResult<boolean>> {
  try {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("servants")
      .update({ deleted_at: now })
      .eq("id", servantId)
      .eq("church_id", churchId)
      .is("deleted_at", null);

    if (error) {
      return { data: false, error: error.message };
    }

    const { error: assignmentError } = await supabase
      .from("servant_stage_assignments")
      .update({ is_active: false, end_date: now })
      .eq("servant_id", servantId)
      .eq("church_id", churchId)
      .eq("is_active", true)
      .is("end_date", null);

    if (assignmentError) {
      return { data: false, error: assignmentError.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: false, error: "Failed to archive servant." };
  }
}

export async function listServantStages(
  supabase: SupabaseClient,
  churchId: string,
  stageIds?: string[],
): Promise<ServiceResult<ServantStage[]>> {
  try {
    if (stageIds && stageIds.length === 0) {
      return { data: [], error: null };
    }

    let query = supabase
      .from("stages")
      .select("id, name_ar, name_en")
      .eq("church_id", churchId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order");

    if (stageIds) {
      query = query.in("id", stageIds);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: (data ?? []) as unknown as ServantStage[], error: null };
  } catch {
    return { data: null, error: "Failed to load stages." };
  }
}
