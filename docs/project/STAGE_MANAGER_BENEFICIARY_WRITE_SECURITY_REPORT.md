# Stage Manager — Beneficiary Write Authorization (Migration 039)

**Project:** Church Ministry CRM
**Branch:** `feature/stage-manager-beneficiary-writes`
**Date:** 2026-08-09
**Status:** Implemented, applied (001–039), and live-verified (22/22 UAT checks)

---

## 1. Executive Summary

The **Stage Manager** (`stage_manager` / أمين مرحلة) previously held `beneficiaries.create`
and `beneficiaries.update` permissions (migration 036) but the beneficiary write RPCs
(`create_beneficiary_with_assignment`, `transfer_beneficiary`, migration 024) only checked
`user_has_permission_in_church(...)` — i.e. **church-wide**. A Stage Manager could therefore
create beneficiaries in any stage of the church and transfer any beneficiary between any
stages, ignoring their assigned stage scope.

This change makes both RPCs **stage-scope aware** while preserving the exact 024 behavior
for admins (church-wide) and servants (no write access):

- `create_beneficiary_with_assignment` now requires `beneficiaries.create` **AND** the
  destination stage to be inside `get_user_stage_ids()`.
- `transfer_beneficiary` now requires `beneficiaries.transfer` **AND** both the source
  (current) and destination stages to be inside the actor's scope.
- The app-layer server actions (`createChildAction`, `updateChildAction`,
  `transferChildAction`) enforce the same gates before any RPC call, so blocked moves
  never trigger partial writes, and surface failures in the requester's locale.

UAT: **22/22 PASS** — 12 Stage Manager write cases, 5 admin (church-wide, unchanged)
cases, 5 read-scope regression cases.

---

## 2. Threat Model

| ID | Threat | Before | After |
|----|--------|--------|-------|
| T1 | SM creates a beneficiary in a stage they do not manage | **Vulnerable** (only `beneficiaries.create` checked, church-wide) | Blocked: `stage_access_denied` |
| T2 | SM transfers a beneficiary **out of** an unmanaged stage (escalation vector) | **Vulnerable** | Blocked: `source_stage_access_denied` |
| T3 | SM transfers a beneficiary **into** an unmanaged stage | **Vulnerable** | Blocked: `destination_stage_access_denied` |
| T4 | SM transfers a beneficiary from another church | **Vulnerable** (only service_id/stage_id validated) | Blocked: `beneficiary_not_found` |
| T5 | SM creates with a mismatched (service, stage) pair, corrupting assignment integrity | Not guarded | Blocked: `stage_service_mismatch` |
| T6 | Servant gains write access via the same RPCs | Blocked (role check) | Blocked (role check, unchanged) |
| T7 | Admin functionality regresses | — | **No regression** (admin skips scope checks) |

---

## 3. Design Decisions

1. **Transfer gate is `beneficiaries.transfer`, not `beneficiaries.update`.**
   `beneficiaries.update` is held by servants in the 021/036 matrix; transfers move a
   beneficiary across stages and are a strictly more privileged operation. A dedicated
   code lets admins grant transfers without granting general edits. The new RPC raises
   `not_authorized` for a caller holding only `beneficiaries.update`.

2. **Exact 024 signatures and audit shape are preserved** so the frontend and the audit
   viewer (which lists DISTINCT `action`/`entity_type` from `audit_logs`) are unchanged:
   - `create` → `action='create'`, `entity_type='beneficiary_assignment'`,
     `new_values = {service_id, stage_id}`
   - `transfer` → `action='transfer'`, `entity_type='beneficiary'`,
     `old_values`/`new_values = {service_id, stage_id}`
   - `transfer_beneficiary(p_beneficiary_id, p_new_service_id, p_new_stage_id,
     p_reason text DEFAULT NULL)` — the frontend calls it without `p_reason`.

3. **`get_user_stage_ids()` (038/022) is the scope primitive.** It returns all active
   church stages for admins/super admins, and the actor's active
   `servant_stage_assignments` otherwise. Admin keeps church-wide behavior
   automatically; no extra admin branch is needed.

4. **`stage_service_mismatch` integrity guard added to both RPCs.** A create/transfer
   whose `(service_id, stage_id)` pair does not resolve to the same church stage is
   rejected before any write.

5. **023-behavior preserved:** `COALESCE(p_date_of_birth, '2000-01-01')`,
   `COALESCE(p_gender, 'male')`, `NULLIF(BTRIM(...))` on contact fields,
   `transfer_reason` copied to the new assignment row, orphan-servant fallback (first
   approved church servant) with `servant_not_found`, and
   `ORDER BY start_date DESC LIMIT 1` for the current assignment.

6. **Grant backfill is idempotent and targeted.** `seed_church_roles()` (036) is *not*
   idempotent (plain `INSERT … RETURNING`), so 039 does **not** re-run it on existing
   churches. Instead it (a) recreates `seed_church_roles` with `beneficiaries.transfer`
   added to the Stage Manager set (for future churches) and (b) backfills existing
   `stage_manager` system roles with an idempotent
   `INSERT … ON CONFLICT (role_id, permission_id) DO NOTHING`
   (`role_permissions` has a unique constraint on the pair; `beneficiaries.transfer`
   is seeded in 021).

7. **App layer gates before RPC.** `transferChildAction` requires
   `BENEFICIARIES_TRANSFER` + source (`getBeneficiaryCurrentStage`) + destination scope.
   `updateChildAction` requires the same when a move is detected (compared against the
   current assignment fetched up-front), and both scope checks run **before** the
   `beneficiaries` UPDATE so a denied move cannot leave a partially-written row.

---

## 4. What Changed

### Database — `supabase/migrations/039_stage_manager_beneficiary_write_rpcs.sql`

- **Part 1** — role grant: adds `beneficiaries.transfer` to `seed_church_roles()` and
  backfills existing `stage_manager` roles.
- **Part 2** — `create_beneficiary_with_assignment`: permission check
  (`beneficiaries.create`), scope check (`p_stage_id = ANY(get_user_stage_ids())`),
  integrity check (`stage_service_mismatch`), then the 024 insert path with the
  preserved defaults/fallbacks and audit call.
- **Part 3** — `transfer_beneficiary`: permission check (`beneficiaries.transfer`),
  beneficiary/church resolution (`beneficiary_not_found`), source-stage scope check
  (`source_stage_access_denied`), destination scope + integrity checks
  (`destination_stage_access_denied`, `stage_service_mismatch`), then the 024
  close-old/open-new assignment path with `transfer_reason` and audit call.
- **Part 4** — `REVOKE EXECUTE … FROM anon` / `GRANT EXECUTE … TO authenticated` on both
  RPCs (executable by authenticated users only; SECURITY DEFINER owned by `postgres`).

### Application

- `src/features/children/utils/error-mapper.ts` (new) — maps DB RPC error codes and
  app-layer gate keys to `children.errors` i18n keys; unknown messages pass through.
- `src/features/children/actions/child.actions.ts`:
  - `translateChildError`/`translateChildErrorKey` helpers (locale-aware via
    `next-intl/server`).
  - `createChildAction`: gate message localized; RPC errors translated.
  - `updateChildAction`: move branch now requires `BENEFICIARIES_TRANSFER` + source scope
    + destination scope, checked before the UPDATE; both RPC errors translated.
  - `transferChildAction`: permission gate switched to `BENEFICIARIES_TRANSFER`; source
    (current) stage resolved and both scopes enforced; RPC errors translated.
- `src/messages/en.json` / `src/messages/ar.json` — 16 new `children.errors` keys,
  kept in parity (verified by `tests/unit/i18n-parity.test.ts` and `check:i18n`).

### Tests

- `tests/unit/children-error-mapper.test.ts` (new) — every mapped code/key, pass-through
  for unknown messages, and existence in both locale files.
- Live UAT harness (`/tmp/opencode/uat/run_uat.sh` + `seed.sql`) — 22 checks below.

---

## 5. Live UAT Results (PostgREST, local Supabase, migrations 001–039)

Setup: C1 church with service S1 (stages A1, A2, A1B) and S2 (B1, B2); C2 church with
X1. Stage Manager `sm` assigned to **A1 + A1B**. Admin `admin` church-wide. Servant
`servant`. Password `UatTest123!`.

### Stage Manager write matrix (12/12 PASS)

| # | Action | Expected | Result |
|---|--------|----------|--------|
| 1 | create in A1 (in scope) | uuid | PASS |
| 2 | create in A2 (out of scope) | `stage_access_denied` | PASS |
| 3 | create with C2 stage | `stage_not_found` | PASS |
| 4 | create mismatched (service,stage) | `stage_service_mismatch` | PASS |
| 5 | servant create | `not_authorized` | PASS |
| 6 | transfer A1→A1 no-op | OK | PASS |
| 7 | transfer A1→A2 (dest out of scope) | `destination_stage_access_denied` | PASS |
| 8 | transfer A2→A1 (source out of scope) | `source_stage_access_denied` | PASS |
| 9 | transfer A2→A2 (all out of scope) | `source_stage_access_denied` | PASS |
| 10 | transfer C2 child | `beneficiary_not_found` | PASS |
| 11 | transfer A1→A1B (both in scope) | OK (real move) | PASS |
| 12 | servant transfer | `not_authorized` | PASS |

### Admin matrix — church-wide, unchanged (5/5 PASS)

| # | Action | Expected | Result |
|---|--------|----------|--------|
| 13 | create in A1 | uuid | PASS |
| 14 | create in A2 | uuid | PASS |
| 15 | create mismatched | `stage_service_mismatch` | PASS |
| 16 | transfer A2→A1 | OK | PASS |
| 17 | transfer A2→A1B | OK | PASS |

### Read-scope regression (5/5 PASS)

| # | Check | Result |
|---|-------|--------|
| 18 | SM `get_stage_manager_stage_ids()` = [A1, A1B] | PASS |
| 19 | SM `get_user_stage_ids()` = [A1, A1B] (038 read plumbing) | PASS |
| 20 | Admin `get_stage_manager_stage_ids()` = all 7 C1 stages | PASS |
| 21 | SM `get_dashboard_trends([A1,A1B])` | PASS |
| 22 | SM `get_stage_reports(...)` | PASS |

Audit rows verified: `create | beneficiary_assignment` and `transfer | beneficiary`
rows carry exactly the 024 `{service_id, stage_id}` old/new shapes; `beneficiaries` /
`beneficiary_assignments` rows continue to be auto-audited by the existing triggers.

**Note on read verification:** this local stack's base schema grants **no table-level
privileges** to `authenticated`/`service_role` (pre-existing; visible across every table),
so direct table reads via PostgREST return `42501 permission denied`. This is unrelated to
039 (writes are only possible through the SECURITY DEFINER RPCs). Read scope is therefore
verified through the SECURITY DEFINER RPCs that back the 038 reads; the application's
read path (`listChildren`/`getChildById` with `stageIds` filtering) is unchanged by 039.

---

## 6. Validation Gates

| Gate | Result |
|------|--------|
| `npm run typecheck` | PASS |
| `npm run test` (59 tests incl. new mapper tests) | PASS |
| `npm run lint` | PASS (0 errors; pre-existing warnings only) |
| `npm run check:i18n` (en:1268 / ar:1268, parity OK) | PASS |
| `npm run build` | PASS |
| Live UAT | 22/22 PASS |

---

## 7. Rollback

Revert the commit that introduced `039_stage_manager_beneficiary_write_rpcs.sql`; the
previous migration state is restored on the next `supabase db reset` (or by dropping the
two functions and the `beneficiaries.transfer` → `stage_manager` backfill rows). The RPCs
revert to the church-wide 024 behavior. App-layer changes revert to the previous gate
messages; no migration depends on the new RPC signatures.

---

## 8. Related Documents

- `supabase/migrations/039_stage_manager_beneficiary_write_rpcs.sql`
- `supabase/migrations/024_p0_beneficiary_assignment_rpcs.sql` (baseline behavior preserved)
- `supabase/migrations/036_role_matrix_stage_manager.sql` (`seed_church_roles` base)
- `supabase/migrations/038_stage_manager_scope_and_reports.sql` (`get_user_stage_ids`,
  dashboard/reports RPCs)
- `STAGE_MANAGER_ARCHITECTURE_AUDIT.md`, `STAGE_MANAGER_IMPLEMENTATION_PLAN.md`
