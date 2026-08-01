# Frontend ↔ Database Gap Report

## Executive Summary

The frontend codebase is **fully disconnected** from the canonical database schema. Every major table has been renamed or restructured in migrations 007–022, but the TypeScript types (`database.types.ts`), service layers, server actions, and UI components still reference the **original v1 schema** (migration 001).

**29 database tables exist** (after 22 migrations). The type system only knows about **15** (9 outdated, 6 correct). **9 canonical tables are completely absent** from the type system. **5 dropped/renamed tables** are actively queried. **Multiple enum types have been dropped or changed** but still referenced in code.

---

## BLOCKER Issues (must fix before any deployment)

### B1. Type system references dropped tables
`database.types.ts` includes type definitions for `attendance`, `children`, `ministries`, `spiritual_records`, `user_stage_assignments` — all of which have been renamed/backed-up/dropped in migrations.

### B2. Active queries against dropped tables
Production code calls `.from()` on tables that no longer exist:

| Table queried | Files affected | Canonical replacement |
|---|---|---|
| `ministries` | `stage.service.ts:21,69,163,193,255`, `child.service.ts:675` | `services` |
| `children` | `child.service.ts:39,106,182,235,287,312`, `stage.service.ts:94,232,298,361,473`, `dashboard.service.ts:75` | `beneficiaries` |
| `attendance` | `child.service.ts:119,353,401,415,462`, `dashboard.service.ts:84` | `attendance_sessions` + `attendance_records` |
| `user_stage_assignments` | `user.service.ts:122,200,311,323`, `stage.service.ts:102,306,367,509,554,568` | `servant_stage_assignments` |

### B3. Enum type mismatches
The following enums have been **dropped or changed** in migrations but are still referenced in `database.types.ts`:

| Enum | Status | Canonical |
|---|---|---|
| `user_role_type` | Changed | `platform_owner`, `super_admin`, `admin`, `servant` (was `church_admin`, `stage_leader`, `servant`, `viewer`) |
| `child_status` | **DROPPED** | Replaced by `text` |
| `pipeline_stage_type` | **DROPPED** | Replaced by `text` |
| `audit_action` | **DROPPED** | Replaced by `text` |
| `notification_channel` | **DROPPED** | Replaced by `text` |
| `notification_type` | **DROPPED** | Replaced by `text` |
| `followup_type` | **DROPPED** | Replaced by `text` |
| `spiritual_record_type` | **DROPPED** | Replaced by boolean flags in `spiritual_journal_entries` |
| `followup_status` | Changed | `open` replaces `scheduled` |

---

## Detailed Table-by-Table Analysis

### 1. services (NEW — canonical replacement for ministries)
- **Type status**: MISSING from `database.types.ts`
- **Code references**: 0 correct, 6 broken (still query `ministries`)
- **Columns**: `id, church_id, name_ar, name_en, description_ar, description_en, sort_order, is_active, created_at, updated_at, deleted_at`
- **Action needed**: Add type, fix all `.from("ministries")` → `.from("services")`

### 2. classes (NEW)
- **Type status**: MISSING
- **Code references**: 0
- **Columns**: `id, church_id, stage_id, name_ar, name_en, sort_order, is_active, deleted_at, created_at, updated_at`
- **Action needed**: Add type

### 3. servants (NEW)
- **Type status**: MISSING
- **Code references**: 0
- **Columns**: `id (FK→profiles), church_id, confession_father_name, join_date, service_history, notes, approval_status, approved_by, approved_at, deleted_at, created_at, updated_at`
- **Action needed**: Add type

### 4. servant_stage_assignments (NEW — replaces user_stage_assignments)
- **Type status**: MISSING
- **Code references**: 0 correct, 10 broken (still query `user_stage_assignments`)
- **Columns**: `id, church_id, servant_id (FK→servants), service_id, stage_id, class_id, role, assigned_by, start_date, end_date, is_active, created_at`
- **Action needed**: Add type, fix all `.from("user_stage_assignments")` → `.from("servant_stage_assignments")`

### 5. beneficiaries (RENAMED from children)
- **Type status**: Still typed as `children` with old columns
- **Code references**: 12 broken (query `children`), 0 using `beneficiaries`
- **Old columns still referenced in code**: `first_name_ar, last_name_ar, first_name_en, last_name_en, parent_phone, ministry_id`
- **Canonical columns**: `id, church_id, full_name_ar, full_name_en, date_of_birth, gender, photo_url, mobile, status(text), notes, address, school, father_mobile, mother_mobile, whatsapp, confession_father, deleted_at, created_at, updated_at`
- **Action needed**: Replace type, rename all queries, update column references to `full_name_ar/en`, remove code referencing dropped columns

### 6. beneficiary_assignments (NEW)
- **Type status**: MISSING
- **Code references**: 0
- **Columns**: `id, church_id, beneficiary_id, service_id, stage_id, class_id, servant_id, assigned_by, is_current, start_date, end_date, transfer_reason, created_at`
- **Action needed**: Add type

### 7. attendance_sessions (NEW)
- **Type status**: MISSING
- **Code references**: 0
- **Columns**: `id, church_id, service_id, stage_id, class_id, session_date, notes, created_by, created_at` (UNIQUE stage_id, session_date)
- **Action needed**: Add type, restructure attendance logic

### 8. attendance_records (NEW)
- **Type status**: MISSING
- **Code references**: 0
- **Columns**: `id, church_id, session_id(FK→sessions), beneficiary_id, servant_id, status, recorded_by, notes, created_at`
- **Action needed**: Add type, restructure attendance logic

### 9. spiritual_journal_entries (NEW — replaces spiritual_records)
- **Type status**: MISSING
- **Code references**: 0
- **Columns**: `id, church_id, servant_id, entry_date, morning_prayer..sleep_prayer(6 booleans), bible_reading, confession, communion, spiritual_notes, created_at, updated_at` (UNIQUE servant_id, entry_date)
- **Action needed**: Add type (no `spiritual_records` references found in code — feature may be incomplete)

### 10. audit_logs (MODIFIED)
- **Type status**: Outdated
- **Changes**: `user_id` → `actor_id`, dropped `ip_address`/`user_agent`, added `metadata`, `entity_id` NOT NULL, `action` type changed from enum to text
- **Code references**: Only in `database.types.ts` (type itself). No direct queries in features.

### 11. notifications (MODIFIED)
- **Type status**: Outdated
- **Changes**: `user_id` → `recipient_id`, `type`/`channel` reorganized → `channel` (text), added `notification_type`, `is_read`, `data`
- **Code references**: Only in `database.types.ts`

### 12. user_roles (MODIFIED)
- **Type status**: Outdated
- **Changes**: `assigned_by` NOT NULL, added `start_date`, `end_date`, new index
- **Code references**: Only in `database.types.ts`

### 13. followups (MODIFIED)
- **Type status**: Outdated
- **Changes**: `created_by` → `servant_id`, `child_id` → `beneficiary_id`, dropped `stage_id`, added `next_action`, `deleted_at`, `type` changed from enum to text, `status` enum changed (`scheduled`→`open`)
- **Old columns referenced in code**: `child_id`, `stage_id`

### 14. events (MODIFIED)
- **Type status**: Outdated
- **Changes**: `ministry_id` → `service_id`, `service_id` SET NOT NULL
- **Code references**: Only in `database.types.ts`

### 15. stages (MODIFIED)
- **Type status**: Outdated
- **Changes**: `ministry_id` → `service_id`
- **Old columns referenced in code**: `ministry_id` (12+ references in stage service, child service, types, schemas)
- **Code references**: `ministry_id` used extensively in stage service, child service, schemas, actions

### 16. event_registrations (MODIFIED)
- **Type status**: Outdated
- **Changes**: `child_id` → `beneficiary_id`
- **Code references**: Only in `database.types.ts`

---

## Column-Level Impact Analysis

| Old column | New column | Tables affected | Code locations |
|---|---|---|---|
| `ministry_id` (stages/events) | `service_id` | stages, events | stage.actions.ts, stage.service.ts, stage.types.ts, stage.schema.ts, child.actions.ts, child.types.ts, child.schema.ts, child.service.ts, children hooks |
| `child_id` (event_registrations) | `beneficiary_id` | event_registrations | database.types.ts only |
| `child_id` (followups) | `beneficiary_id` | followups | child.service.ts, dashboard.service.ts, child.types.ts, child.schema.ts, use-followups.ts |
| `child_id` (spiritual_records → already spiritual_journal_entries) | — | spiritual_journal_entries | database.types.ts only |
| `user_id` (audit_logs) | `actor_id` | audit_logs | database.types.ts only |
| `user_id` (notifications) | `recipient_id` | notifications | database.types.ts only |
| `created_by` (followups) | `servant_id` | followups | database.types.ts, child.service.ts |
| `first_name_ar`/`last_name_ar` (children → beneficiaries) | `full_name_ar` | beneficiaries | child.actions.ts, child.types.ts, child.schema.ts, child.service.ts |
| `first_name_en`/`last_name_en` | `full_name_en` | beneficiaries | Same as above |
| `pipeline_stage` | DROPPED | beneficiaries | database.types.ts |
| `parent_phone`, `parent_email`, `baptism_date`, etc. | DROPPED | beneficiaries | child.service.ts (search), child.schema.ts |
| `stage_id` (followups) | DROPPED | followups | database.types.ts, child.types.ts, child.schema.ts |
| `stage_id` (beneficiaries) | DROPPED (now in beneficiary_assignments) | beneficiaries | database.types.ts |

---

## Feature Module Health

### `src/features/children/` — ❌ CRITICAL
- Queries `.from("children")` (dropped) instead of `.from("beneficiaries")`
- Uses `first_name_ar`/`last_name_ar` instead of `full_name_ar`
- References `ministry_id` (stages column renamed to `service_id`)
- References `child_id` (followups/etc. column renamed to `beneficiary_id`)
- Attendance sub-feature references `.from("attendance")` (dropped)

### `src/features/stages/` — ❌ CRITICAL
- Queries `.from("ministries")` (dropped) instead of `.from("services")`
- References `ministry_id` (column renamed to `service_id`)
- References `user_stage_assignments` (dropped)

### `src/features/users/` — ❌ CRITICAL
- Queries `.from("user_stage_assignments")` (dropped)
- Uses old `user_role_type` enum values (`church_admin`, `stage_leader`)

### `src/features/dashboard/` — ❌ CRITICAL
- Queries `.from("children")` (dropped)
- Queries `.from("attendance")` (dropped)

### `src/features/attendance/` — ⚠️ UNDEFINED
- Module exists but may reference old `attendance` table

### `src/features/auth/` — ⚠️ CHECK
- Queries `.from("churches")` — still valid

---

## Enum Value Audits

### `user_role_type` — MIGRATED in 021
```
OLD:  super_admin | church_admin | stage_leader | servant | viewer
NEW:  platform_owner | super_admin | admin | servant
```
- Code still using old values: `user.actions.ts:115-116`, `user.schema.ts:39`
- `database.types.ts` still has old enum

### `followup_status` — MIGRATED in 016
```
OLD:  scheduled | in_progress | completed | cancelled
NEW:  open | in_progress | completed | cancelled
```
- `database.types.ts` still lists old enum values

### Dropped enums (used as `text` now):
- `child_status` → `text`
- `pipeline_stage_type` → `text` (dropped entirely)
- `audit_action` → `text`
- `notification_channel` → `text`
- `notification_type` → `text`
- `followup_type` → `text`
- `spiritual_record_type` → `text` (table replaced by `spiritual_journal_entries`)

---

## Functions & RLS Changes

- `write_audit_log(p_action text)` — signature changed from `audit_action` enum to `text`
- `seed_church_roles()` — updated for new roles
- `user_has_stage_access()` — now references `servant_stage_assignments` instead of `user_stage_assignments`
- All RLS helper functions were recreated in 021/022 with updated enum references

---

## Migration Dependency Chain

```
001 (baseline: ministries, children, attendance, user_stage_assignments, spiritual_records)
→ 007 (services → replaces ministries; stages.ministry_id → service_id)
→ 008 (classes)
→ 011 (servants)
→ 012 (servant_stage_assignments → replaces user_stage_assignments)
→ 013 (beneficiaries → replaces children; full column restructure)
→ 014 (beneficiary_assignments; drops beneficiaries.stage_id)
→ 015 (attendance_sessions + attendance_records → replaces attendance)
→ 016 (followups restructure: servant_id, beneficiary_id, drop stage_id)
→ 017 (spiritual_journal_entries → replaces spiritual_records)
→ 018 (notifications: recipient_id, channel)
→ 019 (audit_logs: actor_id, drop ip/user_agent)
→ 020 (user_roles: assigned_by NOT NULL, start/end_date)
→ 021 (role enum rename, permission catalog rewrite)
```

---

## Recommended Fix Order

1. **Phase 2**: Fix `database.types.ts` — regenerate from canonical schema
2. **Phase 3a**: Fix table references — `ministries`→`services`, `children`→`beneficiaries`, `attendance`→sessions+records, `user_stage_assignments`→`servant_stage_assignments`
3. **Phase 3b**: Fix column references — `ministry_id`→`service_id`, `child_id`→`beneficiary_id`, `first_name_ar/last_name_ar`→`full_name_ar`
4. **Phase 3c**: Fix enum values — `church_admin`→`admin`, `stage_leader`/`viewer`→`servant`, `scheduled`→`open`
5. **Phase 4**: Fix server action signatures and auth patterns
6. **Phase 5**: UI/UX pass for new data model
7. **Phase 6**: Validation + final report
