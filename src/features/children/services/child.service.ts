import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChildListItem,
  ChildRowWithNames,
  ChildDetail,
  AttendanceListItem,
  FollowupListItem,
  CreateChildInput,
  UpdateChildInput,
  TransferChildInput,
  CreateAttendanceInput,
  BatchAttendanceInput,
  CreateFollowupInput,
  UpdateFollowupInput,
  PaginationInput,
  PaginatedResult,
} from "../types/child.types";

type ServiceResult<T> = { data: T | null; error: string | null };

function emptyPaginatedResult(
  page: number,
  pageSize: number,
): ServiceResult<PaginatedResult<ChildListItem>> {
  return {
    data: { data: [], total: 0, page, pageSize, totalPages: 0 },
    error: null,
  };
}

export async function listChildren(
  supabase: SupabaseClient,
  churchId: string,
  filters?: {
    search?: string;
    service_id?: string;
    stage_id?: string;
    stageIds?: string[];
    status?: string;
  },
  pagination?: PaginationInput,
): Promise<ServiceResult<PaginatedResult<ChildListItem>>> {
  try {
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (filters?.stageIds && filters.stageIds.length === 0) {
      return emptyPaginatedResult(page, pageSize);
    }

    let query = supabase
      .from("beneficiaries")
      .select(
        "*, beneficiary_assignments!inner(service_id, stage_id, services(name_ar), stages(name_ar))",
        { count: "exact" },
      )
      .eq("church_id", churchId)
      .eq("beneficiary_assignments.is_current", true)
      .is("deleted_at", null)
      .order("full_name_ar");

    if (filters?.search) {
      const term = `%${filters.search}%`;
      query = query.or(
        `full_name_ar.ilike.${term},full_name_en.ilike.${term},mobile.ilike.${term}`,
      );
    }

    if (filters?.service_id) {
      query = query.eq(
        "beneficiary_assignments.service_id",
        filters.service_id,
      );
    }

    if (filters?.stage_id) {
      query = query.eq("beneficiary_assignments.stage_id", filters.stage_id);
    }

    if (filters?.stageIds) {
      query = query.in("beneficiary_assignments.stage_id", filters.stageIds);
    }

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    const result: ChildListItem[] = (data ?? []).map((row) => {
      const joined = row as ChildRowWithNames;
      const current = joined.beneficiary_assignments?.[0];
      return {
        ...row,
        serviceId: current?.service_id ?? "",
        stageId: current?.stage_id ?? "",
        serviceNameAr: current?.services?.name_ar ?? "",
        stageNameAr: current?.stages?.name_ar ?? "",
      } as ChildListItem;
    });

    const total = count ?? 0;

    return {
      data: {
        data: result,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to list children." };
  }
}

export async function getChildById(
  supabase: SupabaseClient,
  childId: string,
  churchId: string,
  stageIds?: string[],
): Promise<ServiceResult<ChildDetail>> {
  try {
    if (stageIds && stageIds.length === 0) {
      return { data: null, error: "Child not found." };
    }

    let query = supabase
      .from("beneficiaries")
      .select(
        "*, beneficiary_assignments!inner(service_id, stage_id, services(name_ar), stages(name_ar))",
      )
      .eq("id", childId)
      .eq("church_id", churchId)
      .eq("beneficiary_assignments.is_current", true)
      .is("deleted_at", null);

    if (stageIds) {
      query = query.in("beneficiary_assignments.stage_id", stageIds);
    }

    const { data: child, error } = await query.single();

    if (error || !child) {
      return { data: null, error: "Child not found." };
    }

    const [attendanceResult, followupsResult] = await Promise.all([
      supabase
        .from("attendance_records")
        .select("*, attendance_sessions!inner(session_date)")
        .eq("church_id", churchId)
        .eq("beneficiary_id", childId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("followups")
        .select(
          "*, servants!followups_assigned_to_fkey(profiles!servants_id_fkey(full_name_ar))",
        )
        .eq("church_id", churchId)
        .eq("beneficiary_id", childId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    /* eslint-disable @typescript-eslint/no-explicit-any */
    type ChildRowWithJoins = any;
    const typedChild = child as ChildRowWithJoins;
    const currentAssignment = typedChild.beneficiary_assignments?.[0];
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return {
      data: {
        ...(typedChild as Record<string, unknown>),
        serviceId: currentAssignment?.service_id ?? "",
        stageId: currentAssignment?.stage_id ?? "",
        serviceNameAr: currentAssignment?.services?.name_ar ?? "",
        stageNameAr: currentAssignment?.stages?.name_ar ?? "",
        attendance: attendanceResult.data ?? [],
        followups: followupsResult.data ?? [],
      } as ChildDetail,
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load child." };
  }
}

export async function createChild(
  supabase: SupabaseClient,
  input: CreateChildInput,
): Promise<ServiceResult<{ id: string }>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "You must be logged in." };
    }

    // NOTE: creating a beneficiary + its current beneficiary_assignments row is
    // done through a single SECURITY DEFINER RPC (024). beneficiary_assignments
    // is RLS-immutable (UPDATE/DELETE denied) and its INSERT policy only allows
    // admins, so the app-layer cannot perform the two writes atomically.
    const { data, error } = await supabase.rpc("create_beneficiary_with_assignment", {
      p_full_name_ar: input.full_name_ar,
      p_full_name_en: input.full_name_en ?? null,
      p_date_of_birth: input.date_of_birth ?? null,
      p_gender: input.gender ?? null,
      p_service_id: input.service_id,
      p_stage_id: input.stage_id,
      p_mobile: input.mobile ?? null,
      p_father_mobile: input.father_mobile ?? null,
      p_mother_mobile: input.mother_mobile ?? null,
      p_whatsapp: input.whatsapp ?? null,
      p_address: input.address ?? null,
      p_school: input.school ?? null,
      p_confession_father: input.confession_father ?? null,
      p_notes: input.notes ?? null,
      p_photo_url: input.photo_url ?? null,
    });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: { id: data as string }, error: null };
  } catch {
    return { data: null, error: "Failed to create child." };
  }
}

export async function updateChild(
  supabase: SupabaseClient,
  childId: string,
  churchId: string,
  input: UpdateChildInput,
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from("beneficiaries")
      .update({
        full_name_ar: input.full_name_ar,
        full_name_en: input.full_name_en ?? null,
        date_of_birth: input.date_of_birth ?? null,
        gender: input.gender ?? null,
        status: input.status,
        father_mobile: input.father_mobile ?? null,
        mother_mobile: input.mother_mobile ?? null,
        mobile: input.mobile ?? null,
        whatsapp: input.whatsapp ?? null,
        address: input.address ?? null,
        school: input.school ?? null,
        confession_father: input.confession_father ?? null,
        notes: input.notes ?? null,
        photo_url: input.photo_url ?? null,
      })
      .eq("id", childId)
      .eq("church_id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to update child." };
  }
}

export async function transferChild(
  supabase: SupabaseClient,
  childId: string,
  churchId: string,
  input: TransferChildInput,
): Promise<ServiceResult<boolean>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "You must be logged in." };
    }

    // NOTE: transfers run through the SECURITY DEFINER RPC (024). The old
    // current assignment must be closed (is_current=false) and a new one
    // inserted atomically, but beneficiary_assignments is RLS-immutable
    // (immutable_update/immutable_delete) — only the RPC can do this.
    const { error } = await supabase.rpc("transfer_beneficiary", {
      p_beneficiary_id: childId,
      p_new_service_id: input.service_id,
      p_new_stage_id: input.stage_id,
    });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to transfer child." };
  }
}

export async function deactivateChild(
  supabase: SupabaseClient,
  childId: string,
  churchId: string,
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from("beneficiaries")
      .update({
        deleted_at: new Date().toISOString(),
        status: "inactive",
      })
      .eq("id", childId)
      .eq("church_id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to deactivate child." };
  }
}

export async function createAttendance(
  supabase: SupabaseClient,
  input: CreateAttendanceInput,
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

    const { data: session, error: sessionError } = await supabase
      .from("attendance_sessions")
      .upsert({
        church_id: profile.church_id,
        service_id: input.service_id,
        stage_id: input.stage_id,
        session_date: input.attendance_date,
        created_by: user.id,
      }, {
        onConflict: "stage_id,session_date",
      })
      .select("id")
      .single();

    if (sessionError) {
      return { data: null, error: sessionError.message };
    }

    const { data, error } = await supabase
      .from("attendance_records")
      .insert({
        church_id: profile.church_id,
        session_id: session.id,
        beneficiary_id: input.beneficiary_id,
        status: input.status,
        notes: input.notes ?? null,
        recorded_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: { id: data.id }, error: null };
  } catch {
    return { data: null, error: "Failed to create attendance." };
  }
}

export async function batchAttendance(
  supabase: SupabaseClient,
  input: BatchAttendanceInput,
): Promise<ServiceResult<{ created: number; updated: number }>> {
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

    const { data: session, error: sessionError } = await supabase
      .from("attendance_sessions")
      .upsert({
        church_id: profile.church_id,
        service_id: input.service_id,
        stage_id: input.stage_id,
        session_date: input.attendance_date,
        created_by: user.id,
      }, {
        onConflict: "stage_id,session_date",
      })
      .select("id")
      .single();

    if (sessionError) {
      return { data: null, error: sessionError.message };
    }

    const beneficiaryIds = input.records.map((r) => r.beneficiary_id);

    const { data: existing } = await supabase
      .from("attendance_records")
      .select("beneficiary_id")
      .eq("church_id", profile.church_id)
      .eq("session_id", session.id)
      .in("beneficiary_id", beneficiaryIds);

    const existingIds = new Set((existing ?? []).map((r) => r.beneficiary_id));

    // Sprint 2 (Phase 5): one multi-row upsert instead of N per-record
    // requests (removes the N+1 on the bulk-attendance screen).
    const rows = input.records.map((record) => ({
      church_id: profile.church_id,
      session_id: session.id,
      beneficiary_id: record.beneficiary_id,
      status: record.status,
      notes: record.notes ?? null,
      recorded_by: user.id,
    }));

    const { error: upsertError } = await supabase
      .from("attendance_records")
      .upsert(rows, { onConflict: "church_id,session_id,beneficiary_id" });

    if (upsertError) {
      return { data: null, error: upsertError.message };
    }

    const created = rows.filter((r) => !existingIds.has(r.beneficiary_id)).length;
    const updated = rows.length - created;

    return { data: { created, updated }, error: null };
  } catch {
    return { data: null, error: "Failed to batch attendance." };
  }
}

export async function listAttendance(
  supabase: SupabaseClient,
  churchId: string,
  filters?: {
    beneficiary_id?: string;
    stage_id?: string;
    stageIds?: string[];
    from_date?: string;
    to_date?: string;
  },
): Promise<ServiceResult<AttendanceListItem[]>> {
  try {
    if (filters?.stageIds && filters.stageIds.length === 0) {
      return { data: [], error: null };
    }

    let query = supabase
      .from("attendance_records")
      .select(
        "*, attendance_sessions!inner(session_date, stage_id, service_id, stages(name_ar)), beneficiaries(full_name_ar)",
      )
      .eq("church_id", churchId)
      .order("created_at", { ascending: false });

    if (filters?.beneficiary_id) {
      query = query.eq("beneficiary_id", filters.beneficiary_id);
    }

    if (filters?.stage_id) {
      query = query.eq("attendance_sessions.stage_id", filters.stage_id);
    }

    if (filters?.stageIds) {
      query = query.in("attendance_sessions.stage_id", filters.stageIds);
    }

    if (filters?.from_date) {
      query = query.gte("attendance_sessions.session_date", filters.from_date);
    }

    if (filters?.to_date) {
      query = query.lte("attendance_sessions.session_date", filters.to_date);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    type AttendanceRowWithJoins = any;
    const rows = (data ?? []) as AttendanceRowWithJoins[];
    const result: AttendanceListItem[] = rows.map((row) => ({
      ...row,
      childFullNameAr: row.beneficiaries?.full_name_ar ?? "",
      stageNameAr: row.attendance_sessions?.stages?.name_ar ?? "",
    } as AttendanceListItem));
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return { data: result, error: null };
  } catch {
    return { data: null, error: "Failed to list attendance." };
  }
}

export async function createFollowup(
  supabase: SupabaseClient,
  input: CreateFollowupInput,
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
      .from("followups")
      .insert({
        church_id: profile.church_id,
        servant_id: user.id,
        beneficiary_id: input.beneficiary_id,
        type: input.type,
        scheduled_at: input.scheduled_at ?? null,
        assigned_to: input.assigned_to || null,
        notes: input.notes ?? null,
      })
      .select("id")
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: { id: data.id }, error: null };
  } catch {
    return { data: null, error: "Failed to create followup." };
  }
}

export async function updateFollowup(
  supabase: SupabaseClient,
  followupId: string,
  churchId: string,
  input: UpdateFollowupInput,
): Promise<ServiceResult<boolean>> {
  try {
    const updateData: Record<string, unknown> = {};

    if (input.status !== undefined) updateData.status = input.status;
    if (input.outcome !== undefined) updateData.outcome = input.outcome;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.assigned_to !== undefined) updateData.assigned_to = input.assigned_to || null;
    if (input.scheduled_at !== undefined) updateData.scheduled_at = input.scheduled_at;

    if (input.status === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("followups")
      .update(updateData)
      .eq("id", followupId)
      .eq("church_id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to update followup." };
  }
}

export async function listFollowups(
  supabase: SupabaseClient,
  churchId: string,
  filters?: {
    beneficiary_id?: string;
    status?: string;
    assigned_to?: string;
    stageIds?: string[];
  },
): Promise<ServiceResult<FollowupListItem[]>> {
  try {
    if (filters?.stageIds && filters.stageIds.length === 0) {
      return { data: [], error: null };
    }

    let query = supabase
      .from("followups")
      .select(
        "*, beneficiaries!inner(full_name_ar, beneficiary_assignments!inner(stage_id, stages(name_ar))), servants!followups_assigned_to_fkey(profiles!servants_id_fkey(full_name_ar))",
      )
      .eq("church_id", churchId)
      .eq("beneficiaries.beneficiary_assignments.is_current", true)
      .order("created_at", { ascending: false });

    if (filters?.beneficiary_id) {
      query = query.eq("beneficiary_id", filters.beneficiary_id);
    }

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    if (filters?.assigned_to) {
      query = query.eq("assigned_to", filters.assigned_to);
    }

    if (filters?.stageIds) {
      query = query.in(
        "beneficiaries.beneficiary_assignments.stage_id",
        filters.stageIds,
      );
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    type FollowupRowWithJoins = any;
    const rows = (data ?? []) as FollowupRowWithJoins[];
    const result: FollowupListItem[] = rows.map((row) => ({
      ...row,
      childFullNameAr: row.beneficiaries?.full_name_ar ?? "",
      stageNameAr:
        row.beneficiaries?.beneficiary_assignments?.[0]?.stages?.name_ar ?? "",
      assignedToNameAr: row.servants?.profiles?.full_name_ar ?? null,
    } as FollowupListItem));
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return { data: result, error: null };
  } catch {
    return { data: null, error: "Failed to list followups." };
  }
}

export async function listStages(
  supabase: SupabaseClient,
  churchId: string,
  serviceId?: string,
  stageIds?: string[],
): Promise<ServiceResult<Pick<import("../types/child.types").StageRow, "id" | "name_ar" | "service_id">[]>> {
  try {
    if (stageIds && stageIds.length === 0) {
      return { data: [], error: null };
    }

    let query = supabase
      .from("stages")
      .select("id, name_ar, service_id")
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .order("name_ar");

    if (serviceId) {
      query = query.eq("service_id", serviceId);
    }

    if (stageIds) {
      query = query.in("id", stageIds);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
  } catch {
    return { data: null, error: "Failed to list stages." };
  }
}

export async function listServices(
  supabase: SupabaseClient,
  churchId: string,
): Promise<ServiceResult<Pick<import("../types/child.types").MinistryRow, "id" | "name_ar">[]>> {
  try {
    const { data, error } = await supabase
      .from("services")
      .select("id, name_ar")
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name_ar");

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
  } catch {
    return { data: null, error: "Failed to list services." };
  }
}

export async function getFollowupById(
  supabase: SupabaseClient,
  followupId: string,
  churchId: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  try {
    const { data, error } = await supabase
      .from("followups")
      .select("*")
      .eq("id", followupId)
      .eq("church_id", churchId)
      .single();

    if (error || !data) {
      return { data: null, error: "Followup not found." };
    }

    return { data, error: null };
  } catch {
    return { data: null, error: "Failed to load followup." };
  }
}

export async function getBeneficiaryCurrentStage(
  supabase: SupabaseClient,
  churchId: string,
  beneficiaryId: string,
): Promise<ServiceResult<string | null>> {
  try {
    const { data, error } = await supabase
      .from("beneficiary_assignments")
      .select("stage_id")
      .eq("church_id", churchId)
      .eq("beneficiary_id", beneficiaryId)
      .eq("is_current", true)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data?.stage_id ?? null, error: null };
  } catch {
    return { data: null, error: "Failed to load beneficiary stage." };
  }
}

export async function deleteFollowup(
  supabase: SupabaseClient,
  followupId: string,
  churchId: string,
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from("followups")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", followupId)
      .eq("church_id", churchId);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch {
    return { data: null, error: "Failed to delete followup." };
  }
}

export async function listUsers(
  supabase: SupabaseClient,
  churchId: string,
): Promise<ServiceResult<Pick<import("../types/child.types").ProfileRow, "id" | "full_name_ar" | "full_name_en" | "email">[]>> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name_ar, full_name_en, email")
      .is("deleted_at", null)
      .eq("is_active", true)
      .eq("church_id", churchId)
      .order("full_name_ar");

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
  } catch {
    return { data: null, error: "Failed to list users." };
  }
}
