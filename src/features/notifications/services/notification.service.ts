import { createAdminClient } from "@/lib/supabase/admin";
import type { SendNotificationInput } from "@/types/registration";

type ServiceResult<T> = { data: T | null; error: string | null };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * sendNotification(payload) — server-only notification write.
 *
 * NOTE: `send_notification` (023 S11-1) is REVOKED from every client role in
 * S12 (it is a SECURITY DEFINER helper used internally by the approval RPCs).
 * The admin/service-role client therefore cannot EXECUTE it. This wrapper is
 * the app-layer equivalent: a service-role INSERT into `notifications` using
 * the exact canonical columns the RPC writes (church_id, recipient_id,
 * notification_type, title_ar, title_en, body_ar, body_en, data, channel,
 * sent_at). Service-role writes bypass RLS — this is the approved privileged
 * path (same model as the user_roles service writes, 3C.2A.3).
 *
 * Only import this from server contexts (server actions / services).
 */
export async function sendNotification(
  input: SendNotificationInput,
): Promise<ServiceResult<string>> {
  if (!UUID_PATTERN.test(input.recipientId ?? "")) {
    return { data: null, error: "Invalid recipient id." };
  }
  if (!input.notificationType?.trim()) {
    return { data: null, error: "Notification type is required." };
  }
  if (!input.titleAr?.trim()) {
    return { data: null, error: "Notification title is required." };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("notifications")
      .insert({
        church_id: input.churchId,
        recipient_id: input.recipientId,
        notification_type: input.notificationType,
        title_ar: input.titleAr,
        title_en: input.titleEn ?? null,
        body_ar: input.bodyAr?.trim() || "",
        body_en: input.bodyEn ?? null,
        data: input.data ?? null,
        channel: input.channel ?? "in_app",
      })
      .select("id")
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data?.id ?? null, error: null };
  } catch {
    return { data: null, error: "Failed to send notification." };
  }
}
