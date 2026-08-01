# Phase 3C.1 — Migration Execution Plan

**Phase:** 3C — Registration & Church Provisioning
**Date:** 2026-07-31
**Gate status:** `APPROVED_FOR_MIGRATION_GENERATION` (see `PHASE_3C_DATABASE_IMPLEMENTATION_GATE.md` §6)
**Basis:** migrations 001–022 (applied, verified) + amended 3C spec set
**Scope:** design only — no SQL generated. This document is the authoritative execution order for the SQL author.

---

## 0. Locked design decisions (must be followed at generation)

These resolve the remaining `(...)` placeholders in the spec and two operational gaps. They are consistent with the approved surface (still exactly 8 RPCs, still collision-free).

| ID | Decision | Rationale / source |
|---|---|---|
| **D-1** | RPC signatures are locked (§1.2). `approve_church_request` takes `(p_request_id uuid, p_auth_user_id uuid, p_slug text)`. | Auth-user creation stays in the server action (auth is a separate schema; spec §4.5 "admin client inside server action OR dedicated RPC" → choose admin client). Slug generation stays in the app layer (`ensureUniqueSlug`, plan 2.4) because `church_name_ar` is Arabic and slugification requires transliteration; DB enforces `churches.slug` UNIQUE as the last line of defense. |
| **D-2** | RPC privilege lockdown: `REVOKE ALL … FROM PUBLIC, anon, authenticated` on `send_notification`; grant `EXECUTE` per surface (§1.3). | Implements the spec's "`send_notification` not exposed to clients" — Supabase default privileges otherwise expose every new function to `anon`/`authenticated` via PostgREST. |
| **D-3** | Every `SECURITY DEFINER` function sets `SET search_path = ''` (or `= public`) and schema-qualifies its table references. | Supabase hardening; prevents search_path hijack of definer functions. |
| **D-4** | RPCs must **always** pass `entity_id` to `write_audit_log` (audit rows have `entity_id NOT NULL`, 019:32). For church-request audits pass the request id; for church-created pass the church id; `church_id` may be NULL (church_requests have no church). | Prevents NOT NULL violation inside every RPC that audits. |
| **D-5** | `profiles.own_profile_insert` hardening ships **as specified** and is documented as **fail-closed**: the `EXISTS (SELECT 1 FROM churches …)` subquery is evaluated under the caller's RLS context (churches RLS applies), so any authenticated self-insert is denied. This is acceptable — the signup path is the service-role admin client (RLS-bypassed). Verified by V5/R-16. | RLS-applies-to-subquery semantics; fail-closed is the safe direction and matches plan 2.1. |
| **D-6** | `submit_church_request` writes an audit row (`action='create', entity_type='church_request', entity_id=request, new_values={status:'pending'}`, `church_id=NULL`) inside the same transaction. | Matches the §8 audit table ("Church request submitted"); not explicit in §4.3 — made explicit here. |
| **D-7** | `idx_user_roles_user_active` (020) is **retained**. | Gate amendment A10. |
| **D-8** | `approve_church_request` validates `p_auth_user_id` exists in `auth.users` **and** its email equals the request's `email` before provisioning. | Prevents provisioning the request against a different applicant. |

---

## 1. Batch structure

### 1.1 One migration file, one transaction

- **Single file:** `supabase/migrations/023_phase3c_registration.sql` (next after 022 — no 023+ exists).
- **One transaction:** every statement in the file is atomic. A failure anywhere rolls back the entire batch (Supabase applies each migration in a transaction). This guarantees the gate condition that the three `tenant_isolation` replacements + `own_profile_insert` + RPCs ship together.
- **Split policy:** do **not** split into multiple files unless scratch testing reveals a need. If a split becomes necessary, it must preserve batch-atomicity semantics (all-or-nothing per feature: policies+RPCs in one file).

### 1.2 Locked RPC signatures

```text
send_notification(p_church_id uuid, p_recipient_id uuid, p_notification_type text,
                  p_title_ar text, p_title_en text DEFAULT NULL, p_body_ar text DEFAULT NULL,
                  p_body_en text DEFAULT NULL, p_data jsonb DEFAULT NULL,
                  p_channel text DEFAULT 'in_app') RETURNS uuid
list_churches_for_signup() RETURNS TABLE (id uuid, name_ar text, name_en text, slug text)
get_my_access_state() RETURNS TABLE (church_id uuid, church_name_ar text,
                  servant_approval_status text, role_types text[],
                  is_active boolean, has_roles boolean)
submit_church_request(p_church_name_ar text, p_church_name_en text, p_catechist_name text,
                  p_applicant_name text, p_email text, p_phone text, p_notes text DEFAULT NULL) RETURNS uuid
approve_servant(p_servant_id uuid) RETURNS void
reject_servant(p_servant_id uuid, p_reason text DEFAULT NULL) RETURNS void
approve_church_request(p_request_id uuid, p_auth_user_id uuid, p_slug text) RETURNS void
reject_church_request(p_request_id uuid, p_reason text DEFAULT NULL) RETURNS void
```

All are `SECURITY DEFINER` except none; **all eight** are `SECURITY DEFINER` (per spec §4) with `SET search_path` (D-3). Internal guards are per spec §4.4/§4.5 (actor checks via `user_is_platform_owner` / `user_is_super_admin`, status-idempotency, `auth.uid() <> p_servant_id`).

### 1.3 Privilege surface (D-2)

| Function | EXECUTE grants | PostgREST exposure |
|---|---|---|
| `list_churches_for_signup` | `anon`, `authenticated` | Public dropdown |
| `submit_church_request` | `anon`, `authenticated` | Public form |
| `get_my_access_state` | `authenticated` | Middleware / pending page |
| `approve_servant` / `reject_servant` | `authenticated`, `service_role` | Super_admin queue (RPC guards internally) |
| `approve_church_request` / `reject_church_request` | `authenticated`, `service_role` | PO queue (RPC guards internally) |
| `send_notification` | **none** (revoke `PUBLIC`, `anon`, `authenticated`; `service_role` only if the server action ever calls it directly — otherwise no grant at all) | **Not exposed** |

Every new function starts with `REVOKE ALL ON FUNCTION … FROM PUBLIC;` then explicit `GRANT EXECUTE` per the table (defense against Supabase default-privilege exposure).

---

## 2. Pre-flight checks (P0) — run on live DB before the batch; NOT part of the migration file

| # | Check | Purpose |
|---|---|---|
| P0.1 | `SELECT to_regclass('public.church_requests') IS NULL` and no migration `023*` applied | Confirm this is the first 3C batch |
| P0.2 | `SELECT column_name FROM information_schema.columns WHERE table_name='notifications' AND column_name='old_metadata'` | A9 — confirm undocumented column exists |
| P0.3 | `SELECT conname FROM pg_constraint WHERE conrelid='user_roles'::regclass AND contype='u'` → expect `user_roles_church_id_user_id_role_id_key` | A10 — exact constraint name for the drop |
| P0.4 | Duplicate-active-grant scan: `SELECT 1 FROM user_roles GROUP BY church_id,user_id,role_id HAVING COUNT(*)>1 AND COUNT(*) FILTER (WHERE end_date IS NULL) > 1` → expect 0 rows | Guarantees `uq_user_roles_active` builds without failure |
| P0.5 | App-write-path re-verification: grep `src/` for authenticated-client (non-admin) `INSERT/UPDATE/DELETE` against `user_roles`, `servants`, `notifications` → expect none (audit already found 0 notification writes; admin client only) | Confirms the SELECT-only policy replacements break no current flow |
| P0.6 | `pg_dump` of affected tables (`notifications`, `user_roles`, `servants`, `profiles`) — backup snapshot | Rollback baseline |
| P0.7 | Scratch project: apply migrations 001–022 + the 3C batch; record policy/function/trigger counts for V-checks | Scratch-first requirement |

---

## 3. Execution order (S1–S12, inside the single 023 transaction)

Legend — **Locks:** ACCESS EXCLUSIVE (AX) on the listed table for every DDL; **Risk:** Low / Med / High with the dominant cause.

### S1 — `church_requests` table, constraints, trigger, indexes

| | |
|---|---|
| **Objects modified** | CREATE TABLE `church_requests`; PK; `status` CHECK; `reviewed_by` FK → `profiles(id)` ON DELETE SET NULL; `trg_church_requests_updated_at` (BEFORE UPDATE, `handle_updated_at`); indexes `idx_church_requests_status`, `idx_church_requests_email_pending` (UNIQUE partial), `idx_church_requests_email` |
| **Prerequisites** | `handle_updated_at` (001), `gen_random_uuid` via pgcrypto (001), `profiles` (001) |
| **Lock risk** | **Low** — new empty table; AX on a not-yet-used relation |
| **Rollback impact** | DROP TABLE (removes table, indexes, FK, trigger) |
| **Deployment risk** | **Low** — additive; nothing references it yet |

Columns per `REGISTRATION_DATABASE_CHANGES.md` §3: `id, church_name_ar, church_name_en, catechist_name, applicant_name, email, phone, notes, status (default 'pending'), reviewed_by, reviewed_at, decision_notes, created_at, updated_at`.

### S2 — `church_requests` RLS enable + policies

| | |
|---|---|
| **Objects modified** | `ALTER TABLE church_requests ENABLE ROW LEVEL SECURITY`; policies `platform_owner_all` (FOR ALL, `user_is_platform_owner()`), `applicant_read` (SELECT, `email = auth.jwt()->>'email'`), `public_insert` (INSERT, `WITH CHECK (status = 'pending')`), `immutable_review` (UPDATE, **permissive** `USING (false) WITH CHECK (false)` — NOT `RESTRICTIVE`), `immutable_delete` (DELETE, **permissive** `USING (false)`) |
| **Prerequisites** | S1; `user_is_platform_owner` (022) |
| **Lock risk** | **Low** — catalog-only on a new table |
| **Rollback impact** | Dropped with S1's DROP TABLE |
| **Deployment risk** | **Low** — additive. Note: `public_insert` permits anonymous rows in `status='pending'` only; the review columns are spoofable at submit time but every field an attacker can set is overwritten by the review RPCs (documented integrity note N-10, non-blocking) |

### S3 — `notifications.church_id` → NULLABLE

| | |
|---|---|
| **Objects modified** | `ALTER TABLE notifications ALTER COLUMN church_id DROP NOT NULL` (FK `notifications_church_id_fkey` **kept**) |
| **Prerequisites** | `notifications` (001/018) |
| **Lock risk** | **Low** — metadata-only change, no table rewrite; brief AX on `notifications` (small table) |
| **Rollback impact** | `SET NOT NULL` — **fails if any row has `church_id IS NULL`** (PO-alert rows written after deploy). See R3 in §5 |
| **Deployment risk** | **Low** — one-line; `recipient_scope` is role-independent; `tenant_isolation` becomes SELECT-only in S6 and its `NULL` church_id contribution is irrelevant (falsy) |

### S4 — `user_roles.tenant_isolation` → SELECT-only (C-1)

| | |
|---|---|
| **Objects modified** | DROP POLICY `tenant_isolation` ON `user_roles`; CREATE POLICY `tenant_isolation` ON `user_roles` FOR SELECT USING `(church_id = get_user_church_id())` |
| **Prerequisites** | 022 baseline; `get_user_church_id` (001/022) |
| **Lock risk** | **Low** — catalog op; AX on `user_roles` (small) |
| **Rollback impact** | Restore the 022 FOR ALL definition (exact SQL in the change matrix) |
| **Deployment risk** | **Med** — **must** ship in the same transaction as S11 (RPCs are the new write path). No current app flow writes `user_roles` via the authenticated client (P0.5) |

### S5 — `servants.tenant_isolation` → SELECT-only (C-2)

| | |
|---|---|
| **Objects modified** | DROP POLICY `tenant_isolation` ON `servants`; CREATE … FOR SELECT USING `(church_id = get_user_church_id())` |
| **Prerequisites** | 022 baseline |
| **Lock risk** | **Low** — AX on `servants` (small) |
| **Rollback impact** | Restore 022 FOR ALL definition |
| **Deployment risk** | **Med** — same-batch RPCs become the approval write path; own-row read preserved via `admin_read` (022, unchanged) |

### S6 — `notifications.tenant_isolation` → SELECT-only (C-3)

| | |
|---|---|
| **Objects modified** | DROP POLICY `tenant_isolation` ON `notifications`; CREATE … FOR SELECT USING `(church_id = get_user_church_id())` |
| **Prerequisites** | 022 baseline |
| **Lock risk** | **Low** — AX on `notifications` (small) |
| **Rollback impact** | Restore 022 FOR ALL definition |
| **Deployment risk** | **Low** — own-row access fully covered by `recipient_scope` (022, unchanged); writes funneled through `send_notification` |

### S7 — `profiles.own_profile_insert` hardening

| | |
|---|---|
| **Objects modified** | DROP POLICY `own_profile_insert` ON `profiles`; CREATE POLICY … FOR INSERT WITH CHECK `(id = auth.uid() AND EXISTS (SELECT 1 FROM churches c WHERE c.id = church_id AND c.is_active AND c.deleted_at IS NULL))` |
| **Prerequisites** | 022 baseline |
| **Lock risk** | **Low** — AX on `profiles` (small) |
| **Rollback impact** | Restore 022 `WITH CHECK (id = auth.uid())` |
| **Deployment risk** | **Low** — signup path is the service-role admin client; policy is **fail-closed** by design (D-5), verified by V5/R-16 |

### S8 — Temporal re-grant DDL (A3)

| | |
|---|---|
| **Objects modified** | `ALTER TABLE user_roles DROP CONSTRAINT user_roles_church_id_user_id_role_id_key` (auto-drops backing index); `CREATE UNIQUE INDEX uq_user_roles_active ON user_roles (church_id, user_id, role_id) WHERE end_date IS NULL` |
| **Prerequisites** | 001 (constraint), 020 (`end_date`), P0.4 (no duplicate active grants) |
| **Lock risk** | **Med** — **longest lock op in the batch**: full scan of `user_roles` under AX to build + validate the unique index. Table is small (role grants); expect sub-second. |
| **Rollback impact** | Drop `uq_user_roles_active`; re-add `ADD CONSTRAINT user_roles_church_id_user_id_role_id_key UNIQUE (church_id, user_id, role_id)` — **fails if archived rows collide with active rows** (archived + active same grant) which the RPCs never create (reactivation-first), but verify before rollback |
| **Deployment risk** | **Med** — the one statement that touches existing rows; uniqueness guarantee is a superset-proof (old constraint was stricter, so existing data always satisfies the partial index). P0.4 is the guard |

### S9 — `audit_trigger_fn` recreation (A4) + dead-trigger drop

| | |
|---|---|
| **Objects modified** | `CREATE OR REPLACE FUNCTION audit_trigger_fn()` — `actor_id` (not `user_id`), `action` **TEXT** (no `audit_action` enum), `entity_type := TG_TABLE_NAME`, `entity_id := COALESCE(NEW.id, OLD.id)` (satisfies `entity_id NOT NULL`), inserts `(church_id, actor_id, action, entity_type, entity_id, old_values, new_values)`, SECURITY DEFINER, `SET search_path`; `DROP TRIGGER IF EXISTS audit_attendance ON attendance_backup_20260730` |
| **Prerequisites** | `audit_logs` (001/019: actor_id, action text, entity_id NOT NULL), `attendance_backup_20260730` (015) |
| **Lock risk** | **Low** — function catalog op; trigger drop on the dead backup table (unused) |
| **Rollback impact** | Drop the function (or restore pre-019 absence) and re-drop/recreate per state; the backup-table trigger is already dead either way |
| **Deployment risk** | **Low** — recreate path is idempotent; no live trigger currently depends on `audit_trigger_fn` (all were CASCADE-dropped by 019) |

### S10 — Audit triggers (A4, M-2) — 6 recreations

| | |
|---|---|
| **Objects modified** | `AFTER INSERT OR UPDATE OR DELETE, FOR EACH ROW` triggers: `audit_profiles`→`profiles`, `audit_user_roles`→`user_roles`, `audit_followups`→`followups`, `audit_attendance_sessions`→`attendance_sessions`, `audit_attendance_records`→`attendance_records`, `audit_beneficiaries`→`beneficiaries`. **No `audit_children` trigger** (`children` was renamed → `beneficiaries`, 013). Use `DROP TRIGGER IF EXISTS` before each CREATE for idempotence |
| **Prerequisites** | S9; the six target tables (all have `church_id` and `id`) |
| **Lock risk** | **Low** — catalog ops; brief AX on each target (small tables) |
| **Rollback impact** | Drop the six triggers; drop the function (S9) — restoring the pre-batch (broken) state is the rollback baseline |
| **Deployment risk** | **Med** — this is the change that reopens the audit stream on those tables; verify immediately (V4) so no DML gap is mistaken for trigger failure. Triggers are SECURITY DEFINER (RLS-bypassed) and write audit rows for all DML incl. RPC-driven writes |

### S11 — RPC creation (dependency order)

| | |
|---|---|
| **Order** | 1. `send_notification` → 2. `list_churches_for_signup` → 3. `get_my_access_state` → 4. `submit_church_request` → 5. `approve_servant` → 6. `reject_servant` → 7. `approve_church_request` → 8. `reject_church_request` |
| **Dependency rationale** | Postgres resolves function bodies at execution, so creation order is for review clarity, not correctness — except the **execution-time** dependencies: approve/reject pair calls `send_notification` and `write_audit_log` (019); `approve_church_request` calls `send_notification` + `seed_church_roles` (021) + `user_is_platform_owner` (022). All must exist before the app calls them; being in one transaction, they all do |
| **Objects modified** | 8 new functions (signatures §1.2, guards per spec §4.4/§4.5 + D-4/D-8) |
| **Prerequisites** | S1–S8 (tables/policies/index/constraint), `user_is_platform_owner`/`user_is_super_admin`/`user_is_admin`/`get_user_church_id` (022), `seed_church_roles` (021), `write_audit_log` (019), `send_notification` (this batch, created first) |
| **Lock risk** | **Low** — catalog-only |
| **Rollback impact** | `DROP FUNCTION` × 8 |
| **Deployment risk** | **Low** — additive; each is collision-free (verified in `PHASE_3C_MIGRATION_COLLISION_REPORT.md` §1). `approve_church_request` guards on `p_auth_user_id` email-match (D-8) |

**RPC behavior notes for the SQL author (all from spec, consolidated):**
- `submit_church_request`: dedupe vs `profiles.email` (unique), pending `church_requests.email` (unique partial index), and existing `churches` names; insert; write audit (D-6); return request id.
- `approve_servant`: guards `user_is_super_admin(servant.church_id)`, `auth.uid() <> p_servant_id`, `status='pending'`; set approved; reactivation-first role grant (A3, §6.3); `send_notification`; audit. **No `ON CONFLICT DO NOTHING`.**
- `reject_servant`: same guards; set rejected; `send_notification` (reason); audit.
- `approve_church_request`: PO guard + `status='pending'`; dedupe normalized names; create church from request + `p_slug` (validate `~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'`, lowercased; `churches.slug` UNIQUE is the final guard); `seed_church_roles`; validate `p_auth_user_id` (D-8); create `profiles` + `servants`(approved) + `user_roles`(super_admin, assigned_by=actor, start_date=CURRENT_DATE); update request; `send_notification` to applicant; audit ×3 (church_request approve, church create, servant create). Single transaction.
- `reject_church_request`: PO guard + pending; set rejected + decision_notes=reason; audit.

### S12 — RPC privilege lockdown (D-2)

| | |
|---|---|
| **Objects modified** | `REVOKE ALL ON FUNCTION … FROM PUBLIC` on all 8; `GRANT EXECUTE` per §1.3 (`anon`/`authenticated` for list/submit; `authenticated` for get_my_access_state; `authenticated`+`service_role` for approve/reject; **no grant** for `send_notification`) |
| **Prerequisites** | S11 |
| **Lock risk** | **Low** |
| **Rollback impact** | Restore default grants (grant to `anon`, `authenticated`) or simply re-grant per original |
| **Deployment risk** | **Low** — required to keep `send_notification` private and to bound the client-facing surface |

---

## 4. Permissions seeding changes

**None.** The canonical catalog is exactly 52 codes (021) and the 3C flow needs no new permission codes. Justification:

- `servants.approve` (super_admin) — already seeded; used by the approval queue.
- `tenants.read` / `tenants.create` (platform_owner) — already seeded; used by the PO queue and provisioning RPC guard.
- `seed_church_roles` (021 version) is **unchanged** and is invoked at runtime by `approve_church_request`; its super_admin grant of all permissions automatically includes the codes above for provisioned churches.
- No `pending_user` role, no new permission module, no catalog DML in the batch.

---

## 5. Verification steps

### V0 — Pre-batch (P0.1–P0.7, §2)

### V1 — Post-apply schema (live)
Query `pg_tables`/`information_schema` for `church_requests` (12 columns, PK, CHECK, FK, trigger `trg_church_requests_updated_at`); `notifications.church_id` nullable; `uq_user_roles_active` present; `user_roles_church_id_user_id_role_id_key` absent.

### V2 — Post-apply policies
`pg_policies` assertions:
- `church_requests`: 5 policies (platform_owner_all ALL, applicant_read SELECT, public_insert INSERT, immutable_review UPDATE permissive-false, immutable_delete DELETE permissive-false).
- `user_roles.tenant_isolation` = FOR SELECT only; same for `servants` and `notifications`.
- `profiles.own_profile_insert` = INSERT WITH CHECK containing the `churches` EXISTS.

### V3 — Post-apply functions & privileges
- All 8 RPCs + `audit_trigger_fn` exist (`pg_proc`).
- `send_notification` has **no** EXECUTE for `PUBLIC`/`anon`/`authenticated` (`information_schema.routine_privileges` or `has_function_privilege`).
- `list_churches_for_signup` / `submit_church_request` executable by `anon`; `get_my_access_state` by `authenticated`.

### V4 — Audit continuity (A4 SQL from §8.1)
- `pg_get_functiondef('audit_trigger_fn()'::regprocedure) LIKE '%actor_id%'`.
- Six `audit_*` triggers present; `audit_attendance` absent from `attendance_backup_20260730`.
- Smoke: DML on `beneficiaries`/`profiles`/`user_roles`/`followups`/`attendance_sessions`/`attendance_records` → `audit_logs` rows with `entity_type='beneficiaries'` etc., `action IN ('create','update','delete')`, `entity_id` NOT NULL.

### V5 — RLS regression (scratch, real sessions, no service role)
Matrix R-1…R-15 of `PHASE_3C_SECURITY_REMEDIATION.md` §5 (R-8 role-gated = 0 rows; R-8A closed write surfaces denied), plus **R-16**: authenticated self-insert of `profiles` with a valid church → **DENIED** (fail-closed, D-5); service-role insert → succeeds.

### V6 — Flow smoke (scratch)
- Existing church: signup (service-role) → pending → `get_my_access_state` → super_admin `approve_servant` → role granted + audit + notification → login.
- New church: anon `submit_church_request` → PO `approve_church_request(request, auth_user_id, slug)` → church/roles/profile/servant/super_admin created atomically; `reject_church_request` path.

---

## 6. Rollback strategy

**Primary:** restore the P0.6 backup snapshot (the batch is non-destructive; rollback to snapshot is lossless for pre-batch state).

**Reverse DDL (if in-place rollback is preferred):**

| Step | Reverse |
|---|---|
| R1 | `DROP TABLE church_requests;` (removes S1+S2) |
| R2 | `ALTER TABLE notifications ALTER COLUMN church_id SET NOT NULL;` — **only after** resolving any NULL-church rows written by PO alerts (delete those rows or set a church_id; document in the change). This is the batch's rollback-critical column |
| R3 | Restore 022 policies: `DROP POLICY tenant_isolation` on `user_roles`/`servants`/`notifications`, recreate `FOR ALL USING (church_id = get_user_church_id())`; restore `own_profile_insert WITH CHECK (id = auth.uid())` |
| R4 | `DROP INDEX uq_user_roles_active; ALTER TABLE user_roles ADD CONSTRAINT user_roles_church_id_user_id_role_id_key UNIQUE (church_id, user_id, role_id);` — **fails** if archived+active duplicates exist (reactivation-first RPCs prevent this; verify count before rollback) |
| R5 | Drop 8 RPCs; drop 6 audit triggers; `DROP FUNCTION audit_trigger_fn()` (restores the pre-batch broken-audit state — the pre-batch state is itself the silent gap, so this only matters for exact-state fidelity) |

**Rollback-critical objects** (highest attention): `uq_user_roles_active` (must re-add the UNIQUE constraint), `notifications.church_id` NULL (must clear NULL rows first), the four policy definitions (must restore 022 SQL exactly).

---

## 7. Open items

None blocking. All previously-open items were locked as D-1…D-8. Residual behavioral notes carried as non-blocking documentation: N-1 (`old_metadata`), N-10 (`church_requests` review-column spoof at submit — overwritten by review RPCs), D-5 (own_profile_insert fail-closed).
