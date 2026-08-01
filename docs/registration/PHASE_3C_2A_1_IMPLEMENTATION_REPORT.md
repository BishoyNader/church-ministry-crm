# Phase 3C.2A.1 — Permission System Realignment: Implementation Report

**Status:** IMPLEMENTED
**Date:** 2026-08-01
**Scope:** Replace the pre-021 `PERMISSION_CODES` catalog with the canonical post-021 52-code catalog and rewire every guard, action check, and UI permission check that referenced removed codes.

## Context

Migration `supabase/migrations/021_role_and_permissions.sql` and `docs/database/specifications/CANONICAL_PERMISSION_CATALOG.md` define the authoritative permission catalog (52 codes) after the `children.*` → `beneficiaries.*` rename, removal of legacy `users.*`/`attendance.update`/`events.*`/`documents.*`/`ai.*`/`churches.*`/`auth.*` codes, and addition of `tenants.*`, `servants.*`, `services.*`, `classes.*`, `spiritual.*`, `import.*`, `export.*`, `billing.*`, `subscriptions.*`, `support.*`, `system.*` codes.

The frontend `src/features/rbac/constants/permissions.ts` still contained the legacy 45-code catalog. Because the DB now stores canonical codes, every frontend guard using a removed code was **permanently denied** (e.g. the entire children module was gated on `children.read`, which no longer exists in any role).

## Files Modified

| File | Change |
| --- | --- |
| `src/features/rbac/constants/permissions.ts` | Rewritten to the canonical 52-code catalog; `PermissionCode` is now the canonical union. |
| `src/features/children/actions/child.actions.ts` | `CHILDREN_READ/CREATE/UPDATE/DELETE` → `BENEFICIARIES_*` (11 gates); removed the dead `ATTENDANCE_UPDATE` gate in `batchAttendanceAction`. |
| `src/features/users/actions/user.actions.ts` | `USERS_CREATE` → `SERVANTS_CREATE`; `USERS_DELETE` → `SERVANTS_DELETE`; `USERS_MANAGE` → `SERVANTS_ASSIGN` (×2). |
| `src/features/stages/actions/stage.actions.ts` | `USERS_MANAGE` → `SERVANTS_ASSIGN` (stage assignment gate). |
| `src/app/[locale]/children/page.tsx` | Guard literal `children.read` → `beneficiaries.read`. |
| `src/app/[locale]/children/[childId]/page.tsx` | Guard literal `children.read` → `beneficiaries.read`. |
| `src/features/children/components/child-detail-page.tsx` | Guard literals `children.update`/`children.delete` → `beneficiaries.update`/`beneficiaries.delete`. |
| `src/features/children/components/child-list-page.tsx` | Guard literal `children.create` → `beneficiaries.create`. |
| `src/features/children/components/child-table.tsx` | Guard literals `children.update`/`children.delete` → `beneficiaries.update`/`beneficiaries.delete`. |
| `src/features/stages/components/stage-row.tsx` | Guard literal `users.manage` → `servants.assign`. |
| `src/features/dashboard/components/quick-actions.tsx` | `CHILDREN_CREATE` → `BENEFICIARIES_CREATE`. |

**Deliberately untouched:** `children.detail`, `children.status`, `children.form`, `children.attendance`, `children.delete` in dialogs are **next-intl translation namespaces** (`useTranslations("children.detail")`), not permission codes.

## Codes Removed / Renamed / Added

Removed symbols (no longer exist in the DB catalog):
`USERS_CREATE`, `USERS_DELETE`, `USERS_MANAGE`, `CHILDREN_READ`, `CHILDREN_CREATE`, `CHILDREN_UPDATE`, `CHILDREN_DELETE`, `CHILDREN_EXPORT`, `ATTENDANCE_UPDATE`, `ATTENDANCE_DELETE`, plus the previously cataloged `EVENTS_*`, `DOCUMENTS_*`, `AI_USE`, `AI_MANAGE`, `AUTH_LOGIN`, `AUTH_MANAGE`, `CHURCHES_*`.

Renamed:
- `children.*` → `beneficiaries.*` (`BENEFICIARIES_READ/CREATE/UPDATE/DELETE`).
- Stage/servant assignment gate: `users.manage` → `servants.assign`.

Added symbols to align with the DB: `BENEFICIARIES_TRANSFER`, `ATTENDANCE_EXPORT`, `SERVANTS_READ/CREATE/UPDATE/DELETE/APPROVE/ASSIGN`, `SERVICES_*`, `CLASSES_*`, `SPIRITUAL_READ/CREATE`, `TENANTS_*`, `NOTIFICATIONS_MANAGE`, `REPORTS_EXPORT`, `IMPORT_EXECUTE`, `EXPORT_EXECUTE`, `AUDIT_READ`, `BILLING_READ`, `SUBSCRIPTIONS_MANAGE`, `SUPPORT_MANAGE`, `SYSTEM_AUDIT`, `SYSTEM_METRICS`.

## Permission Count

- **Before:** 45 codes.
- **After:** 52 codes (exactly matches the canonical catalog in `021` / `CANONICAL_PERMISSION_CATALOG.md`).

## Behavior Fixes Enabled by This Change

- Children (beneficiaries) module actions and UI guards are no longer permanently denied; they now resolve against `beneficiaries.*`, which is granted in the DB.
- Batch attendance no longer double-gates on the removed `attendance.update`; it now requires `attendance.create` only.
- Role/stage assignment gates resolve against `servants.assign`; servant creation/deactivation against `servants.create`/`servants.delete`.

## Validation Performed

1. `grep` sweep — no remaining references to removed symbols (`CHILDREN_*`, `USERS_MANAGE`, `USERS_CREATE`, `USERS_DELETE`, `ATTENDANCE_UPDATE`) in `src/`.
2. `grep` sweep — no remaining guard literals `children.*`/`users.manage`/`attendance.update` (translation namespaces excluded by context check).
3. `npm run build` — **PASSED** (full Next.js production build, 26 routes, no type errors).
4. `npm run lint` — only **pre-existing** errors remain (18 errors / 6 warnings), all in files untouched by this task (`child.service.ts`, `user-form.tsx`, dialogs, `.opencode/skills/*`). No new lint issues introduced.

## Remaining Issues / Notes

1. **Role grant depth deferred:** `assignRolesAction`/`assignStagesAction` now gate on `servants.assign` (canonical code). `servants.assign` is granted to `admin`, so the frontend gate no longer enforces super-admin-only for role grants — this was already the design intent and is enforced at the DB layer via RLS; an explicit `super_admin` re-check for role assignment is deferred to 3C.2A.3 (write-path hardening), consistent with the foundations spec.
2. **Unused codes:** several newly added codes (e.g. `BENEFICIARIES_TRANSFER`, `ATTENDANCE_EXPORT`, `SYSTEM_*`, `BILLING_*`, `SUBSCRIPTIONS_*`, `SUPPORT_*`) have no frontend consumers yet; they exist for catalog parity and will be consumed by later phases (3C.2B–3C.2D, billing/settings features).
3. **Pre-existing working-tree changes:** the repo contains unrelated uncommitted changes (registration flows, database types, migration `023`) that predate this task; this report's diff is limited to the files listed above.
4. **Migration 023 untracked** remains the standing blocker for a clean staging deploy (see `PHASE_3C_EXECUTION_READINESS_REVIEW.md`); not in scope here.
