# Phase 3C.3 — Staging Rollback Plan

**Phase:** 3C — Registration & Church Provisioning
**Stage:** 3C.3 — Staging Deployment Readiness Review
**Date:** 2026-08-01
**Target batch:** `supabase/migrations/023_phase3c_registration.sql`
**Basis:** migration 023 embedded ROLLBACK NOTES (023:934–957), `PHASE_3C_MIGRATION_EXECUTION_PLAN.md` §6 (R1–R5)
**Companion:** `PHASE_3C_STAGING_DEPLOYMENT_PLAN.md` (Step 0 backup), `PHASE_3C_STAGING_GO_LIVE_GATE.md`

---

## 1. Rollback Trigger Criteria

Rollback is initiated when **any** of the following is confirmed during Steps 3–6 of the deployment plan:

| # | Criterion | Evidence / detection point |
|---|---|---|
| RC-1 | **Apply failure with partial state** | Step 2 non-zero exit and S2.2 confirms partial objects (should not happen — single transaction; still verify) |
| RC-2 | **Schema verification failure (V1–V4)** | Step 3: any assertion in 023:878–919 fails (missing table/index/trigger, wrong policy cmd, `send_notification` executable by anon, `entity_id` NULL audit row, etc.) |
| RC-3 | **Workflow regression** | Step 4: any primary flow fails — EC-02 (approval), EC-03 (rejection), NC-02 (provisioning), NC-03 (rejection) — or `get_my_access_state` misreports state |
| RC-4 | **Security regression** | Step 5 / test matrix §4: SE-01/SE-02 (self-escalation succeeds), SE-03/SE-04 (self-approval succeeds), SE-05 (cross-church approval succeeds), SE-06/SE-07 (notification spoof / closed write surface opens), SE-13 (audit immutability breached) |
| RC-5 | **Audit continuity failure** | Test matrix §5: AU-01/02/03/04 fail (triggers missing, function uses old `user_id`, DML not audited) |
| RC-6 | **Data integrity anomaly** | `uq_user_roles_active` build failure (violated P0.4), duplicate active grants discovered post-apply, `approve_church_request` producing orphan church/profile/servant rows (would indicate a transaction-abort path defect) |
| RC-7 | **Operational instability** | Unbounded lock wait on the S8 index build, function error spikes, service-role writes failing against the 3 closed tables |
| RC-8 | **Sign-off gate failure** | Step 6 gate verdict = `REQUIRES_CHANGES` with a rollback-recommended severity, or approver invokes rollback |

**Decision rule:** any **HIGH or CRITICAL** trigger → rollback (prefer snapshot restore for speed). A **MEDIUM**
trigger (e.g., a single non-primary edge-case regression) → evaluate fix-forward first (§2 decision tree).

---

## 2. Rollback Decision Tree

```
Step 3–6 failure detected (RC-1 … RC-8)
  │
  ├─ Re-run the failing test once to confirm (avoid flaky false positives).
  │
  ├─ Classify severity:
  │    CRIT/HIGH  → ROLLBACK (immediate)
  │    MED        → is there a trivial, same-day fix-forward? (config, data, not code/DDL)
  │                    ├─ YES → fix-forward + re-run verification (log decision)
  │                    └─ NO  → ROLLBACK
  │    LOW        → record, continue to sign-off with the finding (never silently)
  │
  ├─ Select rollback path:
  │    PRIMARY:  Snapshot restore (Step 0 backup) — lossless, fastest, restores exact pre-batch state.
  │              Use when: quick exit, or in-place DDL blockers (RC-6 duplicates, RC-7 locks).
  │    SECONDARY: In-place reverse DDL (R0–R5) — prefer when: preserving post-batch data is NOT required
  │              and we want to keep the DB online with minimal downtime; exact-state fidelity for the
  │              batch's additions only.
  │
  └─ Execute (§3) → Verify (§4) → record outcome in the execution log and gate.
```

**Primary vs secondary trade-off:**
- **Snapshot restore** restores the entire DB to pre-batch — any rows written *after* the backup (test data,
  notifications, audit rows, any staging activity) are lost. Acceptable on staging; on production this window
  matters.
- **In-place reverse DDL (R0–R5)** removes only the 3C objects. Post-batch rows are **retained** — which is why
  R2 and R4 have preconditions (NULL-church rows / duplicate grants) that must be resolved first.

---

## 3. Rollback Execution Order

### 3.1 Primary path — snapshot restore (recommended)

| # | Action | Command / method | Notes |
|---|---|---|---|
| RB-0 | Enter maintenance mode | Stop app writes / disable the staging app (Vercel preview pause or env toggle) | Prevents new rows during restore |
| RB-1 | Restore full backup | `pg_restore --clean --if-exists -d <STAGING_DB_URL> <staging_023_pre_*.dump>` (or re-run the plain SQL dump) | Uses Step 0 backup (S0.1/S0.2) |
| RB-2 | Post-restore integrity | Verify row counts of the 5 snapshotted tables match the pre-batch counts recorded in S0.4 | Guards against a partial restore |
| RB-3 | Re-apply **only** if a prior migration had drifted | `supabase db push` up to 022 (no 023) | Confirms the DB returns to the 022 baseline |

### 3.2 Secondary path — in-place reverse DDL

Per the migration's embedded ROLLBACK NOTES (023:934–957). Execute in order; each step is separate.

| # | Reverse | SQL (exact) | Precondition / blocker |
|---|---|---|---|
| R0 | (same as RB-0) Enter maintenance mode | — | — |
| R1 | Drop `church_requests` (removes S1+S2: table, indexes, PK, CHECK, FK, trigger, 5 policies) | `DROP TABLE IF EXISTS church_requests;` | None — additive surface |
| R2 | Restore `notifications.church_id NOT NULL` | `ALTER TABLE notifications ALTER COLUMN church_id SET NOT NULL;` | **BLOCKED if any `church_id IS NULL` row exists** (PO-alert rows written post-deploy). First: `UPDATE notifications SET church_id = <default> WHERE church_id IS NULL;` or delete those rows — document the choice. This is the **rollback-critical column**. |
| R3 | Restore 022 policies exactly | `DROP POLICY IF EXISTS tenant_isolation ON user_roles; CREATE POLICY tenant_isolation ON user_roles FOR ALL USING (church_id = get_user_church_id());` … same for `servants`, `notifications` … `DROP POLICY IF EXISTS own_profile_insert ON profiles; CREATE POLICY own_profile_insert ON profiles FOR INSERT WITH CHECK (id = auth.uid());` | None — exact 022 definitions known |
| R4 | Drop partial index; restore UNIQUE constraint | `DROP INDEX IF EXISTS uq_user_roles_active; ALTER TABLE user_roles ADD CONSTRAINT user_roles_church_id_user_id_role_id_key UNIQUE (church_id, user_id, role_id);` | **BLOCKED if archived+active duplicate grants coexist** (reactivation-first RPCs prevent this; still verify): `SELECT 1 FROM user_roles GROUP BY church_id,user_id,role_id HAVING COUNT(*) FILTER (WHERE end_date IS NULL) > 1 AND COUNT(*) > 1;` — resolve (archive or dedupe) before re-adding |
| R5 | Drop 8 RPCs, 6 triggers, audit function | `DROP FUNCTION IF EXISTS reject_church_request(uuid,text), approve_church_request(uuid,uuid,text), reject_servant(uuid,text), approve_servant(uuid), submit_church_request(text,text,text,text,text,text,text), get_my_access_state(), list_churches_for_signup(), send_notification(uuid,uuid,text,text,text,text,text,jsonb,text);` then `DROP TRIGGER IF EXISTS audit_profiles ON profiles;` … (×6) … `DROP FUNCTION IF EXISTS audit_trigger_fn();` | Restores the **pre-batch (silently broken) audit state** — exact-state fidelity only; note this in the rollback log (pre-023, audit triggers were absent by design of 019) |

**Ordering note:** R1→R2→R3→R4→R5 matches the reverse dependency graph of S1–S12. R2 and R4 must never run
unchecked (their preconditions are the two irreversible-class risks IR-1/IR-2 from the deployment plan).

---

## 4. Rollback Verification

After either path, confirm the DB is back on the exact 022 baseline:

| # | Check | SQL / method | Pass criterion |
|---|---|---|---|
| RV-1 | Migration history back to 022 | `SELECT name FROM supabase_migrations ORDER BY version DESC LIMIT 3;` | last applied = `022…`; **no** 023 row |
| RV-2 | `church_requests` gone | `SELECT to_regclass('public.church_requests') IS NULL;` | `t` |
| RV-3 | `notifications.church_id` NOT NULL restored | `SELECT is_nullable FROM information_schema.columns WHERE table_name='notifications' AND column_name='church_id';` | `NO`; and **0 rows** with NULL church_id |
| RV-4 | Old UNIQUE constraint restored | `SELECT conname FROM pg_constraint WHERE conrelid='user_roles'::regclass AND contype='u';` | contains `user_roles_church_id_user_id_role_id_key`; `uq_user_roles_active` absent |
| RV-5 | Policies restored to 022 | `SELECT tablename, policyname, cmd FROM pg_policies WHERE policyname='tenant_isolation' AND tablename IN ('user_roles','servants','notifications');` | 3 rows, all `cmd='ALL'`; `own_profile_insert` qual = `(id = auth.uid())` |
| RV-6 | 3C functions gone | `SELECT count(*) FROM pg_proc JOIN pg_namespace n ON n.oid=pronamespace WHERE n.nspname='public' AND proname IN ('send_notification','list_churches_for_signup','get_my_access_state','submit_church_request','approve_servant','reject_servant','approve_church_request','reject_church_request','audit_trigger_fn');` | `0` |
| RV-7 | Audit triggers removed | `SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'audit\_%' AND NOT tgisinternal;` | `0` (pre-batch state) |
| RV-8 | Data integrity | Row counts on `profiles`, `user_roles`, `servants`, `notifications`, `audit_logs` match the pre-batch snapshot (S0.4) | all match (for snapshot restore); for in-place reverse, only 3C-created rows should differ |
| RV-9 | App functioning | Login + `/dashboard` + one CRUD flow with `SA_A` (existing users unaffected by the reversal) | flows pass |
| RV-10 | Audit gap documented | Confirm audit triggers are absent — the pre-batch silent gap is **restored by design** (not a new defect) | recorded in the rollback log |

---

## 5. Post-Rollback Reporting

- Record: trigger criterion (RC-#), severity, rollback path (primary/secondary), timestamps, verification
  results (RV-1…RV-10), and any preconditions exercised (R2/R4 resolution choices).
- Update `PHASE_3C_STAGING_GO_LIVE_GATE.md` verdict to `ROLLED_BACK` with the reason.
- Add the failure to the next iteration's analysis (fix the migration or its preconditions, re-audit, re-run
  the staging package).
