import { z } from "zod";

export const createMinistrySchema = z.object({
  name_ar: z.string().min(2, { message: "Arabic name is required" }),
  name_en: z.string().optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const updateMinistrySchema = z.object({
  name_ar: z.string().min(2, { message: "Arabic name is required" }),
  name_en: z.string().optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  sort_order: z.number().int().min(0),
  is_active: z.boolean(),
});

export const createStageSchema = z
  .object({
    ministry_id: z.string().uuid({ message: "Ministry is required" }),
    name_ar: z.string().min(2, { message: "Arabic name is required" }),
    name_en: z.string().optional(),
    description_ar: z.string().optional(),
    description_en: z.string().optional(),
    age_min: z.number().int().min(0).max(100).nullable().optional(),
    age_max: z.number().int().min(0).max(100).nullable().optional(),
    sort_order: z.number().int().min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.age_min != null && data.age_max != null) {
        return data.age_max >= data.age_min;
      }
      return true;
    },
    {
      message: "Max age must be greater than or equal to min age",
      path: ["age_max"],
    },
  );

export const updateStageSchema = z
  .object({
    name_ar: z.string().min(2, { message: "Arabic name is required" }),
    name_en: z.string().optional(),
    description_ar: z.string().optional(),
    description_en: z.string().optional(),
    age_min: z.number().int().min(0).max(100).nullable().optional(),
    age_max: z.number().int().min(0).max(100).nullable().optional(),
    sort_order: z.number().int().min(0),
    is_active: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.age_min != null && data.age_max != null) {
        return data.age_max >= data.age_min;
      }
      return true;
    },
    {
      message: "Max age must be greater than or equal to min age",
      path: ["age_max"],
    },
  );

export const assignUsersToStageSchema = z.object({
  stageId: z.string().uuid(),
  userIds: z.array(z.string().uuid()),
});

export type CreateMinistryFormValues = z.infer<typeof createMinistrySchema>;
export type UpdateMinistryFormValues = z.infer<typeof updateMinistrySchema>;
export type CreateStageFormValues = z.infer<typeof createStageSchema>;
export type UpdateStageFormValues = z.infer<typeof updateStageSchema>;
export type AssignUsersToStageFormValues = z.infer<typeof assignUsersToStageSchema>;
