import { createAdminClient } from "@/lib/supabase/admin";
import { sendScheduledNotification } from "@/features/notifications/services/notification.service";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron.annual-promotion");

type PromotionStageResult = {
  church_id: string | null;
  stage_id: string | null;
  run_id: string | null;
};

export type AnnualPromotionScanResult = {
  ok: boolean;
  year: number;
  scannedStages: number;
  appliedRuns: number;
  noOpRuns: number;
  error?: string | null;
};

/**
 * Notifies every active user of the affected churches that the annual
 * promotion has been executed and is pending confirmation. Idempotent per
 * recipient + year via the dedupe key (migration 030).
 */
async function notifyChurchesOfExecution(
  churchIds: string[],
  year: number,
): Promise<number> {
  if (churchIds.length === 0) return 0;
  const admin = createAdminClient();
  let sent = 0;

  for (const churchId of churchIds) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id")
      .eq("church_id", churchId)
      .eq("is_active", true)
      .is("deleted_at", null);

    for (const profile of profiles ?? []) {
      const outcome = await sendScheduledNotification({
        churchId,
        recipientId: profile.id,
        notificationType: "promotion",
        titleAr: "تم تنفيذ الترقية السنوية",
        titleEn: "Annual promotion executed",
        bodyAr: `تم تنفيذ الترقية السنوية لسنة ${year}. المرحلة الجديدة سارية الآن وهي بانتظار الاعتماد من المسؤولين.`,
        bodyEn: `The annual promotion for year ${year} has been executed. The new placements are active and pending confirmation.`,
        data: { type: "promotion_executed", academic_year: year },
        dedupeKey: `promotion_executed:${year}`,
      });
      if (outcome.status === "inserted") sent++;
    }
  }

  return sent;
}

/**
 * Annual promotion automation (September 11 cron hook).
 *
 * Invokes run_annual_promotions_auto(p_year) through the privileged
 * service-role client. The RPC is granted to service_role ONLY (migration 047)
 * — no authenticated client can trigger it. Each stage result carries either a
 * run_id (applied) or null (no-op: an 'applied' run for that stage + year
 * already exists, or the stage raised an error which the RPC swallows
 * per-stage so one broken stage never aborts the whole batch). The run is
 * idempotent: beneficiary placements are promoted once, and the affected
 * servant assignments are only published by confirm_promotion_cycle() (049).
 *
 * After a successful run the affected churches' users receive a general
 * "executed / pending confirmation" notification; the confirmation flow
 * notifies the affected servants when the assignments are published.
 */
export async function runAnnualPromotionScan(): Promise<AnnualPromotionScanResult> {
  const year = new Date().getFullYear();
  try {
    const admin = createAdminClient();
    const { data, error } = (await admin.rpc(
      "run_annual_promotions_auto",
      { p_academic_year: year },
    )) as unknown as {
      data: PromotionStageResult[] | null;
      error: { message: string } | null;
    };

    if (error) {
      await log.error("cron_scan_failed", { year, err: error.message });
      return {
        ok: false,
        year,
        scannedStages: 0,
        appliedRuns: 0,
        noOpRuns: 0,
        error: error.message,
      };
    }

    const stages = data ?? [];
    const applied = stages.filter((stage) => stage.run_id !== null).length;
    const noOp = stages.length - applied;

    // General "executed / pending confirmation" notification per affected
    // church (idempotent per recipient + year).
    const affectedChurchIds = [
      ...new Set(
        stages
          .filter((stage) => stage.run_id !== null)
          .map((stage) => stage.church_id)
          .filter((id): id is string => !!id),
      ),
    ];
    let notified = 0;
    if (affectedChurchIds.length > 0) {
      notified = await notifyChurchesOfExecution(affectedChurchIds, year);
    }

    await log.info("cron_scan_completed", {
      year,
      scannedStages: stages.length,
      appliedRuns: applied,
      noOpRuns: noOp,
      notified,
    });

    return {
      ok: true,
      year,
      scannedStages: stages.length,
      appliedRuns: applied,
      noOpRuns: noOp,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Annual promotion run failed.";
    await log.error("cron_scan_failed", { year, err: error });
    return { ok: false, year, scannedStages: 0, appliedRuns: 0, noOpRuns: 0, error: message };
  }
}
