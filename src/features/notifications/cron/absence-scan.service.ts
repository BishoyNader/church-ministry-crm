import { createAdminClient } from "@/lib/supabase/admin";
import { sendScheduledNotification } from "../services/notification.service";
import { getAssignedServants } from "./recipients";
import {
  type NotificationScanResult,
  emptyScanResult,
  getRunDateKey,
} from "./types";

const ABSENT_STATUS = "absent";
const CONSECUTIVE_ABSENCES_REQUIRED = 3;

/**
 * Repeated-absence scan.
 *
 * For every active church, builds each beneficiary's attendance timeline
 * (joined session dates) and flags beneficiaries whose three most recent
 * attendance records are all `absent` — i.e. 3 consecutive absences. Notifies
 * the beneficiary's currently assigned servants. Once the beneficiary attends
 * (or is excused), the streak resets and the flag clears.
 *
 * Dedupe key: attendance_absence:{beneficiary_id}:{date}.
 */
export async function runAbsenceScan(now: Date): Promise<NotificationScanResult> {
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
    const [{ data: sessions }, { data: records }] = await Promise.all([
      admin
        .from("attendance_sessions")
        .select("id, session_date")
        .eq("church_id", church.id),
      admin
        .from("attendance_records")
        .select("id, beneficiary_id, status, session_id")
        .eq("church_id", church.id)
        .not("beneficiary_id", "is", null),
    ]);

    if (!sessions || !records) {
      result.errors++;
      continue;
    }

    const dateBySessionId = new Map<string, string>();
    for (const session of sessions) {
      dateBySessionId.set(session.id, session.session_date);
    }

    // beneficiary_id -> chronological status timeline
    const timelineByBeneficiary = new Map<string, { date: string; status: string }[]>();
    for (const record of records ?? []) {
      const sessionDate = record.beneficiary_id
        ? dateBySessionId.get(record.session_id)
        : undefined;
      if (!record.beneficiary_id || !sessionDate) continue;
      const timeline = timelineByBeneficiary.get(record.beneficiary_id) ?? [];
      timeline.push({ date: sessionDate, status: record.status });
      timelineByBeneficiary.set(record.beneficiary_id, timeline);
    }

    const flaggedBeneficiaryIds: string[] = [];
    for (const [beneficiaryId, timeline] of timelineByBeneficiary) {
      timeline.sort((a, b) => a.date.localeCompare(b.date));
      const lastThree = timeline.slice(-CONSECUTIVE_ABSENCES_REQUIRED);
      if (lastThree.length === CONSECUTIVE_ABSENCES_REQUIRED &&
          lastThree.every((entry) => entry.status === ABSENT_STATUS)) {
        flaggedBeneficiaryIds.push(beneficiaryId);
      }
    }

    if (flaggedBeneficiaryIds.length === 0) continue;

    result.scanned += flaggedBeneficiaryIds.length;

    const recipientsByBeneficiary = await getAssignedServants(
      admin,
      church.id,
      flaggedBeneficiaryIds,
    );

    for (const beneficiaryId of flaggedBeneficiaryIds) {
      const recipients = recipientsByBeneficiary.get(beneficiaryId) ?? [];
      if (recipients.length === 0) continue;

      for (const recipientId of recipients) {
        const outcome = await sendScheduledNotification({
          churchId: church.id,
          recipientId,
          notificationType: "attendance_absence",
          titleAr: "غياب متكرر",
          titleEn: "Repeated absence",
          bodyAr: "هناك مخدوم غائب عن ٣ خدم متتالية. يرجى التواصل معه.",
          bodyEn: "A beneficiary has been absent for 3 consecutive sessions. Please follow up.",
          data: {
            type: "attendance_absence",
            beneficiary_id: beneficiaryId,
            absence_count: CONSECUTIVE_ABSENCES_REQUIRED,
            date: dateKey,
          },
          dedupeKey: `attendance_absence:${beneficiaryId}:${dateKey}`,
        });

        if (outcome.status === "inserted") result.created++;
        else if (outcome.status === "duplicate") result.duplicates++;
        else result.errors++;
      }
    }
  }

  return result;
}
