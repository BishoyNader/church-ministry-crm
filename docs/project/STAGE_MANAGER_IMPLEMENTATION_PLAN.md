# Stage Manager — Implementation Plan

**Project:** Church Ministry CRM
**Branch:** `feature/role-hierarchy-stage-manager`
**Plan date:** 2026-08-07
**Status:** Proposed — awaiting approval before any migration/RLS/UI change

This plan remediates every finding in
`STAGE_MANAGER_ARCHITECTURE_AUDIT.md` (F1–F11). It intentionally does **not**
weaken RLS, bypass tenant isolation, or use the service role in the frontend.
All new write/read paths follow the existing SECURITY DEFINER RPC convention
(034/035/037): `auth.uid()` guards, `search_path = public, auth`, REVOKE/GRANT
lockdown.

---

## 0. Decisions needed before implementation

| Decision | Options | Recommendation |
|---|---|---|
| D1 — Read scoping model | (a) DB-enforced via new RLS policies; (b) server-action-enforced via scope resolution; (c) hybrid | **(b) server-side scope resolution** — RLS policy rewrites touch every tenant table and risk regressions; server actions already exist as the enforcement chokepoint. |
| D2 — Reports scope | (a) filter existing service church-wide; (b) new `get_stage_reports` SECURITY DEFINER RPC | **(b)** keeps enforcement in the DB (037 pattern), no client-trusted stage filter. |
| D3 — `reports.export` for SM | grant or not | Keep **not granted** (matches requirement "view stage reports"); revisit later. |
| D4 — `admin` full-scope fix (F7) | (a) leave as-is; (b) treat `admin` as church-wide in `get_user_stage_ids()` | **(b)** align RLS write scope with 037's `user_is_admin` branch (admin = church-wide); stage_manager = assignment-scoped. Small, safe change. |
| D5 — Follow-up scope | (a) join via `beneficiary_assignments`; (b) re-add `followups.stage_id` | **(a)** join (037 pattern) — no schema/trigger change, no backfill risk. |

---

## 1. Migration plan

### M1 — `036_role_matrix_stage_manager.sql` (already drafted — finalize + merge)

Review before merge:

1. **Fix the incorrect comment** (F1): replace the `user_has_stage_access()`
   reference with `get_user_stage_ids()` / `servant_stage_assignments`.
2. Confirm the Stage Manager permission set (audit §3.2) with product owner per
   D1–D3.
3. Keep the admin-permission backfill (PART 3a) — it is a correctness fix for the
   existing `admin` role, additive and idempotent.
4. Keep `ALTER TYPE user_role_type ADD VALUE IF NOT EXISTS 'stage_manager'`
   (036:29) — idempotent.

### M2 — NEW `038_stage_scope_helpers.sql`

No RLS rewrites (per D1). Additives only:

1. **`get_stage_manager_stage_ids()`** — church + role-aware scope helper:
   `super_admin`/`admin` → all active stages; `stage_manager`/`servant` → their
   active `servant_stage_assignments` rows. (Consolidates F4/D4 into one place;
   mirrors 022 but adds the admin rule.)
2. **`get_stage_reports(p_stage_ids uuid[] DEFAULT NULL) RETURNS jsonb`**
   (SECURITY DEFINER) — port of the reports module's aggregations
   (`reports.service.ts:90-331`) into SQL, scoped exactly like 037:
   - compute `v_scope` from `get_stage_manager_stage_ids()` for non-super-admin
     callers;
   - defensive `INTERSECT` with caller-supplied `p_stage_ids`;
   - buckets: attendance rate, monthly/yearly trends, stage comparison, servant
     attendance, beneficiary attendance, follow-up completion — all filtered by
     `v_scope` (follow-ups via `beneficiary_assignments`, D5);
   - `REVOKE ... FROM PUBLIC, anon, service_role; GRANT EXECUTE TO authenticated;`
3. **(D4) Update `get_user_stage_ids()` / `get_user_class_ids()` / `get_user_service_ids()`**
   (022) so `admin` returns full church scope, matching 037's `user_is_admin`
   branch. `CREATE OR REPLACE` — backwards-compatible for all other roles.
4. **Optional hardening (F9):** extend `attendance_records` INSERT policy WITH
   CHECK with `session_id IN (SELECT id FROM attendance_sessions WHERE stage_id =
   ANY(get_user_stage_ids()))` so records can only be attached to in-scope
   sessions. (Small; review before including — it also changes the existing
   servant path semantics.)

### M3 — (deferred / optional) `followups.stage_id`

Per D5, not needed. Revisit only if the join proves too slow for stage-manager
follow-up lists (add an index on `beneficiary_assignments(beneficiary_id,
is_current, stage_id)` instead — 014 already indexes `(church_id, stage_id,
is_current)`).

---

## 2. Permission / role plan (no schema changes beyond M1/M2)

| Role | Changes |
|---|---|
| `stage_manager` | Permissions per 036 as approved (audit §3.2). Scope enforced server-side (new helper) + RPC. |
| `admin` | 036 PART 3a fixes retained. Full church scope in scope helpers (D4). |
| `super_admin` | Unchanged (church-wide). |
| `servant` | Unchanged. |
| `platform_owner` | Unchanged (no church-data permissions). |

Provisioning: `create_church_user` (034) already accepts `role_ids` + `stage_ids`
— no change needed to onboard Stage Managers. The users UI already lists
`stage_manager` in the role filter (`user-list-page.tsx:44`).

---

## 3. UI / server-action changes

### 3.1 Server-side scope resolution (new)

Create `src/features/rbac/utils/stage-scope.ts` (server-only):

- `getActorStageScope()` → calls `get_stage_manager_stage_ids()` RPC (or derives
  from RLS-safe reads), returns `Set<string>`.
- `assertStageInScope(stageIds, scope)` — used by every stage-parameterized action
  to reject out-of-scope stage ids (F3).

### 3.2 Feature-by-feature

| Area | Change |
|---|---|
| **Reports** (`reports.actions.ts`, `reports.service.ts`) | For non-super-admin actors: call `get_stage_reports(...)` RPC (M2) instead of the church-wide service; keep current UI filters but **server-enforce** `stageId` ∩ scope (F4, F3). |
| **Dashboard** (`dashboard.service.ts`) | Scope the KPI `head` counts + `nextFollowupsDue` / `recentChildren` lists by the actor's stage set (F5). Trends already scoped via 037. Add `p_stage_ids` passthrough to `get_dashboard_trends` for the stage_manager case if the service wants explicit scope. |
| **Children** (`child.service.ts`) | Default `filters.stage_id` to the actor's scope set when the actor is stage-scoped; validate supplied `stageId` against scope (F3). |
| **Attendance** (children service upserts) | Validate `stage_id`/`class_id` in scope before upsert; RLS already backstops (F9 via M2-4). |
| **Follow-ups** (`child.service.ts:590-642`) | Filter by current `beneficiary_assignments.stage_id` ∈ scope for stage-scoped actors (D5/F6). |
| **Servants** (`servant.actions.ts`, `servant-list-page.tsx`) | Add stage filter restricted to actor scope; default it for stage_manager (F3). |
| **Stages page** (`stage-management-page.tsx`) | For stage-scoped actors: show only assigned stages; hide create/edit/delete/assign controls (read-only). Services/classes pages: same treatment (F8). |
| **Reports page filter options** | Restrict the stage dropdown to the actor's scope. |
| **Dashboard scope notice** | Already present (`dashboard-page.tsx:33-38`); keep. |

### 3.3 Navigation

No new routes. The sidebar's permission gates (app-shell.tsx:19-38) already hide
the out-of-scope items. Add in-page role/scope awareness (3.2) so visible pages do
not render unusable controls.

### 3.4 i18n

Add keys (both `en.json` and `ar.json`, keeping 100% parity — see
`I18N_AUDIT_REPORT.md`):

- `stages.scope.viewAssignedOnly` / `stages.scope.title` (stage-scoped empty state)
- `reports.scope.notice`
- `children.filters.myStages`
- `servants.filters.myStages`
- Role label reuse: `users.roleFilter.stageManager` exists; add
  `rbac.roles.stageManager` if a role badge/label is needed outside the filter.

---

## 4. Testing & verification

1. **DB:** apply M1+M2 on a staging DB; run the 036/037 verification SQL from the
   migration headers (enum, privilege, scope-intersection checks).
2. **RLS regression:** re-run the 027 V6 matrix (R-1…R-20) to prove no write-path
   regression from M2-3/M2-4.
3. **Stage Manager matrix (new):**
   - SM with assignments → sees only its stages in reports/dashboard/children/
     follow-ups/servants; attendance upserts allowed in-scope only.
   - SM without assignments → empty scope everywhere, no crash, clear empty state.
   - SM passing a foreign `stageId` to any action → rejected server-side.
   - SM cannot access users/settings/audit/churches/approvals/import-export.
4. **Type-check / lint / build:**
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run build
   ```
5. **E2E:** extend `e2e/` (Playwright) with a stage_manager happy-path
   (login → dashboard scope → reports restricted → attendance in assigned stage).

---

## 5. Rollback plan

| Change | Rollback |
|---|---|
| M1 (036) | Restore pre-036 backup. In-place: drop enum value only via rename dance (see 036 header); delete `stage_manager` roles/role_permissions; admin additions are additive and removable by targeted DELETE. |
| M2 (038) | `DROP FUNCTION get_stage_manager_stage_ids()`, `DROP FUNCTION get_stage_reports(uuid[])`; `CREATE OR REPLACE` the 022 scope helpers back to their pre-M2 bodies (or restore backup). All changes are additive/`CREATE OR REPLACE` — no destructive DDL. |
| Server actions | Revert to church-wide queries (git revert of the feature commit). |
| UI | Revert component changes (git revert). |
| i18n | Remove added keys from both files (keep parity). |

Primary rollback in all cases: **restore the pre-sprint database snapshot** (the
project's convention for 021/027/035).

---

## 6. Effort estimate

| Workstream | Tasks | Effort |
|---|---|---|
| M1 finalize + review | Fix 036 comment, confirm permission set | 0.5–1 h |
| M2 SQL (helper + `get_stage_reports`) | Write + verify RPC; D4 scope-helper updates | 1–2 days |
| Server scope resolution + action gates | `stage-scope.ts`, audit/update ~12 actions | 2–3 days |
| Reports/dashboard scoping | RPC wiring + fallback + KPI scoping | 1–2 days |
| Feature UI (children/attendance/follow-ups/servants/stages/services/classes) | Filters, read-only states, empty states | 2–3 days |
| i18n additions (en/ar) | ~8–12 keys × 2 files | 0.5 day |
| Tests (unit + e2e + RLS regression) | Matrix + Playwright | 1–2 days |
| **Total** | | **≈ 8–13 working days (1.5–2.5 weeks)** |

---

## 7. Security impact summary

- **Tenant isolation:** unchanged (all changes intra-church).
- **New attack surface:** `get_stage_reports` RPC — mitigated by `auth.uid()`
  guards, `get_stage_manager_stage_ids()` scope, defensive `INTERSECT`, and
  REVOKE/GRANT lockdown (037 pattern).
- **Over-read closed:** stage_manager reads become stage-scoped (F2/F3/F4).
- **Over-write closed:** attendance records bound to in-scope sessions (F9).
- **Escalation:** none — role sits below `admin`, no self-assignment path exists.
- **Docs:** 036's `user_has_stage_access` reference corrected (F1).

*Approve to begin implementation. Until then no migrations, permissions, or UI
changes are made.*
