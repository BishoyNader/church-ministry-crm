# Production Readiness Remediation Sprint — Verification Report

**Date:** 2026-08-03 · **Branch:** staging · **Scope:** Round-2 audit P0/P1 findings
**DB migration:** `supabase/migrations/031_production_remediation.sql` (applied locally)
**Static gates:** `npx tsc --noEmit` ✓ · `npm run lint` ✓ (0 errors, 6 pre-existing warnings) · `npm run build` ✓ (23 routes)

---

## 1. Findings verification summary

| ID | Severity | Verdict | Action |
|----|----------|---------|--------|
| CRIT-1 | P0 | **DISPROVEN** (false positive) | No change — documented below |
| CRIT-2 | P0 | **CONFIRMED** | `en.json`/`ar.json` — `servants` namespace relocated to top level |
| HIGH-1 | P1 | **CONFIRMED** | Migration 031 — `user_roles.super_admin_all` WITH CHECK |
| HIGH-2 | P1 | **CONFIRMED** | Migration 031 — revoke `write_audit_log` from PUBLIC/anon/authenticated |
| HIGH-3 | P1 | **CONFIRMED** | App fix + migration 031 UPDATE policy on `notifications` |
| HIGH-4 | P1 | **CONFIRMED** | `reports.service.ts` — overdue now derived from `scheduled_at` |
| HIGH-5 | P1 | **CONFIRMED** | Import routes through `create_beneficiary_with_assignment` RPC |

---

## 2. CRIT-1 — `own_profile_insert` cross-tenant vector — **DISPROVEN**

Empirically disproven in this session (and the prior one). The `own_profile_insert`
policy (023:159–166) requires `EXISTS (SELECT 1 FROM churches c WHERE c.id = church_id
AND c.is_active AND c.deleted_at IS NULL)`. The `churches` subquery is RLS-filtered:
only `tenant_read` (id = `get_user_church_id()`) and `platform_owner_all` policies exist.
A fresh attacker with no profile has `get_user_church_id() = NULL` → 0 visible churches →
the EXISTS is false → insert blocked:

```
ERROR:  new row violates row-level security policy for table "profiles"
```

Backstop confirmed: `own_profile_update` WITH CHECK locks `church_id` to
`get_user_church_id()` (immutable post-insert). **No migration needed.**

---

## 3. Fixes applied

### 3.1 CRIT-2 — `servants` i18n namespace mis-nested under `users`

- **Evidence:** `en.json`/`ar.json` nested the 84-line `servants` block under
  `users.servants`, while `useTranslations("servants")`, `useTranslations("servants.assign")`,
  and `useTranslations("servants.edit")` resolve against a top-level `servants` namespace.
  A full 41-namespace audit showed `servants*` were the only broken namespaces.
- **Fix:** moved the block to the top level in both locale files (before `users`),
  preserving the `users.stages` namespace (still used by `user-stage-assignment.tsx`).
- **Verify:** all 41 used namespaces now resolve in both locales.

### 3.2 HIGH-1 — `user_roles` global role-grant escalation

- **Root cause:** `super_admin_all` on `user_roles` had `USING` only (no `WITH CHECK`),
  and `user_is_super_admin(NULL)` coalesces to the caller's church (022). A church
  super_admin could therefore `INSERT INTO user_roles (church_id, user_id, role_id)
  VALUES (NULL, target, <global platform_owner role>)` and mint a global platform_owner.
- **Fix (migration 031):** recreated `super_admin_all` with a `WITH CHECK` requiring:
  `church_id IS NOT NULL`, `church_id = get_user_church_id()`, the caller is super_admin
  of that church, and the target user has a live profile in the same church.
- **Why safe:** all legitimate `user_roles` writes run in SECURITY DEFINER RPCs
  (023 `approve_servant`/`approve_church_request`, 025, 026 `bootstrap_platform_owner`)
  or the service-role admin client (`user.service.ts` line 433/405) — both bypass RLS.
- **Live proof (as church-A super_admin via PostgREST role):**

```
TEST1 (NULL-church / global grant):      blocked  → "new row violates row-level security policy"
TEST2 (same-church super_admin grant):   allowed  → INSERT 0 1   (no regression)
TEST3 (cross-tenant grant to B's user):  blocked  → "new row violates row-level security policy"
```

  Before the fix, TEST1 returned `INSERT 0 1` and the target became a global
  `platform_owner` (reproduced in the prior session).

### 3.3 HIGH-2 — `write_audit_log` SECURITY DEFINER callable by PUBLIC

- **Root cause:** function ACL was the Postgres default (PUBLIC). Verified live:
  `has_function_privilege('anon', ...) = t` before the fix.
- **Fix (migration 031):** `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated;`
  `GRANT EXECUTE ... TO service_role;`
- **Why safe:** `src/lib/audit.ts` writes audit rows via a direct RLS-bound
  `.insert("audit_logs", ...)`, not the RPC. The SECURITY DEFINER RPCs that call
  `write_audit_log` internally run as the function owner and are unaffected.
- **Verified ACL:** `{postgres=X/postgres, service_role=X/postgres}`;
  live check → anon `f`, authenticated `f`, service_role `t`.

### 3.4 HIGH-3 — notification mark-read silently a no-op

- **Root cause:** `notification.actions.ts:76,109` gated mark-read on `NOTIFICATIONS_MANAGE`
  (denied to ordinary users), and `notifications` had only SELECT policies
  (`recipient_scope`), so the UPDATE returned 0 rows while the action reported success.
- **Fix:** gates switched to `NOTIFICATIONS_READ` (marking your own notifications read is
  a read-level action); migration 031 adds `recipient_scope_update FOR UPDATE USING
  (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid())`.
- **Live proof:** as recipient, `UPDATE ... WHERE recipient_id = auth.uid()` → `UPDATE 1`;
  cross-recipient update → `UPDATE 0`.

### 3.5 HIGH-4 — reports `overdue` never matches the status enum

- **Root cause:** `reports.service.ts:270` compared `followup.status === "overdue"`, but
  the enum is `('open','in_progress','completed','cancelled')` — overdue was always 0.
- **Fix:** derive overdue like `dashboard.service.ts:288–293` — an `open`/`in_progress`
  follow-up whose `scheduled_at < now` is overdue; `cancelled` is excluded.

### 3.6 HIGH-5 — import discards assignments, hardcodes gender, uses today as DOB

- **Root cause:** `import-export.service.ts` inserted `beneficiaries` directly, discarding
  the validated stage (no `beneficiary_assignments` row), hardcoded `gender: "male"`, and
  defaulted missing `date_of_birth` to today. The duplicate-name check was also
  case-sensitive (DB query `IN` on exact casing).
- **Fix:**
  - Stages now fetched with `service_id`; rows with a resolvable stage are created via
    the sanctioned `create_beneficiary_with_assignment` RPC (024) — beneficiary **and**
    current assignment are created atomically with an audit row.
  - Rows without a stage keep the plain insert (no assignment is possible without a stage);
    both paths use the schema backfill `'2000-01-01'` instead of today.
  - New optional `gender` column in the import (normalized `male`/`female`), validated in
    `validateBeneficiaryRows` (`invalidGenders`), surfaced in the preview UI, and passed
    through to the RPC.
  - Duplicate detection now fetches the church's active beneficiaries and compares
    case-insensitively in memory.
  - `src/types/database.types.ts` Functions map updated with the RPC signature (the file
    is maintained manually — no `supabase/config.toml` exists to regenerate from).

---

## 4. Migration 031 (additive, no destructive changes)

`supabase/migrations/031_production_remediation.sql` — one transaction:

1. `DROP POLICY super_admin_all ON user_roles` → recreate with `WITH CHECK` (F1).
2. `REVOKE`/`GRANT` on `public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb)` (F2).
3. `DROP POLICY recipient_scope_update ON notifications` (idempotent) → create
   `recipient_scope_update FOR UPDATE` (F3).

Applied locally via `psql`; recorded in `supabase_migrations.schema_migrations` as `031`.

---

## 5. Validation

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | pass |
| `npm run lint` | 0 errors, 6 warnings (pre-existing baseline) |
| `npm run build` | pass — 23 routes (incl. `/[locale]/servants`, `/api/cron/notifications`) |
| HIGH-1 live re-test | escalation blocked; legit grant allowed; cross-tenant blocked |
| HIGH-2 live check | anon/authenticated revoked; service_role granted |
| HIGH-3 live check | own update `UPDATE 1`; foreign update `UPDATE 0` |
| i18n audit | all 41 used namespaces resolve in `en` and `ar` |

Test fixture (churches, roles, profiles, users, notifications, user_roles) fully removed
after verification — local DB back to clean state (0 churches/profiles/users).

---

## 6. Rollback plan

**Database (migration 031)** — run in a single transaction on the target environment:

```sql
BEGIN;
-- F3: remove UPDATE policy, restoring SELECT-only notifications
DROP POLICY IF EXISTS recipient_scope_update ON notifications;
-- F2: restore default (PUBLIC) execute on write_audit_log
GRANT EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, uuid, jsonb, jsonb) TO anon, authenticated;
-- F1: restore super_admin_all WITHOUT WITH CHECK
DROP POLICY IF EXISTS super_admin_all ON user_roles;
CREATE POLICY super_admin_all ON user_roles FOR ALL USING (user_is_super_admin(church_id));
DELETE FROM supabase_migrations.schema_migrations WHERE version = '031';
COMMIT;
```

Order matters: drop `recipient_scope_update` first so the `notifications` UPDATE policy
regression is immediate; the `write_audit_log` GRANT restores the pre-fix exposure.
No data is modified by migration 031 (only policies/ACLs), so rollback is a no-op on data.

**Application code** — revert these files (they depend on no schema change):
- `src/features/notifications/actions/notification.actions.ts` (back to `NOTIFICATIONS_MANAGE`)
- `src/features/reports/services/reports.service.ts` (back to `status === "overdue"`)
- `src/features/import-export/services/import-export.service.ts`
- `src/features/import-export/types/import-export.types.ts`
- `src/features/import-export/schemas/import-export.schema.ts`
- `src/features/import-export/components/import-upload-area.tsx`
- `src/types/database.types.ts` (RPC entry)
- `src/messages/en.json`, `src/messages/ar.json`

If reverting CRIT-2 (message relocation) only, restore the `servants` block under
`users.servants` in both locales.

**Note:** the code and migration are independent — reverting either side does not require
reverting the other (e.g., keeping the app's `NOTIFICATIONS_READ` gate without migration
031's UPDATE policy just returns mark-read to the pre-fix silent no-op for non-managers).
