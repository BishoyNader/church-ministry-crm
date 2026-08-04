import type { Database } from "@/types/database.types";

export type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
export type ClassInsert = Database["public"]["Tables"]["classes"]["Insert"];
export type ClassUpdate = Database["public"]["Tables"]["classes"]["Update"];

export type ClassListItem = ClassRow & {
  stageName: string;
  serviceName: string;
};

export type StageOption = {
  id: string;
  name_ar: string;
  name_en: string | null;
  service_name_ar: string;
  service_name_en: string | null;
};

export type ClassStatusFilter = "all" | "active" | "inactive";

export type ClassFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ClassStatusFilter;
};

export type ClassPageData = {
  rows: ClassListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CreateClassInput = {
  stage_id: string;
  name_ar: string;
  name_en?: string;
  sort_order?: number;
};

export type UpdateClassInput = {
  stage_id: string;
  name_ar: string;
  name_en?: string;
  sort_order: number;
  is_active: boolean;
};

export type ClassActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};
