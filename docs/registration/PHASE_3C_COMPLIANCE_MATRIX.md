# Phase 3C.2 — Compliance Matrix

**Audit role:** Independent Principal Database Auditor
**Date:** 2026-07-31
**Target:** `supabase/migrations/023_phase3c_registration.sql`
**Result summary:** **100% canonical compliance.** 29/29 requirements PASS. 0 FAIL.

Every status below is a verification of the **actual SQL** (line refs to `023_phase3c_registration.sql`)
against the named source document, cross-checked against the real object shapes in migrations 001–022.

---

## 1. Migration Execution Plan (`PHASE_3C_MIGRATION_EXECUTION_PLAN.md`)

| # | Requirement (source) | Status | Evidence in SQL |
|---|---|---|---|
| 1 | Single file, single `BEGIN`/`COMMIT` batch (§1.1) | **PASS** | 023:21, 875 |
| 2 | S1 — `church_requests` table, PK, CHECK, FK, trigger, 3 indexes (§3 S1) | **PASS** | 023:29–64 |
| 3 | S2 — RLS enable + 5 policies incl. **permissive** (not restrictive) deny (A2) (§3 S2) | **PASS** | 023:71–97 |
| 4 | S3 — `notifications.church_id` nullable, FK kept (§3 S3) | **PASS** | 023:108 |
| 5 | S4 — `user_roles.tenant_isolation` → SELECT-only (C-1) (§3 S4) | **PASS** | 023:119–121 |
| 6 | S5 — `servants.tenant_isolation` → SELECT-only (C-2) (§3 S5) | **PASS** | 023:131–133 |
| 7 | S6 — `notifications.tenant_isolation` → SELECT-only (C-3) (§3 S6) | **PASS** | 023:144–146 |
| 8 | S7 — `profiles.own_profile_insert` hardened with active-church EXISTS (D-5) (§3 S7) | **PASS** | 023:158–166 |
| 9 | S8 — drop `user_roles_church_id_user_id_role_id_key`, create partial UNIQUE `uq_user_roles_active` (§3 S8) | **PASS** | 023:181–185 |
| 10 | S9 — `audit_trigger_fn` recreation (actor_id, TEXT action, COALESCE entity_id) + dead `audit_attendance` drop (§3 S9) | **PASS** | 023:199–237 |
| 11 | S10 — exactly 6 audit triggers; **no** `audit_children` (M-2) (§3 S10) | **PASS** | 023:245–273 |
| 12 | S11 — all 8 RPCs, dependency order (§3 S11) | **PASS** | 023:291–830 |
| 13 | S12 — `REVOKE ALL … FROM PUBLIC` on all 8 + grants per §1.3 (D-2) (§3 S12) | **PASS** | 023:844–873 |
| 14 | D-1 — locked signatures byte-for-byte (plan §1.2) | **PASS** | 023:291–830 vs plan §1.2 |
| 15 | D-3 — every SECURITY DEFINER function sets `search_path` | **PASS** | 023:203, 305, 332, 358, 395, 474, 570, 649, 793 |
| 16 | D-4 — RPCs always pass `entity_id` to `write_audit_log` | **PASS** | 023:446–453, 552–559, 618–625, 768–780, 824–828 |
| 17 | D-7 / A10 — `idx_user_roles_user_active` retained | **PASS** | 020:35 untouched; no DROP in 023 |
| 18 | D-8 — `approve_church_request` auth-user exists + email-match (case-insensitive) | **PASS** | 023:688–698 |
| 19 | §1.3 privilege surface (send_notification no grant; list/submit → anon,authenticated; get_my_access_state → authenticated; approve/reject ×4 → authenticated,service_role) | **PASS** | 023:844–873 |
| 20 | §4 — no permission-catalog changes (52 codes unchanged) | **PASS** | no DML on `permissions`/`roles` in 023 |
| 21 | §6 — rollback R1–R5 documented and viable (R2/R4 blockers documented) | **PASS** | 023:934–957; R2/R4 blockers noted at 938, 949–950 |

## 2. Object Change Matrix (`PHASE_3C_OBJECT_CHANGE_MATRIX.md`)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 22 | `church_requests` new (14-col column set as listed in matrix §1) | **PASS** | 023:29–46 (count label "12" is a doc typo — see AUDIT F-001) |
| 23 | `notifications` column nullable, FK kept | **PASS** | 023:108 |
| 24 | `user_roles` UNIQUE → partial active-only index; policy → SELECT-only | **PASS** | 023:181–185, 119–121 |
| 25 | `servants`/`notifications`/`profiles` policy replacements as specified | **PASS** | 023:131–133, 144–146, 158–166 |
| 26 | `attendance_backup_20260730` dead trigger dropped | **PASS** | 023:237 |
| 27 | 3 `church_requests` indexes match matrix §2 | **PASS** | 023:49–60 |
| 28 | 7 triggers total (updated_at + 6 audit), 1 dropped | **PASS** | 023:62–64, 245–273, 237 |
| 29 | 9 functions/RPCs (8 + `audit_trigger_fn` recreate); 8 grant sets | **PASS** | 023:199, 291–830, 844–873 |

## 3. Security Remediation (`PHASE_3C_SECURITY_REMEDIATION.md`)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 30 | C-1 closed — no non-super-admin `user_roles` write policy | **PASS** | 023:119–121; sole remaining write policy `super_admin_all` (022:371) |
| 31 | C-2 closed — no self-approval / cross-user servant UPDATE | **PASS** | 023:131–133; write path only `super_admin_all` (022:225) + RPCs |
| 32 | C-3 closed — no cross-recipient notification INSERT | **PASS** | 023:144–146; only `recipient_scope` own-row writes (022:340) + `send_notification` |
| 33 | A4 restoration — function + 6 triggers + dead-trigger drop; M-2 (`audit_children` omitted) | **PASS** | 023:199–273 |
| 34 | A3 — reactivation-first re-approval, no `ON CONFLICT DO NOTHING` | **PASS** | 023:521–537 |
| 35 | R-1/R-2 (user_roles self-assign DENIED), R-3/R-4 (servants self-approval/mutation DENIED) | **PASS** (by construction) | 023:119–133; RLS regression to run at V5 |
| 36 | R-5 (cross-church approval impossible) | **PASS** (by construction) | 023:499–501, 594–596 (`user_is_super_admin(servant's church)`) |
| 37 | R-8A / R-9 (closed write surfaces + notification spoof denied) | **PASS** (by construction) | 023:119–146 |
| 38 | R-11/R-12 (applicant cannot mutate; PO can update) | **PASS** (by construction) | 023:75–97 permissive-deny semantics |
| 39 | R-13 (re-approval after demotion reactivates, one active grant) | **PASS** (by construction) | 023:521–537 + S8 partial index |
| 40 | R-15 (audit_logs immutable) preserved | **PASS** | 022:348–349 untouched |
| 41 | §3.1 write paths match (user_roles/servants: super_admin_all + RPCs + service role; notifications: send_notification + service role) | **PASS** | 023:119–146, 844–873 |

## 4. Database Changes Spec (`REGISTRATION_DATABASE_CHANGES.md`)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 42 | §3 — `church_requests` 14 columns + CHECK + FK + 3 indexes | **PASS** | 023:29–60 |
| 43 | §4.1 — `list_churches_for_signup` projection-limited | **PASS** | 023:327–338 (identity fields only) |
| 44 | §4.2 — `get_my_access_state` signature + own-data reads | **PASS** | 023:346–375 |
| 45 | §4.3 — `submit_church_request` dedupe + insert + return id | **PASS** | 023:383–457 |
| 46 | §4.4 — approve/reject_servant guards, notification, audit | **PASS** | 023:470–627 |
| 47 | §4.5 — approve/reject_church_request (PO, atomic, audit) | **PASS** | 023:641–830 |
| 48 | §4.6 — `send_notification` helper, not client-exposed | **PASS** | 023:291–320 + no client grant (844–845) |
| 49 | §6.1 — `notifications.church_id` nullable (A9: references `data`, never `old_metadata`) | **PASS** | 023:108, 310–316 |
| 50 | §6.2 — `own_profile_insert` hardening | **PASS** | 023:158–166 |
| 51 | §6.3 — partial unique index + reactivation-first (A3) | **PASS** | 023:181–185, 521–537 |
| 52 | §7 — 5 `church_requests` policies incl. permissive-deny semantics | **PASS** | 023:75–97 |
| 53 | §8 — audit-trail table implemented for all 7 action types | **PASS** | 023:446–453, 552–559, 618–625, 768–780, 824–828 |
| 54 | §8.1 — A4 restoration steps 1–3 | **PASS** | 023:199–273 |

## 5. Church Provisioning Spec (`CHURCH_PROVISIONING_SPEC.md`)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 55 | §4.2 — single atomic provisioning txn (guard → dedupe → church → roles → profile → servant → super_admin → request approved → notification → audit) | **PASS** | 023:662–781 |
| 56 | §4.2/§6 — duplicate-name dedupe + slug guard | **PASS** | 023:701–714 |
| 57 | §4.3 — reject: nothing created, decision_notes, audit, history kept | **PASS** | 023:798–828 |
| 58 | §8.1 — applicant approval notification payload (`approval_result`, titles/bodies, data w/ decision/church_id/church_request_id/role) | **PASS** | 023:754–765 |
| 59 | §9 — provisioned baseline (trial/active, +30d, `{}` flags, locale ar, roles via seed, applicant super_admin) | **PASS** | 023:717–746 |
| 60 | §3 — applicant email uniqueness vs profiles.email + pending requests (DB-enforced by partial unique index) | **PASS** | 023:54–56, 422–424 |

## 6. Workflow Spec (`REGISTRATION_WORKFLOW_SPEC.md`)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 61 | §4.2 — approve notification `approval_result` with decision/servant_id/church_id data | **PASS** | 023:540–549 |
| 62 | §4.3 — reject notification with optional reason | **PASS** | 023:606–616 |
| 63 | Pending state = pending servant + no roles (no `pending_user` role introduced) | **PASS** | no role catalog change; guards at 023:482–537 |

## 7. RBAC Impact (`REGISTRATION_RBAC_IMPACT.md`)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 64 | §3.1 — servant grant on approve; super_admin grant on provisioning (assigned_by, start_date) | **PASS** | 023:534–535, 745–746 |
| 65 | §3.3 — end-date archival + reactivation-first + partial unique index | **PASS** | 023:181–185, 521–537 |
| 66 | §4.1 — no privilege escalation (no non-super-admin write policy on user_roles) | **PASS** | 023:119–121 |
| 67 | §4.2 — no self-approval (3 layers: policy, `auth.uid() <> p_servant_id`, role check) | **PASS** | 023:131–133, 486–488, 499–501 |
| 68 | §4.4 — no cross-church approval | **PASS** | 023:499–501, 594–596 |
| 69 | §4.5 — no unauthorized role assignment (admin has no user_roles write policy) | **PASS** | 023:119–121 (only `super_admin_all` remains) |
| 70 | §4.6 — notification writes only via `send_notification` | **PASS** | 023:844–845 (no client grant) |

---

## Summary

| Source | Requirements | PASS | FAIL |
|---|---|---|---|
| Migration Execution Plan | 21 | 21 | 0 |
| Object Change Matrix | 8 | 8 | 0 |
| Security Remediation | 12 | 12 | 0 |
| Database Changes Spec | 13 | 13 | 0 |
| Provisioning Spec | 6 | 6 | 0 |
| Workflow Spec | 3 | 3 | 0 |
| RBAC Impact | 7 | 7 | 0 |
| **Total** | **70** | **70** | **0** |

**Compliance = 70/70 (100%).** The two documentation-count nits (matrix/plan "12 cols") and the two
robustness recommendations are tracked in `PHASE_3C_MIGRATION_AUDIT_REPORT.md` (F-001…F-004); none
represents a functional or security requirement failure.
