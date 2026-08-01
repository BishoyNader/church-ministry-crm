# Phase 3C.3 — Staging Test Matrix

**Phase:** 3C — Registration & Church Provisioning
**Stage:** 3C.3 — Staging Deployment Readiness Review
**Date:** 2026-08-01
**Scope:** post-apply validation of `023_phase3c_registration.sql` on the staging environment
**Basis:** `PHASE_3C_SECURITY_REMEDIATION.md` §5 (R-1…R-16), `PHASE_3C_MIGRATION_EXECUTION_PLAN.md` V1–V6,
`REGISTRATION_WORKFLOW_SPEC.md`, `CHURCH_PROVISIONING_SPEC.md`, migration 023 embedded verification (023:878–919)
**Method:** real RLS-enforcing sessions (no service role) for all negative/security cases; service-role admin
client for the signup/provisioning positive paths (matches production architecture).

---

## 1. Test Identities

| ID | Identity | State (pre-test) | Used by |
|---|---|---|---|
| `PO` | Platform owner | Active `platform_owner` grant (can be on any church or none) | NC-02, NC-03, SE-08, SE-13 |
| `SA_A` | Super admin, Church A | Active `super_admin` grant for Church A; servant `approved` | EC-02, EC-03, SE-03, SE-10, R-12 |
| `SA_B` | Super admin, Church B | Active `super_admin` grant for Church B | SE-03 (negative cross-church) |
| `PEND_A` | Pending user, Church A | `servants.approval_status='pending'`, **no** `user_roles` rows | EC-01 result, SE-01, SE-02, SE-05, SE-06, SE-07, SE-12 |
| `SERV_A` | Approved servant, Church A | `servants.approved`, active `servant` grant | SE-01 (R-2), SE-04 (spoof from an in-church actor) |
| `ANON` | Anonymous (no session) | `anon` role | NC-01, SE-14 |
| `APPLICANT` | New-church applicant | No account yet (anonymous) | NC-01 (submitter), NC-02 (provisioned user) |

Fixtures must satisfy pre-flight **PF-23** (≥1 church with seeded roles; ≥1 active `platform_owner`; ≥1 active
`super_admin`).

---

## 2. Existing-Church Signup — Registration Workflow

Reference: `REGISTRATION_WORKFLOW_SPEC.md` §3–§4. The registration path is implemented by the app server action
(`register_existing_church_user`, service-role admin client + explicit audit) and the review path by
`approve_servant` / `reject_servant` RPCs.

### 2.1 Request (signup)

| # | Test | Method | Expected result | Guards |
|---|---|---|---|---|
| EC-01 | Successful registration request | Run `register_existing_church_user` for a new email in Church A (service role) | (1) auth user created; (2) `profiles` row `{church_id=A, email}`; (3) `servants` row `approval_status='pending'`, `id=profile.id`; (4) **no** `user_roles` row; (5) `approval_required` notification to every active super_admin of A; (6) `audit_logs` rows `action='create' entity_type='servant'` + registration request record | A6 invariant — pending user has empty permission resolution |
| EC-01a | Duplicate email blocked | Same signup action with an email that already has a profile | Action rejects before creating auth user; friendly error; no new auth/profile/servant rows | `profiles.email` UNIQUE (010) |
| EC-01b | Inactive / deleted church rejected | Signup for a church with `is_active=false` or `deleted_at` set | Action rejects with "church not available"; nothing created | Workflow §3.2 step 3 |
| EC-01c | Pending user login redirect | Login as the new pending user (no roles) | Lands on `/pending-approval`; `get_my_access_state()` returns `servant_approval_status='pending'`, `role_types=[]`, `has_roles=false` | Workflow §8 |

### 2.2 Approval

| # | Test | Method | Expected result | Guards |
|---|---|---|---|---|
| EC-02 | Legit approval by super admin | `SA_A` calls `approve_servant(PEND_A.id)` (RPC) | (1) `servants.approval_status='approved'`, `approved_by=SA_A`, `approved_at` set; (2) active `user_roles` grant `(A, PEND_A, servant-role)` with `assigned_by=SA_A`; (3) `approval_result`/approved notification to applicant; (4) `audit_logs` row `action='approve' entity_type='servant' entity_id=PEND_A`, old `{approval_status:'pending'}` → new `{approval_status:'approved', role_id}` | R-6 |
| EC-02a | Approval of non-pending servant rejected | `SA_A` calls `approve_servant` on an already-approved servant | RPC raises `servant_not_pending`; no state change | Idempotency guard |
| EC-02b | Approval of unknown/deleted servant rejected | `SA_A` calls `approve_servant` on a random or `deleted_at`-set id | RPC raises `servant_not_found`; no state change | §4.4 |
| EC-02c | Approved user access granted | Login as the approved servant | Lands on `/dashboard`; `get_my_access_state()` returns `servant_approval_status='approved'`, `role_types` contains `servant`, `has_roles=true` | Workflow §8 |

### 2.3 Rejection

| # | Test | Method | Expected result | Guards |
|---|---|---|---|---|
| EC-03 | Legit rejection by super admin | `SA_A` calls `reject_servant(PEND_A.id, 'reason')` | (1) `servants.approval_status='rejected'`, `approved_by=SA_A`, `approved_at` set; (2) **no** `user_roles` grant; (3) `approval_result`/rejected notification with `data.reason`; (4) `audit_logs` row `action='reject' entity_type='servant'` old pending → new rejected | R-6 (reject path) |
| EC-03a | Reject idempotency | `SA_A` calls `reject_servant` on the now-rejected user | RPC raises `servant_not_pending`; no state change | §4.3 |
| EC-03b | Rejected user has no access | Login as rejected user | `/pending-approval` (rejected view); `role_types=[]`, `has_roles=false`; no guarded pages accessible | Workflow §8 |
| EC-03c | Re-registration after rejection | A new signup with the same email (fresh servant row) | Allowed (canonical: "rejected users can re-register"); approval state machine resets to `pending` | State machine §7 |

---

## 3. New-Church Request — Provisioning Workflow

Reference: `CHURCH_PROVISIONING_SPEC.md` §3–§4, `REGISTRATION_DATABASE_CHANGES.md` §4.3/§4.5.

### 3.1 Submission (public, anonymous)

| # | Test | Method | Expected result | Guards |
|---|---|---|---|---|
| NC-01 | Successful submission | `ANON` calls `submit_church_request('الكنيسة X','Church X','كاتب','Applicant','a@x.com','+2010000000')` | (1) `church_requests` row `status='pending'`, fields persisted trimmed, `email` lowercased; (2) audit row `action='create' entity_type='church_request' entity_id=request`, `new_values={status:'pending'}`, `church_id=NULL` (D-6); (3) returns request id | §4.3 |
| NC-01a | Missing required field | `ANON` submits with NULL/blank `church_name_ar` / `catechist_name` / `applicant_name` / `email` | RPC raises `church_name_required` / `catechist_name_required` / `applicant_name_required` / `email_required`; no row | §4.3 |
| NC-01b | Email already registered | Submit with an email that exists in `profiles` | RPC raises `email_already_registered`; no row | Dedupe-1 |
| NC-01c | Request already pending | Submit twice with the same email | Second call raises `request_already_pending` (partial unique index `idx_church_requests_email_pending`) | Dedupe-2 |
| NC-01d | Existing church name | Submit with `church_name_ar`/`church_name_en` matching an existing non-deleted church | RPC raises `church_name_exists`; no row | Dedupe-3 |
| NC-01e | Applicant cannot re-request after a decision | Submit same email after the request was rejected | Allowed (unique index is `WHERE status='pending'`); history preserved; no re-review collision | §4.3 history preservation |

### 3.2 Approval (platform owner, atomic provisioning)

| # | Test | Method | Expected result | Guards |
|---|---|---|---|---|
| NC-02 | Legit approval + provisioning | `PO` calls `approve_church_request(request_id, auth_user_id, slug)` where `auth_user_id` is a **pre-created** auth user whose email matches the request | Single atomic transaction creates: (1) `churches` row `{tier='trial', status='active', trial_ends_at≈now+30d, feature_flags='{}', locale='ar', slug}`; (2) roles seeded via `seed_church_roles` (super_admin/admin/servant); (3) `profiles` row for applicant; (4) `servants` row `approval_status='approved'` by PO; (5) `user_roles` active `super_admin` grant; (6) request → `status='approved'`, `reviewed_by=PO`, `reviewed_at`; (7) `approval_result` notification to applicant with `data.role='super_admin'`; (8) 3 audit rows (church_request approve, church create, servant create) | §4.2, §8.1 |
| NC-02a | Atomicity — auth-user email mismatch | `PO` calls `approve_church_request` with an `auth_user_id` whose email differs from the request email | RPC raises `auth_user_email_mismatch` (D-8); **nothing** created (no church/roles/profile/servant/grant) | D-8 |
| NC-02b | Atomicity — auth user missing | `PO` calls `approve_church_request` with a random/nonexistent `auth_user_id` | RPC raises `auth_user_not_found`; nothing created | D-8 |
| NC-02c | Not-a-PO actor | `SA_A` (non-PO) calls `approve_church_request` | RPC raises `not_platform_owner`; nothing created | §4.2 guard |
| NC-02d | Invalid slug | `PO` calls with uppercase, leading/trailing `-`, or non-`[a-z0-9-]` slug | RPC raises `invalid_slug`; nothing created | slug guard + `churches.slug` UNIQUE |
| NC-02e | Duplicate church name at approval | `PO` approves a request whose name now collides with an existing church | RPC raises `church_name_exists`; nothing created | Dedupe in approve path |
| NC-02f | Already-reviewed request | `PO` calls `approve_church_request` on an approved/rejected request | RPC raises `request_not_pending`; nothing created | Idempotency guard |
| NC-02g | Provisioned applicant signs in | Login as the provisioned applicant | Lands on `/dashboard`; `get_my_access_state()` → `servant_approval_status='approved'`, `role_types` contains `super_admin`, `has_roles=true`; can administer the new church | §4.2 result |

### 3.3 Rejection (platform owner)

| # | Test | Method | Expected result | Guards |
|---|---|---|---|---|
| NC-03 | Legit rejection | `PO` calls `reject_church_request(request_id, 'reason')` | (1) request → `status='rejected'`, `reviewed_by=PO`, `reviewed_at`, `decision_notes='reason'`; (2) **no** church/profile/auth-user/servant/role created; (3) audit row `action='reject' entity_type='church_request'` old pending → new rejected | §4.3 |
| NC-03a | Not-a-PO actor | `SA_A` calls `reject_church_request` | RPC raises `not_platform_owner` | §4.3 |
| NC-03b | Unknown / already-reviewed | `PO` rejects a nonexistent id or a non-pending request | Raises `request_not_found` / `request_not_pending`; no state change | §4.3 |

---

## 4. Security Validation

Reference: `PHASE_3C_SECURITY_REMEDIATION.md` §5 (R-1…R-16) + execution plan V5 (R-16 added). All negative
cases use **real sessions — no service role**.

| # | Test | Method | Expected result | Guards / R-map |
|---|---|---|---|---|
| SE-01 | **Self-escalation — pending user** | `PEND_A` runs `INSERT INTO user_roles (church_id, user_id, role_id, assigned_by, start_date) VALUES (A, PEND_A, <super_admin role of A>, PEND_A, CURRENT_DATE);` | **DENIED** — 0 rows inserted (0 rows affected) | C-1, R-1 |
| SE-02 | **Self-escalation — approved servant** | `SERV_A` runs the same `INSERT INTO user_roles` targeting a `super_admin`/`admin` role | **DENIED** — 0 rows | C-1, R-2 |
| SE-03 | **Self-approval** | `PEND_A` runs `UPDATE servants SET approval_status='approved' WHERE id=auth.uid();` | **DENIED** — 0 rows updated; status stays `pending` | C-2, R-3 |
| SE-04 | **Cross-user servant mutation** | `PEND_A` runs `UPDATE servants SET approval_status='approved' WHERE church_id=A AND id<>auth.uid();` | **DENIED** — 0 rows | C-2, R-4 |
| SE-05 | **Cross-church approval** | `SA_A` calls `approve_servant(<SA_B's pending servant>)` (RPC), and separately attempts a direct `UPDATE servants` on B's row | RPC raises `not_super_admin`; direct UPDATE **DENIED** (0 rows) | R-5 |
| SE-06 | **Notification spoof** | `SERV_A` runs `INSERT INTO notifications (church_id, recipient_id, notification_type, title_ar, title_en, body_ar, channel, sent_at) VALUES (A, <another same-church user>, 'system','…','…','…','in_app', now());` | **DENIED** — 0 rows | C-3, R-9 |
| SE-07 | **Closed write surfaces sweep** | `PEND_A` attempts `INSERT`/`UPDATE`/`DELETE` on `user_roles`, `servants`, `notifications` (including a benign self-row UPDATE on `notifications`) | **DENIED** — 0 rows affected on all three tables | C-1/C-2/C-3, R-8A |
| SE-08 | **Zero-permission sweep (role-gated)** | `PEND_A` reads role-gated surfaces: any `user_roles` rows for roles, role-gated RPC results, assignment-scoped reads | **0 rows / DENIED** — no role-gated access for a role-less pending user | A6, R-8 |
| SE-09 | **Own-profile insert fail-closed** | `PEND_A` (no profile) or a fresh authenticated user runs `INSERT INTO profiles (id, church_id, email) VALUES (auth.uid(), <valid active church>, 'x@x.com');` | **DENIED** (0 rows) — the `churches` EXISTS subquery is evaluated under caller RLS | D-5, R-16 |
| SE-09a | Service-role profile insert | Admin client inserts the profile with a valid active church | **Succeeds** (RLS bypassed — the primary signup path is unaffected) | R-16 |
| SE-10 | **Applicant cannot mutate request** | `APPLICANT` (own request) runs `UPDATE church_requests SET status='approved' WHERE id=own;` and `DELETE FROM church_requests WHERE id=own;` | **DENIED** — permissive-deny `immutable_review`/`immutable_delete`; 0 rows | A2, R-11 |
| SE-11 | **PO can update request** | `PO` runs `UPDATE church_requests SET decision_notes='…' WHERE id=…;` (or the review RPC) | **Succeeds** — permissive deny does NOT block the platform owner | A2, R-12 |
| SE-12 | **Applicant request read scope** | `APPLICANT` reads `church_requests` | Only their own rows (`lower(email)` match) visible; others return 0 rows | `applicant_read` |
| SE-13 | **Audit log immutability** | Any actor runs `UPDATE audit_logs SET … WHERE id=…;` / `DELETE FROM audit_logs WHERE id=…;` | **DENIED** — `immutable_update`/`immutable_delete` (022, untouched) | R-15 |
| SE-14 | **Re-approval after demotion (reactivation-first)** | `SA_A` approves servant → archive grant (`end_date` set) → approve again | Historical row **reactivated** (`end_date=NULL`); exactly **one** active grant; no silent no-op; audit `approve` row written | A3, R-13 |
| SE-15 | **Privilege lockdown (S12)** | `SELECT has_function_privilege('anon','send_notification(uuid,uuid,text,text,text,text,text,jsonb,text)','EXECUTE')`, and for `authenticated` on `send_notification`; `anon` on `get_my_access_state()`; `anon` on `approve_church_request(uuid,uuid,text)` | **false** for all four (send_notification not exposed; PO/SA RPCs not callable by anon; `get_my_access_state` is authenticated-only) | D-2, V3 |
| SE-15a | Public surface grants | `has_function_privilege('anon','list_churches_for_signup()','EXECUTE')` and `submit_church_request(...)` | **true** — public dropdown + public form work | D-2, V3 |
| SE-15b | `get_my_access_state` authenticated grant | `has_function_privilege('authenticated','get_my_access_state()','EXECUTE')` | **true** | D-2, V3 |
| SE-16 | **`send_notification` with NULL church_id** | `PO` recipient: invoke the helper (as function owner path) with `church_id=NULL` | Succeeds; `notifications.church_id IS NULL` allowed (S3); `recipient_scope` grants the PO read of their own row | R-10 |
| SE-17 | **`list_churches_for_signup` projection** | `ANON` calls `list_churches_for_signup()` | Returns only `id, name_ar, name_en, slug` for `is_active AND deleted_at IS NULL`, ordered by `name_ar`; **no** contact/subscription columns | §4.1 |

---

## 5. Audit Validation

Reference: `PHASE_3C_SECURITY_REMEDIATION.md` §4 (A4), migration 023 V4.

| # | Test | Method | Expected result | Guards |
|---|---|---|---|---|
| AU-01 | Audit-trigger function definition | `SELECT pg_get_functiondef('audit_trigger_fn()'::regprocedure) LIKE '%actor_id%';` | `true` (uses `actor_id`, TEXT action, `COALESCE(NEW.id,OLD.id)`) | V4 |
| AU-02 | Exactly 6 audit triggers | `SELECT c.relname, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE t.tgname LIKE 'audit\_%' AND NOT t.tgisinternal ORDER BY c.relname;` | exactly `audit_profiles, audit_user_roles, audit_followups, audit_attendance_sessions, audit_attendance_records, audit_beneficiaries`; **no** `audit_attendance`, **no** `audit_children` | A4, M-2 |
| AU-03 | RPC-driven audit rows | After EC-02 / NC-02 / NC-03, query `audit_logs` for those flows | Rows with correct `entity_type` (`servant`/`church_request`/`church`), correct `action` (`approve`/`reject`/`create`), **`entity_id` NOT NULL** (D-4), `old_values`/`new_values` populated | D-4 |
| AU-04 | Trigger smoke on all 6 tables | For each of `profiles, user_roles, followups, attendance_sessions, attendance_records, beneficiaries`: INSERT / UPDATE / DELETE a **test row** (service role), then query `audit_logs` | `COUNT(*) >= 3` per `entity_type` with `action IN ('create','update','delete')`; rows show `actor_id`, `entity_id` NOT NULL | V4 smoke |
| AU-05 | Audit-log immutability re-check | UPDATE / DELETE on `audit_logs` as any role | DENIED (0 rows) — overlap with SE-13 | R-15 |
| AU-06 | `church_requests` explicit audit (no table trigger) | After NC-01/NC-02/NC-03 verify the three explicit `write_audit_log` rows | `entity_type='church_request'` rows with `action` `create`/`approve`/`reject`, `entity_id=request_id`, `church_id=NULL` for submit/reject | D-6 |

---

## 6. Regression Sweep (single-pass summary)

| # | Test | Method | Expected |
|---|---|---|---|
| RS-01 | Schema sanity after apply | V1 schema assertions (church_requests, nullable column, indexes, constraint swap) | all match 023:878–885 |
| RS-02 | Policy counts | `pg_policies` inventory for the 4 replaced policies + 5 new `church_requests` policies | exact set per 023:888–895 |
| RS-03 | Function/privilege inventory | `pg_proc` for the 9 functions; `has_function_privilege` asserts (SE-15/SE-15a/SE-15b) | all pass |
| RS-04 | Existing-app regression | Login + navigate `/dashboard`, `/users`, `/children`, `/stages`, `/attendance`, `/followups` with `SA_A` | Pages load; existing flows unaffected by SELECT-only policy replacements (P0.5) |
| RS-05 | No dead audit trigger | `audit_attendance` absent from `attendance_backup_20260730` | confirmed |
| RS-06 | Notifications read path | `SA_A` and `PEND_A` read own notifications | own rows only; no cross-recipient leakage |

---

## 7. Pass / Fail Recording

- Each test is executed against staging post-apply (Step 3–5 of the deployment plan).
- Record `PASS` / `FAIL` / `N/A` plus evidence (row counts, error text) in this matrix's result column.
- **Security fail rule:** any FAIL in §4 (SE-01…SE-17) or §5 (AU-01…AU-06) is **rollback-triggering** and
  blocks sign-off (see `PHASE_3C_STAGING_ROLLBACK_PLAN.md` §1 and `PHASE_3C_STAGING_GO_LIVE_GATE.md`).
- **Workflow fail rule:** any FAIL in §2 (EC-*) or §3 (NC-*) primary flow blocks sign-off.
