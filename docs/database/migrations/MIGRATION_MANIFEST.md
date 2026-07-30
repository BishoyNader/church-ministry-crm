# Migration Manifest — Phase 2A (Migrations 007–022)

**Date:** 2026-07-30  
**Applies to:** `supabase/migrations/`  
**Total files:** 16  
**Canonical sources:** `CANONICAL_DATABASE_SPEC.md`, `CANONICAL_RLS_SPEC.md`, `CANONICAL_ROLE_MODEL.md`, `CANONICAL_ASSIGNMENT_MODEL.md`, `CANONICAL_PERMISSION_CATALOG.md`

---

## Migration Index

| # | File | Lines | Purpose | Backs Up | Drops Enum |
|---|------|-------|---------|----------|------------|
| 1 | `007_services_table.sql` | 77 | Create `services`, migrate data from `ministries`, rename FKs in `stages`/`events`, fix events FK/NOT NULL, canonical stages index | `ministries_backup_20260730` | — |
| 2 | `008_classes_table.sql` | 16 | Create `classes` table with FK → `stages` | — | — |
| 3 | `009_churches_add_columns.sql` | 22 | Add 9 canonical columns to `churches`, subscription index | — | — |
| 4 | `010_profiles_add_columns.sql` | 17 | Add 4 canonical columns to `profiles`, email NOT NULL, fix index collision | — | — |
| 5 | `011_servants_table.sql` | 28 | Create `servants` table (FK → `profiles`), migrate profiles (excl. platform owner) | — | — |
| 6 | `012_servant_stage_assignments.sql` | 39 | Create `servant_stage_assignments`, UNIQUE constraint, migrate from `user_stage_assignments` | `user_stage_assignments_backup_20260730` | — |
| 7 | `013_beneficiaries_table.sql` | 103 | Rename `children` → `beneficiaries`, restructure columns, archive parent data, update FKs | — | `child_status`, `pipeline_stage_type` |
| 8 | `014_beneficiary_assignments.sql` | 52 | Create `beneficiary_assignments`, migrate from `beneficiaries.stage_id`, drop `stage_id` from beneficiaries | — | — |
| 9 | `015_attendance_restructure.sql` | 51 | Create `attendance_sessions` + `attendance_records`, migrate from `attendance` | `attendance_backup_20260730` | — |
| 10 | `016_followups_update.sql` | 61 | Update followups FKs (`beneficiary_id`, `servant_id`), status enum, `next_action`, drop `stage_id` | — | `followup_type`, `followup_status_old` |
| 11 | `017_spiritual_journal_entries.sql` | 36 | Create `spiritual_journal_entries` table | — | — |
| 12 | `018_notifications_update.sql` | 36 | Rename `user_id` → `recipient_id`, `type` ↔ `channel`, add canonical columns | — | `notification_channel`, `notification_type` |
| 13 | `019_audit_logs_update.sql` | 27 | Rename `user_id` → `actor_id`, action → TEXT, drop `ip_address`/`user_agent` | — | `audit_action` |
| 14 | `020_user_roles_update.sql` | 20 | Add `assigned_by` NOT NULL, `start_date`, `end_date` | — | — |
| 15 | `021_role_and_permissions.sql` | 164 | Update `user_role_type` enum, fix permission catalog (52 codes), add PO codes, drop old RLS fns, re-seed | — | `user_role_type` (replaced) |
| 16 | `022_rls_implementation.sql` | 350 | 8 helper functions, 89 RLS policies across 25 tables in single transaction | — | — |

---

## Dependency Graph

```
007 (services) ──→ 008 (classes) ──→ 012 (ssa, needs classes)
                                           │
007 (services) ──→ 009 (churches cols)     │
                    010 (profiles cols) ──→ 011 (servants, needs profiles)
                                              │
007 (services) ──→ 013 (beneficiaries, needs services for FK) ──→ 014 (assignments, needs beneficiaries)
                                                                      │
007 (services) ──→ 015 (attendance, needs services + stages)          │
                    016 (followups, needs beneficiaries + servants)    │
                    017 (spiritual journal, needs servants)            │
                    018 (notifications, needs profiles)                │
                    019 (audit_logs, standalone)                       │
                    020 (user_roles, needs profiles)                   │
                    021 (role + perms, standalone)                     │
                    022 (RLS, needs ALL prior tables)                  │
```

**Key ordering rules:**
- 007 must run before 008, 012, 013, 014, 015 (needs `services` table + FKs)
- 008 must run before 012 (needs `classes`)
- 010 must run before 011 (needs `profiles` with updated columns)
- 011 must run before 012 (needs `servants`)
- 013 must run before 014, 015, 016 (needs `beneficiaries`)
- 022 must run LAST (needs ALL tables)

---

## Backup Tables Created

| Migration | Backup Table | Restore Method |
|-----------|-------------|----------------|
| 007 | `ministries_backup_20260730` | `INSERT INTO ministries SELECT * FROM ministries_backup_20260730` |
| 012 | `user_stage_assignments_backup_20260730` | `INSERT INTO user_stage_assignments SELECT ...` |
| 015 | `attendance_backup_20260730` | `INSERT INTO attendance SELECT * FROM attendance_backup_20260730` |

---

## Enums Removed

| Migration | Enum | Replaced By |
|-----------|------|-------------|
| 013 | `child_status` | TEXT domain |
| 013 | `pipeline_stage_type` | Removed entirely |
| 016 | `followup_type` | TEXT domain |
| 016 | `followup_status` (old) | `followup_status` (new values) |
| 018 | `notification_channel` | TEXT domain |
| 018 | `notification_type` | TEXT domain |
| 019 | `audit_action` | TEXT domain |
| 021 | `user_role_type` (old) | `user_role_type` (new values: `platform_owner`, `super_admin`, `admin`, `servant`) |

---

## Risk Assessment

| Risk Level | Count | Migrations | Mitigation |
|------------|-------|------------|------------|
| **High** | 2 | 013 (beneficiaries), 015 (attendance) | Backup tables created, verify row counts before/after |
| **Medium** | 4 | 007 (services rename), 012 (ssa), 014 (assignments), 021 (perms) | FK chains verified, dry-run first |
| **Low** | 10 | All others | Idempotent operations, default values handle NULLs |
| **Critical** | 0 | — | — |

---

## Rollback Strategy

**Primary:** `pg_restore --clean pre_migration_backup_20260730.dump`  
**Per-migration:** See backup tables above for reverse-migration SQL  
**Safety net:** All `DROP` statements use `IF EXISTS`; all `CREATE` statements are idempotent where possible
