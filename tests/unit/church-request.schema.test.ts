import { describe, expect, it } from "vitest";
import { churchRequestSchema } from "@/features/churches/schemas/church-request.schema";

describe("churchRequestSchema", () => {
  const valid = {
    churchNameAr: "كنيسة القديس مرقس",
    catechistName: "خادم",
    applicantName: "مقدم الطلب",
    email: "applicant@church.org",
    phone: "+201234567890",
    notes: "",
  };

  it("accepts a valid church request", () => {
    expect(churchRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an empty optional phone", () => {
    expect(churchRequestSchema.safeParse({ ...valid, phone: "" }).success).toBe(
      true,
    );
  });

  it("rejects a church name shorter than 2 characters", () => {
    const result = churchRequestSchema.safeParse({ ...valid, churchNameAr: "أ" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = churchRequestSchema.safeParse({ ...valid, email: "bad" });
    expect(result.success).toBe(false);
  });

  it("rejects notes longer than 1000 characters", () => {
    const result = churchRequestSchema.safeParse({
      ...valid,
      notes: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});
