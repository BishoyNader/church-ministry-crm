import { z } from "zod";

export const userImportRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  email: z.string().email(),
  password: z.string().min(8),
  fullNameAr: z.string().min(2),
  fullNameEn: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  roleName: z.string().nullable().optional(),
  stageName: z.string().nullable().optional(),
  serviceName: z.string().nullable().optional(),
});

export const previewUsersImportSchema = z.object({
  fileName: z.string().min(1),
  format: z.enum(["xlsx", "csv"]),
  content: z.string().min(1),
  churchId: z.string().uuid(),
});

export const importUsersSchema = z.object({
  churchId: z.string().uuid(),
  rows: z.array(userImportRowSchema).min(1).max(200),
});

export type UserImportRowFormValues = z.infer<typeof userImportRowSchema>;
export type PreviewUsersImportFormValues = z.infer<
  typeof previewUsersImportSchema
>;
export type ImportUsersFormValues = z.infer<typeof importUsersSchema>;
