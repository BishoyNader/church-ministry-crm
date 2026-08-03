import { createAdminClient } from "@/lib/supabase/admin";
import { sendScheduledNotification } from "../services/notification.service";
import {
  type NotificationScanResult,
  emptyScanResult,
  getRunDateKey,
} from "./types";

/**
 * Follow-up due reminder scan.
 *
 * Finds open follow-ups whose scheduled_at <= the run time and notifies the
 * responsible servant: the explicit assignee (assigned_to) when set, otherwise
 * the servant who created the follow-up (servant_id). Servants are profile
 * records (servants.id references profiles.id), so they are valid
 * notifications.recipient_id values.
 *
 * Dedupe key: followup_reminder:{followup_id}:{date}.
 */
export async function runFollowupScan(now: Date): Promise<NotificationScanResult> {
  const admin = createAdminClient();
  const result = emptyScanResult();
  const dateKey = getRunDateKey(now);

  const { data: churches, error: churchesError } = await admin
    .from("churches")
    .select("id")
    .eq("is_active", true)
    .is("deleted_at", null);

  if (churchesError) {
    result.errors++;
    return result;
  }

  for (const church of churches ?? []) {
    const { data: followups, error } = await admin
      .from("followups")
      .select(
        "id, beneficiary_id, assigned_to, servant_id, scheduled_at, type, beneficiaries(full_name_ar)",
      )
      .eq("church_id", church.id)
      .in("status", ["open", "in_progress"])
      .is("deleted_at", null)
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", now.toISOString());

    if (error) {
      result.errors++;
      continue;
    }

    for (const followup of followups ?? []) {
      const recipientId = followup.assigned_to ?? followup.servant_id;
      if (!recipientId) continue;

      result.scanned++;

      const beneficiary = followup.beneficiaries as
        | { full_name_ar: string | null }
        | { full_name_ar: string | null }[]
        | null;
      const beneficiaryName = Array.isArray(beneficiary)
        ? beneficiary[0]?.full_name_ar
        : beneficiary?.full_name_ar;

      const displayName = beneficiaryName?.trim() || "المخدوم";
      const scheduledDate = followup.scheduled_at
        ? new Date(followup.scheduled_at).toISOString().slice(0, 10)
        : null;

      const outcome = await sendScheduledNotification({
        churchId: church.id,
        recipientId,
        notificationType: "followup_reminder",
        titleAr: "متابعة مستحقة",
        titleEn: "Follow-up due",
        bodyAr: `متابعة مستحقة للمخدوم ${displayName}. يرجى إتمامها في أقرب وقت.`,
        bodyEn: `A follow-up for ${displayName} is due. Please complete it as soon as possible.`,
        data: {
          type: "followup_reminder",
          followup_id: followup.id,
          beneficiary_id: followup.beneficiary_id,
          followup_type: followup.type,
          scheduled_at: followup.scheduled_at,
          scheduled_date: scheduledDate,
          date: dateKey,
        },
        dedupeKey: `followup_reminder:${followup.id}:${dateKey}`,
      });

      if (outcome.status === "inserted") result.created++;
      else if (outcome.status === "duplicate") result.duplicates++;
      else result.errors++;
    }
  }

  return result;
}
