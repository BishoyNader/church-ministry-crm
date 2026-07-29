import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DashboardData,
  DashboardKPIs,
  AttendanceTrendItem,
  AttendanceByStageItem,
  FollowupAnalytics,
  FollowupStatusCount,
  PipelineStageCount,
  StageAnalyticsItem,
  ScheduledFollowupItem,
  RecentChildItem,
} from "../types/dashboard.types";

type ServiceResult<T> = { data: T | null; error: string | null };

const ATTENDANCE_MONTHS = 12;
const NEW_CHILDREN_WINDOW_DAYS = 30;

const OPEN_STATUSES = new Set(["scheduled", "in_progress"]);

const PIPELINE_STAGES: string[] = [
  "new_visitor",
  "first_followup",
  "regular_attendee",
  "active_member",
  "leader_candidate",
];

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

export async function getDashboardData(
  supabase: SupabaseClient,
  churchId: string,
): Promise<ServiceResult<DashboardData>> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = toDateStr(monthStart);
    const newChildrenWindowStart = new Date(
      now.getTime() - NEW_CHILDREN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const attendanceMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - ATTENDANCE_MONTHS,
      1,
    );
    const attendanceMonthsAgoStr = toDateStr(attendanceMonthsAgo);

    const [childrenResult, followupsResult, attendanceResult, stagesResult] =
      await Promise.all([
        supabase
          .from("children")
          .select("id, name, status, pipeline_stage, created_at, stage_id")
          .eq("church_id", churchId)
          .is("deleted_at", null),
        supabase
          .from("followups")
          .select("id, child_id, status, scheduled_at, updated_at, stage_id")
          .eq("church_id", churchId),
        supabase
          .from("attendance")
          .select("status, attendance_date, stage_id")
          .eq("church_id", churchId)
          .gte("attendance_date", attendanceMonthsAgoStr),
        supabase
          .from("stages")
          .select("id, name_ar, name_en")
          .eq("church_id", churchId)
          .eq("is_active", true)
          .is("deleted_at", null),
      ]);

    if (childrenResult.error)
      return { data: null, error: childrenResult.error.message };
    if (followupsResult.error)
      return { data: null, error: followupsResult.error.message };
    if (attendanceResult.error)
      return { data: null, error: attendanceResult.error.message };
    if (stagesResult.error)
      return { data: null, error: stagesResult.error.message };

    const children = childrenResult.data ?? [];
    const followups = followupsResult.data ?? [];
    const attendance = attendanceResult.data ?? [];
    const stages = stagesResult.data ?? [];

    const stageNames = new Map(stages.map((s) => [s.id, { nameAr: s.name_ar, nameEn: s.name_en }]));

    // ── KPIs ──
    const activeChildren = children.filter((c) => c.status === "active");

    const newChildrenWindowStr = newChildrenWindowStart.toISOString();
    const monthStartISO = monthStart.toISOString();

    const kpis: DashboardKPIs = {
      totalActiveChildren: activeChildren.length,
      newChildrenThisMonth: activeChildren.filter(
        (c) => c.created_at >= newChildrenWindowStr,
      ).length,
      openFollowups: followups.filter((f) => OPEN_STATUSES.has(f.status)).length,
      completedFollowupsThisMonth: followups.filter(
        (f) =>
          f.status === "completed" &&
          f.updated_at != null &&
          f.updated_at >= monthStartISO,
      ).length,
      attendanceThisMonth: attendance.filter(
        (a) => a.attendance_date >= monthStartStr,
      ).length,
      activeStages: stages.length,
    };

    // ── Attendance weekly trend (last 12 weeks) ──
    // TODO:
    // For large datasets migrate attendance analytics
    // to SQL aggregation using date_trunc()
    // and GROUP BY to avoid loading all rows into JS.
    const weekBuckets = new Map<
      string,
      { present: number; absent: number; excused: number }
    >();
    const monthBuckets = new Map<
      string,
      { present: number; absent: number; excused: number }
    >();

    for (const a of attendance) {
      const date = new Date(a.attendance_date);
      const wk = getISOWeek(date);
      const mk = getMonthKey(date);

      const wb = weekBuckets.get(wk) ?? { present: 0, absent: 0, excused: 0 };
      const mb = monthBuckets.get(mk) ?? { present: 0, absent: 0, excused: 0 };

      if (a.status === "present") {
        wb.present++;
        mb.present++;
      } else if (a.status === "absent") {
        wb.absent++;
        mb.absent++;
      } else if (a.status === "excused") {
        wb.excused++;
        mb.excused++;
      }

      weekBuckets.set(wk, wb);
      monthBuckets.set(mk, mb);
    }

// TODO:
// For large datasets migrate attendance analytics
// to SQL aggregation using date_trunc()
// and GROUP BY to avoid loading all rows into JS.
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

    const attendanceWeeklyTrend: AttendanceTrendItem[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(thisMonday);
      d.setDate(d.getDate() - i * 7);
      const key = getISOWeek(d);
      const b = weekBuckets.get(key) ?? { present: 0, absent: 0, excused: 0 };
      attendanceWeeklyTrend.push({
        period: key,
        ...b,
        total: b.present + b.absent + b.excused,
      });
    }

    const attendanceMonthlyTrend: AttendanceTrendItem[] = [];
    for (let i = ATTENDANCE_MONTHS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = getMonthKey(d);
      const b = monthBuckets.get(key) ?? { present: 0, absent: 0, excused: 0 };
      attendanceMonthlyTrend.push({
        period: key,
        ...b,
        total: b.present + b.absent + b.excused,
      });
    }

    // ── Attendance by stage ──
// TODO:
// For large datasets migrate attendance analytics
// to SQL aggregation using date_trunc()
// and GROUP BY to avoid loading all rows into JS.
    const stageAttMap = new Map<
      string,
      { present: number; absent: number; excused: number }
    >();
    for (const a of attendance) {
      if (!a.stage_id) continue;
      const b = stageAttMap.get(a.stage_id) ?? {
        present: 0,
        absent: 0,
        excused: 0,
      };
      if (a.status === "present") b.present++;
      else if (a.status === "absent") b.absent++;
      else if (a.status === "excused") b.excused++;
      stageAttMap.set(a.stage_id, b);
    }

    const attendanceByStage: AttendanceByStageItem[] = [];
    for (const [stageId, b] of stageAttMap) {
      const total = b.present + b.absent + b.excused;
      const names = stageNames.get(stageId);
      attendanceByStage.push({
        stageId,
        stageNameAr: names?.nameAr ?? "",
        stageNameEn: names?.nameEn ?? null,
        ...b,
        total,
        percentage: total > 0 ? Math.round((b.present / total) * 100) : 0,
      });
    }

    // ── Followup analytics ──
    // TODO:
    // For large datasets migrate to SQL aggregation
    // with COUNT(*) ... GROUP BY status
    // and COUNT(*) FILTER(WHERE ...) for overdue.
    const statusCountMap = new Map<string, number>();
    for (const f of followups) {
      statusCountMap.set(f.status, (statusCountMap.get(f.status) ?? 0) + 1);
    }
    const statusCounts: FollowupStatusCount[] = Array.from(
      statusCountMap.entries(),
    )
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    const nowISO = now.toISOString();
    const overdue = followups.filter(
      (f) =>
        OPEN_STATUSES.has(f.status) &&
        f.scheduled_at != null &&
        f.scheduled_at < nowISO,
    ).length;

    const followupAnalytics: FollowupAnalytics = { statusCounts, overdue };

    // ── Pipeline analytics ──
    const pipelineMap = new Map<string, number>();
    for (const c of activeChildren) {
      pipelineMap.set(
        c.pipeline_stage,
        (pipelineMap.get(c.pipeline_stage) ?? 0) + 1,
      );
    }
    const pipelineAnalytics: PipelineStageCount[] = PIPELINE_STAGES.map(
      (stage) => ({
        stage,
        count: pipelineMap.get(stage) ?? 0,
      }),
    );

    // ── Stage analytics ──
    // TODO:
    // For large datasets migrate stage aggregation
    // to SQL-side queries with COUNT(*)
    // and LEFT JOINs to avoid loading all rows into JS.
    const childrenPerStage = new Map<string, number>();
    for (const c of activeChildren) {
      if (!c.stage_id) continue;
      childrenPerStage.set(
        c.stage_id,
        (childrenPerStage.get(c.stage_id) ?? 0) + 1,
      );
    }

    const attPerStageThisMonth = new Map<
      string,
      { present: number; total: number }
    >();
    for (const a of attendance) {
      if (!a.stage_id || a.attendance_date < monthStartStr) continue;
      const b = attPerStageThisMonth.get(a.stage_id) ?? {
        present: 0,
        total: 0,
      };
      b.total++;
      if (a.status === "present") b.present++;
      attPerStageThisMonth.set(a.stage_id, b);
    }

    const followupsPerStage = new Map<string, number>();
    for (const f of followups) {
      if (!f.stage_id) continue;
      followupsPerStage.set(
        f.stage_id,
        (followupsPerStage.get(f.stage_id) ?? 0) + 1,
      );
    }

    const stageAnalytics: StageAnalyticsItem[] = stages.map((s) => {
      const att = attPerStageThisMonth.get(s.id) ?? { present: 0, total: 0 };
      const names = stageNames.get(s.id);
      return {
        stageId: s.id,
        stageNameAr: names?.nameAr ?? s.name_ar,
        stageNameEn: names?.nameEn ?? s.name_en ?? null,
        totalChildren: childrenPerStage.get(s.id) ?? 0,
        attendanceCount: att.total,
        attendancePercentage:
          att.total > 0 ? Math.round((att.present / att.total) * 100) : 0,
        followupCount: followupsPerStage.get(s.id) ?? 0,
      };
    });

    // ── Next followups due ──
    const childNameMap = new Map(children.map((c) => [c.id, c.name ?? ""]));
    const nowDate = new Date();
    const nextFollowupsDue: ScheduledFollowupItem[] = followups
      .filter((f) => OPEN_STATUSES.has(f.status) && f.scheduled_at != null)
      .map((f) => ({
        id: f.id,
        childId: f.child_id ?? "",
        childName: childNameMap.get(f.child_id ?? "") ?? "",
        scheduledAt: f.scheduled_at ?? "",
        status: f.status,
      }))
      .sort((a, b) => {
        const aDiff = new Date(a.scheduledAt).getTime() - nowDate.getTime();
        const bDiff = new Date(b.scheduledAt).getTime() - nowDate.getTime();
        return aDiff - bDiff;
      })
      .slice(0, 5);

    // ── Recent children ──
    const recentChildren: RecentChildItem[] = activeChildren
      .filter((c) => c.name)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        name: c.name ?? "",
        pipelineStage: c.pipeline_stage ?? "",
        createdAt: c.created_at,
      }));

    return {
      data: {
        kpis,
        attendanceWeeklyTrend,
        attendanceMonthlyTrend,
        attendanceByStage,
        followupAnalytics,
        pipelineAnalytics,
        stageAnalytics,
        nextFollowupsDue,
        recentChildren,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load dashboard data." };
  }
}
