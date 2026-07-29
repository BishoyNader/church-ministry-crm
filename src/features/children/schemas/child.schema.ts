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

const optionalEmail = z
  .string()
  .email({ message: "Invalid email" })
  .optional()
  .or(z.literal(""));

export const createChildSchema = z.object({
  first_name_ar: z.string().min(2, { message: "Arabic first name is required" }),
  first_name_en: z.string().optional(),
  last_name_ar: z.string().min(2, { message: "Arabic last name is required" }),
  last_name_en: z.string().optional(),
  date_of_birth: optionalIsoDate,
  gender: z.enum(["male", "female"]).optional(),
  ministry_id: z.string().uuid({ message: "Ministry is required" }),
  stage_id: z.string().uuid({ message: "Stage is required" }),
  pipeline_stage: z
    .enum(["new_visitor", "first_followup", "regular_attendee", "active_member", "leader_candidate"])
    .optional(),
  parent_phone: z.string().optional(),
  parent_email: optionalEmail,
  parent_address_ar: z.string().optional(),
  father_name_ar: z.string().optional(),
  mother_name_ar: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  mobile: z.string().optional(),
  allergies: z.string().optional(),
  medical_conditions: z.string().optional(),
  medications: z.string().optional(),
  baptism_date: optionalIsoDate,
  confession_frequency: z.string().optional(),
  spiritual_notes: z.string().optional(),
  school_name_ar: z.string().optional(),
  grade_level: z.string().optional(),
  notes: z.string().optional(),
  photo_url: optionalUrl,
});

export const updateChildSchema = z.object({
  first_name_ar: z.string().min(2, { message: "Arabic first name is required" }),
  first_name_en: z.string().optional(),
  last_name_ar: z.string().min(2, { message: "Arabic last name is required" }),
  last_name_en: z.string().optional(),
  date_of_birth: optionalIsoDate,
  gender: z.enum(["male", "female"]).optional(),
  ministry_id: z.string().uuid({ message: "Ministry is required" }),
  stage_id: z.string().uuid({ message: "Stage is required" }),
  pipeline_stage: z.enum(["new_visitor", "first_followup", "regular_attendee", "active_member", "leader_candidate"]),
  status: z.enum(["active", "inactive", "transferred", "graduated"]),
  parent_phone: z.string().optional(),
  parent_email: optionalEmail,
  parent_address_ar: z.string().optional(),
  father_name_ar: z.string().optional(),
  mother_name_ar: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  mobile: z.string().optional(),
  allergies: z.string().optional(),
  medical_conditions: z.string().optional(),
  medications: z.string().optional(),
  baptism_date: optionalIsoDate,
  confession_frequency: z.string().optional(),
  spiritual_notes: z.string().optional(),
  school_name_ar: z.string().optional(),
  grade_level: z.string().optional(),
  notes: z.string().optional(),
  photo_url: optionalUrl,
});

export const transferChildSchema = z.object({
  ministry_id: z.string().uuid({ message: "Ministry is required" }),
  stage_id: z.string().uuid({ message: "Stage is required" }),
});

export const createAttendanceSchema = z.object({
  child_id: z.string().uuid({ message: "Beneficiary is required" }),
  stage_id: z.string().uuid({ message: "Stage is required" }),
  attendance_date: z.string().regex(isoDateRegex, { message: "Date must be in YYYY-MM-DD format" }),
  status: z.enum(["present", "absent", "excused"]),
  notes: z.string().optional(),
});

export const batchAttendanceSchema = z.object({
  stage_id: z.string().uuid({ message: "Stage is required" }),
  attendance_date: z.string().regex(isoDateRegex, { message: "Date must be in YYYY-MM-DD format" }),
  records: z
    .array(
      z.object({
        child_id: z.string().uuid(),
        status: z.enum(["present", "absent", "excused"]),
        notes: z.string().optional(),
      }),
    )
    .min(1, { message: "At least one attendance record is required" }),
});

export const createFollowupSchema = z.object({
  child_id: z.string().uuid({ message: "Beneficiary is required" }),
  stage_id: z.string().uuid({ message: "Stage is required" }),
  type: z.enum(["phone_call", "home_visit", "whatsapp", "church_meeting", "other"]),
  scheduled_at: optionalIsoDate,
  assigned_to: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export const updateFollowupSchema = z.object({
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
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
export type CreateFollowupFormValues = z.infer<typeof createFollowupSchema>;
export type UpdateFollowupFormValues = z.infer<typeof updateFollowupSchema>;
