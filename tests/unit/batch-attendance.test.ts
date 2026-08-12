import { describe, expect, it, vi } from "vitest";
import { batchAttendance } from "@/features/children/services/child.service";

type UpsertCall = { table: string; rows: unknown[]; opts?: unknown };

function createMockSupabase() {
  const upsertCalls: UpsertCall[] = [];

  const buildChain = (table: string) => {
    let upserted = false;

    const respond = () => {
      if (upserted) {
        // The attendance_sessions upsert is chained with .select("id").single()
        // in the service, so it must return the inserted session row.
        if (table === "attendance_sessions") {
          return { data: { id: "session-1" }, error: null };
        }
        return { data: null, error: null };
      }
      if (table === "profiles") {
        return { data: { church_id: "church-1" }, error: null };
      }
      if (table === "attendance_sessions") {
        return { data: { id: "session-1" }, error: null };
      }
      if (table === "attendance_records") {
        // The first select returns the existing beneficiaries.
        return { data: [{ beneficiary_id: "beneficiary-1" }], error: null };
      }
      return { data: [], error: null };
    };

    const promise = Promise.resolve().then(respond);

    const chain: unknown = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === "then") return promise.then.bind(promise);
        if (prop === "catch") return promise.catch.bind(promise);
        if (prop === "finally") return promise.finally.bind(promise);
        if (prop === "upsert") {
          return (rows: unknown[], opts?: unknown) => {
            upserted = true;
            upsertCalls.push({ table, rows, opts });
            return chain;
          };
        }
        return () => chain;
      },
    });

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
  };
}

describe("batchAttendance", () => {
  it("performs a single multi-row upsert instead of per-record requests", async () => {
    const { supabase, upsertCalls } = createMockSupabase();

    const result = await batchAttendance(supabase, {
      service_id: "service-1",
      stage_id: "stage-1",
      attendance_date: "2026-08-06",
      records: [
        { beneficiary_id: "beneficiary-1", status: "present" },
        { beneficiary_id: "beneficiary-2", status: "absent", notes: "sick" },
      ],
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ created: 1, updated: 1 });

    // Exactly ONE multi-row attendance_records upsert with both rows and
    // the right conflict target — the unique constraint introduced in
    // migration 048 is (session_id, beneficiary_id).
    const recordUpserts = upsertCalls.filter((u) => u.table === "attendance_records");
    expect(recordUpserts).toHaveLength(1);
    const { rows, opts } = recordUpserts[0];
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ beneficiary_id: "beneficiary-1", status: "present" }),
        expect.objectContaining({ beneficiary_id: "beneficiary-2", status: "absent", notes: "sick" }),
      ]),
    );
    expect(opts).toEqual({ onConflict: "session_id,beneficiary_id" });
  });
});
