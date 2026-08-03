import { z } from "zod";

export const updateProfileSchema = z.object({
  fullNameAr: z.string().min(2, { message: "Arabic name is required" }),
  fullNameEn: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  preferredLocale: z.enum(["ar", "en"]),
});

export const updateChurchSchema = z.object({
  nameAr: z.string().min(2, { message: "Church Arabic name is required" }),
  nameEn: z.string().optional().or(z.literal("")),
  contactEmail: z.string().email({ message: "Invalid email address" }).optional().or(z.literal("")),
  contactPhone: z.string().optional().or(z.literal("")),
  addressAr: z.string().optional().or(z.literal("")),
  addressEn: z.string().optional().or(z.literal("")),
  logoUrl: z.string().url({ message: "Invalid URL" }).optional().or(z.literal("")),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "Current password is required" }),
    newPassword: z.string().min(8, { message: "New password must be at least 8 characters" }),
    confirmPassword: z.string().min(8, { message: "Confirm password must be at least 8 characters" }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>;
export type UpdateChurchFormValues = z.infer<typeof updateChurchSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;