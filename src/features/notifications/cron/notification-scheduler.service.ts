import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAbsenceScan } from "./absence-scan.service";
import { runApprovalScan } from "./approval-scan.service";
import { runBirthdayScan } from "./birthday-scan.service";
import { runFollowupScan } from "./followup-scan.service";
import {
  type NotificationScanResult,
  type NotificationScanSummary,
  emptyScanResult,
  getRunDateKey,
} from "./types";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_APPROVAL_REMINDER_THRESHOLD_DAYS = 2;

export type NotificationSchedulerResult = {
  ok: boolean;
  runId: string;
  runAt: string;
  dateKey: string;
  thresholdDays: number;
  scans: NotificationScanSummary;
};

function parseThresholdDays(value: string | undefined): number {
  if (!value) return DEFAULT_APPROVAL_REMINDER_THRESHOLD_DAYS;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return DEFAULT_APPROVAL_REMINDER_THRESHOLD_DAYS;
  }
  return parsed;
}

function uuid(): string {
  return randomUUID();
}

/**
 * Runs all four scheduled scans and writes an audit record for the execution.
 *
 * Tenancy: every scan query is church-scoped (or platform-scoped for global
 * platform-owner recipients). The service-role client bypasses RLS, so scoping
 * is enforced explicitly here, never assumed.
 */
export async function runNotificationScheduler(
  now: Date = new Date(),
): Promise<NotificationSchedulerResult> {
  const admin = createAdminClient();
  const runId = uuid();
  const runAt = now.toISOString();
  const dateKey = getRunDateKey(now);
  const thresholdDays = parseThresholdDays(
    process.env.CRON_APPROVAL_REMINDER_THRESHOLD_DAYS,
  );

  let birthday: NotificationScanResult = emptyScanResult();
  let absence: NotificationScanResult = emptyScanResult();
  let followup: NotificationScanResult = emptyScanResult();
  let approval: NotificationScanResult = emptyScanResult();

  try {
    [birthday, absence, followup, approval] = await Promise.all([
      runBirthdayScan(now),
      runAbsenceScan(now),
      runFollowupScan(now),
      runApprovalScan(now, thresholdDays),
    ]);
  } catch (error) {
    await writeSchedulerAudit(admin, {
      runId,
      runAt,
      dateKey,
      thresholdDays,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown failure",
      scans: { birthday, absence, followup, approval },
    });
    throw error;
  }

  const scans: NotificationScanSummary = { birthday, absence, followup, approval };

  await writeSchedulerAudit(admin, {
    runId,
    runAt,
    dateKey,
    thresholdDays,
    status: "completed",
    error: null,
    scans,
  });

  return { ok: true, runId, runAt, dateKey, thresholdDays, scans };
}

type SchedulerAuditInput = {
  runId: string;
  runAt: string;
  dateKey: string;
  thresholdDays: number;
  status: "completed" | "failed";
  error: string | null;
  scans: NotificationScanSummary;
};

async function writeSchedulerAudit(
  admin: ReturnType<typeof createAdminClient>,
  input: SchedulerAuditInput,
): Promise<void> {
  try {
    await admin.from("audit_logs").insert({
      church_id: null,
      actor_id: null,
      action: "cron",
      entity_type: "notification_automation",
      entity_id: ZERO_UUID,
      metadata: {
        run_id: input.runId,
        run_at: input.runAt,
        date_key: input.dateKey,
        threshold_days: input.thresholdDays,
        status: input.status,
        error: input.error,
        birthday: input.scans.birthday,
        absence: input.scans.absence,
        followup: input.scans.followup,
        approval: input.scans.approval,
      },
    });
  } catch {
    // Audit is best-effort; the scans have already completed.
  }
}
