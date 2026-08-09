import type { Database } from "@/types/database.types";
import type { ServiceActionResult } from "@/features/services/types/services.types";

export type ChurchRow = Database["public"]["Tables"]["churches"]["Row"];
export type ChurchInsert = Database["public"]["Tables"]["churches"]["Insert"];
export type ChurchUpdate = Database["public"]["Tables"]["churches"]["Update"];

export type ChurchStatus = "active" | "inactive" | "suspended" | "disabled";
export type ChurchStatusFilter = ChurchStatus | "all";

export type ChurchManagerInfo = {
  userId: string;
  fullNameAr: string;
  fullNameEn: string | null;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  isActive: boolean;
} | null;

export interface ChurchListItem extends ChurchRow {
  status: ChurchStatus;
  manager: ChurchManagerInfo;
  memberCount: number;
  servantCount: number;
  childCount: number;
  serviceCount: number;
  stageCount: number;
  classCount: number;
  lastActivityAt: string | null;
}

export type ChurchDetail = ChurchListItem;

export interface ChurchStats {
  memberCount: number;
  servantCount: number;
  childCount: number;
  serviceCount: number;
  stageCount: number;
  classCount: number;
  attendanceRate: number | null;
  attendancePresent: number;
  attendanceTotal: number;
}

export interface ChurchSummary {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  disabled: number;
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
  status?: ChurchStatusFilter;
  page?: number;
  pageSize?: number;
}

export interface ChurchUserRow {
  id: string;
  fullNameAr: string;
  fullNameEn: string | null;
  email: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roleTypes: string[];
  createdAt: string;
}

export interface ChurchUsersPageData {
  rows: ChurchUserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ChurchAuditEvent {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

export interface ChurchAuditPageData {
  rows: ChurchAuditEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type ChurchAdminListRow = {
  id: string;
  nameAr: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
};

export interface CreateChurchInput {
  name_ar: string;
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
  slug?: string;
  contact_email?: string;
  contact_phone?: string;
  address_ar?: string;
  address_en?: string;
  is_active?: boolean;
  status?: ChurchStatus;
  subscription_tier?: string;
  subscription_status?: string;
  locale?: string;
}

export type ChurchActionResult = ServiceActionResult<ChurchRow | ChurchPageData | ChurchDetail | ChurchStats | ChurchSummary | ChurchUsersPageData | ChurchAuditPageData | { id: string }>;
