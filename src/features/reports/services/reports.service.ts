import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegistrationFunctions } from "@/types/registration";
import type {
  DailyAttendanceRecord,
  DailyAttendanceRow,
  ReportsData,
  ReportsFilterOption,
  ReportsFilterOptions,
  ReportsFilters,
  TrendRow,
} from "../types/reports.types";

type AttendanceRow = {
  status: string;
  beneficiary_id: string;
  servant_id: string | null;
  attendance_sessions?: {
    session_date: string;
    service_id: string | null;
    stage_id: string | null;
    stages?: { name_ar?: string | null; name_en?: string | null } | null;
    services?: { name_ar?: string | null; name_en?: string | null } | null;
  } | null;
  beneficiaries?: { full_name_ar?: string | null } | null;
};

type FollowupRow = {
  status: string;
  created_at: string;
  scheduled_at: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  beneficiary_id: string | null;
};

// Shape of the get_stage_reports() SECURITY DEFINER RPC (migration 039). It is
// DB-scoped (intersects the caller-supplied p_stage_ids with the actor's real
// scope) and returns the same metrics the client used to aggregate below.
type StageReportsRpcResult = {
  attendanceRate?: {
    present: number;
    absent: number;
    excused: number;
    total: number;
    rate: number;
  } | null;
  monthlyTrends?: TrendRow[] | null;
  yearlyTrends?: TrendRow[] | null;
  stageComparison?: {
    stage_id: string;
    stage_name: string;
    present: number;
    absent: number;
    excused: number;
    total: number;
    attendance_rate: number;
    beneficiary_count: number;
    followup_count: number;
  }[] | null;
  servantAttendance?: {
    servant_id: string;
    servant_name: string;
    present: number;
    absent: number;
    excused: number;
    total: number;
    rate: number;
  }[] | null;
  beneficiaryAttendance?: {
    beneficiary_id: string;
    beneficiary_name: string;
    present: number;
    absent: number;
    excused: number;
    total: number;
    rate: number;
  }[] | null;
  followupCompletion?: {
    completed: number;
    open: number;
    overdue: number;
    total: number;
    completion_rate: number;
  } | null;
};

// Sprint (Stage Manager): server-side aggregation via get_stage_reports().
// If the RPC is unavailable (older database), fall back to the JS aggregation.
const REPORTS_RPC_ENABLED = true;

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getYearKey(date: Date): string {
  return `${date.getFullYear()}`;
}

function buildTrendSeries(rows: Array<{ period: string; present: number; absent: number; excused: number }>) {
  return rows.map((row) => ({
    ...row,
    total: row.present + row.absent + row.excused,
  }));
}

function normalizeRpcReports(rpc: StageReportsRpcResult): ReportsData {
  return {
    attendanceRate: {
      present: rpc.attendanceRate?.present ?? 0,
      absent: rpc.attendanceRate?.absent ?? 0,
      excused: rpc.attendanceRate?.excused ?? 0,
      total: rpc.attendanceRate?.total ?? 0,
      rate: rpc.attendanceRate?.rate ?? 0,
    },
    servantAttendance: (rpc.servantAttendance ?? []).map((row) => ({
      servantId: row.servant_id,
      servantName: row.servant_name,
      present: row.present,
      absent: row.absent,
      excused: row.excused,
      total: row.total,
      rate: row.rate,
    })),
    beneficiaryAttendance: (rpc.beneficiaryAttendance ?? []).map((row) => ({
      beneficiaryId: row.beneficiary_id,
      beneficiaryName: row.beneficiary_name,
      present: row.present,
      absent: row.absent,
      excused: row.excused,
      total: row.total,
      rate: row.rate,
    })),
    followupCompletion: {
      completed: rpc.followupCompletion?.completed ?? 0,
      open: rpc.followupCompletion?.open ?? 0,
      overdue: rpc.followupCompletion?.overdue ?? 0,
      total: rpc.followupCompletion?.total ?? 0,
      completionRate: rpc.followupCompletion?.completion_rate ?? 0,
    },
    stageComparison: (rpc.stageComparison ?? []).map((row) => ({
      stageId: row.stage_id,
      stageName: row.stage_name,
      present: row.present,
      absent: row.absent,
      excused: row.excused,
      total: row.total,
      attendanceRate: row.attendance_rate,
      followupCount: row.followup_count,
      beneficiaryCount: row.beneficiary_count,
    })),
    monthlyTrends: (rpc.monthlyTrends ?? []).map((row) => ({ ...row })),
    yearlyTrends: (rpc.yearlyTrends ?? []).map((row) => ({ ...row })),
  };
}

export async function getReportsFilterOptions(
  supabase: SupabaseClient,
  churchId: string,
  stageIds?: string[],
): Promise<{ data: ReportsFilterOptions | null; error: string | null }> {
  try {
    const scoped = stageIds !== undefined;

    if (scoped && stageIds.length === 0) {
      return { data: { services: [], stages: [], servants: [] }, error: null };
    }

    const [servicesResult, stagesResult, servantResult] = await Promise.all([
      supabase.from("services").select("id, name_ar, name_en").eq("church_id", churchId).is("deleted_at", null),
      scoped
        ? supabase.from("stages").select("id, name_ar, name_en").eq("church_id", churchId).is("deleted_at", null).in("id", stageIds)
        : supabase.from("stages").select("id, name_ar, name_en").eq("church_id", churchId).is("deleted_at", null),
      scoped
        ? supabase
            .from("servants")
            .select("id, profiles!servants_id_fkey(full_name_ar), servant_stage_assignments!inner(stage_id)")
            .eq("church_id", churchId)
            .eq("servant_stage_assignments.is_active", true)
            .in("servant_stage_assignments.stage_id", stageIds)
        : supabase.from("profiles").select("id, full_name_ar").eq("church_id", churchId),
    ]);

    if (servicesResult.error) return { data: null, error: servicesResult.error.message };
    if (stagesResult.error) return { data: null, error: stagesResult.error.message };
    if (servantResult.error) return { data: null, error: servantResult.error.message };

    const services = (servicesResult.data ?? []).map((row) => ({
      id: row.id,
      label: row.name_ar ?? row.name_en ?? "Service",
    })) as ReportsFilterOption[];

    const stages = (stagesResult.data ?? []).map((row) => ({
      id: row.id,
      label: row.name_ar ?? row.name_en ?? "Stage",
    })) as ReportsFilterOption[];

    const servants = scoped
      ? ((servantResult.data ?? []).map((row) => {
          const typed = row as { id: string; profiles?: { full_name_ar?: string | null } | null };
          return {
            id: typed.id,
            label: typed.profiles?.full_name_ar ?? "Servant",
          };
        }) as ReportsFilterOption[])
      : ((servantResult.data ?? []).map((row) => {
          const typed = row as { id: string; full_name_ar?: string | null };
          return {
            id: typed.id,
            label: typed.full_name_ar ?? "Servant",
          };
        }) as ReportsFilterOption[]);

    return {
      data: {
        services,
        stages,
        servants,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load reports filter options." };
  }
}

export async function getReportsData(
  supabase: SupabaseClient,
  churchId: string,
  filters: ReportsFilters = {},
  stageIds?: string[],
): Promise<{ data: ReportsData | null; error: string | null }> {
  try {
    if (REPORTS_RPC_ENABLED) {
      try {
        const rpc = (await supabase.rpc<
          "get_stage_reports",
          RegistrationFunctions["get_stage_reports"]["Args"]
        >("get_stage_reports", {
          p_stage_ids: stageIds ?? null,
          p_from_date: filters.fromDate ?? null,
          p_to_date: filters.toDate ?? null,
          p_service_id: filters.serviceId ?? null,
          p_stage_id: filters.stageId ?? null,
          p_servant_id: filters.servantId ?? null,
        })) as unknown as { data: StageReportsRpcResult | null; error: { message: string } | null };

        if (!rpc.error && rpc.data) {
          return { data: normalizeRpcReports(rpc.data), error: null };
        }
      } catch {
        // Fall through to the JS aggregation below.
      }
    }

    const scoped = stageIds !== undefined;

    if (scoped && stageIds.length === 0) {
      return {
        data: {
          attendanceRate: { present: 0, absent: 0, excused: 0, total: 0, rate: 0 },
          servantAttendance: [],
          beneficiaryAttendance: [],
          followupCompletion: { completed: 0, open: 0, overdue: 0, total: 0, completionRate: 0 },
          stageComparison: [],
          monthlyTrends: [],
          yearlyTrends: [],
        },
        error: null,
      };
    }

    let attendanceQuery = supabase
      .from("attendance_records")
      .select(
        "status, beneficiary_id, servant_id, attendance_sessions!inner(session_date, service_id, stage_id, services(name_ar, name_en), stages(name_ar, name_en)), beneficiaries(full_name_ar)",
      )
      .eq("church_id", churchId)
      .order("created_at", { ascending: false });

    if (filters.fromDate) {
      attendanceQuery = attendanceQuery.gte("attendance_sessions.session_date", filters.fromDate);
    }
    if (filters.toDate) {
      attendanceQuery = attendanceQuery.lte("attendance_sessions.session_date", filters.toDate);
    }
    if (filters.serviceId) {
      attendanceQuery = attendanceQuery.eq("attendance_sessions.service_id", filters.serviceId);
    }
    if (filters.stageId) {
      attendanceQuery = attendanceQuery.eq("attendance_sessions.stage_id", filters.stageId);
    }
    if (filters.servantId) {
      attendanceQuery = attendanceQuery.eq("servant_id", filters.servantId);
    }
    if (scoped) {
      attendanceQuery = attendanceQuery.in("attendance_sessions.stage_id", stageIds);
    }

    let followupsQuery = supabase
      .from("followups")
      .select(
        "status, created_at, scheduled_at, completed_at, assigned_to, beneficiary_id" +
          (scoped
            ? ", beneficiaries!inner(beneficiary_assignments!inner(stage_id))"
            : ""),
      )
      .eq("church_id", churchId)
      .order("created_at", { ascending: false });

    if (filters.fromDate) {
      followupsQuery = followupsQuery.gte("created_at", `${filters.fromDate}T00:00:00.000Z`);
    }
    if (filters.toDate) {
      followupsQuery = followupsQuery.lte("created_at", `${filters.toDate}T23:59:59.999Z`);
    }
    if (scoped) {
      followupsQuery = followupsQuery
        .eq("beneficiaries.beneficiary_assignments.is_current", true)
        .in("beneficiaries.beneficiary_assignments.stage_id", stageIds);
    }

    const [attendanceResult, followupsResult] = await Promise.all([
      attendanceQuery,
      followupsQuery,
    ]);

    if (attendanceResult.error) return { data: null, error: attendanceResult.error.message };
    if (followupsResult.error) return { data: null, error: followupsResult.error.message };

    const attendanceRows = (attendanceResult.data ?? []) as unknown as AttendanceRow[];
    const followups = (followupsResult.data ?? []) as unknown as FollowupRow[];

    const monthlyBuckets = new Map<string, { present: number; absent: number; excused: number }>();
    const yearlyBuckets = new Map<string, { present: number; absent: number; excused: number }>();
    const stageBuckets = new Map<string, { present: number; absent: number; excused: number; followupCount: number; beneficiaryCount: number; stageName: string }>();
    const servantBuckets = new Map<string, { servantName: string; present: number; absent: number; excused: number }>();
    const beneficiaryBuckets = new Map<string, { beneficiaryName: string; present: number; absent: number; excused: number }>();

    let present = 0;
    let absent = 0;
    let excused = 0;

    for (const row of attendanceRows) {
      const session = row.attendance_sessions;
      if (!session) continue;

      if (row.status === "present") present += 1;
      else if (row.status === "absent") absent += 1;
      else if (row.status === "excused") excused += 1;

      const sessionDate = new Date(session.session_date);
      const monthKey = getMonthKey(sessionDate);
      const yearKey = getYearKey(sessionDate);
      const monthBucket = monthlyBuckets.get(monthKey) ?? { present: 0, absent: 0, excused: 0 };
      const yearBucket = yearlyBuckets.get(yearKey) ?? { present: 0, absent: 0, excused: 0 };

      if (row.status === "present") {
        monthBucket.present += 1;
        yearBucket.present += 1;
      } else if (row.status === "absent") {
        monthBucket.absent += 1;
        yearBucket.absent += 1;
      } else if (row.status === "excused") {
        monthBucket.excused += 1;
        yearBucket.excused += 1;
      }

      monthlyBuckets.set(monthKey, monthBucket);
      yearlyBuckets.set(yearKey, yearBucket);

      const stageId = session.stage_id ?? "";
      const stageName = session.stages?.name_ar ?? session.stages?.name_en ?? "Stage";
      const stageBucket = stageBuckets.get(stageId) ?? {
        present: 0,
        absent: 0,
        excused: 0,
        followupCount: 0,
        beneficiaryCount: 0,
        stageName,
      };

      if (row.status === "present") stageBucket.present += 1;
      else if (row.status === "absent") stageBucket.absent += 1;
      else if (row.status === "excused") stageBucket.excused += 1;

      stageBucket.beneficiaryCount += 1;
      stageBuckets.set(stageId, stageBucket);

      const servantId = row.servant_id ?? "";
      if (servantId) {
        const servantBucket = servantBuckets.get(servantId) ?? {
          servantName: servantId,
          present: 0,
          absent: 0,
          excused: 0,
        };
        if (row.status === "present") servantBucket.present += 1;
        else if (row.status === "absent") servantBucket.absent += 1;
        else if (row.status === "excused") servantBucket.excused += 1;
        servantBuckets.set(servantId, servantBucket);
      }

      const beneficiaryId = row.beneficiary_id;
      const beneficiaryName = row.beneficiaries?.full_name_ar ?? beneficiaryId;
      const beneficiaryBucket = beneficiaryBuckets.get(beneficiaryId) ?? {
        beneficiaryName,
        present: 0,
        absent: 0,
        excused: 0,
      };
      if (row.status === "present") beneficiaryBucket.present += 1;
      else if (row.status === "absent") beneficiaryBucket.absent += 1;
      else if (row.status === "excused") beneficiaryBucket.excused += 1;
      beneficiaryBuckets.set(beneficiaryId, beneficiaryBucket);
    }

    const total = present + absent + excused;
    const attendanceRate = {
      present,
      absent,
      excused,
      total,
      rate: total > 0 ? (present / total) * 100 : 0,
    };

    const servantAttendance = Array.from(servantBuckets.entries()).map(([servantId, bucket]) => ({
      servantId,
      servantName: bucket.servantName,
      present: bucket.present,
      absent: bucket.absent,
      excused: bucket.excused,
      total: bucket.present + bucket.absent + bucket.excused,
      rate: bucket.present + bucket.absent + bucket.excused > 0
        ? (bucket.present / (bucket.present + bucket.absent + bucket.excused)) * 100
        : 0,
    }));

    const beneficiaryAttendance = Array.from(beneficiaryBuckets.entries()).map(([beneficiaryId, bucket]) => ({
      beneficiaryId,
      beneficiaryName: bucket.beneficiaryName,
      present: bucket.present,
      absent: bucket.absent,
      excused: bucket.excused,
      total: bucket.present + bucket.absent + bucket.excused,
      rate: bucket.present + bucket.absent + bucket.excused > 0
        ? (bucket.present / (bucket.present + bucket.absent + bucket.excused)) * 100
        : 0,
    }));

    const followupCounts = {
      completed: 0,
      open: 0,
      overdue: 0,
      total: followups.length,
    };

    const nowISO = new Date().toISOString();
    for (const followup of followups) {
      if (followup.status === "completed") {
        followupCounts.completed += 1;
      } else if (followup.status === "cancelled") {
        continue;
      } else if (followup.scheduled_at != null && followup.scheduled_at < nowISO) {
        followupCounts.overdue += 1;
      } else {
        followupCounts.open += 1;
      }
    }

    const stageComparison = Array.from(stageBuckets.entries()).map(([stageId, bucket]) => ({
      stageId,
      stageName: bucket.stageName,
      present: bucket.present,
      absent: bucket.absent,
      excused: bucket.excused,
      total: bucket.present + bucket.absent + bucket.excused,
      attendanceRate: bucket.present + bucket.absent + bucket.excused > 0
        ? (bucket.present / (bucket.present + bucket.absent + bucket.excused)) * 100
        : 0,
      followupCount: bucket.followupCount,
      beneficiaryCount: bucket.beneficiaryCount,
    }));

    const monthlyTrends = buildTrendSeries(
      Array.from(monthlyBuckets.entries()).map(([period, bucket]) => ({
        period,
        present: bucket.present,
        absent: bucket.absent,
        excused: bucket.excused,
      })),
    );

    const yearlyTrends = buildTrendSeries(
      Array.from(yearlyBuckets.entries()).map(([period, bucket]) => ({
        period,
        present: bucket.present,
        absent: bucket.absent,
        excused: bucket.excused,
      })),
    );

    return {
      data: {
        attendanceRate,
        servantAttendance,
        beneficiaryAttendance,
        followupCompletion: {
          ...followupCounts,
          completionRate: followupCounts.total > 0 ? (followupCounts.completed / followupCounts.total) * 100 : 0,
        },
        stageComparison,
        monthlyTrends,
        yearlyTrends,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load reports data." };
  }
}

export function toCsv(data: ReportsData): string {
  const rows: string[] = [];
  rows.push("metric,value");
  rows.push(`attendance_rate,${data.attendanceRate.rate.toFixed(2)}%`);
  rows.push(`attendance_present,${data.attendanceRate.present}`);
  rows.push(`attendance_absent,${data.attendanceRate.absent}`);
  rows.push(`attendance_excused,${data.attendanceRate.excused}`);
  rows.push(`followup_completion_rate,${data.followupCompletion.completionRate.toFixed(2)}%`);
  rows.push(`followup_completed,${data.followupCompletion.completed}`);
  rows.push(`followup_open,${data.followupCompletion.open}`);
  rows.push(`followup_overdue,${data.followupCompletion.overdue}`);

  rows.push("\nservant_name,present,absent,excused,total,rate");
  for (const row of data.servantAttendance) {
    rows.push(`${row.servantName},${row.present},${row.absent},${row.excused},${row.total},${row.rate.toFixed(2)}%`);
  }

  rows.push("\nbeneficiary_name,present,absent,excused,total,rate");
  for (const row of data.beneficiaryAttendance) {
    rows.push(`${row.beneficiaryName},${row.present},${row.absent},${row.excused},${row.total},${row.rate.toFixed(2)}%`);
  }

  rows.push("\nstage_name,present,absent,excused,total,attendance_rate,followup_count,beneficiary_count");
  for (const row of data.stageComparison) {
    rows.push(`${row.stageName},${row.present},${row.absent},${row.excused},${row.total},${row.attendanceRate.toFixed(2)}%,${row.followupCount},${row.beneficiaryCount}`);
  }

  rows.push("\nmonth,present,absent,excused,total");
  for (const row of data.monthlyTrends) {
    rows.push(`${row.period},${row.present},${row.absent},${row.excused},${row.total}`);
  }

  rows.push("\nyear,present,absent,excused,total");
  for (const row of data.yearlyTrends) {
    rows.push(`${row.period},${row.present},${row.absent},${row.excused},${row.total}`);
  }

  return rows.join("\n");
}

export function buildCsvFilename() {
  return `reports-${new Date().toISOString().slice(0, 10)}.csv`;
}

// --------------------------------------------------------------------------
// Daily attendance breakdown (reports organized BY DAY)
// --------------------------------------------------------------------------

export type DailyAttendanceInput = {
  sessionDate: string;
  serviceName: string;
  stageName: string;
  beneficiaryId: string | null;
  beneficiaryName: string;
  status: string;
  recordedByName: string | null;
  recordedAt: string;
};

/**
 * Groups attendance records by DAY (session date) and tallies the final
 * statuses. Each attendee is counted exactly once per day because the DB
 * enforces one record per attendee per session (migrations 048/055) — a
 * status changed غائب → حاضر → معذور converges to a single row, so reports
 * never count historical statuses. Pure function (unit-testable).
 */
export function aggregateDailyAttendance(
  rows: DailyAttendanceInput[],
): DailyAttendanceRow[] {
  // Pass 1 — group the records by day.
  const byDate = new Map<string, DailyAttendanceInput[]>();
  for (const row of rows) {
    if (!row.sessionDate) continue;
    const list = byDate.get(row.sessionDate) ?? [];
    list.push(row);
    byDate.set(row.sessionDate, list);
  }

  const items: DailyAttendanceRow[] = [];
  for (const [sessionDate, dayRows] of byDate) {
    // Pass 2 — per day, keep at most ONE record per beneficiary. The LATEST
    // one wins by recordedAt (ties keep the first occurrence in input order),
    // mirroring the reconciliation rule in migration 055. The database
    // invariant (048/055) already guarantees one row per attendee per session,
    // so this is defense-in-depth only: reports can never count historical
    // statuses even if a legacy duplicate ever reached this layer.
    const latestByBeneficiary = new Map<string, DailyAttendanceInput>();
    for (const row of dayRows) {
      if (!row.beneficiaryId) continue;
      const prev = latestByBeneficiary.get(row.beneficiaryId);
      if (!prev || (row.recordedAt && row.recordedAt >= prev.recordedAt)) {
        latestByBeneficiary.set(row.beneficiaryId, row);
      }
    }

    const unique = [...latestByBeneficiary.values()];
    const entry: DailyAttendanceRow = {
      sessionDate,
      total: unique.length,
      present: unique.filter((r) => r.status === "present").length,
      absent: unique.filter((r) => r.status === "absent").length,
      excused: unique.filter((r) => r.status === "excused").length,
      rate: 0,
      records: unique.map((r) => ({
        beneficiaryId: r.beneficiaryId!,
        beneficiaryName: r.beneficiaryName,
        serviceName: r.serviceName,
        stageName: r.stageName,
        status: r.status as DailyAttendanceRecord["status"],
        recordedByName: r.recordedByName,
        recordedAt: r.recordedAt,
      })),
    };
    entry.rate = entry.total > 0 ? (entry.present / entry.total) * 100 : 0;
    entry.records.sort((a, b) => a.beneficiaryName.localeCompare(b.beneficiaryName));
    items.push(entry);
  }

  items.sort((a, b) => (a.sessionDate < b.sessionDate ? 1 : a.sessionDate > b.sessionDate ? -1 : 0));
  return items;
}

/**
 * Church-scoped daily attendance for the reports page. Reads beneficiary
 * attendance records through the same RLS surface as the rest of the module
 * (the actor scope is intersected server-side in the action via
 * getActorStageScope). Records are limited to the 500 most recent so the
 * page stays responsive; the existing from/to date filters narrow the window.
 */
export async function getDailyAttendanceBreakdown(
  supabase: SupabaseClient,
  churchId: string,
  filters: ReportsFilters = {},
  stageIds?: string[],
): Promise<{ data: DailyAttendanceRow[] | null; error: string | null }> {
  try {
    if (stageIds !== undefined && stageIds.length === 0) {
      return { data: [], error: null };
    }

    let query = supabase
      .from("attendance_records")
      .select(
        "beneficiary_id, status, created_at, updated_at, " +
          "attendance_sessions!inner(session_date, service_id, stage_id, services(name_ar, name_en), stages(name_ar, name_en)), " +
          "beneficiaries(full_name_ar), " +
          "profiles!attendance_records_recorded_by_fkey(full_name_ar)",
      )
      .eq("church_id", churchId)
      .not("beneficiary_id", "is", null)
      // PostgREST orders embedded relations via referencedTable (the dotted
      // path form is rejected by the parser). Most recent sessions first.
      .order("session_date", { referencedTable: "attendance_sessions", ascending: false })
      .limit(500);

    if (filters.fromDate) {
      query = query.gte("attendance_sessions.session_date", filters.fromDate);
    }
    if (filters.toDate) {
      query = query.lte("attendance_sessions.session_date", filters.toDate);
    }
    if (filters.serviceId) {
      query = query.eq("attendance_sessions.service_id", filters.serviceId);
    }
    if (filters.stageId) {
      query = query.eq("attendance_sessions.stage_id", filters.stageId);
    }
    if (stageIds) {
      query = query.in("attendance_sessions.stage_id", stageIds);
    }

    const { data, error } = await query;
    if (error) {
      return { data: null, error: error.message };
    }

    const rows: DailyAttendanceInput[] = (data ?? []).map((raw) => {
      const row = raw as unknown as {
        beneficiary_id: string | null;
        status: string;
        created_at: string | null;
        updated_at: string | null;
        attendance_sessions?: {
          session_date?: string;
          services?: { name_ar?: string | null; name_en?: string | null } | null;
          stages?: { name_ar?: string | null; name_en?: string | null } | null;
        } | null;
        beneficiaries?: { full_name_ar?: string | null } | null;
        profiles?: { full_name_ar?: string | null } | null;
      };
      const session = row.attendance_sessions;
      return {
        sessionDate: session?.session_date ?? "",
        serviceName: session?.services?.name_ar ?? session?.services?.name_en ?? "",
        stageName: session?.stages?.name_ar ?? session?.stages?.name_en ?? "",
        beneficiaryId: row.beneficiary_id,
        beneficiaryName: row.beneficiaries?.full_name_ar ?? "",
        status: row.status,
        recordedByName: row.profiles?.full_name_ar ?? null,
        // updated_at (migration 056) is the true last-modification time;
        // created_at is only the fallback for pre-056 rows.
        recordedAt: row.updated_at ?? row.created_at ?? "",
      };
    });

    return { data: aggregateDailyAttendance(rows), error: null };
  } catch {
    return { data: null, error: "Failed to load daily attendance." };
  }
}
