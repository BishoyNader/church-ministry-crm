# Schema Diff Report — Phase 2A

**Date:** 2026-07-30  
**Source:** Existing migrations (001-006) vs CANONICAL_DATABASE_SPEC.md  
**Status:** Pre-execution analysis  

---

## 1. Enum Changes

### 1.1 `user_role_type` — Replace

| Current | Target |
|---------|--------|
| `super_admin`, `church_admin`, `stage_leader`, `servant`, `viewer` | `platform_owner`, `super_admin`, `admin`, `servant` |

**Affected tables:** `roles`, `user_roles` (indirect)
**Strategy:** Create new type, migrate values, drop old type

### 1.2 `followup_status` — Modify

| Current | Target |
|---------|--------|
| `scheduled`, `in_progress`, `completed`, `cancelled` | `open`, `in_progress`, `completed`, `cancelled` |

**Strategy:** Create new type, map `scheduled → open`, drop old type

### 1.3 `followup_type` — Convert to TEXT domain

| Current | Target |
|---------|--------|
| ENUM: `phone_call`, `home_visit`, `whatsapp`, `church_meeting`, `other` | TEXT domain: `phone`, `visit`, `meeting`, `other` |

**Strategy:** Change column type to TEXT, update values

### 1.4 `child_status` — Convert to TEXT domain

| Current | Target |
|---------|--------|
| ENUM: `active`, `inactive`, `transferred`, `graduated` | TEXT domain: same values |

**Strategy:** Change column type to TEXT (same value set, just no longer ENUM)

### 1.5 Retained enums (no change)

| Enum | Reason |
|------|--------|
| `gender_type` | Already correct (`male`, `female`) |
| `attendance_status` | Already correct (`present`, `absent`, `excused`) |
| `event_type` | Kept for retained `events` table |
| `event_registration_status` | Kept for retained `event_registrations` table |
| `notification_type` | **Will be dropped** — canonical spec uses TEXT |
| `notification_channel` | **Will be dropped** — canonical spec uses TEXT |
| `pipeline_stage_type` | **Will be dropped** — column removed from beneficiaries |
| `audit_action` | **Will be dropped** — canonical spec uses TEXT for action |
| `document_entity_type` | **Will be dropped** — canonical spec uses TEXT for entity_type |
| `spiritual_record_type` | Kept for retained `spiritual_records` archive table |
| `ai_message_role` | Kept for retained `ai_messages` table |

### 1.6 Enum Summary

| Action | Count |
|--------|-------|
| Keep as-is | 4 (`gender_type`, `attendance_status`, `event_type`, `event_registration_status`, `spiritual_record_type`, `ai_message_role`) |
| Replace values | 1 (`user_role_type`) |
| Modify value | 1 (`followup_status`) |
| Convert to TEXT | 3 (`followup_type`, `child_status`, `audit_action`) |
| Drop (column removed) | 2 (`pipeline_stage_type`, `document_entity_type`) |
| Drop (TEXT domain) | 2 (`notification_type`, `notification_channel`) |

---

## 2. Table Changes

### 2.1 Tables to Create (8 new)

| # | Table | Migration | Spec Section |
|---|-------|-----------|-------------|
| 1 | `services` | 007 | Replaces `ministries` |
| 2 | `classes` | 008 | New entity |
| 3 | `servants` | 011 | Profile extension |
| 4 | `servant_stage_assignments` | 012 | Replaces `user_stage_assignments` |
| 5 | `beneficiaries` | 013 | Rename + restructure of `children` |
| 6 | `beneficiary_assignments` | 014 | New entity |
| 7 | `attendance_sessions` | 015 | New entity |
| 8 | `attendance_records` | 015 | New entity |
| 9 | `spiritual_journal_entries` | 017 | New entity |

### 2.2 Tables to Alter (8 modified)

| # | Table | Changes | Migration |
|---|-------|---------|-----------|
| 1 | `churches` | Add 8 columns, add 1 index | 009 |
| 2 | `profiles` | Add 4 columns, add 1 index | 010 |
| 3 | `stages` | Rename FK `ministry_id → service_id` | 007 |
| 4 | `followups` | FK updates, column renames, enum change | 016 |
| 5 | `notifications` | Column renames, add/drop columns, new index | 018 |
| 6 | `events` | Rename FK `ministry_id → service_id` | 007 |
| 7 | `event_registrations` | Rename `child_id → beneficiary_id` | 013 |
| 8 | `roles` | Update `role_type` enum values | 019 |

### 2.3 Tables to Drop (4 dropped)

| # | Table | Replacement | Migration |
|---|-------|-------------|-----------|
| 1 | `ministries` | `services` | 007 |
| 2 | `user_stage_assignments` | `servant_stage_assignments` | 012 |
| 3 | `attendance` | `attendance_sessions` + `attendance_records` | 015 |
| 4 | `spiritual_records` | Kept as archive (not dropped) | 017 |

### 2.4 Tables Unchanged (5 retained)

| # | Table | Notes |
|---|-------|-------|
| 1 | `documents` | No MVP changes |
| 2 | `ai_conversations` | Phase 2 |
| 3 | `ai_messages` | Phase 2 |
| 4 | `document_embeddings` | Phase 2 |
| 5 | `audit_logs` | Minor column change (`user_id → actor_id`) - see detail |

### 2.5 Tables to Alter Detail

#### `audit_logs`

| Current | Canonical | Change |
|---------|-----------|--------|
| `user_id` UUID FK → profiles | `actor_id` UUID FK → profiles (nullable) | Rename column |
| `action` audit_action (enum) | `action` TEXT | Drop enum dependency |
| `ip_address` inet | (dropped) | Remove column |
| `user_agent` text | (dropped) | Remove column |

**Migration:** `019_audit_logs_update.sql`

#### `user_roles`

| Current | Canonical | Change |
|---------|-----------|--------|
| `assigned_by` nullable | `assigned_by` NOT NULL | SET NOT NULL |
| (no `start_date`) | `start_date` DATE NOT NULL | Add column, populate from `created_at` |
| (no `end_date`) | `end_date` DATE nullable | Add column |
| `idx_user_roles_church_user`, `idx_user_roles_user` | `idx_user_roles_user_active` ON `(user_id, role_id) WHERE end_date IS NULL` | Drop old, create canonical |

**Migration:** `020_user_roles_update.sql`

---

## 3. Function Changes

### 3.1 Functions to Keep (no change)

- `handle_updated_at()` → trigger utility
- `handle_new_user()` → auth trigger
- `audit_trigger_fn()` → audit utility (may be deferred)
- `seed_church_roles()` → church bootstrap (will need updating for new perms)
- `write_audit_log()` → audit utility (may need updating for actor_id)

### 3.2 Functions to Replace

| Function | Action | Replacement |
|----------|--------|-------------|
| `get_user_role_types()` | Drop | Replaced by dedicated role check functions |
| `user_has_role(required_role user_role_type)` | Drop | Replaced by `user_is_super_admin()`, `user_is_admin()` |
| `user_has_any_role(required_roles user_role_type[])` | Drop | Replaced by dedicated role check functions |
| `user_has_stage_access(target_stage_id uuid)` | Drop | Replaced by `get_user_stage_ids()` + array checks |
| `user_is_church_admin_or_above()` | Drop | Replaced by `user_is_admin()` (which includes super_admin) |
| `user_has_permission(permission_code text)` | Keep | Still useful as a general check |

### 3.3 Functions to Create

| Function | Purpose |
|----------|---------|
| `get_user_servant_id()` | Get servant ID for current user |
| `user_is_platform_owner()` | Check if user is platform_owner |
| `user_is_super_admin(p_church_id uuid DEFAULT NULL)` | Check if user is super_admin in a church |
| `user_is_admin(p_church_id uuid DEFAULT NULL)` | Check if user is super_admin or admin |
| `get_user_service_ids()` | Get service IDs the user has access to |
| `get_user_stage_ids()` | Get stage IDs the user has access to |
| `get_user_class_ids()` | Get class IDs the user has access to |
| `get_user_assigned_beneficiary_ids()` | Get beneficiary IDs assigned to the user |

---

## 4. RLS Policy Changes

### 4.1 Summary

| Table | Current Policies | Target Policies | Change |
|-------|-----------------|-----------------|--------|
| churches | 3 | 3 | Replace `user_is_church_admin_or_above` with `user_is_super_admin`, add platform_owner |
| ministries | 4 | — | **Remove** (table dropped) |
| stages | 4 | 4 | Replace permission-based checks with role-based checks |
| classes | — | 4 | **New** table |
| profiles | 5 | 4 | Simplify: remove `profiles_delete`, scope SELECT with admin_scoped |
| roles | 4 | 3 | Simplify to read_all + super_admin_all |
| role_permissions | 3 | 3 | Similar logic, new function names |
| user_roles | 3 | 4 | Add admin_read, own_read |
| user_stage_assignments | 3 | — | **Remove** (table dropped) |
| children | 4 | — | **Remove** (table renamed) |
| attendance | 4 | — | **Remove** (table split) |
| followups | 4 | 4 | Replace stage_id-based access with beneficiary_assignments join |
| spiritual_records | 4 | — | Keep table, remove RLS policies (archival) |
| events | 4 | 4 | Update for service_id FK |
| event_registrations | 4 | 3 | Update for beneficiary_id, simplify |
| notifications | 3 | 3 | Update for recipient_id rename |
| audit_logs | 2 | 5 | Add super_admin + platform_owner read, immutability |
| documents | 3 | 3 | Update function references |
| ai_conversations | 4 | 2 | Simplify to tenant_isolation + owner_scope |
| ai_messages | 2 | 2 | Simplify to tenant_isolation + owner_scope |
| document_embeddings | 2 | 2 | Simplify to tenant_isolation + owner_scope |
| permissions | 1 | 2 | Add platform_owner_write |
| **New tables** | | | |
| services | — | 4 | **New** table |
| servants | — | 3 | **New** table |
| servant_stage_assignments | — | 5 | **New** table |
| beneficiaries | — | 5 | **New** table (replaces children) |
| beneficiary_assignments | — | 6 | **New** table |
| attendance_sessions | — | 4 | **New** table |
| attendance_records | — | 4 | **New** table |
| spiritual_journal_entries | — | 4 | **New** table |

### 4.2 Key Policy Logic Changes

1. Remove all `user_has_permission()` based checks — replace with role-based functions
2. Remove all `user_is_church_admin_or_above()` — replace with `user_is_admin()` or `user_is_super_admin()`
3. Remove all `user_has_stage_access()` — replace with `get_user_stage_ids()` array membership
4. Add servant/beneficiary assignment-based access via `servant_stage_assignments` and `beneficiary_assignments`
5. Add platform_owner access to churches, audit_logs, permissions
6. Add restrictive policy for `spiritual_journal_entries` blocking admin access
7. Use `get_user_service_ids()`, `get_user_stage_ids()`, `get_user_class_ids()` scope helpers

---

## 5. Permission Code Changes

### 5.1 Codes to Add (28 new)

```
services.create, services.read, services.update, services.delete
classes.create, classes.read, classes.update, classes.delete
servants.create, servants.read, servants.update, servants.delete
servants.approve, servants.assign
spiritual.create, spiritual.read
import.execute, export.execute
beneficiaries.transfer
tenants.create, tenants.read, tenants.update, tenants.delete
subscriptions.manage, billing.read
system.metrics, system.audit
support.manage
```

### 5.2 Codes to Rename (4 renamed)

| Current | New |
|---------|-----|
| `children.read` | `beneficiaries.read` |
| `children.create` | `beneficiaries.create` |
| `children.update` | `beneficiaries.update` |
| `children.delete` | `beneficiaries.delete` |

### 5.3 Codes to Drop (10 dropped)

```
children.export
events.read, events.create, events.update, events.delete
documents.read, documents.create, documents.delete
ai.use, ai.manage
```

### 5.4 Codes to Remove (7 extra — not in canonical catalog)

```
users.create, users.delete, users.manage
attendance.update, attendance.delete
notifications.create
churches.manage
```

### 5.5 Codes to Keep (14 kept)

```
auth.login, auth.manage
churches.read, churches.update
users.read, users.update
stages.read, stages.create, stages.update, stages.delete
attendance.read, attendance.create, attendance.export
followups.read, followups.create, followups.update, followups.delete
notifications.read, notifications.manage
reports.read, reports.export
audit.read
settings.read, settings.update
```

---

## 6. Index Changes

### 6.1 Indexes to Drop (35+)

All indexes from these dropped/renamed tables:
- `ministries` → 2 indexes
- `user_stage_assignments` → 2 indexes
- `children` → 7 indexes
- `attendance` → 3 indexes
- Old `notifications` → 2 indexes
- Old `profiles` → remove `idx_profiles_church_email`, `idx_profiles_church_phone`, `idx_profiles_church_active` (recreate with canonical def), replace with `idx_profiles_email` UNIQUE
- `stages` → drop 3 (idx_stages_church, idx_stages_church_ministry, idx_stages_church_active), add 1
- Old `user_roles` → `idx_user_roles_church_user`, `idx_user_roles_user`
- Old `audit_logs` → `idx_audit_logs_church_created`, `idx_audit_logs_church_entity`, `idx_audit_logs_user_created`

### 6.2 Indexes to Create (25+)

Per CANONICAL_DATABASE_SPEC.md Index Master List:
- churches: `(subscription_status) WHERE deleted_at IS NULL`
- profiles: `(church_id) WHERE deleted_at IS NULL`, `(email)` UNIQUE, `(church_id, spiritual_title) WHERE ...`
- services: `(church_id) WHERE deleted_at IS NULL`
- stages: `(service_id, sort_order) WHERE deleted_at IS NULL`
- classes: `(church_id, stage_id) WHERE deleted_at IS NULL`
- servants: `(church_id, approval_status) WHERE deleted_at IS NULL`
- servant_stage_assignments: 3 indexes + UNIQUE `(servant_id, stage_id, class_id, end_date)`
- beneficiaries: `(church_id, status) WHERE deleted_at IS NULL` (no `stage_id` — beneficiaries table doesn't have that column per canonical table definition)
- beneficiary_assignments: 3 indexes
- attendance_sessions: 1 index
- attendance_records: 2 indexes
- followups: `(servant_id, status, scheduled_at) WHERE deleted_at IS NULL` (rebuild)
- spiritual_journal_entries: UNIQUE `(servant_id, entry_date)`
- notifications: `(recipient_id, is_read, sent_at DESC)`
- audit_logs: `(church_id, created_at DESC)`, `(entity_type, entity_id)` (replaces old `idx_audit_logs_church_created`, `idx_audit_logs_church_entity`, `idx_audit_logs_user_created`)
- user_roles: `(user_id, role_id) WHERE end_date IS NULL` (replaces `idx_user_roles_church_user`, `idx_user_roles_user`)

---

## 7. Data Migration Requirements

| Migration | Data Movement | Volume Estimate |
|-----------|--------------|-----------------|
| 007 | `ministries` → `services` | Low (5-15 rows) |
| 011 | `profiles` → `servants` | Low (10-50 rows) |
| 012 | `user_stage_assignments` → `servant_stage_assignments` | Low (10-50 rows) |
| 013 | `children` → `beneficiaries` (column restructure) | Low-Med (50-500 rows) |
| 013 | Create `beneficiary_assignments` from `children` data | Low-Med |
| 015 | `attendance` → `attendance_sessions` + `attendance_records` | Low-Med |
| 016 | `followups` FK updates + status values | Low |
| 019 | `user_role_type` value migration | Low |

---

## 8. Migration Sequence with Dependencies

```
007: services + stages/events FK + events NOT NULL + stages index
  ↓ depends on: 007 (services exists for FK)
008: classes
  ↓ depends on: 009, 010 (for servant records)
009: churches columns
  ↓ independent
010: profiles columns (fix index collision)
  ↓ independent
011: servants (exclude church_id IS NULL)
  ↓ depends on: 010 (profiles columns exist), 007 (services exists)
012: servant_stage_assignments + UNIQUE constraint + drop user_stage_assignments
  ↓ depends on: 007, 008, 011
013: beneficiaries (archive parent data, keep stage_id for 014)
  ↓ depends on: 007, 008, 011
014: beneficiary_assignments (single-step service_id) + drop stage_id
  ↓ depends on: 013
015: attendance_sessions + attendance_records + drop attendance
  ↓ depends on: 007 (service_id)
016: followups FK + status enum
  ↓ depends on: 013 (beneficiaries exists)
017: spiritual_journal_entries
  ↓ independent
018: notifications schema
  ↓ independent
019: audit_logs update (user_id→actor_id, action→TEXT, drop ip/ua)
  ↓ independent
020: user_roles columns + index (assigned_by NOT NULL, start/end_date)
  ↓ independent
021: role_type enum + permission codes (52 codes, 10 added, 7 removed)
  ↓ depends on: 007-020 (all tables exist)
022: RLS helper functions + 89 policies (table-by-table, single txn)
  ↓ depends on: 021 (new role enum)
```

### Corrected Execution Order

| Order | Migration | Action |
|-------|-----------|--------|
| 1 | 007 | `ministries` → `services`, update `stages.service_id`, `events.service_id`, add events FK/NOT NULL, add stages index |
| 2 | 008 | Create `classes` |
| 3 | 009 | `churches` add columns |
| 4 | 010 | `profiles` add columns, fix `idx_profiles_church_active` collision |
| 5 | 011 | Create `servants`, migrate data (exclude platform owner) |
| 6 | 012 | Create `servant_stage_assignments` with UNIQUE constraint, migrate from old, drop |
| 7 | 013 | Rename `children` → `beneficiaries`, restructure columns, archive parent data, keep `stage_id` |
| 8 | 014 | Create `beneficiary_assignments`, migrate data (single-step), drop `stage_id` |
| 9 | 015 | Create `attendance_sessions` + `attendance_records`, migrate from `attendance`, drop old |
| 10 | 016 | Update `followups` FKs, status enum, drop stage_id |
| 11 | 017 | Create `spiritual_journal_entries` |
| 12 | 018 | Update `notifications` schema |
| 13 | 019 | Update `audit_logs` — `user_id→actor_id`, `action→TEXT`, drop `ip_address`/`user_agent`, new indexes |
| 14 | 020 | Update `user_roles` — make `assigned_by` NOT NULL, add `start_date`, `end_date`, canonical index |
| 15 | 021 | Update `user_role_type` enum, fix permission catalog (52 codes, 10 added PO codes, 7 removed), re-seed roles |
| 16 | 022 | Create 8 canonical helper functions, 89 RLS policies (table-by-table, single transaction) |

---

## 9. Risk Assessment

### 9.1 High Risk

| Risk | Migration | Mitigation |
|------|-----------|------------|
| Renaming `children` to `beneficiaries` | 013 | Impacts all FK references. Must update `event_registrations.child_id`, `followups.child_id`, `attendance.child_id`, `spiritual_records.child_id`, `documents` entity references. Backup children table first. |
| Dropping `attendance` | 015 | Data loss risk. Create backup table. Verify row counts before and after. |
| Renaming `notifications.user_id` to `recipient_id` | 018 | Impacts all application code referencing `user_id`. Must coordinate with app update. |
| Changing `user_role_type` enum | 019 | Impacts `roles.role_type`, all role-based functions, all RLS policies. Must update functions and policies atomically. |

### 9.2 Medium Risk

| Risk | Migration | Mitigation |
|------|-----------|------------|
| `services` table FK dependency chain | 007 | `stages`, `events`, `children`, `beneficiary_assignments` all reference services. Must update all FKs. |
| `servant_stage_assignments.role` values | 012 | Must match canonical values exactly. Different from current `user_stage_assignments` which has no role column. |
| `servants` table data migration | 011 | Must ensure all existing profiles with roles get a servant record. Risk: orphaned profiles without servants. |

### 9.3 Low Risk

| Risk | Migration | Mitigation |
|------|-----------|------------|
| `churches` add columns | 009 | Default values handle existing rows. |
| `profiles` add columns | 010 | Nullable columns. |
| `classes` create | 008 | Empty table initially. |
| `spiritual_journal_entries` create | 017 | No data migration from `spiritual_records`. |

---

## 10. Rollback Strategy

### 10.1 Pre-Migration Backup

```bash
pg_dump --format=custom --file=pre_migration_backup_20260730.dump $DATABASE_URL
```

### 10.2 Per-Migration Rollbacks

| Migration | Rollback |
|-----------|----------|
| 007 | Drop `services` table, restore `ministries` from backup table. Revert FK changes on `stages`, `events`. |
| 008 | `DROP TABLE classes CASCADE` |
| 009 | `ALTER TABLE churches DROP COLUMN` for each added column |
| 010 | `ALTER TABLE profiles DROP COLUMN` for each added column |
| 011 | `DROP TABLE servants CASCADE` (cascades to servant_stage_assignments, beneficiary_assignments, spiritual_journal_entries, followups FK) |
| 012 | Drop `servant_stage_assignments`, restore `user_stage_assignments` from backup |
| 013 | Drop `beneficiaries`, restore `children` from backup table. Revert `event_registrations.child_id` |
| 014 | `DROP TABLE beneficiary_assignments CASCADE` |
| 015 | Drop `attendance_sessions`, `attendance_records`, restore `attendance` from backup |
| 016 | Revert followups FK changes, restore old `followup_status` enum |
| 017 | `DROP TABLE spiritual_journal_entries` |
| 018 | Revert all notification column changes from backup |
| 019 | Restore old `user_role_type` enum from backup script. Restore old permissions. |

### 10.3 Catastrophic Rollback

```bash
# Drop all new/changed tables
# Restore full backup
pg_restore --dbname=church_ministry_crm --clean pre_migration_backup_20260730.dump
```

---

## 11. Pre-Execution Checklist

- [ ] Full database backup taken
- [ ] All 6 existing migrations applied (001-006)
- [ ] No unapplied migrations in `supabase/migrations/`
- [ ] `auth.users` table has data (supabase auth)
- [ ] Current schema verified against migration 001 definitions
- [ ] All FK references documented (especially `children`, `attendance`, `notifications`, `events`)
- [ ] Application code changes ready to deploy alongside schema changes
- [ ] Staging database available for dry-run
- [ ] Rollback scripts prepared
- [ ] Team notified of migration window (expected downtime)
