# Verification Script — Post-Migration Validation

Run these SQL queries after migrations 007–022 complete to verify correctness.

---

## 1. Row Count Integrity

```sql
-- Verify row counts match between old backup tables and new canonical tables
SELECT '007: ministries vs services' AS check,
  (SELECT COUNT(*) FROM ministries_backup_20260730) AS old_count,
  (SELECT COUNT(*) FROM services) AS new_count,
  (SELECT COUNT(*) FROM ministries_backup_20260730) = (SELECT COUNT(*) FROM services) AS match;

SELECT '012: user_stage_assignments vs ssa' AS check,
  (SELECT COUNT(*) FROM user_stage_assignments_backup_20260730) AS old_count,
  (SELECT COUNT(*) FROM servant_stage_assignments) AS new_count,
  (SELECT COUNT(*) FROM user_stage_assignments_backup_20260730) = (SELECT COUNT(*) FROM servant_stage_assignments) AS match;

SELECT '013: children vs beneficiaries' AS check,
  (SELECT COUNT(*) FROM beneficiaries) AS beneficiary_count;

SELECT '014: beneficiaries with assignments' AS check,
  (SELECT COUNT(*) FROM beneficiary_assignments) AS assignment_count,
  (SELECT COUNT(*) FROM beneficiaries WHERE deleted_at IS NULL AND status = 'active') AS active_beneficiaries;

SELECT '015: attendance vs sessions+records' AS check,
  (SELECT COUNT(*) FROM attendance_backup_20260730) AS old_count,
  (SELECT COUNT(*) FROM attendance_sessions) AS session_count,
  (SELECT COUNT(*) FROM attendance_records) AS record_count;

SELECT '011: servants migrated' AS check,
  (SELECT COUNT(*) FROM servants) AS servant_count,
  (SELECT COUNT(*) FROM profiles WHERE church_id IS NOT NULL AND deleted_at IS NULL) AS eligible_profiles;

-- Verify platform owner was excluded
SELECT '011: platform owner excluded' AS check,
  CASE WHEN (SELECT COUNT(*) FROM servants WHERE church_id IS NULL) = 0
    THEN 'PASS' ELSE 'FAIL' END AS status;
```

---

## 2. Foreign Key Integrity

```sql
-- Verify no orphaned FKs
SELECT 'stages → services' AS fk, COUNT(*) AS orphans FROM stages s
  WHERE s.service_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM services sv WHERE sv.id = s.service_id);

SELECT 'events → services' AS fk, COUNT(*) AS orphans FROM events e
  WHERE e.service_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM services sv WHERE sv.id = e.service_id);

SELECT 'classes → stages' AS fk, COUNT(*) AS orphans FROM classes c
  WHERE NOT EXISTS (SELECT 1 FROM stages s WHERE s.id = c.stage_id);

SELECT 'servants → profiles' AS fk, COUNT(*) AS orphans FROM servants sv
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = sv.id);

SELECT 'ssa → servants' AS fk, COUNT(*) AS orphans FROM servant_stage_assignments ssa
  WHERE NOT EXISTS (SELECT 1 FROM servants sv WHERE sv.id = ssa.servant_id);

SELECT 'ssa → services' AS fk, COUNT(*) AS orphans FROM servant_stage_assignments ssa
  WHERE NOT EXISTS (SELECT 1 FROM services sv WHERE sv.id = ssa.service_id);

SELECT 'ba → beneficiaries' AS fk, COUNT(*) AS orphans FROM beneficiary_assignments ba
  WHERE NOT EXISTS (SELECT 1 FROM beneficiaries b WHERE b.id = ba.beneficiary_id);

SELECT 'ba → services' AS fk, COUNT(*) AS orphans FROM beneficiary_assignments ba
  WHERE NOT EXISTS (SELECT 1 FROM services sv WHERE sv.id = ba.service_id);

SELECT 'ba → stages' AS fk, COUNT(*) AS orphans FROM beneficiary_assignments ba
  WHERE NOT EXISTS (SELECT 1 FROM stages s WHERE s.id = ba.stage_id);

SELECT 'ba → servants' AS fk, COUNT(*) AS orphans FROM beneficiary_assignments ba
  WHERE NOT EXISTS (SELECT 1 FROM servants sv WHERE sv.id = ba.servant_id);

SELECT 'attendance_sessions → services' AS fk, COUNT(*) AS orphans FROM attendance_sessions a
  WHERE NOT EXISTS (SELECT 1 FROM services sv WHERE sv.id = a.service_id);

SELECT 'attendance_sessions → stages' AS fk, COUNT(*) AS orphans FROM attendance_sessions a
  WHERE NOT EXISTS (SELECT 1 FROM stages s WHERE s.id = a.stage_id);

SELECT 'attendance_records → sessions' AS fk, COUNT(*) AS orphans FROM attendance_records ar
  WHERE NOT EXISTS (SELECT 1 FROM attendance_sessions a WHERE a.id = ar.session_id);

SELECT 'followups → beneficiaries' AS fk, COUNT(*) AS orphans FROM followups f
  WHERE NOT EXISTS (SELECT 1 FROM beneficiaries b WHERE b.id = f.beneficiary_id);

SELECT 'followups → servants' AS fk, COUNT(*) AS orphans FROM followups f
  WHERE NOT EXISTS (SELECT 1 FROM servants sv WHERE sv.id = f.servant_id);

SELECT 'notifications → profiles' AS fk, COUNT(*) AS orphans FROM notifications n
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = n.recipient_id);
```

---

## 3. Index Presence

```sql
SELECT 'index check' AS check, schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_services_church_active',
    'idx_stages_service_sort',
    'idx_classes_church_stage',
    'idx_churches_subscription_status',
    'idx_profiles_email',
    'idx_profiles_church_active',
    'idx_profiles_spiritual_title',
    'idx_servants_church_approval',
    'idx_ssa_servant_active',
    'idx_ssa_stage_active',
    'idx_ssa_service_active',
    'idx_beneficiaries_church_status',
    'idx_ba_current',
    'idx_ba_stage_current',
    'idx_ba_servant_current',
    'idx_attendance_sessions_stage_date',
    'idx_attendance_records_session',
    'idx_attendance_records_beneficiary_status',
    'idx_followups_servant_status',
    'idx_spiritual_servant_date',
    'idx_notifications_recipient_read',
    'idx_audit_logs_church_time',
    'idx_audit_logs_entity',
    'idx_user_roles_user_active'
  )
ORDER BY indexname;
```

---

## 4. RLS Policy Count

```sql
SELECT 'RLS policy count' AS check, COUNT(*) AS total_policies
FROM pg_policies WHERE schemaname = 'public';

SELECT tablename, COUNT(*) AS policy_count
FROM pg_policies WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
```

Expected totals per `CANONICAL_RLS_SPEC.md §3`:

| Table | Expected |
|-------|----------|
| churches | 3 |
| services | 4 |
| stages | 4 |
| classes | 4 |
| profiles | 4 |
| servants | 3 |
| servant_stage_assignments | 5 |
| beneficiaries | 5 |
| beneficiary_assignments | 6 |
| attendance_sessions | 4 |
| attendance_records | 4 |
| followups | 4 |
| spiritual_journal_entries | 4 |
| notifications | 3 |
| audit_logs | 5 |
| roles | 3 |
| permissions | 2 |
| role_permissions | 3 |
| user_roles | 4 |
| events | 4 |
| event_registrations | 3 |
| documents | 3 |
| ai_conversations | 2 |
| ai_messages | 2 |
| document_embeddings | 2 |
| **Total** | **89** |

---

## 5. Enum & Type Integrity

```sql
SELECT 'user_role_type values' AS check,
  string_agg(enumlabel, ', ' ORDER BY enumsortorder) AS values
FROM pg_enum WHERE enumtypid = 'user_role_type'::regtype;

-- Expected: platform_owner, super_admin, admin, servant

SELECT 'attendance_status values' AS check,
  string_agg(enumlabel, ', ' ORDER BY enumsortorder) AS values
FROM pg_enum WHERE enumtypid = 'attendance_status'::regtype;

-- Expected: present, absent, excused

SELECT 'followup_status values' AS check,
  string_agg(enumlabel, ', ' ORDER BY enumsortorder) AS values
FROM pg_enum WHERE enumtypid = 'followup_status'::regtype;

-- Expected: open, in_progress, completed, cancelled

SELECT 'gender_type values' AS check,
  string_agg(enumlabel, ', ' ORDER BY enumsortorder) AS values
FROM pg_enum WHERE enumtypid = 'gender_type'::regtype;

-- Expected: male, female
```

---

## 6. Helper Function Presence

```sql
SELECT p.proname AS function_name, l.lanname AS language,
  CASE WHEN p.prorettype::regtype::text = 'boolean' THEN 'boolean'
       WHEN p.prorettype::regtype::text = 'uuid' THEN 'uuid'
       ELSE p.prorettype::regtype::text END AS return_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_user_church_id',
    'get_user_servant_id',
    'user_is_platform_owner',
    'user_is_super_admin',
    'user_is_admin',
    'get_user_service_ids',
    'get_user_stage_ids',
    'get_user_class_ids',
    'get_user_assigned_beneficiary_ids',
    'seed_church_roles',
    'handle_new_user',
    'handle_updated_at',
    'audit_trigger_fn',
    'write_audit_log'
  )
ORDER BY p.proname;
```

---

## 7. Permission Catalog Count

```sql
SELECT 'permission catalog' AS check, COUNT(*) AS total_codes
FROM permissions;

SELECT 'permissions by module' AS check, module, COUNT(*) AS cnt
FROM permissions
GROUP BY module
ORDER BY module;
```

Expected total: **52 codes**

---

## 8. Data Quality Checks

```sql
-- Check UNIQUE constraint on attendance_sessions
SELECT 'session uniqueness' AS check, stage_id, session_date, COUNT(*) AS dupes
FROM attendance_sessions
GROUP BY stage_id, session_date
HAVING COUNT(*) > 1;

-- Check UNIQUE constraint on spiritual_journal_entries
SELECT 'journal uniqueness' AS check, servant_id, entry_date, COUNT(*) AS dupes
FROM spiritual_journal_entries
GROUP BY servant_id, entry_date
HAVING COUNT(*) > 1;

-- Verify CHECK constraint on attendance_records
SELECT 'attendee constraint' AS check, COUNT(*) AS violations
FROM attendance_records
WHERE (beneficiary_id IS NULL AND servant_id IS NULL)
   OR (beneficiary_id IS NOT NULL AND servant_id IS NOT NULL);
```

---

## 9. Summary

Run all queries above. If all checks return 0 orphans, expected index counts, expected policy counts, expected enum values, and expected permission count (52), the migration is **VERIFIED**.
