# Phase 3C.2 — Pre-Implementation Database Audit Report

**Phase:** 3C — Registration & Church Provisioning
**Date:** 2026-07-31
**Scope:** Audit of the current live schema as represented by migrations `001`–`022` only.
**Method:** Deterministic migration-file analysis (no live DB connection available in this environment). Every claim cites the migration where it originates. Generated types (`src/types/database.types.ts`) are treated as **non-authoritative** — they are demonstrably stale (see N-2).
**Verdict:** `REQUIRES_SPEC_UPDATE` — see `PHASE_3C_DATABASE_IMPLEMENTATION_GATE.md`.

---

## 1. Registration Impact Audit

For each of the eight affected objects: columns, constraints, indexes, foreign keys, triggers, RLS policies, and the helper functions they call.

### 1.1 `profiles` (migrations 001, 010)

| Aspect | Definition | Origin |
|---|---|---|
| Columns | `id uuid PK REFERENCES auth.users(id) ON DELETE CASCADE`; `church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE`; `email text NOT NULL`; `phone text`; `full_name_ar text NOT NULL`; `full_name_en text`; `avatar_url text`; `preferred_locale text NOT NULL DEFAULT 'ar'`; `is_active boolean NOT NULL DEFAULT true`; `last_login_at timestamptz`; `date_of_birth date`; `gender gender_type`; `spiritual_title text`; `service_started_at date`; `created_at/updated_at timestamptz NOT NULL DEFAULT now()`; `deleted_at timestamptz` | 001, 010 |
| Indexes | `idx_profiles_email` **UNIQUE** on `(email)`; `idx_profiles_church_active` on `(church_id) WHERE deleted_at IS NULL`; `idx_profiles_spiritual_title` on `(church_id, spiritual_title) WHERE deleted_at IS NULL AND spiritual_title IS NOT NULL` | 010 (drops the 001 non-unique variants first) |
| FKs | `id → auth.users ON DELETE CASCADE`; `church_id → churches ON DELETE CASCADE` | 001 |
| Triggers | `trg_profiles_updated_at` (BEFORE UPDATE → `handle_updated_at()`). `audit_profiles` was created in 001 and **dropped by 019 CASCADE** (see §3). | 001, 019 |
| RLS policies | `tenant_isolation` FOR SELECT `(church_id = get_user_church_id())`; `own_profile_insert` FOR INSERT `WITH CHECK (id = auth.uid())`; `own_profile_update` FOR UPDATE `USING (id = auth.uid())`; `super_admin_all` FOR ALL `(user_is_super_admin(church_id))`; `admin_scoped` FOR SELECT `(user_is_admin(church_id) AND church_id = get_user_church_id())` | 022 |
| Helpers called | `get_user_church_id`, `user_is_super_admin`, `user_is_admin` | 022 |

**3C relevance:** pending profile is created at signup (service-role admin client per `REGISTRATION_WORKFLOW_SPEC.md` §3.2, or `own_profile_insert` for self-session inserts). `get_my_access_state()` reads it. `profiles.own_profile_insert` hardening is planned (task 1.10). **Read posture:** `tenant_isolation` SELECT grants any same-church authenticated user — including a role-less pending user — read access to **every** profile in the church (see M-1).

### 1.2 `servants` (migration 011)

| Aspect | Definition | Origin |
|---|---|---|
| Columns | `id uuid PK REFERENCES profiles(id) ON DELETE CASCADE`; `church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE`; `confession_father_name text`; `join_date date`; `service_history jsonb NOT NULL DEFAULT '[]'`; `notes text`; `approval_status text NOT NULL DEFAULT 'pending'`; `approved_by uuid REFERENCES profiles(id)`; `approved_at timestamptz`; `deleted_at timestamptz`; `created_at/updated_at timestamptz NOT NULL DEFAULT now()` | 011 |
| Indexes | `idx_servants_church_approval` on `(church_id, approval_status) WHERE deleted_at IS NULL` | 011 |
| FKs | `id → profiles CASCADE`; `church_id → churches CASCADE` | 011 |
| Triggers | `trg_servants_updated_at` (BEFORE UPDATE → `handle_updated_at()`). **No audit trigger was ever defined for `servants`.** | 011 |
| RLS policies | `tenant_isolation` FOR ALL `(church_id = get_user_church_id())` (**→ SELECT-only in 3C, C-2**); `super_admin_all` FOR ALL `(user_is_super_admin(church_id))`; `admin_read` FOR SELECT `(church match AND (id = auth.uid() OR ssa service-scope EXISTS))` | 022 |
| Helpers called | `get_user_church_id`, `user_is_super_admin`, `get_user_service_ids` | 022 |

**3C relevance:** `approval_status` is the pending representation; `approve_servant`/`reject_servant` flip it. 011 pre-seeded every existing profile as `approved`; 3C introduces the `pending` path. **Write posture (post-C-2):** writes only via `super_admin_all`, the SECURITY DEFINER RPCs, or the service-role admin client — the signup-time `servants` row creation in `REGISTRATION_WORKFLOW_SPEC.md` §3.2 uses the admin client, which is consistent with §3.1 of the remediation doc but contradicts the §3.2 invariant wording (M-3).

### 1.3 `churches` (migrations 001, 009)

| Aspect | Definition | Origin |
|---|---|---|
| Columns | `id uuid PK`; `name_ar text NOT NULL`; `name_en text`; `slug text NOT NULL UNIQUE`; `logo_url text`; `settings jsonb NOT NULL DEFAULT '{}'`; `is_active boolean NOT NULL DEFAULT true`; `contact_email/contact_phone/address_ar/address_en text`; `subscription_tier text NOT NULL DEFAULT 'trial'`; `subscription_status text NOT NULL DEFAULT 'active'`; `trial_ends_at timestamptz`; `feature_flags jsonb NOT NULL DEFAULT '{}'`; `locale text NOT NULL DEFAULT 'ar'`; `created_at/updated_at`; `deleted_at` | 001, 009 |
| Indexes | `idx_churches_slug` on `(slug) WHERE deleted_at IS NULL`; `idx_churches_subscription_status` on `(subscription_status) WHERE deleted_at IS NULL` (`idx_churches_active` dropped) | 001, 009 |
| FKs | `slug` UNIQUE (not FK) | 001 |
| Triggers | `trg_churches_updated_at` (BEFORE UPDATE → `handle_updated_at()`) | 001 |
| RLS policies | `tenant_read` FOR SELECT `(id = get_user_church_id())`; `platform_owner_all` FOR ALL `(user_is_platform_owner())`; `super_admin_update` FOR UPDATE `(id = get_user_church_id() AND user_is_super_admin(id))` | 022 |
| Helpers called | `get_user_church_id`, `user_is_platform_owner`, `user_is_super_admin` | 022 |

**3C relevance:** **no new `churches` policy is planned** — `list_churches_for_signup()` (SECURITY DEFINER) is the sole public read surface. `approve_church_request` creates the church (slug + collision suffix, `trial` tier, `trial_ends_at = now()+30d`). `slug UNIQUE` is reused unchanged. Note: `churches` currently has **no `church_requests`-style immutable-guard**; only `super_admin_update` + `platform_owner_all` may write it, and `platform_owner_all` (ALL) lets the PO mutate any row directly — accepted PO trust model.

### 1.4 `user_roles` (migrations 001, 020)

| Aspect | Definition | Origin |
|---|---|---|
| Columns | `id uuid PK`; `church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE`; `user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`; `role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE`; `assigned_by uuid NOT NULL REFERENCES profiles(id)`; `start_date date NOT NULL`; `end_date date` (nullable); `created_at timestamptz NOT NULL DEFAULT now()` | 001, 020 |
| Constraints | `UNIQUE (church_id, user_id, role_id)` — non-partial; backing index auto-named `user_roles_church_id_user_id_role_id_key` (**3C: replaced by partial unique index `uq_user_roles_active` WHERE `end_date IS NULL`, A3**) | 001 |
| Indexes | `idx_user_roles_user_active` on `(user_id, role_id) WHERE end_date IS NULL` (non-unique; redundant with `uq_user_roles_active` post-3C — may be dropped or retained) | 020 |
| FKs | `church_id → churches CASCADE`; `user_id → profiles CASCADE`; `role_id → roles CASCADE`; `assigned_by → profiles` | 001 |
| Triggers | **None.** `audit_user_roles` created in 001, **dropped by 019 CASCADE** (see §3) | 001, 019 |
| RLS policies | `tenant_isolation` FOR ALL `(church_id = get_user_church_id())` (**→ SELECT-only in 3C, C-1**); `super_admin_all` FOR ALL `(user_is_super_admin(church_id))`; `own_read` FOR SELECT `(user_id = auth.uid())`; `admin_read` FOR SELECT `(user_is_admin(church_id))` | 022 |
| Helpers called | `get_user_church_id`, `user_is_super_admin`, `user_is_admin` | 022 |

**3C relevance:** role grant on approval / provisioning. `assigned_by NOT NULL` (020) means `approve_servant` and `approve_church_request` must supply the actor id — the spec does (auth.uid()). The reactivation-first re-approval (A3) `UPDATE … SET end_date = NULL` is the **only** strategy legal under the non-partial UNIQUE while an archived row exists; validated against the schema (§5 of this report).

### 1.5 `roles` (migrations 001, 021)

| Aspect | Definition | Origin |
|---|---|---|
| Columns | `id uuid PK`; `church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE`; `role_type user_role_type NOT NULL`; `name_ar text NOT NULL`; `name_en text`; `description_ar text`; `is_system boolean NOT NULL DEFAULT false`; `created_at/updated_at timestamptz NOT NULL DEFAULT now()`. **No `deleted_at` column exists** — A1 confirmed correct | 001, 021 |
| Constraints | `UNIQUE (church_id, role_type)` | 001 |
| Indexes | `idx_roles_church` on `(church_id)` | 001 |
| FKs | `church_id → churches CASCADE` | 001 |
| Triggers | `trg_roles_updated_at` (BEFORE UPDATE → `handle_updated_at()`) | 001 |
| RLS policies | `tenant_isolation` FOR ALL `(church_id = get_user_church_id())`; `super_admin_all` FOR ALL `(user_is_super_admin(church_id))`; `read_all` FOR SELECT `(church_id = get_user_church_id())` | 022 |
| Helpers called | `get_user_church_id`, `user_is_super_admin` | 022 |
| Enum | `user_role_type = ('platform_owner','super_admin','admin','servant')` (migrated from the old 5-value enum) | 021 |

**3C relevance:** `approve_servant` role lookup `WHERE role_type = 'servant' AND church_id = …` is unambiguous thanks to `UNIQUE(church_id, role_type)` — the A1 fix. **Write posture:** `roles.tenant_isolation` FOR ALL lets any same-church authenticated user (incl. pending) INSERT/UPDATE/DELETE role definitions — e.g., DELETE the `super_admin` role row (CASCADE-revokes every grant) or rename roles. This is part of the systemic M-1 finding; **not** remediated by C-1/C-2/C-3.

### 1.6 `permissions` (migrations 001, 003, 021)

| Aspect | Definition | Origin |
|---|---|---|
| Columns | `id uuid PK`; `code text NOT NULL UNIQUE`; `name_ar text NOT NULL`; `name_en text`; `module text NOT NULL`; `description_ar text`; `created_at` | 001 |
| Indexes | `permissions_code_key` (UNIQUE, auto) | 001 |
| FKs | none | — |
| Triggers | none | — |
| RLS policies | `read_all` FOR SELECT `(true)`; `platform_owner_write` FOR ALL `(user_is_platform_owner())` | 022 |
| Helpers called | `user_is_platform_owner` | 022 |
| Catalog | 52 codes post-021 (7 removed: `users.create/delete/manage`, `attendance.update/delete`, `notifications.create`, `churches.manage`; 10 PO/service codes added; `children.*` → `beneficiaries.*`; deprecated codes removed) | 003, 021 |

**3C relevance:** `servants.approve` and `tenants.*` exist. **Mismatch (non-blocking):** `notifications.create` was removed from the DB catalog by 021 but is still referenced by `src/features/rbac/constants/permissions.ts:35` and the stale types `Functions` list — this is P0.1 work, not a schema change.

### 1.7 `notifications` (migrations 001, 018)

| Aspect | Definition | Origin |
|---|---|---|
| Columns | `id uuid PK`; `church_id uuid NOT NULL REFERENCES churches(id) ON DELETE CASCADE` (**3C: `DROP NOT NULL`**); `recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE` (renamed from `user_id`); `channel text NOT NULL` (holds the legacy `notification_type` enum values `in_app`/`email` as text); `notification_type text NOT NULL DEFAULT 'system'`; `is_read boolean NOT NULL DEFAULT false`; `data jsonb`; `old_metadata jsonb` (**leftover — renamed from `metadata` and never dropped**); `read_at timestamptz`; `sent_at timestamptz NOT NULL DEFAULT now()`; `created_at` | 001, 018 |
| Indexes | `idx_notifications_recipient_read` on `(recipient_id, is_read, sent_at DESC)` (old two indexes dropped) | 018 |
| FKs | `church_id → churches ON DELETE CASCADE`; `recipient_id → profiles ON DELETE CASCADE` | 001, 018 |
| Triggers | **None** (no `updated_at` trigger, no audit trigger ever created) | — |
| RLS policies | `tenant_isolation` FOR ALL `(church_id = get_user_church_id())` (**→ SELECT-only in 3C, C-3**); `recipient_scope` FOR ALL `(recipient_id = auth.uid())`; `super_admin_read` FOR SELECT `(user_is_super_admin(church_id))` | 022 |
| Helpers called | `get_user_church_id`, `user_is_super_admin` | 022 |

**3C relevance:** see §4 (Notification Architecture Audit). Canonical spec (`CANONICAL_DATABASE_SPEC.md` §notifications) matches 018 **except** it omits `old_metadata` — i.e., `old_metadata` is an undocumented artifact of the migration text.

### 1.8 `audit_logs` (migrations 001, 019)

| Aspect | Definition | Origin |
|---|---|---|
| Columns | `id uuid PK`; `church_id uuid REFERENCES churches(id) ON DELETE SET NULL` (nullable); `actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL` (renamed from `user_id`); `action text NOT NULL` (converted from enum); `entity_type text NOT NULL`; `entity_id uuid NOT NULL`; `old_values jsonb`; `new_values jsonb`; `metadata jsonb`; `created_at` (no `ip_address`/`user_agent` — dropped) | 001, 019 |
| Indexes | `idx_audit_logs_church_time` on `(church_id, created_at DESC)`; `idx_audit_logs_entity` on `(entity_type, entity_id)` | 019 |
| FKs | `church_id → churches ON DELETE SET NULL`; `actor_id → profiles ON DELETE SET NULL` | 001, 019 |
| Triggers | none (audit writing is via `write_audit_log()` / the audit trigger function — see §3) | — |
| RLS policies | `tenant_isolation` FOR SELECT `(church_id = get_user_church_id())`; `super_admin_read` FOR SELECT `(user_is_super_admin(church_id))`; `platform_owner_read` FOR SELECT `(user_is_platform_owner())`; `append_only` FOR INSERT `WITH CHECK (true)` (any authenticated user may append); `immutable_update` FOR UPDATE `USING (false)`; `immutable_delete` FOR DELETE `USING (false)` | 022 |
| Helpers called | `get_user_church_id`, `user_is_super_admin`, `user_is_platform_owner` | 022 |

**3C relevance:** approval trail (R-15 immutability). `append_only` is canonical. **Read posture:** `tenant_isolation` SELECT gives a pending user the church's **entire** audit trail — part of M-1.

---

## 2. RLS Dependency Audit

See `PHASE_3C_DEPENDENCY_GRAPH.md` for the full graph. Headline results:

- `get_user_role()` **does not exist** in any migration — the task-list name maps to nothing. Role checks are the three 022 helpers (`user_is_super_admin`, `user_is_admin`, `user_is_platform_owner`).
- `user_has_permission(text)` **still exists** (created 001, never dropped) but is **orphaned** — zero policies reference it after 022 (the 002/005 policies were dropped). It is not church-scoped, not `end_date`-aware, and unaware of the 021 catalog changes. The new 3C RPCs must **not** use it.
- `get_user_servant_id()` and `get_user_assigned_beneficiary_ids()` (022) are defined but referenced by **no policy**.

---

## 3. Audit System Verification

**State: PARTIALLY BROKEN — the automatic capture layer is silently absent.** Evidence:

| Component | State | Evidence |
|---|---|---|
| `audit_action` enum | **DROPPED** | 019:54 `DROP TYPE IF EXISTS audit_action CASCADE` (enum created 001:81) |
| `audit_trigger_fn()` | **DROPPED** | Declares `v_action audit_action` (001:786) → CASCADE from the type drop removes it. 019 never recreates it (only `write_audit_log`). |
| `audit_children` (→ children) | **DROPPED** | CASCADE from `audit_trigger_fn`; trigger created 001:820 |
| `audit_attendance` (→ attendance) | **DROPPED** | 001:824; note 015:82 renamed `attendance` → `attendance_backup_20260730`, so pre-019 this trigger sat on the dead backup table |
| `audit_profiles` (→ profiles) | **DROPPED** | 001:828 |
| `audit_user_roles` (→ user_roles) | **DROPPED** | 001:832 |
| `audit_followups` (→ followups) | **DROPPED** | 004:6 |
| `write_audit_log()` | **EXISTS, OPERATIONAL** | 019:57–74 recreates with `(p_church_id uuid, p_action text, p_entity_type text, p_entity_id uuid DEFAULT NULL, p_old_values jsonb, p_new_values jsonb)`. **But nothing calls it**: the app writes audit rows via direct `supabase.from("audit_logs").insert(...)` in `auth.service.ts:83,246`, `user.actions.ts:54`, `stage.actions.ts:58`, `child.actions.ts:65` (all pass `append_only`). |
| Net effect | **Silent audit gap** | DML on profiles/user_roles/children(now beneficiaries)/followups/attendance(now attendance_sessions/records) produces **no audit rows** and **no errors**. Matches the A4 root-cause analysis. |

**Important:** A4's restoration trigger list in the approved spec contains an **invalid schema reference** — `audit_children → children`. Migration 013:12 renamed `children` → `beneficiaries` and the table is never recreated. `CREATE TRIGGER audit_children ON children` will **fail with "relation children does not exist"**. The same error affects the §8.1 smoke test (`entity_type = 'children'`). Correct target is `beneficiaries` / `entity_type = 'beneficiaries'` (M-2). All other A4 targets (`profiles`, `user_roles`, `followups`, `attendance_sessions`, `attendance_records`, `beneficiaries`) exist and are valid.

---

## 4. Notification Architecture Audit

| Question | Answer | Evidence |
|---|---|---|
| Table structure | 018-canonical: `church_id NOT NULL`, `recipient_id NOT NULL`, `channel text` (holds `in_app`/`email`), `notification_type text DEFAULT 'system'`, `is_read`, `data`, `read_at`, `sent_at NOT NULL DEFAULT now()`, `created_at` — **plus undocumented `old_metadata jsonb` leftover** | 001, 018 |
| Current creation path | **None.** No app code inserts into `notifications`; no RPC exists; no trigger writes them. The only DB-legal writes today are self-notification via `recipient_scope` or same-church cross-recipient inserts via `tenant_isolation` FOR ALL (the C-3 hole) | grep `src` = 0 inserts; 022 |
| Existing RPCs/functions | None (no `send_notification`, no notification functions anywhere) | grep over migrations + `database.types.ts` |
| `church_id` nullable safe? | **Yes.** FK is kept (ON DELETE CASCADE). `recipient_scope` is role-independent and grants PO own-row reads regardless of `church_id`. `super_admin_read` uses `user_is_super_admin(church_id)` (NULL → false → PO falls through to `recipient_scope`). `tenant_isolation` contributes NULL (falsy) for PO rows. `idx_notifications_recipient_read` is `church_id`-independent. Precedent: `audit_logs.church_id` already nullable (001) | 022, 001 |
| Affected policies | `tenant_isolation` (→ SELECT-only, C-3), `recipient_scope` (unchanged), `super_admin_read` (unchanged) | 022 |
| Payload mapping | `channel='in_app'`, `notification_type='approval_required'`/`'approval_result'` per workflow spec §6 — both columns exist and are free-text | 018, `REGISTRATION_WORKFLOW_SPEC.md` §6 |

**Caveat (N-1):** migration 018 renames `metadata` → `old_metadata` and never drops it, but the generated types omit `old_metadata` (line ~949). The types file is stale (N-2: its `Functions` list contains `user_has_role`/`user_has_stage_access`/`user_is_church_admin_or_above`, all dropped in 021), so it cannot settle whether the live DB retained `old_metadata`. **Action:** add a pre-migration verification query (`SELECT column_name FROM information_schema.columns WHERE table_name='notifications'`) and ensure no `send_notification` INSERT references it. Not a blocker for 3C DDL.

---

## 5. Role Assignment Audit

| Aspect | State | Evidence | Validates A3? |
|---|---|---|---|
| `roles` uniqueness | `UNIQUE (church_id, role_type)`; **no `deleted_at`** | 001:252, 021 | ✅ A1 confirmed — the `role_type='servant'` lookup is unambiguous |
| `user_roles` uniqueness | `UNIQUE (church_id, user_id, role_id)` — **non-partial** | 001:278 | ✅ A3's reactivation-first `UPDATE end_date=NULL` is the only legal re-grant while an archived row exists; a fresh INSERT would violate the constraint |
| `end_date` behavior | Nullable; **no trigger zeroes it**; archival model = set `end_date`, never delete | 020:26 | ✅ |
| Temporal history | `start_date NOT NULL`, `assigned_by NOT NULL` (020) → every grant carries actor + start; `idx_user_roles_user_active` non-unique partial | 020 | ✅ |
| Re-grant strategy | reactivation-first: `UPDATE … SET end_date = NULL WHERE … AND end_date IS NOT NULL`; INSERT only if none reactivated; **no `ON CONFLICT DO NOTHING`** (silent no-op would strand an approved servant) | `REGISTRATION_DATABASE_CHANGES.md` §6.3 | ✅ Consistent — and the planned partial unique index `uq_user_roles_active WHERE end_date IS NULL` is required **before** any archive-and-insert variant is allowed |
| Re-approval idempotency | `approve_servant` guards `status='pending'`; R-13 covers approve→archive→re-approve | spec §4.4 | ✅ |

**Edge validated:** with the non-partial UNIQUE in place until the 3C batch runs, reactivation must run before any INSERT — the spec's ordering is correct. The constraint's backing index is `user_roles_church_id_user_id_role_id_key` (auto name) — the migration must `DROP CONSTRAINT … ` on that exact name.

---

## 6. Findings Summary

### Blocking spec-vs-schema mismatches

| ID | Severity | Finding | Origin vs Claim |
|---|---|---|---|
| **M-1** | **HIGH** | **Pending-user "zero access" is false.** 022's `tenant_isolation` on services/stages/classes/beneficiaries/beneficiary_assignments/servant_stage_assignments/attendance_sessions/attendance_records/followups/spiritual_journal_entries/events/event_registrations/documents/ai_conversations/ai_messages/document_embeddings/roles/role_permissions is **FOR ALL** and church-scoped only. Any authenticated user with a `profiles.church_id` — including a role-less pending user — passes it for SELECT **and** INSERT/UPDATE/DELETE. Concretely: a pending user can read every beneficiary (PII), read the whole church `audit_logs`, read every profile, read/write `spiritual_journal_entries`, and **write** beneficiaries/attendance/followups/events/documents/ssa/ba/roles/role_permissions (e.g., DELETE the church's `super_admin` role row → CASCADE-revokes all grants). `roles.read_all` (022) also exposes role ids, making C-1's discovery step trivial even after the `user_roles` fix. | 022 vs `REGISTRATION_WORKFLOW_SPEC.md` §3.2/§3.3 ("zero effective access", "RLS prevents any operational read/write"), `REGISTRATION_RBAC_IMPACT.md` §5 ("Denies all operational data to pending users"), `PHASE_3C_SECURITY_REMEDIATION.md` R-8 ("0 rows") |
| **M-2** | **HIGH** | **A4 restoration references a non-existent table.** `audit_children → children` and the smoke test `entity_type='children'` will fail: 013:12 renamed `children` → `beneficiaries` (never recreated). Correct target: `beneficiaries`. This is an invalid schema reference — the class A1 was meant to eliminate — so the readiness criterion "no invalid schema references remain" does **not** currently hold. | 013:12 vs `REGISTRATION_DATABASE_CHANGES.md` §8.1, `PHASE_3C_SECURITY_REMEDIATION.md` §4, R-14 |
| **M-3** | **MEDIUM** | **Servants write-path documentation contradiction.** `REGISTRATION_WORKFLOW_SPEC.md` §3.2 creates the pending profile+servant via the service-role admin client (works — service role bypasses RLS), but `PHASE_3C_SECURITY_REMEDIATION.md` §3.2 asserts "every write in the 3C flow passes through a SECURITY DEFINER RPC". §3.1 of the same doc does list "service-role admin client" as a writer — the invariant sentence must be reconciled. No schema impact; spec wording only. | workflow §3.2 vs remediation §3.2 |

### Non-blocking findings

| ID | Finding |
|---|---|
| N-1 | `notifications.old_metadata jsonb` is left over from 018 and undocumented in `CANONICAL_DATABASE_SPEC.md`. Verify live at migration time (types are stale). |
| N-2 | `src/types/database.types.ts` is stale: `Functions` lists `user_has_role`/`user_has_stage_access`/`user_is_church_admin_or_above`/`user_has_permission` (the first three dropped by 021) and omits the 022 helpers (`user_is_super_admin`, `user_is_admin`, `user_is_platform_owner`, scope helpers). Regeneration (task 1.14) is mandatory and will also surface `old_metadata` if present. |
| N-3 | Orphaned SECURITY DEFINER functions: `user_has_permission(text)` (001), `get_user_servant_id()` (022), `get_user_assigned_beneficiary_ids()` (022) — referenced by no policy. **Do not adopt `user_has_permission` in 3C RPCs** (not church-scoped, ignores `end_date` and the 021 catalog). |
| N-4 | "7 RPCs" (plan §1/§3) vs 8 functions (plan 1.4–1.9, `REGISTRATION_DATABASE_CHANGES.md` §4/§10): `send_notification` is the 8th (helper). Cosmetic counting — normalize wording. |
| N-5 | `church_requests.applicant_read` (SELECT by `auth.jwt()->>'email'`) is unusable for new-church applicants pre-approval — they have no account until provisioning. UI does not depend on it (queue-based); note only. |
| N-6 | Post-C-3, `notifications.tenant_isolation` SELECT still lets any same-church user **read** all church notifications (cross-recipient read). INSERT spoofing is closed; read exposure is consistent with M-1's systemic posture. |
| N-7 | `audit_logs.append_only` (INSERT `WITH CHECK (true)`) lets any authenticated user, incl. pending, forge audit rows (INSERT only). Canonical design; unchanged by 3C. |
| N-8 | `churches.platform_owner_all` is FOR ALL — PO may UPDATE/DELETE churches directly; `church_requests.platform_owner_all` repeats this pattern (accepted PO trust model, remediation §6). |
| N-9 | `spiritual_journal_entries.deny_admin_spiritual` is the **only** restrictive policy in the schema (022:335) — a useful precedent for any future pending-user read gate. |

---

## 7. Summary of Assumptions Confirmed

- ✅ Audit subsystem **known** — silent gap confirmed, root cause correct (A4), **except** the `children` table error (M-2).
- ✅ Notification assumptions **verified** — nullable `church_id` safe; no existing write path; `send_notification` chokepoint valid (N-1 caveat).
- ✅ Temporal role model **verified** — A3 reactivation-first is the only legal re-grant under the non-partial UNIQUE.
- ✅ `get_user_role()` does not exist; role checks use the 022 helpers.
- ✅ No migration 023+ exists; the 3C batch will be the first post-022 migration.
- ❌ **No schema/spec mismatches remain** — NOT satisfied (M-1, M-2).
