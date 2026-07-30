# Production Verification Checklist — Phase 2C

**Target:** Verify all 22 migrations applied correctly on production database  
**Method:** Run exact SQL queries below against production DB (or read replica)  
**Owner:** DB Admin + Engineering  

---

## Section A: Schema Verification

### A1. Table Count & Names

```sql
-- Expect 26 canonical tables (excluding backup tables)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Expected:** 26 tables (backup tables `attendance_backup_20260730`, `ministries_backup_20260730`, `user_stage_assignments_backup_20260730` are acceptable but not canonical).

| Table | Expected | Actual | Status |
|-------|----------|--------|--------|
| ai_conversations | ✅ | | |
| ai_messages | ✅ | | |
| attendance_records | ✅ | | |
| attendance_sessions | ✅ | | |
| audit_logs | ✅ | | |
| beneficiaries | ✅ | | |
| beneficiary_assignments | ✅ | | |
| churches | ✅ | | |
| classes | ✅ | | |
| document_embeddings | ✅ | | |
| documents | ✅ | | |
| event_registrations | ✅ | | |
| events | ✅ | | |
| followups | ✅ | | |
| notifications | ✅ | | |
| permissions | ✅ | | |
| profiles | ✅ | | |
| role_permissions | ✅ | | |
| roles | ✅ | | |
| servant_stage_assignments | ✅ | | |
| servants | ✅ | | |
| services | ✅ | | |
| spiritual_journal_entries | ✅ | | |
| spiritual_records | ✅ | | |
| stages | ✅ | | |
| user_roles | ✅ | | |

---

### A2. Column Verification Per Table

Run for each canonical table. Example:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'services'
ORDER BY ordinal_position;
```

**Critical columns to verify:**

| Table | Column | Expected Type | Nullable |
|-------|--------|---------------|----------|
| services | church_id | uuid | NO |
| services | service_type | text | NO |
| stages | service_id | uuid | NO (FK → services) |
| stages | stage_name | text | NO |
| beneficiaries | church_id | uuid | NO |
| beneficiary_assignments | service_id | uuid | NO |
| beneficiary_assignments | beneficiary_id | uuid | NO |
| beneficiary_assignments | servant_id | uuid | NO |
| attendance_sessions | stage_id | uuid | NO |
| attendance_records | session_id | uuid | NO |
| attendance_records | recorded_by | uuid | NO |
| followups | deleted_at | timestamptz | YES |
| notifications | recipient_id | uuid | NO |
| notifications | channel | text | NO |
| audit_logs | actor_id | uuid | YES |
| audit_logs | action | text | NO |

---

### A3. Enum Values

```sql
SELECT t.typname, e.enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN (
  'user_role_type', 'gender_type', 'attendance_status',
  'followup_status', 'child_status', 'event_type',
  'message_role'
)
ORDER BY t.typname, e.enumsortorder;
```

**Expected user_role_type:**
- platform_owner
- super_admin
- admin
- servant

---

### A4. Permission Count

```sql
SELECT count(*) AS permission_count FROM permissions;
```

**Expected:** 52

---

### A5. Permission List (Full Audit)

```sql
SELECT code, module FROM permissions ORDER BY code;
```

**Verify canonical codes exist.** Key codes to spot-check:
- `beneficiaries.*` (not `children.*`)
- `services.*`, `classes.*`, `servants.*` (service-level codes)
- `tenants.*`, `subscriptions.*`, `system.*` (platform_owner codes)
- No `events.*`, `documents.*`, `ai.*` codes

---

### A6. RLS Policy Count

```sql
SELECT tablename, count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

**Expected total:** 93

| Table | Min Expected |
|-------|-------------|
| churches | 3 |
| services | 4 |
| stages | 4 |
| classes | 4 |
| profiles | 5 |
| servants | 3 |
| servant_stage_assignments | 5 |
| beneficiaries | 5 |
| beneficiary_assignments | 7 |
| attendance_sessions | 5 |
| attendance_records | 4 |
| followups | 4 |
| spiritual_journal_entries | 4 |
| notifications | 3 |
| audit_logs | 6 |
| roles | 3 |
| permissions | 2 |
| role_permissions | 3 |
| user_roles | 4 |
| events | 3 |
| event_registrations | 3 |
| documents | 3 |
| ai_conversations | 2 |
| ai_messages | 2 |
| document_embeddings | 2 |

---

### A7. RLS Helper Functions

```sql
SELECT proname, pronargs, lanname
FROM pg_proc p
JOIN pg_language l ON p.prolang = l.oid
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN (
    'get_user_church_id', 'get_user_servant_id',
    'user_is_platform_owner', 'user_is_super_admin', 'user_is_admin',
    'get_user_service_ids', 'get_user_stage_ids', 'get_user_class_ids',
    'get_user_assigned_beneficiary_ids',
    'write_audit_log'
  )
ORDER BY proname;
```

**Expected:** All 10 functions present.

---

### A8. FK Constraints

```sql
SELECT
  conrelid::regclass::text AS table_name,
  confrelid::regclass::text AS referenced_table,
  conname AS constraint_name
FROM pg_constraint
WHERE contype = 'f'
  AND connamespace = 'public'::regnamespace
  AND conrelid::regclass::text NOT LIKE '%_backup_%'
ORDER BY table_name, referenced_table;
```

**Expected:** Minimal 35 FK constraints.

---

### A9. No Orphan Columns

```sql
-- Verify no old columns remain
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('ministry_id', 'child_id', 'ip_address', 'user_agent')
ORDER BY table_name;
```

**Expected:** Zero rows.

---

### A10. No Stale Data

```sql
-- Verify no child status values (should be beneficiary_status now)
SELECT DISTINCT status FROM beneficiaries;
```

```sql
-- Verify no old followup status values
SELECT DISTINCT status FROM followups;
```

---

## Section B: Application Smoke Tests

Execute against production URL after app deployment.

### B1. Application Health

| # | Test | Action | Expected Result | Status |
|---|------|--------|-----------------|--------|
| S1 | App loads | `GET /` | HTTP 200, renders login page | |
| S2 | Login flow | Authenticate as admin user | Redirect to dashboard, no console errors | |
| S3 | RTL/Arabic | Navigate to `/ar/dashboard` | Arabic content renders, RTL layout correct | |
| S4 | LTR/English | Navigate to `/en/dashboard` | English content renders | |

### B2. CRUD Operations

| # | Test | Action | Expected Result | Status |
|---|------|--------|-----------------|--------|
| S5 | List services | Navigate to services page | Table renders with data | |
| S6 | List stages | Navigate to stages page | Stages grouped by service | |
| S7 | List classes | Navigate to classes page | Classes grouped by stage | |
| S8 | List beneficiaries | Navigate to beneficiaries page | Beneficiaries render with assignments | |
| S9 | Create beneficiary | Submit new beneficiary form | 200 response, row appears in list | |
| S10 | Update beneficiary | Edit existing beneficiary | 200 response, row updates | |
| S11 | Record attendance | Navigate attendance page, submit record | Record created, session updated | |
| S12 | Create followup | Submit new followup | Followup listed, servant assigned | |
| S13 | View spiritual journal | Navigate to journal page | Entries render (empty state is OK) | |
| S14 | View notifications | Navigate to notifications | List renders | |

### B3. Permission Enforcement

| # | Test | Action | Expected Result | Status |
|---|------|--------|-----------------|--------|
| S15 | Servant cannot delete beneficiary | Log in as servant, try delete | 403 or button hidden | |
| S16 | Admin can create servant | Log in as admin, create servant | 200, servant created | |
| S17 | User sees own data only | Verify servant sees only assigned beneficiaries | Correct scope | |

---

## Section C: Auth & Security

| # | Check | Action | Expected | Status |
|---|-------|--------|----------|--------|
| C1 | JWT expiration | Verify token refresh works | No silent auth failures | |
| C2 | RLS bypass check | Attempt direct API call without auth | 401 Unauthorized | |
| C3 | Service role restricted | Verify service key not exposed client-side | Not in client bundle | |

---

## Section D: Performance

| # | Check | Threshold | Status |
|---|-------|-----------|--------|
| P1 | API response time (P95) | < 500ms | |
| P2 | Page load time | < 2s initial, < 200ms navigation | |
| P3 | Concurrent user simulation | 10 simultaneous requests — no lock contention | |
| P4 | Query planner | Verify no sequential scans on large tables | |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| DB Admin | | | |
| Backend Lead | | | |
| Frontend Lead | | | |
| QA | | | |
| Project Manager | | | |
