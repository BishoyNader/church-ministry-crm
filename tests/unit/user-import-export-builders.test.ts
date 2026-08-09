import { describe, expect, it } from "vitest";
import {
  buildUserImportTemplate,
  validateUserImportRows,
  resolveUserImportRow,
  parseUserImportFile,
} from "@/features/users/services/user-import.service";
import type {
  UserImportRoleOption,
  UserImportStageOption,
} from "@/features/users/services/user-import.service";
import { buildUserImportErrorsFile } from "@/features/users/services/user-export.service";
import type {
  UserImportRow,
} from "@/features/users/types/user-import.types";
import type { ImportErrorFileRow } from "@/features/import-export/types/import-export.types";

const roleOptions: UserImportRoleOption[] = [
  { id: "r-super", name_ar: "مدير الكنيسة", name_en: "Church Manager", role_type: "super_admin" },
  { id: "r-admin", name_ar: "مدير الخدمة", name_en: "Admin", role_type: "admin" },
  { id: "r-stage", name_ar: "مدير المرحلة", name_en: "Stage Manager", role_type: "stage_manager" },
  { id: "r-servant", name_ar: "خادم", name_en: "Servant", role_type: "servant" },
];

const stageOptions: UserImportStageOption[] = [
  { id: "s-1", name_ar: "الإعداد", name_en: "Preparation" },
  { id: "s-2", name_ar: "المراهقين", name_en: "Teens" },
];

const makeRow = (overrides: Partial<UserImportRow> = {}): UserImportRow => ({
  rowNumber: 2,
  email: "user@example.com",
  password: "strong-pass-1",
  fullNameAr: "مستخدم تجريبي",
  fullNameEn: "Test User",
  phone: "01000000000",
  roleName: "Church Manager",
  stageName: null,
  ...overrides,
});

describe("buildUserImportTemplate (CSV)", () => {
  const result = buildUserImportTemplate("csv");

  it("returns a CSV file with the expected file name", () => {
    expect(result.fileName).toBe("users-import-template.csv");
    expect(result.mimeType).toContain("text/csv");
  });

  it("includes the expected headers", () => {
    const headers = result.content.trim().split("\n")[0]
      .split(",")
      .map((h) => h.replace(/^"|"$/g, ""));
    expect(headers).toEqual([
      "email",
      "password",
      "full_name_ar",
      "full_name_en",
      "phone",
      "role",
      "stage",
    ]);
  });

  it("includes an example row with the required format", () => {
    const lines = result.content.trim().split("\n");
    expect(lines.length).toBe(2);
    const example = lines[1].split(",").map((v) => v.replace(/^"|"$/g, ""));
    expect(example[0]).toBe("user@example.com");
    expect(example[1]).toBe("a-strong-password");
    expect(example[2]).toBe("اسم المستخدم");
    // The example role must be a value the importer accepts (migration 041
    // labels super_admin as "Church Manager").
    expect(example[5]).toBe("Church Manager");
  });
});

describe("buildUserImportTemplate (XLSX)", () => {
  const result = buildUserImportTemplate("xlsx");

  it("returns an XLSX file with the expected file name and MIME type", () => {
    expect(result.fileName).toBe("users-import-template.xlsx");
    expect(result.mimeType).toContain("spreadsheetml");
  });

  it("produces base64 content", () => {
    expect(result.content).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });
});

describe("validateUserImportRows", () => {
  it("marks valid rows as valid", () => {
    const result = validateUserImportRows(
      [
        makeRow(),
        // Second row uses a non-manager role: only one super_admin row per batch
        // may claim the manager slot (single-Church-Manager invariant).
        makeRow({ rowNumber: 3, email: "second@example.com", roleName: "Admin" }),
      ],
      roleOptions,
      stageOptions,
      [],
    );
    expect(result.validRows).toHaveLength(2);
    expect(result.invalidRows).toHaveLength(0);
    expect(result.errorSummary.validCount).toBe(2);
    expect(result.errorSummary.invalidCount).toBe(0);
  });

  it("rejects an invalid email and reports the field", () => {
    const result = validateUserImportRows(
      [makeRow({ email: "not-an-email" })],
      roleOptions,
      stageOptions,
      [],
    );
    expect(result.invalidRows).toHaveLength(1);
    const errors = result.invalidRows[0].errors;
    expect(errors.some((e) => e.field === "email")).toBe(true);
    expect(errors.some((e) => e.message.includes("valid email"))).toBe(true);
    expect(result.errorSummary.invalidEmails).toBe(1);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = validateUserImportRows(
      [makeRow({ password: "short" })],
      roleOptions,
      stageOptions,
      [],
    );
    expect(result.invalidRows).toHaveLength(1);
    expect(
      result.invalidRows[0].errors.some((e) => e.field === "password"),
    ).toBe(true);
    expect(result.errorSummary.shortPasswords).toBe(1);
  });

  it("requires an Arabic full name", () => {
    const result = validateUserImportRows(
      [makeRow({ fullNameAr: "" })],
      roleOptions,
      stageOptions,
      [],
    );
    expect(result.invalidRows).toHaveLength(1);
    expect(
      result.invalidRows[0].errors.some((e) => e.field === "full_name_ar"),
    ).toBe(true);
    expect(result.errorSummary.missingRequired).toBe(1);
  });

  it("requires a role and validates it against the church catalog", () => {
    const noRole = validateUserImportRows(
      [makeRow({ roleName: null })],
      roleOptions,
      stageOptions,
      [],
    );
    expect(noRole.errorSummary.missingRequired).toBe(1);

    const unknownRole = validateUserImportRows(
      [makeRow({ roleName: "Bishop" })],
      roleOptions,
      stageOptions,
      [],
    );
    expect(unknownRole.errorSummary.unknownRoles).toBe(1);
    expect(
      unknownRole.invalidRows[0].errors.some((e) => e.field === "role"),
    ).toBe(true);
  });

  it("validates a stage name against the church catalog", () => {
    const result = validateUserImportRows(
      [makeRow({ stageName: "غير موجود" })],
      roleOptions,
      stageOptions,
      [],
    );
    expect(result.errorSummary.unknownStages).toBe(1);
    expect(
      result.invalidRows[0].errors.some((e) => e.field === "stage"),
    ).toBe(true);
  });

  it("flags duplicate emails within the file", () => {
    const result = validateUserImportRows(
      [makeRow(), makeRow({ rowNumber: 3 })],
      roleOptions,
      stageOptions,
      [],
    );
    expect(result.errorSummary.duplicateEmails).toBe(1);
  });

  it("flags emails already registered to the church", () => {
    const result = validateUserImportRows(
      [makeRow({ email: "Existing@Example.com" })],
      roleOptions,
      stageOptions,
      ["existing@example.com"],
    );
    expect(result.errorSummary.duplicateEmails).toBe(1);
    expect(result.invalidRows).toHaveLength(1);
  });
});

describe("validateUserImportRows — single Church Manager guard", () => {
  it("rejects a super_admin row when the church already has an active manager", () => {
    const result = validateUserImportRows(
      [makeRow({ roleName: "Church Manager" })],
      roleOptions,
      stageOptions,
      [],
      { activeSuperAdminExists: true },
    );
    expect(result.validRows).toHaveLength(0);
    expect(result.invalidRows).toHaveLength(1);
    expect(result.errorSummary.managerConflicts).toBe(1);
    expect(result.errorSummary.validCount).toBe(0);
    const roleError = result.invalidRows[0].errors.find((e) => e.field === "role");
    expect(roleError?.message).toContain("already has a Church Manager");
  });

  it("allows the first super_admin row when no manager exists, then rejects the next deterministically", () => {
    const result = validateUserImportRows(
      [
        makeRow({ rowNumber: 2, email: "manager-one@example.com" }),
        makeRow({ rowNumber: 3, email: "manager-two@example.com" }),
      ],
      roleOptions,
      stageOptions,
      [],
      { activeSuperAdminExists: false },
    );
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].email).toBe("manager-one@example.com");
    expect(result.invalidRows).toHaveLength(1);
    expect(result.invalidRows[0].row.email).toBe("manager-two@example.com");
    expect(result.errorSummary.managerConflicts).toBe(1);
  });

  it("does not reject non-manager rows for a church that has a manager", () => {
    const result = validateUserImportRows(
      [makeRow({ roleName: "Admin" })],
      roleOptions,
      stageOptions,
      [],
      { activeSuperAdminExists: true },
    );
    expect(result.validRows).toHaveLength(1);
    expect(result.errorSummary.managerConflicts).toBe(0);
  });

  it("accepts a super_admin row when no manager state is provided (backward compatible)", () => {
    const result = validateUserImportRows(
      [makeRow({ roleName: "super_admin" })],
      roleOptions,
      stageOptions,
      [],
    );
    expect(result.validRows).toHaveLength(1);
    expect(result.errorSummary.managerConflicts).toBe(0);
  });
});

describe("resolveUserImportRow", () => {
  it("maps role and stage names to catalog IDs", () => {
    const { roleIds, stageIds } = resolveUserImportRow(
      makeRow({ roleName: "مدير الكنيسة", stageName: "Teens" }),
      roleOptions,
      stageOptions,
    );
    expect(roleIds).toEqual(["r-super"]);
    expect(stageIds).toEqual(["s-2"]);
  });

  it("accepts canonical role_type codes (super_admin/admin/stage_manager/servant)", () => {
    expect(resolveUserImportRow(makeRow({ roleName: "super_admin" }), roleOptions, stageOptions).roleIds)
      .toEqual(["r-super"]);
    expect(resolveUserImportRow(makeRow({ roleName: "ADMIN" }), roleOptions, stageOptions).roleIds)
      .toEqual(["r-admin"]);
    expect(resolveUserImportRow(makeRow({ roleName: "stage_manager" }), roleOptions, stageOptions).roleIds)
      .toEqual(["r-stage"]);
    expect(resolveUserImportRow(makeRow({ roleName: "Servant" }), roleOptions, stageOptions).roleIds)
      .toEqual(["r-servant"]);
  });

  it("returns empty arrays when no match exists", () => {
    const { roleIds, stageIds } = resolveUserImportRow(
      makeRow({ roleName: "Missing", stageName: "Missing" }),
      roleOptions,
      stageOptions,
    );
    expect(roleIds).toEqual([]);
    expect(stageIds).toEqual([]);
  });
});

describe("parseUserImportFile (base64 CSV from the upload client)", () => {
  it("parses base64 CSV content into rows", () => {
    const csv =
      "email,password,full_name_ar,full_name_en,phone,role,stage\n" +
      "user@example.com,a-strong-password,اسم المستخدم,User Name,01000000000,Church Manager,\n";
    const base64 = Buffer.from(csv, "utf8").toString("base64");
    const result = parseUserImportFile(base64, "csv", "users.csv");

    expect(result.error).toBeNull();
    expect(result.data?.rows).toHaveLength(1);
    expect(result.data?.rows[0].email).toBe("user@example.com");
    expect(result.data?.rows[0].roleName).toBe("Church Manager");
  });

  it("still parses plain-text CSV content", () => {
    const csv =
      "email,password,full_name_ar,full_name_en,phone,role,stage\n" +
      "plain@example.com,a-strong-password,اسم عادي,Plain,01111111111,Admin,\n";
    const result = parseUserImportFile(csv, "csv", "users.csv");
    expect(result.error).toBeNull();
    expect(result.data?.rows).toHaveLength(1);
    expect(result.data?.rows[0].email).toBe("plain@example.com");
  });
});

describe("buildUserImportErrorsFile", () => {
  const rows: ImportErrorFileRow[] = [
    {
      rowNumber: 2,
      values: {
        email: "bad@example.com",
        password: "123",
        full_name_ar: "مستخدم",
        role: "Church Manager",
      },
      messages: ["Password must be at least 8 characters."],
    },
    {
      rowNumber: 3,
      values: { email: "not-an-email", full_name_ar: "مستخدم آخر" },
      messages: ['"not-an-email" is not a valid email address.'],
    },
  ];

  it("builds a CSV errors file with row, values, and messages", () => {
    const result = buildUserImportErrorsFile("csv", rows);
    expect(result.fileName).toBe("users-import-errors.csv");
    expect(result.mimeType).toContain("text/csv");

    const headers = result.content.trim().split("\n")[0]
      .split(",")
      .map((h) => h.replace(/^"|"$/g, ""));
    expect(headers).toContain("row");
    expect(headers).toContain("email");
    expect(headers).toContain("full name ar");
    expect(headers).toContain("errors");

    const lines = result.content.trim().split("\n");
    expect(lines.length).toBe(3); // header + 2 failing rows
    expect(result.content).toContain("2");
    expect(result.content).toContain("not-an-email");
    expect(result.content).toContain("Password must be at least 8 characters.");
  });

  it("builds an XLSX errors file", () => {
    const result = buildUserImportErrorsFile("xlsx", rows);
    expect(result.fileName).toBe("users-import-errors.xlsx");
    expect(result.mimeType).toContain("spreadsheetml");
    expect(result.content).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });
});
