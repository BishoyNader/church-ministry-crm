# Registration Workflow Specification

**Phase:** 3C — Registration & Church Provisioning  
**Date:** 2026-07-31  
**Status:** Architecture / Specification (no code, no migrations)  
**Supersedes:** Current free-text-church signup behavior in `src/features/auth`

---

## 1. Context & Goals

The current signup flow (`src/features/auth/services/auth.service.ts` → `signUpWithEmail`) accepts free-text church names, creates a brand-new `churches` row on every signup, seeds roles, and assigns the caller the `super_admin` role. This produces:

- Duplicate and inconsistent church records.
- Uncontrolled church creation (no platform-owner approval).
- Self-escalation to `super_admin` on every signup (privilege escalation by default).
- No approval gate and no audit trail for user onboarding.

**Phase 3C goal:** Route every new user through a controlled workflow aligned with the canonical hierarchy `platform_owner → super_admin → admin → servant`, using **approval status and onboarding state** (not a `pending_user` RBAC role) to represent pre-approval users.

---

## 2. Current-State Analysis

### 2.1 What exists and is reusable

| Asset | Location | Reusable for 3C |
|---|---|---|
| `servants.approval_status` (TEXT: `pending`/`approved`/`rejected`) + `approved_by`, `approved_at` | Migration `011_servants_table.sql` | Core pending representation — matches canonical role model |
| `servants.approve` permission (canonical, super_admin only) | `CANONICAL_PERMISSION_CATALOG.md` §servants; seeded in `021` | Approve/reject gating |
| `seed_church_roles(p_church_id)` | Migration `021` | Bootstraps `super_admin`/`admin`/`servant` roles per church |
| `notifications` table (canonical columns, `notification_type`, `data`) | Migration `018`; `CANONICAL_DATABASE_SPEC.md` §notifications | Approval notifications; `approval_required` / `approval_result` types already reserved |
| `audit_logs` + `write_audit_log()` | Migration `019` | Approval history / audit trail |
| `createAdminClient()` (service role) | `src/lib/supabase/admin.ts` | Server-only privileged writes |
| Server-action pattern (zod schema → service → audit) | `src/features/*/actions` | Consistent implementation pattern |
| `PermissionGuard` | `src/features/rbac/components/PermissionGuard.tsx` | Route-level permission gating |
| Supabase middleware session check | `src/lib/supabase/middleware.ts` + `src/proxy.ts` | Extend for pending-state routing |
| `user_roles` (church-scoped, `assigned_by` NOT NULL, `end_date` nullable) | `020_user_roles_update.sql` | Role assignment on approval |
| `idx_servants_church_approval` index | `011_servants_table.sql` | Approval queue query |

### 2.2 What is missing

- A notification **service** (nothing writes `notifications` today).
- An approval **queue** UI and approve/reject actions.
- A church **dropdown** / public church listing for signup (RLS currently prevents anonymous reads of `churches`).
- A `pending-approval` page and pending-aware middleware.
- A `church_requests` store for the new-church workflow.
- Platform-owner tenant-request queue UI.

### 2.3 Conflicts with the proposed workflow

1. **Self-provisioned super_admin on signup** — `signUpWithEmail` creates a church + assigns `super_admin` to the caller. Must be removed entirely.
2. **Free-text church fields** in `signupSchema` / `signup-form.tsx` — replaced by a church dropdown sourced from `churches`.
3. **No servant record on signup** — canonical role model states a pending user **has** a servant record with `approval_status='pending'`. Current signup never creates one.
4. **`assignRoles` deletes `user_roles` rows** (`user.service.ts:281`) instead of setting `end_date` — violates canonical temporal model. Must be fixed (anywhere roles change, including approval).
5. **Frontend `PERMISSION_CODES` constants are stale** — still contain removed codes (`users.manage`, `users.create`, `children.*`, `churches.*`); the DB now uses the canonical 52. Role-assignment actions check `users.manage` which no longer exists, so they always deny. Must be re-synced before 3C UI ships.
6. **Latent audit-trigger breakage** — `audit_trigger_fn()` (migration `001`) inserts into `audit_logs` using the column `user_id`, renamed to `actor_id` in `019`. Triggers `audit_children`, `audit_attendance`, `audit_profiles`, `audit_user_roles`, `audit_followups` reference the stale function. **Verify against the live DB before implementation** — these triggers may currently fail and roll back DML on those tables.
7. **`profiles.own_profile_insert` RLS policy** allows an authenticated user to insert a profile row pointing at an arbitrary `church_id`. Not exploitable on the primary path (signup uses the admin client) but is a cross-tenant claim vector that should be tightened as defense-in-depth.
8. **Landing page requires auth** — middleware redirects unauthenticated users to `/login` for every non-auth page, so the public landing/About pages are not truly public today. The pending-state design must explicitly exempt `/pending-approval`, `/`, and `/about`.

---

## 3. Target Workflow — Existing Church Registration

### 3.1 Signup form (public)

| Field | Type | Required | Notes |
|---|---|---|---|
| Full name (Arabic) | text | yes | `profiles.full_name_ar` |
| Full name (English) | text | no | `profiles.full_name_en` |
| Email | email | yes | `auth.users.email` / `profiles.email` (unique) |
| Phone | tel | yes | `profiles.phone` |
| Password | password | yes | min 8 chars, confirmed |
| Church | **dropdown** | yes | Loads from `churches` (see §5). Final option: **"Request New Church"** → `/church-request` |

Free-text church input is **removed**. No `churchNameAr`/`churchNameEn` fields on the main signup form.

### 3.2 Submission sequence (`register_existing_church_user` server action)

```
1. Validate with zod (email format, password strength, phone format, church_id uuid).
2. Reject if email already has an auth user (duplicate registration).
3. Look up church by id → church must exist, is_active = true, deleted_at IS NULL.
   (Reject otherwise.)
4. Create auth user (admin client; prod: auth.signUp w/ email confirm).
5. Insert profiles row: { id, church_id, email, full_name_ar, full_name_en, phone }.
6. Insert servants row: { id = profile.id, church_id, approval_status = 'pending' }.
   ★ NO user_roles row. NO role assignment.
7. Notify every active super_admin of the church (see §6.2).
8. Write audit_logs: action='create', entity_type='servant', entity_id=servant_id,
   new_values={approval_status:'pending'}; action='registration_request'.
9. Redirect: prod → /login?signup=pending ; dev (email auto-confirmed) → /pending-approval
```

**Result:** the user has an account, a profile, a pending servant record, and **no role-based access** (no `user_roles` rows → empty permission resolution; all role-gated RPCs and assignment-scoped reads return 0 rows). **Note (A6):** 3C does not claim blanket data-level denial — migration 022's `tenant_isolation` policies are church-scoped (`FOR ALL` on operational tables), so a pending user retains the same-church operational read/DML posture that exists today. That pre-existing access is an **accepted residual risk** (see `PHASE_3C_SECURITY_REMEDIATION.md` §3.3) and is unchanged by this spec. The 3C-closed write surfaces (role grants, servant approval, notifications) **are** denied.

### 3.3 Servant record: create at signup (recommended)

**Recommendation: create the `servants` row immediately at signup, with `approval_status = 'pending'`.**

Rationale:

1. **Canonical alignment.** `CANONICAL_ROLE_MODEL.md` defines Pending User as *"No system role — represented by `servants.approval_status = 'pending'` … Has servant record: Yes, but `approval_status = 'pending'`."* Creating the row at signup is exactly this representation.
2. **The approval queue is then a trivial query** — `SELECT … FROM servants WHERE approval_status = 'pending' AND church_id = <mine> AND deleted_at IS NULL`. No separate request table is needed for the existing-church path.
3. **Approval is a status flip + role grant**, not a row-creation ceremony. `servants.approval_status`, `approved_by`, `approved_at` are the built-in audit fields.
4. **Deferred creation would require inventing a new pending container** (e.g., `user_registration_requests`) that duplicates `servants` and complicates the profile→servant handoff. The task explicitly says to reuse existing structures and avoid unnecessary complexity.

**Caveat managed:** a pending servant row grants no role and is inert for role-gated purposes — permission resolution is empty, and no assignments reference it until approved (assignment validation already requires `approval_status = 'approved'`). **Caveat (A6):** the earlier claim that "RLS prevents any operational read/write" is overstated — 022's church-scoped `tenant_isolation` policies still permit same-church operational access for any authenticated member of the church, pending users included; this is **accepted residual risk** (§3.3 of `PHASE_3C_SECURITY_REMEDIATION.md`).

---

## 4. Approval / Rejection — Existing Church

### 4.1 Reviewer

Church **super_admin** (permission `servants.approve`, canonical mapping: super_admin only). Approve/reject actions are exposed in the Users module under a "Pending registrations" queue.

### 4.2 Approve (`approve_servant` RPC / server action)

```
1. Actor must be super_admin of the servant's church.
   → CHECK user_is_super_admin(servants.church_id) for auth.uid()
   → AND auth.uid() <> servant.id            (no self-approval)
   → AND servants.approval_status = 'pending' (idempotency guard)
2. UPDATE servants SET approval_status='approved', approved_by=actor, approved_at=now()
   WHERE id = servant_id.
3. Look up the church's 'servant' role (roles.role_type='servant', church_id).
   INSERT user_roles { church_id, user_id=servant_id, role_id, assigned_by=actor,
                       start_date=CURRENT_DATE }   → user gains base servant access.
4. INSERT notification to the applicant: notification_type='approval_result',
   channel='in_app', data={ decision:'approved', servant_id, church_id }.
5. Write audit_logs: action='approve', entity_type='servant', old_values
   {approval_status:'pending'}, new_values {approval_status:'approved', role_id}.
6. Return success.
```

**Access granted on approval:** base `servant` role + own profile visibility. Stage/class assignments remain a separate super_admin/admin action (`servants.assign`), matching the canonical assignment model.

### 4.3 Reject (`reject_servant`)

```
1–2. Same actor/scope/idempotency checks as approve.
3. UPDATE servants SET approval_status='rejected', approved_by=actor, approved_at=now().
4. INSERT notification to applicant: notification_type='approval_result',
   data={ decision:'rejected', servant_id, church_id, reason? }.
5. Write audit_logs: action='reject', entity_type='servant', old_values
   {approval_status:'pending'}, new_values {approval_status:'rejected'}.
```

**Rejected state:** user can still log in, sees a rejected state on `/pending-approval`, and has no roles (no access). Account is retained; canonical role model explicitly allows re-registration later ("Rejected users can re-register (Phase 3)").

### 4.4 Audit & history

Approval history is recorded in `audit_logs` (immutable, append-only by RLS in `022`). Every approve/reject writes a row keyed by `entity_type='servant'`, `entity_id=servant_id` with old/new values. Querying `audit_logs WHERE entity_type='servant' AND entity_id=?` reconstructs the full approval trail. **A dedicated `approval_history` table is NOT added** — it would duplicate `audit_logs` (see `REGISTRATION_DATABASE_CHANGES.md` §5).

---

## 5. Church Dropdown Source

`churches` is RLS-protected (`tenant_read`, `platform_owner_all`, `super_admin_update`) — anonymous users cannot read it. Add a public, projection-limited SECURITY DEFINER RPC:

```
rpc/list_churches_for_signup()
  RETURNS TABLE(id uuid, name_ar text, name_en text, slug text)
  → SELECT id, name_ar, name_en, slug FROM churches
    WHERE is_active = true AND deleted_at IS NULL ORDER BY name_ar
```

Exposes only identity fields (no contact info, no subscription data). This is the **only** public read surface for `churches`.

---

## 6. Notification Payloads

`notifications` canonical columns: `church_id`, `recipient_id`, `notification_type`, `title_ar/title_en`, `body_ar/body_en`, `data`, `channel`, `sent_at`.

> **Note:** sending a notification addressed to **another** user is blocked by RLS (`recipient_scope` = `recipient_id = auth.uid()`), so all notification writes must use the admin client inside a server action or a SECURITY DEFINER helper. Reads stay RLS-protected.

### 6.1 To applicant on signup (optional acknowledgment)

```
notification_type: 'system'          channel: 'in_app'
title_ar: 'تم استلام طلبك'           title_en: 'Request received'
body_ar: 'بانتظار موافقة إدارة الكنيسة' body_en: 'Awaiting church approval'
data: { "type": "registration_submitted", "servant_id": "...", "church_id": "..." }
```

### 6.2 To church super_admin(s) on signup (approval required)

```
notification_type: 'approval_required'   channel: 'in_app'
title_ar: 'طلب انضمام جديد'              title_en: 'New registration request'
body_ar: '{full_name} قدم طلب انضمام'    body_en: '{full_name} submitted a registration request'
data: {
  "type": "servant_registration",
  "servant_id": "...",
  "applicant_name": "{full_name}",
  "applicant_email": "{email}",
  "applicant_phone": "{phone}",
  "church_id": "...",
  "request_date": "<created_at ISO>"
}
```

Recipients: all profiles having an active `super_admin` `user_roles` row for that church.

### 6.3 To applicant on decision

```
notification_type: 'approval_result'   channel: 'in_app'
title_ar: 'تمت الموافقة على طلبك' / 'تم رفض طلبك'
title_en: 'Your request was approved' / 'Your request was rejected'
data: { "decision": "approved"|"rejected", "servant_id": "...", "church_id": "...", "reason"?: "..." }
```

**Email channel** is reserved but out of scope for 3C core (no SMTP/Resend wiring today — see Open Questions in `PHASE_3C_IMPLEMENTATION_PLAN.md`).

---

## 7. State Machine

```
                  signup (existing church)
        ┌──────────────────────────────────────────┐
        ▼                                          │
  servants.approval_status = 'pending'             │
        │                                          │
        ├── super_admin approves ──► 'approved' ──►│ (servant role granted)
        │                                          │
        └── super_admin rejects ──► 'rejected'     │ (no roles, no access)
                                                   │
  new church request ──► church_requests pending ─►┘ (see CHURCH_PROVISIONING_SPEC.md)
```

- `pending` → `approved` / `rejected`: super_admin action (existing church) or platform-owner action (new church, provisioning).
- `approved` → `rejected`: **not supported** (servant is deactivated instead — canonical demotion path).
- `rejected` → re-registration allowed later.

**Effective access = has (approved servant) AND has (active role).** Both must hold; neither exists for a pending user.

---

## 8. Login & Redirect Behavior

| User state | On login | Guarded page access |
|---|---|---|
| pending (servant, no roles) | → `/pending-approval` | Only `/`, `/about`, `/pending-approval`, `/profile` |
| rejected | → `/pending-approval` (rejected view) | Same as pending |
| approved (servant + role) | → `/dashboard` | Normal RBAC via `PermissionGuard` / middleware |
| approved but zero roles (anomaly) | → `/profile` + "contact admin" notice | Only public + profile pages |

Implementation: `get_my_access_state()` RPC + middleware (see `REGISTRATION_UI_FLOW.md` §4) and updated redirect targets in `loginAction` / `proxy.ts`.

---

## 9. Edge Cases

| Case | Handling |
|---|---|
| Email already registered | Block signup; do not create auth user; friendly message |
| Selected church deleted / inactive | Reject signup with "church not available" |
| Duplicate rapid signups | Unique `profiles.email` index + auth uniqueness; server-side check before create |
| User registers twice for same church | Blocked by email uniqueness |
| No super_admin exists in church | Notify is skipped; request sits in queue until a super_admin exists; flagged in PO review (if any) |
| Approval of already-approved/rejected | Idempotency guard (status must be `pending`) |
| Phone format | Normalize/strip; store in `profiles.phone` |
| Prod email confirmation pending | User has account but no session until confirmed; after confirm, they land on `/pending-approval` via login redirect |

---

## 10. Out of Scope (this phase)

- Email/SMS delivery of notifications (reserved `channel='email'`).
- Public marketing landing page (currently auth-gated).
- Servant reassignment / annual window (canonical assignment model, later phase).
- Bulk import of users.
