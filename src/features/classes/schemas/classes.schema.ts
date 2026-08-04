import { z } from "zod";

export const createClassSchema = z.object({
  stage_id: z.string().uuid({ message: "Stage is required" }),
  name_ar: z.string().min(2, { message: "Arabic name is required" }),
  name_en: z.string().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const updateClassSchema = z.object({
  stage_id: z.string().uuid({ message: "Stage is required" }),
  name_ar: z.string().min(2, { message: "Arabic name is required" }),
  name_en: z.string().optional(),
  sort_order: z.number().int().min(0),
  is_active: z.boolean(),
});

export type CreateClassFormValues = z.infer<typeof createClassSchema>;
export type UpdateClassFormValues = z.infer<typeof updateClassSchema>;
