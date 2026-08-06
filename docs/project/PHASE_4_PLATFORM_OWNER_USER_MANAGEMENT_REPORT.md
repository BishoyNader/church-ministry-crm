# PHASE 4 — Platform Owner User Management: Implementation Report

Status: DONE — all code-verified gates pass (`tsc`, `lint`, `build`).

## What was shipped

### 1. DB-enforced user creation invariant (migration 034)
`create_church_user(p_church_id, p_auth_user_id, p_full_name_ar, p_email, p_role_ids,
p_full_name_en, p_phone, p_preferred_locale, p_stage_ids)` — SECURITY DEFINER RPC.

- Atomic profile + **approved servant** + role grants (reactivation-first) + optional stage
  assignments in one transaction.
- Internal guards on `auth.uid()`: `not_authenticated`; caller must be
  `user_is_platform_owner()` OR `user_is_super_admin(p_church_id)` (`not_allowed`); church
  exists and is active (`church_not_found`); auth user exists and email matches
  (`auth_user_not_found` / `auth_user_email_mismatch`); roles non-empty and in-church
  (`roles_required` / `role_not_in_church`); stages in-church (`stage_not_in_church`).
- `assigned_by` / `approved_by` are derived from `auth.uid()`, never accepted from the caller.
- `send_notification` + two `write_audit_log` rows (user + servant).
- Grants follow the 033 pattern: REVOKE PUBLIC/anon; EXECUTE for `authenticated` + `service_role`.
  Called via the **session client** so the identity guards resolve the acting user.
- New `RegistrationErrorCode` entries added to `src/types/registration.ts` with
  `toRegistrationError` mapping.

### 2. Single-user creation routed through the RPC
- `user.service.createUser` now: (a) `auth.admin.createUser` (service role), (b) call
  `create_church_user` via the session client, (c) delete the auth user on RPC failure
  (rollback). The previous TS path never created a `servants` row, so every created user was
  stuck at `/pending-approval` (proxy gate `get_my_access_state`).
- `createUserAction` gate: PO → `hasAnyPermission([USERS_READ, TENANTS_READ])` + `churchId`
  required; super-admin → `SERVANTS_CREATE`. The RPC guard is the hard enforcement boundary
  (D6).

### 3. PO-safe reads + church scoping
- New `src/features/users/actions/context.ts`: `resolveActorContext` (profile read via admin
  client so PO resolves), `dataClientFor` (session client for church admins, admin client for
  PO — mirrors `listChurchesAction`), `writeUserAudit` (direct admin `audit_logs` insert,
  PO-safe because the PO has no session-RLS path to audit), `assertUserManagementPermission`.
- `listUsersAction` / `getUserAction` / `getRolesAction` / `getStagesAction` accept a
  `churchId`; `getActorChurchAction` added. PO reads flow through the admin client; super-admin
  reads keep the session client (RLS intact).

### 4. Create-mode roles/stages fix
- `UserForm` create mode resolves the scope church from the `churchId` prop or
  `useActorChurch().churchId`, so `useRoles`/`useStages` (`enabled: !!churchId`) now load for
  both PO and super-admin create flows.

### 5. Bulk user import (D5)
- `user-import.service.ts`: envelope gate (reuses `validateImportFileMeta`, 10 MB + .csv/.xlsx),
  CSV/XLSX parse (mirrors import-export), structural validation (email format, password ≥ 8,
  required Arabic name, **mandatory role column** — a row without a role is rejected at preview
  as `missingRequired`), catalog validation (in-file + against existing church profile emails,
  unknown role/stage names), template builder (CSV/XLSX with headers + example row).
- `user-import.actions.ts`: `previewUsersImportAction`, `importUsersAction` (per row:
  auth createUser → RPC → rollback auth user on RPC failure; failures classified
  missing_role / duplicate / invalid_role / invalid_stage / auth_failed / rpc_failure; one
  `import_users` audit row per batch, 200-row cap enforced in schema), `exportUsersTemplateAction`.
- `use-user-import.ts` hooks + `user-import-panel.tsx` UI (upload → preview tables → import →
  summary), `church-scope-selector.tsx` (PO-only church dropdown).
- **No new DB permissions**: user import is gated by the action layer; `import.execute` is
  intentionally not granted to PO (D6).

### 6. List page + exports + translations
- `user-list-page.tsx`: PO church selector; import panel; `churchId` threaded through the list
  query and create/edit/roles/stages dialogs; create button disabled for PO until a church is
  chosen (never for super admins).
- Feature barrel `index.ts` exports the new actions, hooks, components, and import types.
- `messages/en.json` + `ar.json`: `users.churchScope.*` and `users.userImport.*` keys
  (en/ar parity).

## Security review
- The RPC is SECURITY DEFINER but every path re-verifies the acting identity via `auth.uid()`;
  no caller-supplied identity fields. Role/stage ids validated in-church; `auth.users` email
  must match the argument (anti account-hijack pattern).
- PO writes go exclusively through the guarded RPC; the admin client is used only for auth-user
  lifecycle, PO-scoped reads, and audit inserts (shipped church-admin precedent).
- Import rollback: an auth user is deleted if its RPC step fails; duplicate emails fail at
  `auth.admin.createUser` and are reported per row without affecting other rows.
- `user-import.actions.ts` is a `"use server"` module; `context.ts` stays server-only (never
  imported from the client barrel), preserving the Next.js server-action boundaries.

## Validation
- `npx tsc --noEmit` — clean.
- `npm run lint` — 0 errors (7 pre-existing React Compiler warnings, unchanged from baseline).
- `npm run build` — success.
- Manual (not yet executed against a live DB): PO signs in → users page shows church selector →
  create user in a church → user can sign in (approved servant + roles). Super-admin create
  still works and now yields a servant row.

## Rollback
- Migration 034: `DROP FUNCTION create_church_user(uuid, uuid, text, text, text, text, text, uuid[], uuid[])`
  (REVOKE section in the migration). Keep the RPC deployed until the frontend is rolled back —
  `user.service.createUser` depends on it.
- Code: revert the action/service/component/import changes; the previous create path returns
  only if the RPC call is removed (and regresses to the missing-servant bug).

## Known limitations
- PO editing (update/deactivate/roles/stages) is out of scope: PO lacks `users.update` in the
  026 bundle, and those actions still require a session-RLS path. The list page does not expose
  edit controls to PO. If PO edit is wanted later, add a guarded update RPC + 026 permission.
- Import assigns the hardcoded `preferred_locale = 'ar'` (matches create form default); a
  locale column in the template was intentionally not added to keep the template minimal.
