import { z } from "zod";

const slugPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const optionalEmail = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || z.string().email().safeParse(value).success,
    "Invalid email address",
  )
  .optional()
  .default("");

export const provisionChurchWizardSchema = z.object({
  churchNameAr: z.string().min(1, "Church name (Arabic) is required").max(255),
  churchNameEn: z.string().max(255).optional().default(""),
  slug: z
    .string()
    .max(100)
    .refine(
      (value) => value === "" || slugPattern.test(value),
      "Invalid slug format",
    )
    .optional()
    .default(""),
  contactEmail: optionalEmail,
  contactPhone: z.string().max(50).optional().default(""),
  addressAr: z.string().max(500).optional().default(""),
  fullNameAr: z
    .string()
    .min(2, "Administrator name (Arabic) is required")
    .max(255),
  fullNameEn: z.string().max(255).optional().default(""),
  email: z.string().trim().email("Invalid email address"),
  phone: z.string().max(50).optional().default(""),
  password: z
    .string()
    .refine(
      (value) => value === "" || value.length >= 8,
      "Password must be at least 8 characters",
    )
    .optional()
    .default(""),
});

export type ProvisionChurchWizardValues = z.input<typeof provisionChurchWizardSchema>;
export type ProvisionChurchWizardParsed = z.output<typeof provisionChurchWizardSchema>;
