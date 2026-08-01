# Phase 3C.2 — SQL Audit Checklist

**Phase:** 3C — Registration & Church Provisioning
**Date:** 2026-07-31
**Audited artifact:** `supabase/migrations/023_phase3c_registration.sql`
**Purpose:** pre-apply audit checklist — confirms the generated file is safe to execute. Each box verifies a specific property of the file or of the post-apply database state. Empty boxes = pending audit confirmation.

---

## 1. Schema validation (V1)

- [ ] `church_requests` has exactly 14 columns: id, church_name_ar, church_name_en, catechist_name, applicant_name, email, phone, notes, status, reviewed_by, reviewed_at, decision_notes, created_at, updated_at.
- [ ] `church_requests_status_check` CHECK limits status to `pending/approved/rejected`.
- [ ] `reviewed_by` → `profiles(id) ON DELETE SET NULL`; no other FK on the table allows cross-tenant writes.
- [ ] `notifications.church_id` is nullable after S3; the FK `notifications_church_id_fkey` is **kept** (file never drops it).
- [ ] 3 indexes exist on `church_requests` (`idx_church_requests_status` partial, `idx_church_requests_email_pending` UNIQUE partial on `lower(email)`, `idx_church_requests_email`).
- [ ] `user_roles`: `user_roles_church_id_user_id_role_id_key` ABSENT; `uq_user_roles_active` (partial UNIQUE, `end_date IS NULL`) PRESENT.
- [ ] `trg_church_requests_updated_at` fires `handle_updated_at()` on BEFORE UPDATE.

## 2. RLS validation (V2)

- [ ] `church_requests` RLS enabled; exactly 5 policies with the intended command types:
  - [ ] `platform_owner_all` — ALL, `user_is_platform_owner()`
  - [ ] `applicant_read` — SELECT, `lower(email) = lower(auth.jwt()->>'email')`
  - [ ] `public_insert` — INSERT, `WITH CHECK (status = 'pending')`
  - [ ] `immutable_review` — UPDATE, permissive `USING (false) WITH CHECK (false)` (NOT restrictive)
  - [ ] `immutable_delete` — DELETE, `USING (false)`
- [ ] `user_roles` / `servants` / `notifications` `tenant_isolation` policies are **FOR SELECT only** (writes removed; no FOR ALL remains from this batch).
- [ ] `profiles.own_profile_insert` WITH CHECK = `id = auth.uid() AND EXISTS (active church)` — fail-closed (D-5).
- [ ] No policy on any table **other than** church_requests, user_roles, servants, notifications, profiles was created, dropped, or altered.

## 3. Privilege / escalation audit (V3, D-2)

- [ ] `send_notification(...)` has **no** EXECUTE grant for PUBLIC/anon/authenticated/service_role (revoked; helper-only). `has_function_privilege('anon', ...)` = false.
- [ ] `list_churches_for_signup()` → anon + authenticated only.
- [ ] `submit_church_request(text×7)` → anon + authenticated only.
- [ ] `get_my_access_state()` → authenticated only; anon = false.
- [ ] `approve_servant(uuid)` / `reject_servant(uuid,text)` → authenticated + service_role only.
- [ ] `approve_church_request(uuid,uuid,text)` / `reject_church_request(uuid,text)` → authenticated + service_role only.
- [ ] All 8 RPCs SECURITY DEFINER with `SET search_path = public, auth` (no attacker-writable schema searched); own references schema-qualified where needed.
- [ ] No RPC trusts the session alone: `approve_servant`/`reject_servant` re-check `user_is_super_admin(servant.church_id)` + `auth.uid() <> p_servant_id`; both church-request RPCs re-check `user_is_platform_owner()`; `approve_church_request` additionally validates email match against `auth.users` (D-8).

## 4. Self-approval / escalation paths (R-matrix)

- [ ] C-1: pending user `INSERT INTO user_roles` self-grant **DENIED** (R-1/R-2) — `tenant_isolation` no longer authorizes INSERT.
- [ ] C-2: pending user `UPDATE servants` self-approval / same-church mutation **DENIED** (R-3/R-4) — SELECT-only tenant policy; writes via `super_admin_all` + guarded RPCs only.
- [ ] C-3: notification spoofing `INSERT INTO notifications` **DENIED** (R-9) — SELECT-only tenant policy; `recipient_scope` is own-row.
- [ ] R-8A: writes to user_roles/servants/notifications for non-super_admin **DENIED**.
- [ ] R-11: applicant `UPDATE`/`DELETE` of own church_request **DENIED** (`immutable_review`/`immutable_delete`); PO update still allowed (R-12).
- [ ] R-16: self-profile INSERT without a real active church **DENIED** (fail-closed); service-role admin client allowed (RLS-bypassed).

## 5. Audit continuity (V4)

- [ ] `audit_trigger_fn()` exists, SECURITY DEFINER, uses `actor_id` (not `user_id`) and `action` text (no enum); `entity_id := COALESCE(NEW.id, OLD.id)` satisfies NOT NULL.
- [ ] Exactly 6 triggers: audit_profiles, audit_user_roles, audit_followups, audit_attendance_sessions, audit_attendance_records, audit_beneficiaries.
- [ ] NO `audit_children` trigger (children renamed to beneficiaries in 013; M-2).
- [ ] Dead `audit_attendance` trigger dropped from `attendance_backup_20260730`.
- [ ] No trigger on `audit_logs` itself (no recursion risk); the RPC triggers write to audit_logs which has no write-trigger.
- [ ] Smoke: DML on each of the 6 tables produces audit rows with correct entity_type/action/NOT NULL entity_id.
- [ ] RPC-driven writes write explicit audit rows with `entity_id` always passed (D-4, D-6).

## 6. Data-safety re-verification (P0-relevant)

- [ ] No DML on existing rows anywhere in the file (only DDL + function bodies that run later).
- [ ] S8 `CREATE UNIQUE INDEX uq_user_roles_active` is the only existing-data scan (ACCESS EXCLUSIVE); P0.4 pre-flight confirms 0 duplicate active grants before apply.
- [ ] S8 drop+create are in the same transaction — uniqueness never momentarily lost at COMMIT.
- [ ] `approve_church_request` provisions atomically: church + seed_church_roles + profile + servant + super_admin grant + request approval + notification + 3 audit rows — any failure aborts all.
- [ ] `churches.slug` UNIQUE (001) is the final slug defense; RPC validates format (`^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`).
- [ ] No `ON CONFLICT DO NOTHING` anywhere (D-7) — a missing role grant fails loudly instead of silently skipping.

## 7. Rollback readiness (R1–R5)

- [ ] R1 `DROP TABLE church_requests` (covers S1+S2).
- [ ] R2 restore `notifications.church_id SET NOT NULL` — noted **blocked** if NULL-church rows exist.
- [ ] R3 restore 022 policy definitions verbatim for user_roles/servants/notifications `tenant_isolation` + profiles `own_profile_insert`.
- [ ] R4 drop `uq_user_roles_active` + re-add `user_roles_church_id_user_id_role_id_key` UNIQUE — noted **blocked** if archived+active duplicate grants exist.
- [ ] R5 drop 8 RPCs + 6 triggers + `audit_trigger_fn` (exact-state fidelity to the pre-batch broken-audit state).
- [ ] Primary rollback = restore P0.6 snapshot (batch is non-destructive).

## 8. Audit conclusion

- [ ] All object references in the file match migrations 001–022 (tables, columns, constraints, helper functions, role enum values, policy names).
- [ ] Scope is limited to the 13 approved items — no other table/column/index/policy touched.
- [ ] No privilege-escalation path introduced; C-1/C-2/C-3 closed; audit gap closed at commit.
- [ ] Verdict: **AUDIT_PASS** (pending check-box completion at apply time).

**Auditor notes (sign off):**

```
Date:            ____________________
Auditor:         ____________________
Result:          AUDIT_PASS / AUDIT_FAIL
Blocking items:  ____________________
```
