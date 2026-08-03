import { createAdminClient } from "@/lib/supabase/admin";
import { sendScheduledNotification } from "../services/notification.service";
import {
  getPlatformOwnerRecipients,
  getSuperAdminRecipients,
} from "./recipients";
import {
  type NotificationScanResult,
  emptyScanResult,
  getRunDateKey,
} from "./types";

/**
 * Approval reminder scan.
 *
 * Reminds approvers about pending items older than a configurable threshold
 * (CRON_APPROVAL_REMINDER_THRESHOLD_DAYS, default 2):
 *   - pending servant registrations  -> church super_admins/admins
 *   - pending new-church requests    -> platform owners
 *
 * Dedupe keys: servant_approval_reminder:{servant_id}:{date} and
 *              church_request_reminder:{request_id}:{date}.
 */
export async function runApprovalScan(
  now: Date,
  thresholdDays: number,
): Promise<NotificationScanResult> {
  const admin = createAdminClient();
  const result = emptyScanResult();
  const dateKey = getRunDateKey(now);
  const cutoff = new Date(now.getTime() - thresholdDays * 24 * 60 * 60 * 1000).toISOString();

  await scanPendingServants(admin, now, cutoff, dateKey, result);
  await scanPendingChurchRequests(admin, now, cutoff, dateKey, result);

  return result;
}

async function scanPendingServants(
  admin: ReturnType<typeof createAdminClient>,
  now: Date,
  cutoff: string,
  dateKey: string,
  result: NotificationScanResult,
): Promise<void> {
  const { data: pendingServants, error } = await admin
    .from("servants")
    .select("id, church_id, profiles!servants_id_fkey(full_name_ar)")
    .eq("approval_status", "pending")
    .is("deleted_at", null)
    .lte("created_at", cutoff);

  if (error || !pendingServants?.length) {
    if (error) result.errors++;
    return;
  }

  const churchIds = [...new Set(pendingServants.map((servant) => servant.church_id))];
  const recipientsByChurch = await getSuperAdminRecipients(admin, churchIds);

  for (const servant of pendingServants) {
    const recipients = recipientsByChurch.get(servant.church_id) ?? [];
    if (recipients.length === 0) continue;

    result.scanned++;

    const profile = servant.profiles as
      | { full_name_ar: string | null }
      | { full_name_ar: string | null }[]
      | null;
    const applicantName = Array.isArray(profile)
      ? profile[0]?.full_name_ar
      : profile?.full_name_ar;
    const displayName = applicantName?.trim() || "خادم جديد";

    for (const recipientId of recipients) {
      const outcome = await sendScheduledNotification({
        churchId: servant.church_id,
        recipientId,
        notificationType: "servant_pending",
        titleAr: "تذكير بمراجعة طلب انضمام",
        titleEn: "Reminder: pending registration request",
        bodyAr: `طلب انضمام ${displayName} ينتظر الموافقة منذ أكثر من المدة المحددة.`,
        bodyEn: `The registration request from ${displayName} has been pending past the threshold.`,
        data: {
          type: "servant_approval_reminder",
          servant_id: servant.id,
          applicant_name: displayName,
          church_id: servant.church_id,
          pending_since: new Date(now.getTime()).toISOString(),
          date: dateKey,
        },
        dedupeKey: `servant_approval_reminder:${servant.id}:${dateKey}`,
      });

      if (outcome.status === "inserted") result.created++;
      else if (outcome.status === "duplicate") result.duplicates++;
      else result.errors++;
    }
  }
}

async function scanPendingChurchRequests(
  admin: ReturnType<typeof createAdminClient>,
  _now: Date,
  cutoff: string,
  dateKey: string,
  result: NotificationScanResult,
): Promise<void> {
  const { data: pendingRequests, error } = await admin
    .from("church_requests")
    .select("id, church_name_ar")
    .eq("status", "pending")
    .lte("created_at", cutoff);

  if (error || !pendingRequests?.length) {
    if (error) result.errors++;
    return;
  }

  const recipients = await getPlatformOwnerRecipients(admin);
  if (recipients.length === 0) return;

  for (const request of pendingRequests) {
    result.scanned++;

    for (const recipientId of recipients) {
      const outcome = await sendScheduledNotification({
        churchId: null,
        recipientId,
        notificationType: "church_pending",
        titleAr: "تذكير بمراجعة طلب كنيسة",
        titleEn: "Reminder: pending church request",
        bodyAr: `طلب إنشاء كنيسة ${request.church_name_ar} ينتظر المراجعة منذ أكثر من المدة المحددة.`,
        bodyEn: `The new-church request for ${request.church_name_ar} has been pending past the threshold.`,
        data: {
          type: "church_request_reminder",
          church_request_id: request.id,
          church_name: request.church_name_ar,
          date: dateKey,
        },
        dedupeKey: `church_request_reminder:${request.id}:${dateKey}`,
      });

      if (outcome.status === "inserted") result.created++;
      else if (outcome.status === "duplicate") result.duplicates++;
      else result.errors++;
    }
  }
}
