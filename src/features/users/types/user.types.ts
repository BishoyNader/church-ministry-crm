import type { Database } from "@/types/database.types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"];
export type UserRoleInsert = Database["public"]["Tables"]["user_roles"]["Insert"];

export type ServantStageAssignmentRow =
  Database["public"]["Tables"]["servant_stage_assignments"]["Row"];
export type ServantStageAssignmentInsert =
  Database["public"]["Tables"]["servant_stage_assignments"]["Insert"];

export type ServantServiceAssignmentRow =
  Database["public"]["Tables"]["servant_service_assignments"]["Row"];
export type ServantServiceAssignmentInsert =
  Database["public"]["Tables"]["servant_service_assignments"]["Insert"];

export type RoleRow = Database["public"]["Tables"]["roles"]["Row"];
export type StageRow = Database["public"]["Tables"]["stages"]["Row"];
export type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

export type UserRoleType = Database["public"]["Enums"]["user_role_type"];

export type UserListItem = ProfileRow & {
  roles: Pick<RoleRow, "id" | "name_ar" | "name_en" | "role_type">[];
};

export type UserDetail = ProfileRow & {
  roles: RoleRow[];
  stageAssignments: (ServantStageAssignmentRow & {
    stages: Pick<StageRow, "id" | "name_ar" | "name_en">;
  })[];
  serviceAssignments: (ServantServiceAssignmentRow & {
    services: Pick<ServiceRow, "id" | "name_ar" | "name_en">;
  })[];
};

export type CreateUserInput = {
  email: string;
  password: string;
  full_name_ar: string;
  full_name_en?: string;
  phone?: string;
  preferred_locale?: string;
  roleIds: string[];
  stageIds: string[];
  serviceIds: string[];
};

export type UpdateUserInput = {
  full_name_ar: string;
  full_name_en?: string;
  phone?: string;
  preferred_locale?: string;
  is_active: boolean;
};

export type AssignRolesInput = {
  userId: string;
  roleIds: string[];
};

export type AssignStagesInput = {
  userId: string;
  stageIds: string[];
};

export type AssignServicesInput = {
  userId: string;
  serviceIds: string[];
};

export type UserListParams = {
  page: number;
  pageSize: number;
  search?: string;
  roleFilter?: UserRoleType;
};

export type UserListResult = {
  users: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
};
