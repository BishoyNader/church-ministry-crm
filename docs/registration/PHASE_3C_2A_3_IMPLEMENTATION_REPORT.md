# Phase 3C.2A.3 — User Roles Write Path Hardening: Implementation Report

**Status:** IMPLEMENTED
**Date:** 2026-08-01
**Scope:** Every `user_roles` write path in the app, role assignment/removal logic, reactivation-first behavior, and admin/service-role write enforcement. Compatibility with Migration 023 (SELECT-only `tenant_isolation`, partial unique index `uq_user_roles_active`, reactivation-first re-approval).

## Context

Migration 023 made the temporal role model canonical:

- `user_roles.tenant_isolation` → **SELECT-only** (023:119–121). After 023, the only write grants on `user_roles` are `super_admin_all` (022:371), the SECURITY DEFINER RPCs, and the service-role admin client.
- Non-partial `UNIQUE (church_id, user_id, role_id)` replaced by partial unique index **`uq_user_roles_active` on `(church_id, user_id, role_id) WHERE end_date IS NULL`** (023:181–185).
- Reactivation-first re-approval is the canonical re-grant strategy (`approve_servant`, 023:520–537).

The pre-hardening `assignRoles` (DELETE + INSERT via the session client) was incompatible on three axes:
1. **C-1 self-escalation risk** — the actor gate was `servants.assign`, which Migration 021 grants to **both** `admin` and `super_admin`. An admin (not super_admin) could drive role writes, and the only RLS write policy post-023 (`super_admin_all`) would silently mask the denied DELETE/INSERT (0 rows affected, no error).
2. **A3 reactivation edge** — `.delete()` destroyed history; a re-grant created a new active row, and there was no archival (`end_date`) or reactivation path. This conflicts with `uq_user_roles_active`'s active-only uniqueness model (archived rows must coexist with historical records).
3. **Policy incompatibility** — the session-client DELETE/INSERT is denied by the SELECT-only policy for any non-super-admin, so the write was effectively broken or silently no-op'ing under 023.

## Files Modified

| File | Change |
| --- | --- |
| `src/features/users/services/user.service.ts` | **REWRITE** `assignRoles` → reactivation-first, service-role admin client, super_admin gate, church-scoped role validation, last-super-admin guard. Added shared helpers: `syncRoleGrants`, `isSuperAdminOfChurch`, `getSuperAdminRoleId`, `countActiveSuperAdmins`, `validateRolesInChurch`, `toDateOnly`. `createUser` role grant now routes through `syncRoleGrants` + church validation. `listUsers`/`getUserById` role reads filtered to active grants (`end_date IS NULL`). |
| `src/features/users/actions/user.actions.ts` | `assignRolesAction` + `createUserAction`: explicit **super_admin** gate (canonical — admins cannot grant roles, despite holding `servants.assign`). `deactivateUserAction` super-admin count filtered to active grants. |
| `src/features/rbac/services/rbac.service.ts` | `loadCurrentUserRbac` (:31) and `getRolesByUser` (:203) filtered to active grants, so an end-dated (archived) grant **stops conferring permissions**. |
| `src/features/auth/services/auth.service.ts` | **UNCHANGED** (out of scope — registration UI; removed with `signUpWithEmail` in 3C.2B). Its `user_roles` INSERT uses the service-role admin client (approved privileged path). |

No new files added; no schema/migration changes (023 already provides the DDL).

## Old Write Model (pre-hardening)

```
assignRolesAction  ── hasPermission(servants.assign)          [super_admin AND admin]
  └─ assignRoles(supabase session client)
       ├─ profiles SELECT (session, RLS)
       ├─ user_roles DELETE (session, RLS)     ✗ destroys history
       └─ user_roles INSERT (session, RLS)     ✗ denied for non-super-admin post-023
```

- **Transport:** session client (RLS subject). Post-023 the DELETE/INSERT is **denied** for anyone except super_admin (super_admin_all), and denial is silent (0 rows).
- **Removal model:** hard DELETE. No `end_date` archival, no reactivation, no historical records.
- **Gate:** `servants.assign` — held by admin **and** super_admin → admins could reach a role-grant write surface.
- **Reads:** `getUserById`/`listUsers`/`rbac.service` returned all grants (active + archived); permission resolution never excluded archived grants.

## New Write Model (canonical, post-hardening)

```
assignRolesAction  ── hasPermission(servants.assign) + explicit super_admin check (active super_admin grant)
  └─ assignRoles
       ├─ profiles SELECT (session)                         [actor's church scope]
       ├─ isSuperAdminOfChurch(admin, assignedBy, church)   [service-role; defense-in-depth]
       ├─ validateRolesInChurch(admin, church, roleIds)     [no cross-church role ids]
       ├─ last-super-admin guard                            [cannot orphan the church]
       └─ syncRoleGrants(admin, church, userId, roleIds, assignedBy)
            ├─ SELECT existing grants (admin)
            ├─ UPDATE ... SET end_date = CURRENT_DATE       [archive dropped roles]
            ├─ UPDATE ... SET end_date = NULL               [reactivate archived grants]
            └─ INSERT only for roleIds with no existing row [partial-unique safe]
```

`syncRoleGrants` per-role decision table:

| Existing grant for `(church,user,role)` | In target set? | Action |
| --- | --- | --- |
| active (`end_date IS NULL`) | yes | no-op |
| active | no | **archive** `end_date = CURRENT_DATE` |
| archived (`end_date IS NOT NULL`) | yes | **reactivate** `end_date = NULL` |
| archived | no | no-op (historical record kept) |
| none | yes | **insert** `{church_id, user_id, role_id, assigned_by, start_date}` |

**Key properties:**
- **No `DELETE` on `user_roles` anywhere in `src/`.** Removals are end-date archives; history is preserved.
- **All four write sites use the service-role admin client** (RLS-bypassed, approved privileged path): `auth.service.ts:180` (out-of-scope signup, removed in 3C.2B), `user.service.ts:387` (insert), `:362–363` (archive), `:376–377` (reactivate).
- **Reactivation never collides with `uq_user_roles_active`:** a re-grant flips `end_date` to `NULL` on the existing archived row instead of inserting a second active row. Insert only happens when no row exists at all. If a theoretical duplicate archived pair ever coexisted, reactivating both hits the unique index and aborts **fail-closed** (matches the 023 F-004 documented behavior).
- **Start dates are canonical date-only** (`YYYY-MM-DD`) via `toDateOnly`, consistent with `auth.service.ts` and the 023 RPCs (`CURRENT_DATE`).

## Security Impact

| Risk | Before | After |
| --- | --- | --- |
| **C-1 self-escalation** — non-super-admin writing `user_roles` | Admin held `servants.assign` and reached the write surface (silently 0-affected post-023, or allowed pre-023) | Role grants require an **active super_admin grant** — enforced twice: in the action (session-based) and in the service (service-role, authoritative). Admins are hard-denied. |
| **A3 reactivation edge** | DELETE+INSERT destroyed archives; re-grant could create duplicate-active state under `uq_user_roles_active` | Canonical reactivation-first; `uq_user_roles_active` invariant preserved (reactivate not insert). |
| **Cross-church role injection** | `roleIds` were never validated against the target church | `validateRolesInChurch` rejects any role not owned by the target church. |
| **Church lockout** | `assignRoles` could strip the final active super_admin | Last-super-admin guard mirrors `deactivateUserAction`; removal of the last active super_admin is rejected. |
| **Archived roles still granting permissions** | RBAC resolution included archived grants | `rbac.service` (current-user permissions + `getRolesByUser`) reads **active grants only**; an archived role immediately stops conferring permissions. |
| **UI showing stale roles** | `listUsers`/`getUserById` returned archived grants | Both read active grants only; assignment diff and audit `oldRoleIds` are now temporally correct. |

## Compatibility with Migration 023

- **SELECT-only `tenant_isolation` (023:119–121):** no `user_roles` write flows through the session client anymore — only SELECTs (tenant_isolation SELECT, `own_read`, `admin_read`, `super_admin_all` all preserved). All writes are service-role (admin client), matching 023's documented write paths (`super_admin_all` + RPCs + service-role admin client).
- **Partial unique index `uq_user_roles_active` (023:183–185):** the reactivation-first diff only ever maintains **at most one active row** per `(church_id, user_id, role_id)`. Inserts only target role/contexts with no existing row. Archive/insert boundaries are exactly the index's `WHERE end_date IS NULL` predicate.
- **Historical role records / end_date archival (020/023):** removals set `end_date = CURRENT_DATE` and never delete; historical rows are retained and excluded from active-role resolution (matches `get_my_access_state`, 023:370–371, active-only join).
- **Future policy model:** all writes funnel through the two approved privileged transports (service-role admin client now; SECURITY DEFINER RPCs in 3C.2A.4/3C.2D). `assignRolesAction`'s obsolete `USERS_MANAGE` gate was already replaced (3C.2A.1) with `SERVANTS_ASSIGN` + the explicit super_admin gate added here. No session-client write path remains to be blocked by future policy tightening.

## Validation Results

1. **TypeScript:** `npx tsc --noEmit` → **PASSED** (no errors).
2. **Build:** `npm run build` → **PASSED** (Next.js production build, all 26 routes).
3. **Lint:** `npm run lint` → **no issues in any touched file**. The 18 errors / 6 warnings reported are all **pre-existing** in untouched files (`child.service.ts`, dialog components, `.opencode/skills/*`), unchanged from the 3C.2A.2 report.
4. **No DELETE-based role replacement logic:** `grep -rn 'from("user_roles")' src/ | grep -i delete` → **zero matches**. No `.delete()` exists on `user_roles` in `src/`.
5. **No session-client write on `user_roles`:** every `insert`/`update` on `user_roles` resolves to the `admin` (service-role) client — `user.service.ts:387, 362–363, 376–377` and `auth.service.ts:180`. All other `user_roles` call sites are SELECTs.
6. **Reactivation-first grep audit:** `syncRoleGrants` is the single grant-sync routine; `assignRoles` and `createUser` both route through it. Archive = `SET end_date = CURRENT_DATE`; reactivate = `SET end_date = NULL`; no duplicate-active insert path.

## Remaining Blockers / Deferred

1. **`auth.service.ts` `signUpWithEmail` super_admin self-grant** — intentionally **not** touched (registration UI is out of scope). It uses the service-role admin client and is scheduled for removal with `signUpWithEmail` in 3C.2B, which replaces self-grant with the pending-servant / approval-provisioning flow.
2. **RPC wrappers** (`approve_servant`, `reject_servant`, etc.) — out of scope (3C.2A.4); they are the remaining 023 write path not yet consumed by the app.
3. **`deactivateUser` does not archive roles** — deactivation sets `profiles.is_active = false` (blocked at sign-in) but leaves role grants active. Behavioral decision deferred; sign-in gate is the existing access control.
4. **`createUser` orphan cleanup on mid-flow failure** — pre-existing: if a role-grant write fails after auth-user/profile creation, cleanup is incomplete (only church-scope validation failures delete the auth user). Unchanged, out of scope.
5. **`database.types.ts` regeneration** — still pending 023's apply to staging (3C.2A.4 D20); current types already include the 020 temporal columns used here.
