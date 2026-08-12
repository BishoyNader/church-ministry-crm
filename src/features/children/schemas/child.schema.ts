import { z } from "zod";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const optionalIsoDate = z
  .string()
  .regex(isoDateRegex, { message: "Date must be in YYYY-MM-DD format" })
  .optional();

const optionalUrl = z
  .string()
  .url({ message: "Must be a valid URL" })
  .optional()
  .or(z.literal(""));

export const createChildSchema = z.object({
  full_name_ar: z.string().min(2, { message: "Arabic full name is required" }),
  full_name_en: z.string().optional(),
  date_of_birth: optionalIsoDate,
  gender: z.enum(["male", "female"]).optional(),
  service_id: z.string().uuid({ message: "Service is required" }),
  stage_id: z.string().uuid({ message: "Stage is required" }),
  father_mobile: z.string().optional(),
  mother_mobile: z.string().optional(),
  mobile: z.string().optional(),
  whatsapp: z.string().optional(),
  address: z.string().optional(),
  school: z.string().optional(),
  confession_father: z.string().optional(),
  notes: z.string().optional(),
  photo_url: optionalUrl,
});

export const updateChildSchema = z.object({
  full_name_ar: z.string().min(2, { message: "Arabic full name is required" }),
  full_name_en: z.string().optional(),
  date_of_birth: optionalIsoDate,
  gender: z.enum(["male", "female"]).optional(),
  service_id: z.string().uuid({ message: "Service is required" }),
  stage_id: z.string().uuid({ message: "Stage is required" }),
  status: z.string(),
  father_mobile: z.string().optional(),
  mother_mobile: z.string().optional(),
  mobile: z.string().optional(),
  whatsapp: z.string().optional(),
  address: z.string().optional(),
  school: z.string().optional(),
  confession_father: z.string().optional(),
  notes: z.string().optional(),
  photo_url: optionalUrl,
});

export const transferChildSchema = z.object({
  service_id: z.string().uuid({ message: "Service is required" }),
  stage_id: z.string().uuid({ message: "Stage is required" }),
});

export const createAttendanceSchema = z.object({
  beneficiary_id: z.string().uuid({ message: "Beneficiary is required" }),
  stage_id: z.string().uuid({ message: "Stage is required" }),
  service_id: z.string().uuid({ message: "Service is required" }),
  attendance_date: z.string().regex(isoDateRegex, { message: "Date must be in YYYY-MM-DD format" }),
  status: z.enum(["present", "absent", "excused"]),
  notes: z.string().optional(),
});

export const batchAttendanceSchema = z.object({
  stage_id: z.string().uuid({ message: "Stage is required" }),
  service_id: z.string().uuid({ message: "Service is required" }),
  attendance_date: z.string().regex(isoDateRegex, { message: "Date must be in YYYY-MM-DD format" }),
  records: z
    .array(
      z.object({
        beneficiary_id: z.string().uuid(),
        status: z.enum(["present", "absent", "excused"]),
        notes: z.string().optional(),
      }),
    )
    .min(1, { message: "At least one attendance record is required" }),
});

export const toggleAttendanceSchema = z.object({
  beneficiary_id: z.string().uuid({ message: "Beneficiary is required" }),
  stage_id: z.string().uuid({ message: "Stage is required" }),
  service_id: z.string().uuid({ message: "Service is required" }),
  attendance_date: z.string().regex(isoDateRegex, { message: "Date must be in YYYY-MM-DD format" }),
  status: z.enum(["present", "absent", "excused"]).nullable(),
});

export const createFollowupSchema = z.object({
  beneficiary_id: z.string().uuid({ message: "Beneficiary is required" }),
  type: z.enum(["phone_call", "home_visit", "whatsapp", "church_meeting", "other"]),
  scheduled_at: optionalIsoDate,
  assigned_to: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export const updateFollowupSchema = z.object({
  status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional(),
  outcome: z.string().optional(),
  notes: z.string().optional(),
  assigned_to: z.string().uuid().optional().or(z.literal("")),
  scheduled_at: optionalIsoDate,
});

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const uuidParamSchema = z.string().uuid({ message: "Invalid ID format" });

export type CreateChildFormValues = z.infer<typeof createChildSchema>;
export type UpdateChildFormValues = z.infer<typeof updateChildSchema>;
export type TransferChildFormValues = z.infer<typeof transferChildSchema>;
export type CreateAttendanceFormValues = z.infer<typeof createAttendanceSchema>;
export type BatchAttendanceFormValues = z.infer<typeof batchAttendanceSchema>;
export type ToggleAttendanceFormValues = z.infer<typeof toggleAttendanceSchema>;
export type CreateFollowupFormValues = z.infer<typeof createFollowupSchema>;
export type UpdateFollowupFormValues = z.infer<typeof updateFollowupSchema>;
