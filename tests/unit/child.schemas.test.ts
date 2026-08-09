import { describe, expect, it } from "vitest";
import {
  batchAttendanceSchema,
  createAttendanceSchema,
  createChildSchema,
  createFollowupSchema,
  updateFollowupSchema,
} from "@/features/children/schemas/child.schema";

const UUID = "00000000-0000-4000-8000-000000000000";

describe("createChildSchema", () => {
  const valid = {
    full_name_ar: "مخدوم",
    service_id: UUID,
    stage_id: UUID,
  };

  it("accepts a valid payload", () => {
    expect(createChildSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing Arabic name", () => {
    const result = createChildSchema.safeParse({ ...valid, full_name_ar: " " });
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid service/stage references", () => {
    const result = createChildSchema.safeParse({
      ...valid,
      service_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed date of birth", () => {
    const result = createChildSchema.safeParse({
      ...valid,
      date_of_birth: "01/02/2020",
    });
    expect(result.success).toBe(false);
  });
});

describe("createAttendanceSchema", () => {
  it("accepts a valid record", () => {
    expect(
      createAttendanceSchema.safeParse({
        beneficiary_id: UUID,
        stage_id: UUID,
        service_id: UUID,
        attendance_date: "2026-08-01",
        status: "present",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid attendance status", () => {
    const result = createAttendanceSchema.safeParse({
      beneficiary_id: UUID,
      stage_id: UUID,
      service_id: UUID,
      attendance_date: "2026-08-01",
      status: "maybe",
    });
    expect(result.success).toBe(false);
  });
});

describe("batchAttendanceSchema", () => {
  it("rejects an empty record list", () => {
    const result = batchAttendanceSchema.safeParse({
      stage_id: UUID,
      service_id: UUID,
      attendance_date: "2026-08-01",
      records: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts multiple records", () => {
    expect(
      batchAttendanceSchema.safeParse({
        stage_id: UUID,
        service_id: UUID,
        attendance_date: "2026-08-01",
        records: [
          { beneficiary_id: UUID, status: "present" },
          { beneficiary_id: UUID, status: "absent", notes: "sick" },
        ],
      }).success,
    ).toBe(true);
  });
});

describe("createFollowupSchema", () => {
  it("accepts a valid follow-up", () => {
    expect(
      createFollowupSchema.safeParse({
        beneficiary_id: UUID,
        type: "phone_call",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown follow-up type", () => {
    const result = createFollowupSchema.safeParse({
      beneficiary_id: UUID,
      type: "email",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateFollowupSchema", () => {
  it("accepts a status transition", () => {
    expect(
      updateFollowupSchema.safeParse({ status: "completed", outcome: "met" }).success,
    ).toBe(true);
  });

  it("rejects an unknown status value", () => {
    const result = updateFollowupSchema.safeParse({ status: "weird" });
    expect(result.success).toBe(false);
  });
});
