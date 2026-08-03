import { createAdminClient } from "@/lib/supabase/admin";
import { sendScheduledNotification } from "../services/notification.service";
import { getAssignedServants } from "./recipients";
import {
  type NotificationScanResult,
  emptyScanResult,
  getRunDateKey,
} from "./types";

/**
 * Daily birthday scan.
 *
 * For every active church, finds active beneficiaries whose date_of_birth
 * falls on the run date (month/day) and notifies their currently assigned
 * servants. Church-scoped queries only; the service-role client never reads
 * across tenants. Dedupe key: birthday:{beneficiary_id}:{date}.
 */
export async function runBirthdayScan(now: Date): Promise<NotificationScanResult> {
  const admin = createAdminClient();
  const result = emptyScanResult();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
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
    const { data: beneficiaries, error } = await admin
      .from("beneficiaries")
      .select("id, full_name_ar, full_name_en, date_of_birth, status")
      .eq("church_id", church.id)
      .is("deleted_at", null);

    if (error) {
      result.errors++;
      continue;
    }

    const birthdayList = (beneficiaries ?? []).filter((beneficiary) => {
      if (beneficiary.status !== "active") return false;
      const dob = new Date(`${beneficiary.date_of_birth}T00:00:00Z`);
      if (Number.isNaN(dob.getTime())) return false;
      return dob.getUTCMonth() + 1 === month && dob.getUTCDate() === day;
    });

    if (birthdayList.length === 0) continue;

    result.scanned += birthdayList.length;

    const recipientsByBeneficiary = await getAssignedServants(
      admin,
      church.id,
      birthdayList.map((beneficiary) => beneficiary.id),
    );

    for (const beneficiary of birthdayList) {
      const recipients = recipientsByBeneficiary.get(beneficiary.id) ?? [];
      if (recipients.length === 0) continue;

      const displayNameEn =
        beneficiary.full_name_en?.trim() || beneficiary.full_name_ar;

      for (const recipientId of recipients) {
        const outcome = await sendScheduledNotification({
          churchId: church.id,
          recipientId,
          notificationType: "birthday",
          titleAr: "عيد ميلاد اليوم",
          titleEn: "Birthday today",
          bodyAr: `اليوم عيد ميلاد ${beneficiary.full_name_ar}`,
          bodyEn: `It's ${displayNameEn}'s birthday today`,
          data: {
            type: "birthday",
            beneficiary_id: beneficiary.id,
            beneficiary_name: beneficiary.full_name_ar,
            date: dateKey,
          },
          dedupeKey: `birthday:${beneficiary.id}:${dateKey}`,
        });

        if (outcome.status === "inserted") result.created++;
        else if (outcome.status === "duplicate") result.duplicates++;
        else result.errors++;
      }
    }
  }

  return result;
}
