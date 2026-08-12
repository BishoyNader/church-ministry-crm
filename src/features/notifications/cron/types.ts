export type NotificationScanResult = {
  scanned: number;
  created: number;
  duplicates: number;
  errors: number;
};

export type NotificationScanSummary = {
  birthday: NotificationScanResult;
  absence: NotificationScanResult;
  followup: NotificationScanResult;
  approval: NotificationScanResult;
  promotion: NotificationScanResult;
};

export function emptyScanResult(): NotificationScanResult {
  return { scanned: 0, created: 0, duplicates: 0, errors: 0 };
}

/**
 * Deterministic YYYY-MM-DD key for a given run timestamp (UTC). Used both for
 * the dedupe key suffix and the audit metadata so retries of the same day stay
 * idempotent.
 */
export function getRunDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}
