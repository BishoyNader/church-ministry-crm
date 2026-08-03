import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReportsData,
  ReportsFilterOption,
  ReportsFilterOptions,
  ReportsFilters,
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

export async function getReportsFilterOptions(
  supabase: SupabaseClient,
  churchId: string,
): Promise<{ data: ReportsFilterOptions | null; error: string | null }> {
  try {
    const [servicesResult, stagesResult, servantResult] = await Promise.all([
      supabase.from("services").select("id, name_ar, name_en").eq("church_id", churchId).is("deleted_at", null),
      supabase.from("stages").select("id, name_ar, name_en").eq("church_id", churchId).is("deleted_at", null),
      supabase.from("profiles").select("id, full_name_ar").eq("church_id", churchId),
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

    const servants = (servantResult.data ?? []).map((row) => ({
      id: row.id,
      label: row.full_name_ar ?? "Servant",
    })) as ReportsFilterOption[];

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
): Promise<{ data: ReportsData | null; error: string | null }> {
  try {
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

    let followupsQuery = supabase
      .from("followups")
      .select("status, created_at, scheduled_at, completed_at, assigned_to, beneficiary_id")
      .eq("church_id", churchId)
      .order("created_at", { ascending: false });

    if (filters.fromDate) {
      followupsQuery = followupsQuery.gte("created_at", `${filters.fromDate}T00:00:00.000Z`);
    }
    if (filters.toDate) {
      followupsQuery = followupsQuery.lte("created_at", `${filters.toDate}T23:59:59.999Z`);
    }

    const [attendanceResult, followupsResult] = await Promise.all([
      attendanceQuery,
      followupsQuery,
    ]);

    if (attendanceResult.error) return { data: null, error: attendanceResult.error.message };
    if (followupsResult.error) return { data: null, error: followupsResult.error.message };

    const attendanceRows = (attendanceResult.data ?? []) as unknown as AttendanceRow[];
    const followups = (followupsResult.data ?? []) as FollowupRow[];

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

    for (const followup of followups) {
      if (followup.status === "completed") followupCounts.completed += 1;
      else if (followup.status === "overdue") followupCounts.overdue += 1;
      else followupCounts.open += 1;
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
