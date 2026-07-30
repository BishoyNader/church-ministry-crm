# Document Conflict Matrix

**Date:** 2026-07-30  
**Status:** All conflicts resolved below  

---

## Conflict 1 — `servant_stage_assignments.role` Values

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_REQUIREMENTS.md` §1.7 — `role TEXT NOT NULL` with values `'ministry_leader', 'servant'` |
| **Source B** | `RBAC_ARCHITECTURE.md` §5.1 — Role values `'admin', 'user'` |
| **Source C** | `CLASS_ACCESS_ARCHITECTURE.md` §2.3 — Role values `'service_admin', 'stage_leader', 'class_leader', 'servant'` |
| **Source D** | `DATABASE_MIGRATION_PLAN.md` §2.1.7 — Default `'servant'` |
| **Impact** | **Critical** — RLS policies reference `'admin'` and `'user'` but schema would store different values. Policies would never match rows. |
| **Root Cause** | Three independent definitions of the same column: business titles vs. system roles vs. granular assignment roles |
| **Resolution** | Adopt CLASS_ACCESS_ARCHITECTURE values `service_admin`, `stage_leader`, `class_leader`, `servant` — most granular, no ambiguity with system roles |
| **Final Decision** | `servant_stage_assignments.role` uses `'service_admin'`, `'stage_leader'`, `'class_leader'`, `'servant'` |

---

## Conflict 2 — `events` Table: "No Change" vs. FK Update Needed

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_MIGRATION_PLAN.md` §1.1 — `events` listed as "Exists — no change → ✅ Keep" |
| **Source B** | `DATABASE_MIGRATION_PLAN.md` §2.1.2 — `events.ministry_id → events.service_id` FK update listed |
| **Impact** | **High** — Contradictory statements in the same document. If the FK is not updated, `events` will reference a non-existent `ministries` table after the rename. |
| **Root Cause** | Summary table vs. detailed migration body not synchronized |
| **Resolution** | The FK update IS required. Remove "no change" label from events. |
| **Final Decision** | `events.ministry_id → events.service_id` FK update added to migration scope |

---

## Conflict 3 — `event_registrations.child_id` Not Renamed

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_MIGRATION_PLAN.md` §2.1.8 — `children` renamed to `beneficiaries`, columns restructured |
| **Source B** | `DATABASE_MIGRATION_PLAN.md` §2.1.9 — No mention of `event_registrations.child_id` rename |
| **Source C** | `RLS_IMPLEMENTATION_PLAN.md` §2.21 — `event_registrations` policy references `child_id` |
| **Impact** | **High** — After `children` → `beneficiaries` rename, `event_registrations.child_id` FK would break. RLS policy references non-existent column. |
| **Root Cause** | `event_registrations` oversight in migration plan |
| **Resolution** | Add `event_registrations.child_id → beneficiary_id` rename + FK update to migration plan |
| **Final Decision** | `event_registrations.child_id` renamed to `beneficiary_id`, FK updated to reference `beneficiaries(id)` |

---

## Conflict 4 — `churches` Address Field: Single vs. Split

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_REQUIREMENTS.md` §1.1 — `address TEXT` (single column) |
| **Source B** | `DATABASE_MIGRATION_PLAN.md` §2.1.1 — Adds `address_ar text` and `address_en text` (split) |
| **Impact** | **Medium** — No `address` column exists in the migration plan's target schema. DATABASE_REQUIREMENTS shows a single column. Migration plan uses split columns. |
| **Root Cause** | DATABASE_REQUIREMENTS was not updated after V3 i18n requirements were finalized |
| **Resolution** | Use split columns `address_ar` + `address_en` to support Arabic/English addresses. Update DATABASE_REQUIREMENTS to match. |
| **Final Decision** | `churches` has `address_ar text` and `address_en text` (no single `address` column) |

---

## Conflict 5 — `notifications` Column Rename FK Dependencies

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_MIGRATION_PLAN.md` §2.1.12 — `user_id → recipient_id`, `DROP COLUMN sent_at CASCADE` |
| **Source B** | Current schema — potential FK references to `notifications.user_id` or `notifications.sent_at` |
| **Impact** | **High** — `DROP COLUMN ... CASCADE` will drop any dependent objects (views, FKs, RLS policies). Not checked in the plan. |
| **Root Cause** | Migration plan assumes no existing dependencies |
| **Resolution** | Before migration, scan for all dependencies on `notifications.user_id` and `notifications.sent_at`. Update or recreate after rename. |
| **Final Decision** | Pre-migration dependency scan required. All dependent objects updated explicitly — no CASCADE assumed. |

---

## Conflict 6 — `followups.assigned_to` Column Missing from Migration Plan

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_REQUIREMENTS.md` §1.12 — `assigned_to UUID FK → servants(id)` listed |
| **Source B** | `DATABASE_MIGRATION_PLAN.md` §2.1.10 — No mention of `assigned_to` column or FK |
| **Impact** | **Medium** — Follow-up reassignment feature would have no DB support. The `assigned_to` column enables transfer of follow-ups between servants. |
| **Root Cause** | Migration plan oversimplified followups section |
| **Resolution** | Add `assigned_to UUID REFERENCES servants(id)` to followups migration |
| **Final Decision** | `followups.assigned_to UUID REFERENCES servants(id)` added to migration 016 |

---

## Conflict 7 — `gender_type` Enum vs. `gender TEXT`

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_MIGRATION_PLAN.md` §2.1.5 — `ALTER TABLE profiles ADD COLUMN gender gender_type` (uses enum) |
| **Source B** | `DATABASE_REQUIREMENTS.md` §1.8 — `beneficiaries.gender TEXT NOT NULL` |
| **Source C** | `DATABASE_REQUIREMENTS.md` §1.2 — `profiles` table (does not list gender column at all — missing) |
| **Impact** | **Medium** — Inconsistency: profiles uses enum, beneficiaries uses TEXT. No `gender_type` enum definition found. |
| **Root Cause** | DATABASE_REQUIREMENTS outdated; migration plan uses enum not yet created |
| **Resolution** | Use `gender_type` enum for both tables. Create enum `gender_type` as `('male', 'female')` before migration 010. |
| **Final Decision** | `gender_type` enum `('male', 'female')` created. Both `profiles.gender` and `beneficiaries.gender` use it. |

---

## Conflict 8 — Servant Approval Status: Enum vs. TEXT

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_REQUIREMENTS.md` §1.6 — `approval_status TEXT NOT NULL DEFAULT 'pending'` |
| **Source B** | `DATABASE_MIGRATION_PLAN.md` §2.1.6 — `approval_status text NOT NULL DEFAULT 'pending'` |
| **Source C** | Implicit — Should use an enum for data integrity |
| **Impact** | **Low** — Works as TEXT but risks invalid values at the DB level |
| **Root Cause** | Design choice to use TEXT for flexibility |
| **Resolution** | Keep as TEXT. Validation at application layer (Zod). Phase 2 migrate to enum if needed. |
| **Final Decision** | `servants.approval_status` remains `TEXT` with app-level validation. Domain values: `'pending'`, `'approved'`, `'rejected'`. |

---

## Conflict 9 — Beneficiary Status: Enum vs. TEXT

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_REQUIREMENTS.md` §1.8 — `status TEXT NOT NULL DEFAULT 'active'` |
| **Source B** | `PRD_V3.md` — Status values: active, inactive, transferred, graduated |
| **Impact** | **Low** — Same as approval_status |
| **Resolution** | Keep as TEXT. Domain values: `'active'`, `'inactive'`, `'transferred'`, `'graduated'`. |
| **Final Decision** | `beneficiaries.status` remains `TEXT`. Domain values enforced by application. |

---

## Conflict 10 — Missing Indexes: DATABASE_REQUIREMENTS vs. Migration Plan

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_REQUIREMENTS.md` §6 — 11 indexes specified |
| **Source B** | `DATABASE_MIGRATION_PLAN.md` §4 — 14 index entries (adds + drops) |
| **Impact** | **Medium** — Indexes `profiles(church_id, deleted_at)`, `profiles(email)` UNIQUE, `beneficiaries(church_id, stage_id, status)`, `followups(servant_id, status, scheduled_at)`, `audit_logs(church_id, created_at)`, `audit_logs(entity_type, entity_id)` missing from migration plan |
| **Resolution** | These indexes exist in the current schema and will be preserved. Add explicit verification steps to confirm they survive migration. |
| **Final Decision** | All DATABASE_REQUIREMENTS indexes verified as present post-migration. Migration plan updated to include explicit index preservation checks. |

---

## Conflict 11 — `attendance_sessions` Unique Constraint Scope

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_REQUIREMENTS.md` §1.10 — Unique constraint: `(stage_id, session_date)` |
| **Source B** | `DATABASE_MIGRATION_PLAN.md` §2.1.9 — `UNIQUE (stage_id, session_date)` |
| **Source C** | Implicit — If a stage has multiple classes, can two classes have a session on the same day? |
| **Impact** | **Medium** — The current constraint prevents two sessions per stage per day. If multiple classes within a stage need separate sessions, the constraint breaks. |
| **Resolution** | The default weekly session is at the stage level (not class level). Classes within a stage share the same session. No class-level session needed for MVP. The unique constraint is correct for MVP. |
| **Final Decision** | `UNIQUE (stage_id, session_date)` remains. Class-level sessions deferred to Phase 3. |

---

## Conflict 12 — `spiritual_journal_entries` vs Old `spiritual_records`: No Migration Path

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_MIGRATION_PLAN.md` §2.1.11 — "No data migration from spiritual_records. Keep old table as-is." |
| **Source B** | `PRD_V3.md` §FR-8 — Spiritual Growth module is MVP, must be functional |
| **Impact** | **Low** — Old records remain but are not migrated. New system has two parallel spiritual tables. |
| **Root Cause** | Old schema (child-focused) incompatible with new schema (servant-focused) |
| **Resolution** | Acceptable — old records serve as historical archive. Application hides `spiritual_records` from UI. Future migration can be written if needed. |
| **Final Decision** | `spiritual_records` kept for backward compatibility, hidden from MVP UI. No data migration. |

---

## Conflict 13 — `user_role_type` Enum Values: PRD vs. RBAC vs. Migration Plan

| Field | Value |
|-------|-------|
| **Source A** | `PRD_V3.md` §5 — 4 roles: `platform_owner, super_admin, admin, user` |
| **Source B** | `RBAC_ARCHITECTURE.md` §1 — `platform_owner, super_admin, admin, user` |
| **Source C** | `CLASS_ACCESS_ARCHITECTURE.md` §2 — `platform_owner, super_admin, admin, user` (with assignment sub-roles) |
| **Source D** | `DATABASE_MIGRATION_PLAN.md` §2.1.13 — `platform_owner, super_admin, admin, user` |
| **Impact** | **No actual conflict** — All 4 documents agree on the 4 system roles. The naming inconsistency is with the `servant_stage_assignments.role` values only (Conflict 1). |
| **Resolution** | System-level roles (`user_role_type`): `platform_owner`, `super_admin`, `admin`, `servant` (rename `user`→`servant` to match business title). |
| **Final Decision** | `user_role_type` enum values: `platform_owner`, `super_admin`, `admin`, `servant`. The `user` role is renamed to `servant`. |

---

## Conflict 14 — `notifications.type` vs `notifications.channel` Column Semantics

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_MIGRATION_PLAN.md` §2.1.12 — Renames old `type` → `channel`, drops old `channel`, adds new `notification_type` |
| **Source B** | `DATABASE_REQUIREMENTS.md` §1.14 — Has `type TEXT NOT NULL` and `channel TEXT NOT NULL` as separate columns |
| **Impact** | **Low** — Both agree on final outcome: `type` (notification type) and `channel` (delivery channel). The migration path is: old `type` repurposed as new `channel`, old `channel` dropped, new `notification_type` added. |
| **Root Cause** | Ambiguous old column naming |
| **Resolution** | Migration plan approach is correct. Old `type` column held channel-like data; repurposing it avoids data loss. |
| **Final Decision** | Final notifications columns: `notification_type`, `channel`, `is_read`, `data`, `recipient_id`. Migration plan sequence is correct. |

---

## Conflict 15 — `servants` Table: One-to-One with Profiles vs. Separate Entity

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_MIGRATION_PLAN.md` §2.1.6 — `servants.id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE` (1:1) |
| **Source B** | Implicit — Some profiles have no servant record (pending users, platform owners) |
| **Impact** | **Medium** — Every profile must be checked: does it need a servant row? The migration inserts ALL profiles into servants. But platform_owner profiles should NOT have servant records. |
| **Resolution** | Only profiles with church-level access (super_admin, admin, servant roles) get servant records. Platform owner profiles get NO servant record. |
| **Final Decision** | `servants` insert WHERE `role_type IN ('super_admin', 'admin', 'servant')`. Platform owner excluded. |

---

## Conflict 16 — `followups.stage_id` Dropped: Not Resolved by `beneficiary_assignments`

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_MIGRATION_PLAN.md` §2.1.10 — Drops `stage_id` because "resolved via beneficiary_assignments" |
| **Source B** | Implicit — A follow-up is about a specific beneficiary, so the stage can be resolved through `beneficiary_assignments`. But follow-ups can also be stage-level (e.g., "This stage needs more attention"). |
| **Impact** | **Low** — For MVP, all follow-ups are beneficiary-scoped. Stage-level follow-ups deferred. |
| **Resolution** | DROP is correct for MVP. Revisit if stage-level follow-ups are needed in Phase 2. |
| **Final Decision** | `followups.stage_id` dropped. All follow-ups are beneficiary-scoped. Stage-level follow-ups deferred. |

---

## Conflict 17 — `subscription_plans` Deferred But Referenced by `churches` Columns

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_MIGRATION_PLAN.md` — `subscription_plans` deferred to Phase 2 |
| **Source B** | `DATABASE_MIGRATION_PLAN.md` §2.1.1 — `churches.subscription_tier` and `churches.subscription_status` added now |
| **Impact** | **Low** — These columns are stored as free text, not as FKs to `subscription_plans`. No DB constraint prevents invalid tier values. |
| **Resolution** | Acceptable for MVP. Phase 2 will replace free text with FK to `subscription_plans`. |
| **Final Decision** | `churches.subscription_tier` and `churches.subscription_status` as free text (MVP). FK to `subscription_plans` in Phase 2. |

---

## Conflict 18 — `servant_stage_assignments` Ambiguity: New Table or Rename?

| Field | Value |
|-------|-------|
| **Source A** | `DATABASE_MIGRATION_PLAN.md` §1.1 Row #7 — `servant_stage_assignments` "Exists — Rename → servant_stage_assignments" (illogical — rename to same name) |
| **Source B** | `DATABASE_MIGRATION_PLAN.md` §1.1 Row #8 — `user_stage_assignments` "Exists — Superseded by servant_stage_assignments — migrate & drop" |
| **Source C** | `DATABASE_MIGRATION_PLAN.md` §2.1.7 — Creates NEW `servant_stage_assignments` table |
| **Impact** | **High** — Ambiguous whether the codebase already has a table named `servant_stage_assignments`. If it does, CREATE will fail. |
| **Root Cause** | Current schema not verified before writing migration plan |
| **Resolution** | Determine actual current table names before executing migration. If `servant_stage_assignments` exists, drop it first (or migrate). If only `user_stage_assignments` exists, CREATE is correct. |
| **Final Decision** | Pre-migration check required. If `servant_stage_assignments` exists: DROP (it's the old version with old schema). If not: CREATE. Migration sequence: 1) CREATE new table, 2) Migrate data from `user_stage_assignments`, 3) DROP `user_stage_assignments`. |

---

## Hidden Conflicts Discovered During Reconciliation

### H1 — `audit_logs.actor_id` FK to `profiles(id)` During Registration

Before a profile exists (initial registration flow), audit logs cannot reference a profile. The FK `actor_id UUID REFERENCES profiles(id)` would block pre-profile audit entries.

**Resolution:** `audit_logs.actor_id` is nullable (already shown in DATABASE_REQUIREMENTS). System actions and registration events use NULL actor_id.

### H2 — Platform Owner Has No `servant_stage_assignments`

The platform owner role exists at the system level and has no church_id, no profile church_id, and no servant record. RLS helper `get_user_church_id()` returns NULL for platform owners. This means:
- `user_is_super_admin()` returns false (no church)
- `get_user_service_ids()` returns empty array
- Platform owner cannot access any tenant-scoped table through RLS

**Resolution:** Correct by design. Platform owner uses a separate admin interface with service_role client or dedicated aggregate views.

### H3 — `beneficiaries` and `fb` for `attendance_records`: Who Records Servant Attendance?

`attendance_records.servant_id` allows recording servant attendance. But `attendance_sessions` is created by a profile, and servant attendance points back to `servants(id)`. A servant needs a servant record first, but the approval workflow creates the profile before the servant record.

**Resolution:** Not a migration issue. Application logic must handle the order: create servant record during approval, THEN record attendance. No DB change needed.

### H4 — `churches.locale` Default 'ar' vs. Existing Churches

Current churches may have no locale column. Migration 009 adds `locale text NOT NULL DEFAULT 'ar'`. This is correct — existing churches default to Arabic.

**Resolution:** No conflict, but the migration must handle existing rows. DEFAULT clause handles this.
