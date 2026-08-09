import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/features/auth/schemas/auth.schema";

describe("loginSchema", () => {
  it("accepts a valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "servant@church.org",
      password: "supersecret1",
      remember: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "supersecret1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "email")).toBe(true);
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = loginSchema.safeParse({
      email: "servant@church.org",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  const valid = {
    churchId: "00000000-0000-4000-8000-000000000000",
    fullNameAr: "خادم",
    email: "servant@church.org",
    phone: "+201234567890",
    password: "supersecret1",
    confirmPassword: "supersecret1",
  };

  it("accepts a valid signup payload", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = signupSchema.safeParse({ ...valid, confirmPassword: "different1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path[0] === "confirmPassword"),
      ).toBe(true);
    }
  });

  it("rejects a missing church selection", () => {
    const result = signupSchema.safeParse({ ...valid, churchId: "" });
    expect(result.success).toBe(false);
  });

  it("allows an empty optional phone", () => {
    expect(signupSchema.safeParse({ ...valid, phone: "" }).success).toBe(true);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.org" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching strong passwords", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "supersecret1",
        confirmPassword: "supersecret1",
      }).success,
    ).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "supersecret1",
        confirmPassword: "supersecret2",
      }).success,
    ).toBe(false);
  });
});
