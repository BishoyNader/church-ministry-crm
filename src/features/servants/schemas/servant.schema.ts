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

export type UpdateServantFormValues = z.infer<typeof updateServantSchema>;
