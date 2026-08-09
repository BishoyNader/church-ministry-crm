import type { ChurchSummary } from "@/features/churches/types/church.types";

export type ChurchRequestCounts = {
  pending: number;
  approved: number;
  rejected: number;
};

export type PlatformDashboardStats = {
  churches: ChurchSummary;
  requests: ChurchRequestCounts;
  users: number;
  servants: number;
  beneficiaries: number;
  approvalRate: number | null;
};

export type PlatformRecentAuditEntry = {
  id: string;
  churchId: string | null;
  churchNameAr: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  createdAt: string;
};

export type PlatformDashboardActionResult<T = unknown> = {
  success: boolean;
  message: string;
  data?: T;
};
