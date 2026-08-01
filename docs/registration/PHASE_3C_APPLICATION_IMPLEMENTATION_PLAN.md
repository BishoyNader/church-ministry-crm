# Phase 3C Application Implementation Plan

**Date:** 2026-08-01
**Phase:** 3C — Registration & Church Provisioning (Application Layer)
**Type:** Gap analysis + build plan. No code, no migrations, no file modifications (planning only).
**Verdict this plan is produced under:** `READY_AFTER_FIXES` (database ready; application layer unimplemented — see `PHASE_3C_EXECUTION_READINESS_REVIEW.md`).

---

## 0. Scope & Definitions

This plan converts the Phase 3C architecture (`REGISTRATION_WORKFLOW_SPEC.md`, `REGISTRATION_UI_FLOW.md`, `CHURCH_PROVISIONING_SPEC.md`, `REGISTRATION_RBAC_IMPACT.md`) into an application-layer implementation plan against the current codebase.

The application layer must integrate with the 8 SECURITY DEFINER RPCs created by migration `023`:

| RPC | Client visibility | Used by |
|---|---|---|
| `list_churches_for_signup()` | anon, authenticated | Signup dropdown |
| `submit_church_request(...)` | anon, authenticated | New-church request form |
| `get_my_access_state()` | authenticated | Middleware, `/pending-approval` |
| `approve_servant(p_servant_id)` | authenticated, service_role | Super-admin approval queue |
| `reject_servant(p_servant_id, p_reason)` | authenticated, service_role | Super-admin rejection queue |
| `approve_church_request(p_request_id, p_auth_user_id, p_slug)` | authenticated, service_role | PO church-request queue |
| `reject_church_request(p_request_id, p_reason)` | authenticated, service_role | PO church-request queue |
| `send_notification(...)` | **NOT exposed to clients** | Server actions via admin client |

**Governing principles**
- RLS is the enforcement layer; middleware/route guards are UX-only.
- Pending users are represented by `servants.approval_status='pending'` + zero `user_roles` rows. **No `pending_user` role.**
- Notification writes flow only through `send_notification` (service-role admin client) or inside the approval RPCs.
- All audit rows must use the 019 schema: `actor_id`, `entity_id` (NOT NULL). The pre-019 `user_id` column no longer exists.

---

## 1. Current-State Audit

### 1.1 Signup / Onboarding

| Path | Purpose | Current behavior | Phase 3C impact |
|---|---|---|---|
| `src/features/auth/services/auth.service.ts` | Auth + onboarding services | `signUpWithEmail(churchNameAr, …)` creates a **new `churches` row** from free text, `seed_church_roles`, then self-grants `super_admin` (working tree adds `start_date`). `signInWithEmail` does profile/`is_active` checks, `last_login_at` update, audit insert (working tree fixed to `actor_id`/`entity_id`). | **Replace entirely** (spec §2.3 conflict 1+2). Church creation + super_admin self-assignment must be removed. New flow: `registerExistingChurchUser` server action (spec §3.2). |
| `src/features/auth/actions/auth.actions.ts` | Server actions | `signupAction` parses `signupSchema`, calls `signUpWithEmail`, redirects `/login?signup=success`. `loginAction` always redirects `/dashboard`. | Rewrite `signupAction` for existing-church path; rewrite `loginAction` redirect to be state-aware. |
| `src/features/auth/schemas/auth.schema.ts` | Zod validation | `signupSchema`: `churchNameAr/En`, no `phone`, no `church_id`. | Add `phone` (required), `church_id` (uuid); remove `churchName*`. |
| `src/features/auth/components/signup-form.tsx` | UI | Free-text church name fields, no church selector. | Replace with church **dropdown** + **"Request New Church"** option (§2 UI flow). |
| `src/features/auth/types/auth.types.ts` | Types | `SignupFormValues` matches old schema. | Update shape (`church_id`, `phone`). |
| `src/app/[locale]/signup/page.tsx` | Route | Renders `SignupForm`. | Pass RPC-backed dropdown data; keep public. |

### 1.2 Login

| Path | Purpose | Current behavior | Phase 3C impact |
|---|---|---|---|
| `src/features/auth/services/auth.service.ts` (`signInWithEmail`) | Sign-in | Signs in, checks profile, updates `last_login_at`, writes login audit. | Add access-state resolution for redirect (pending/rejected → `/pending-approval`). |
| `src/features/auth/actions/auth.actions.ts` (`loginAction`) | Server action | Redirects `/dashboard` for every successful login. | Redirect by state: pending/rejected → `/pending-approval`; approved → `/dashboard` (spec §8). |
| `src/features/auth/components/login-form.tsx` | UI | Uses `result.redirectTo`. | None structurally; honors new redirect. |

### 1.3 Middleware / Auth plumbing

| Path | Purpose | Current behavior | Phase 3C impact |
|---|---|---|---|
| `middleware.ts` | Edge entry | Delegates to `proxy`. | Unchanged. |
| `src/proxy.ts` | Route gating | `AUTH_PAGES = ["/login","/signup","/forgot-password","/reset-password"]`. Authed user on auth page → `/dashboard`; anon on non-auth page → `/login`. | Extend to access-state routing; add `/church-request`, `/pending-approval`, `/about`, `/profile`, `/admin/church-requests` handling (spec §4.2). |
| `src/lib/supabase/middleware.ts` | Session refresh | `createServerClient` + `getUser`. Returns `{response, user}`. | Extend return to include `accessState` (via `get_my_access_state()` RPC) for UX routing. Keep it non-authoritative. |
| `src/lib/supabase/client.ts` / `server.ts` / `config.ts` / `admin.ts` | Client factories | Browser, server, env-config, service-role clients. | Reuse unchanged. `admin.ts` is the privileged path for `send_notification` and auth-user creation. |

### 1.4 Notifications

| Path | Purpose | Current behavior | Phase 3C impact |
|---|---|---|---|
| — | **No notification feature exists.** | No service, hook, action, component, or route. Nothing writes `notifications` today (audit: 0 rows). | New `src/features/notifications/` feature: service (reads), bell UI, list page/panel. Writes flow via RPCs / `send_notification` (server-side). |
| `src/components/layout/app-shell.tsx` | App shell / nav | Nav items only; no notification bell/badge. | Add notification bell + unread badge (gated by `notifications.read`). |

### 1.5 User management

| Path | Purpose | Current behavior | Phase 3C impact |
|---|---|---|---|
| `src/features/users/actions/user.actions.ts` | Server actions | `listUsers/getUser/create/update/deactivate/assignRoles/assignStages/getRoles/getStages`. `auditLog` helper inserts `user_id` (stale 019 column) → **silently fails**. `assignRolesAction`/`assignStagesAction` gate on `PERMISSION_CODES.USERS_MANAGE` (removed code) → **always denied**. | Fix audit helper to `actor_id`/`entity_id`. Re-sync permission gates. Add servant **approve/reject** actions + pending queue listing. |
| `src/features/users/services/user.service.ts` | Service layer | `assignRoles` does `.delete()` then insert (violates canonical end-date model, A3). Inserts missing `start_date` (working tree partially fixes). `assignStages` uses `servant_stage_assignments` (working tree fixed). | Rewrite `assignRoles` **reactivation-first** (set `end_date`, reactivate archived, partial-unique-safe). Move role writes to admin client where RLS forbids anon writes post-023. |
| `src/features/users/schemas/user.schema.ts` | Zod | Role-filter union updated in working tree (`super_admin/admin/servant`). | Unchanged further. |
| `src/features/users/components/*` (`user-list-page`, `user-form`, `user-role-assignment`, `user-stage-assignment`) | UI | Users CRUD UI, role/stage assignment dialogs. | Add "Pending registrations" queue (tab) for super_admins + approve/reject actions (§5 UI flow). |
| `src/features/users/hooks/use-users.ts` | Data hooks | List/detail/role/stage hooks. | Add pending-queue hooks. |
| `src/app/[locale]/users/page.tsx` | Route | `PermissionGuard users.read`. | Same guard; queue tab visible under `servants.approve`. |

### 1.6 RBAC

| Path | Purpose | Current behavior | Phase 3C impact |
|---|---|---|---|
| `src/features/rbac/constants/permissions.ts` | Frontend permission constants | **Stale**: references removed codes (`users.manage`, `users.create`, `children.*` without `beneficiaries.*`/`services.*`/`tenants.*`/`servants.*`). Missing `servants.approve`, `servants.assign`, `tenants.read/create/update/delete`, `billing.read`, `classes.*`, `services.*`, `import.execute`, `export.execute`, `spiritual.*`, `subscriptions.manage`. | **Re-sync to the canonical 021 catalog (52 codes)**; then audit every `PermissionGuard`/`hasPermission` call site. Prerequisite for all 3C UI (spec §3.2). |
| `src/features/rbac/services/rbac.service.ts` | Permission resolution | `checkUserPermissions` reads `user_roles`/`roles`/`role_permissions` via anon client. Returns empty result for zero roles. | Compatible with 023 (reads preserved). Verified empty-state for pending users. No change required. |
| `src/features/rbac/utils/permission-check.ts` | `hasPermission` helpers | Wraps `checkUserPermissions`. | Unchanged. |
| `src/features/rbac/components/PermissionGuard.tsx`, `RoleGuard.tsx` | Route gating | Server/client guards by code/role. | Reuse with re-synced codes. Add `PendingGate` (state-based, not permission-based) at `[locale]` layout. |
| `src/features/rbac/hooks/usePermissions.ts`, `useRoles.ts` | Hooks | Permission/role loading. | Unchanged. |

### 1.7 Church creation / selection

| Path | Purpose | Current behavior | Phase 3C impact |
|---|---|---|---|
| `auth.service.ts` (`generateSlug`, `ensureUniqueSlug`, church INSERT) | Church creation on signup | Any signup creates a church + self-grants super_admin. | **Remove** from signup. Church creation moves to PO-gated `approve_church_request` RPC (slug passed as `p_slug`). |
| — | **No church selection exists.** | No dropdown, no `features/churches` directory, no public church listing. | New `src/features/churches/` feature: signup dropdown data (RPC), `/church-request` form, `/admin/church-requests` queue. |

### 1.8 Onboarding (end-to-end)

| Path | Purpose | Current behavior | Phase 3C impact |
|---|---|---|---|
| signup → login chain | Onboarding | Free-text church → immediate super_admin. No approval, no servant row, no audit, no notification. | Replaced by two gated flows: existing-church (servant pending) and new-church (PO provisioning). |

---

## 2. Implementation Matrix

| # | Feature | Existing File(s) | Action Required |
|---|---|---|---|
| 1 | **Church dropdown signup** | `auth.schema.ts`, `auth.types.ts`, `signup-form.tsx`, `signupAction` | Add `list_churches_for_signup()` wrapper; dropdown field (skeleton + empty state); replace free-text fields with `church_id`; "Request New Church" option → `/church-request`. |
| 2 | **Existing church request flow** | `auth.service.ts` (`signUpWithEmail`), `signupAction` | New `registerExistingChurchUser` server action: zod → dedupe → church lookup → admin auth-user create → profile → **servant pending** → notify super_admins → audit → redirect. Remove `signUpWithEmail`. |
| 3 | **New church request flow** | (new) `churches` feature; `submit_church_request` RPC | Public `/church-request` page + form + `submitChurchRequest` server action calling RPC; dedupe error mapping; success state. |
| 4 | **Pending approval page** | (new) | `/pending-approval` route rendering `get_my_access_state()`: status banner (pending/approved/rejected), church name, submission date, instructions. |
| 5 | **Approval queues** | `user-list-page.tsx`, `use-users.ts`, `user.actions.ts` | "Pending registrations" tab (super_admin only, `servants.approve`): `servants WHERE church_id=<mine> AND approval_status='pending'`. |
| 6 | **Super admin approval workflow** | `user.actions.ts`, `user.service.ts` | `approveServantAction` / `rejectServantAction` (with optional reason) calling RPCs; optimistic UI; toast + audit; row leaves queue. |
| 7 | **Platform owner approval workflow** | (new) `admin/church-requests` | `/admin/church-requests` page (`RoleGuard role="platform_owner"`, `tenants.read`): queue table with filter tabs; `approveChurchRequestAction` (passes `p_auth_user_id`, generated `p_slug`); `rejectChurchRequestAction` (reason). |
| 8 | **Access-state routing** | `proxy.ts`, `middleware.ts` (`updateSession`), `loginAction`, `[locale]/layout.tsx` | `get_my_access_state()` in middleware; state-based redirect matrix (see §5); `PendingGate` in layout; auth-page redirects by state. |
| 9 | **Notification generation** | `auth.service.ts`, approval RPCs | Super-admin alert on signup (`approval_required`) via `send_notification` (admin client); result notifications already emitted by `approve_servant`/`approve_church_request` RPCs. |
| 10 | **Notification display** | `app-shell.tsx`, (new) `notifications` feature | Bell + unread badge in shell; `/notifications` list (own rows, RLS-guaranteed); mark-read; gated by `notifications.read`. |
| 11 | **Middleware redirects** | `proxy.ts` | Implement §5 state matrix; public-route exemptions; auth-page post-login redirects by state. |
| 12 | **RPC integration** | (new) service wrappers; `rbac.service.ts` | `churches.service.ts` (list), `approval.service.ts` (approve/reject), `access.service.ts` (`getMyAccessState`), `registration.service.ts` (`submitChurchRequest`, `registerExistingChurchUser`), `notification.service.ts` (read). |
| 13 | **Audit logging integration** | `user.actions.ts` (`auditLog`), `auth.service.ts` | Fix all audit inserts to `actor_id`/`entity_id`. RPCs self-audit (`submit_church_request`, `approve_*`, `reject_*`); `registerExistingChurchUser` writes `create`/`registration_request` rows via admin client. |

---

## 3. Backend Work

### 3.1 Server actions (all `"use server"` in `src/features/*/actions/`)

| # | Action | Module | Purpose | Dependencies |
|---|---|---|---|---|
| A1 | `signupAction` (rewrite) | `auth.actions.ts` | Validate existing-church signup → `registerExistingChurchUser` → redirect `login?signup=pending` / `/pending-approval` | C1, S2, S7 |
| A2 | `loginAction` (rewrite redirect) | `auth.actions.ts` | State-aware redirect after login | S4 (`getMyAccessState`) |
| A3 | `submitChurchRequestAction` | `churches/actions/church.actions.ts` (new) | Validate + call `submit_church_request` RPC; map errors (`email_already_registered`, `request_already_pending`, `church_name_exists`) | S3, S8, RPC |
| A4 | `approveServantAction` | `users/actions/user.actions.ts` | Check `servants.approve` → call `approve_servant` | S5, RPC, S7 |
| A5 | `rejectServantAction` | `users/actions/user.actions.ts` | Check `servants.approve` → call `reject_servant(p_reason)` | S5, RPC, S7 |
| A6 | `approveChurchRequestAction` | `churches/actions/church.actions.ts` (new) | Check `tenants.read`/platform_owner → generate slug → call `approve_church_request(p_request_id, actorId, slug)` | S6, RPC, slug helper |
| A7 | `rejectChurchRequestAction` | `churches/actions/church.actions.ts` (new) | Check PO → call `reject_church_request(p_reason)` | S6, RPC |
| A8 | `listPendingServantsAction` | `users/actions/user.actions.ts` | Queue query `servants WHERE approval_status='pending'` + applicant details | S5, `servants.read` |
| A9 | `listChurchRequestsAction` | `churches/actions/church.actions.ts` (new) | Queue listing with status filter | S6, `tenants.read` |
| A10 | `markNotificationsReadAction` | `notifications/actions/notification.actions.ts` (new) | Mark own rows read | S9 |
| A11 | `getMyAccessStateAction` | `auth/actions/auth.actions.ts` (or `access.service`) | Wrap RPC for pages/hooks | S4 |

### 3.2 Services

| # | Service | Module | Purpose | Dependencies |
|---|---|---|---|---|
| S1 | `registration.service.ts` (new) | `churches/services/` | `registerExistingChurchUser`: dedupe via `getProfileByEmail`, church lookup (admin client), auth-user create, profile insert, servant pending insert, super_admin alert loop, audit rows, cleanup/rollback | `admin.ts`, `getProfileByEmail`, C2, S7 |
| S2 | `auth.service.ts` (trim) | `auth/` | Remove `signUpWithEmail`/`generateSlug`/`ensureUniqueSlug`; keep login/logout/reset (audit-compliant) | C2 |
| S3 | `churches.service.ts` (new) | `churches/services/` | `listChurchesForSignup()` → `list_churches_for_signup()` RPC (anon client); `listChurchRequests` (admin client) | RPC, C4 |
| S4 | `access.service.ts` (new) | `auth/services/` (or `access/`) | `getMyAccessState()` → `get_my_access_state()` RPC; typed result (`church_id, church_name_ar, servant_approval_status, role_types, is_active, has_roles`) | RPC, C4 |
| S5 | `approval.service.ts` (new) | `users/services/` | `approveServant`, `rejectServant`, `listPendingServants` | RPCs, C4 |
| S6 | `provisioning.service.ts` (new) | `churches/services/` | `approveChurchRequest`, `rejectChurchRequest` wrappers (slug generation, actor id) | RPCs, C4 |
| S7 | `notification.service.ts` (new) | `notifications/services/` | `sendNotification` (admin client → `send_notification` RPC — **server only**), `listMyNotifications`, `unreadCount`, `markRead` (anon client reads) | RPC, C4 |
| S8 | `church-request.service.ts` (new) | `churches/services/` | `submitChurchRequest` wrapper + error normalization | RPC |
| S9 | `user.service.ts` (fix) | `users/services/` | `assignRoles` → reactivation-first (end_date archival, reactivate archived grants); move role/stage writes to admin client where needed | C5 |

### 3.3 Repositories / helpers

| # | Helper | Purpose | Dependencies |
|---|---|---|---|
| R1 | `getProfileByEmail(email)` (new) | Pre-signup duplicate check (profiles via admin client) | C2 |
| R2 | `generateSlug(name)` (relocate) | Move slug helper to a shared util (`src/lib/`) for `approveChurchRequestAction` | — |
| R3 | `auditLog` (fix) | `user.actions.ts` helper → `actor_id`, `entity_id`; move to shared `src/lib/audit.ts` for reuse | C5 |
| R4 | Typed RPC response types | Regenerate `src/types/database.types.ts` **after 023 applies** to staging; hand-typed `Database` for the 8 RPCs pre-regeneration | C3 |

### 3.4 Notification & audit integration

- **Notification generation**
  - Signup (existing church): after servant insert, loop active `super_admin` user_roles of the church → `send_notification(... 'approval_required' ...)` with §6.2 payload (applicant name/email/phone, `servant_id`, `church_id`).
  - New-church request: optional PO alert (`approval_required` type `church_request`) — primary surface is the PO queue.
  - Decisions: already emitted by `approve_servant`/`approve_church_request`/`reject_*` RPCs (in-transaction). No app code needed.
- **Audit integration**
  - In-DB: `submit_church_request`, `approve_servant`, `reject_servant`, `approve_church_request`, `reject_church_request` write audit rows internally (`write_audit_log`, 019).
  - In-app: `registerExistingChurchUser` writes `create`/`registration_request` rows; login/logout already fixed; **fix `user.actions.ts` `auditLog`** and any other site still using `user_id`.

---

## 4. Frontend Work

### 4.1 Pages & routes

| # | Route | File | Access | Dependencies |
|---|---|---|---|---|
| F1 | `/signup` (redesign) | `src/app/[locale]/signup/page.tsx` + `signup-form.tsx` | public | S3 (dropdown data), A1 |
| F2 | `/church-request` (new) | `src/app/[locale]/church-request/page.tsx` | public | A3, F6 |
| F3 | `/pending-approval` (new) | `src/app/[locale]/pending-approval/page.tsx` | authenticated | S4, F7 |
| F4 | `/admin/church-requests` (new) | `src/app/[locale]/admin/church-requests/page.tsx` | platform_owner (`tenants.read`) | A6, A7, A9, F9 |
| F5 | `/notifications` (new, optional) | `src/app/[locale]/notifications/page.tsx` | authenticated (`notifications.read`) | S7, F10 |
| F6 | `/about` (new, optional) | `src/app/[locale]/about/page.tsx` | public | §5 matrix |

### 4.2 Forms

| # | Form | Purpose | Dependencies |
|---|---|---|---|
| F6 | `church-request-form.tsx` (new) | New-church request: church name ar/en, catechist, applicant, email, phone, notes; success state; back-to-signup | A3, S8 |
| F7 | `pending-approval.tsx` (new) | Reads `get_my_access_state()`; status banner + instructions | S4 |

### 4.3 Components / modals / tables / badges / status views

| # | Component | Purpose | Dependencies |
|---|---|---|---|
| F8 | `church-dropdown.tsx` (new) | RPC-backed select; loading skeleton; empty state; "Request New Church" option | S3 |
| F9 | `pending-registrations-queue.tsx` (new) | Users-module tab: applicant, church, request date, Approve/Reject; reject reason prompt | A4, A5, A8 |
| F10 | `church-requests-table.tsx` (new) | PO queue: church/catechist/applicant/notes/submitted + status filter tabs (pending/approved/rejected) | A6, A7, A9 |
| F11 | `approval-status-badge.tsx` (new) | pending/approved/rejected badge | S4 |
| F12 | `notification-bell.tsx` (new) | Shell bell + unread badge | S7, F5 |
| F13 | `notification-list.tsx` (new) | Own-rows list, mark-read | S7, A10 |
| F14 | `pending-gate.tsx` (new) | `[locale]` layout guard using access state; short-circuits guarded pages for pending/rejected users | S4 |
| F15 | `reject-dialog.tsx` (new) | Shared reject-with-reason modal | A5, A7 |

### 4.4 i18n

- `src/messages/en.json` / `ar.json`: add namespaces `auth.signup.*` (phone, church, requestNewChurch), `auth.pending.*`, `churches.*` (request form, admin queue), `users.approvalQueue.*`, `notifications.*`, `admin.churchRequests.*`.

### 4.5 Dependency graph (frontend)

```
F1 signup ──> F8 church-dropdown ──> S3 ──> RPC list_churches_for_signup
              └─> A1 signupAction ──> S1 ──> C2
F2 church-request ──> F6 form ──> A3 ──> S8 ──> RPC submit_church_request
F3 pending-approval ──> F7 ──> S4 ──> RPC get_my_access_state
F4 admin queue ──> F10 table ──> A6/A7/A9 ──> S6 ──> RPC approve/reject_church_request
F9 pending queue (users) ──> A4/A5/A8 ──> S5 ──> RPC approve/reject_servant
F12 bell ──> S7 ──> notifications reads; F13 list ──> A10
F14 pending-gate ──> S4 (used by [locale]/layout + proxy)
```

---

## 5. Middleware Changes

`src/proxy.ts` currently: anon → `/login` (non-auth pages); authed → `/dashboard` (auth pages). New behavior (spec §4.2, §8; UI flow §9):

### 5.1 Route classification

```
PUBLIC_AUTH   = /login, /forgot-password, /reset-password     (unauthenticated only)
PUBLIC_ALWAYS = /signup, /church-request, /about, /           (any state)
PENDING_ONLY  = /pending-approval, /profile                   (authed: pending/rejected/zero-role)
GUARDED       = everything else (dashboard, children, attendance, followups, stages, users, admin/*, notifications)
```

### 5.2 State resolution

After `updateSession`: if a user exists, call `get_my_access_state()`. State tuple → one of:

```
ANON              user = null
PENDING           servant_approval_status = 'pending'
REJECTED          servant_approval_status = 'rejected'
ZERO_ROLES        approved but has_roles = false   (anomaly)
APPROVED          approved + has_roles = true      → role_types drives RBAC
PLATFORM_OWNER    role_types contains platform_owner (no church)
```

### 5.3 Routing matrix

| State | Allowed (stay) | Redirect everything else to |
|---|---|---|
| ANON | `/login`, `/signup`, `/church-request`, `/forgot-password`, `/reset-password`, `/`, `/about` | `/login` |
| PENDING | `/`, `/about`, `/pending-approval`, `/profile` | `/pending-approval` |
| REJECTED | `/`, `/about`, `/pending-approval`, `/profile` | `/pending-approval` |
| ZERO_ROLES (approved, no roles) | `/`, `/about`, `/pending-approval`, `/profile` | `/pending-approval` |
| APPROVED | all GUARDED routes + public | existing logic (RBAC via `PermissionGuard`) |
| PLATFORM_OWNER | `/admin/*`, `/users`, `/dashboard`, public pages | existing logic |

### 5.4 Auth-page redirects (already-authed users)

| Visiting | Pending/Rejected/ZERO_ROLES | Approved / PO |
|---|---|---|
| `/login`, `/signup` | `/pending-approval` | `/dashboard` |
| `/pending-approval` | stay | `/dashboard` (auto) |

### 5.5 Non-negotiables

- Middleware is **UX-only**; it must not fetch sensitive data — `get_my_access_state()` returns only the state tuple (already hardcoded to `auth.uid()`).
- `/pending-approval`, `/about`, `/profile`, `/church-request` must be exempted from the anon→`/login` rule.
- `/admin/*` must be blocked for non-platform-owners at middleware **and** `RoleGuard`/RPC layer.
- Avoid heavy work in middleware: cache state per request; the RPC is a single round-trip.

---

## 6. Implementation Order

### Phase 3C.2A — Foundations (permissions, audit, RPC plumbing)

**Scope**
- Re-sync `PERMISSION_CODES` to the canonical 021 52-code catalog; audit every `PermissionGuard`/`hasPermission` call site (restores `assignRolesAction`/`assignStagesAction` gating).
- Fix all audit inserts to 019 schema (`actor_id`, `entity_id`): `user.actions.ts` `auditLog`, relocate to `src/lib/audit.ts`.
- Rewrite `assignRoles` reactivation-first (end_date archival + reactivation; remove `.delete()`); move role/stage writes to admin client where RLS blocks anon writes post-023.
- Shared helpers: `getProfileByEmail`, `generateSlug` relocation.
- RPC wrapper services: `churches.service.ts` (list), `access.service.ts`, `approval.service.ts`, `provisioning.service.ts`, `notification.service.ts`, `registration.service.ts`, `church-request.service.ts`.
- Hand-typed RPC response types (before DB types regen) in `src/types/`.

**Files affected**
- `src/features/rbac/constants/permissions.ts`, `rbac/components/*`, `rbac/hooks/*`
- `src/features/users/actions/user.actions.ts`, `services/user.service.ts`
- `src/lib/audit.ts` (new), `src/lib/utils/slug.ts` (new)
- `src/features/{churches,notifications,access}/services/*` (new)
- `src/types/database.types.ts`

**Estimated effort:** M (2–4 dev-days)

**Completion criteria**
- `assignRolesAction`/`assignStagesAction` pass their permission gate.
- Audit inserts write rows (verified against staging 019+ schema; no `user_id` references remain).
- Role changes set `end_date`; re-approval reactivates without duplicate `user_roles` rows.
- All 7 client RPCs callable via typed wrappers; `send_notification` callable via admin client only.
- `npm run lint` + `npm run typecheck` clean.

### Phase 3C.2B — Registration flows (signup + church request)

**Scope**
- Signup form redesign: church dropdown (`list_churches_for_signup`), phone field, "Request New Church" → `/church-request`.
- `registerExistingChurchUser` server action (dedupe → church lookup → auth user → profile → servant pending → super_admin notifications → audit → rollback).
- Remove `signUpWithEmail` + free-text church creation.
- `/church-request` page + form + `submitChurchRequestAction` with dedupe error mapping.
- i18n keys (auth.signup.*, churches.request.*).

**Files affected**
- `src/features/auth/{schemas,types,services,actions,components}/*` (signup surface)
- `src/features/churches/` (new: request form, submit action, service)
- `src/messages/en.json`, `src/messages/ar.json`
- `src/app/[locale]/church-request/page.tsx` (new)

**Estimated effort:** L (4–6 dev-days)

**Completion criteria**
- No code path creates a `churches` row on signup; signup always creates a pending servant with no roles.
- Signup to an existing church succeeds end-to-end in dev (auto-confirmed) landing on `/pending-approval`.
- Duplicate email / unavailable church / inactive church all surface friendly errors; no orphan auth users (rollback verified).
- New-church request persists to `church_requests` with audit row; dedupe prevents double requests.
- Super-admins of the church receive an `approval_required` notification row.

### Phase 3C.2C — Access state & pending UX

**Scope**
- `getMyAccessState` wrapper + typed result.
- `/pending-approval` page (status banner, church, submission date, instructions; approved auto-redirect to dashboard).
- Middleware state routing (§5) in `src/proxy.ts` + `updateSession` extension; `PendingGate` in `[locale]/layout.tsx`.
- `loginAction` / auth-page redirects by state.

**Files affected**
- `src/features/auth/services/access.service.ts` (new), `actions/auth.actions.ts`
- `src/app/[locale]/pending-approval/page.tsx` (new)
- `src/lib/supabase/middleware.ts`, `src/proxy.ts`
- `src/app/[locale]/layout.tsx`
- `src/components/layout/app-shell.tsx` (hide nav for pending; show status chip)
- `src/messages/*.json` (auth.pending.*)

**Estimated effort:** M (3–4 dev-days)

**Completion criteria**
- Routing matrix fully implemented and matches §5.3.
- A pending user cannot reach guarded routes (redirects to `/pending-approval`) in both locale variants.
- Approved user flow unchanged; zero-roles anomaly lands on `/pending-approval` with "contact admin".
- Login for a pending user redirects to `/pending-approval`, not `/dashboard`.

### Phase 3C.2D — Approval workflows & notifications

**Scope**
- Users module "Pending registrations" queue (super_admin, `servants.approve`): approve/reject with reason.
- `/admin/church-requests` PO queue (filter tabs pending/approved/rejected): approve (slug + actor) / reject with reason.
- Notification center: bell + unread badge in `app-shell`, `/notifications` list, mark-read.
- i18n (users.approvalQueue.*, admin.churchRequests.*, notifications.*).

**Files affected**
- `src/features/users/components/pending-registrations-queue.tsx` (new), `actions/user.actions.ts`, `hooks/use-users.ts`
- `src/features/churches/components/church-requests-table.tsx` (new), `actions/`
- `src/app/[locale]/admin/church-requests/page.tsx` (new)
- `src/features/notifications/` (new: bell, list, service, action, hook)
- `src/components/layout/app-shell.tsx`
- `src/messages/*.json`

**Estimated effort:** L (4–6 dev-days)

**Completion criteria**
- Super_admin approves → servant becomes approved, servant role granted (reactivation-first), applicant notified (`approval_result`), audit rows present; reject → rejected + reason, notified.
- PO approves request → church + profile + servant + super_admin role created atomically; applicant notified; request history preserved (status filter). Reject → nothing created, history kept.
- Notification bell reflects unread count; list shows own rows only (RLS-verified); mark-read works.
- Both queues empty-state + loading + error states; row leaves queue optimistically.
- E2E happy + sad paths verified per `PHASE_3C_STAGING_TEST_MATRIX.md`.

---

## 7. Execution Gate

**Verdict: `READY_TO_IMPLEMENT`**

Rationale:
- The existing architecture (server actions → services → RPC + RLS, anon/admin client split, `PermissionGuard`/`RoleGuard`, next-intl i18n, `useTranslations`) fully accommodates the 3C application layer. No new architectural pattern is required; every item above reuses established structure.
- The plan is **additive** (new features `churches`, `notifications`, `access`) plus **corrective** fixes (permission constants, audit columns, `assignRoles` semantics) — all within existing seams.
- Migration `023` provides the complete backend chokepoints (`get_my_access_state`, approval RPCs, `list_churches_for_signup`, `submit_church_request`); the application layer is integration work.

**Prerequisites (must hold before any 3C UI ships):**
1. `023` applied to staging and committed/merged to `staging` (blocker B-1 from the readiness review).
2. `database.types.ts` regenerated against the post-023 schema (blocker M-2).
3. Foundation phase 3C.2A complete (permission re-sync is a prerequisite per `REGISTRATION_RBAC_IMPACT.md` §3.2 — currently role-assignment actions are permanently denied).

**Recheck gate:** re-run `PHASE_3C_EXECUTION_READINESS_REVIEW.md` after 3C.2A–2B; then proceed 3C.2C–2D against staging with the rollback plan (`PHASE_3C_STAGING_ROLLBACK_PLAN.md`) at hand.
