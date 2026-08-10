import { z } from "zod";

const eventTypeEnum = z.enum(["meeting", "camp", "conference", "trip", "other"]);

const eventBaseSchema = {
  title_ar: z.string().min(2, { message: "Arabic title is required" }),
  title_en: z.string().optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  location_ar: z.string().optional(),
  event_type: eventTypeEnum,
  service_id: z.string().min(1, { message: "Service is required" }),
  stage_id: z.string().optional().nullable(),
  start_at: z.string().min(1, { message: "Start date is required" }),
  end_at: z.string().optional().nullable(),
  capacity: z.number().int().min(0).optional().nullable(),
};

export const createEventSchema = z.object({
  ...eventBaseSchema,
});

export const updateEventSchema = z.object({
  ...eventBaseSchema,
  is_active: z.boolean(),
});

export type CreateEventFormValues = z.infer<typeof createEventSchema>;
export type UpdateEventFormValues = z.infer<typeof updateEventSchema>;
