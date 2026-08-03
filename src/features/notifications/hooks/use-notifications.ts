"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotificationSummaryAction,
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "../actions/notification.actions";
import type { NotificationFilter, NotificationListParams } from "../types/notification.types";

export const NOTIFICATION_QUERY_KEYS = {
  all: ["notifications"] as const,
  list: (params: NotificationListParams) => ["notifications", "list", params] as const,
  summary: ["notifications", "summary"] as const,
};

export function useNotificationSummary(enabled = true) {
  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.summary,
    queryFn: async () => {
      const result = await getNotificationSummaryAction();
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load notification summary.");
      }
      return result.data;
    },
    enabled,
    staleTime: 15_000,
  });
}

export function useNotifications(params: NotificationListParams = {}) {
  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.list(params),
    queryFn: async () => {
      const result = await listNotificationsAction(params);
      if (!result.success) {
        throw new Error(result.message ?? "Failed to load notifications.");
      }
      return result.data;
    },
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationReadAction(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllNotificationsReadAction(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all });
    },
  });
}

export function formatNotificationType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildNotificationFilterOptions(): Array<{ value: NotificationFilter; label: string }> {
  return [
    { value: "all", label: "All" },
    { value: "servant_pending", label: "Servant pending" },
    { value: "church_pending", label: "Church pending" },
    { value: "birthday", label: "Birthday" },
    { value: "attendance_absence", label: "Attendance absence" },
    { value: "followup_reminder", label: "Follow-up reminder" },
    { value: "system", label: "System" },
  ];
}
