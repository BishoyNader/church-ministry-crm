# Phase 3C.2A.5 — Staging Apply Checklist

**Target:** `supabase/migrations/023_phase3c_registration.sql` → staging environment
**Staging Supabase ref:** `dyfgflmrsmzgvpknbesi` (`https://dyfgflmrsmzgvpknbesi.supabase.co`)
**Gate:** `PHASE_3C_2A_5_DATABASE_GATE_REVIEW.md` verdict = **READY_FOR_STAGING_APPLY**
**Basis:** `PHASE_3C_STAGING_DEPLOYMENT_PLAN.md`, `PHASE_3C_MIGRATION_EXECUTION_PLAN.md`, `PHASE_3C_STAGING_ROLLBACK_PLAN.md`
**Execute as:** DBA + QA + Security reviewer. **Windows:** maintenance / low-traffic. **Secrets:** DB password from Supabase Dashboard → Project Settings → Database (never commit).

This checklist is the **single source of execution order**. Every step has an exact command, expected output, success criterion, and HALT rule. Record evidence for each step in the execution log.

---

## Step 0 — Environment preparation

```bash
# 1. Connection string (Transaction pooler). Fill from Dashboard → Project Settings → Database.
export STAGING_DB_URL='postgresql://postgres.dyfgflmrsmzgvpknbesi:<DB_PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres'

# 2. Tooling check — must all succeed.
supabase --version                     # expect >= 2.109.1
psql --version                         # expect >= 14
pg_dump --version                      # expect >= 14
```

**HALT if:** any tool missing → install before proceeding.

---

## Step 1 — Baseline backup (P0.6)

| # | Action | Command | Pass criterion |
|---|---|---|---|
| 1.1 | Full logical backup (custom format, restorable) | `pg_dump --format=custom --no-owner --file=staging_023_pre_$(date +%Y%m%d%H%M).dump "$STAGING_DB_URL"` | Exit 0; file non-empty |
| 1.2 | Targeted snapshot of rollback-critical tables | `pg_dump --format=custom --table=public.notifications --table=public.user_roles --table=public.servants --table=public.profiles --table=public.audit_logs --file=staging_023_pre_$(date +%Y%m%d%H%M)_critical.dump "$STAGING_DB_URL"` | 5 tables present in archive |
| 1.3 | Checksum + seal | `sha256sum staging_023_pre_*.dump` then `chmod a-w staging_023_pre_*.dump` | Hash recorded; files read-only |
| 1.4 | Restore smoke (optional, recommended) | `pg_restore --list staging_023_pre_<ts>.dump \| head`; restore into the scratch DB and `SELECT count(*)` on the 5 tables | Archive parses; counts match source |

**HALT if:** dump fails, is empty, or restore smoke fails → do **not** proceed.

---

## Step 2 — Pre-flight verification (P0.1–P0.7 → PF-1…PF-27)

Run the consolidated SQL below against staging. **Every row must match the Expected value.** Record each result.

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f /tmp/opencode/preflight_023.sql
```

Consolidated pre-flight (write to `/tmp/opencode/preflight_023.sql`):

```sql
-- =====================================================================
-- P0.1 / PF-1  Migration history: 001–022 applied, NO 023
-- =====================================================================
SELECT 'PF-1' AS check_id, version, name FROM supabase_migrations.schema_migrations
ORDER BY version DESC LIMIT 3;
-- EXPECT: latest row version = '022', name = 'rls_implementation'. No '023' row.

-- =====================================================================
-- P0.1 / PF-2  First 3C batch: church_requests must NOT exist
-- =====================================================================
SELECT 'PF-2' AS check_id, to_regclass('public.church_requests') IS NULL AS ok;
-- EXPECT: t

-- =====================================================================
-- PF-3  Contiguous migration history (reconcile count vs 001–022)
-- =====================================================================
SELECT 'PF-3' AS check_id, count(*) AS applied FROM supabase_migrations.schema_migrations;
-- EXPECT: 22 (all of 001..022)

-- =====================================================================
-- PF-4  Dependency tables exist
-- =====================================================================
SELECT 'PF-4' AS check_id, count(*) AS missing FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND relname IN
  ('churches','profiles','servants','roles','user_roles','notifications','audit_logs',
   'attendance_backup_20260730','followups','attendance_sessions','attendance_records','beneficiaries')
  AND relkind='r';
-- EXPECT: 12

-- =====================================================================
-- PF-5  Dependency functions exist
-- =====================================================================
SELECT 'PF-5' AS check_id, count(*) AS present FROM pg_proc JOIN pg_namespace n ON n.oid=pronamespace
WHERE n.nspname='public' AND proname IN
  ('handle_updated_at','write_audit_log','seed_church_roles','get_user_church_id',
   'user_is_platform_owner','user_is_super_admin');
-- EXPECT: 6

-- =====================================================================
-- PF-6  gen_random_uuid available
-- =====================================================================
SELECT 'PF-6' AS check_id, gen_random_uuid() IS NOT NULL AS ok;
-- EXPECT: t

-- =====================================================================
-- P0.3 / PF-7  user_roles UNIQUE constraint name (S8 drop target)
-- =====================================================================
SELECT 'PF-7' AS check_id, conname FROM pg_constraint WHERE conrelid='user_roles'::regclass AND contype='u';
-- EXPECT: user_roles_church_id_user_id_role_id_key

-- =====================================================================
-- PF-8  idx_user_roles_user_active retained (020, A10/D-7)
-- =====================================================================
SELECT 'PF-8' AS check_id, to_regclass('public.idx_user_roles_user_active');
-- EXPECT: idx_user_roles_user_active (non-NULL)

-- =====================================================================
-- P0.2 / PF-9  notifications.old_metadata present (A9)
-- =====================================================================
SELECT 'PF-9' AS check_id, count(*) FROM information_schema.columns
WHERE table_name='notifications' AND column_name='old_metadata';
-- EXPECT: 1

-- =====================================================================
-- PF-10  notifications.church_id currently NOT NULL
-- =====================================================================
SELECT 'PF-10' AS check_id, is_nullable FROM information_schema.columns
WHERE table_name='notifications' AND column_name='church_id';
-- EXPECT: NO

-- =====================================================================
-- PF-11  No church_requests objects of any kind
-- =====================================================================
SELECT 'PF-11' AS check_id, (SELECT count(*) FROM pg_class WHERE relname LIKE 'church_requests%')
  + (SELECT count(*) FROM pg_trigger WHERE tgname='trg_church_requests_updated_at') AS obj_count;
-- EXPECT: 0

-- =====================================================================
-- PF-12  No pre-existing uq_user_roles_active
-- =====================================================================
SELECT 'PF-12' AS check_id, to_regclass('public.uq_user_roles_active') IS NULL AS ok;
-- EXPECT: t

-- =====================================================================
-- PF-13  No pre-existing 3C RPCs (audit_trigger_fn expected to EXIST — see note)
-- =====================================================================
SELECT 'PF-13' AS check_id, count(*) AS present FROM pg_proc JOIN pg_namespace n ON n.oid=pronamespace
WHERE n.nspname='public' AND proname IN
  ('send_notification','list_churches_for_signup','get_my_access_state','submit_church_request',
   'approve_servant','reject_servant','approve_church_request','reject_church_request');
-- EXPECT: 0
-- NOTE (baseline divergence FR-1): 'audit_trigger_fn' is NOT in the list above because it is
-- EXPECTED to already exist on the actual 001–022 baseline (see Risk Review FR-1). The original
-- PF-13 in the deployment plan expected it absent; the real baseline has it present but broken.

-- =====================================================================
-- PF-14  022 tenant_isolation = FOR ALL on the 3 tables
-- =====================================================================
SELECT 'PF-14' AS check_id, tablename, cmd FROM pg_policies
WHERE schemaname='public' AND policyname='tenant_isolation'
  AND tablename IN ('user_roles','servants','notifications') ORDER BY tablename;
-- EXPECT: notifications|ALL ; servants|ALL ; user_roles|ALL

-- =====================================================================
-- PF-15  profiles.own_profile_insert = 022 baseline (no churches EXISTS)
-- =====================================================================
SELECT 'PF-15' AS check_id, cmd FROM pg_policies
WHERE schemaname='public' AND tablename='profiles' AND policyname='own_profile_insert';
-- EXPECT: INSERT

-- =====================================================================
-- PF-16  audit_logs immutability intact
-- =====================================================================
SELECT 'PF-16' AS check_id, policyname, cmd FROM pg_policies
WHERE schemaname='public' AND tablename='audit_logs' AND policyname IN ('immutable_update','immutable_delete');
-- EXPECT: immutable_delete|DELETE ; immutable_update|UPDATE

-- =====================================================================
-- PF-17  AUDIT TRIGGER BASELINE — EXPECTED TO DIFFER FROM PLAN (FR-1)
-- =====================================================================
SELECT 'PF-17' AS check_id, c.relname, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
WHERE t.tgname LIKE 'audit\_%' AND NOT t.tgisinternal ORDER BY c.relname;
-- ACTUAL BASELINE (verified): audit_attendance(attendance_backup_20260730),
--   audit_children(beneficiaries), audit_followups(followups), audit_profiles(profiles),
--   audit_user_roles(user_roles) — 5 triggers.
-- The deployment plan expected ZERO here. See Risk Review FR-1. These are NOT a blocker;
-- 023 S9 repairs the underlying function. The stray audit_children is handled in Step 3.

-- =====================================================================
-- PF-18  Dead audit_attendance present on backup table (023:237 drop target)
-- =====================================================================
SELECT 'PF-18' AS check_id, count(*) FROM pg_trigger
WHERE tgname='audit_attendance' AND tgrelid='attendance_backup_20260730'::regclass;
-- EXPECT: 1

-- =====================================================================
-- PF-19  Grant-target roles exist
-- =====================================================================
SELECT 'PF-19' AS check_id, count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');
-- EXPECT: 3

-- =====================================================================
-- PF-20  Permission catalog = canonical 52
-- =====================================================================
SELECT 'PF-20' AS check_id, count(*) FROM permissions;
-- EXPECT: 52

-- =====================================================================
-- PF-21  user_role_type = 4 canonical values
-- =====================================================================
SELECT 'PF-21' AS check_id, enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
WHERE t.typname='user_role_type' ORDER BY e.enumsortorder;
-- EXPECT: platform_owner, super_admin, admin, servant

-- =====================================================================
-- P0.4 / PF-22  ZERO duplicate active grants (uq_user_roles_active build guarantee)
-- =====================================================================
SELECT 'PF-22' AS check_id, count(*) AS dup_active FROM
  (SELECT 1 FROM user_roles WHERE end_date IS NULL GROUP BY church_id,user_id,role_id HAVING COUNT(*)>1) d;
-- EXPECT: 0

-- =====================================================================
-- PF-23  Test fixtures present (>=1 super_admin grant, >=1 platform_owner grant)
-- =====================================================================
SELECT 'PF-23' AS check_id,
  (SELECT count(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id
     WHERE r.role_type='super_admin' AND ur.end_date IS NULL) AS super_admins,
  (SELECT count(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id
     WHERE r.role_type='platform_owner' AND ur.end_date IS NULL) AS platform_owners;
-- EXPECT: super_admins >= 1 ; platform_owners >= 1

-- =====================================================================
-- P0.5 / PF-24  No authenticated-client (non-admin) write paths on the 3 closed tables
-- =====================================================================
-- Run from the repo root (NOT SQL):
--   grep -rnE "\.from\(\"(user_roles|servants|notifications)\"\)\.(insert|update|delete)" src/
-- EXPECT: ONLY the two user_roles writes, both via the service-role `admin` client
--   (src/features/auth/services/auth.service.ts:148, src/features/users/services/user.service.ts:387).
--   No servants/notifications writes; no session-client (RLS) write on any of the three tables.
--   (Verified in PHASE_3C_2A_5_DATABASE_GATE_REVIEW §2.1.)
```

**Exit rule (P0/PF):** all PF-1…PF-24 PASS → proceed. Any FAIL → §4.8 of the deployment plan: data-remediation class (PF-22) → fix data and re-run; environment class (PF-1/PF-3) → do **not** apply, escalate; documentation class (PF-24) → confirm by inspection, record, proceed.

---

## Step 3 — Baseline remediation: drop the stray `audit_children` trigger

**Why (Finding FR-2, Risk Review):** the actual baseline carries `audit_children` on `beneficiaries` — a leftover from the 013 `children → beneficiaries` rename. The migration's own fidelity intent drops the analogous dead `audit_attendance` trigger (023:237) but does **not** drop `audit_children`. Left in place, every `beneficiaries` DML fires **both** `audit_children` and the new `audit_beneficiaries` → duplicated audit rows, and V4's "exactly 6 triggers" assertion would show 7.

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -c "DROP TRIGGER IF EXISTS audit_children ON beneficiaries;"
```

- **Expected output:** `DROP TRIGGER`
- **Pass criterion:** re-run the PF-17 query → `audit_children` no longer listed (4 triggers remain: audit_attendance, audit_followups, audit_profiles, audit_user_roles).
- **Decision point:** if the approver prefers **no** SQL outside 023, skip this step and instead (a) accept duplicated audit rows for `beneficiaries`, and (b) amend V4's assertion to expect 7 triggers. This is the **only** divergence; it is data-quality only (not integrity/security). Recommended default: run it.
- **HALT if:** any other unexpected `audit_*` trigger exists that 023 does not reference → escalate before applying.

---

## Step 4 — Apply migration 023

**Primary method (records the migration in `supabase_migrations`):**

```bash
supabase db push --db-url "$STAGING_DB_URL"
```

- **Expected output:** applies exactly `023_phase3c_registration.sql`; exit 0; "No migrations found" must **not** appear (i.e., it must detect 023 as pending).
- **Fallback method (if `db push` unavailable):** apply the file directly, then record the migration row:
  ```bash
  psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/023_phase3c_registration.sql
  psql "$STAGING_DB_URL" -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('023','phase3c_registration');"
  ```
- **Atomic outcome check (S2.2):** a failure anywhere inside the batch rolls everything back. Verify:
  ```sql
  SELECT to_regclass('public.church_requests') IS NOT NULL AS applied_ok;
  -- EXPECT: t on success; f only if the whole batch rolled back
  ```
- **HALT if:** any error → the transaction rolled back by design; **do not retry without triage**; confirm no partial state; go to `STAGING_APPLY_ROLLBACK_CONFIRMATION.md` if needed.

---

## Step 5 — Post-apply database verification (V1–V4)

See `STAGING_APPLY_VERIFICATION_PLAN.md` for the full SQL and expected outputs. Run V1 (schema), V2 (policies), V3 (functions & privileges), V4 (audit continuity). **V4 uses the amended pass criteria** (expect exactly 6 audit triggers post-apply, since Step 3 removed `audit_children`).

**HALT if:** any V1–V4 assertion fails → Rollback plan (decision tree).

---

## Step 6 — Registration workflow smoke (V6 on staging)

Execute the primary flows from `PHASE_3C_STAGING_TEST_MATRIX.md`:

| Flow | Test IDs | Pass criterion |
|---|---|---|
| Existing church | EC-01, EC-02, EC-03 (+ idempotency EC-02a/03a) | approve grants role + audit + notification; reject produces no grant; `get_my_access_state` reflects state |
| New church | NC-01, NC-02, NC-03 (+ NC-02a/02b atomicity negatives) | provisioning creates church/roles/profile/servant/super_admin atomically; rejects create nothing |
| Pending-approval state | EC-01c, EC-02c, EC-03b | `/pending-approval` vs `/dashboard` routing via `get_my_access_state` |

**HALT if:** any primary flow FAILs → Rollback plan.

---

## Step 7 — Security regression (V5 on staging, real sessions)

Run `PHASE_3C_STAGING_TEST_MATRIX.md` §4 (SE-01…SE-14, mapping R-1…R-16) with **real RLS-enforcing sessions — never service role** for negative cases. Confirmations: SE-01/02 (self-escalation DENIED), SE-03/04 (self-approval DENIED), SE-05 (cross-church DENIED), SE-06/07 (notification write surfaces DENIED), SE-09 (own-profile insert fail-closed DENIED, SE-09a service-role allowed), SE-10 (request immutability).

**HALT if:** any security test FAILs → Rollback plan.

---

## Step 8 — Type regeneration (immediately after success — see Verdict §5)

```bash
# MUST target the applied staging DB (or migrate the local DB to 023 first).
supabase gen types typescript --db-url "$STAGING_DB_URL" > src/types/database.types.ts

# Then, in the repo:
npx tsc --noEmit -p tsconfig.json          # expect 0 errors
npm run build                              # expect ✓ Compiled successfully
npm run lint                               # expect no new issues in touched files
```

**Expected regen delta:** adds `church_requests` table, `notifications.church_id → string | null`, and 9 `Functions` entries (`audit_trigger_fn` + the 8 client RPCs). **No service file requires editing** (wrappers pass explicit generics). Optionally trim `RegistrationFunctions` from `src/types/registration.ts` (not required — it keeps compiling).

**HALT if:** tsc/build fails after regen → fix in the app code (the wrappers are designed to survive regen; any break indicates a structural mismatch that must be reviewed before 3C.2B).

---

## Step 9 — Sign-off gate

Record all evidence in the execution log, then complete `PHASE_3C_STAGING_GO_LIVE_GATE.md` §4/§5 with the final verdict: `STAGING_VERIFIED` / `ROLLED_BACK` / `REQUIRES_CHANGES`.

---

## Command cheat-sheet

```bash
# Backup
pg_dump --format=custom --no-owner --file=staging_023_pre_$(date +%Y%m%d%H%M).dump "$STAGING_DB_URL"
pg_dump --format=custom -t public.notifications -t public.user_roles -t public.servants -t public.profiles -t public.audit_logs -f staging_023_pre_$(date +%Y%m%d%H%M)_critical.dump "$STAGING_DB_URL"

# Pre-flight + remediation + apply + check
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f /tmp/opencode/preflight_023.sql
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -c "DROP TRIGGER IF EXISTS audit_children ON beneficiaries;"
supabase db push --db-url "$STAGING_DB_URL"
psql "$STAGING_DB_URL" -t -c "SELECT to_regclass('public.church_requests') IS NOT NULL;"

# Type regen
supabase gen types typescript --db-url "$STAGING_DB_URL" > src/types/database.types.ts

# Rollback (if triggered) — full commands in STAGING_APPLY_ROLLBACK_CONFIRMATION.md
pg_restore --clean --if-exists -d "$STAGING_DB_URL" staging_023_pre_<ts>.dump
```
