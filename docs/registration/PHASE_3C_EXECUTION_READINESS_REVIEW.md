# Phase 3C Execution-Readiness Review

**Date:** 2026-08-01
**Scope:** Execution-readiness validation for deploying Phase 3C (Registration) to the staging environment.
**Method:** Read-only assessment. No files modified, no SQL generated, no migrations applied, no commits made.
**Reviewer artifacts consulted:** `REGISTRATION_WORKFLOW_SPEC.md`, `REGISTRATION_UI_FLOW.md`, `CHURCH_PROVISIONING_SPEC.md`, `PHASE_3C_DATABASE_AUDIT_REPORT.md`, `PHASE_3C_SQL_AUDIT_CHECKLIST.md`, `PHASE_3C_MIGRATION_AUDIT_REPORT.md`, `PHASE_3C_MIGRATION_COLLISION_REPORT.md`, `PHASE_3C_STAGING_DEPLOYMENT_PLAN.md`, `PHASE_3C_STAGING_ROLLBACK_PLAN.md`, `STAGING_DEPLOYMENT_CONFIGURATION_AUDIT.md`, `STAGING_PROVISIONING_RUNBOOK.md`.

---

## Final Verdict

# `READY_AFTER_FIXES`

Staging execution is **not yet authorized**. Migration `023_phase3c_registration.sql` is production-quality and safe to apply against the 022 baseline, but the repository is not deployment-ready because the migration and the required frontend Phase 3C implementation are not committed/tracked, and several committed frontend paths are misaligned with the schema they must run against after 023.

---

## 1. Branch State

| Check | Result |
|---|---|
| Current branch | `code_enhancement` |
| HEAD vs `origin/staging` | Diff empty (deployed tree aligned); `origin/staging` has 1 merge commit (`a950b07`) ahead of HEAD with no net change |
| HEAD vs local `staging` | `2 0` ahead (merge-base `62fad07f…`) |
| HEAD vs `main` | `23 0` ahead; `main` fully merged |
| Tracked migrations | 22 tracked (`001`–`022`) |
| Working tree | 33 modified tracked files + 3 untracked entries |

Untracked (not in any branch, on disk only):
- `supabase/migrations/023_phase3c_registration.sql`
- `docs/registration/` (entire Phase 3C documentation set, 26 files)
- `docs/project/frontend/`

**Implication:** none of the Phase 3C deliverable — the migration, the specs, or the go/no-go documentation — exists in git history. `origin/staging` does not contain the schema change, so any deploy pipeline driven by tracked migrations cannot apply 023. This alone makes the repo not deployment-ready.

---

## 2. Documentation State

- Full Phase 3C doc set present on disk under `docs/registration/` (specs, UI flow, DB audit, SQL audit, migration audit/collision report, implementation plan, execution plan, dependency graph, object change matrix, security remediation, data safety review, compliance matrix, GO/NO-GO verdicts, staging deployment plan, staging rollback plan, staging test matrix, staging go-live gate, change log).
- **All 26 files are untracked** (`git ls-files` returns none). The docs record completed internal gates, but they do not exist on `origin/staging` or `main`.
- No `PHASE_3C_EXECUTION_READINESS_REVIEW.md` existed before this report (this file is new).

---

## 3. Migration State

Migration inventory: `001`–`023` contiguous on disk (23 files, `001_initial_schema.sql` → `023_phase3c_registration.sql`). No gaps, no conflicts, no migration is tracked that is not on disk.

### Dependency verification (023 → 001–022)
- `pgcrypto` / `gen_random_uuid` — introduced in `001` (21 references). ✅
- `handle_updated_at` trigger fn — `001:117`. ✅
- `write_audit_log` — defined in `019_audit_logs_update.sql`. ✅
- `seed_church_roles` RPC — defined in `021_role_and_permissions.sql` (3 refs). ✅
- `get_user_church_id`, `user_is_platform_owner`, `user_is_super_admin` — defined in `022_rls_implementation.sql:14–76`. ✅
- `attendance_backup_20260730` (023's `DROP TRIGGER audit_attendance` target) — exists in `015`. ✅
- 023 depends **only** on 001–022 objects; no forward dependencies.

### 023 step inventory (12 documented steps)
1. **S1** `church_requests` table + 3 indexes + `trg_church_requests_updated_at`.
2. **S2** 5 `church_requests` RLS policies.
3. **S3** `notifications.church_id` set nullable.
4. **S4–S7** Policy replacements on `user_roles`, `servants`, `notifications`, `profiles` (`tenant_isolation` → SELECT-only; `own_profile_insert` hardening).
5. **S8** Drop `user_roles_church_id_user_id_role_id_key` UNIQUE constraint; add `uq_user_roles_active` partial unique index (A3/D-7).
6. **S9–S10** `audit_trigger_fn` recreate + 6 audit triggers + dead-trigger drop (A4, `023:199–273`).
7. **S11** 8 SECURITY DEFINER RPCs (`023:291–830`).
8. **S12** RPC privilege lockdown (`REVOKE ALL … FROM PUBLIC, anon, authenticated`).

### Execution posture
- Runs cleanly on the staging 022 baseline; SQL audit, data-safety review, and go/no-go gates all passed in docs.
- Rollback plan exists (`PHASE_3C_STAGING_ROLLBACK_PLAN.md`) for the pre-flight and release windows.

---

## 4. Frontend Impact Review

### 4.1 Phase 3C UI is NOT implemented (verified against committed HEAD)
No 3C feature exists in the committed tree or in the working tree:
- No `/church-request` or `/pending-approval` routes (`src/app` contains only login/signup/forgot/reset/dashboard/children/followups/attendance/stages/users).
- No `getProfileByEmail`, `registerExistingChurchUser`, `getMyAccessState`, `approve_church_request`, `reject_church_request`, `approve_servant`, `reject_servant`, `list_churches_for_signup`, `send_notification` wrappers.
- No `get_my_access_state` routing/gating in `middleware.ts` / `src/proxy.ts` (auth whitelist is only `["/login","/signup","/forgot-password","/reset-password"]`).
- Signup still uses the legacy flow: free-text church creation → `churches` INSERT → `seed_church_roles` → direct `user_roles` INSERT.

### 4.2 Committed code misaligned with the schema it runs against
- **Audit inserts use removed column `user_id`** (renamed `actor_id`, NOT NULL, in 019) and omit `entity_id` (NOT NULL). `login`/`logout` in `auth.service.ts` are fixed in the working tree; `user.actions.ts` `auditInsert` still uses `user_id` and **is not** fixed in the working tree → audit rows silently dropped. (Pre-existing since 019; not a 023 regression, but part of the required alignment.)
- **`createUser` role/stage inserts**: committed code writes `user_roles` without `start_date` (020 NOT NULL) and reads/writes `user_stage_assignments` (table renamed to `servant_stage_assignments` in 012/022). Working tree fixes add `start_date` and rename to `servant_stage_assignments` with `service_id`.
- **`assignRoles`/`assignStages`** (committed): use the RLS-enforcing `createClient()` (anon) and `.delete()` before re-insert instead of the canonical end-date model (violates A3 / F-004). Working tree adds `start_date` but keeps `.delete()` and the anon client.
- **`PERMISSION_CODES`** (`src/features/rbac/constants/permissions.ts`) still references removed codes (`churches.manage`, `children.*`) rather than the 021 52-code catalog — re-sync required per `REGISTRATION_WORKFLOW_SPEC.md` §2.3.

### 4.3 Post-023 regression surface (what applying 023 changes for the current app)
- `user_roles`: `tenant_isolation` FOR ALL → SELECT-only. Anon-client role assignment/revocation by **non-super-admins is denied** after 023 (only `super_admin_all` allows writes). Current `assignRoles` uses the anon client → must move to service-role admin client or super-admin-gated path.
- `servants`: `tenant_isolation` FOR ALL → SELECT-only. No committed write path to `servants` exists (verified), so no immediate break, but any future write must use the admin client.
- `notifications`: `tenant_isolation` FOR ALL → SELECT-only. No committed write path (audit found 0 notification writes), so no immediate break.
- `profiles`: `own_profile_insert` hardening retained; own-row updates unaffected. Admin updates to other users' profiles were already super-admin-only on 022.
- No schema collisions between the frontend working tree and 023 (verified in `PHASE_3C_MIGRATION_COLLISION_REPORT.md`).

---

## 5. Environment Readiness

| Check | Result |
|---|---|
| `.env.local` vs `.env.local.example` | Key sets **identical** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`) |
| Staging target | Vercel `church-ministry-crm-staging`, branch `staging`, ref `dyfgflmrsmzgvpknbesi` |
| Staging env baseline | Documented in `STAGING_DEPLOYMENT_CONFIGURATION_AUDIT.md` and `STAGING_PROVISIONING_RUNBOOK.md` |
| `src/lib/supabase/admin.ts` | `createAdminClient()` uses service_role key — the intended privileged path for provisioning/approval RPCs |
| Types | `database.types.ts` is 022-era (working tree adds `approval_status`); must be regenerated **after** 023 applies to staging so 3C tables/RPCs are typed |

---

## 6. Risk Assessment

### Blocking (must be resolved before staging execution)
- **B-1 — 023 migration is untracked.** `supabase/migrations/023_phase3c_registration.sql` exists only in the working tree. It is not in `code_enhancement`, `staging`, or `origin/staging`. Commit 023 (and the Phase 3C docs) and merge to `staging` so the tracked repo carries the schema change.
- **B-2 — Phase 3C frontend is unimplemented.** No `/church-request`, `/pending-approval`, approval/admin queues, existing-church registration RPC wrappers, church dropdown, or access-state routing exist. The committed signup still self-provisions churches (free-text + `seed_church_roles`), which is the exact flow Phase 3C is designed to replace. Completing the UI per `REGISTRATION_UI_FLOW.md` / `REGISTRATION_WORKFLOW_SPEC.md` is required before go-live.

### High
- **H-1 — Audit inserts still use `user_id`** in `user.actions.ts` (`actor_id`/`entity_id` required since 019). Fix all audit write sites; don't rely on the silent-failure fallback.
- **H-2 — `assignRoles` breaks for non-super-admins after 023.** `user_roles` write path must move to the service-role admin client and be rewritten reactivation-first (set `end_date` instead of `.delete()`), per A3 / F-004.

### Medium
- **M-1 — `PERMISSION_CODES` stale** vs the 021 catalog; re-sync required.
- **M-2 — Regenerate `database.types.ts` after 023 applies** to expose `church_requests`, `church_requests_status` enum, and the 8 RPCs.
- **M-3 — 33 uncommitted modified files** (children/stages/users/dashboard/auth + types) must pass lint/typecheck and be committed with 023 in one merge; a partial commit would ship a mismatched tree.
- **M-4 — Confirm on staging that the seeded super admin exists** so `user_roles`/`profiles` administrative writes survive the tenant-isolation lockdown.

### Low
- **L-1 — Notifications write path is absent** (0 writes today); verify the `send_notification` consumer when UI lands.
- **L-2 — Route whitelist** must add Phase 3C public routes (`/church-request`, `/pending-approval`) to `middleware.ts`/`src/proxy.ts`.

---

## 7. Recommendation

1. **Commit** `023_phase3c_registration.sql` plus the Phase 3C docs and the 33 modified frontend files on `code_enhancement` (after lint/typecheck), then merge to `staging`. → clears B-1, M-3.
2. **Implement the Phase 3C frontend** per the UI-flow/workflow specs and wire it to the 023 RPCs. → clears B-2, L-2.
3. **Apply the audit-column and reactivation-first fixes** (H-1, H-2) and the permission-code re-sync (M-1).
4. **Re-run this review** after the fixes; then execute the staging deployment plan (`PHASE_3C_STAGING_DEPLOYMENT_PLAN.md`) with the rollback plan at hand, and regenerate `database.types.ts` immediately after 023 applies (M-2).

Until B-1 and B-2 are cleared, staging execution must not start.
