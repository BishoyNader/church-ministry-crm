import { z } from "zod";

export const createChurchSchema = z.object({
  name_ar: z.string().min(1, "Arabic name is required").max(255),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Invalid slug format"),
  contact_email: z.string().email("Invalid email").optional().default(""),
  contact_phone: z.string().max(50).optional().default(""),
  address_ar: z.string().max(500).optional().default(""),
  address_en: z.string().max(500).optional().default(""),
  subscription_tier: z.string().max(50).default("trial"),
  subscription_status: z.string().max(50).default("active"),
  locale: z.string().max(10).default("ar"),
});

export const updateChurchSchema = z.object({
  name_ar: z.string().min(1).max(255).optional().default(""),
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Invalid slug format")
    .optional()
    .default(""),
  contact_email: z.string().email("Invalid email").optional().default(""),
  contact_phone: z.string().max(50).optional().default(""),
  address_ar: z.string().max(500).optional().default(""),
  address_en: z.string().max(500).optional().default(""),
  is_active: z.boolean().optional(),
  status: z.enum(["active", "inactive", "suspended", "disabled"]).optional(),
  subscription_tier: z.string().max(50).default("trial"),
  subscription_status: z.string().max(50).default("active"),
  locale: z.string().max(10).default("ar"),
});

export type CreateChurchFormValues = z.input<typeof createChurchSchema>;
export type UpdateChurchFormValues = z.input<typeof updateChurchSchema>;
