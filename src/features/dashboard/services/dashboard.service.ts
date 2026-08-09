import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegistrationFunctions } from "@/types/registration";
import type {
  AttendanceByStageItem,
  AttendanceTrendItem,
  DashboardData,
  DashboardKPIs,
  FollowupAnalytics,
  FollowupStatusCount,
  PipelineStageCount,
  RecentChildItem,
  ScheduledFollowupItem,
  StageAnalyticsItem,
} from "../types/dashboard.types";

type ServiceResult<T> = { data: T | null; error: string | null };

const ATTENDANCE_MONTHS = 12;
const NEW_CHILDREN_WINDOW_DAYS = 30;
const OPEN_STATUSES = new Set(["open", "in_progress"]);

/**
 * Sprint 2 (Phase 5): expensive dashboard series are aggregated by the
 * get_dashboard_trends() SECURITY DEFINER RPC (migration 037). If the RPC is
 * unavailable (older database), the service transparently falls back to the
 * previous JS aggregation so behavior is unchanged.
 */
const TRENDS_RPC_ENABLED = true;

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type StageRef = { id: string; name_ar: string | null; name_en: string | null };

type StatusBucket = { status: string; count: number };
type StageCountBucket = { stage_id: string; count: number };
type AttendanceBucket = {
  stage_id: string;
  present: number;
  absent: number;
  excused: number;
};
type MonthAttendanceBucket = {
  stage_id: string;
  attendance_count: number;
  attendance_total: number;
};
type SeriesBucket = { period: string; present: number; absent: number; excused: number };

type TrendsRpcResult = {
  attendanceMonthlyTrend: SeriesBucket[];
  attendanceWeeklyTrend: SeriesBucket[];
  attendanceByStage: AttendanceBucket[];
  attendanceThisMonthByStage: MonthAttendanceBucket[];
  followupStatusCounts: StatusBucket[];
  overdue: number;
  childrenPerStage: StageCountBucket[];
  followupsByStage: StageCountBucket[];
};

type TrendsBundle = {
  attendanceWeeklyTrend: AttendanceTrendItem[];
  attendanceMonthlyTrend: AttendanceTrendItem[];
  attendanceByStage: AttendanceByStageItem[];
  followupAnalytics: FollowupAnalytics;
  pipelineAnalytics: PipelineStageCount[];
  stageAnalytics: StageAnalyticsItem[];
};

function fillMonthlySeries(
  buckets: SeriesBucket[],
  now: Date,
): AttendanceTrendItem[] {
  const byKey = new Map(buckets.map((b) => [b.period, b]));
  const out: AttendanceTrendItem[] = [];
  for (let i = ATTENDANCE_MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = getMonthKey(d);
    const b = byKey.get(key) ?? { present: 0, absent: 0, excused: 0 };
    out.push({ period: key, ...b, total: b.present + b.absent + b.excused });
  }
  return out;
}

function fillWeeklySeries(
  buckets: SeriesBucket[],
  now: Date,
): AttendanceTrendItem[] {
  const byKey = new Map(buckets.map((b) => [b.period, b]));
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  const out: AttendanceTrendItem[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(thisMonday);
    d.setDate(d.getDate() - i * 7);
    const key = getISOWeek(d);
    const b = byKey.get(key) ?? { present: 0, absent: 0, excused: 0 };
    out.push({ period: key, ...b, total: b.present + b.absent + b.excused });
  }
  return out;
}

function normalizeRpcTrends(rpc: TrendsRpcResult, stages: StageRef[], now: Date): TrendsBundle {
  const stageName = (stageId: string): { nameAr: string; nameEn: string | null } => {
    const s = stages.find((st) => st.id === stageId);
    return { nameAr: s?.name_ar ?? "", nameEn: s?.name_en ?? null };
  };

  const attendanceByStage: AttendanceByStageItem[] = rpc.attendanceByStage.map((b) => {
    const total = b.present + b.absent + b.excused;
    const names = stageName(b.stage_id);
    return {
      stageId: b.stage_id,
      stageNameAr: names.nameAr,
      stageNameEn: names.nameEn,
      ...b,
      total,
      percentage: total > 0 ? Math.round((b.present / total) * 100) : 0,
    };
  });

  const childrenPerStage = new Map(rpc.childrenPerStage.map((c) => [c.stage_id, c.count]));
  const followupsPerStage = new Map(rpc.followupsByStage.map((c) => [c.stage_id, c.count]));
  const monthAtt = new Map(rpc.attendanceThisMonthByStage.map((c) => [c.stage_id, c]));

  const pipelineAnalytics: PipelineStageCount[] = stages.map((s) => ({
    stageId: s.id,
    stageNameAr: s.name_ar ?? "",
    stageNameEn: s.name_en ?? null,
    count: childrenPerStage.get(s.id) ?? 0,
  }));

  const stageAnalytics: StageAnalyticsItem[] = stages.map((s) => {
    const att = monthAtt.get(s.id);
    return {
      stageId: s.id,
      stageNameAr: s.name_ar ?? "",
      stageNameEn: s.name_en ?? null,
      totalChildren: childrenPerStage.get(s.id) ?? 0,
      attendanceCount: att?.attendance_count ?? 0,
      attendancePercentage:
        att && att.attendance_total > 0
          ? Math.round((att.attendance_count / att.attendance_total) * 100)
          : 0,
      followupCount: followupsPerStage.get(s.id) ?? 0,
    };
  });

  return {
    attendanceMonthlyTrend: fillMonthlySeries(rpc.attendanceMonthlyTrend, now),
    attendanceWeeklyTrend: fillWeeklySeries(rpc.attendanceWeeklyTrend, now),
    attendanceByStage,
    followupAnalytics: {
      statusCounts: rpc.followupStatusCounts,
      overdue: rpc.overdue ?? 0,
    },
    pipelineAnalytics,
    stageAnalytics,
  };
}

// ── Legacy JS aggregation (fallback when the RPC is not available) ──────────

type AttendanceWithSession = {
  status: string;
  attendance_sessions?: { session_date: string; stage_id: string } | null;
};

async function aggregateTrendsInJs(
  supabase: SupabaseClient,
  churchId: string,
  now: Date,
  monthStartStr: string,
  stages: StageRef[],
  stageIds?: string[],
): Promise<TrendsBundle> {
  const attendanceMonthsAgoStr = toDateStr(
    new Date(now.getFullYear(), now.getMonth() - ATTENDANCE_MONTHS, 1),
  );

  const scoped = stageIds !== undefined;

  let attendanceQuery = supabase
    .from("attendance_records")
    .select(
      `status, attendance_sessions!inner (session_date, stage_id)`,
    )
    .eq("church_id", churchId)
    .gte("attendance_sessions.session_date", attendanceMonthsAgoStr);

  let followupsQuery = supabase
    .from("followups")
    .select(
      "id, beneficiary_id, status, scheduled_at, updated_at" +
        (scoped
          ? ", beneficiaries!inner(beneficiary_assignments!inner(stage_id))"
          : ""),
    )
    .eq("church_id", churchId);

  let assignmentsQuery = supabase
    .from("beneficiary_assignments")
    .select("beneficiary_id, stage_id")
    .eq("church_id", churchId)
    .eq("is_current", true);

  if (scoped) {
    attendanceQuery = attendanceQuery.in("attendance_sessions.stage_id", stageIds);
    followupsQuery = followupsQuery
      .eq("beneficiaries.beneficiary_assignments.is_current", true)
      .in("beneficiaries.beneficiary_assignments.stage_id", stageIds);
    assignmentsQuery = assignmentsQuery.in("stage_id", stageIds);
  }

  const [attendanceResult, followupsResult, assignmentsResult] = await Promise.all([
    attendanceQuery,
    followupsQuery,
    assignmentsQuery,
  ]);

  if (attendanceResult.error) throw new Error(attendanceResult.error.message);
  if (followupsResult.error) throw new Error(followupsResult.error.message);
  if (assignmentsResult.error) throw new Error(assignmentsResult.error.message);

  const attendance = (attendanceResult.data ?? []) as unknown as AttendanceWithSession[];
  const followups = (followupsResult.data ?? []) as unknown as {
    id: string;
    beneficiary_id: string | null;
    status: string;
    scheduled_at: string | null;
    updated_at: string | null;
  }[];
  const assignments = assignmentsResult.data ?? [];

  const monthBuckets = new Map<string, { present: number; absent: number; excused: number }>();
  const weekBuckets = new Map<string, { present: number; absent: number; excused: number }>();
  const stageBuckets = new Map<string, { present: number; absent: number; excused: number }>();
  const stageMonth = new Map<string, { present: number; total: number }>();

  for (const a of attendance) {
    const session = a.attendance_sessions;
    if (!session) continue;

    const date = new Date(session.session_date);
    const weekKey = getISOWeek(date);
    const monthKey = getMonthKey(date);
    const increment = (m: Map<string, { present: number; absent: number; excused: number }>, key: string) => {
      const b = m.get(key) ?? { present: 0, absent: 0, excused: 0 };
      if (a.status === "present") b.present++;
      else if (a.status === "absent") b.absent++;
      else if (a.status === "excused") b.excused++;
      m.set(key, b);
    };

    increment(monthBuckets, monthKey);
    increment(weekBuckets, weekKey);
    increment(stageBuckets, session.stage_id);

    if (session.session_date >= monthStartStr) {
      const sm = stageMonth.get(session.stage_id) ?? { present: 0, total: 0 };
      sm.total++;
      if (a.status === "present") sm.present++;
      stageMonth.set(session.stage_id, sm);
    }
  }

  const stageNames = new Map(stages.map((s) => [s.id, s]));

  const attendanceByStage: AttendanceByStageItem[] = Array.from(stageBuckets.entries()).map(
    ([stageId, b]) => {
      const total = b.present + b.absent + b.excused;
      const names = stageNames.get(stageId);
      return {
        stageId,
        stageNameAr: names?.name_ar ?? "",
        stageNameEn: names?.name_en ?? null,
        ...b,
        total,
        percentage: total > 0 ? Math.round((b.present / total) * 100) : 0,
      };
    },
  );

  const statusCountMap = new Map<string, number>();
  for (const f of followups) {
    statusCountMap.set(f.status, (statusCountMap.get(f.status) ?? 0) + 1);
  }
  const statusCounts: FollowupStatusCount[] = Array.from(statusCountMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const nowISO = now.toISOString();
  const overdue = followups.filter(
    (f) => OPEN_STATUSES.has(f.status) && f.scheduled_at != null && f.scheduled_at < nowISO,
  ).length;

  const childrenPerStage = new Map<string, number>();
  for (const a of assignments) {
    childrenPerStage.set(a.stage_id, (childrenPerStage.get(a.stage_id) ?? 0) + 1);
  }

  const pipelineAnalytics: PipelineStageCount[] = stages.map((s) => ({
    stageId: s.id,
    stageNameAr: s.name_ar ?? "",
    stageNameEn: s.name_en ?? null,
    count: childrenPerStage.get(s.id) ?? 0,
  }));

  const stageAnalytics: StageAnalyticsItem[] = stages.map((s) => {
    const att = stageMonth.get(s.id);
    return {
      stageId: s.id,
      stageNameAr: s.name_ar ?? "",
      stageNameEn: s.name_en ?? null,
      totalChildren: childrenPerStage.get(s.id) ?? 0,
      attendanceCount: att?.present ?? 0,
      attendancePercentage:
        att && att.total > 0 ? Math.round((att.present / att.total) * 100) : 0,
      // Legacy note: follow-up counts per stage were not computed in the old
      // client aggregation; the RPC path computes them correctly.
      followupCount: 0,
    };
  });

  return {
    attendanceMonthlyTrend: fillMonthlySeries(
      Array.from(monthBuckets.entries()).map(([period, b]) => ({ period, ...b })),
      now,
    ),
    attendanceWeeklyTrend: fillWeeklySeries(
      Array.from(weekBuckets.entries()).map(([period, b]) => ({ period, ...b })),
      now,
    ),
    attendanceByStage,
    followupAnalytics: { statusCounts, overdue },
    pipelineAnalytics,
    stageAnalytics,
  };
}

// ── Public entry ────────────────────────────────────────────────────────────

export async function getDashboardData(
  supabase: SupabaseClient,
  churchId: string,
  stageIds?: string[],
): Promise<ServiceResult<DashboardData>> {
  try {
    const scoped = stageIds !== undefined;

    if (scoped && stageIds.length === 0) {
      return {
        data: {
          kpis: {
            totalActiveChildren: 0,
            newChildrenThisMonth: 0,
            openFollowups: 0,
            completedFollowupsThisMonth: 0,
            attendanceThisMonth: 0,
            activeStages: 0,
          },
          attendanceWeeklyTrend: [],
          attendanceMonthlyTrend: [],
          attendanceByStage: [],
          followupAnalytics: { statusCounts: [], overdue: 0 },
          pipelineAnalytics: [],
          stageAnalytics: [],
          nextFollowupsDue: [],
          recentChildren: [],
        },
        error: null,
      };
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = toDateStr(monthStart);
    const newChildrenWindowISO = new Date(
      now.getTime() - NEW_CHILDREN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    // 1) KPI counts — aggregated in the database (head+count), never full loads.
    const [
      activeChildrenCount,
      newChildrenCount,
      openFollowupsCount,
      completedThisMonthCount,
      attendanceThisMonthCount,
      activeStagesCount,
      stagesResult,
    ] = await Promise.all([
      scoped
        ? supabase
            .from("beneficiaries")
            .select("id, beneficiary_assignments!inner(stage_id)", { count: "exact", head: true })
            .eq("church_id", churchId)
            .eq("status", "active")
            .is("deleted_at", null)
            .eq("beneficiary_assignments.is_current", true)
            .in("beneficiary_assignments.stage_id", stageIds)
        : supabase
            .from("beneficiaries")
            .select("id", { count: "exact", head: true })
            .eq("church_id", churchId)
            .eq("status", "active")
            .is("deleted_at", null),
      scoped
        ? supabase
            .from("beneficiaries")
            .select("id, beneficiary_assignments!inner(stage_id)", { count: "exact", head: true })
            .eq("church_id", churchId)
            .eq("status", "active")
            .is("deleted_at", null)
            .gte("created_at", newChildrenWindowISO)
            .eq("beneficiary_assignments.is_current", true)
            .in("beneficiary_assignments.stage_id", stageIds)
        : supabase
            .from("beneficiaries")
            .select("id", { count: "exact", head: true })
            .eq("church_id", churchId)
            .eq("status", "active")
            .is("deleted_at", null)
            .gte("created_at", newChildrenWindowISO),
      scoped
        ? supabase
            .from("followups")
            .select("id, beneficiaries!inner(beneficiary_assignments!inner(stage_id))", { count: "exact", head: true })
            .eq("church_id", churchId)
            .in("status", ["open", "in_progress"])
            .eq("beneficiaries.beneficiary_assignments.is_current", true)
            .in("beneficiaries.beneficiary_assignments.stage_id", stageIds)
        : supabase
            .from("followups")
            .select("id", { count: "exact", head: true })
            .eq("church_id", churchId)
            .in("status", ["open", "in_progress"]),
      scoped
        ? supabase
            .from("followups")
            .select("id, beneficiaries!inner(beneficiary_assignments!inner(stage_id))", { count: "exact", head: true })
            .eq("church_id", churchId)
            .eq("status", "completed")
            .gte("updated_at", monthStartStr)
            .eq("beneficiaries.beneficiary_assignments.is_current", true)
            .in("beneficiaries.beneficiary_assignments.stage_id", stageIds)
        : supabase
            .from("followups")
            .select("id", { count: "exact", head: true })
            .eq("church_id", churchId)
            .eq("status", "completed")
            .gte("updated_at", monthStartStr),
      scoped
        ? supabase
            .from("attendance_records")
            .select("id, attendance_sessions!inner(session_date, stage_id)", {
              count: "exact",
              head: true,
            })
            .eq("church_id", churchId)
            .gte("attendance_sessions.session_date", monthStartStr)
            .in("attendance_sessions.stage_id", stageIds)
        : supabase
            .from("attendance_records")
            .select("id, attendance_sessions!inner(session_date)", {
              count: "exact",
              head: true,
            })
            .eq("church_id", churchId)
            .gte("attendance_sessions.session_date", monthStartStr),
      scoped
        ? supabase
            .from("stages")
            .select("id", { count: "exact", head: true })
            .eq("church_id", churchId)
            .eq("is_active", true)
            .is("deleted_at", null)
            .in("id", stageIds)
        : supabase
            .from("stages")
            .select("id", { count: "exact", head: true })
            .eq("church_id", churchId)
            .eq("is_active", true)
            .is("deleted_at", null),
      scoped
        ? supabase
            .from("stages")
            .select("id, name_ar, name_en")
            .eq("church_id", churchId)
            .eq("is_active", true)
            .is("deleted_at", null)
            .in("id", stageIds)
        : supabase
            .from("stages")
            .select("id, name_ar, name_en")
            .eq("church_id", churchId)
            .eq("is_active", true)
            .is("deleted_at", null),
    ]);

    for (const result of [
      activeChildrenCount,
      newChildrenCount,
      openFollowupsCount,
      completedThisMonthCount,
      attendanceThisMonthCount,
      activeStagesCount,
      stagesResult,
    ]) {
      if (result.error) return { data: null, error: result.error.message };
    }

    const stages = (stagesResult.data ?? []) as StageRef[];
    const kpis: DashboardKPIs = {
      totalActiveChildren: activeChildrenCount.count ?? 0,
      newChildrenThisMonth: newChildrenCount.count ?? 0,
      openFollowups: openFollowupsCount.count ?? 0,
      completedFollowupsThisMonth: completedThisMonthCount.count ?? 0,
      attendanceThisMonth: attendanceThisMonthCount.count ?? 0,
      activeStages: activeStagesCount.count ?? 0,
    };

    // 2) Small targeted lists (limits, not full tables).
    const [nextFollowupsResult, recentChildrenResult] = await Promise.all([
      scoped
        ? supabase
            .from("followups")
            .select(
              "id, beneficiary_id, scheduled_at, status, beneficiaries!inner(full_name_ar, beneficiary_assignments!inner(stage_id))",
            )
            .eq("church_id", churchId)
            .in("status", ["open", "in_progress"])
            .not("scheduled_at", "is", null)
            .eq("beneficiaries.beneficiary_assignments.is_current", true)
            .in("beneficiaries.beneficiary_assignments.stage_id", stageIds)
            .order("scheduled_at", { ascending: true })
            .limit(20)
        : supabase
            .from("followups")
            .select(
              "id, beneficiary_id, scheduled_at, status, beneficiaries!inner(full_name_ar)",
            )
            .eq("church_id", churchId)
            .in("status", ["open", "in_progress"])
            .not("scheduled_at", "is", null)
            .order("scheduled_at", { ascending: true })
            .limit(20),
      scoped
        ? supabase
            .from("beneficiaries")
            .select("id, full_name_ar, created_at, beneficiary_assignments!inner(stage_id)")
            .eq("church_id", churchId)
            .eq("status", "active")
            .is("deleted_at", null)
            .eq("beneficiary_assignments.is_current", true)
            .in("beneficiary_assignments.stage_id", stageIds)
            .order("created_at", { ascending: false })
            .limit(5)
        : supabase
            .from("beneficiaries")
            .select("id, full_name_ar, created_at")
            .eq("church_id", churchId)
            .eq("status", "active")
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(5),
    ]);

    if (nextFollowupsResult.error) {
      return { data: null, error: nextFollowupsResult.error.message };
    }
    if (recentChildrenResult.error) {
      return { data: null, error: recentChildrenResult.error.message };
    }

    const nextFollowupsDue: ScheduledFollowupItem[] = (
      nextFollowupsResult.data ?? []
    ).map((row) => {
      const joined = row as {
        id: string;
        beneficiary_id: string | null;
        scheduled_at: string | null;
        status: string;
        beneficiaries?: { full_name_ar?: string | null } | null;
      };
      return {
        id: joined.id,
        childId: joined.beneficiary_id ?? "",
        childName: joined.beneficiaries?.full_name_ar ?? "",
        scheduledAt: joined.scheduled_at ?? "",
        status: joined.status,
      };
    });

    const recentChildren: RecentChildItem[] = (
      recentChildrenResult.data ?? []
    ).map((row) => {
      const r = row as { id: string; full_name_ar: string | null; created_at: string };
      return {
        id: r.id,
        name: r.full_name_ar ?? "",
        createdAt: r.created_at,
      };
    });

    // 3) Trends — SQL RPC with JS fallback.
    const trends = await loadTrends(supabase, churchId, now, monthStartStr, stages, stageIds);

    return {
      data: {
        kpis,
        ...trends,
        nextFollowupsDue,
        recentChildren,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load dashboard data." };
  }
}

async function loadTrends(
  supabase: SupabaseClient,
  churchId: string,
  now: Date,
  monthStartStr: string,
  stages: StageRef[],
  stageIds?: string[],
): Promise<TrendsBundle> {
  if (TRENDS_RPC_ENABLED) {
    try {
      const result = (await supabase.rpc<
        "get_dashboard_trends",
        RegistrationFunctions["get_dashboard_trends"]["Args"]
      >("get_dashboard_trends", {
        p_stage_ids: stageIds ?? null,
      })) as unknown as {
        data: TrendsRpcResult | null;
        error: { message: string } | null;
      };

      if (!result.error && result.data) {
        return normalizeRpcTrends(result.data, stages, now);
      }
    } catch {
      // Fall through to the JS aggregation below.
    }
  }

  return aggregateTrendsInJs(supabase, churchId, now, monthStartStr, stages, stageIds);
}
