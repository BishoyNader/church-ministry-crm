import { createAdminClient } from "@/lib/supabase/admin";
import { sendScheduledNotification } from "../services/notification.service";
import { getSuperAdminRecipients } from "./recipients";
import {
  type NotificationScanResult,
  emptyScanResult,
  getRunDateKey,
} from "./types";

/**
 * Annual promotion date (September 11) — matches vercel.json's
 * /api/cron/annual-promotion schedule and the business rule in the spec.
 */
export const PROMOTION_DATE_MONTH = 9;
export const PROMOTION_DATE_DAY = 11;

/**
 * Graduated reminder schedule: the first reminder lands ~35 days before
 * September 11 and reminders become increasingly frequent as the date
 * approaches. Every day is checked by the daily notifications cron; only the
 * days below trigger a write.
 */
export const PROMOTION_REMINDER_SCHEDULE = [35, 30, 25, 20, 14, 10, 7, 5, 3, 2, 1];

/**
 * Daily promotion-reminder scan.
 *
 * Between ~35 days and September 11 it reminds the senior church users
 * (الكاهن المسؤول / أمين القطاع = admin, and مدير الكنيسة = super_admin) that
 * the annual promotion is approaching. Reminders stop as soon as a confirmed
 * promotion cycle exists for the current year — after confirmation the senior
 * roles get the confirmation notifications instead (confirm_promotion_cycle).
 *
 * Idempotency: every write carries a deterministic per-recipient dedupe key
 * (promotion_reminder:{church_id}:{YYYY-MM-DD}) backed by the
 * uq_notifications_recipient_dedupe unique index (migration 030), so a cron
 * retry on the same day can never duplicate a reminder.
 */
export async function runPromotionReminderScan(
  now: Date,
): Promise<NotificationScanResult> {
  const admin = createAdminClient();
  const result = emptyScanResult();

  // Days until September 11 of the current year (UTC day granularity).
  const promotionDate = Date.UTC(
    now.getUTCFullYear(),
    PROMOTION_DATE_MONTH - 1,
    PROMOTION_DATE_DAY,
  );
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const daysUntil = Math.round((promotionDate - today) / 86_400_000);

  if (!PROMOTION_REMINDER_SCHEDULE.includes(daysUntil)) {
    return result; // not a reminder day
  }

  const dateKey = getRunDateKey(now);
  const year = now.getUTCFullYear();

  const { data: churches, error: churchesError } = await admin
    .from("churches")
    .select("id")
    .eq("is_active", true)
    .is("deleted_at", null);

  if (churchesError) {
    result.errors++;
    return result;
  }

  const churchIds = (churches ?? []).map((church) => church.id);
  if (churchIds.length === 0) return result;

  // Reminders stop once the year's promotion cycle is confirmed.
  const { data: confirmedCycles } = await admin
    .from("promotion_cycles")
    .select("church_id")
    .in("church_id", churchIds)
    .eq("academic_year", year)
    .eq("status", "confirmed");

  const confirmedChurchIds = new Set(
    (confirmedCycles ?? []).map((cycle) => cycle.church_id),
  );
  const pendingChurchIds = churchIds.filter(
    (churchId) => !confirmedChurchIds.has(churchId),
  );

  const recipientsByChurch = await getSuperAdminRecipients(
    admin,
    pendingChurchIds,
  );

  for (const [churchId, recipients] of recipientsByChurch) {
    if (recipients.length === 0) continue;
    result.scanned += recipients.length;

    for (const recipientId of recipients) {
      const outcome = await sendScheduledNotification({
        churchId,
        recipientId,
        notificationType: "promotion_reminder",
        titleAr: "تذكير بالترقية السنوية",
        titleEn: "Annual promotion reminder",
        bodyAr: `تبقى ${daysUntil} يومًا على الترقية السنوية (11 سبتمبر). يرجى مراجعة الاستعدادات قبل التنفيذ والاعتماد.`,
        bodyEn: `${daysUntil} day(s) until the annual promotion (September 11). Please review your preparations before the run and confirmation.`,
        data: {
          type: "promotion_reminder",
          academic_year: year,
          days_until: daysUntil,
          date: dateKey,
        },
        dedupeKey: `promotion_reminder:${churchId}:${dateKey}`,
      });

      if (outcome.status === "inserted") result.created++;
      else if (outcome.status === "duplicate") result.duplicates++;
      else result.errors++;
    }
  }

  return result;
}
