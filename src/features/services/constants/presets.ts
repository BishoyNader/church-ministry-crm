/**
 * Standard academic stage presets — reusable templates for church admin
 * convenience. They NEVER restrict the Church Admin: every preset is a helper
 * that pre-fills stages (and internal promotion codes) which can be renamed,
 * removed, reordered, or added to. Custom services/stages remain fully
 * supported.
 *
 * The `code` values are internal identifiers consumed by the promotion engine
 * (standard_next_stage_code in migration 049) to resolve standard progression
 * (Baby Class -> KG -> Primary -> Preparatory -> Secondary) without depending
 * on Arabic service/stage names. They are never shown in the UI.
 */

export const SERVICE_TYPE_KEYS = [
  "baby_class",
  "kg",
  "primary",
  "preparatory",
  "secondary",
  "university",
  "graduates",
  "training",
  "custom",
] as const;

export type ServiceTypeKey = (typeof SERVICE_TYPE_KEYS)[number];

export type AcademicPresetStage = {
  name_ar: string;
  name_en: string;
  code: string;
};

export type AcademicPreset = {
  key: ServiceTypeKey;
  name_ar: string;
  name_en: string;
  /** Default stage list (empty for terminal/no-stage presets). */
  stages: AcademicPresetStage[];
};

export const ACADEMIC_PRESETS: Record<ServiceTypeKey, AcademicPreset> = {
  baby_class: {
    key: "baby_class",
    name_ar: "بيبي كلاس",
    name_en: "Baby Class",
    stages: [
      { name_ar: "الأولى", name_en: "First", code: "baby_1" },
      { name_ar: "الثانية", name_en: "Second", code: "baby_2" },
    ],
  },
  kg: {
    key: "kg",
    name_ar: "كي جي",
    name_en: "KG",
    stages: [
      { name_ar: "KG1", name_en: "KG1", code: "kg_1" },
      { name_ar: "KG2", name_en: "KG2", code: "kg_2" },
    ],
  },
  primary: {
    key: "primary",
    name_ar: "ابتدائي",
    name_en: "Primary",
    stages: [
      { name_ar: "الأولى", name_en: "First", code: "primary_1" },
      { name_ar: "الثانية", name_en: "Second", code: "primary_2" },
      { name_ar: "الثالثة", name_en: "Third", code: "primary_3" },
      { name_ar: "الرابعة", name_en: "Fourth", code: "primary_4" },
      { name_ar: "الخامسة", name_en: "Fifth", code: "primary_5" },
      { name_ar: "السادسة", name_en: "Sixth", code: "primary_6" },
    ],
  },
  preparatory: {
    key: "preparatory",
    name_ar: "إعدادي",
    name_en: "Preparatory",
    stages: [
      { name_ar: "الأولى", name_en: "First", code: "prep_1" },
      { name_ar: "الثانية", name_en: "Second", code: "prep_2" },
      { name_ar: "الثالثة", name_en: "Third", code: "prep_3" },
    ],
  },
  secondary: {
    key: "secondary",
    name_ar: "ثانوي",
    name_en: "Secondary",
    stages: [
      { name_ar: "الأولى", name_en: "First", code: "sec_1" },
      { name_ar: "الثانية", name_en: "Second", code: "sec_2" },
      { name_ar: "الثالثة", name_en: "Third", code: "sec_3" },
    ],
  },
  university: {
    key: "university",
    name_ar: "جامعة",
    name_en: "University",
    stages: [],
  },
  graduates: {
    key: "graduates",
    name_ar: "خريجين",
    name_en: "Graduates",
    stages: [],
  },
  training: {
    key: "training",
    name_ar: "تدريب",
    name_en: "Training",
    stages: [],
  },
  custom: {
    key: "custom",
    name_ar: "مخصص",
    name_en: "Custom",
    stages: [],
  },
};

export const ACADEMIC_PRESET_LIST = SERVICE_TYPE_KEYS.map(
  (key) => ACADEMIC_PRESETS[key],
);
