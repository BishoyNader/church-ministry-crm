import type { Database } from "@/types/database.types";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type NotificationType =
  | "servant_pending"
  | "church_pending"
  | "birthday"
  | "attendance_absence"
  | "followup_reminder"
  | "system";

export type NotificationFilter = NotificationType | "all";

export type NotificationSummary = {
  unreadCount: number;
};

export type NotificationListParams = {
  page?: number;
  pageSize?: number;
  type?: NotificationFilter;
};

export type NotificationListResult = {
  data: NotificationRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
