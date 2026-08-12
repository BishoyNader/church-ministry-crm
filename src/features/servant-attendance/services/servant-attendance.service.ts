import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ServantAttendanceAttendee,
  ServantAttendanceData,
  ServantAttendanceHistoryItem,
  ServantAttendanceStatus,
} from "../types/servant-attendance.types";

type ServiceResult<T> = { data: T | null; error: string | null };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Servants with an ACTIVE assignment to the selected scope — stage-level
 * (servant_stage_assignments) or service-level (servant_service_assignments,
 * i.e. sector admins / stage managers assigned to the whole service).
 * Only profiles that also have a `servants` row are returned, because
 * attendance_records.servant_id references servants(id).
 */
export async function listServantAttendance(
  supabase: SupabaseClient,
  input: {
    churchId: string;
    serviceId: string;
    stageId: string;
    attendanceDate: string;
  },
): Promise<ServiceResult<ServantAttendanceData>> {
  try {
    const { churchId, serviceId, stageId, attendanceDate } = input;

    const [stageAssigned, serviceAssigned] = await Promise.all([
      supabase
        .from("servant_stage_assignments")
        .select("servant_id")
        .eq("church_id", churchId)
        .eq("stage_id", stageId)
        .eq("is_active", true)
        .or(`end_date.is.null,end_date.gte.${today()}`),
      supabase
        .from("servant_service_assignments")
        .select("servant_id")
        .eq("church_id", churchId)
        .eq("service_id", serviceId)
        .eq("is_active", true)
        .or(`end_date.is.null,end_date.gte.${today()}`),
    ]);

    if (stageAssigned.error || serviceAssigned.error) {
      return {
        data: null,
        error:
          stageAssigned.error?.message ?? serviceAssigned.error?.message ?? "Failed to load servant assignments.",
      };
    }

    const uniqueIds = [
      ...new Set([
        ...(stageAssigned.data ?? []).map((row) => row.servant_id),
        ...(serviceAssigned.data ?? []).map((row) => row.servant_id),
      ]),
    ];

    if (uniqueIds.length === 0) {
      return { data: { attendees: [], records: {} }, error: null };
    }

    const { data: servantRows, error: servantError } = await supabase
      .from("servants")
      .select("id")
      .in("id", uniqueIds)
      .is("deleted_at", null);
    if (servantError) {
      return { data: null, error: servantError.message };
    }
    const servantIdSet = new Set((servantRows ?? []).map((row) => row.id));
    const ids = uniqueIds.filter((id) => servantIdSet.has(id));
    if (ids.length === 0) {
      return { data: { attendees: [], records: {} }, error: null };
    }

    const [profiles, roleGrants] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name_ar, full_name_en, email, avatar_url")
        .in("id", ids)
        .eq("church_id", churchId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("full_name_ar"),
      supabase
        .from("user_roles")
        .select("user_id, roles(name_ar)")
        .eq("church_id", churchId)
        .in("user_id", ids)
        .is("end_date", null),
    ]);

    if (profiles.error || roleGrants.error) {
      return {
        data: null,
        error: profiles.error?.message ?? roleGrants.error?.message ?? "Failed to load servant profiles.",
      };
    }

    const roleByUser = new Map<string, string | null>();
    for (const grant of roleGrants.data ?? []) {
      const g = grant as { user_id?: string; roles?: { name_ar?: string } | null };
      if (g.user_id && !roleByUser.has(g.user_id)) {
        roleByUser.set(g.user_id, g.roles?.name_ar ?? null);
      }
    }

    const attendees: ServantAttendanceAttendee[] = (profiles.data ?? []).map(
      (profile) => ({
        id: profile.id,
        full_name_ar: profile.full_name_ar ?? "",
        full_name_en: profile.full_name_en ?? null,
        email: profile.email ?? null,
        avatar_url: profile.avatar_url ?? null,
        roleNameAr: roleByUser.get(profile.id) ?? null,
      }),
    );

    // Existing records for the selected stage + date (shared attendance session;
    // the (session_id, servant_id) unique constraint from migration 048 makes
    // the later upsert idempotent).
    const { data: sessions } = await supabase
      .from("attendance_sessions")
      .select("id")
      .eq("stage_id", stageId)
      .eq("session_date", attendanceDate);

    const records: ServantAttendanceData["records"] = {};
    const session = (sessions ?? [])[0];
    if (session) {
      const { data: rows, error } = await supabase
        .from("attendance_records")
        .select("servant_id, status, notes")
        .eq("session_id", session.id)
        .not("servant_id", "is", null);
      if (error) {
        return { data: null, error: error.message };
      }
      for (const row of rows ?? []) {
        records[row.servant_id] = {
          status: row.status as ServantAttendanceStatus,
          notes: row.notes ?? "",
        };
      }
    }

    return { data: { attendees, records }, error: null };
  } catch {
    return { data: null, error: "Failed to load servant attendance." };
  }
}

/**
 * Batch save for a servant attendance session. Upserts the shared
 * attendance_sessions row (stage_id + session_date) and then one multi-row
 * attendance_records upsert keyed on (session_id, servant_id), which both
 * creates and updates records without duplicates.
 */
export async function batchServantAttendance(
  supabase: SupabaseClient,
  input: {
    churchId: string;
    serviceId: string;
    stageId: string;
    attendanceDate: string;
    records: {
      servant_id: string;
      status: ServantAttendanceStatus;
      notes?: string;
    }[];
  },
): Promise<ServiceResult<{ created: number; updated: number }>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "You must be logged in." };
    }

    const { data: session, error: sessionError } = await supabase
      .from("attendance_sessions")
      .upsert(
        {
          church_id: input.churchId,
          service_id: input.serviceId,
          stage_id: input.stageId,
          session_date: input.attendanceDate,
          created_by: user.id,
        },
        { onConflict: "stage_id,session_date" },
      )
      .select("id")
      .single();

    if (sessionError) {
      return { data: null, error: sessionError.message };
    }

    const servantIds = input.records.map((record) => record.servant_id);
    const { data: existing } = await supabase
      .from("attendance_records")
      .select("servant_id")
      .eq("church_id", input.churchId)
      .eq("session_id", session.id)
      .not("servant_id", "is", null)
      .in("servant_id", servantIds);

    const existingIds = new Set((existing ?? []).map((row) => row.servant_id));

    const rows = input.records.map((record) => ({
      church_id: input.churchId,
      session_id: session.id,
      servant_id: record.servant_id,
      status: record.status,
      notes: record.notes ?? null,
      recorded_by: user.id,
    }));

    const { error: upsertError } = await supabase
      .from("attendance_records")
      .upsert(rows, { onConflict: "session_id,servant_id" });

    if (upsertError) {
      return { data: null, error: upsertError.message };
    }

    const created = rows.filter((row) => !existingIds.has(row.servant_id)).length;
    return { data: { created, updated: rows.length - created }, error: null };
  } catch {
    return { data: null, error: "Failed to save servant attendance." };
  }
}

/**
 * Recent servant-attendance history for a stage: servant records only (never
 * beneficiary records, which share the same sessions), grouped by session
 * date with present/absent/excused counts.
 */
export async function listServantAttendanceHistory(
  supabase: SupabaseClient,
  input: { churchId: string; stageId: string; limit?: number },
): Promise<ServiceResult<ServantAttendanceHistoryItem[]>> {
  try {
    const { data, error } = await supabase
      .from("attendance_records")
      .select("session_id, status, attendance_sessions!inner(session_date)")
      .eq("church_id", input.churchId)
      .eq("attendance_sessions.stage_id", input.stageId)
      .not("servant_id", "is", null)
      // PostgREST rejects dotted embedded order paths (PGRST100); order the
      // embedded relation via referencedTable instead (same shape the reports
      // daily-breakdown query uses).
      .order("session_date", { referencedTable: "attendance_sessions", ascending: false })
      .limit(input.limit ?? 10);

    if (error) {
      return { data: null, error: error.message };
    }

    const byDate = new Map<
      string,
      { sessionId: string; total: number; present: number; absent: number; excused: number }
    >();
    for (const row of data ?? []) {
      const r = row as {
        session_id: string;
        status: string;
        attendance_sessions?: { session_date?: string } | null;
      };
      const sessionDate = r.attendance_sessions?.session_date;
      if (!sessionDate) continue;
      const entry =
        byDate.get(sessionDate) ?? {
          sessionId: r.session_id,
          total: 0,
          present: 0,
          absent: 0,
          excused: 0,
        };
      entry.total += 1;
      if (r.status === "present") entry.present += 1;
      else if (r.status === "absent") entry.absent += 1;
      else if (r.status === "excused") entry.excused += 1;
      byDate.set(sessionDate, entry);
    }

    const items: ServantAttendanceHistoryItem[] = [...byDate.entries()].map(
      ([sessionDate, entry]) => ({
        sessionId: entry.sessionId,
        sessionDate,
        total: entry.total,
        present: entry.present,
        absent: entry.absent,
        excused: entry.excused,
      }),
    );

    return { data: items, error: null };
  } catch {
    return { data: null, error: "Failed to load servant attendance history." };
  }
}
