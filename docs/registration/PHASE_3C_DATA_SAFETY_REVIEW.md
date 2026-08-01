# Phase 3C.1 — Data Safety Review

**Phase:** 3C — Registration & Church Provisioning
**Date:** 2026-07-31
**Basis:** migration batch as designed in `PHASE_3C_MIGRATION_EXECUTION_PLAN.md` (single transactional file `023`, steps S1–S12).

---

## 1. Proof: no data loss

The batch performs **no destructive data operations** on existing rows:

| Category | Statements in batch | Existing data affected |
|---|---|---|
| CREATE TABLE / INDEX / POLICY / TRIGGER / FUNCTION | all of S1, S2, S8(create), S9(create), S10, S11, S12 | **none** |
| ALTER column | S3 `DROP NOT NULL` — metadata-only, no table rewrite, no scan | **none** (no value changed) |
| DROP POLICY | S4–S7 (four policies) | none — RLS artifacts, no rows |
| DROP CONSTRAINT | S8 `user_roles` UNIQUE — removes a uniqueness guarantee, replaces with the partial `uq_user_roles_active` | none; the new index is **strictly weaker** (only enforces active rows), so every existing row trivially satisfies it |
| DROP TRIGGER | S9 `audit_attendance` on the retired backup table | none (dead trigger) |
| DML on existing tables | **none** | **none** |

- No `DELETE`/`UPDATE`/`INSERT` touches pre-existing rows.
- `uq_user_roles_active` cannot fail on existing data: the old non-partial UNIQUE is a superset constraint, so existing `(church_id,user_id,role_id)` values are already unique even including archived rows (guarded again by pre-flight P0.4).
- The only "loss" is the removed `audit_attendance` trigger on the retired `attendance_backup_20260730` table (015 backup artifact) — intentional, no audit value in it.
- Rollback baseline: P0.6 snapshot; reverse DDL in execution plan §6 restores exact pre-batch state.

**Verdict: no data loss.**

---

## 2. Proof: no tenant-isolation break

Every policy change is **strictly more restrictive** for the actors it affects; no policy is broadened; no table's `tenant_isolation` on other tables is touched:

| Change | Before | After | Restriction direction |
|---|---|---|---|
| `user_roles.tenant_isolation` | FOR ALL (SELECT+INSERT+UPDATE+DELETE) | FOR SELECT only | SELECT preserved; writes removed except `super_admin_all` + SECURITY DEFINER RPCs |
| `servants.tenant_isolation` | FOR ALL | FOR SELECT only | reads preserved (own row still via `admin_read`); writes restricted to `super_admin_all` + RPCs |
| `notifications.tenant_isolation` | FOR ALL | FOR SELECT only | own-row reads still fully covered by `recipient_scope`; cross-recipient writes removed |
| `profiles.own_profile_insert` | `WITH CHECK (id = auth.uid())` | adds active-church `EXISTS` | stricter (fail-closed, D-5) |
| `church_requests` (new) | n/a | 5 policies | public INSERT is `status='pending'`-constrained; PO ALL; applicant SELECT own-email only; review/delete immutably denied to all non-PO |

Cross-church access is unchanged and remains denied: `tenant_isolation` predicates are all `church_id = get_user_church_id()` (church-scoped), and the three replacements keep that predicate. `get_user_church_id()` is church-scoped. No statement grants any role access outside its own church, and no new policy widens scope. Existing church-scoped read behavior for super_admins (via `super_admin_all` / `admin_read` / `own_read` / `recipient_scope` / `tenant_isolation` SELECT) is **preserved for every legitimate role** — no existing user loses the reads they have today.

**Known accepted residual (documented, not introduced by this batch):** pending users retain same-church church-scoped access via the *other* 022 `tenant_isolation` FOR ALL policies (services, stages, beneficiaries, …). This pre-existing posture is accepted residual risk per gate amendment A6 (`PHASE_3C_SECURITY_REMEDIATION.md` §3.3) and is **explicitly out of scope** for this batch. It is not a regression introduced here.

**Verdict: no tenant-isolation break; no access is broadened.**

---

## 3. Proof: no privilege-escalation path

| Vector | Closure |
|---|---|
| Self-assign `super_admin` via `user_roles` INSERT (C-1) | `user_roles.tenant_isolation` no longer authorizes INSERT; the only write paths left are `super_admin_all` (same-church super_admin) and SECURITY DEFINER RPCs with internal actor guards, and the service-role admin client. Pending users cannot write role rows (verified R-1/R-2/R-8A) |
| Self-approve / mutate same-church servant rows (C-2) | `servants.tenant_isolation` SELECT-only; writes via `super_admin_all` + guarded RPCs (`auth.uid() <> p_servant_id`, church-scoped `user_is_super_admin`, status-idempotency). Pending users cannot flip `approval_status` (R-3/R-4) |
| Notification spoofing (C-3) | `notifications.tenant_isolation` SELECT-only; all creation funnelled through `send_notification` (SECURITY DEFINER, **no client EXECUTE grant**, D-2). Direct client INSERT impossible (R-9) |
| New RPC bypass | All 8 RPCs are SECURITY DEFINER but re-check the actor **inside** the function (`user_is_platform_owner` / `user_is_super_admin(servant.church_id)`); they do not grant by session trust. `approve_church_request` additionally validates the auth user's email against the request (D-8). `send_notification` has no client grants at all |
| Orphan-helper adoption | `user_has_permission`, `get_user_servant_id`, `get_user_assigned_beneficiary_ids` are **not** used by any new RPC (dependency-graph rule), so their flaws (non-church-scoped, not `end_date`-aware, catalog-unaware) cannot enter the 3C path |
| Public `church_requests` INSERT | constrained to `status='pending'`; review fields spoofable at submit but overwritten by the review RPCs (N-10, cosmetic); no row can reach `approved`/`rejected` except via PO RPCs |
| `roles`/`role_permissions` | unchanged (`tenant_isolation` FOR ALL is same-church); no new write path added |

The four policy replacements remove write scopes; the RPCs are the audited chokepoints; the three worst escalation paths (C-1/C-2/C-3) are closed and regression-tested (R-1…R-5, R-8A, R-9).

**Verdict: no privilege-escalation path introduced; the three known vectors are closed.**

---

## 4. Proof: no audit gap after deployment

| Component | Before batch | After batch | Continuity |
|---|---|---|---|
| `write_audit_log()` | present (019), unused by app (app inserts directly) | **unchanged**; now the RPCs' audit path | Continuous |
| `audit_trigger_fn()` + `audit_profiles`/`audit_user_roles`/`audit_followups` | **absent** since 019 CASCADE — silent gap | recreated (S9/S10) | Gap **closed** at migration commit |
| `audit_beneficiaries` / `audit_attendance_sessions` / `audit_attendance_records` | never existed | created | Coverage added |
| `audit_children` → `children` | invalid target (013 rename) | **not created**; coverage via `audit_beneficiaries` (M-2/A5) | Correct target |
| App direct `audit_logs` INSERTs (5 call sites) | present | **unchanged** — `append_only` policy permits them; no policy touched | Continuous |
| RPC-driven writes | n/a | each RPC writes explicit audit rows (`entity_id` always passed, D-4) | Trusted path established |
| `church_requests` audit | n/a | via RPC writes only (submit + approve/reject + church create) | Covered (no table trigger; RPC-explicit) |

Verification: V4 smoke (DML on all six trigger tables → `audit_logs` rows with correct `entity_type`, `action`, NOT NULL `entity_id`) and V6 flow smoke (approve → `action='approve'`). The batch **closes** the pre-existing silent gap rather than creating one.

**Verdict: audit gap is closed at deployment; no new gap introduced.**

---

## 5. Highest-risk statement

**`CREATE UNIQUE INDEX uq_user_roles_active ON user_roles (church_id, user_id, role_id) WHERE end_date IS NULL;` (S8)**

- The only statement that scans **existing rows** under ACCESS EXCLUSIVE.
- It fails the whole transaction if any pre-existing *duplicate active grant* exists — impossible under the old UNIQUE constraint, but the batch must still guard with P0.4.
- It is paired with `DROP CONSTRAINT` in the same transaction; if the create fails, the drop is rolled back too (no intermediate loss of uniqueness).

Mitigations: P0.4 pre-flight (0 duplicates expected), scratch-first (V), backup (P0.6). After S8, uniqueness on active grants is enforced by the index; archived rows are exempt (by design, A3).

**Secondary high-risk:** `approve_church_request` (S11-7) — cross-schema (auth.users validation D-8), atomic provisioning of 5+ entities in one transaction, and it is the only path that writes `churches`. Failure risk is controlled by: email-match guard, status-idempotency, single-transaction atomicity, and scratch flow smoke (V6). Not a migration-apply risk (it is a runtime RPC, created additively).

---

## 6. Longest lock operation

**S8 `CREATE UNIQUE INDEX uq_user_roles_active`** — ACCESS EXCLUSIVE on `user_roles` for the duration of the scan + uniqueness validation. `user_roles` is small (role grants), expected sub-second.

Because the entire batch is one transaction, **all** AX locks taken by S1–S12 (church_requests, notifications, user_roles, servants, profiles, six audit target tables) are held until COMMIT. None of these tables is high-traffic; concurrent writers are blocked only during the (short) migration window. Deployment should still run outside peak hours and take a maintenance window for the batch (execution plan §3 legend + §6).

---

## 7. Rollback-critical objects

| Object | Why critical | Rollback guard |
|---|---|---|
| `uq_user_roles_active` | must be dropped and the `user_roles_church_id_user_id_role_id_key` UNIQUE constraint re-added to restore uniqueness guarantees | R4; blocked if archived+active duplicates exist (reactivation-first RPCs never create them; verify with a count query before rollback) |
| `notifications.church_id` NOT NULL | restoring it **fails** if PO-alert rows with `church_id IS NULL` exist | R2; delete/reassign NULL-church rows before `SET NOT NULL` |
| 4 replaced policies (`user_roles`/`servants`/`notifications` `tenant_isolation`, `profiles.own_profile_insert`) | exact 022 definitions must be restored, or security posture changes | R3; exact SQL in `PHASE_3C_OBJECT_CHANGE_MATRIX.md` §4 |
| 8 RPCs | dropping them removes the 3C write path; if dropped before the app is rolled back, approvals fail | R5; drop after app rollback |
| `audit_trigger_fn` + 6 triggers | restore pre-batch (broken) state = drop them; leaving them after an app rollback is harmless (defense-in-depth) | R5 |

Rollback strategy = restore P0.6 snapshot (primary) or reverse DDL in execution plan §6 (R1–R5).

---

## 8. Validation rules checklist

| Rule | Status | Evidence |
|---|---|---|
| Existing production data remains valid | ✅ | No DML on existing rows; constraint replacement is superset-proof (§1, P0.4) |
| Existing users keep access | ✅ | SELECT paths preserved for every role on the 4 replaced policies; no policy on any other table changed (§2) |
| Existing churches unaffected | ✅ | `churches` untouched (no column/index/policy/data change) |
| Existing servant assignments unaffected | ✅ | `servant_stage_assignments`/`beneficiary_assignments` untouched; `servants` read access preserved |
| Existing roles unaffected | ✅ | `roles`/`role_permissions` untouched; catalog stays at 52 codes |
| Existing permissions unaffected | ✅ | `permissions` catalog untouched; no seeding changes (execution plan §4) |
| Audit continuity preserved | ✅ | Gap closed at commit; `write_audit_log` unchanged; app direct INSERTs still permitted (§4) |
| Registration feature fully supported | ✅ | `church_requests` + 8 RPCs + policies + notifications nullable + PO/approval write paths (S1–S12; V6 smoke) |
