import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChildListItem,
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
  filters?: {
    search?: string;
    ministry_id?: string;
    stage_id?: string;
    status?: string;
    pipeline_stage?: string;
  },
  pagination?: PaginationInput,
): Promise<ServiceResult<PaginatedResult<ChildListItem>>> {
  try {
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("children")
      .select("*, ministries!inner(name_ar), stages!inner(name_ar)", { count: "exact" })
      .is("deleted_at", null)
      .order("first_name_ar");

    if (filters?.search) {
      const term = `%${filters.search}%`;
      query = query.or(
        `first_name_ar.ilike.${term},first_name_en.ilike.${term},last_name_ar.ilike.${term},last_name_en.ilike.${term},parent_phone.ilike.${term},mobile.ilike.${term}`,
      );
    }

    if (filters?.ministry_id) {
      query = query.eq("ministry_id", filters.ministry_id);
    }

    if (filters?.stage_id) {
      query = query.eq("stage_id", filters.stage_id);
    }

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    if (filters?.pipeline_stage) {
      query = query.eq("pipeline_stage", filters.pipeline_stage);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    const result: ChildListItem[] = (data ?? []).map((row) => ({
      ...row,
      ministryNameAr: row.ministries?.name_ar ?? "",
      stageNameAr: row.stages?.name_ar ?? "",
    } as ChildListItem));

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
): Promise<ServiceResult<ChildDetail>> {
  try {
    const { data: child, error } = await supabase
      .from("children")
      .select("*, ministries!inner(name_ar), stages!inner(name_ar)")
      .eq("id", childId)
      .is("deleted_at", null)
      .single();

    if (error || !child) {
      return { data: null, error: "Child not found." };
    }

    const [attendanceResult, followupsResult] = await Promise.all([
      supabase
        .from("attendance")
        .select("*")
        .eq("child_id", childId)
        .order("attendance_date", { ascending: false })
        .limit(50),
      supabase
        .from("followups")
        .select("*, profiles:assigned_to(full_name_ar)")
        .eq("child_id", childId)
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
        ministryNameAr: typedChild.ministries?.name_ar ?? "",
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
      .from("children")
      .insert({
        church_id: profile.church_id,
        created_by: user.id,
        first_name_ar: input.first_name_ar,
        first_name_en: input.first_name_en ?? null,
        last_name_ar: input.last_name_ar,
        last_name_en: input.last_name_en ?? null,
        date_of_birth: input.date_of_birth ?? null,
        gender: input.gender ?? null,
        ministry_id: input.ministry_id,
        stage_id: input.stage_id,
        pipeline_stage: input.pipeline_stage ?? "new_visitor",
        parent_phone: input.parent_phone ?? null,
        parent_email: input.parent_email ?? null,
        parent_address_ar: input.parent_address_ar ?? null,
        father_name_ar: input.father_name_ar ?? null,
        mother_name_ar: input.mother_name_ar ?? null,
        emergency_contact_name: input.emergency_contact_name ?? null,
        emergency_contact_phone: input.emergency_contact_phone ?? null,
        mobile: input.mobile ?? null,
        allergies: input.allergies ?? null,
        medical_conditions: input.medical_conditions ?? null,
        medications: input.medications ?? null,
        baptism_date: input.baptism_date ?? null,
        confession_frequency: input.confession_frequency ?? null,
        spiritual_notes: input.spiritual_notes ?? null,
        school_name_ar: input.school_name_ar ?? null,
        grade_level: input.grade_level ?? null,
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
  input: UpdateChildInput,
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from("children")
      .update({
        first_name_ar: input.first_name_ar,
        first_name_en: input.first_name_en ?? null,
        last_name_ar: input.last_name_ar,
        last_name_en: input.last_name_en ?? null,
        date_of_birth: input.date_of_birth ?? null,
        gender: input.gender ?? null,
        ministry_id: input.ministry_id,
        stage_id: input.stage_id,
        pipeline_stage: input.pipeline_stage,
        status: input.status,
        parent_phone: input.parent_phone ?? null,
        parent_email: input.parent_email ?? null,
        parent_address_ar: input.parent_address_ar ?? null,
        father_name_ar: input.father_name_ar ?? null,
        mother_name_ar: input.mother_name_ar ?? null,
        emergency_contact_name: input.emergency_contact_name ?? null,
        emergency_contact_phone: input.emergency_contact_phone ?? null,
        mobile: input.mobile ?? null,
        allergies: input.allergies ?? null,
        medical_conditions: input.medical_conditions ?? null,
        medications: input.medications ?? null,
        baptism_date: input.baptism_date ?? null,
        confession_frequency: input.confession_frequency ?? null,
        spiritual_notes: input.spiritual_notes ?? null,
        school_name_ar: input.school_name_ar ?? null,
        grade_level: input.grade_level ?? null,
        notes: input.notes ?? null,
        photo_url: input.photo_url ?? null,
      })
      .eq("id", childId);

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
  input: TransferChildInput,
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from("children")
      .update({
        ministry_id: input.ministry_id,
        stage_id: input.stage_id,
      })
      .eq("id", childId);

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
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from("children")
      .update({
        deleted_at: new Date().toISOString(),
        status: "inactive",
      })
      .eq("id", childId);

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

    const { data, error } = await supabase
      .from("attendance")
      .insert({
        church_id: profile.church_id,
        child_id: input.child_id,
        stage_id: input.stage_id,
        attendance_date: input.attendance_date,
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

    const childIds = input.records.map((r) => r.child_id);

    const { data: existing } = await supabase
      .from("attendance")
      .select("child_id")
      .eq("church_id", profile.church_id)
      .eq("stage_id", input.stage_id)
      .eq("attendance_date", input.attendance_date)
      .in("child_id", childIds);

    const existingChildIds = new Set((existing ?? []).map((r) => r.child_id));

    let created = 0;
    let updated = 0;

    const results = await Promise.all(
      input.records.map((record) =>
        supabase.from("attendance").upsert(
          {
            church_id: profile.church_id,
            child_id: record.child_id,
            stage_id: input.stage_id,
            attendance_date: input.attendance_date,
            status: record.status,
            notes: record.notes ?? null,
            recorded_by: user.id,
          },
          {
            onConflict: "church_id,child_id,attendance_date",
          },
        ),
      ),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.error) {
        return { data: null, error: result.error.message };
      }
      if (existingChildIds.has(input.records[i].child_id)) {
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
  filters?: {
    child_id?: string;
    stage_id?: string;
    from_date?: string;
    to_date?: string;
  },
): Promise<ServiceResult<AttendanceListItem[]>> {
  try {
    let query = supabase
      .from("attendance")
      .select("*, children!inner(first_name_ar, last_name_ar), stages!inner(name_ar)")
      .order("attendance_date", { ascending: false });

    if (filters?.child_id) {
      query = query.eq("child_id", filters.child_id);
    }

    if (filters?.stage_id) {
      query = query.eq("stage_id", filters.stage_id);
    }

    if (filters?.from_date) {
      query = query.gte("attendance_date", filters.from_date);
    }

    if (filters?.to_date) {
      query = query.lte("attendance_date", filters.to_date);
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
      childFirstNameAr: row.children?.first_name_ar ?? "",
      childLastNameAr: row.children?.last_name_ar ?? "",
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
        created_by: user.id,
        child_id: input.child_id,
        stage_id: input.stage_id,
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
      .eq("id", followupId);

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
  filters?: {
    child_id?: string;
    status?: string;
    assigned_to?: string;
  },
): Promise<ServiceResult<FollowupListItem[]>> {
  try {
    let query = supabase
      .from("followups")
      .select("*, children!inner(first_name_ar, last_name_ar), stages!inner(name_ar), profiles:assigned_to(full_name_ar)")
      .order("created_at", { ascending: false });

    if (filters?.child_id) {
      query = query.eq("child_id", filters.child_id);
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
      childFirstNameAr: row.children?.first_name_ar ?? "",
      childLastNameAr: row.children?.last_name_ar ?? "",
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
  ministryId?: string,
): Promise<ServiceResult<Pick<import("../types/child.types").StageRow, "id" | "name_ar" | "ministry_id">[]>> {
  try {
    let query = supabase
      .from("stages")
      .select("id, name_ar, ministry_id")
      .is("deleted_at", null)
      .order("name_ar");

    if (ministryId) {
      query = query.eq("ministry_id", ministryId);
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

export async function listMinistries(
  supabase: SupabaseClient,
): Promise<ServiceResult<Pick<import("../types/child.types").MinistryRow, "id" | "name_ar">[]>> {
  try {
    const { data, error } = await supabase
      .from("ministries")
      .select("id, name_ar")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name_ar");

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data ?? [], error: null };
  } catch {
    return { data: null, error: "Failed to list ministries." };
  }
}

export async function getFollowupById(
  supabase: SupabaseClient,
  followupId: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  try {
    const { data, error } = await supabase
      .from("followups")
      .select("*")
      .eq("id", followupId)
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
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from("followups")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", followupId);

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
