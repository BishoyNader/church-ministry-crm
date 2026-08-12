import { z } from "zod";

export const servantListSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  approvalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  stageId: z.string().uuid().optional(),
});

export const updateServantSchema = z.object({
  confession_father_name: z.string().trim().max(200).optional(),
  join_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(2000).optional(),
});

export const assignServantStagesSchema = z.object({
  servantId: z.string().uuid(),
  stageIds: z.array(z.string().uuid()).max(50),
});

export const servantIdSchema = z.object({
  servantId: z.string().uuid(),
});

/**
 * Create-servant form. The stage_manager role is stage-scoped, so when the
 * selected role is a stage manager the server requires a service + stage
 * binding (the dialog reveals those fields only for that role). serviceId and
 * stageId are validated together on the server against the actor's church.
 */
export const createServantSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
  full_name_ar: z.string().trim().min(2, { message: "Arabic name is required" }),
  full_name_en: z.string().optional(),
  phone: z.string().optional(),
  preferred_locale: z.enum(["ar", "en"]).optional(),
  roleId: z.string().uuid({ message: "A role is required" }),
  serviceId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
});

export type UpdateServantFormValues = z.infer<typeof updateServantSchema>;
export type CreateServantFormValues = z.infer<typeof createServantSchema>;
