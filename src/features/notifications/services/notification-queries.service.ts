import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationListParams, NotificationListResult, NotificationRow } from "../types/notification.types";

export async function listNotificationsForUser(
  supabase: SupabaseClient,
  recipientId: string,
  filters?: NotificationListParams,
): Promise<{ data: NotificationListResult | null; error: string | null }> {
  try {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("recipient_id", recipientId)
      .order("sent_at", { ascending: false });

    if (filters?.type && filters.type !== "all") {
      query = query.eq("notification_type", filters.type);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      return { data: null, error: error.message };
    }

    return {
      data: {
        data: (data ?? []) as NotificationRow[],
        total: count ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to load notifications." };
  }
}

export async function getUnreadNotificationCount(
  supabase: SupabaseClient,
  recipientId: string,
): Promise<{ data: number; error: string | null }> {
  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", recipientId)
      .eq("is_read", false);

    if (error) {
      return { data: 0, error: error.message };
    }

    return { data: count ?? 0, error: null };
  } catch {
    return { data: 0, error: "Failed to load unread count." };
  }
}
