import type { Database } from "@/types/database.types";

export type MinistryRow = Database["public"]["Tables"]["ministries"]["Row"];
export type MinistryInsert = Database["public"]["Tables"]["ministries"]["Insert"];
export type MinistryUpdate = Database["public"]["Tables"]["ministries"]["Update"];

export type StageRow = Database["public"]["Tables"]["stages"]["Row"];
export type StageInsert = Database["public"]["Tables"]["stages"]["Insert"];
export type StageUpdate = Database["public"]["Tables"]["stages"]["Update"];

export type UserStageAssignmentRow =
  Database["public"]["Tables"]["user_stage_assignments"]["Row"];
export type UserStageAssignmentInsert =
  Database["public"]["Tables"]["user_stage_assignments"]["Insert"];

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type MinistryListItem = MinistryRow & {
  stageCount: number;
};

export type StageListItem = StageRow & {
  childrenCount: number;
  usersCount: number;
};

export type MinistryDetail = MinistryRow & {
  stages: StageListItem[];
};

export type StageUser = Pick<
  ProfileRow,
  "id" | "full_name_ar" | "full_name_en" | "email" | "avatar_url"
>;

export type CreateMinistryInput = {
  name_ar: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
  sort_order?: number;
};

export type UpdateMinistryInput = {
  name_ar: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
  sort_order: number;
  is_active: boolean;
};

export type CreateStageInput = {
  ministry_id: string;
  name_ar: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
  age_min?: number | null;
  age_max?: number | null;
  sort_order?: number;
};

export type UpdateStageInput = {
  name_ar: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
  age_min?: number | null;
  age_max?: number | null;
  sort_order: number;
  is_active: boolean;
};
