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

export async function listChildren(
  supabase: SupabaseClient,
  churchId: string,
  filters?: {
    search?: string;
    service_id?: string;
    stage_id?: string;
    status?: string;
  },
  pagination?: PaginationInput,
): Promise<ServiceResult<PaginatedResult<ChildListItem>>> {
  try {
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("beneficiaries")
      .select("*, services!inner(name_ar), stages!inner(name_ar)", { count: "exact" })
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .order("full_name_ar");

    if (filters?.search) {
      const term = `%${filters.search}%`;
      query = query.or(
        `full_name_ar.ilike.${term},full_name_en.ilike.${term},mobile.ilike.${term}`,
      );
    }

    if (filters?.service_id) {
      query = query.eq("service_id", filters.service_id);
    }

    if (filters?.stage_id) {
      query = query.eq("stage_id", filters.stage_id);
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
      return {
        ...row,
        serviceNameAr: joined.services?.name_ar ?? "",
        stageNameAr: joined.stages?.name_ar ?? "",
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
): Promise<ServiceResult<ChildDetail>> {
  try {
    const { data: child, error } = await supabase
      .from("beneficiaries")
      .select("*, services!inner(name_ar), stages!inner(name_ar)")
      .eq("id", childId)
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .single();

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
        .select("*, profiles:assigned_to(full_name_ar)")
        .eq("church_id", churchId)
        .eq("beneficiary_id", childId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    /* eslint-disable @typescript-eslint/no-explicit-any */
    type ChildRowWithJoins = any;
    const typedChild = child as ChildRowWithJoins;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return {
      data: {
        ...(typedChild as Record<string, unknown>),
        serviceNameAr: typedChild.services?.name_ar ?? "",
        stageNameAr: typedChild.stages?.name_ar ?? "",
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("church_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return { data: null, error: "Profile not found." };
    }

    // NOTE: church_id is explicitly set here as defense-in-depth.
    // Supabase RLS policies (002_rls_policies.sql) also enforce
    // church_id = get_user_church_id() on INSERT/UPDATE/DELETE for
    // children, attendance, and followups tables.

    const { data, error } = await supabase
      .from("beneficiaries")
      .insert({
        church_id: profile.church_id,
        full_name_ar: input.full_name_ar,
        full_name_en: input.full_name_en ?? null,
        date_of_birth: input.date_of_birth ?? null,
        gender: input.gender ?? null,
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
      .select("id")
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: { id: data.id }, error: null };
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

    const { error } = await supabase
      .from("beneficiary_assignments")
      .insert({
        church_id: churchId,
        beneficiary_id: childId,
        service_id: input.service_id,
        stage_id: input.stage_id,
        assigned_by: user.id,
        servant_id: user.id,
        start_date: new Date().toISOString().slice(0, 10),
        is_current: true,
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
        onConflict: "church_id,service_id,stage_id,session_date",
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
        onConflict: "church_id,service_id,stage_id,session_date",
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

    let created = 0;
    let updated = 0;

    const results = await Promise.all(
      input.records.map((record) =>
        supabase.from("attendance_records").upsert(
          {
            church_id: profile.church_id,
            session_id: session.id,
            beneficiary_id: record.beneficiary_id,
            status: record.status,
            notes: record.notes ?? null,
            recorded_by: user.id,
          },
          {
            onConflict: "church_id,session_id,beneficiary_id",
          },
        ),
      ),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.error) {
        return { data: null, error: result.error.message };
      }
      if (existingIds.has(input.records[i].beneficiary_id)) {
        updated++;
      } else {
        created++;
      }
    }

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
    from_date?: string;
    to_date?: string;
  },
): Promise<ServiceResult<AttendanceListItem[]>> {
  try {
    let query = supabase
      .from("attendance_records")
      .select("*, attendance_sessions!inner(session_date, stage_id, service_id), beneficiaries!inner(full_name_ar), stages!inner(name_ar)")
      .eq("church_id", churchId)
      .order("created_at", { ascending: false });

    if (filters?.beneficiary_id) {
      query = query.eq("beneficiary_id", filters.beneficiary_id);
    }

    if (filters?.stage_id) {
      query = query.eq("attendance_sessions.stage_id", filters.stage_id);
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
      stageNameAr: row.stages?.name_ar ?? "",
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
  },
): Promise<ServiceResult<FollowupListItem[]>> {
  try {
    let query = supabase
      .from("followups")
      .select("*, beneficiaries!inner(full_name_ar), stages!inner(name_ar), profiles:assigned_to(full_name_ar)")
      .eq("church_id", churchId)
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
      stageNameAr: row.stages?.name_ar ?? "",
      assignedToNameAr: row.profiles?.full_name_ar ?? null,
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
): Promise<ServiceResult<Pick<import("../types/child.types").StageRow, "id" | "name_ar" | "service_id">[]>> {
  try {
    let query = supabase
      .from("stages")
      .select("id, name_ar, service_id")
      .eq("church_id", churchId)
      .is("deleted_at", null)
      .order("name_ar");

    if (serviceId) {
      query = query.eq("service_id", serviceId);
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
