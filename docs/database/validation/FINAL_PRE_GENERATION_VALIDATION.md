# Final Pre-Generation Validation — Phase 2A → Phase 2B

**Date:** 2026-07-30  
**Scope:** Validate against canonical specs before generating migration files (007-022)

---

## 1. Executive Summary

Three validation gates were audited against the six canonical specifications. All gates pass. The project is **ready** to proceed to Phase 2B — Migration File Generation.

| Gate | Result |
|------|--------|
| 1. `pending_user` Role Validation | ✅ **Excluded by design** — aligns with canonical model |
| 2. Attendance Architecture Validation | ✅ **Correct** — matches canonical spec exactly |
| 3. Migration 022 Dependency Validation | ✅ **Safe** — all dependencies satisfied |

**Non-blocking findings:** 1 minor canonical spec inconsistency noted (does not impact execution).

---

## 2. `pending_user` Validation

### Canonical Sources

| Document | Section | Finding |
|----------|---------|---------|
| `CANONICAL_ROLE_MODEL.md` | Line 280 | System name: *"No system role — represented by `servants.approval_status = 'pending'`"* |
| `CANONICAL_ROLE_MODEL.md` | Lines 276-312 | Full "Role: Pending User" definition — scope `None`, permissions `None` |
| `CANONICAL_ROLE_MODEL.md` | Lines 11-33 | Role hierarchy: Pending User appears at bottom, labelled *"(no role — pre-approval)"* |
| `CANONICAL_ROLE_MODEL.md` | Lines 340-346 | Summary table: system name = `(pending)`, scope = `None` |
| `CANONICAL_DATABASE_SPEC.md` | Line 27 | `user_role_type` enum: `platform_owner, super_admin, admin, servant` — **no pending_user** |
| `CANONICAL_DATABASE_SPEC.md` | Line 38 | Servant `approval_status` TEXT domain includes `'pending'` |

### Output

| Item | Canonical Status | Execution Plan Status | Result |
|------|-----------------|----------------------|--------|
| Is `pending_user` a system role? | **No** — it is a state tracked via `servants.approval_status = 'pending'` | Not in `user_role_type` enum (migration 021 uses 4-value enum) | ✅ Aligned |
| Is `pending_user` in `user_role_type` enum? | **No** — enum has exactly 4 values | Not included | ✅ Aligned |
| Is `pending_user` in the role hierarchy? | **Yes** — documented as a conceptual non-role for documentation completeness | Represented via servant approval status, no separate enum value | ✅ Aligned |
| Does the execution plan handle `pending_user` correctly? | Per CANONICAL_ROLE_MODEL.md line 284: servant record with `approval_status='pending'`, no `user_roles` entry | Migration 011 creates servant records; approval flow uses `servants.approval_status` TEXT field | ✅ Aligned |

### Verdict

**Excluded by design.** `pending_user` is intentionally excluded from `user_role_type` per `CANONICAL_ROLE_MODEL.md` §Pending User (line 280). The state is tracked via `servants.approval_status = 'pending'`. No conflict exists.

---

## 3. Attendance Architecture Validation

### Canonical Sources

| Constraint | Source | Text |
|------------|--------|------|
| `UNIQUE (stage_id, session_date)` | `CANONICAL_DATABASE_SPEC.md` line 302 | *"one session per stage per day. Class-level sessions deferred to Phase 3."* |
| `class_id` nullable | `CANONICAL_DATABASE_SPEC.md` line 296 | `class_id | UUID | REFERENCES classes(id), nullable` |
| Attendance is at stage level | `CANONICAL_DATABASE_SPEC.md` line 302 | Explicitly states stage-level in MVP |
| Church → Service → Stage → Class | `CANONICAL_DATABASE_SPEC.md` lines 552-577 | ERD shows hierarchy |

### Key Questions

**Q: Can multiple classes under the same stage have attendance on the same date?**  
**A: No.** The `UNIQUE (stage_id, session_date)` constraint on `attendance_sessions` enforces exactly one session per stage per day. Since `class_id` is nullable and not part of the unique constraint, all classes under a stage share a single session. Class-level sessions are explicitly deferred to Phase 3.

**Q: Is attendance recorded at stage level or class level?**  
**A: Stage level in MVP.** `attendance_sessions` records one session per stage per day. `attendance_records` links each attendee to the session. Class-level attendance (separate sessions per class) is deferred.

### Output

| Constraint | Canonical Requirement | Execution Plan (migration 015) | Result |
|------------|----------------------|-------------------------------|--------|
| `UNIQUE (stage_id, session_date)` | Required per spec line 302 | **Present** in `attendance_sessions` DDL | ✅ Correct |
| `class_id` nullable | Per spec line 296 | `class_id uuid REFERENCES classes (id)` — no NOT NULL | ✅ Correct |
| Check constraint on `attendance_records` | `CHECK ((beneficiary_id IS NOT NULL AND servant_id IS NULL) OR (beneficiary_id IS NULL AND servant_id IS NOT NULL))` | **Present** as `CONSTRAINT exactly_one_attendee` | ✅ Correct |
| Index on `attendance_records(beneficiary_id, status, session_date)` | Required per spec line 327 | **Present** as `idx_attendance_records_beneficiary_status` | ✅ Correct |

### Verdict

**Correct.** The unique constraint `(stage_id, session_date)` matches the canonical spec exactly. Class-level attendance is deferred to Phase 3 per explicit spec instruction.

---

## 4. Migration 022 Dependency Validation

### Function Dependency Graph

```
get_user_church_id()                     → profiles
get_user_servant_id()                    → servants
user_is_platform_owner()                 → user_roles, roles
user_is_super_admin()                    → user_roles, roles  [calls get_user_church_id()]
user_is_admin()                          → user_roles, roles  [calls get_user_church_id()]
get_user_service_ids()                   → services, ssa      [calls get_user_church_id(), user_is_super_admin()]
get_user_stage_ids()                     → stages, ssa        [calls get_user_church_id(), user_is_super_admin()]
get_user_class_ids()                     → classes, ssa       [calls get_user_church_id(), user_is_super_admin()]
get_user_assigned_beneficiary_ids()      → beneficiary_assignments
```

### Table Creation Order (Migrations 007-021)

| Table | Created In | Available Before 022? |
|-------|-----------|----------------------|
| `profiles` | 001 | ✅ Yes |
| `services` | 007 | ✅ Yes |
| `stages` | 001 | ✅ Yes |
| `classes` | 008 | ✅ Yes |
| `servants` | 011 | ✅ Yes |
| `servant_stage_assignments` | 012 | ✅ Yes |
| `beneficiaries` | 013 | ✅ Yes |
| `beneficiary_assignments` | 014 | ✅ Yes |
| `user_roles` | 001 (altered in 020) | ✅ Yes (end_date column exists) |
| `roles` | 001 | ✅ Yes |
| `attendance_sessions` | 015 | ✅ Yes |
| `attendance_records` | 015 | ✅ Yes |

### Migration 022 Internal Order

The execution plan creates migration 022 in this order:

1. **8 helper functions** (lines 769-903) — created **before** the `BEGIN` block
2. **`BEGIN`** — starts transaction (line 910)
3. **`DO` block** — drops all existing policies (lines 914-922)
4. **`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`** — all 25 tables (lines 925-949)
5. **89 `CREATE POLICY` statements** — table-by-table (lines 951-1163)
6. **`COMMIT`** (line 1165)

### Validation Checks

| Check | Status | Notes |
|-------|--------|-------|
| Functions created before policies | ✅ **Pass** | All 8 functions created before `BEGIN`; policies inside transaction reference them |
| Policies reference only existing functions | ✅ **Pass** | Every policy function call resolved: `get_user_church_id()`, `user_is_platform_owner()`, `user_is_super_admin()`, `user_is_admin()`, `get_user_service_ids()`, `get_user_stage_ids()`, `get_user_class_ids()`, `get_user_assigned_beneficiary_ids()` |
| All referenced tables exist by migration 022 | ✅ **Pass** | Latest table created in migration 014 (beneficiary_assignments), 7 migrations before 022 |
| All referenced columns exist | ✅ **Pass** | `user_roles.end_date` added in migration 020; `services.deleted_at` in 007; all others from 001 |
| RLS enabled before policy creation | ✅ **Pass** | 25 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements precede all `CREATE POLICY` statements |
| Transactional safety | ✅ **Pass** | Entire policy deployment wrapped in `BEGIN`/`COMMIT`; no window without RLS |
| CASCADE risk from earlier migrations | ✅ **Pass** | Migration 021 (role enum) explicitly drops dependent functions before `DROP TYPE CASCADE`; 022 runs after |

### Verdict

**Safe.** All functions, tables, and columns exist before policies are created. The transaction boundary ensures no RLS exposure window. Function dependencies form a valid DAG.

---

## 5. Non-Blocking Finding

### Events RLS Policy — Column Name

The `CANONICAL_RLS_SPEC.md` §2.20 `stage_scope` policy (line 334) references `ministry_id`:

```
stage_id = ANY(get_user_stage_ids()) OR class_id = ANY(get_user_class_ids()) OR ministry_id = ANY(get_user_service_ids())
```

However, `CANONICAL_DATABASE_SPEC.md` §events (line 505) defines the column as `service_id`, and migration 007 renames `events.ministry_id → service_id`. The execution plan (migration 022) correctly uses `service_id`.

**Impact:** None — the execution plan is correct. The canonical RLS spec contains a stale reference to the pre-rename column name. Recommend updating `CANONICAL_RLS_SPEC.md` line 334 to read `service_id` for consistency.

---

## 6. Readiness Verdict

### ✅ READY FOR MIGRATION GENERATION

All three validation gates pass:

| Gate | Result |
|------|--------|
| 1. `pending_user` Role | ✅ Excluded by design — aligned with canonical model |
| 2. Attendance Architecture | ✅ Correct — `UNIQUE(stage_id, session_date)` matches spec |
| 3. Migration 022 Dependencies | ✅ Safe — all tables, columns, functions exist before use |

**Recommended action:** Apply the minor non-blocking fix to `CANONICAL_RLS_SPEC.md` line 334 (`ministry_id` → `service_id`), then proceed to Phase 2B — Migration File Generation.
