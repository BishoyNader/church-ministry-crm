# PHASE 4 — Platform Owner User Management Improvements

Status: DONE — see PHASE_4_PLATFORM_OWNER_USER_MANAGEMENT_REPORT.md for the implementation report.

## Objective

Fix platform-owner (PO) church-user management, enforce the **profile + servant + role-assignment invariant** on every user creation path, complete the user-creation UX (mandatory role selection), and add bulk Excel/CSV user import reusing the existing beneficiary import/export architecture.

PO workflow (unchanged target): **Create Church → Create Church Super Admin → Church Super Admin manages users.** This phase additionally lets the PO add users (incl. super admins/admins/servants) to existing churches directly.

## Audit findings (code-verified)

### Root causes — why PO cannot create church users today

1. **Actor gate breaks for PO** — `createUserAction` (user.actions.ts:174) calls
   `getUserById(supabase, profile.church_id=NULL, user.id)`. `getUserById`
   (user.service.ts:104-105) filters `.eq("church_id", null)`, which never matches in
   PostgREST (`= NULL`), so the actor detail is always "User not found." → the
   super-admin gate returns "Only a super admin can create users."
2. **PO lacks the create permission** — the 026 PO bundle grants `users.read` but NOT
   `servants.create` / `users.update` / `import.execute` (026_platform_owner_bootstrap.sql:108-114).
3. **RLS blocks every session-client read for PO** — `profiles`, `servants`,
   `servant_stage_assignments`, `user_roles` have **no `platform_owner_*` policy**
   (022); the only PO `roles` policy is `church_id IS NULL` (028:307). `get_user_church_id()`
   returns NULL for the PO, so all church-scoped `.eq("church_id", churchId)` reads return
   empty/error. PO data access must flow through SECURITY DEFINER RPCs (or admin client,
   matching the shipped `listChurchesAction` precedent, church-admin.actions.ts:52).
4. **Create-mode roles/stages never load** — `UserForm` create mode has `userId` undefined →
   `churchId = null` → `useRoles`/`useStages` are `enabled: !!churchId` (use-users.ts:142,157),
   so the role/stage checkboxes never render; with `roleIds.min(1)` the create form is
   effectively unusable.

### Invariant violations

5. **`user.service.createUser` does not create a `servants` row** (user.service.ts:143-238:
   profile + roles + stages only). The proxy gate (proxy.ts:84-90) requires
   `get_my_access_state().servant_approval_status = 'approved'` AND `has_roles`, so any user
   created through this path is redirected to `/pending-approval` forever.
   (`registerExistingChurchUser` is correct by design: pending servant + approval flow grants
   roles later; 032/023 RPCs are correct: profile + approved servant + roles.)

### All user-creation locations (inventory)

| Site | profile | servant | roles | gate |
|---|---|---|---|---|
| `user.service.createUser` (super-admin path) | ✅ | ❌ | ✅ | super-admin (TS) |
| `registerExistingChurchUser` (signup) | ✅ | ✅ pending | ❌ | public / approval later |
| `approve_church_request` RPC (023) | ✅ | ✅ approved | ✅ super_admin | PO |
| `provision_church` RPC (032) | ✅ | ✅ approved | ✅ | PO (service_role) |
| `create_church_super_admin` RPC (032) | ✅ | ✅ approved | ✅ super_admin | PO |
| `bootstrap_platform_owner` RPC (026) | ✅ | ✅ approved | ✅ global | service_role only |

## Design decisions

- **D1 — One DB-enforced creation RPC.** New SECURITY DEFINER RPC `create_church_user`
  (migration 034) creates profile + approved servant + role grants + optional stage
  assignments atomically. Guards inside the RPC: `authenticated`; caller is
  `user_is_platform_owner()` OR `user_is_super_admin(p_church_id)`; church active;
  auth user exists + email matches; all role ids belong to the church; all stage ids belong
  to the church. Grants follow the 033 pattern (authenticated + service_role; call via
  **session client**; admin client reserved for `auth.admin.createUser` + rollback).
- **D2 — Route both super-admin and PO creation through the RPC.** Refactor
  `user.service.createUser` to (a) create the auth user via admin client, (b) call
  `create_church_user` via session client, (c) delete the auth user on RPC failure. This
  removes the duplicated TS insert logic and enforces the invariant in one place.
- **D3 — PO list/roles/stages reads.** `listUsersAction` / `getUserAction` /
  `getRolesAction` / `getStagesAction` accept an explicit `churchId`. PO callers use the
  **admin client** (mirrors `listChurchesAction`); super-admin callers keep the session client
  (RLS-safe). No new read RPCs needed.
- **D4 — PO church selector on the users page.** When the actor is PO (church_id NULL), show a
  church selector (populated from `listChurchesAction`) that scopes list/create/roles/stages/
  import. Super admins see no selector (unchanged).
- **D5 — Bulk user import as a users-feature panel.** Reuse the import-export parse/envelope
  utilities but implement user-specific preview + execution inside the users feature (needs a
  church context, so it does not belong on the generic import-export page). Template download
  (CSV/XLSX with headers + example row). Per-row: auth createUser (admin) → RPC via session
  client; failures captured per row (duplicate email, invalid role, rpc failure). Audit one
  `import` row per batch.
- **D6 — No new DB permissions.** Gate on existing codes: super-admin path keeps
  `SERVANTS_CREATE`; PO path gates on `hasAnyPermission([USERS_READ, TENANTS_READ])` at the
  action layer; the RPC's internal `user_is_platform_owner()`/`user_is_super_admin()` guard is
  the enforcement boundary. (`import.execute` is NOT granted to PO; user import is gated by the
  action layer, not the generic import permission.)

## Migration 034 — `create_church_user`

```sql
CREATE OR REPLACE FUNCTION create_church_user(
  p_church_id uuid,
  p_auth_user_id uuid,
  p_full_name_ar text,
  p_full_name_en text DEFAULT NULL,
  p_email text,
  p_phone text DEFAULT NULL,
  p_preferred_locale text DEFAULT 'ar',
  p_role_ids uuid[],
  p_stage_ids uuid[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
```

Guards (each `RAISE EXCEPTION '<code>'`):
- `auth.uid()` NULL → `not_authenticated`
- `NOT (user_is_platform_owner() OR user_is_super_admin(p_church_id))` → `not_allowed`
- required params → `church_id_required` / `auth_user_id_required` / `full_name_ar_required` / `email_required`
- church missing/deleted/inactive → `church_not_found`
- `auth.users` row missing or email mismatch → `auth_user_not_found` / `auth_user_email_mismatch`
- `p_role_ids` empty → `roles_required`; any role not in church → `role_not_in_church`
- any stage not in church → `stage_not_in_church`

Body (mirrors 032 `create_church_super_admin` + 023 `approve_servant` + TS `syncRoleGrants`):
1. **profile** upsert (id, church_id, email lowercase, names, phone, preferred_locale).
2. **servant** upsert → `approval_status = 'approved'`, `approved_by = auth.uid()`, `approved_at = now()`, `deleted_at = NULL`.
3. **role grants** reactivation-first: archive rows with `end_date IS NULL` not in target; re-open rows in target that are ended; insert missing (`assigned_by = auth.uid()`, `start_date = CURRENT_DATE`). Target roles validated in step "Guards".
4. **stage assignments** (if `p_stage_ids`): deactivate active rows for the user, then insert new rows with `service_id` resolved from `stages` (validated in-church).
5. **notification** via `send_notification(p_church_id, user, 'approval_result', …)`.
6. **audit** via `write_audit_log`: `('create','user',…)` and `('create','servant',{'approval_status':'approved'})`.
7. Return `p_auth_user_id`.

Privileges (033 pattern):
```sql
REVOKE ALL ON FUNCTION create_church_user(...) FROM PUBLIC, anon, authenticated, service_role;
GRANT  EXECUTE ON FUNCTION create_church_user(...) TO authenticated, service_role;
```

New registration error codes to add to `RegistrationErrorCode` (registration.ts):
`church_id_required`, `auth_user_id_required`, `full_name_ar_required`, `roles_required`,
`role_not_in_church`, `stage_not_in_church`, `church_not_found`, `not_allowed`.

## Files

### Create
- `supabase/migrations/034_church_user_management.sql` — RPC + grants + verification/rollback notes.
- `src/features/users/schemas/user-import.schema.ts` — row schema (rowNumber, email, password,
  fullNameAr, fullNameEn, phone, role, stage), import preview/execute schemas, template format enum.
- `src/features/users/types/user-import.types.ts` — row/preview/summary/failure types (mirror
  `import-export.types.ts`).
- `src/features/users/services/user-import.service.ts` — envelope check + XLSX/CSV parse +
  user-row validation (email format, password ≥ 8, unknown role/stage names, duplicates
  within file + against existing church profiles by email) + template builder (CSV/XLSX).
- `src/features/users/actions/user-import.actions.ts` — `previewUsersImportAction`,
  `importUsersAction`, `exportUsersTemplateAction`.
- `src/features/users/hooks/use-user-import.ts` — `usePreviewUsersImport`, `useImportUsers`,
  `useExportUsersTemplate`.
- `src/features/users/components/user-import-panel.tsx` — upload/preview/summary UI mirroring
  `import-upload-area.tsx`; template download button.
- `src/features/users/components/church-scope-selector.tsx` — PO church dropdown.
- `docs/project/PHASE_4_PLATFORM_OWNER_USER_MANAGEMENT_REPORT.md` — final report.

### Modify
- `src/features/users/services/user.service.ts` — `createUser` routes through `create_church_user`
  RPC (session client) after `auth.admin.createUser`; remove duplicated profile/roles/stages inserts
  (servant now created). Add admin-client list/get/roles/stages helpers for PO (churchId-scoped).
- `src/features/users/actions/user.actions.ts` — accept `churchId` on list/get/roles/stages/create;
  PO gate (`hasAnyPermission([USERS_READ, TENANTS_READ])` + churchId present); super-admin gate stays
  `SERVANTS_CREATE`; drop the broken actor super-admin check in favor of the RPC guard. Add
  `getActorChurchAction`.
- `src/features/users/schemas/user.schema.ts` — `createUserSchema` gains optional `churchId`
  (required for PO); keep `roleIds.min(1)`.
- `src/features/users/components/user-form.tsx` — create mode loads roles/stages from the actor's
  church (super-admin) or selected church (PO); PO shows church selector.
- `src/features/users/components/user-list-page.tsx` — PO church selector; bulk-import panel +
  entry button; pass churchId through queries.
- `src/features/users/hooks/use-users.ts` — thread `churchId` through list/detail/roles/stages;
  add `useActorChurch`.
- `src/types/registration.ts` — `create_church_user` contract + new error codes.
- `src/features/users/index.ts` — export new components/hooks.
- `src/features/users/actions/approval.actions.ts` — no change (approval flow already correct).
- `messages/en.json`, `messages/ar.json` — new `users.*` keys (church selector, import panel,
  PO-specific errors); keep en/ar parity.

## Implementation order

1. Migration 034 SQL (+ registration.ts types).
2. `user.service.createUser` RPC routing + servant invariant.
3. Action layer: churchId threading + PO gates + `getActorChurchAction`.
4. UI: user-form create-mode fix, PO church selector, list-page wiring.
5. Bulk import (schemas → service → actions → hooks → panel → template).
6. Translations; index exports.
7. `npx tsc --noEmit`, `npm run lint`, `npm run build`; fix regressions.
8. Report with security review + rollback steps.

## Validation gates
- `npx tsc --noEmit` clean; `npm run lint` 0 errors (7 pre-existing React Compiler warnings OK);
  `npm run build` success.
- Manual: PO signs in → users page shows church selector → create user in a church → user can sign
  in (has approved servant + roles). Super-admin create flow still works and now yields a servant row.

## Security review notes (to include in report)
- RPC is SECURITY DEFINER but guarded by `auth.uid()` identity checks; never accepts `assigned_by`/
  `approved_by` from the caller (derived from `auth.uid()`).
- Role/stage ids are validated in-church inside the RPC; `auth.users` email must match the arg
  (D-8 pattern, prevents account hijack via email spoof).
- Admin client used only for auth-user lifecycle + PO-scoped reads (matches shipped church-admin
  precedent); all writes for PO flow through the guarded RPC.
- Import executes one auth-user + one RPC per row with rollback on RPC failure; row cap enforced in
  schema.

## Rollback
- Migration 034: `DROP FUNCTION create_church_user(...)` (see REVOKE section of the migration).
- Code: revert action/service/component changes; the super-admin create path falls back to the
  previous (broken-invariant) behavior only if the RPC call is removed — keep the RPC deployed
  until the frontend is rolled back.
