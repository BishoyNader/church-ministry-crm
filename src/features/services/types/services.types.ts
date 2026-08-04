import type { Database } from "@/types/database.types";

export type ServiceRow = Database["public"]["Tables"]["services"]["Row"];
export type ServiceInsert = Database["public"]["Tables"]["services"]["Insert"];
export type ServiceUpdate = Database["public"]["Tables"]["services"]["Update"];

export type ServiceListItem = ServiceRow & {
  stageCount: number;
};

export type ServiceStatusFilter = "all" | "active" | "inactive";

export type ServiceFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ServiceStatusFilter;
};

export type ServicePageData = {
  rows: ServiceListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CreateServiceInput = {
  name_ar: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
  sort_order?: number;
};

export type UpdateServiceInput = {
  name_ar: string;
  name_en?: string;
  description_ar?: string;
  description_en?: string;
  sort_order: number;
  is_active: boolean;
};

export type ServiceActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};
