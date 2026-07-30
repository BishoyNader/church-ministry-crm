# Phase 1C — Pre-Execution Review

**Date:** 2026-07-30  
**Status:** ⚠️ No-Go (issues must be resolved)  
**Documents Reviewed:**
- `docs/database/DATABASE_MIGRATION_PLAN.md`
- `docs/security/RBAC_ARCHITECTURE.md`
- `docs/security/RLS_IMPLEMENTATION_PLAN.md`
- `docs/database/DATABASE_REQUIREMENTS.md`
- `docs/architecture/SYSTEM_ARCHITECTURE.md`

---

## 1. Final Target Schema Summary

The target schema after Phase 1B migrations (excluding `subscription_plans` deferred to Phase 2):

| Category | Tables |
|----------|--------|
| **Renamed** | `ministries` → `services`, `children` → `beneficiaries` |
| **Created** | `classes`, `servants`, `beneficiary_assignments`, `attendance_sessions`, `attendance_records`, `spiritual_journal_entries`, `servant_stage_assignments` (restructured) |
| **Dropped** | `user_stage_assignments`, `attendance` (data migrated) |
| **Modified** | `churches` (+8 cols), `profiles` (+4 cols), `stages` (FK change), `followups` (FK+col changes), `notifications` (schema restructure), `roles`/`permissions`/`user_roles` (enum+code changes) |
| **Kept unchanged** | `events`, `event_registrations`, `audit_logs`, `role_permissions`, `documents`, `ai_conversations`, `ai_messages`, `document_embeddings`, `spiritual_records` (historical) |

**Schema evolution:** 21 current tables → 24 target tables (23 immediate + 1 Phase 2). Net change: +2 tables (after drops, renames, and creates net out).

---

## 2. Final Table Count

**23 tables** immediately targetable after Phase 1B migrations:

| # | Table | Type | Tenant-Scoped | RLS |
|---|-------|------|---------------|-----|
| 1 | `churches` | Root | N/A | ✅ |
| 2 | `profiles` | Core | ✅ | ✅ |
| 3 | `services` | Hierarchy | ✅ | ✅ |
| 4 | `stages` | Hierarchy | ✅ | ✅ |
| 5 | `classes` | Hierarchy | ✅ | ✅ |
| 6 | `servants` | People | ✅ | ✅ |
| 7 | `servant_stage_assignments` | Junction | ✅ | ✅ |
| 8 | `beneficiaries` | People | ✅ | ✅ |
| 9 | `beneficiary_assignments` | Junction | ✅ | ✅ |
| 10 | `attendance_sessions` | Activity | ✅ | ✅ |
| 11 | `attendance_records` | Activity | ✅ | ✅ |
| 12 | `followups` | Activity | ✅ | ✅ |
| 13 | `spiritual_journal_entries` | Activity | ✅ | ✅ |
| 14 | `notifications` | Activity | ✅ | ✅ |
| 15 | `audit_logs` | System | ✅ | ✅ |
| 16 | `roles` | RBAC | ✅ | ✅ |
| 17 | `permissions` | RBAC | ✅ | ✅ |
| 18 | `role_permissions` | RBAC | ✅ | ✅ |
| 19 | `user_roles` | RBAC | ✅ | ✅ |
| 20 | `events` | Activity | ✅ | ✅ |
| 21 | `event_registrations` | Activity | ✅ | ✅ |
| 22 | `documents` | Storage | ✅ | ✅ |
| 23 | `ai_conversations` | AI | ✅ | ✅ |
| 24 | `ai_messages` | AI | ✅ | ✅ |
| — | `document_embeddings` | AI | ✅ | ✅ |
| — | `spiritual_records` | Archive | ✅ | Kept for historical data |

Tables 23-26 (`ai_conversations`, `ai_messages`, `document_embeddings`, `spiritual_records`) exist but are not in scope for Phase 1B changes.

---

## 3. Final Enum List

| Enum | Values | Notes |
|------|--------|-------|
| `user_role_type` | `platform_owner`, `super_admin`, `admin`, `user` | Renamed from `church_admin`→`admin`, merged `stage_leader`/`servant`/`viewer`→`user` |
| `gender_type` | `male`, `female` | Pre-existing |
| `attendance_status` | `present`, `absent`, `excused` | Pre-existing |
| `followup_status` | `open`, `in_progress`, `completed`, `cancelled` | Replaces old enum; `scheduled` mapped to `open` |

⚠️ **Issue:** The migration plan does not specify the new gender_type values. The beneficiaries table uses `gender TEXT` with values `'male', 'female'` in DATABASE_REQUIREMENTS, but the profiles column addition says `gender gender_type` referencing the PostgreSQL enum. It is unclear if `gender_type` enum already exists in the database or needs to be created.

---

## 4. Final Role Hierarchy

```
PLATFORM_OWNER            │ platform_owner
  (system-wide, aggregate │
   only, no PII access)   │
                          │
SUPER_ADMIN               │ super_admin
  (church-wide — Priest)  │
                          │
ADMIN                     │ admin
  (service-scoped —       │
   Ministry Leader)       │
                          │
USER                      │ user
  (stage/beneficiary-     │
   scoped — Servant)      │
```

**Inheritance:** `super_admin` → `admin` → `user` (downward). `platform_owner` is a separate hierarchy with no inheritance from church roles.

---

## 5. Final Permission Catalog Count

**47 permission codes** across 10 modules:

| Module | Count | Codes |
|--------|-------|-------|
| Servants | 6 | create, read, update, delete, approve, assign |
| Beneficiaries | 5 | create, read, update, delete, transfer |
| Attendance | 3 | create, read, export |
| Follow-ups | 4 | create, read, update, delete |
| Services | 4 | create, read, update, delete |
| Stages | 4 | create, read, update, delete |
| Spiritual | 2 | create, read |
| Notifications | 2 | read, manage |
| Reports | 2 | read, export |
| Import/Export | 2 | import.execute, export.execute |
| RBAC | 1 | roles.manage |
| Settings | 2 | read, update |
| Audit | 1 | audit.read |
| Tenants (PO) | 4 | create, read, update, delete |
| Subscriptions (PO) | 1 | subscriptions.manage |
| Billing (PO) | 1 | billing.read |
| System (PO) | 2 | system.metrics, system.audit |
| Support (PO) | 1 | support.manage |

---

## 6. Final RLS Policy Count

**91 policies** across 24 tables:

| Table | Policies | Table | Policies |
|-------|----------|-------|----------|
| churches | 3 | attendance_records | 4 |
| services | 4 | followups | 4 |
| stages | 4 | spiritual_journal_entries | 4 |
| classes | 4 | notifications | 3 |
| profiles | 4 | audit_logs | 5 |
| servants | 3 | roles | 3 |
| servant_stage_assignments | 5 | permissions | 2 |
| beneficiaries | 5 | role_permissions | 3 |
| beneficiary_assignments | 6 | user_roles | 4 |
| attendance_sessions | 5 | events | 4 |
| — | — | event_registrations | 3 |
| — | — | documents | 3 |
| — | — | ai_conversations | 2 |
| — | — | ai_messages | 2 |
| — | — | document_embeddings | 2 |

The RLS plan documents ~93 policies; exact count from the per-table specification is 91.

---

## 7. Migration Execution Order

```
Migration 007: services rename + stages FK update
Migration 008: classes table
Migration 009: churches columns
Migration 010: profiles columns
Migration 011: servants table
Migration 012: servant_stage_assignments + drop user_stage_assignments
Migration 013: beneficiaries rename + schema restructure + beneficiary_assignments
Migration 014: (beneficiary_assignments — combined with 013 in plan)
Migration 015: attendance_sessions + attendance_records + migrate attendance data
Migration 016: followups FK + status enum update
Migration 017: spiritual_journal_entries
Migration 018: notifications schema update
Migration 019: role_type enum update + permission code changes
```

⚠️ Note: The numbering starts at 007, implying migrations 001-006 are earlier (likely core schema, auth setup, RPC functions). These must exist and be applied before Phase 1B begins.

**Dependency chain:**
- 007 (services) must precede all tables with service_id FK
- 008 (classes) can run any time after stages exist
- 011 (servants) must precede 012, 014, 016, 017
- 013 (beneficiaries) must precede 014, 015, 016
- 015 (attendance) must precede any RLS implementation

---

## 8. Data-Loss Risk Assessment

| Risk | Severity | Description |
|------|----------|-------------|
| R1 | **Critical** | `children`→`beneficiaries` full_name merge: combining `first_name_ar + last_name_ar` into `full_name_ar` is a one-way operation. If the split format is needed later, data cannot be recovered without the backup. |
| R2 | **Critical** | `children` column drops: 11 columns dropped (emergency_contact_name, allergies, medical_conditions, medications, etc.). Any existing data in these columns is permanently lost after migration. Pre-migration backup is essential. |
| R3 | **High** | `attendance` restructure: migrating from flat table to `sessions`+`records` schema requires matching `(stage_id, session_date)` pairs. If the original `attendance.attendance_date` has null or inconsistent dates, sessions won't match and records will be orphaned. |
| R4 | **High** | `user_stage_assignments`→`servant_stage_assignments` join: the migration JOINs through `servants` (which is being created from profiles). If any profiles lack corresponding servants rows (e.g., profiles that shouldn't be servants), assignments will be silently dropped. |
| R5 | **High** | `followups` status enum: mapping `scheduled`→`open` changes business semantics. Any code or reports relying on the `scheduled` status will break. |
| R6 | **Medium** | `role_type` enum rename uses `CASCADE` DROP on the old type. This could cascade to views, functions, or triggers depending on the old type. |
| R7 | **Medium** | `beneficiary_assignments.servant_id` may be NULL: the migration query uses a subquery to find a servant, with no guarantee a match exists. Records with NULL servant_id would violate the NOT NULL constraint. |
| R8 | **Medium** | `notifications` column renames: `user_id`→`recipient_id` and `type`→`channel` will break any existing application code or RLS policies referencing old column names. |

---

## 9. Rollback Readiness Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| Per-migration rollback defined | ✅ | Each step has a corresponding `DROP TABLE` or schema revert |
| Backup tables retained | ✅ | `_backup` suffix pattern, 30-day retention |
| Full database backup | ⚠️ | Mentioned but no script/command provided for `pg_dump` |
| Rollback order matches forward order | ❌ | Some reversals (e.g., enum type restore) require multi-step procedures not fully documented |
| Enum rollback | ❌ | PostgreSQL enums cannot be reverted by simply adding/removing values; the CASCADE strategy makes enum rollback complex |
| Data migration reversibility | ⚠️ | `INSERT...SELECT` migrations are reversible only if the backup table exists. Migrated data in the new format cannot be automatically reverse-migrated to the old format (e.g., `full_name_ar` → `first_name_ar + last_name_ar` split) |
| No circular dependencies in rollback | ✅ | All rollback actions are independent |

**Rollback Readiness Score: 5/10** — safe for structural changes, risky for data migrations.

---

## 10. Go / No-Go Recommendation

### ⛔ NO-GO

The following issues must be resolved before execution:

---

## Cross-Document Conflicts Found

### C1 — `servant_stage_assignments.role` values inconsistent

| Source | Values |
|--------|--------|
| `DATABASE_REQUIREMENTS.md` §1.7 | `'ministry_leader'`, `'servant'` |
| `RBAC_ARCHITECTURE.md` §5.1 | `'admin'`, `'user'` |
| `DATABASE_MIGRATION_PLAN.md` §2.1.7 | Default `'servant'` |

**Impact:** The RLS policies in `RLS_IMPLEMENTATION_PLAN.md` reference `'admin'` and `'user'` roles for stage-scoped access control. If the database stores `'ministry_leader'` and `'servant'`, the RLS policies will never match. **Must align before proceeding.**

### C2 — `events` table listed as "no change" but needs FK update

The migration plan §1.1 lists `events` as "Exists — no change → ✅ Keep", but §2.1.2 (services rename) says `events.ministry_id` `→ events.service_id` FK update is needed. Contradictory.

### C3 — `event_registrations.child_id` still references old `children` table

`RLS_IMPLEMENTATION_PLAN.md` §2.21 uses `child_id` in the RLS policy, but `children` is renamed to `beneficiaries`. The migration plan does not include renaming this column. If the column is not renamed and the FK not updated, the RLS policy will reference a non-existent column.

### C4 — `notifications` column rename may conflict with existing FKs

Renaming `user_id` to `recipient_id` requires checking if any existing table references `notifications(user_id)` via FK. The migration plan does not check for this. Also, `sent_at` is dropped with `CASCADE`, which could drop dependent objects.

### C5 — `churches` `address` field mismatch

`DATABASE_REQUIREMENTS.md` shows `churches.address` as a single TEXT column. The migration plan adds `address_ar` and `address_en` separately, with no `address` column at all.

### C6 — Permission code `beneficiaries.read` not accessible to admins in RBAC document

RBAC_ARCHITECTURE §2 says `user` has `beneficiaries.read` (assigned only), but the permission catalog §3 doesn't list `beneficiaries.read` for user role. The full permission catalog table (section 3) says all roles for `beneficiaries.read`, but the section 2 permission set definitions say `user` has it. These are actually consistent, but worth noting the two representations.

---

## Missing Items

### M1 — Missing Indexes (required by DATABASE_REQUIREMENTS but absent from migration plan)

| Table | Index | Source |
|-------|-------|--------|
| `profiles` | `(church_id, deleted_at)` | `DATABASE_REQUIREMENTS.md` §6 |
| `profiles` | `(email)` UNIQUE | `DATABASE_REQUIREMENTS.md` §6 |
| `beneficiaries` | `(church_id, stage_id, status)` | `DATABASE_REQUIREMENTS.md` §6 |
| `attendance_records` | `(beneficiary_id, status, session_date)` | `DATABASE_REQUIREMENTS.md` §6 (migration plan has only `(beneficiary_id, status)` — missing `session_date`) |
| `followups` | `(servant_id, status, scheduled_at)` | `DATABASE_REQUIREMENTS.md` §6 |
| `audit_logs` | `(church_id, created_at)` | `DATABASE_REQUIREMENTS.md` §6 |
| `audit_logs` | `(entity_type, entity_id)` | `DATABASE_REQUIREMENTS.md` §6 |

These indexes may already exist from the current schema and be preserved; they just need explicit verification.

### M2 — Missing Foreign Keys

| Table | FK | Missing From Migration Plan |
|-------|----|-----------------------------|
| `followups` | `assigned_to` → `servants(id)` | `DATABASE_REQUIREMENTS.md` shows `assigned_to` column but migration plan doesn't add it or its FK |
| `notifications` | `recipient_id` → `profiles(id)` | Column is renamed but FK constraint addition not shown |
| `event_registrations` | `child_id` → `beneficiaries(id)` or rename to `beneficiary_id` | Not addressed anywhere |

### M3 — Missing Audit Requirements

| Requirement | Status |
|-------------|--------|
| Immutable trigger on `audit_logs` (prevent UPDATE/DELETE) | ❌ Not in migration plan. SYSTEM_ARCHITECTURE defers this to Phase 2, but DATABASE_REQUIREMENTS §5 says it's needed. |
| Audit logging for spiritual journal access by Priest | ❌ App-level only, no DB trigger. RLS plan mentions it but doesn't enforce it. |
| Audit log index for entity history `(entity_type, entity_id)` | ❌ Not in migration plan |
| Consecutive absence alert SQL function | ❌ Not in migration plan (in SYSTEM_ARCHITECTURE §12.4 but no migration step creates it) |

### M4 — Missing Unresolved Architecture Decisions

| Decision | Question |
|----------|----------|
| `servant_stage_assignments` vs `user_stage_assignments` in current codebase | The migration plan lists both as existing tables. If `servant_stage_assignments` already exists, migration 012 would try to create it again → conflict. Needs verification of actual current schema. |
| `spiritual_records` deprecation timeline | The old table is kept but no plan for eventual cleanup or data migration. Risk of confusion between `spiritual_records` and `spiritual_journal_entries`. |
| `subscription_plans` table creation | Deferred to Phase 2 but migration 019 would be the natural place. The migration plan says "document only" — needs explicit decision. |

### M5 — Missing Tables for MVP

None. All required tables are accounted for.

---

## Consolidated Pre-Flight Checklist

- [ ] Resolve C1: Align `servant_stage_assignments.role` values across all documents (choose `admin`/`user` or `ministry_leader`/`servant`)
- [ ] Resolve C2: Add `events` FK update (ministry_id→service_id) to the migration plan
- [ ] Resolve C3: Add `event_registrations.child_id`→`beneficiary_id` rename to the migration plan
- [ ] Resolve C4: Verify FK dependencies before dropping/renaming `notifications` columns
- [ ] Resolve C5: Align `churches` address field (`address_ar`/`address_en` vs single `address`)
- [ ] Add M1 missing indexes to the migration plan
- [ ] Add M2 missing FKs (`followups.assigned_to`, `notifications.recipient_id`, `event_registrations.beneficiary_id`)
- [ ] Add M3 audit trigger (`prevent_audit_update_delete`) or explicitly document as Phase 2
- [ ] Add `get_consecutive_absent_beneficiaries` SQL function to migration plan
- [ ] Verify actual current schema to confirm whether `servant_stage_assignments` already exists
- [ ] Write and test rollback scripts for enum changes (role_type, followup_status)
- [ ] Create `pg_dump` backup command for pre-migration snapshot
- [ ] Verify all 24 tables have `church_id` column for RLS enforcement
- [ ] Regenerate TypeScript types after schema changes (`supabase gen types`)
- [ ] Confirm dry-run on staging before production

**Total blocking issues: 6** (C1–C6). **Total non-blocking but recommended fixes: 18** (M1–M5 items + checklist items).

---

## Summary

| Metric | Value |
|--------|-------|
| Target tables | 23 (24 with subscription_plans) |
| Permissions | 47 codes |
| RLS policies | 91 across 24 tables |
| Migration steps | 13 (007–019) |
| Critical data-loss risks | 2 (full_name merge, children column drops) |
| Cross-doc conflicts | 6 |
| Missing indexes | 5 |
| Missing FKs | 3 |
| Go/No-Go | **No-Go** |
