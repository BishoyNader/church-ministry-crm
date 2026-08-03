"use server";

import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/features/rbac/utils/permission-check";
import { PERMISSION_CODES } from "@/features/rbac/constants/permissions";
import { listNotificationsForUser, getUnreadNotificationCount } from "../services/notification-queries.service";
import type { NotificationListParams, NotificationListResult, NotificationSummary } from "../types/notification.types";

export type NotificationActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
};

export async function listNotificationsAction(
  filters?: NotificationListParams,
): Promise<NotificationActionResult<NotificationListResult>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.NOTIFICATIONS_READ))) {
    return { success: false, message: "You do not have permission to view notifications." };
  }

  const result = await listNotificationsForUser(supabase, user.id, filters);
  if (result.error || !result.data) {
    return { success: false, message: result.error ?? "Failed to load notifications." };
  }

  return { success: true, data: result.data };
}

export async function getNotificationSummaryAction(): Promise<
  NotificationActionResult<NotificationSummary>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.NOTIFICATIONS_READ))) {
    return { success: false, message: "You do not have permission to view notifications." };
  }

  const result = await getUnreadNotificationCount(supabase, user.id);
  if (result.error) {
    return { success: false, message: result.error };
  }

  return { success: true, data: { unreadCount: result.data } };
}

export async function markNotificationReadAction(
  notificationId: string,
): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.NOTIFICATIONS_MANAGE))) {
    return { success: false, message: "You do not have permission to manage notifications." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: now })
    .eq("id", notificationId)
    .eq("recipient_id", user.id);

  if (error) {
    return { success: false, message: error.message };
  }

  await writeAuditLog(supabase, "read", "notification", notificationId, undefined, {
    notification_id: notificationId,
    state: "read",
  });

  return { success: true, message: "Notification marked as read." };
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be logged in." };
  }

  if (!(await hasPermission(PERMISSION_CODES.NOTIFICATIONS_MANAGE))) {
    return { success: false, message: "You do not have permission to manage notifications." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: now })
    .eq("recipient_id", user.id)
    .eq("is_read", false);

  if (error) {
    return { success: false, message: error.message };
  }

  await writeAuditLog(supabase, "read", "notification", user.id, undefined, {
    notification_id: "all",
    state: "read_all",
    recipient_id: user.id,
  });

  return { success: true, message: "All notifications marked as read." };
}
