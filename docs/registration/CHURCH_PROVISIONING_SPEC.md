# Church Provisioning Specification

**Phase:** 3C — Registration & Church Provisioning  
**Date:** 2026-07-31  
**Status:** Architecture / Specification (no code, no migrations)  
**Companion:** `REGISTRATION_WORKFLOW_SPEC.md`, `REGISTRATION_DATABASE_CHANGES.md`

---

## 1. Context

New churches may no longer be created by arbitrary signup. Church creation is a **platform-owner** action, sourced from a user-submitted **church request**. This mirrors the canonical role model: `tenants.create`/`tenants.update` are platform-owner-only permissions, and church onboarding makes the first user of a church a `super_admin` (`CANONICAL_ROLE_MODEL.md`, "Super Admin — Promotion Path").

---

## 2. Entry Point

On the signup form's church dropdown, the final option is **"Request New Church"** (`value = "__new_church__"`). Selecting it navigates to `/church-request` (locale-prefixed). The main signup form is **not** submitted in this flow.

---

## 3. Request Form (`/church-request`)

Public — no authentication required (the applicant does not yet have an account).

| Field | Type | Required | Persisted to |
|---|---|---|---|
| Church name (Arabic) | text | yes | `church_requests.church_name_ar` |
| Church name (English) | text | no | `church_requests.church_name_en` |
| Catechist name | text | yes | `church_requests.catechist_name` |
| Applicant full name | text | yes | `church_requests.applicant_name` |
| Email | email | yes | `church_requests.email` |
| Phone number | tel | yes | `church_requests.phone` |
| Notes | textarea | no | `church_requests.notes` |

**Decisions:**

- **No account is created at request time.** The applicant submits contact data only. This avoids: orphan auth users, a `profiles` row with `church_id = NULL` (schema says NOT NULL, and RLS tenant-isolation on `profiles` would hide a NULL-church profile from its owner), and a "pending user with no church" state that the canonical model does not define.
- **Applicant email uniqueness** is enforced at submission against both existing `profiles.email` and existing `church_requests.email` (pending requests) to prevent duplicate requests and cross-church double signups.

---

## 4. Platform Owner Review

### 4.1 Queue

Platform owner sees a queue page (`/admin/church-requests`, gate: `tenants.read`) listing `church_requests` with `status = 'pending'`, newest first. Each row shows the request data from §3 plus submission date. The queue is the primary surface (in-app notifications to PO are an optional enhancement — see `REGISTRATION_DATABASE_CHANGES.md` §4.4).

### 4.2 Approve (`approve_church_request` RPC / server action)

A single, atomic provisioning transaction:

```
1. Guard: actor is platform owner (user_is_platform_owner()) AND status='pending'.
2. Deduplicate: no existing church with the same normalized name/slug.
3. Create church:
   - name_ar / name_en from request
   - slug := slugify(church_name_ar), suffixed if collision (existing helper logic)
   - contact_email := applicant email, contact_phone := applicant phone
   - subscription_tier='trial', subscription_status='active', trial_ends_at=now()+30d
   - locale := request channel locale (ar default)
4. Seed roles: seed_church_roles(church_id) → super_admin/admin/servant.
5. Create applicant auth user (admin client; email_confirm in dev, email confirm +
   invite in prod). On conflict → abort, cleanup church.
6. Create profile: { id, church_id, email, full_name_ar=applicant_name, phone,
   preferred_locale }.
7. Create servant row: { id, church_id, approval_status='approved',
   approved_by=actor(platform owner id), approved_at=now() }.
   (Canonical: super_admin has a servant record; the provisioned applicant is the
   church's first super_admin.)
8. Assign role: user_roles { church_id, user_id, role_id=super_admin role,
   assigned_by=actor, start_date=CURRENT_DATE }.
9. Update church_requests: status='approved', reviewed_by=actor, reviewed_at=now().
10. Notifications:
    - To applicant: notification_type='approval_result', data={
        decision:'approved', church_id, role:'super_admin' }.
    - (Optional) To applicant: invitation email with set-password link.
11. Audit: action='approve', entity_type='church_request', entity_id=request_id,
    new_values={church_id, status:'approved'}; plus action='create',
    entity_type='church'; action='create', entity_type='servant'.
```

**All-or-nothing:** the transaction must complete atomically. Cleanup path (delete church, delete auth user) mirrors the existing `signUpWithEmail` rollback pattern if any step fails.

**Result:** the new church exists with its applicant as the sole `super_admin`; the applicant can sign in with the invite/password and immediately administer the church.

### 4.3 Reject (`reject_church_request`)

```
1. Guard: actor is platform owner AND status='pending'.
2. Update church_requests: status='rejected', reviewed_by=actor, reviewed_at=now().
3. No church/profile/auth-user is created.
4. Audit: action='reject', entity_type='church_request', entity_id=request_id,
   old_values={status:'pending'}, new_values={status:'rejected'}.
5. (Optional) Notify applicant email. In-app notification is not possible — the
   applicant has no account yet.
```

**History preservation:** the `church_requests` row is never deleted; rejected requests remain queryable (`status='rejected'`), which preserves full request history for the platform owner and prevents re-submission from colliding with a reviewed decision.

---

## 5. Invitation / Password Set

Because no account exists at request time, the applicant must be able to establish credentials after approval:

- **Recommended:** Supabase `admin.generateLink('invite', email, {redirectTo})` → the applicant clicks the invite and lands on `/reset-password` (already implemented) to set a password. Falls back to the existing reset-password flow for any later "forgot password" case.
- Email delivery of the invite is a **deployment prerequisite** (SMTP/Resend) — flagged in the implementation plan. Without email delivery, the PO can copy the invite link from the queue and share it out-of-band.

---

## 6. Duplicate & Conflict Controls

| Rule | Mechanism |
|---|---|
| No duplicate church names | App-level check on approve: normalized `name_ar`/`name_en` against `churches`; slug uniqueness enforced by DB UNIQUE index |
| No duplicate pending request for same email | Check `church_requests.email` where `status='pending'`; UNIQUE partial index `(lower(email)) WHERE status='pending'` |
| No re-review of reviewed request | `status` must be `'pending'` (idempotency guard in RPC) |
| No church creation bypass | `churches` INSERT is removed from signup; only `approve_church_request` (PO-gated) writes `churches` (server path). RLS already restricts `churches` writes to platform owner / own-church super admin update. |

---

## 7. State Machine

```
  submit (public /church-request)
        │
        ▼
  church_requests.status = 'pending'
        │
        ├── PO approves ──► 'approved' ──► church + profile + servant + super_admin
        │                                   created in one transaction
        └── PO rejects  ──► 'rejected'   (nothing created; history kept)
```

---

## 8. Notification Payloads (New Church)

### 8.1 To applicant on approval

```
notification_type: 'approval_result'   channel: 'in_app'
title_ar: 'تم إنشاء كنيسة {church_name}'   title_en: '{church_name} is ready'
body_ar: 'تم تفعيل حسابك كمدير للكنيسة'     body_en: 'Your account is now the church administrator'
data: { "decision": "approved", "church_id": "...", "church_request_id": "...", "role": "super_admin" }
```

### 8.2 Optional PO alert on new request

```
notification_type: 'approval_required'  channel: 'in_app'
data: { "type": "church_request", "church_request_id": "...", "applicant_email": "...",
        "applicant_name": "...", "church_name_ar": "...", "request_date": "..." }
```

Requires `notifications.church_id` to be nullable (PO has no church) — see `REGISTRATION_DATABASE_CHANGES.md` §4.4. The PO queue page is the primary surface.

---

## 9. Provisioned Church Baseline

| Setting | Value |
|---|---|
| `subscription_tier` | `trial` |
| `subscription_status` | `active` |
| `trial_ends_at` | `now() + 30 days` |
| `feature_flags` | `{}` |
| `locale` | `ar` (request channel) |
| Roles | `super_admin`, `admin`, `servant` (via `seed_church_roles`) |
| Initial members | applicant (super_admin) |
| Initial services/stages/classes | none — created by the new super_admin post-onboarding |

---

## 10. Out of Scope

- Billing/subscription management UI (Phase 2).
- Bulk church import / PO-created churches without a request (possible later via `tenants.create` UI).
- Church settings and branding during provisioning.
