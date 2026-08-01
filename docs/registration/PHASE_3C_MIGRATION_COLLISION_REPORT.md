# Phase 3C.2 — Migration Collision Report

**Phase:** 3C — Registration & Church Provisioning
**Date:** 2026-07-31
**Basis:** migrations `001`–`022` only. Checks every object the 3C plan creates/modifies against existing objects.

**Result: NO unresolved hard collisions.** One object in the approved plan references a table that does not exist (`audit_children` → `children`, dropped by rename in 013) — this is an **invalid reference**, not a name collision, and is tracked as M-2 in the audit report. Policy/index/trigger replacements require strict in-batch ordering (DROP before CREATE) — these are intentional replacements, not collisions.

---

## 1. New objects (additive) — collision check

| Planned object | Type | Exists in 001–022? | Collision |
|---|---|---|---|
| `church_requests` | TABLE | No | ✅ none |
| `idx_church_requests_status` | INDEX | No | ✅ none |
| `idx_church_requests_email_pending` | UNIQUE INDEX | No | ✅ none |
| `idx_church_requests_email` | INDEX | No | ✅ none |
| `list_churches_for_signup()` | FUNCTION | No (not in migrations or `database.types.ts`) | ✅ none |
| `get_my_access_state()` | FUNCTION | No | ✅ none |
| `submit_church_request(...)` | FUNCTION | No | ✅ none |
| `approve_servant(uuid)` | FUNCTION | No | ✅ none |
| `reject_servant(uuid, text DEFAULT NULL)` | FUNCTION | No | ✅ none |
| `approve_church_request(uuid)` | FUNCTION | No | ✅ none |
| `reject_church_request(uuid, text DEFAULT NULL)` | FUNCTION | No | ✅ none |
| `send_notification(...)` | FUNCTION | No | ✅ none |
| `church_requests.platform_owner_all` | POLICY | Name exists on `churches` (022) — **policy names are per-table namespaces**, so no conflict | ✅ none |
| `church_requests.applicant_read` | POLICY | No | ✅ none |
| `church_requests.public_insert` | POLICY | No | ✅ none |
| `church_requests.immutable_review` | POLICY | Name exists on `beneficiary_assignments` (022) — per-table namespace | ✅ none |
| `church_requests.immutable_delete` | POLICY | Name exists on `audit_logs` (022) — per-table namespace | ✅ none |
| `audit_trigger_fn()` | FUNCTION | **Does not exist** (dropped by 019 CASCADE) → `CREATE OR REPLACE` safe | ✅ none |
| `audit_profiles` | TRIGGER | **Does not exist** (dropped by 019) | ✅ none |
| `audit_user_roles` | TRIGGER | **Does not exist** (dropped by 019) | ✅ none |
| `audit_children` | TRIGGER | Does not exist — **but its target table `children` does not exist either (013 rename → `beneficiaries`)** | ❌ **M-2 invalid reference — fix to `beneficiaries`** |
| `audit_followups` | TRIGGER | **Does not exist** (dropped by 019; 004's `DROP TRIGGER IF EXISTS` guards re-runs) | ✅ none |
| `audit_attendance_sessions` | TRIGGER | Never existed | ✅ none |
| `audit_attendance_records` | TRIGGER | Never existed | ✅ none |
| `audit_beneficiaries` | TRIGGER | Never existed | ✅ none |
| `uq_user_roles_active` | UNIQUE INDEX | No (`idx_user_roles_user_active` is a different name) | ✅ none |

**Conclusion:** every additive object is collision-free. No existing migration 001–022 defines any of the new tables, functions, indexes, policies, or triggers.

---

## 2. Replacements — require strict DROP-before-CREATE (not collisions)

| Object | Existing (to be replaced) | Origin | Requirement |
|---|---|---|---|
| `user_roles.tenant_isolation` | FOR ALL `(church_id = get_user_church_id())` | 022:370 | `DROP POLICY tenant_isolation ON user_roles;` then `CREATE … FOR SELECT …` (C-1) — same batch |
| `servants.tenant_isolation` | FOR ALL `(church_id = get_user_church_id())` | 022:224 | DROP then CREATE … FOR SELECT (C-2) |
| `notifications.tenant_isolation` | FOR ALL `(church_id = get_user_church_id())` | 022:339 | DROP then CREATE … FOR SELECT (C-3) |
| `profiles.own_profile_insert` | FOR INSERT `WITH CHECK (id = auth.uid())` | 022:218 | DROP then CREATE with added active-church `EXISTS` check (task 1.10) |

> `CREATE OR REPLACE POLICY` (PG 15+) would also work but DROP + CREATE is the safe, version-agnostic pattern. Policy name reuse across tables is fine (per-table namespace), but **the three `tenant_isolation` replacements and `own_profile_insert` must land in the same migration batch as the RPCs** — the RPCs are the new write path for those tables.

---

## 3. Constraint / index replacement (A3)

| Object | Existing | Origin | Action |
|---|---|---|---|
| `user_roles` UNIQUE constraint | `UNIQUE (church_id, user_id, role_id)`; backing index auto-named **`user_roles_church_id_user_id_role_id_key`** | 001:278 (inline UNIQUE) | `ALTER TABLE user_roles DROP CONSTRAINT user_roles_church_id_user_id_role_id_key;` then `CREATE UNIQUE INDEX uq_user_roles_active ON user_roles (church_id, user_id, role_id) WHERE end_date IS NULL;` |
| `idx_user_roles_user_active` | non-unique partial `(user_id, role_id) WHERE end_date IS NULL` | 020:35 | Redundant with `uq_user_roles_active` — may be retained (keeps the user→role join index) or dropped. Spec permits either (must state the choice in the migration). |

**Note:** dropping the constraint removes its backing index automatically. `uq_user_roles_active` is a **different** index (church_id-first, unique, same predicate) — no name or definition collision.

---

## 4. Dead objects to remove (part of the batch)

| Object | State | Origin | Action |
|---|---|---|---|
| `audit_attendance` trigger on `attendance_backup_20260730` | Trigger was dropped by 019 CASCADE **along with** `audit_trigger_fn`… but the plan should still include `DROP TRIGGER IF EXISTS audit_attendance ON attendance_backup_20260730;` to be robust against a partially-applied history | 015:82 (rename left it on the backup table) | Drop (idempotent) |

---

## 5. References that must use exact existing names

| Existing object | Exact name | Origin | Used by 3C |
|---|---|---|---|
| `user_roles` UNIQUE constraint | `user_roles_church_id_user_id_role_id_key` (auto-generated from inline UNIQUE) | 001:278 | A3 constraint drop — must match exactly or the migration fails |
| Role lookup | `UNIQUE (church_id, role_type)` guarantees at most one `servant` role | 001:252 | `approve_servant` step 2 (A1) |
| `servants.approve` permission | code `servants.approve` | 021:79 | Approval gating (app layer) |
| `seed_church_roles` | `seed_church_roles(p_church_id uuid)` | 021:107 | `approve_church_request` |
| `write_audit_log` | `(p_church_id uuid, p_action text, p_entity_type text, p_entity_id uuid DEFAULT NULL, p_old_values jsonb, p_new_values jsonb)` | 019:57 | Optional explicit audit path; **do not** re-declare with the pre-019 enum signature |
| `notifications.church_id` FK | `notifications_church_id_fkey` (kept after `DROP NOT NULL`) | 001 | Nullable change only — no drop |

---

## 6. Things to verify at migration time (not collisions, but DB-state unknowns)

1. `notifications.old_metadata` presence (018 leaves it; types are stale — see audit report N-1). The `send_notification` INSERT must not reference it.
2. `database.types.ts` is stale (N-2) — regeneration (task 1.14) is mandatory and will confirm `old_metadata` and the post-022 function set.
3. `user_has_permission`, `get_user_servant_id`, `get_user_assigned_beneficiary_ids` remain as orphans — do not touch or adopt.

---

## 7. Conclusion

No existing migration 001–022 object name collides with the 3C surface. The only corrective items are:

1. **M-2:** replace `audit_children → children` with `audit_beneficiaries → beneficiaries` (children no longer exists).
2. **Ordering:** the three `tenant_isolation` policy replacements + `own_profile_insert` replacement + RPCs must ship in the same batch (they jointly define the new write paths).
3. **Exact names:** `user_roles_church_id_user_id_role_id_key` for the A3 constraint drop; `audit_attendance` drop must target `attendance_backup_20260730`.
