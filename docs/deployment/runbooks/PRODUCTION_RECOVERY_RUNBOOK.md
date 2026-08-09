# Production Recovery Runbook

**Updated:** 2026-08-06 (Sprint 2 hardening)

Complements `PRODUCTION_ROLLBACK_RUNBOOK.md` (deployment rollback). This
runbook covers **runtime incident response** using the observability
foundation added in Sprint 2 (structured logs, request IDs, health checks,
runtime diagnostics, client error intake).

---

## 1. Incident Triage (first 5 minutes)

| Signal | Where to look | Likely cause |
| --- | --- | --- |
| Uptime monitor 503 | `GET /api/health` | DB read failure, missing env, cold-start timeout |
| Elevated client errors | Log pipeline: `level=error scope=monitoring.errors` | Client-side crash loop (new release) |
| `cron_run_failed` | Log pipeline: `scope=cron.notifications` | Scheduler exception, DB issue |
| Slow responses | `x-response-time-ms` header / infra metrics | DB load, missing index, N+1 regression |

1. Open `/api/health` — check `database`, `checks.*`, `runtime.memoryMb`.
2. Open `/api/monitoring/diagnostics` (Bearer token) for process-level detail.
3. Pull recent error logs and correlate by `requestId` across middleware,
   actions, and services.
4. Check the audit log for the affected entity type (who/what/when).

## 2. Diagnostics Endpoints

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /api/health` | none | Liveness + DB probe + env booleans (public) |
| `GET /api/monitoring/diagnostics` | `Bearer $DIAGNOSTICS_TOKEN` (or `CRON_SECRET`) | Memory, load, node version, env presence |
| `POST /api/monitoring/errors` | none (rate-limited 30/min/IP) | Client error intake |

## 3. Common Recovery Procedures

### 3a. Database connectivity failure

1. Confirm `database: "ok"` in health.
2. Check Supabase status page / project dashboard (pause, region, quotas).
3. Verify `NEXT_PUBLIC_SUPABASE_URL` + anon key are valid in Vercel.
4. If the project was paused, resume from the Supabase dashboard.
5. Re-run `curl -s https://<host>/api/health`.

### 3b. Bad release (client crash loop)

1. Confirm via `monitoring.errors` volume spike + release timestamp.
2. Roll back the Vercel deployment to the previous stable build
   (see `PRODUCTION_ROLLBACK_RUNBOOK.md`).
3. Verify `/api/health` healthy and error volume returns to baseline.
4. Investigate the crash in a preview deployment before re-promoting.

### 3c. Data corruption / accidental deletion

1. **Stop writes** to the affected tables (pause cron + disable admin UI if needed).
2. Restore from the last `pg_dump` (see `STAGING_PROVISIONING_RUNBOOK.md` /
   Supabase PITR — enable Point-in-Time Recovery in the Supabase dashboard for
   production).
3. Replay any audit-trail verified operations that occurred after the snapshot.
4. Verify row counts against the audit log before re-enabling writes.

### 3d. Notification cron failures

1. Find `cron_run_failed` in logs with the run timestamp.
2. Re-trigger manually: `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/notifications`.
3. Confirm `cron_run_completed` with `ok: true`.
4. If it fails again, check scheduler service for a bad church/row and fix data.

## 4. Escalation

| Severity | Definition | Response time | Escalation |
| --- | --- | --- | --- |
| SEV-1 | Total outage / data loss | Immediate | On-call + platform owner |
| SEV-2 | Feature degraded, core flows affected | 1 hour | Engineering lead |
| SEV-3 | Minor issue, workaround exists | Next business day | Assignee |

## 5. Post-Incident

1. Attach the `requestId` from the earliest failing log as the incident ID.
2. Record what was observed, root cause, fix, and prevention.
3. Add a regression test or guard (unit test, e2e case, or CI gate) for the
   failure mode before closing.
4. Update this runbook if any step was missing or inaccurate.
