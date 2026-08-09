import { describe, expect, it } from "vitest";
import {
  buildBeneficiariesTemplate,
  buildImportErrorsFile,
  toCsv,
  validateBeneficiaryRows,
  validateImportFileMeta,
} from "@/features/import-export/services/import-export.service";
import type {
  BeneficiaryImportRow,
  ImportErrorFileRow,
} from "@/features/import-export/types/import-export.types";

describe("buildBeneficiariesTemplate (CSV)", () => {
  const result = buildBeneficiariesTemplate("csv");

  it("returns a CSV file with the expected file name", () => {
    expect(result.fileName).toBe("children-import-template.csv");
    expect(result.mimeType).toContain("text/csv");
  });

  it("includes the expected headers", () => {
    const lines = result.content.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, ""));
    expect(headers).toEqual([
      "name",
      "phone",
      "birth_date",
      "gender",
      "stage",
      "class",
      "address",
      "notes",
    ]);
  });

  it("includes an example row with the required format", () => {
    const lines = result.content.trim().split("\n");
    expect(lines.length).toBe(2);
    const example = lines[1].split(",").map((v) => v.replace(/^"|"$/g, ""));
    expect(example[0]).toBe("اسم المستفيد");
    expect(example[2]).toBe("2015-05-01");
    expect(example[3]).toBe("male");
  });
});

describe("buildBeneficiariesTemplate (XLSX)", () => {
  const result = buildBeneficiariesTemplate("xlsx");

  it("returns an XLSX file with the expected file name and MIME type", () => {
    expect(result.fileName).toBe("children-import-template.xlsx");
    expect(result.mimeType).toContain("spreadsheetml");
  });

  it("produces base64 content", () => {
    expect(result.content).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });
});

describe("buildImportErrorsFile (CSV)", () => {
  const rows: ImportErrorFileRow[] = [
    {
      rowNumber: 2,
      values: { name: "طفل تجريبي", phone: "01000000000" },
      messages: ["Name is required."],
    },
    {
      rowNumber: 3,
      values: { name: "طفل آخر", birth_date: "12/13/2020" },
      messages: ["Invalid date format. Use YYYY-MM-DD."],
    },
  ];

  const result = buildImportErrorsFile("errors.csv", "csv", rows);

  it("returns a CSV file with row and errors columns", () => {
    expect(result.fileName).toBe("errors.csv");
    const headers = result.content.trim().split("\n")[0].split(",").map((h) => h.replace(/^"|"$/g, ""));
    expect(headers).toContain("row");
    expect(headers).toContain("name");
    expect(headers).toContain("phone");
    expect(headers).toContain("birth date");
    expect(headers).toContain("errors");
  });

  it("echoes the original values and messages per row", () => {
    const lines = result.content.trim().split("\n");
    expect(lines.length).toBe(3); // header + 2 rows
    expect(result.content).toContain("2");
    expect(result.content).toContain("طفل تجريبي");
    expect(result.content).toContain("Name is required.");
    expect(result.content).toContain("3");
    expect(result.content).toContain("Invalid date format.");
  });
});

describe("buildImportErrorsFile (XLSX)", () => {
  const rows: ImportErrorFileRow[] = [
    {
      rowNumber: 2,
      values: { name: "مخدوم" },
      messages: ["Duplicate name found in the file."],
    },
  ];

  const result = buildImportErrorsFile("children-import-errors.xlsx", "xlsx", rows);

  it("returns an XLSX file with the expected MIME type", () => {
    expect(result.fileName).toBe("children-import-errors.xlsx");
    expect(result.mimeType).toContain("spreadsheetml");
    expect(result.content).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });
});

describe("toCsv", () => {
  it("escapes commas and quotes", () => {
    const csv = toCsv(["name", "notes"], [{ name: "Ali, Mohamed", notes: 'He said "hi"' }]);
    expect(csv).toContain('"Ali, Mohamed"');
    expect(csv).toContain('"He said ""hi"""');
  });

  it("produces only a header row for an empty dataset", () => {
    const csv = toCsv(["a", "b"], []);
    expect(csv).toBe("a,b");
  });

  it("handles Arabic text without corruption", () => {
    const csv = toCsv(["name"], [{ name: "مخدوم تجريبي" }]);
    expect(csv).toContain("مخدوم تجريبي");
  });
});

describe("validateBeneficiaryRows", () => {
  it("reports valid rows correctly", () => {
    const rows: BeneficiaryImportRow[] = [
      { rowNumber: 2, name: "مخدوم", phone: "01000000000", birthDate: null, gender: "male", stage: null, className: null, address: null, notes: null },
      { rowNumber: 3, name: "مخدومة", phone: "01000000001", birthDate: "2010-01-01", gender: "female", stage: "الإعداد", className: null, address: null, notes: null },
    ];
    const result = validateBeneficiaryRows(rows);
    expect(result.validRows).toHaveLength(2);
    expect(result.invalidRows).toHaveLength(0);
    expect(result.errorSummary.validCount).toBe(2);
    expect(result.errorSummary.invalidCount).toBe(0);
  });

  it("flags missing required fields and reports the row number", () => {
    const rows: BeneficiaryImportRow[] = [
      { rowNumber: 2, name: " ", phone: null, birthDate: null, gender: null, stage: null, className: null, address: null, notes: null },
    ];
    const result = validateBeneficiaryRows(rows);
    expect(result.invalidRows).toHaveLength(1);
    expect(
      result.invalidRows[0].errors.some(
        (e: { field: string }) => e.field === "name",
      ),
    ).toBe(true);
    expect(result.invalidRows[0].row.rowNumber).toBe(2);
    expect(result.errorSummary.missingRequired).toBe(1);
  });

  it("flags duplicate names within the file", () => {
    const rows: BeneficiaryImportRow[] = [
      { rowNumber: 2, name: "مخدوم", phone: "01000000000", birthDate: null, gender: "male", stage: null, className: null, address: null, notes: null },
      { rowNumber: 3, name: "مخدوم", phone: "01000000001", birthDate: null, gender: "male", stage: null, className: null, address: null, notes: null },
    ];
    const result = validateBeneficiaryRows(rows);
    expect(result.errorSummary.duplicateNames).toBe(2);
  });

  it("flags invalid gender values", () => {
    const rows: BeneficiaryImportRow[] = [
      { rowNumber: 2, name: "مخدوم", phone: null, birthDate: null, gender: "other", stage: null, className: null, address: null, notes: null },
    ];
    const result = validateBeneficiaryRows(rows);
    expect(result.errorSummary.invalidGenders).toBe(1);
    expect(
      result.invalidRows[0].errors.some(
        (e: { field: string }) => e.field === "gender",
      ),
    ).toBe(true);
  });
});

describe("validateImportFileMeta", () => {
  it("accepts a valid CSV file", () => {
    expect(validateImportFileMeta("data.csv", "name,phone\nAli,010")).toEqual({ ok: true });
  });

  it("rejects an unsupported file type", () => {
    const result = validateImportFileMeta("data.txt", "hello");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_FILE_TYPE");
  });

  it("rejects a file that exceeds the size limit", () => {
    // "a".repeat would be interpreted as base64 (all-chars valid, length % 4 === 0),
    // so use a non-base64 payload to exercise the UTF-8 10 MB ceiling.
    const oversized = `${"a".repeat(10 * 1024 * 1024)}!`; // >10 MB, non-base64
    const result = validateImportFileMeta("data.csv", oversized);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FILE_TOO_LARGE");
  });
});