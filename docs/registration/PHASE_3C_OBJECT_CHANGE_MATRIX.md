# Phase 3C.1 — Object Change Matrix

**Phase:** 3C — Registration & Church Provisioning
**Date:** 2026-07-31
**Basis:** migrations 001–022 (current) → post-023 target. Every object the batch touches, its state before/after, and its migration/rollback action.

---

## 1. Tables

| Object | Current state | Target state | Migration action | Rollback action |
|---|---|---|---|---|
| `church_requests` | **absent** | New table (12 cols: `id`, `church_name_ar`, `church_name_en`, `catechist_name`, `applicant_name`, `email`, `phone`, `notes`, `status` default `'pending'`, `reviewed_by`, `reviewed_at`, `decision_notes`, `created_at`, `updated_at`); RLS **enabled** | `CREATE TABLE`; `ENABLE ROW LEVEL SECURITY` (S1+S2) | `DROP TABLE church_requests` (cascades indexes, FK, trigger, policies) |
| `notifications` | `church_id` NOT NULL (FK `notifications_church_id_fkey`) | `church_id` NULLABLE (FK kept) | `ALTER COLUMN church_id DROP NOT NULL` (S3) | `SET NOT NULL` — **blocked** if any `church_id IS NULL` row exists (PO alerts); clear/reassign those rows first |
| `user_roles` | 001/020 shape; UNIQUE `(church_id,user_id,role_id)`; RLS FOR ALL policy | Same shape; partial-unique active-grant enforcement; RLS SELECT-only | constraint replacement (S8) + policy replacement (S4) | restore constraint + restore FOR ALL policy (R4/R3) |
| `servants` | 011 shape; RLS FOR ALL policy | Same shape; RLS SELECT-only | policy replacement (S5) | restore FOR ALL policy (R3) |
| `profiles` | 022 shape; `own_profile_insert` `WITH CHECK (id = auth.uid())` | Same shape; hardened `own_profile_insert` (fail-closed, D-5) | policy replacement (S7) | restore `WITH CHECK (id = auth.uid())` (R3) |
| `attendance_backup_20260730` | carries dead `audit_attendance` trigger (015) | Trigger removed | `DROP TRIGGER IF EXISTS audit_attendance` (S9) | recreate the dead trigger (fidelity only — table is retired) |
| `churches`, `services`, `stages`, `classes`, `beneficiaries`, `beneficiary_assignments`, `servant_stage_assignments`, `attendance_sessions`, `attendance_records`, `followups`, `spiritual_journal_entries`, `events`, `event_registrations`, `documents`, `ai_conversations`, `ai_messages`, `document_embeddings`, `roles`, `role_permissions`, `permissions`, `audit_logs`, `ministries` | unchanged | unchanged | — (audit triggers added to 6 of them, see §5) | — |

---

## 2. Indexes

| Object | Current state | Target state | Migration action | Rollback action |
|---|---|---|---|---|
| `idx_church_requests_status` | **absent** | partial `(created_at DESC) WHERE status='pending'` | `CREATE INDEX` (S1) | dropped with table |
| `idx_church_requests_email_pending` | **absent** | UNIQUE partial `(lower(email)) WHERE status='pending'` | `CREATE UNIQUE INDEX` (S1) | dropped with table |
| `idx_church_requests_email` | **absent** | `(lower(email))` | `CREATE INDEX` (S1) | dropped with table |
| `uq_user_roles_active` | **absent** | UNIQUE partial `ON user_roles (church_id,user_id,role_id) WHERE end_date IS NULL` | `CREATE UNIQUE INDEX` (S8) | `DROP INDEX uq_user_roles_active` (R4) |
| backing index of `user_roles_church_id_user_id_role_id_key` | exists (auto, inline UNIQUE, 001) | dropped | removed by `DROP CONSTRAINT` (S8) | re-created by `ADD CONSTRAINT` (R4) |
| `idx_user_roles_user_active` | exists, non-unique partial `(user_id, role_id) WHERE end_date IS NULL` (020) | **unchanged (retained, A10/D-7)** | — | — |

---

## 3. Constraints

| Object | Current state | Target state | Migration action | Rollback action |
|---|---|---|---|---|
| `church_requests` PK `(id)` | **absent** | present | `PRIMARY KEY` (S1) | dropped with table |
| `church_requests` status CHECK | **absent** | `status IN ('pending','approved','rejected')` | `CHECK` (S1) | dropped with table |
| `church_requests` `reviewed_by` FK | **absent** | → `profiles(id)` ON DELETE SET NULL | `FOREIGN KEY` (S1) | dropped with table |
| `notifications` `church_id` NOT NULL | present | absent (nullable) | `DROP NOT NULL` (S3) | `SET NOT NULL` after NULL-row cleanup (R2) |
| `notifications_church_id_fkey` | present | **unchanged (kept)** | — | — |
| `user_roles_church_id_user_id_role_id_key` UNIQUE | present (001) | **absent** — replaced by `uq_user_roles_active` (narrower: active rows only) | `DROP CONSTRAINT` (S8) | `ADD CONSTRAINT … UNIQUE (church_id,user_id,role_id)` — blocked by archived+active duplicates (none expected; reactivation-first) |
| `audit_logs` `entity_id` NOT NULL | present (019) | unchanged — RPCs must always pass `entity_id` (D-4) | — | — |

---

## 4. Policies

| Object | Current state (022) | Target state | Migration action | Rollback action |
|---|---|---|---|---|
| `church_requests.platform_owner_all` | **absent** | `FOR ALL USING (user_is_platform_owner())` | `CREATE POLICY` (S2) | dropped with table |
| `church_requests.applicant_read` | **absent** | `FOR SELECT USING (email = auth.jwt()->>'email')` | `CREATE POLICY` (S2) | dropped with table |
| `church_requests.public_insert` | **absent** | `FOR INSERT WITH CHECK (status = 'pending')` | `CREATE POLICY` (S2) | dropped with table |
| `church_requests.immutable_review` | **absent** | `FOR UPDATE USING (false) WITH CHECK (false)` — **permissive** | `CREATE POLICY` (S2) | dropped with table |
| `church_requests.immutable_delete` | **absent** | `FOR DELETE USING (false)` — **permissive** | `CREATE POLICY` (S2) | dropped with table |
| `user_roles.tenant_isolation` | `FOR ALL USING (church_id = get_user_church_id())` | `FOR SELECT USING (church_id = get_user_church_id())` | DROP + CREATE (S4) | restore 022 definition (R3) |
| `servants.tenant_isolation` | `FOR ALL USING (church_id = get_user_church_id())` | `FOR SELECT USING (church_id = get_user_church_id())` | DROP + CREATE (S5) | restore 022 definition (R3) |
| `notifications.tenant_isolation` | `FOR ALL USING (church_id = get_user_church_id())` | `FOR SELECT USING (church_id = get_user_church_id())` | DROP + CREATE (S6) | restore 022 definition (R3) |
| `profiles.own_profile_insert` | `FOR INSERT WITH CHECK (id = auth.uid())` | `FOR INSERT WITH CHECK (id = auth.uid() AND EXISTS (SELECT 1 FROM churches c WHERE c.id = church_id AND c.is_active AND c.deleted_at IS NULL))` | DROP + CREATE (S7) | restore 022 definition (R3) |
| All other 022 policies (~85) | present | **unchanged** | — | — |

---

## 5. Triggers

| Object | Current state | Target state | Migration action | Rollback action |
|---|---|---|---|---|
| `trg_church_requests_updated_at` | **absent** | `BEFORE UPDATE` → `handle_updated_at()` | `CREATE TRIGGER` (S1) | dropped with table |
| `audit_trigger_fn()` | **absent** (CASCADE-dropped by 019) | present: `actor_id`, `action` TEXT, `entity_id := COALESCE(NEW.id, OLD.id)`, SECURITY DEFINER | `CREATE OR REPLACE FUNCTION` (S9) | `DROP FUNCTION` (restores broken/absent pre-state) |
| `audit_profiles` → `profiles` | **absent** (dropped 019) | present | `CREATE TRIGGER` (S10) | `DROP TRIGGER` |
| `audit_user_roles` → `user_roles` | **absent** | present | `CREATE TRIGGER` (S10) | `DROP TRIGGER` |
| `audit_followups` → `followups` | **absent** | present | `CREATE TRIGGER` (S10) | `DROP TRIGGER` |
| `audit_attendance_sessions` → `attendance_sessions` | **absent** (never existed) | present | `CREATE TRIGGER` (S10) | `DROP TRIGGER` |
| `audit_attendance_records` → `attendance_records` | **absent** (never existed) | present | `CREATE TRIGGER` (S10) | `DROP TRIGGER` |
| `audit_beneficiaries` → `beneficiaries` | **absent** (never existed) | present | `CREATE TRIGGER` (S10) | `DROP TRIGGER` |
| `audit_children` → `children` | **absent**; target table also absent (013 rename) | **NOT created** (M-2; coverage via `audit_beneficiaries`) | — | — |
| `audit_attendance` → `attendance_backup_20260730` | present, dead | absent | `DROP TRIGGER IF EXISTS` (S9) | recreate (fidelity only; table retired) |
| `on_auth_user_created` | present, no-op (001) | unchanged | — | — |

---

## 6. Functions / RPCs

| Object | Current state | Target state | Migration action | Rollback action |
|---|---|---|---|---|
| `send_notification(...)` | **absent** | locked signature (§1.2 D-1); SECURITY DEFINER; no client grants | `CREATE FUNCTION` (S11-1) + `REVOKE`/no-grant (S12) | `DROP FUNCTION` |
| `list_churches_for_signup()` | **absent** | projection-limited; grants `anon`,`authenticated` | `CREATE FUNCTION` (S11-2) + grants (S12) | `DROP FUNCTION` |
| `get_my_access_state()` | **absent** | locked signature; grant `authenticated` | `CREATE FUNCTION` (S11-3) + grants (S12) | `DROP FUNCTION` |
| `submit_church_request(...)` | **absent** | locked signature; dedupe + insert + audit (D-6); grants `anon`,`authenticated` | `CREATE FUNCTION` (S11-4) + grants (S12) | `DROP FUNCTION` |
| `approve_servant(uuid)` | **absent** | guarded; reactivation-first grant (A3); grants `authenticated`,`service_role` | `CREATE FUNCTION` (S11-5) + grants (S12) | `DROP FUNCTION` |
| `reject_servant(uuid, text DEFAULT NULL)` | **absent** | guarded; grants `authenticated`,`service_role` | `CREATE FUNCTION` (S11-6) + grants (S12) | `DROP FUNCTION` |
| `approve_church_request(uuid, uuid, text)` | **absent** | PO-guarded atomic provisioning (D-1/D-8); grants `authenticated`,`service_role` | `CREATE FUNCTION` (S11-7) + grants (S12) | `DROP FUNCTION` |
| `reject_church_request(uuid, text DEFAULT NULL)` | **absent** | PO-guarded; grants `authenticated`,`service_role` | `CREATE FUNCTION` (S11-8) + grants (S12) | `DROP FUNCTION` |
| `audit_trigger_fn()` | **absent** | recreated (S9) | `CREATE OR REPLACE` | `DROP FUNCTION` |
| `write_audit_log(...)` | present (019: text signature, SECURITY DEFINER) | **unchanged** (RPCs call it; must pass `entity_id`, D-4) | — | — |
| `seed_church_roles(uuid)` | present (021) | **unchanged** (called by `approve_church_request`) | — | — |
| `get_user_church_id()` | present (022) | **unchanged** (dependencies of policies + 5 functions) | — | — |
| `user_is_platform_owner()` / `user_is_super_admin(uuid)` / `user_is_admin(uuid)` | present (022) | **unchanged** (RPC guards + church_requests policies) | — | — |
| `get_user_service_ids()` / `get_user_stage_ids()` / `get_user_class_ids()` | present (022) | **unchanged** | — | — |
| `user_has_permission(text)` | present (001), **orphaned** | unchanged, **must not be adopted by RPCs** | — | — |
| `get_user_servant_id()` / `get_user_assigned_beneficiary_ids()` | present (022), **orphaned** | unchanged, do not touch | — | — |

---

## 7. Privileges (function EXECUTE)

| Object | Current state | Target state | Migration action | Rollback action |
|---|---|---|---|---|
| 8 new RPCs | (functions don't exist) | per §1.3: `list_churches_for_signup`/`submit_church_request` → `anon`,`authenticated`; `get_my_access_state` → `authenticated`; approve/reject ×4 → `authenticated`,`service_role`; `send_notification` → **no grant** | `REVOKE ALL … FROM PUBLIC` then `GRANT EXECUTE` per surface (S12) | re-grant to defaults (or leave revoked — fail-closed) |
| `church_requests` table privileges | (table doesn't exist) | rely on Supabase default privileges (`anon`/`authenticated`/`service_role` ALL) + RLS | verify at V1/V3 | — |

---

## 8. Permissions / catalog data

| Object | Current state | Target state | Migration action | Rollback action |
|---|---|---|---|---|
| `permissions` catalog | canonical 52 codes (021) | **unchanged** — no new codes required | — | — |
| `role_permissions` | seeded per church (021 `seed_church_roles`) | **unchanged** — new churches get current seeds at provisioning runtime | — | — |
| Existing `roles`/`user_roles` data | untouched | untouched | — | — |

---

## 9. Quick reference — changed-object tally

| Type | New | Modified | Dropped |
|---|---|---|---|
| Table | 1 (`church_requests`) | 1 (`notifications` column) | 0 |
| Index | 4 (`3×church_requests`, `uq_user_roles_active`) | 0 | 1 (constraint backing index, replaced) |
| Constraint | 3 (church_requests) | 0 | 1 (`user_roles` UNIQUE, replaced) + 1 NOT NULL (notifications) |
| Policy | 5 (church_requests) | 4 (`user_roles`/`servants`/`notifications` tenant_isolation, `profiles.own_profile_insert`) | 4 (replaced) |
| Trigger | 7 (updated_at + 6 audit) | 0 | 1 (dead `audit_attendance`) |
| Function/RPC | 9 (8 RPCs + `audit_trigger_fn` recreate) | 0 | 0 |
| Privilege | 8 RPC grant sets | 0 | 0 |
