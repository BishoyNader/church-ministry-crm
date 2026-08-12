import { z } from "zod";
import { SERVICE_TYPE_KEYS } from "../constants/presets";

export const serviceTypeSchema = z.enum(SERVICE_TYPE_KEYS);

export const createServiceSchema = z.object({
  name_ar: z.string().min(2, { message: "Arabic name is required" }),
  name_en: z.string().optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  sort_order: z.number().int().min(0).optional(),
  /** Academic preset the service was created from (informational only). */
  service_type: serviceTypeSchema.optional(),
  /** Explicit promotion destination service (configured progression). */
  next_service_id: z.string().uuid().nullable().optional(),
});

export const updateServiceSchema = z.object({
  name_ar: z.string().min(2, { message: "Arabic name is required" }),
  name_en: z.string().optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  sort_order: z.number().int().min(0),
  is_active: z.boolean(),
  next_service_id: z.string().uuid().nullable().optional(),
});

/**
 * One stage entered inside the create-service dialog. The stage is only
 * persisted after the service exists (stages.service_id is required), so the
 * create action stores the service first, then creates every submitted stage
 * with the returned service id in the same logical user action.
 */
/**
 * Optional age bound. React Hook Form delivers the raw `<Input>` value (a
 * string, or an empty string when blank) so this coerces to a validated number
 * while keeping the final type `number | undefined`.
 */
const optionalAge = () =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === "" || value == null) return undefined;
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n : undefined;
    })
    .pipe(z.number().int().min(0).max(100).optional());

export const stageInputSchema = z.object({
  name_ar: z.string().trim().min(2, { message: "Stage name is required" }),
  name_en: z.string().optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  age_min: optionalAge(),
  age_max: optionalAge(),
  /** Internal academic code used by the promotion engine (never shown in UI). */
  stage_code: z.string().trim().max(40).optional(),
});

/**
 * Create-service form that may carry its stages (المراحل). The list order is
 * preserved as the stage sort_order, so the user's ordering is kept.
 */
export const createServiceWithStagesSchema = createServiceSchema.extend({
  stages: z.array(stageInputSchema).max(20).default([]),
});

export type CreateServiceFormValues = z.infer<typeof createServiceSchema>;
export type UpdateServiceFormValues = z.infer<typeof updateServiceSchema>;
export type StageInputFormValues = z.infer<typeof stageInputSchema>;
/**
 * Form values as delivered by React Hook Form (raw string inputs, empty
 * stages array). `createServiceWithStagesSchema.parse` transforms these into
 * the validated `CreateServiceWithStagesParsedValues` before a server call.
 */
export type CreateServiceWithStagesFormValues = z.input<
  typeof createServiceWithStagesSchema
>;
export type CreateServiceWithStagesParsedValues = z.output<
  typeof createServiceWithStagesSchema
>;
