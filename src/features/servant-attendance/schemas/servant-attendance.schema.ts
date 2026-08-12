import { z } from "zod";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const servantAttendanceRecordSchema = z.object({
  servant_id: z.string().uuid({ message: "Servant is required" }),
  status: z.enum(["present", "absent", "excused"]),
  notes: z.string().max(500).optional(),
});

export const batchServantAttendanceSchema = z.object({
  service_id: z.string().uuid({ message: "Service is required" }),
  stage_id: z.string().uuid({ message: "Stage is required" }),
  attendance_date: z.string().regex(isoDateRegex, {
    message: "Date must be in YYYY-MM-DD format",
  }),
  records: z
    .array(servantAttendanceRecordSchema)
    .min(1, { message: "At least one attendance record is required" }),
});

export const servantAttendanceListSchema = z.object({
  service_id: z.string().uuid().optional(),
  stage_id: z.string().uuid().optional(),
  attendance_date: z.string().regex(isoDateRegex).optional(),
});

export const servantAttendanceHistorySchema = z.object({
  stage_id: z.string().uuid({ message: "Stage is required" }),
});

export type BatchServantAttendanceFormValues = z.infer<
  typeof batchServantAttendanceSchema
>;
export type ServantAttendanceListFormValues = z.infer<
  typeof servantAttendanceListSchema
>;
export type ServantAttendanceRecordFormValues = z.infer<
  typeof servantAttendanceRecordSchema
>;
