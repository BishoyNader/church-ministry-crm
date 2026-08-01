# Phase 3C — Implementation Plan

**Phase:** 3C — Registration & Church Provisioning  
**Date:** 2026-07-31  
**Status:** Approved architecture / implementation plan

---

## 1. Architecture Recommendation (Summary)

Adopt the **approval-state model**: the pending user is a real `servants` row with `approval_status='pending'`, owns a `profiles` row with a real `church_id`, and holds **no role rows** until approval. New-church registration is a lightweight, unauthored `church_requests` row reviewed by the platform owner; approval provisions the church, its roles, the account, and the initial `super_admin` in one atomic transaction.

- **Existing-church path** reuses `servants.approval_status`, `servants.approve` permission, and the `super_admin` who owns that church.
- **New-church path** reuses `seed_church_roles()`, the PO-only `tenants.*` permissions, and `audit_logs`.
- **One new table** (`church_requests`) + **8 RPCs** (7 client-facing + the `send_notification` helper) + **1 nullable column** (`notifications.church_id`) is the entire DB surface.

Three pre-existing canonical violations must be fixed within 3C because they would otherwise break the flow (see §4).

---

## 2. Delivery Phases

### Phase 3C.0 — Pre-requisites (P0, do first)

| # | Task | Why it blocks | Complexity | Risk |
|---|---|---|---|---|
| 0.1 | Re-sync frontend `PERMISSION_CODES` to the canonical 52; audit every `PermissionGuard`/`hasPermission` call site | Stale codes break UI gating and actions today | M | High |
| 0.2 | Replace `assignRoles` DELETE with `end_date` archival; implement **reactivation-first** re-approval (A3); replace non-partial UNIQUE constraint with partial unique index on active grants | Temporal model + last path that loses role grants + silent re-promotion failure | M | Medium |
| 0.3 | Recreate `audit_trigger_fn` (actor_id, TEXT action) + all dependent audit triggers; verify with smoke SQL (A4) | Silent audit gap since migration 019 CASCADE dropped the function and 5 triggers | M | High |

### Phase 3C.1 — Database (migration batch 1)

| # | Task | Complexity | Risk |
|---|---|---|---|
| 1.1 | `CREATE TABLE church_requests` + constraints + indexes | L | Low |
| 1.2 | `ALTER TABLE notifications ALTER COLUMN church_id DROP NOT NULL` | S | Low |
| 1.3 | RLS policies for `church_requests` (PO-all, applicant-read, public insert, **permissive-deny** immutable review/delete — A2) | S | Low |
| 1.4 | `list_churches_for_signup()` (SECURITY DEFINER, projection-limited) | S | Low |
| 1.5 | `get_my_access_state()` | S | Low |
| 1.6 | `submit_church_request()` (dedupe + insert) | S | Low |
| 1.7 | `approve_servant` / `reject_servant` (guards, role grant with **reactivation-first** re-approval — A1/A3; notification; audit) | M | Medium |
| 1.8 | `approve_church_request` / `reject_church_request` (atomic provisioning, `seed_church_roles`, account+super_admin creation) | M | Medium |
| 1.9 | `send_notification` helper (SECURITY DEFINER — sole notification write path) | S | Low |
| 1.10 | Harden `profiles.own_profile_insert` (`WITH CHECK` real active church) | S | Low |
| 1.11 | **Policy replacements (C-1/C-2/C-3):** `user_roles`, `servants`, `notifications` `tenant_isolation` → SELECT-only | S | Low |
| 1.12 | **Audit restoration (A4):** recreate `audit_trigger_fn` (actor_id, TEXT) + **6 triggers** (`profiles`, `user_roles`, `followups`, `attendance_sessions`, `attendance_records`, `beneficiaries`); drop dead `audit_attendance` on `attendance_backup_20260730` (M-2: `audit_children` omitted — `children` → `beneficiaries` in 013) | M | Medium |
| 1.13 | **Temporal re-grant (A3):** replace `UNIQUE(church_id,user_id,role_id)` with partial unique index `WHERE end_date IS NULL` (P0.2 batch) | S | Low |
| 1.14 | Regenerate `src/types/database.types.ts` (currently stale: still lists 021-dropped functions, omits 022 helpers and `notifications.old_metadata`); add local mocks | S | Low |

**Verification:** unit-test RPC guards (self-approval denied, cross-church denied, PO-only, idempotent re-approve); **RLS exploit regression tests** against the remediated policies (self-assign role denied, self-approve denied, notification spoof denied — matrix R-1…R-15 in `PHASE_3C_SECURITY_REMEDIATION.md` §5); audit-trigger smoke SQL (A4 §8.1); run against a scratch Supabase project with a seed church.

### Phase 3C.2 — Backend services

| # | Task | Complexity | Risk |
|---|---|---|---|
| 2.1 | `auth.service.ts`: remove self-provisioning `super_admin`/church creation from `signUpWithEmail`; add `registerExistingChurchUser` calling new RPCs | M | Medium |
| 2.2 | New `provisioning.service.ts` wrapping approve/reject + church-request actions | M | Low |
| 2.3 | New server actions: `submitChurchRequest`, `approveServant`, `rejectServant`, `approveChurchRequest`, `rejectChurchRequest` | M | Medium |
| 2.4 | Reuse `generateSlug`/`ensureUniqueSlug` for church slugs (moved to shared lib) | S | Low |
| 2.5 | Remove free-text church fields from `auth.schema.ts`; add dropdown value + `__new_church__` sentinel | S | Low |

### Phase 3C.3 — Notifications

| # | Task | Complexity | Risk |
|---|---|---|---|
| 3.1 | `notification.service.ts` (list own, mark read) via RLS-safe queries | S | Low |
| 3.2 | Admin-path dispatch for `approval_required` / `approval_result` payloads (§6 of REGISTRATION_WORKFLOW_SPEC.md) | S | Medium |
| 3.3 | (Optional) email template for invite link on church provisioning; offline fallback = PO shares link out-of-band | M | Low |

### Phase 3C.4 — Frontend

| # | Task | Complexity | Risk |
|---|---|---|---|
| 4.1 | Rebuild `/signup` form (church dropdown, `__new_church__` navigation) | M | Medium |
| 4.2 | New `/church-request` page | M | Low |
| 4.3 | New `/pending-approval` page + `PendingGate` layout guard | M | Medium |
| 4.4 | Approval queue in `/users` (pending tab, approve/reject, reason dialog) | M | Medium |
| 4.5 | PO queue `/admin/church-requests` (tabs, approve/reject) | M | Medium |
| 4.6 | Notification center (minimal list) | S | Low |
| 4.7 | i18n keys (`ar` + `en`) | S | Low |

### Phase 3C.5 — Middleware & routing

| # | Task | Complexity | Risk |
|---|---|---|---|
| 5.1 | Extend `src/proxy.ts` redirect matrix (§4.2 of REGISTRATION_UI_FLOW.md) using `get_my_access_state()`; exempt `/`, `/about`, `/pending-approval` | M | High (redirect loops) |
| 5.2 | `loginAction` redirect for pending/rejected | S | Low |
| 5.3 | `/about` page (public) — required so authenticated-but-pending users aren't bricked on the landing route | S | Low |

### Phase 3C.6 — Testing

| # | Task | Scope |
|---|---|---|
| 6.1 | RPC guard tests | self-approval, cross-church, PO-only, idempotency |
| 6.2 | RLS tests | pending user zero-access, applicant own-read, public insert shape |
| 6.3 | Flow tests | existing-church signup→pending→approve→role grant; new-church request→approve→provision→super_admin login; reject paths |
| 6.4 | Middleware tests | redirect matrix incl. auth-confirm on/off |
| 6.5 | i18n + a11y pass | new screens |

### Phase 3C.7 — Deployment

| # | Task |
|---|---|
| 7.1 | Apply migration batch 1 (backup first; run on scratch project first) |
| 7.2 | Ship P0 fixes (0.1–0.3) in the same release |
| 7.3 | Verify `audit_trigger_fn` on live DB post-migration |
| 7.4 | Manual smoke: signup → approve → login; church request → approve → provision → PO login |
| 7.5 | Rate limiting / honeypot on public `submit_church_request` + `church_requests` spam monitoring |

**Effort estimate (medium seniority, not including Phase 3C.0):** DB ~2 d, backend ~2 d, notifications ~1 d, frontend ~4 d, middleware ~1 d, testing ~2 d, deploy ~0.5 d → **~12.5 d + P0 fixes**.

---

## 3. Database Impact Summary

| Change | Type |
|---|---|
| `church_requests` (new table, 3 indexes, status domain) | Additive |
| `notifications.church_id` nullable | 1-line alter |
| `profiles.own_profile_insert` policy hardened | Replacement |
| `user_roles.tenant_isolation` → SELECT-only (C-1) | Policy replacement |
| `servants.tenant_isolation` → SELECT-only (C-2) | Policy replacement |
| `notifications.tenant_isolation` → SELECT-only (C-3) | Policy replacement |
| `audit_trigger_fn` + **6 triggers** recreated (A4) | Function + trigger recreation |
| `user_roles` UNIQUE constraint → partial unique index `WHERE end_date IS NULL` (A3) | Constraint replacement — drop `user_roles_church_id_user_id_role_id_key`, create `uq_user_roles_active`; `idx_user_roles_user_active` **retained** (A10) |
| 8 SECURITY DEFINER RPCs (7 client-facing + `send_notification`) | Additive |
| `churches`, `servants`, `user_roles`, `roles` | **Unchanged** (reused; policies above excepted) |
| Data backfill | **None** — pending flows start clean; no existing pending rows to migrate |

Rollback = drop RPCs, drop table, revert column, restore the three policy definitions, drop recreated audit triggers, restore the UNIQUE constraint. Low risk.

---

## 4. Security Review

**Findings during architecture (pre-existing, fixed within 3C):**

| Severity | Finding | Fix (phase) |
|---|---|---|
| High | `signUpWithEmail` self-provisions `super_admin` + church (privilege escalation by design) | 2.1 |
| High | Free-text church on signup | 2.5 |
| High | `assignRoles` deletes role history | 0.2 |
| **Critical (C-1)** | `user_roles.tenant_isolation` FOR ALL lets any same-church user self-assign `super_admin` | 1.11 |
| **High (C-2)** | `servants.tenant_isolation` FOR ALL lets a pending user self-approve / mutate same-church servant rows | 1.11 |
| **Medium (C-3)** | `notifications.tenant_isolation` FOR ALL allows cross-recipient inserts | 1.11 |
| Medium | Audit triggers silently absent since 019 CASCADE (silent audit gap) | 0.3 / 1.12 |
| Medium | `profiles.own_profile_insert` allows arbitrary `church_id` claim | 1.10 |
| Medium | Stale frontend permission constants cause wrong UI gating | 0.1 |

**Design controls (validated):**
- Pending users: zero role rows, zero permission resolution.
- No self-approval (RLS SELECT-only + `auth.uid() <> servant_id` + structural).
- No cross-church approval (church-scoped `user_is_super_admin`).
- No church-creation bypass (signup path removed; PO-only writes).
- Elevated grants PO-only; admin has no role-write capability.
- Public surface minimized: one projection-limited RPC + one insert RPC, both with dedupe guards.
- `church_requests` immutable to the applicant post-submit; transitions only via guarded RPCs.
- Notification writes funneled through `send_notification` (SECURITY DEFINER) only.

---

## 5. Canonical Compliance Review

| Canonical dimension | Verdict |
|---|---|
| Role model (`platform_owner → super_admin → admin → servant`) | ✅ Compliant |
| No `pending_user` role | ✅ Compliant (`servants.approval_status`) |
| Pending users have no permissions | ✅ Compliant |
| Super admin has a servant record | ✅ Compliant (provisioned) |
| PO has no church / no servant record | ✅ Compliant |
| Approval audited | ✅ Compliant (`audit_logs`) |
| Temporal `user_roles` (end_date archival) | ✅ Enforced (0.2) |
| Permission catalog (52 codes, no drift) | ✅ Enforced (0.1) |
| RLS zero-trust for pending users | ⚠️ **Role-gated access zero (✅); blanket church-scoped operational access is accepted residual risk (A6)** — see `PHASE_3C_SECURITY_REMEDIATION.md` §3.3 |

---

## 6. Risks (open at sign-off)

1. **Audit triggers silently absent** — migration 019's `DROP TYPE audit_action CASCADE` dropped `audit_trigger_fn` and all 5 dependent triggers, so no audit rows are written for children/profiles/user_roles/followups/attendance until restored (0.3/1.12, verify before migration).
2. **Middleware redirect loops** — pending user lands on public-required routes; mitigated by exempt list + `get_my_access_state` single source (5.1).
3. **Provisioning atomicity** — auth-user creation is external to Postgres; mitigate with compensating rollback in server action (1.8).
4. **Notification RLS** — all writes must go through admin path; a naive service insert will fail (3.2).
5. **Public insert spam** — rate limiting + email dedupe + manual PO review (7.5).
6. **Email confirmation offline** — no SMTP configured: rely on out-of-band invite link; confirm in 2.2/3.3.

---

## 7. Open Questions (for stakeholders)

1. Should `/pending-approval` be reachable pre-auth (e.g., via token) or only after the applicant logs in? *(default: post-login)*
2. Is the **invite link** (on provisioning) or **password-set-on-first-login** preferred? *(default: invite link w/ reset-style token)*
3. Accept phone as required or optional? *(spec: optional)*
4. Allow an **admin** (not just super_admin) to approve servants of their church? *(default: super_admin only per canonical `servants.approve`)*
5. Ship the **notification center** in 3C or defer to the notifications workstream? *(default: minimal in 3C)*
6. Keep `church_requests` **request-only** (no applicant account) — confirmed? *(assumed yes)*

---

## 8. Final Verdict

### APPROVED_FOR_IMPLEMENTATION (as amended by Phase 3C.1 remediation + Phase 3C.2 gate amendments)

The security amendments from Phase 3C.1 (C-1/C-2/C-3 policy replacements, A1–A4 corrections) and the Phase 3C.2 gate amendments (A5–A10, including the accepted pending-user residual risk A6) are incorporated. The authoritative readiness gate is `PHASE_3C_DATABASE_IMPLEMENTATION_GATE.md` — currently **APPROVED_FOR_MIGRATION_GENERATION** (post re-gate; see that document for the criteria checklist).

Binding conditions:

1. **P0 items (0.1, 0.2, 0.3) ship in the same release** as the 3C migration (0.3 now includes full audit-trigger restoration — A4).
2. The audit-restoration verification SQL must pass on a scratch project before any live migration.
3. All public RPCs remain projection-limited and rate-limited.
4. No path may assign `super_admin` except the PO-gated provisioning RPC.
5. The three `tenant_isolation` policy replacements (`user_roles`, `servants`, `notifications`) are part of the migration batch, not a follow-up.

No architecture revisions required: the design reuses the canonical approval model, adds minimal schema, closes three pre-existing canonical violations, and remediates the RLS escalation/self-approval paths as part of the work.
