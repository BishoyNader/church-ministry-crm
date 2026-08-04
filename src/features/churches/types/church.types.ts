import type { Database } from "@/types/database.types";
import type { ServiceActionResult } from "@/features/services/types/services.types";

export type ChurchRow = Database["public"]["Tables"]["churches"]["Row"];
export type ChurchInsert = Database["public"]["Tables"]["churches"]["Insert"];
export type ChurchUpdate = Database["public"]["Tables"]["churches"]["Update"];

export interface ChurchListItem extends ChurchRow {
  memberCount?: number;
  servantCount?: number;
}

export interface ChurchDetail extends ChurchRow {
  memberCount: number;
  servantCount: number;
  serviceCount: number;
  stageCount: number;
}

export interface ChurchStats {
  memberCount: number;
  servantCount: number;
  serviceCount: number;
  stageCount: number;
}

export interface ChurchPageData {
  rows: ChurchListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ChurchFilters {
  search?: string;
  status?: "all" | "active" | "inactive";
  page?: number;
  pageSize?: number;
}

export interface CreateChurchInput {
  name_ar: string;
  name_en?: string;
  slug: string;
  contact_email?: string;
  contact_phone?: string;
  address_ar?: string;
  address_en?: string;
  subscription_tier?: string;
  subscription_status?: string;
  locale?: string;
}

export interface UpdateChurchInput {
  name_ar?: string;
  name_en?: string;
  slug?: string;
  contact_email?: string;
  contact_phone?: string;
  address_ar?: string;
  address_en?: string;
  is_active?: boolean;
  subscription_tier?: string;
  subscription_status?: string;
  locale?: string;
}

export type ChurchActionResult = ServiceActionResult<ChurchRow | ChurchPageData | ChurchDetail | ChurchStats | { id: string }>;