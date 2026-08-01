# Phase 3C.2 — SQL Generation Report

**Phase:** 3C — Registration & Church Provisioning
**Date:** 2026-07-31
**Artifact:** `supabase/migrations/023_phase3c_registration.sql`
**Verdict:** `GENERATED_READY_FOR_AUDIT`
**Gate:** generated strictly per `PHASE_3C_MIGRATION_EXECUTION_PLAN.md` (S1–S12, locked signatures §1.2, privilege surface §1.3, D-1…D-8, P0 pre-flights, V1–V6 verification, R1–R5 rollback). No execution, no staging instructions, no deployment approval — this report covers generation only.

---

## 1. File overview

- **File:** `supabase/migrations/023_phase3c_registration.sql` (957 lines)
- **Transaction:** single `BEGIN;` / `COMMIT;` (022 style); any failure rolls back the whole batch
- **Style:** matches 001–022 conventions (banner comments, section numbering, dependency notes, verification + rollback comments appended after `COMMIT`)
- **Scope:** only the 13 approved items; no other table/column/index/policy touched; no DML on existing rows
- **Idempotence guards used:** `DROP POLICY IF EXISTS`, `DROP TRIGGER IF EXISTS`, `DROP CONSTRAINT IF EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`, `DROP TYPE/INDEX` not required (none touched)

## 2. Object counts (what the file creates/changes)

### 2.1 Tables & columns
| Object | Action | Step |
|---|---|---|
| `church_requests` | CREATE (10 columns, 1 CHECK, PK, 2 FKs, 3 indexes, 1 trigger) | S1 |
| `notifications.church_id` | DROP NOT NULL (FK kept) | S3 |

### 2.2 Policies
| Policy | Table | Change | Step |
|---|---|---|---|
| `platform_owner_all` | church_requests | CREATE (ALL, PO-only) | S2 |
| `applicant_read` | church_requests | CREATE (SELECT, JWT email match) | S2 |
| `public_insert` | church_requests | CREATE (INSERT, `status='pending'` only) | S2 |
| `immutable_review` | church_requests | CREATE (UPDATE, permissive deny) | S2 |
| `immutable_delete` | church_requests | CREATE (DELETE, deny) | S2 |
| `tenant_isolation` | user_roles | REPLACE → SELECT-only (C-1) | S4 |
| `tenant_isolation` | servants | REPLACE → SELECT-only (C-2) | S5 |
| `tenant_isolation` | notifications | REPLACE → SELECT-only (C-3) | S6 |
| `own_profile_insert` | profiles | REPLACE → fail-closed active-church EXISTS (D-5) | S7 |

### 2.3 Indexes & constraints
| Object | Action | Step |
|---|---|---|
| `idx_church_requests_status` | CREATE (partial, pending queue) | S1 |
| `idx_church_requests_email_pending` | CREATE UNIQUE (partial, one pending per email) | S1 |
| `idx_church_requests_email` | CREATE | S1 |
| `user_roles_church_id_user_id_role_id_key` | DROP CONSTRAINT | S8 |
| `uq_user_roles_active` | CREATE UNIQUE INDEX (partial, `end_date IS NULL`) | S8 |

### 2.4 Triggers
| Trigger | Table | Action | Step |
|---|---|---|---|
| `trg_church_requests_updated_at` | church_requests | CREATE | S1 |
| `audit_profiles` / `audit_user_roles` / `audit_followups` / `audit_attendance_sessions` / `audit_attendance_records` / `audit_beneficiaries` | 6 tables | CREATE (6) | S10 |
| `audit_attendance` | attendance_backup_20260730 | DROP (dead trigger) | S9 |

### 2.5 Functions
| Function | Signature | Purpose | Step |
|---|---|---|---|
| `audit_trigger_fn()` | returns trigger, SECURITY DEFINER, `search_path=public,auth` | restore audit stream (A4) | S9 |
| `send_notification(...)` | 9 args (helper) | sole notification write path (A9, D-2) | S11-1 |
| `list_churches_for_signup()` | returns table, STABLE | public church dropdown | S11-2 |
| `get_my_access_state()` | returns table, STABLE | middleware / pending page | S11-3 |
| `submit_church_request(text,text,text,text,text,text,text)` | returns uuid | public request form | S11-4 |
| `approve_servant(uuid)` | returns void | super_admin approval | S11-5 |
| `reject_servant(uuid,text)` | returns void | super_admin rejection | S11-6 |
| `approve_church_request(uuid,uuid,text)` | returns void | PO provisioning (D-1/D-8) | S11-7 |
| `reject_church_request(uuid,text)` | returns void | PO rejection | S11-8 |

All 8 new SECURITY DEFINER RPCs set `SET search_path = public, auth` (D-3).

### 2.6 Privileges (S12, D-2 — full revoke then targeted grant)
| Function | Revoked from | Granted to |
|---|---|---|
| `send_notification` | PUBLIC, anon, authenticated, service_role | **none** (helper only) |
| `list_churches_for_signup` | PUBLIC, anon, authenticated, service_role | anon, authenticated |
| `submit_church_request` | PUBLIC, anon, authenticated, service_role | anon, authenticated |
| `get_my_access_state` | PUBLIC, anon, authenticated, service_role | authenticated |
| `approve_servant` / `reject_servant` | PUBLIC, anon, authenticated, service_role | authenticated, service_role |
| `approve_church_request` / `reject_church_request` | PUBLIC, anon, authenticated, service_role | authenticated, service_role |

## 3. Dependencies honored (verified against 001–022)

| Dependency | Source | Used by |
|---|---|---|
| `gen_random_uuid()` (pgcrypto) | 001 | church_requests PK default |
| `handle_updated_at()` | 001 | church_requests trigger |
| `churches` (name/slug/is_active/deleted_at + 009 columns) | 001/009 | S7 policy, S11-2, S11-4, S11-7 |
| `profiles` (id/church_id/email/full_name/phone/preferred_locale + `idx_profiles_email` UNIQUE) | 001/010 | S7, S11-3, S11-4, S11-7 |
| `servants` (approved_by/approved_at/approval_status) | 011 | S5, S11-3, S11-5/6, S11-7 |
| `roles` (`user_role_type` enum, UNIQUE(church_id,role_type)) | 001/021 | S11-5, S11-7 |
| `user_roles` (assigned_by/start_date/end_date) | 001/020 | S4, S8, S11-5, S11-7 |
| `notifications` (recipient_id/channel/notification_type/data/body_ar) | 001/018 | S3, S6, S11-1 |
| `audit_logs` (actor_id/action text/entity_id NOT NULL) | 001/019 | S9, S10, S11-4…S11-8 |
| `attendance_sessions` / `attendance_records` | 015 | S10 |
| `beneficiaries` (renamed from children, 013) | 013 | S10 (no audit_children, M-2) |
| `attendance_backup_20260730` | 015 | S9 dead-trigger drop |
| `followups` | 001/016 | S10 |
| `write_audit_log(...)` | 019 | S11-4…S11-8 |
| `seed_church_roles(p_church_id uuid)` | 021 | S11-7 |
| `get_user_church_id()` / `user_is_platform_owner()` / `user_is_super_admin(uuid)` | 022 | S2, S4–S7, S11-3, S11-5/6/7/8 |
| `auth.uid()` / `auth.jwt()` / `auth.users` | auth schema | S2, S7, S9, S11 (D-8 uses auth.users) |

No cross-migration name collision found (checked every object name against 001–022).

## 4. Locked decisions applied (D-1…D-8)

| Decision | Applied at |
|---|---|
| D-1 `approve_church_request(p_request_id uuid, p_auth_user_id uuid, p_slug text)` | S11-7 signature |
| D-2 privilege lockdown, `send_notification` no client grants | S12 |
| D-3 all SECURITY DEFINER functions `SET search_path = public, auth` | S9, S11 |
| D-4 RPC audit rows always pass `entity_id` | S11-4…S11-8 |
| D-5 `own_profile_insert` fail-closed | S7 |
| D-6 explicit audit rows (church_requests has no table trigger) | S11-4…S11-8 |
| D-7 no `ON CONFLICT DO NOTHING` (missing grant must fail loudly) | S11-5 |
| D-8 email-match guard against `auth.users` before provisioning | S11-7 |

## 5. Verification plan embedded

V1 schema / V2 policies / V3 functions+privileges / V4 audit continuity / V5 RLS regression matrix (R-1…R-16) / V6 flow smoke — all appended as comments after `COMMIT` (lines 877–931). Pre-flight P0.1–P0.7 remain execution-time checks, out of scope for generation.

## 6. Rollback notes embedded

R1–R5 appended as comments (lines 933–957): `DROP TABLE church_requests`, restore `church_id` NOT NULL (blocked-case noted), restore 022 policies verbatim, drop `uq_user_roles_active` + re-add UNIQUE constraint (blocked-case noted), drop 8 RPCs + 6 triggers + `audit_trigger_fn`. Primary rollback = P0.6 snapshot.

## 7. Generation verdict

**`GENERATED_READY_FOR_AUDIT`**

The file is complete, internally consistent, and matches the execution plan's S1–S12 with all locked decisions. Every object reference (tables, columns, constraints, helper functions, roles, policy names) was re-verified against migrations 001–022 and found valid. No scope drift: only the 13 approved items are present.

**Next (separate gate, not part of this report):** apply-time execution — P0 pre-flights, staging/scratch verification (V1–V6), and deployment approval. If the audit or apply surfaces any conflict, return to the generation gate with `REQUIRES_PLAN_CHANGES`.
