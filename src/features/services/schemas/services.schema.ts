import { z } from "zod";

export const createServiceSchema = z.object({
  name_ar: z.string().min(2, { message: "Arabic name is required" }),
  name_en: z.string().optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const updateServiceSchema = z.object({
  name_ar: z.string().min(2, { message: "Arabic name is required" }),
  name_en: z.string().optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  sort_order: z.number().int().min(0),
  is_active: z.boolean(),
});

export type CreateServiceFormValues = z.infer<typeof createServiceSchema>;
export type UpdateServiceFormValues = z.infer<typeof updateServiceSchema>;
