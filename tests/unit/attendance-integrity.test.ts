import { describe, expect, it, vi } from "vitest";
import {
  createAttendance,
  toggleAttendance,
} from "@/features/children/services/child.service";
import {
  batchServantAttendance,
  listServantAttendanceHistory,
} from "@/features/servant-attendance/services/servant-attendance.service";
import {
  aggregateDailyAttendance,
  type DailyAttendanceInput,
} from "@/features/reports/services/reports.service";

type UpsertCall = { table: string; rows: unknown[]; opts?: unknown };
type InsertCall = { table: string; rows: unknown[] };
type OrderCall = { table: string; col: string; opts?: unknown };

/**
 * Mock Supabase whose responses for `attendance_records` are driven by an
 * explicit queue (per-test), mirroring the flow of each service under test:
 *   - createAttendance / toggleAttendance: one record upsert (no prior select)
 *   - batchServantAttendance: select existing, then multi-row upsert
 */
function createMockSupabase(
  recordResponses: Array<{ data: unknown; error: unknown }> = [
    { data: null, error: null },
  ],
) {
  const upsertCalls: UpsertCall[] = [];
  const insertCalls: InsertCall[] = [];
  const orderCalls: OrderCall[] = [];
  let recordCall = 0;

  const buildChain = (table: string) => {
    const respond = () => {
      if (table === "profiles") {
        return { data: { church_id: "church-1" }, error: null };
      }
      if (table === "attendance_sessions") {
        return { data: { id: "session-1" }, error: null };
      }
      if (table === "attendance_records") {
        const response = recordResponses[Math.min(recordCall, recordResponses.length - 1)];
        recordCall += 1;
        return response;
      }
      return { data: [], error: null };
    };

    const promise = Promise.resolve().then(respond);

    const chain: unknown = new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === "then") return promise.then.bind(promise);
          if (prop === "catch") return promise.catch.bind(promise);
          if (prop === "finally") return promise.finally.bind(promise);
          if (prop === "insert") {
            return (rows: unknown[]) => {
              insertCalls.push({ table, rows });
              return chain;
            };
          }
          if (prop === "upsert") {
            return (rows: unknown[], opts?: unknown) => {
              upsertCalls.push({ table, rows, opts });
              return chain;
            };
          }
          if (prop === "order") {
            return (col: string, opts?: unknown) => {
              orderCalls.push({ table, col, opts });
              return chain;
            };
          }
          return () => chain;
        },
      },
    );

    return chain;
  };

  const from = vi.fn((table: string) => buildChain(table as string));

  return {
    supabase: {
      from,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    } as never,
    upsertCalls,
    insertCalls,
    orderCalls,
  };
}

describe("attendance data-integrity invariant — one record per attendee per session", () => {
  it("createAttendance UPSERTS instead of inserting (status re-save updates the row)", async () => {
    const { supabase, upsertCalls, insertCalls } = createMockSupabase([
      { data: { id: "record-1" }, error: null },
    ]);

    const result = await createAttendance(supabase, {
      beneficiary_id: "beneficiary-1",
      stage_id: "stage-1",
      service_id: "service-1",
      attendance_date: "2026-09-10",
      status: "present",
    });

    expect(result.error).toBeNull();

    // NO plain insert — an insert would raise 23505 on a second save.
    expect(insertCalls.filter((c) => c.table === "attendance_records")).toHaveLength(0);
    const recordUpserts = upsertCalls.filter((c) => c.table === "attendance_records");
    expect(recordUpserts).toHaveLength(1);
    expect(recordUpserts[0].opts).toEqual({ onConflict: "session_id,beneficiary_id" });
    expect(recordUpserts[0].rows).toEqual(
      expect.objectContaining({
        session_id: "session-1",
        beneficiary_id: "beneficiary-1",
        status: "present",
      }),
    );
  });

  it("toggleAttendance updates the existing record (absent → present converges to one row) and carries notes", async () => {
    const { supabase, upsertCalls, insertCalls } = createMockSupabase();

    const result = await toggleAttendance(supabase, {
      beneficiary_id: "beneficiary-1",
      stage_id: "stage-1",
      service_id: "service-1",
      attendance_date: "2026-09-10",
      status: "present",
      notes: "arrived late",
    });

    expect(result.error).toBeNull();
    expect(insertCalls.filter((c) => c.table === "attendance_records")).toHaveLength(0);
    const recordUpserts = upsertCalls.filter((c) => c.table === "attendance_records");
    expect(recordUpserts).toHaveLength(1);
    expect(recordUpserts[0].opts).toEqual({ onConflict: "session_id,beneficiary_id" });
    expect(recordUpserts[0].rows).toEqual(
      expect.objectContaining({
        session_id: "session-1",
        beneficiary_id: "beneficiary-1",
        status: "present",
        notes: "arrived late",
      }),
    );
  });

  it("toggleAttendance with status null deletes the record (toggle-off) and inserts nothing", async () => {
    const { supabase, upsertCalls, insertCalls } = createMockSupabase();

    const result = await toggleAttendance(supabase, {
      beneficiary_id: "beneficiary-1",
      stage_id: "stage-1",
      service_id: "service-1",
      attendance_date: "2026-09-10",
      status: null,
    });

    expect(result.error).toBeNull();
    expect(insertCalls.filter((c) => c.table === "attendance_records")).toHaveLength(0);
    expect(upsertCalls.filter((c) => c.table === "attendance_records")).toHaveLength(0);
  });

  it("batchServantAttendance upserts on (session_id, servant_id) — no duplicate servant rows", async () => {
    const { supabase, upsertCalls, insertCalls } = createMockSupabase([
      { data: [{ servant_id: "servant-1" }], error: null }, // existing
      { data: null, error: null }, // upsert result
    ]);

    const result = await batchServantAttendance(supabase, {
      churchId: "church-1",
      serviceId: "service-1",
      stageId: "stage-1",
      attendanceDate: "2026-09-11",
      records: [
        { servant_id: "servant-1", status: "absent", notes: "sick" },
        { servant_id: "servant-2", status: "present" },
      ],
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ created: 1, updated: 1 });
    expect(insertCalls.filter((c) => c.table === "attendance_records")).toHaveLength(0);

    const recordUpserts = upsertCalls.filter((c) => c.table === "attendance_records");
    expect(recordUpserts).toHaveLength(1);
    expect(recordUpserts[0].opts).toEqual({ onConflict: "session_id,servant_id" });
    const rows = recordUpserts[0].rows as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ servant_id: "servant-1", status: "absent", notes: "sick" }),
        expect.objectContaining({ servant_id: "servant-2", status: "present" }),
      ]),
    );
  });

  it("listServantAttendanceHistory orders the embedded session by referencedTable (PGRST100 regression)", async () => {
    const { supabase, orderCalls } = createMockSupabase([
      { data: [{ session_id: "s-1", status: "present", attendance_sessions: { session_date: "2026-09-11" } }], error: null },
    ]);

    const result = await listServantAttendanceHistory(supabase, {
      churchId: "church-1",
      stageId: "stage-1",
      limit: 10,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      expect.objectContaining({ sessionDate: "2026-09-11", present: 1, absent: 0, excused: 0 }),
    ]);

    // PostgREST rejects dotted embedded order paths ("failed to parse order")
    // — the order must target the embedded relation via referencedTable.
    const order = orderCalls.find((c) => c.table === "attendance_records");
    expect(order?.col).toBe("session_date");
    expect(order?.opts).toMatchObject({ referencedTable: "attendance_sessions", ascending: false });
  });
});

describe("aggregateDailyAttendance — reports by day, one count per attendee per day", () => {
  const base = {
    serviceName: "Primary",
    stageName: "Grade 6",
    recordedByName: "Manager",
    recordedAt: "2026-09-10T10:00:00Z",
  };

  const row = (overrides: Partial<DailyAttendanceInput>): DailyAttendanceInput => ({
    sessionDate: "2026-09-10",
    beneficiaryId: "b-1",
    beneficiaryName: "Ahmed",
    status: "present",
    ...base,
    ...overrides,
  });

  it("groups records by day and tallies final statuses", () => {
    const days = aggregateDailyAttendance([
      row({ sessionDate: "2026-09-10", beneficiaryId: "b-1", beneficiaryName: "Ahmed", status: "present" }),
      row({ sessionDate: "2026-09-10", beneficiaryId: "b-2", beneficiaryName: "Mina", status: "absent" }),
      row({ sessionDate: "2026-09-10", beneficiaryId: "b-3", beneficiaryName: "John", status: "excused" }),
      row({ sessionDate: "2026-09-11", beneficiaryId: "b-1", beneficiaryName: "Ahmed", status: "absent" }),
    ]);

    expect(days).toHaveLength(2);
    expect(days[0].sessionDate).toBe("2026-09-11"); // newest first
    expect(days[0]).toMatchObject({ total: 1, present: 0, absent: 1, excused: 0 });
    expect(days[1]).toMatchObject({
      sessionDate: "2026-09-10",
      total: 3,
      present: 1,
      absent: 1,
      excused: 1,
      rate: (1 / 3) * 100,
    });
    expect(days[1].records).toHaveLength(3);
  });

  it("counts a repeated status change for the SAME day only once (final record wins)", () => {
    // Simulates legacy duplicates that could slip past the DB invariant:
    // the same beneficiary appearing twice in one day must count once.
    const days = aggregateDailyAttendance([
      row({ status: "absent" }),
      row({ status: "present" }),
    ]);

    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ total: 1, present: 1, absent: 0, excused: 0 });
    expect(days[0].records).toHaveLength(1);
    expect(days[0].records[0].status).toBe("present");
  });

  it("keeps the same beneficiary's records in SEPARATE days separate", () => {
    const days = aggregateDailyAttendance([
      row({ sessionDate: "2026-09-10", status: "present" }),
      row({ sessionDate: "2026-09-11", status: "absent" }),
    ]);

    expect(days).toHaveLength(2);
    const day10 = days.find((d) => d.sessionDate === "2026-09-10");
    const day11 = days.find((d) => d.sessionDate === "2026-09-11");
    expect(day10?.present).toBe(1);
    expect(day11?.absent).toBe(1);
  });
});
