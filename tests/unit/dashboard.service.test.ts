import { describe, expect, it, vi } from "vitest";
import { getDashboardData } from "@/features/dashboard/services/dashboard.service";

/**
 * Chainable thenable Supabase mock. Every builder method (select, eq, is, gte,
 * in, not, order, limit) returns the same thenable proxy, so the whole chain
 * resolves to the response configured for that table. `head` queries resolve
 * to `{ data: [], count }`; list queries resolve to `{ data: [...] }`.
 */
function createMockSupabase() {
  const rpc = vi.fn();

  const counts: Record<string, number> = {
    beneficiaries: 10,
    followups: 4,
    attendance_records: 3,
    stages: 2,
  };

  const buildChain = (table: string) => {
    let options: { head?: boolean } | undefined;

    const respond = () => {
      if (options?.head) {
        return { data: [], count: counts[table] ?? 0, error: null };
      }
      if (table === "stages") {
        return {
          data: [
            { id: "stage-1", name_ar: "مرحلة 1", name_en: "Stage 1" },
            { id: "stage-2", name_ar: "مرحلة 2", name_en: null },
          ],
          error: null,
        };
      }
      if (table === "followups") {
        return {
          data: [
            {
              id: "followup-1",
              beneficiary_id: "beneficiary-1",
              scheduled_at: "2099-01-01T00:00:00.000Z",
              status: "open",
              updated_at: "2026-08-01T00:00:00.000Z",
              beneficiaries: { full_name_ar: "مخدوم 1" },
            },
          ],
          error: null,
        };
      }
      if (table === "beneficiaries") {
        return {
          data: [
            {
              id: "beneficiary-1",
              full_name_ar: "مخدوم 1",
              created_at: "2026-08-01T00:00:00.000Z",
            },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    };

    const promise = Promise.resolve().then(respond);

    const chain: unknown = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === "then") return promise.then.bind(promise);
        if (prop === "catch") return promise.catch.bind(promise);
        if (prop === "finally") return promise.finally.bind(promise);
        if (prop === "select") {
          return (_cols: string, opts?: { head?: boolean }) => {
            options = opts;
            return chain;
          };
        }
        return () => chain;
      },
    });

    return chain;
  };

  const from = vi.fn((table: string) => buildChain(table as string));

  return { supabase: { from, rpc } as never, from, rpc };
}

describe("getDashboardData", () => {
  it("computes KPIs from database counts and trends from the RPC", async () => {
    const { supabase, rpc } = createMockSupabase();
    rpc.mockResolvedValue({
      data: {
        attendanceMonthlyTrend: [],
        attendanceWeeklyTrend: [],
        attendanceByStage: [],
        attendanceThisMonthByStage: [],
        followupStatusCounts: [{ status: "open", count: 2 }],
        overdue: 1,
        childrenPerStage: [],
        followupsByStage: [],
      },
      error: null,
    });

    const result = await getDashboardData(supabase, "church-1");

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();

    const kpis = result.data!.kpis;
    expect(kpis.totalActiveChildren).toBe(10);
    expect(kpis.newChildrenThisMonth).toBe(10);
    expect(kpis.openFollowups).toBe(4);
    expect(kpis.completedFollowupsThisMonth).toBe(4);
    expect(kpis.attendanceThisMonth).toBe(3);
    expect(kpis.activeStages).toBe(2);

    expect(result.data!.attendanceMonthlyTrend).toHaveLength(12);
    expect(result.data!.attendanceWeeklyTrend).toHaveLength(12);
    expect(result.data!.followupAnalytics.statusCounts).toEqual([
      { status: "open", count: 2 },
    ]);
    expect(result.data!.followupAnalytics.overdue).toBe(1);
    expect(result.data!.pipelineAnalytics).toHaveLength(2);
    expect(result.data!.stageAnalytics).toHaveLength(2);
    expect(result.data!.nextFollowupsDue).toHaveLength(1);
    expect(result.data!.nextFollowupsDue[0].childName).toBe("مخدوم 1");
    expect(result.data!.recentChildren).toHaveLength(1);

    expect(rpc).toHaveBeenCalledWith("get_dashboard_trends", { p_stage_ids: null });
  });

  it("falls back to JS aggregation when the RPC is unavailable", async () => {
    const { supabase, rpc } = createMockSupabase();
    rpc.mockResolvedValue({ data: null, error: { message: "rpc not found" } });

    const result = await getDashboardData(supabase, "church-1");

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data!.attendanceMonthlyTrend).toHaveLength(12);
    expect(result.data!.attendanceWeeklyTrend).toHaveLength(12);
    // The only follow-up is scheduled in the far future → not overdue.
    expect(result.data!.followupAnalytics.overdue).toBe(0);
    expect(result.data!.followupAnalytics.statusCounts).toEqual([
      { status: "open", count: 1 },
    ]);
    expect(result.data!.stageAnalytics).toHaveLength(2);
    expect(rpc).toHaveBeenCalledWith("get_dashboard_trends", { p_stage_ids: null });
  });
});
