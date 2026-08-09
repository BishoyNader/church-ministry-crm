import type { Database } from "@/types/database.types";

export type ServantRow = Database["public"]["Tables"]["servants"]["Row"];
export type ServantStageAssignmentRow =
  Database["public"]["Tables"]["servant_stage_assignments"]["Row"];

export type ServantProfile = {
  id: string;
  full_name_ar: string | null;
  full_name_en: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
};

export type ServantRole = {
  id: string;
  name_ar: string;
  name_en: string | null;
  role_type: string;
};

export type ServantStageAssignment = {
  id: string;
  stage_id: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  stages: {
    id: string;
    name_ar: string;
    name_en: string | null;
  } | null;
};

export type ServantListItem = ServantRow & {
  profile: ServantProfile | null;
  roles: ServantRole[];
  stageAssignments: ServantStageAssignment[];
};

export type ServantDetail = ServantListItem;

export type ServantListParams = {
  page: number;
  pageSize: number;
  search?: string;
  approvalStatus?: "pending" | "approved" | "rejected";
  stageId?: string;
};

export type ServantListResult = {
  servants: ServantListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type UpdateServantInput = {
  confession_father_name?: string;
  join_date?: string;
  notes?: string;
};

export type ServantStage = {
  id: string;
  name_ar: string;
  name_en: string | null;
};
