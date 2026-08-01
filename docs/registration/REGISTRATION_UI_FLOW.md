# Registration UI Flow

**Phase:** 3C — Registration & Church Provisioning  
**Date:** 2026-07-31  
**Status:** Architecture / Specification

---

## 1. Route Inventory

| Route | Access | Purpose |
|---|---|---|
| `/{locale}/signup` | public | Main registration form (church dropdown) |
| `/{locale}/church-request` | public | New-church request form |
| `/{locale}/pending-approval` | authenticated, any approval state | Status page (pending/approved/rejected) |
| `/{locale}/about` | public (new) | About page (allowed pre-approval) |
| `/{locale}/profile` | authenticated (new, optional) | Own profile (allowed pre-approval) |
| `/{locale}/admin/church-requests` | platform_owner (`tenants.read`) | PO review queue (new) |
| `/{locale}/users` | `users.read` | Users module — gains "Pending registrations" queue + approve/reject |
| All other app routes | existing RBAC | Dashboard, children, attendance, followups, stages |

---

## 2. Signup Form (redesigned)

### 2.1 Fields

```
Full name (Arabic)      [text]
Full name (English)     [text, optional]
Email                   [email]
Phone number            [tel]
Password                [password, min 8]
Confirm password        [password]
Church                  [dropdown ← list_churches_for_signup()]
                         ├─ <church name>…
                         ├─ … 
                         └─ ✚ Request New Church  → navigates to /church-request
```

### 2.2 Behavior

- Dropdown loads on mount from `list_churches_for_signup()`; shows loading skeleton; empty state "No churches available yet".
- Selecting **Request New Church** navigates immediately (does not submit).
- On submit → `registerExistingChurchUser` server action (§3 of `REGISTRATION_WORKFLOW_SPEC.md`).
- Success: prod → `/login?signup=pending`; dev → `/pending-approval`.
- Errors surfaced per-field (zod) plus banner for duplicates / unavailable church.

---

## 3. New-Church Request Form (`/church-request`)

```
Church name (Arabic)    [text]
Church name (English)   [text, optional]
Catechist name          [text]
Applicant full name     [text]
Email                   [email]
Phone number            [tel]
Notes                   [textarea, optional]
[Submit request]   [← back to signup]
```

- Public (no session required).
- On submit → `submitChurchRequest` action → success state: "Your request has been received. A platform administrator will review it."
- Guarded against duplicate pending requests (email dedupe).

---

## 4. Pending Approval Experience

### 4.1 `/pending-approval` page

Renders from `get_my_access_state()`:

| Section | Content |
|---|---|
| Status banner | `pending` (amber) / `approved` (green) / `rejected` (red) |
| Church | church name (from profile → `churches.name_ar`) |
| Submission date | `servants.created_at` |
| Instructions | pending: "Your request is with the church administrator." / approved: "Your account is active — go to dashboard" (link) / rejected: "Contact your church administrator." |

### 4.2 Middleware behavior (extend `src/proxy.ts`)

After the existing session check, resolve access state via `get_my_access_state()`.

| State | Allowed routes | Redirect target for everything else |
|---|---|---|
| unauthenticated | `/login`, `/signup`, `/church-request`, `/forgot-password`, `/reset-password`, `/`, `/about` | `/login` |
| authenticated + pending | `/`, `/about`, `/pending-approval`, `/profile` | `/pending-approval` |
| authenticated + rejected | same as pending | `/pending-approval` (rejected view) |
| authenticated + approved + roles | all normal routes | existing logic |
| authenticated + approved + zero roles (anomaly) | `/`, `/about`, `/profile`, `/pending-approval` | `/pending-approval` ("contact admin") |

Middleware is **UX-only**. RLS remains the enforcement layer. **Do not** query sensitive data in middleware — `get_my_access_state()` returns only the state tuple.

### 4.3 Login redirect

`loginAction` and the auth-page redirect in `proxy.ts` route pending/rejected users to `/pending-approval` instead of `/dashboard`.

### 4.4 Route guards

- Wrap guarded pages with `PermissionGuard` (existing component) using canonical codes after the constants re-sync (§3.2 of `REGISTRATION_RBAC_IMPACT.md`).
- Add a `PendingGate` (server-side check via `get_my_access_state`) at the `[locale]` layout level to short-circuit any page a pending user hits directly; `PermissionGuard` remains the final arbiter for data-level gating.

---

## 5. Approval UI (Existing Churches) — Users module

Add to `/users` a **"Pending registrations"** tab/queue (visible to super_admin only):

| Column | Content |
|---|---|
| Applicant | name, email, phone |
| Church | (implicit — same church) |
| Request date | `servants.created_at` |
| Actions | **Approve** / **Reject** (reject prompts optional reason) |

- List query: `servants WHERE church_id = <mine> AND approval_status = 'pending'`.
- Approve → `approve_servant` action → optimistic success → row leaves queue; toast + audit.
- Reject → `reject_servant` action with optional reason.
- Guards: `hasPermission(servants.approve)`; RPC re-checks at DB.

---

## 6. Platform Owner Queue (`/admin/church-requests`)

| Column | Content |
|---|---|
| Church name | `church_name_ar` / `_en` |
| Catechist | `catechist_name` |
| Applicant | name, email, phone |
| Notes | collapsible |
| Submitted | `created_at` |
| Actions | **Approve** / **Reject** (reject prompts reason) |

- Gate: `tenants.read`; page-level `RoleGuard role="platform_owner"`.
- Approve runs `approve_church_request` (atomic provisioning) → row moves to approved; audit + notification side effects happen in the RPC.
- Reject runs `reject_church_request` → row moves to rejected with `decision_notes`.
- Filter tabs: pending / approved / rejected (history preserved).

---

## 7. Notification Center

- A minimal in-app notification list (own rows only — RLS-guaranteed) with the approval payloads from `REGISTRATION_WORKFLOW_SPEC.md` §6.
- Optional, can ship behind the same workstream as notifications service.

---

## 8. i18n Keys (new)

Namespaced under `auth`, `users`, `churches`:

```
auth.signup.phone, auth.signup.church, auth.signup.requestNewChurch
auth.pending.title/status/submittedOn/instructions/approved/rejected
churches.request.title/*.churchNameAr/*.catechistName/*.applicantName/*.notes
users.approvalQueue.title/approve/reject/reason
admin.churchRequests.*
```

Arabic mirror in `ar.json`.

---

## 9. Redirect Matrix (summary)

| From | Pending user | Approved user |
|---|---|---|
| `/login` (already authed) | `/pending-approval` | `/dashboard` |
| `/signup` (already authed) | `/pending-approval` | `/dashboard` |
| `/dashboard`, `/children`, `/attendance`, `/followups`, `/stages`, `/users` | `/pending-approval` | stay |
| `/pending-approval` (approved) | n/a | `/dashboard` (auto) |
