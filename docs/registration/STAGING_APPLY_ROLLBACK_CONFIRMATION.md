# Phase 3C.2A.5 — Staging Apply Rollback Confirmation

**Basis:** `PHASE_3C_STAGING_ROLLBACK_PLAN.md` + actual 023 reversal notes (R1–R5, `023:934–957`).
**Invoked only when:** a checklist/verification HALT fires and triage confirms the fault is caused by 023 (not an external cause — e.g., connectivity, unrelated data issue).

**CRITICAL:** `supabase db reset` is **forbidden** on staging (it recreates the schema from migrations and would drop application data). Rollback = **restore from the Step 1 backup** (primary), with the migration's manual reversals (secondary) for in-place reversal when a full restore is undesirable.

---

## 1. Trigger criteria (RC-1…RC-8)

| ID | Trigger | Where detected |
|---|---|---|
| RC-1 | Partial apply state (though 023 is atomic, any post-check showing mixed state) | Checklist Step 4 / V0 |
| RC-2 | V1–V4 database verification failure | Verification plan Step 5 |
| RC-3 | Workflow regression: EC-02/EC-03, NC-02/NC-03 | Checklist Step 6 / V6 |
| RC-4 | Security regression: any SE-01…SE-15 | Checklist Step 7 / V5 |
| RC-5 | Audit regression: audit rows not written, or immutability broken | V4 |
| RC-6 | Data-integrity anomaly (e.g., duplicate active grants, orphan rows) | V2/V3 probes, QA |
| RC-7 | Negative-case leak: NC-02a/02b created rows that should not exist | V6 |
| RC-8 | App regression after type regen that traces to 023 schema (tsc/build red + confirmed cause) | Checklist Step 8 |

**Decision rule:** ≥1 trigger fires **and** triage attributes it to 023 ⇒ initiate rollback. A single cosmetic divergence (e.g., V4 trigger-count 7 because Step 3 was skipped) is **not** a trigger — log it, adjust the assertion, continue.

---

## 2. Rollback decision tree

```
Fault found
  ├─ External cause? ──────────────→ fix external cause; resume, do NOT rollback
  └─ 023-caused?
       ├─ Full DB restore acceptable (window available)?
       │     └─ YES → PRIMARY: pg_restore of pre-apply dump  (Section 3)
       └─ No → SECONDARY: in-place R1–R5 reversal (Section 4)
               + re-apply NOT via db push (out-of-band), triage first
```

---

## 3. PRIMARY — Snapshot restore

Restores the exact pre-apply state captured in `STAGING_APPLY_CHECKLIST.md` Step 1.

```bash
# Full-dump restore (custom format, --clean --if-exists re-creates schema, drops 023 objects)
pg_restore --clean --if-exists --no-owner -d "$STAGING_DB_URL" staging_023_pre_<ts>.dump

# Migration tracking: remove the 023 row so re-apply is clean later
psql "$STAGING_DB_URL" -c "DELETE FROM supabase_migrations.schema_migrations WHERE version='023';"

# Verify (Section 5) then re-apply only after triage of the original failure
```

**Pass criteria:** pg_restore exit 0; pre-apply schema object counts restored; app smoke passes.

---

## 4. SECONDARY — In-place reversal (migration R1–R5, `023:934–957`)

Uses the migration's own authoritative reverse DDL, in its numbered order. Function signatures are exact (verified against 023).

| Step | Reverse action | SQL (exact, from 023:934–957) |
|---|---|---|
| R5 | Drop all 8 RPCs + audit function + 6 audit triggers (restores the pre-batch, silently-broken audit state — exact-state fidelity only) | `DROP FUNCTION reject_church_request(uuid, text), approve_church_request(uuid,uuid,text), reject_servant(uuid,text), approve_servant(uuid), submit_church_request(text,text,text,text,text,text,text), get_my_access_state(), list_churches_for_signup(), send_notification(uuid,uuid,text,text,text,text,text,jsonb,text);` then `DROP TRIGGER IF EXISTS audit_profiles ON profiles; DROP TRIGGER IF EXISTS audit_user_roles ON user_roles; DROP TRIGGER IF EXISTS audit_followups ON followups; DROP TRIGGER IF EXISTS audit_attendance_sessions ON attendance_sessions; DROP TRIGGER IF EXISTS audit_attendance_records ON attendance_records; DROP TRIGGER IF EXISTS audit_beneficiaries ON beneficiaries;` then `DROP FUNCTION audit_trigger_fn();` |
| R4 | Replace partial unique with full UNIQUE (S8) | `DROP INDEX uq_user_roles_active;` `ALTER TABLE user_roles ADD CONSTRAINT user_roles_church_id_user_id_role_id_key UNIQUE (church_id, user_id, role_id);` — **BLOCKED if any archived+duplicate active grants exist; verify with PF-22 first** |
| R3 | Restore 022 policies exactly (S5) | `DROP POLICY tenant_isolation ON user_roles; CREATE POLICY tenant_isolation ON user_roles FOR ALL USING (church_id = get_user_church_id());` and same FOR ALL recreate for `servants`, `notifications`; `DROP POLICY own_profile_insert ON profiles; CREATE POLICY own_profile_insert ON profiles FOR INSERT WITH CHECK (id = auth.uid());` |
| R2 | Re-require `church_id` (S3) | `ALTER TABLE notifications ALTER COLUMN church_id SET NOT NULL;` — **BLOCKED if any `church_id IS NULL` row exists (PO alert); clear/reassign first** |
| R1 | Drop 3C tables (S1+S2) | `DROP TABLE church_requests;` (also drops its 3 indexes + 3 policies) |

**Note on `servant_approvals`/`servant_rejections`:** the migration's R-notes do not reverse them (empty reference tables). Drop only if exact-state fidelity demands it: `DROP TABLE IF EXISTS servant_approvals; DROP TABLE IF EXISTS servant_rejections;` — they hold no data and no references from any retained object.

**Caution on R5:** it destroys `audit_trigger_fn` — the pre-batch function was **broken** (dropped `audit_action` type dependency). R5 intentionally restores that silently-broken state for exact fidelity. If you instead want a working audit trail post-rollback, use the PRIMARY snapshot restore (Section 3) which restores the pre-apply filesystem state. Record which choice was made.

---

## 5. Post-rollback verification (RV)

Re-run the amended verification plan; the following must be **true**:

| ID | Assertion | Expectation |
|---|---|---|
| RV-1 | `church_requests` absent | `to_regclass(...) IS NULL` → t |
| RV-2 | Migration history top = 022 (023 row removed) | t |
| RV-3 | `notifications.church_id` NOT NULL | `is_nullable` = NO |
| RV-4 | `user_roles_church_id_user_id_role_id_key` present, `uq_user_roles_active` absent | t |
| RV-5 | 8 RPCs + `audit_trigger_fn` dropped (R5) | `to_regprocedure` all NULL |
| RV-6 | 6 audit triggers gone; `audit_children`/`audit_attendance` stray state as-baseline | R5 drops list empty |
| RV-7 | **Fidelity note:** baseline audit state is **broken by design** (stale `audit_trigger_fn` → no audit writes). R5 restores exactly that. If a working audit trail is required post-rollback, use the PRIMARY snapshot restore (Section 3) instead. | documented |

**RV overall:** all t ⇒ environment returned to the verified 022 baseline; close the incident; root-cause before re-attempting 023.

---

## 6. Post-rollback hygiene

1. Re-verify app smoke (login, dashboard, 2A.4 admin flows) against restored state.
2. Keep the pre-apply backup sealed until the next successful apply.
3. Do **not** re-apply 023 until the root cause of the trigger is documented and fixed.
4. Log the rollback in `docs/registration/` incident log with the trigger ID (RC-n) and evidence.
