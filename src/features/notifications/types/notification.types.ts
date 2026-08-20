import type { Database } from "@/types/database.types";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type NotificationType =
  | "servant_pending"
  | "church_pending"
  | "birthday"
  | "attendance_absence"
  | "followup_reminder"
  | "system"
  | "payment_request_submitted"
  | "payment_approved"
  | "payment_rejected"
  | "refund_requested"
  | "refund_approved"
  | "refund_rejected"
  | "refund_completed"
  | "trial_started"
  | "trial_expiring"
  | "trial_expired"
  | "subscription_activated"
  | "subscription_expiring"
  | "subscription_expired"
  | "grace_period_started"
  | "grace_period_ending"
  | "downgraded_to_free";

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
