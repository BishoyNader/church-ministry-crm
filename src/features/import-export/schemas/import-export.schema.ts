import { z } from "zod";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const beneficiaryImportRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  name: z.string().min(1, { message: "Name is required" }),
  phone: z.string().nullable().optional(),
  birthDate: z
    .string()
    .regex(isoDateRegex, { message: "Date must be in YYYY-MM-DD format" })
    .nullable()
    .optional(),
  gender: z.enum(["male", "female"]).nullable().optional(),
  stage: z.string().nullable().optional(),
  className: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const importPreviewSchema = z.object({
  fileName: z.string().min(1),
  format: z.enum(["xlsx", "csv"]),
  content: z.string().min(1, { message: "File content is required" }),
  // Explicit target church — required for the PO (church_id NULL), ignored and
  // forced to the actor's own church for church-scoped users.
  churchId: z.string().uuid().optional(),
});

export const importBeneficiariesSchema = z.object({
  rows: z.array(beneficiaryImportRowSchema).min(1, { message: "At least one row is required" }),
  churchId: z.string().uuid().optional(),
});

export const exportOptionsSchema = z.object({
  entity: z.enum(["beneficiaries", "attendance", "followups", "servants"]),
  format: z.enum(["csv", "xlsx"]),
  churchId: z.string().uuid().optional(),
  filters: z
    .object({
      search: z.string().max(200).optional(),
      status: z.enum(["active", "inactive", "transferred", "graduated"]).optional(),
      service_id: z.string().uuid().optional(),
      stage_id: z.string().uuid().optional(),
    })
    .optional(),
});

export type BeneficiaryImportRowFormValues = z.infer<typeof beneficiaryImportRowSchema>;
export type ImportPreviewFormValues = z.infer<typeof importPreviewSchema>;
export type ImportBeneficiariesFormValues = z.infer<typeof importBeneficiariesSchema>;
export type ExportOptionsFormValues = z.infer<typeof exportOptionsSchema>;