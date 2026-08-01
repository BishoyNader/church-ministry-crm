# Phase 3C — Implementation Readiness Verdict

**Phase:** 3C — Registration & Church Provisioning
**Date:** 2026-07-31
**Authority:** Final gate for database implementation, per Phase 3C.1 architecture validation + controlled specification amendment.
**Scope:** Specification readiness only. No code or migrations have been generated.

---

## 1. Approval Criteria

Per the Phase 3C.1 review, database implementation may proceed **only** if all of the following hold. Each criterion is mapped to the amended specification and to its regression test.

| # | Criterion | Status | Spec location | Regression test |
|---|---|---|---|---|
| 1 | Self-escalation path is closed | ✅ **Met** | C-1: `user_roles.tenant_isolation` → SELECT-only; only write paths are `super_admin_all`, SECURITY DEFINER RPCs, service-role client (`REGISTRATION_RBAC_IMPACT.md` §4.1; `PHASE_3C_SECURITY_REMEDIATION.md` §3) | R-1, R-2 |
| 2 | Self-approval path is closed | ✅ **Met** | C-2: `servants.tenant_isolation` → SELECT-only; approval only via `approve_servant`/`reject_servant` RPCs, plus RPC `auth.uid() <> p_servant_id` and structural no-role invariant (`REGISTRATION_RBAC_IMPACT.md` §4.2) | R-3, R-4 |
| 3 | Notification write bypass closed or explicitly documented | ✅ **Met** | C-3: `notifications.tenant_isolation` → SELECT-only; all creation via `send_notification` (SECURITY DEFINER); PO `church_id NULL` recipients supported (`REGISTRATION_RBAC_IMPACT.md` §4.6) | R-9, R-10 |
| 4 | Audit subsystem restoration is fully specified | ✅ **Met** | A4: recreate `audit_trigger_fn` (actor_id, TEXT action) + **6 triggers** (`profiles`, `user_roles`, `followups`, `attendance_sessions`, `attendance_records`, `beneficiaries`); drop dead `audit_attendance`; verification SQL (M-2: `audit_children` omitted — `children` → `beneficiaries` in 013) (`REGISTRATION_DATABASE_CHANGES.md` §8.1; `PHASE_3C_SECURITY_REMEDIATION.md` §4) | R-14, R-15 |
| 5 | Temporal role re-grant behavior is specified | ✅ **Met** | A3: **reactivation-first** re-approval + partial unique index `ON user_roles (church_id, user_id, role_id) WHERE end_date IS NULL` (`REGISTRATION_DATABASE_CHANGES.md` §4.4, §6.3) | R-13 |
| 6 | No invalid schema references remain | ✅ **Met** | A1: `roles.deleted_at` reference removed; role lookup relies on `UNIQUE (church_id, role_type)`. A2: `church_requests` immutable policies specified as permissive denies (not `RESTRICTIVE`). M-2: `audit_children → children` reference removed (A5) | R-11, R-12 |
| 7 | Pending-user access posture is documented consistently | ✅ **Met** | A6: **accept-and-document** — role-gated surfaces return 0 rows; the three 3C write surfaces (`user_roles`, `servants`, `notifications`) are denied; pre-existing church-scoped operational access is an accepted residual risk, excluded from the remediation guarantee (`PHASE_3C_SECURITY_REMEDIATION.md` §3.2–§3.3; `REGISTRATION_RBAC_IMPACT.md` §4.7/§5/§7; `REGISTRATION_WORKFLOW_SPEC.md` §3.2/§3.3) | R-8, R-8A |

---

## 2. Verdict

# ✅ APPROVED_FOR_MIGRATION_GENERATION

All seven approval criteria are satisfied by the amended specifications (Phase 3C.1 remediation C-1/C-2/C-3 + A1–A4, and Phase 3C.2 gate amendments A5–A10). The migration batch, as scoped in `REGISTRATION_DATABASE_CHANGES.md` §10 and `PHASE_3C_IMPLEMENTATION_PLAN.md` Phase 3C.1 (tasks 1.1–1.14), may be **generated**.

> Re-gated 2026-07-31 after amendments A5–A10; see `PHASE_3C_DATABASE_IMPLEMENTATION_GATE.md` §6 for the re-gate record. (Phase 3C.2 gate verdict is the authoritative record of the transition.)

## 3. Binding Conditions (non-negotiable at implementation)

1. **P0 items ship with the batch:** 0.1 (permission-constant re-sync), 0.2 (assignRoles end-date archival + reactivation-first + partial unique index), 0.3 (audit-trigger restoration) in the same release as the migration.
2. **The three `tenant_isolation` policy replacements** (`user_roles`, `servants`, `notifications` → SELECT-only) are part of the batch — not a follow-up.
3. **Audit verification SQL** (§A4) must pass on a scratch project before any live migration.
4. All public RPCs remain projection-limited and rate-limited.
5. No path may assign `super_admin` except the PO-gated provisioning RPC.
6. Regression tests R-1…R-15 (`PHASE_3C_SECURITY_REMEDIATION.md` §5) run against a scratch project with RLS-enforcing sessions; R-1/R-2/R-3/R-9/R-8A must show **DENIED** and R-8 must show **0 rows on role-gated surfaces**.

## 4. Open Items Not Blocking Database Implementation

| Item | Owner | Note |
|---|---|---|
| Notification center UI scope (minimal vs deferred) | Product | `PHASE_3C_IMPLEMENTATION_PLAN.md` §7 |
| Invite-link vs password-set-on-first-login | Product | §7; does not change DB surface |
| Phone required vs optional on forms | Product | DB columns already nullable |
| Rate limiting / honeypot deployment for `submit_church_request` | Platform | Deployment item 7.5 |

These are application/UX decisions; none affect the database schema, RLS, or RPC surface defined by the amended specs.
