import { describe, expect, it } from "vitest";
import {
  batchServantAttendanceSchema,
  servantAttendanceHistorySchema,
  servantAttendanceListSchema,
} from "@/features/servant-attendance/schemas/servant-attendance.schema";

const UUID = "00000000-0000-4000-8000-000000000000";

describe("batchServantAttendanceSchema", () => {
  const valid = {
    service_id: UUID,
    stage_id: UUID,
    attendance_date: "2026-08-12",
    records: [{ servant_id: UUID, status: "present", notes: "early" }],
  };

  it("accepts a valid payload", () => {
    expect(batchServantAttendanceSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a non-uuid servant reference", () => {
    const result = batchServantAttendanceSchema.safeParse({
      ...valid,
      records: [{ servant_id: "not-a-uuid", status: "present" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid attendance status", () => {
    const result = batchServantAttendanceSchema.safeParse({
      ...valid,
      records: [{ servant_id: UUID, status: "unknown" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed attendance date", () => {
    const result = batchServantAttendanceSchema.safeParse({
      ...valid,
      attendance_date: "12/08/2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty records array", () => {
    const result = batchServantAttendanceSchema.safeParse({
      ...valid,
      records: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts records without notes", () => {
    const result = batchServantAttendanceSchema.safeParse({
      ...valid,
      records: [{ servant_id: UUID, status: "absent" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("servantAttendanceListSchema", () => {
  it("accepts a fully-specified query", () => {
    expect(
      servantAttendanceListSchema.safeParse({
        service_id: UUID,
        stage_id: UUID,
        attendance_date: "2026-08-12",
      }).success,
    ).toBe(true);
  });

  it("accepts an empty query (selectors not chosen yet)", () => {
    expect(servantAttendanceListSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a malformed date", () => {
    expect(
      servantAttendanceListSchema.safeParse({ attendance_date: "2026/08/12" })
        .success,
    ).toBe(false);
  });
});

describe("servantAttendanceHistorySchema", () => {
  it("accepts a valid stage id", () => {
    expect(
      servantAttendanceHistorySchema.safeParse({ stage_id: UUID }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid stage id", () => {
    expect(
      servantAttendanceHistorySchema.safeParse({ stage_id: "x" }).success,
    ).toBe(false);
  });
});
