# Phase 3 — Church Provisioning Wizard: Implementation Report

**Status:** COMPLETE
**Date:** 2026-08-04
**Scope:** Platform-owner church provisioning wizard (church + first super admin in one flow) using the `provision_church` RPC.
**Validation:** `npx tsc --noEmit` ✅ · `npm run lint` ✅ (0 errors; 7 pre-existing React Compiler warnings) · `npm run build` ✅

---

## 1. Summary

The platform owner can now provision a church and its first Super Admin through a guided 3-step wizard at `/admin/churches/create`, reusing the existing `provision_church` SECURITY DEFINER RPC. No new permissions were added, no RLS was modified, and the RPCs' internal PO-only guards are unchanged.

---

## 2. Files Created

| File | Purpose |
| --- | --- |
| `src/features/churches/schemas/provisioning.schema.ts` | Zod wizard schema + `ProvisionChurchWizardValues` / `ProvisionChurchWizardParsed` types. Empty password allowed (`.`refine` not `.min`, so the default `""` passes); slug validated against the RPC's ASCII regex; `email` required, `contactEmail` optional-but-valid. |
| `src/features/churches/actions/church-provisioning.actions.ts` | (rewritten, see §3) `provisionChurchWizardAction` + legacy `provisionChurchAction` / `createChurchSuperAdminAction`. |
| `src/features/churches/components/church-config-form.tsx` | Step 1: church name AR/EN, auto-slug + regenerate, contact email/phone, address. Manual slug edits are never clobbered by later auto-generation. |
| `src/features/churches/components/church-admin-creation.tsx` | Step 2: admin name AR/EN, email, phone, optional password. |
| `src/features/churches/components/church-provisioning-summary.tsx` | Step 3: review of church + admin details before confirming. |
| `src/features/churches/components/church-provisioning-wizard.tsx` | Wizard shell: 3-step stepper, per-step validation, provisioning progress animation (3 stages, 800 ms each), success screen (invite-link copy, view church, back, provision another), error screen (RPC error-code → localized message, back-to-review / retry), `sessionStorage` persistence key `cmc:church-provisioning-wizard`. |
| `src/app/[locale]/(app)/admin/churches/create/page.tsx` | Route page. `generateStaticParams` for both locales, `setRequestLocale`, wrapped in `<PermissionGuard permission="tenants.create" />`. |
| `supabase/migrations/033_provisioning_rpc_authenticated_grant.sql` | Privilege fix (see §4). |

## 3. Files Modified

| File | Change |
| --- | --- |
| `src/features/churches/actions/church-provisioning.actions.ts` | Legacy actions restored to call the RPCs through the **session client** (`await createClient()`); new `provisionChurchWizardAction` added. |
| `src/features/churches/hooks/use-churches.ts` | Added `useProvisionChurchWizard` (invalidates `CHURCHES_QUERY_KEYS.all` on success). |
| `src/features/churches/components/churches-page.tsx` | Header actions: added "Provision church" link button beside "Add Church" (both inside `tenants.create` guard). |
| `src/features/churches/index.ts` | Exported wizard component, step components, `provisionChurchWizardAction`, `useProvisionChurchWizard`, schema + types. |
| `src/messages/en.json`, `src/messages/ar.json` | Added `churches.wizard.*` (56 keys: title/steps/progress/summary/success/errors) + `churches.provisionChurch`. Verified every key used by the components exists in both locales. |

## 4. Critical Fix: `provision_church` / `create_church_super_admin` privilege bug

**Finding:** migration 032 grants both RPCs **only** to `service_role` ("server actions via the admin client"). But both RPCs guard on `auth.uid()` and `user_is_platform_owner()` (022), which read the caller's JWT `sub`. The service-role key has no `sub` claim → `auth.uid()` is NULL → the `not_authenticated` guard **always** fires. As shipped, the RPCs were uncallable by any client.

**Fix (non-breaking, mirrors 023 S11-7/S12):** new migration **033** adds `authenticated` EXECUTE to both RPCs (service_role retained). Server actions call them through the **session client** so the PO's JWT is present; the internal `user_is_platform_owner()` guard still enforces PO-only. This matches the `approve_church_request` pattern and the architecture review's own note on `import_users` ("allow `authenticated` EXECUTE and let the RPC enforce the guard"). No RLS changes.

The same analysis corrected the wizard implementation: `ensureUniqueSlug` (`@/lib/utils/slug`) queries `churches`, and `list_churches_for_signup` is granted only to `anon, authenticated` — both must use the session client, never the admin client.

## 5. Wizard Flow (server action)

`provisionChurchWizardAction(values)`:
1. Zod parse → `validation_error` on failure.
2. Session user + `hasPermission(PERMISSION_CODES.TENANTS_CREATE)` → `not_authenticated` / `not_platform_owner`.
3. `createAdminClient()` → `missing_service_role` if unconfigured.
4. Duplicate-email check on `profiles` → `auth_user_exists`.
5. `admin.auth.admin.createUser` (`email_confirm: false` in production, `true` otherwise; password only when provided).
6. Slug = user value or `generateSlug(name)` (ASCII-safe), made unique via `ensureUniqueSlug`.
7. `provisionChurch` (session client → `provision_church` RPC). RPC error codes pass through as `code` (`church_name_exists`, `invalid_slug`, `auth_user_email_mismatch`, `super_admin_role_not_found`, …).
8. On RPC failure → rollback: `admin.auth.admin.deleteUser(authUserId)`.
9. Production-only, when no password set → `generateLink` invite → `inviteLink` returned for the success screen.

## 6. Security Review

- **No RLS changes, no permission removal/addition** (wizard is gated on the existing `tenants.create`).
- RPCs remain PO-guarded internally; grant addition only enables the session-client path, identical to the already-shipped `approve_church_request`.
- Audit trail comes **only** from inside `provision_church` (church + user + servant rows); the wizard adds no audit calls.
- Auth-creation (service role) is server-side only; no secrets reach the client.

## 7. Rollback

- **Migration 033:** `REVOKE EXECUTE ON FUNCTION provision_church(...) FROM authenticated;` and same for `create_church_super_admin` (documented in the migration header).
- **App code:** delete `admin/churches/create` route + wizard components, revert `church-provisioning.actions.ts` / `use-churches.ts` / `churches-page.tsx` / `index.ts`, strip the `wizard`/`provisionChurch` message keys.

## 8. Verification Performed

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Clean |
| `npm run lint` | 0 errors, 7 warnings (React Compiler `incompatible-library`; same pattern in existing `user-form.tsx`, `spiritual-journal-form-dialog.tsx`) |
| `npm run build` | Success; `/[locale]/admin/churches/create` route generated |
| Message key parity (EN/AR) | Every `churches.wizard.*` key used by components exists in both locales |
| Zod empty-password path | Fixed (`.refine` allows `""`, still enforces ≥ 8 when set) |
