# Business Requirements Audit — Church Ministry CRM

Status: **Audit complete, pre-implementation**
Date: 2026-08-03
Scope: `supabase/migrations/001–025`, `src/app`, `src/features/*`, `src/proxy.ts`, RLS/RBAC, UI/UX
Method: Full code + schema audit, key claims verified by direct source inspection and a runtime probe.

---

# Executive Summary

The platform has an unusually strong **backend foundation** — 25 migrations, RLS enabled on every table, SECURITY DEFINER RPCs, an audit-log framework, a Phase 3C registration architecture, a polished bilingual RTL design system — but the **application layer is critically disconnected from the business requirements**. The audit found the app is **non-functional after login in its current state**, and large required feature areas simply do not exist.

**Four blocking defects:**

1. **P0-CRITICAL — Every permission-gated server action always fails.** `src/features/rbac/services/rbac.service.ts` builds its Supabase client from `@/lib/supabase/client` (`createBrowserClient`). Inside a Node server-action runtime that client has no session (empirically verified: `session: null`). `hasPermission()` therefore returns `false` for every request, so **all** list/create/update/delete actions for beneficiaries, attendance, followups, users, stages, dashboard, approvals, and church-request review return "You do not have the required permission." The app is read-only-and-erroring in practice.

2. **P0-CRITICAL — The navigation shell is disconnected.** `AppShell` (sidebar/header/mobile nav) is mounted only on the orphaned root `src/app/page.tsx`. No real `[locale]` route renders it, so every authenticated page renders with **no navigation, no theme toggle, and no sign-out**.

3. **P0-CRITICAL — The Platform Owner role is unprovisionable.** `roles.church_id` and `user_roles.church_id` are `NOT NULL` and no migration seeds a `platform_owner` role or grant. `user_is_platform_owner()` can never return true, so `approve_church_request`, `/admin/church-requests`, and the PO policies are dead code — the **church-creation approval flow cannot complete end-to-end**.

4. **P0-HIGH — RLS write surface is tenant-scoped, not permission-scoped.** `tenant_isolation … FOR ALL` on ~17 tables lets any authenticated member of a church INSERT/UPDATE/DELETE domain data directly via PostgREST, bypassing the 52-code permission model; `beneficiary_assignments` immutability and `spiritual_journal_entries` privacy are both defeated. A servant can even move their own profile to another church.

**Beyond the blockers**, the required business model has major gaps: no Reports module, no Spiritual Journal UI (table exists), no Notifications center or automation (no birthdays/absence/followup reminders), no Settings, no Servant-attendance, no Excel import, no dedicated Assignments page, no Servants module, no Events UI, and the Stage/Area-Leader role was collapsed into `servant` during migration 021.

**Strengths to preserve:** the design system (oklch tokens, RTL/Arabic, dark mode, skeletons/empty states), the Phase 3C RPC architecture, audit triggers, and the beneficiary-assignment history model which already supports promotion tracking.

---

# Current Architecture Assessment

**Stack (verified from `package.json` + source):** Next.js **16** (App Router, `src/proxy.ts` middleware), React 19, TypeScript, Tailwind v4 (CSS-first config), Base UI primitives + shadcn conventions, Recharts v3, next-intl v4 (`ar` default, `localePrefix: always`), TanStack Query, Zustand, `@supabase/ssr`, Vercel.

**Three-layer enforcement model:**
- Client UI guards: `PermissionGuard` (used on every authenticated route and mutation button).
- Server actions: `hasPermission()` gate — **broken (P0-1)**.
- Database: RLS + SECURITY DEFINER RPCs — **write path too permissive (P0-4)**.

**Routing:** `src/proxy.ts` handles auth state only (redirects to `/pending-approval` until `is_active && approved && has_roles`). There is **no role-based routing**; permission routing is deferred to per-page guards. This is acceptable as "UX-only routing" (RLS is the enforcement layer) *provided* P0-1/P0-4 are fixed.

**Route tree (implemented):** `/[locale]/{landing,login,signup,forgot-password,reset-password,church-request,pending-approval,dashboard,children,children/[childId],attendance,followups,stages,users,admin/church-requests}`. No `loading.tsx`/`error.tsx`, no route-group layouts, no settings group, no `(app)` layout.

**Server actions (~35):** children (16), auth (6), churches (5), dashboard (1), stages (12), users (12). RPCs called from app: `get_my_access_state`, `list_churches_for_signup`, `submit_church_request`, `approve_church_request`, `reject_church_request`, `approve_servant`, `reject_servant`, `create_beneficiary_with_assignment`, `transfer_beneficiary`.

**Feature modules:** `auth`, `children`, `churches`, `dashboard`, `notifications` (service only), `rbac`, `stages`, `users`. Fully wired: children/auth/churches/dashboard/stages/users. Notifications backend-only.

---

# Database Assessment

## Strengths
- RLS enabled on all 26 live tables; `audit_logs` is append-only/immutable.
- Partial unique indexes used well: `uq_user_roles_active`, `idx_church_requests_email_pending` (unique pending email), `idx_ba_current`.
- Audit triggers on 6 core tables (023); `write_audit_log` used consistently.
- `beneficiary_assignments` carries full history (is_current / start_date / end_date / transfer_reason) — the promotion model is partially in place.
- Church provisioning is atomic (church + roles + profile + servant + super_admin grant in one transaction).

## Defects
| ID | Severity | Finding |
|---|---|---|
| D1 | Critical | `tenant_isolation FOR ALL (church_id = get_user_church_id())` on beneficiaries, followups, attendance_sessions, attendance_records, services, stages, classes, SSA, beneficiary_assignments, spiritual_journal_entries, events, event_registrations, documents, ai_* → any church user can write everything. Defeats `immutable_update/delete` on beneficiary_assignments and the `deny_admin_spiritual` guard. |
| D2 | Critical | No unique guard on a current beneficiary assignment (partial unique index missing). The C4 duplicate-current bug (fixed app-side by 024 RPCs) can still be introduced directly through the API. |
| D3 | Critical | Platform Owner unprovisionable: `roles.church_id`/`user_roles.church_id` NOT NULL; no `platform_owner` role row or grant anywhere (verified grep). |
| D4 | High | `profiles.own_profile_update` has **no WITH CHECK** → a user can set `church_id` to another church (cross-tenant move). |
| D5 | High | `attendance_sessions UNIQUE (stage_id, session_date)` forbids a second session (e.g. morning/evening) for the same stage on the same day. |
| D6 | Medium | Dead artifacts: `spiritual_records` table (RLS, zero policies), backup tables `ministries_backup`, `user_stage_assignments_backup`, `attendance_backup`, `notifications.old_metadata` column, duplicate unique constraint+index on `spiritual_journal_entries(servant_id,entry_date)`, orphaned helpers `user_has_permission`, `get_user_servant_id`, `get_user_assigned_beneficiary_ids`, stale names `idx_event_registrations_child`, `trg_children_updated_at`. |
| D7 | Medium | `followups.type` is unconstrained text (drift from enum); `followups.status` has no DB default. |
| D8 | Medium | Missing indexes for real query patterns: beneficiaries `full_name_ar ILIKE` search (table is searched but no trigram/`pg_trgm` index), followups overdue (`status IN open,in_progress AND scheduled_at < now`), notifications unread (`recipient_id,is_read`), `beneficiary_assignments(servant_id) WHERE is_current` (servant dashboard). |
| D9 | Medium | No notification automation anywhere (no cron/trigger/edge function for birthdays, consecutive absences, followup reminders). |
| D10 | Low | `classes` wired at schema level but ignored by app flows; `servant_id` NOT NULL on `beneficiary_assignments` forces a servant onto every assignment (blocks assigning before a servant is known during promotion). |
| D11 | Low | `attendance_records.record_attendance` INSERT policy only checks church + `recorded_by = auth.uid()` — no stage/session scope check on insert. |
| D12 | Low | No `reports` table/views — dashboard aggregates in-app; promotion/reporting SQL would help. |

---

# Permission Model Assessment

**Model:** `permissions` (52 codes) → `role_permissions` → `roles` (role_type) → `user_roles` (church-scoped, dated). Seeded roles (021): `super_admin` (all 52), `admin` (22), `servant` (15). `platform_owner` **never seeded**.

**Verified findings:**

| ID | Severity | Finding |
|---|---|---|
| P1 | Critical | `hasPermission()` uses the browser Supabase client inside server actions → always `false` (runtime-proven). Every gated action fails. |
| P2 | Critical | Platform Owner unprovisionable (see D3). |
| P3 | High | Admin seed does not match the business "Ministry Admin": lacks `attendance.create` and all `followups.*` writes; `approve_servant`/`assignRoles`/`createUser` actions and RPCs are **super_admin-only**. Business requirement says the Ministry Admin approves registrations and assigns roles/stages/classes. |
| P4 | High | Servant seed is over-granted for the business model: has `beneficiaries.update` and all `followups.*` writes with **no scope check** in actions (any servant can update any church beneficiary). |
| P5 | High | Stage/Area-Leader role **does not exist** (collapsed into `servant` in 021; `user_has_stage_access` removed). No stage-scoped write enforcement in the app layer. |
| P6 | High | `super_admin` is seeded with all 52 codes including `tenants.*`, `system.*`, `billing.*`, `subscriptions.manage` — platform-level codes a tenant super_admin must not hold. |
| P7 | Medium | Two definitions of "active role": app `.is("end_date", null)` (strict) vs DB `end_date IS NULL OR end_date > today`. |
| P8 | Medium | Stale UI: `user-list-page.tsx` role filter uses deleted values (`church_admin`, `stage_leader`, `viewer`) while the zod schema uses the new enum → filter fails validation. |
| P9 | Medium | 30 of 52 codes defined but unused (`spiritual.*`, `notifications.*`, `classes.*`, `servants.read/update`, `import/export`, `reports.export`, `beneficiaries.transfer` — transfers are actually gated by `beneficiaries.update`). |
| P10 | Low | Dead exports: `RoleGuard`, `hasAnyPermission`, `hasAllPermissions` (zero call sites). |

---

# Registration Workflow Assessment

## Church creation (Phase 3C)
`submit_church_request` (anon) → pending row (unique pending email) → PO reviews on `/admin/church-requests` → `approve_church_request` atomically provisions church + `seed_church_roles` + profile + approved servant + initial **super_admin** grant, emails invite link. **Solid design, but blocked end-to-end by P0-3 (PO unprovisionable).**

## Servant registration
Signup (existing church) → service-role creates auth user + `profiles` + `servants(approval_status='pending')` + audit → proxy sends user to `/pending-approval` → super_admin clicks approve on `/users` → `approve_servant` RPC sets approved + reactivates/creates the canonical `servant` role grant → user gains access. Reject path works. **Gaps:** approval and role/stage assignment are super_admin-only (business requires Ministry Admin to do this); no class assignment step; no "assign to stage" step in onboarding (done later in `/stages`).

**Verdict:** flow is implementable and well-guarded; needs role-authorization alignment (P3) and the PO fix (P0-3) to be truly live.

---

# UI/UX Assessment

## Strengths (keep)
Cohesive design system (oklch semantic tokens, `rounded-card/hero`, diffused shadows, hover lifts); genuine RTL/Arabic (logical props, flipped sheets/arrows/chart margins, Noto Sans Arabic); full dark mode; loading skeletons + empty states everywhere; permission-gated buttons; debounced search + pagination; Recharts with token colors; `ar`/`en` message files with 100% key parity.

## Critical gaps
| ID | Severity | Finding |
|---|---|---|
| U1 | Critical | **No navigation rendered** on any real page (AppShell mounted only on orphan root page). No sidebar, header user info, notifications bell, or sign-out on authenticated routes. |
| U2 | High | **KPI cards computed but never rendered** — `KpiCards.tsx` is not imported; the 6 KPIs are invisible; dashboard opens on an overdue banner. |
| U3 | High | **No notifications UX** — no bell, inbox, unread count, or mark-read anywhere, despite a working `notifications` table + service. |
| U4 | High | **i18n leakage on the core data-entry surface** — the entire Add/Edit Beneficiary form, the Beneficiary detail page, and table/filter headers render raw message keys (≈22 missing keys in both locales). |
| U5 | Medium | Follow-up donut drops `open` status (hardcoded `STATUS_ORDER` uses `scheduled`), so open follow-ups silently vanish from the chart. |
| U6 | Medium | `RecentChildren` pipeline badge always broken (service sets `pipelineStage: ""`; UI renders missing key). |
| U7 | Medium | No user identity in header (static greeting; no avatar/name/role/profile menu). |
| U8 | Medium | Hardcoded English in role filter + form "Status" label; native `confirm()` for follow-up delete; no toast/feedback on mutation success. |
| U9 | Low | No `Table` primitive (raw markup duplicated in 6 places); no mobile bottom nav; heavy tables scroll horizontally. |
| U10 | Low | Events & Settings permanently "Soon"; flat role-agnostic nav instead of role-aware trees required by the business model. |

## Missing UX surfaces (business-required, not present)
Settings (profile/password/preferences), Spiritual Journal, Reports page, Servants module, Servant attendance, Assignments, Import, Notifications center, Churches management, Audit log viewer.

---

# Beneficiary Promotion Assessment

**Current model** (`beneficiary_assignments`): `beneficiary_id`, `service_id` NOT NULL, `stage_id` NOT NULL, `class_id` (nullable), `servant_id` NOT NULL, `is_current`, `start_date`, `end_date`, `transfer_reason`. `transfer_beneficiary` (024) closes all current assignments and opens the new one — **historical rows are retained** (`is_current=false`, `end_date` set). So historical/previous-assignment tracking is *structurally present*.

**Gaps against the requirement (annual promotion, class promotion, promotion reports):**

| ID | Finding |
|---|---|
| B1 | No DB uniqueness on the current assignment → duplicates possible via direct API (D2). |
| B2 | `servant_id` NOT NULL couples promotion to a servant; an admin cannot open a new-stage assignment before choosing a servant. `transfer_beneficiary` has no `p_new_servant_id` parameter. |
| B3 | `class_id` exists but is never set by any UI/action. |
| B4 | No annual-promotion concept: no promotion year/term marker; no promotion report query (per-stage intake vs outflow per year); no graduation/archive path (`beneficiaries.status` = 'graduated' removed in 013; status is free text now). |
| B5 | `attendance_sessions` uniqueness (D5) and class-level sessions aren't modeled for multi-session days. |

**Verdict:** schema is ~70% sufficient. Needed: partial unique index, optional `servant_id` on new assignments, optional `promotion_year` marker, class support in transfer RPC/UI, and promotion-report queries.

---

# Gap Analysis (business requirements → status)

| Requirement | Status | Evidence |
|---|---|---|
| **Servant** dashboard (attendance stats, assigned beneficiaries, followup summary, weekly trend) | Partial | Dashboard exists but KPIs unrendered (U2), no per-servant scoping, weekly trend computed but unused |
| Servant beneficiaries: assigned-only list, search, filter, add/edit, profile, attendance history, followups | Partial | List/detail exist; **no assigned-only scoping**, no import |
| Import beneficiaries from Excel | **Missing** | `import.execute` unused; no upload/parse |
| Attendance: record, history, percentages | Partial | Beneficiary batch attendance + history + dashboard %; no per-servant attendance |
| Reports: personal + assigned-beneficiary | **Missing** | No `/reports`; only dashboard KPIs |
| Spiritual Journal (8 items + notes) | **Missing (DB ready)** | Table has 9 flags (incl. liturgy≈communion, no explicit `liturgy_attendance`); zero UI |
| Notifications: birthdays, consecutive absences, followup reminders, events | **Missing** | No UI, no automation, no cron/trigger |
| Account settings (profile, password, preferences) | **Missing** | No `/settings`; `settings.*` unused |
| Signup → pending → approved gating | Implemented | proxy + `/pending-approval` + `approve_servant` |
| **Stage/Area Leader**: manage assigned stages only | **Missing** | Role collapsed; no stage-scoped writes |
| Stage leader: beneficiary mgmt in stages, servants view/edit/assign, servant attendance, alerts | **Missing** | Servants module absent; no scope enforcement |
| **Ministry Admin**: approve/reject servants, assign roles/stages/classes, transfer, church settings | Partial | Approve/reject + transfers exist but are super_admin-only; no class assignment; no settings |
| Admin dashboard: attendance by stage/class, servant/beneficiary metrics, pending approvals | Partial | By-stage + followup charts exist; no by-class, no servant metrics, no approvals widget |
| Admin: Assignments page, Reports, Registration Requests | Partial | Requests queue on `/users`; no Assignments page |
| **Platform Owner**: dashboard (churches/users metrics), approve/reject/suspend church, churches CRUD, create ministry admin, analytics, audit logs, subscriptions, system notifications | **Missing (blocked)** | `/admin/church-requests` exists but PO unprovisionable (P0-3); no churches mgmt, analytics, audit viewer, subscriptions, or broadcast |
| **Approval flow** church creation | Implemented but blocked | RPCs solid; PO bootstrap missing |
| **Beneficiary promotion** (annual, class, history, reports) | Partial | History OK; uniqueness, class, year, reports missing |
| Events, Documents, AI assistant | Missing/partial | Tables exist; events nav disabled; no docs/AI UI |

---

# Recommended Architecture

1. **Fix the enforcement spine first** (P0): server-action permission checks via the server client; RLS writes narrowed from tenant-scope to permission/role-scope; PO bootstrapped. Do not build features on top of a broken permission layer.
2. **Role-aware app shell:** introduce an `(app)` route group under `[locale]` whose layout renders `AppShell`; make nav a **central, permission-filtered config** so each of the four business roles sees its own tree; add mobile bottom-nav.
3. **Four business roles mapped onto the DB enum:**
   - `platform_owner` → Platform Owner (global, church_id NULL).
   - `super_admin` → **Ministry Admin** (church top: approve/reject servants, assign roles/stages/classes, transfer, church settings).
   - `stage_leader` (reintroduced) → Stage/Area Leader (stage-scoped management).
   - `servant` → Servant.
   - Keep `admin` as an optional deputy tier (read-most + operational writes) if desired later; seed corrections ensure it never holds platform codes.
4. **RPC-first writes for protected aggregates** (already the pattern: 023/024): keep `beneficiary_assignments`, servants, roles, church_requests behind SECURITY DEFINER RPCs; direct PostgREST writes for owned/simple entities gated by scoped policies.
5. **Feature modules to add:** `spiritual-journal`, `reports`, `notifications` (UI + automation engine), `servants`, `assignments`, `settings`, `import`, `events`.
6. **Automation engine:** a scheduled job (Vercel cron → service-role server action, or `pg_cron`) that generates notifications for birthdays, consecutive absences, and followup reminders; delivery via the existing service-role insert (keep `send_notification` RPC revoked).
7. **Reports service:** server-computed queries (attendance % by stage/class/servant/beneficiary, promotion report by year, weekly trends) + CSV export (`reports.export`/`export.execute`).
8. **Promotion model hardening:** partial unique index, optional servant on new assignment, `promotion_year`, class-aware transfer RPC, promotion report.

---

# Required Database Changes

Ordered, additive migrations (next numbers 026+). Each includes verification + rollback notes per repo convention.

**026_rbac_and_rls_hardening.sql**
- Provision Platform Owner: allow `roles.church_id` / `user_roles.church_id` NULL for the global `platform_owner` role; insert the `platform_owner` role row (church_id NULL); add bootstrap RPC (service_role only) to grant PO to a given user; `user_is_platform_owner()` updated to check church_id IS NULL AND role_type = 'platform_owner'.
- Narrow write surface: change `tenant_isolation` from `FOR ALL` to `FOR SELECT` on beneficiaries, followups, attendance_sessions, attendance_records, services, stages, classes, SSA, beneficiary_assignments, spiritual_journal_entries, events, event_registrations, documents, ai_* — so writes flow through the existing `admin_write` / `super_admin_all` / `own_*` / `stage_scope_*` policies.
- Add `WITH CHECK` to `own_profile_update` (prevent `church_id` change).
- Fix `record_attendance` INSERT policy to require stage/session scope.
- Recreate `approve_servant` guard from `user_is_super_admin` to `user_is_admin` (or add a separate admin-approve RPC) so Ministry Admin can approve.
- Add stage-scoped write helpers (`user_has_stage_write(stage_id)`) and apply in policies.
- Drop/ignore `user_has_permission` orphan (or repurpose for future).

**027_beneficiary_promotion.sql**
- Dedupe existing duplicate current assignments, then `CREATE UNIQUE INDEX uq_ba_current ON beneficiary_assignments (beneficiary_id) WHERE is_current = true`.
- Make `beneficiary_assignments.servant_id` nullable (default assignment resolution in RPCs).
- Add `promotion_year int` (nullable) to `beneficiary_assignments`.
- Extend `transfer_beneficiary` with `p_new_servant_id` and `p_class_id` (optional).
- Add `liturgy_attendance bool DEFAULT false` to `spiritual_journal_entries`.
- Indexes: `pg_trgm` on `beneficiaries.full_name_ar`; `(servant_id) WHERE is_current` on BA; followups overdue; notifications unread.

**028_notification_automation.sql**
- SQL generator functions: `get_today_birthdays()`, `get_consecutive_absent_beneficiaries(p_threshold)`, `get_followup_reminders(p_days)`; a `generate_notification_batch()` function that inserts into `notifications` (idempotent per day, configurable).
- Enable `pg_cron` (project setting) with a daily job, **or** document a Vercel-cron server action calling the same logic.

**029_reports_helpers.sql**
- `report_attendance_summary(church_id, from, to)` → per-stage/per-class percentages (present/absent/excused).
- `report_servant_summary(...)`, `report_promotion_by_year(...)`, `report_beneficiary_assigned(...)`.
- Optional: `beneficiary_promotions` view for promotion history.

**030_cleanup.sql**
- Drop backup tables (`ministries_backup`, `user_stage_assignments_backup`, `attendance_backup`), `spiritual_records`, `notifications.old_metadata`, orphaned helper functions, duplicate unique index; rename stale indexes/triggers (`idx_event_registrations_child`→`idx_event_registrations_beneficiary`, `trg_children_updated_at`→`trg_beneficiaries_updated_at`); add CHECK on `followups.type`.

---

# Required UI Changes

- **P0:** Wire `AppShell` as the `(app)` layout for all authenticated `[locale]` routes; fix the orphan root page; render KPI cards; fix follow-up donut `open`; fix `RecentChildren` badge; add ~22 missing i18n keys (beneficiary form/detail/table/filters).
- **Nav/IA:** central role-filtered nav config; role-aware trees (Servant / Stage Leader / Ministry Admin / Platform Owner); header with avatar + name + role + profile menu + notifications bell + unread badge; mobile bottom nav.
- **New modules (P1):** Spiritual Journal page (daily 8-item checklist + notes + calendar); Notifications center (inbox, unread, mark-read, filter by type); Reports page (personal / assigned-beneficiary / attendance % / promotion report + CSV export); Servants module (list, profile, edit, assign to stage/class, attendance monitoring); Servant attendance page; Assignments page (beneficiary transfer UI, servant↔stage/class, class assignment); Beneficiary + servant Excel import (SheetJS); Settings group (`/settings/profile|password|preferences` for servants; church-level settings, roles management, audit log viewer for admins); Events module.
- **Platform Owner surfaces (P1/P2):** churches management (list/edit/activate/deactivate/suspend), platform analytics, audit log explorer, subscription management, system notification broadcast.
- **Shared primitives (P2):** `Table`, `DropdownMenu`, `Avatar`, `Tooltip`, `Toast`, `Pagination`, `Switch`.

---

# Required Permission Changes

- **Seed corrections (021 supersede):** `admin`/Ministry Admin gains `attendance.create`, `followups.create/update/delete`; `super_admin` loses `tenants.*`, `system.*`, `billing.*`, `subscriptions.manage`, `support.manage` (platform codes reserved for PO).
- **New `stage_leader` role bundle:** stage-scoped read + write (beneficiaries/stages/classes/attendance within assigned stages), servants read/assign within assigned stages, reports (scoped). Enforce scope in actions via a `user_has_stage_access`-equivalent server helper (reintroduce DB helper).
- **Servant scope enforcement:** servant actions filter to `is_current` assignments of the caller (read) and the caller's assigned beneficiaries (writes); remove blanket `beneficiaries.update`/`followups.*` from the servant seed or gate with scope checks.
- **Approve/assign authorization:** `approve_servant`, `assignRoles`, `assignStages`, `assignUsersToStage` permitted for Ministry Admin (super_admin) and optionally admin.
- **Wire unused codes:** `spiritual.read/create`, `notifications.read`, `classes.*`, `servants.read/update`, `import.execute`, `reports.export`, `beneficiaries.transfer` (switch `transferChildAction` gate), `audit.read`, `settings.*`.
- **Fix P8:** update `user-list-page` role filter to the current enum.
- **Unify active-role definition** between app and DB helpers.

---

# Migration Plan

| # | Migration | Depends on | Risk |
|---|---|---|---|
| 1 | Apply `024`, `025` (pending from prior work) | — | Low; verified |
| 2 | `026_rbac_and_rls_hardening` | 024/025 | **High** — write-policy narrowing can lock users out if a needed policy is missing; stage with grants re-verified per table |
| 3 | `027_beneficiary_promotion` | 026 | Medium — unique index requires dedupe first |
| 4 | `028_notification_automation` | — | Low |
| 5 | `029_reports_helpers` | — | Low |
| 6 | `030_cleanup` | 026–029 | Low — delete-only; verify no references remain |
| 7 | Regenerate `src/types/database.types.ts` | 026–030 | — resolves long-standing type staleness |

Each migration ships with a verification block and a rollback statement per repo convention. Never renumber existing migrations; Phase 3C (`023`) bodies may only be modified by additive `CREATE OR REPLACE` in newer migrations.

---

# P0 Tasks (blockers — implement first)

| # | Task | Verification |
|---|---|---|
| P0-1 | Fix server-action permission layer: point `rbac.service.ts` at `@/lib/supabase/server` (or thread the server client into `hasPermission`); remove the browser-client dependency from server paths. | `npm run build`; manual action call succeeds with a seeded user; all 35 actions re-audited |
| P0-2 | Mount `AppShell` for all authenticated routes via an `(app)` layout under `[locale]`; remove/replace orphan `src/app/page.tsx`; keep proxy gating. | Every page renders with sidebar/header/sign-out; mobile sheet works |
| P0-3 | Provision Platform Owner: migration + bootstrap RPC + grant the first PO to a designated user; verify `/admin/church-requests` + `approve_church_request` end-to-end. | PO-flagged user can approve a church request; church provisions atomically |
| P0-4 | RLS write-surface hardening (026): tenant_isolation → SELECT on domain tables; `WITH CHECK` on own_profile_update; scoped `record_attendance`. | Write attempts as servant blocked where not authorized; admin/super_admin flows unaffected |
| P0-5 | Dashboard P0 fixes: render `KpiCards`; fix `open` status in donut; fix `RecentChildren` badge; remove or surface unused datasets. | Dashboard shows 6 KPIs; charts correct |
| P0-6 | Beneficiary promotion integrity (027 core): dedupe + partial unique index on current assignment; optional `p_new_servant_id` on transfer RPC. | Duplicate insert rejected; transfer with new servant works |
| P0-7 | i18n: add missing keys for beneficiary form/detail/table/filters (ar + en). | No raw keys render on `/children`, `/children/[id]` |

---

# P1 Tasks (required features)

1. Role reconciliation: reintroduce `stage_leader`; seed/permission corrections; admin (Ministry Admin) approve/assign; scope enforcement in servant actions (026 + code).
2. Role-aware navigation trees + header (avatar, name, role, profile menu) + notifications bell.
3. Spiritual Journal module (daily checklist, calendar, notes) using `spiritual_journal_entries` (+ `liturgy_attendance`).
4. Notifications center (inbox, unread, mark-read, filter) + automation engine (birthdays, consecutive absences, followup reminders) via cron.
5. Reports module: personal + assigned-beneficiary + attendance % + promotion-by-year; CSV export.
6. Servants module + Servant attendance (records model already supports `servant_id`).
7. Assignments module: beneficiary transfer UI (with servant/class), servant↔stage/class assignment, mass reassignment.
8. Excel import for beneficiaries (+ servants) via SheetJS; template download.
9. Settings: profile / password / preferences (servant); church settings, roles management, audit log viewer (admin).
10. Events module (tables exist; nav + CRUD + registrations).
11. i18n completion across all new modules; class-level attendance filters.

---

# P2 Tasks (nice-to-have)

- Subscriptions/billing management; platform analytics (multi-church); system-wide notification broadcast.
- Documents module + AI assistant (tables exist; embeddings index commented out).
- UX primitives: `Table`, `Toast`, `DropdownMenu`, `Avatar`, `Tooltip`, `Pagination`, `Switch`; migrate duplicated raw tables.
- Mobile bottom nav; responsive column-hiding strategy for wide tables.
- PWA/offline; export PDF (attendance/promotion reports).
- Multi-session-per-day attendance (relax `attendance_sessions` uniqueness).

---

# Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| 026 RLS narrowing breaks a legitimate flow | High | High | Apply per-table; run matrix of role×action smoke tests against a seeded DB; keep a rollback migration |
| Phase 3C regression (023/024/025 RPCs) | Medium | Critical | Only additive `CREATE OR REPLACE`; never renumber; regression-test approve/reject/submit flows |
| PO bootstrap is a chicken-egg problem | Certain | High | Bootstrap via service-role SQL/RPC documented in 026; do not rely on UI |
| `hasPermission` fix has a regression window | Medium | High | All 35 actions re-audited; client guards unchanged |
| Unique index on current assignment conflicts with existing bad data | High | Medium | Dedupe (close all but latest) inside 027 before index creation |
| Role-model change is invasive to RLS + app | Medium | High | Ship in phases: enum + seed + helpers first, app enforcement after |
| Vercel cron vs pg_cron choice | Medium | Low | Abstain; implement generator SQL + thin cron trigger either way |

---

# Final Implementation Roadmap

**Phase 0 — Stabilize (P0-1…P0-7).** One PR: permission-layer fix, AppShell layout, PO bootstrap, RLS hardening, dashboard fixes, promotion integrity, i18n. Includes migrations 024–027. Exit: a logged-in user can navigate, read, and write with correct permission enforcement; church approval works end-to-end.

**Phase 1 — Role model + nav.** Stage-leader role, seed corrections, scope helpers, role-aware nav trees + header + bell. Migrations 026 amendments + code.

**Phase 2 — Core servant + leader features.** Spiritual Journal, Notifications center + automation (028), Reports, Servant attendance, Assignments page.

**Phase 3 — Ministry Admin surface.** Servants module, import, Settings group, classes wiring, Events.

**Phase 4 — Platform Owner surface.** Churches management, analytics, audit viewer, subscriptions, broadcast (029/030).

**Phase 5 — Hardening.** Cleanup migration, type regeneration, UX primitives, i18n completion, performance indexes, test coverage.

---

*Next step: pending your sign-off on this plan, implementation begins with Phase 0 (P0 tasks).*
