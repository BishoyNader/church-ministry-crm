# Sprint 1 — Platform Owner Administration Enhancement: Church Management

**Project:** Church Ministry CRM
**Branch:** `feature/platform-owner-church-management-enhancement`
**Version:** 1.0
**Date:** 2026-08-06
**Status:** Implemented
**Scope:** Turn the existing Churches module into a full enterprise tenant-management surface for the Platform Owner (PO): enriched list, tabbed detail page, church manager card, four-state church status, statistics, and audit integration. **Out of scope:** Subscription/Billing, AI, mobile.

---

## 1. Audit Report

### 1.1 Already implemented (reuse, do not duplicate)

| Surface | File(s) | Notes |
|---------|---------|-------|
| Church list w/ search, pagination, status filter, activate/deactivate | `components/churches-page.tsx` | Uses `useChurchList`, `useActivateChurch`, `useDeactivateChurch` |
| Create/Edit dialogs | `components/church-form-dialog.tsx`, `schemas/church.schema.ts` | Zod schema + `ChurchFormDialog` |
| Provisioning wizard + admin creation | `components/church-provisioning-wizard.tsx`, `church-admin-creation.tsx`, `church-config-form.tsx`, `church-provisioning-summary.tsx` | Full Phase 2/5 flow (RPC 032–034) |
| Church requests (PO review) | `components/admin-church-requests-page.tsx` | Route `/admin/church-requests` |
| List/detail/stats actions | `actions/church-admin.actions.ts` | `listChurchesAction`, `getChurchAction`, `getChurchStatsAction`, CRUD + activate/deactivate, all audited |
| Admin-client CRUD service | `services/church-admin.service.ts` | `listChurches`, `getChurchById`, `createChurch`, `updateChurch`, `setChurchActive`, `getChurchStats` |
| Read/update gates | `hasPermission(PERMISSION_CODES.TENANTS_READ/UPDATE/CREATE)` | PO bundle (026) grants `tenants.*`, `users.read`, `reports.*`, `audit.read` |
| Nav + routes | `components/layout/app-shell.tsx:33`, `app/[locale]/(app)/admin/churches/page.tsx`, `…/[churchId]/page.tsx` | Nav gated by `tenants.read` |
| Audit writer | `lib/audit.ts` `writeAuditLog` + RPC `write_audit_log` | Church-scoped rows; PO rows carry `church_id = NULL` and actor = PO |
| Reports engine (church-scoped) | `features/reports/services/reports.service.ts:90` `getReportsData(supabase, churchId, filters)` | Signature already accepts an explicit `churchId` → reusable for PO Reports tab |
| Audit engine (church-scoped) | `features/audit/services/audit.service.ts` `getAuditPage` | `churchId` parameter + `profiles` actor join → reusable pattern for PO Audit tab |
| Tab primitive | `components/ui/tabs.tsx` (base-ui) | Pattern: `child-detail-tabs.tsx` |
| Children domain | `beneficiaries` table + `features/children` | "Children" count = `beneficiaries` count (no separate `children` table) |

### 1.2 Partially implemented (must be extended)

| Surface | Gap |
|---------|-----|
| `ChurchFilters.status` | Only `all/active/inactive`; no `suspended`/`disabled` |
| `ChurchListItem` | No manager, counts (users/servants/children/services/stages/classes), last activity, `status` |
| `ChurchDetail` | No manager card data, no tabbed layout, no recent activity / latest audit / attendance % |
| `ChurchStats` | Only 4 counts; missing children/classes counts + attendance rate |
| `churches-page.tsx` | Row is a plain card; no actions menu (View/Edit/Status/Change Manager/View Audit/View Statistics), no quick-stats header, no manager/counts columns |
| `church-detail-page.tsx` | Single info grid; no Overview/Users/Services/Stages/Classes/Reports/Audit/Settings tabs; no manager card; no status control (suspend/disable) |
| Messages (`en.json`/`ar.json`) | Only current list/detail keys; no statuses, manager, tabs, columns, actions |

### 1.3 Missing (must be built)

| Item | Approach |
|------|----------|
| Suspended / Disabled church status | New migration **035** (approved): `churches.status` column (`active/inactive/suspended/disabled`) + backfill from `is_active` + trigger to keep `is_active` in sync |
| Church manager (card + change) | Derived from active `super_admin` grant (`user_roles` + `roles` + `profiles`); new SECURITY DEFINER RPC `change_church_manager` (migration 035) |
| Quick stats on list page | New `getChurchesSummaryAction` → counts by status |
| Per-tab read-only data | New actions `getChurchUsersAction`, `getChurchServicesAction`, `getChurchStagesAction`, `getChurchClassesAction`, `getChurchAuditAction`; Reports tab reuses `reportsService.getReportsData` |
| Actions menu + change-manager dialog | New `ChurchActionsMenu`, `ChurchStatusBadge`, `ChangeChurchManagerDialog`, `ChurchManagerCard`, tab table components |
| en/ar parity | Every new key added to both files |

### 1.4 Reuse opportunities (explicit)

- `tenants.read` / `tenants.update` for all new PO actions — **no new permission codes** (tenant management).
- `reportsService.getReportsData(adminClient, churchId, …)` for the Reports tab — already church-parameterized.
- `audit.service.ts getAuditPage` query shape (join `profiles` for actor name) for the church Audit tab.
- Migration 033/034 privilege pattern (`REVOKE … FROM PUBLIC, anon, authenticated, service_role; GRANT … TO authenticated, service_role`) + internal `user_is_platform_owner() OR user_is_super_admin(church_id)` guard for the new RPC.
- `write_audit_log(church_id, action, entity, id, old, new)` RPC for DB-side audit in `change_church_manager`.
- `components/ui/tabs.tsx`, `dialog.tsx`, `select.tsx`, `badge.tsx`, `skeleton.tsx` primitives.

### 1.5 Security notes

- All PO reads/writes stay on the service-role admin client (PO `church_id = NULL`); DB writes that must be tenant-atomic go through SECURITY DEFINER RPCs. No RLS/RBAC weakening; no new permissive policies; no `churches.*` codes; no service-role in client components.
- New RPC guards on `auth.uid()` and `user_is_platform_owner() OR user_is_super_admin(church_id)`; `change_church_manager` validates the new manager is a user of the target church (`user_not_in_church` otherwise).
- Reset-password / change-manager flows are gated by `tenants.update` (tenant-level administration, matching PO bundle which lacks `users.update`).

---

## 2. Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/035_church_administration.sql` | S1 `churches.status` column + backfill from `is_active`; S1a `sync_church_status()` trigger keeping `is_active` in sync; S2 `change_church_manager(p_church_id, p_new_user_id)` RPC; S3 `deactivate_church_user(p_church_id, p_user_id)` RPC; S4 privilege lockdown (`REVOKE … FROM PUBLIC, anon` + `GRANT EXECUTE TO authenticated, service_role`); verification + rollback comments |
| `src/features/churches/components/church-status-badge.tsx` | `ChurchStatusBadge` — status → Badge variant mapping |
| `src/features/churches/components/church-actions-menu.tsx` | `ChurchActionsMenu` — dropdown (View / Edit / status transitions / Change manager / View audit log), status-aware, tenant-management items inside `PermissionGuard("tenants.update")` |
| `src/features/churches/components/change-church-manager-dialog.tsx` | `ChangeChurchManagerDialog` + self-contained `ManagerPicker` (resets on open, no effect) — lists active users, calls `useChangeChurchManager` |
| `src/features/churches/components/church-manager-card.tsx` | `ChurchManagerCard` — manager identity/last-login/status + Change / Reset password / Deactivate dialogs (`resetChurchManagerPasswordAction`, `deactivateChurchUserAction`) |
| `src/features/churches/components/church-quick-stats.tsx` | `ChurchQuickStats` — 5 status cards (All/Active/Inactive/Suspended/Disabled), clickable filters |
| `src/features/churches/components/church-users-table.tsx` | `ChurchUsersTable` — read-only church-scoped users list w/ search + pagination |
| `src/features/churches/components/church-entity-table.tsx` | `ChurchEntityTable` — shared read-only list for Services/Stages/Classes tabs |
| `src/features/churches/components/church-audit-table.tsx` | `ChurchAuditTable` — church audit trail, `limit` prop for the Overview recent-activity preview |
| `src/features/churches/components/church-reports-tab.tsx` | `ChurchReportsTab` — attendance-rate cards + stage comparison (reuses `getReportsData`) |
| `src/features/churches/components/church-status-confirm-dialog.tsx` | `ChurchStatusConfirmDialog` — confirm dialog choosing activate/deactivate/suspend/disable/reactivate mutation by target status |
| `docs/project/SPRINT1_PLATFORM_OWNER_CHURCH_MANAGEMENT.md` | This report (audit + deliverables) |

## 3. Files Modified

| File | Change |
|------|--------|
| `src/types/database.types.ts` | `churches` Row/Insert/Update gain `status`; `Functions` gain `change_church_manager` + `deactivate_church_user` signatures |
| `src/features/churches/types/church.types.ts` | Rewritten: `ChurchStatus`, `ChurchStatusFilter`, `ChurchManagerInfo`, extended `ChurchListItem` (status, manager, 6 counts, `lastActivityAt`), `ChurchDetail = ChurchListItem`, extended `ChurchStats` (children/classes + attendance rate), `ChurchSummary`, `ChurchUserRow`, `ChurchUsersPageData`, `ChurchAuditEvent`, `ChurchAuditPageData`, `ChurchAdminListRow`, `UpdateChurchInput.status`, `ChurchActionResult` |
| `src/features/churches/services/church-admin.service.ts` | Rewritten: `CHURCH_STATUSES`, `sanitizeSearchTerm`, `normalizePage`, `buildCountsMap` (6 tables), `buildManagersMap` (super_admin grants + profiles), `buildLastActivityMap`; `listChurches` → `{ rows, total }`; `getChurchById` enriched; `setChurchStatus`; `getChurchStats` w/ attendance rate; `getChurchSummary`; `listChurchUsers`; `listChurchEntityRows`; `getChurchAuditPage`; `changeChurchManager`; `deactivateChurchUser` |
| `src/features/churches/actions/church-admin.actions.ts` | Rewritten: `ensureAuthenticated` helper; `setChurchStatusAction` + activate/deactivate/suspend/disable/reactivate wrappers (all audited); `getChurchesSummaryAction`; `getChurchUsersAction`; `getChurchServicesAction`/`getChurchStagesAction`/`getChurchClassesAction` (via `getChurchEntityListAction`); `getChurchReportsAction` (reuses `getReportsData`); `getChurchAuditAction`; `changeChurchManagerAction`; `deactivateChurchUserAction`; `resetChurchManagerPasswordAction` (`auth.admin.updateUserById` + audit with actor id) |
| `src/features/churches/hooks/use-churches.ts` | Rewritten: `CHURCHES_QUERY_KEYS` (summary/users/services/stages/classes/audit/reports) + corresponding hooks + mutations for all status actions, change/deactivate manager, reset password |
| `src/features/churches/schemas/church.schema.ts` | `updateChurchSchema` gains `status: z.enum(["active","inactive","suspended","disabled"]).optional()` |
| `src/features/churches/index.ts` | Barrel exports for all new actions, hooks, types, components |
| `src/features/churches/components/churches-page.tsx` | Rewritten: `ChurchQuickStats` header, 4-state status filter, rows show manager + 6 counts + status + created/last activity, `ChurchActionsMenu` wired to edit/status/manager dialogs + detail navigation |
| `src/features/churches/components/church-detail-page.tsx` | Rewritten: 8 tabs (Overview/Users/Services/Stages/Classes/Reports/Audit/Settings), manager card, stat grid w/ attendance %, latest audit event + recent activity, status control buttons, edit dialog |
| `src/app/[locale]/(app)/admin/churches/[churchId]/page.tsx` | Reads `?tab=` search param → `initialTab` |
| `src/messages/en.json` / `src/messages/ar.json` | Churches section: statuses, actions, counts, manager, users, services/stages/classes, audit, reports, `statusDialog.*`, `tabs.*`, errors (`passwordTooShort`, `managerNotFound`, `resetPasswordFailed`); identical key trees (parity verified) |

## 4. Security Review

- **No new permission codes / no RLS/RBAC weakening.** All new server actions run `ensureAuthenticated` + `hasPermission(TENANTS_READ|UPDATE|CREATE)` and stay on the service-role admin client; client components use only `PermissionGuard` with existing `tenants.*` codes.
- **DB-side atomic operations are SECURITY DEFINER RPCs** (`change_church_manager`, `deactivate_church_user`) following the 033/034 pattern: `REVOKE EXECUTE FROM PUBLIC, anon` (and `authenticated`, `service_role`) then `GRANT EXECUTE TO authenticated, service_role`. Internal guard: `user_is_platform_owner() OR user_is_super_admin(p_church_id)`.
- **`change_church_manager`** validates the new user is a member of the target church, refuses to end the last active `super_admin` grant, ends the old manager's grant, reactivates/inserts the new manager grant, and writes two audited rows (church `update` + role `assign`).
- **`deactivate_church_user`** refuses `cannot_disable_last_manager`, sets the profile inactive, ends all grants, and audits.
- **Status transitions** (`activate/deactivate/suspend/disable/reactivate`) all funnel through one audited path (`setChurchStatusAction` → `setChurchStatus`), writing `audit_logs` with `church_id` + actor.
- **Password reset** uses `auth.admin.updateUserById` (service role, server-only) and writes an audit entry with the real actor id; flow gated by `tenants.update`.
- No secrets logged; no service-role keys reach client components.

## 5. Validation Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Pass — 0 errors |
| `npm run lint` | 0 errors, 7 warnings (all pre-existing — provisioning wizard, spiritual journal, user-form; none in new code) |
| `npm run build` | Pass — production build succeeds, all routes emitted |
| en/ar message parity | Identical key trees in `churches` namespace (script-checked) |
| Migration 035 | Not yet applied to a live database; RPC signatures type-checked via `database.types.ts` (verified at runtime before use) |

## 6. Rollback Plan

- **Code:** `git revert` the Sprint-1 commits (or `git checkout` the pre-Sprint-1 tree). The old flat list/detail pages are preserved in history.
- **Migration 035** (additive only — no destructive changes to existing tables/functions):
  ```sql
  DROP TRIGGER IF EXISTS trg_churches_sync_status ON churches;
  DROP FUNCTION IF EXISTS sync_church_status();
  DROP FUNCTION IF EXISTS change_church_manager(uuid, uuid);
  DROP FUNCTION IF EXISTS deactivate_church_user(uuid, uuid);
  ALTER TABLE churches DROP COLUMN IF EXISTS status;
  ```
- No pre-existing table, column, or function was altered in place; 035 only adds the `status` column (with backfill) and new functions.
