import { z } from "zod";

export const createUserSchema = z.object({
  churchId: z.string().uuid().optional(),
  email: z.string().email({ message: "Invalid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
  full_name_ar: z.string().min(2, { message: "Arabic name is required" }),
  full_name_en: z.string().optional(),
  phone: z.string().optional(),
  preferred_locale: z.enum(["ar", "en"]).optional(),
  roleIds: z.array(z.string()).min(1, { message: "At least one role is required" }),
  stageIds: z.array(z.string()).optional(),
});

export const updateUserSchema = z.object({
  full_name_ar: z.string().min(2, { message: "Arabic name is required" }),
  full_name_en: z.string().optional(),
  phone: z.string().optional(),
  preferred_locale: z.enum(["ar", "en"]).optional(),
  is_active: z.boolean(),
});

export const assignRolesSchema = z.object({
  userId: z.string().uuid(),
  roleIds: z.array(z.string()).min(1, { message: "At least one role is required" }),
});

export const assignStagesSchema = z.object({
  userId: z.string().uuid(),
  stageIds: z.array(z.string()),
});

export const userListSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  roleFilter: z
    .enum(["platform_owner", "super_admin", "admin", "servant"])
    .optional(),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;
