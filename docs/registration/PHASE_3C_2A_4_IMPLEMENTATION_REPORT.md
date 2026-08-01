# Phase 3C.2A.4 — RPC Wrappers & Types: Implementation Report

**Status:** IMPLEMENTED
**Date:** 2026-08-01
**Scope:** Typed application wrappers for the 8 client-relevant RPCs introduced by Migration 023 (`list_churches_for_signup`, `get_my_access_state`, `submit_church_request`, `approve_servant`, `reject_servant`, `approve_church_request`, `reject_church_request`, `send_notification`), a hand-typed override layer (`src/types/registration.ts`) that survives the post-023 `database.types.ts` regeneration, and the `buildUniqueChurchSlug` provisioning helper. No UI, middleware, or workflow wiring (3C.2B).

## Context

Migration 023 defines 9 functions. `audit_trigger_fn` is a trigger-internal helper (not addressable via `.rpc()`), leaving **8 client-relevant RPCs**. The current `src/types/database.types.ts` reflects the database up to migration 022 (the pre-023 `Functions` block), so the RPCs are not yet in the generated types. Two problems had to be solved:

1. **Typed call sites today** — `.rpc()` on the session client must be given explicit `Args`/`Returns` generics and the response cast, otherwise the RPC names don't typecheck against the pre-023 `Functions`.
2. **Future regen survivability** — the plan (D20) regenerates `database.types.ts` against the post-023 staging schema. The wrappers must keep compiling unchanged after regen (explicit Args keep them valid; the override layer is droppable).

## Files Created

| File | Contents |
| --- | --- |
| `src/types/registration.ts` | `RegistrationErrorCode` (20 023 codes + `unknown`), `RegistrationError`, `RpcResult<T>`, `ListChurchesForSignupResult`, `MyAccessStateResult`, `SubmitChurchRequestInput`, `SendNotificationInput`, `RegistrationFunctions` (Functions-shape contract mirroring what `supabase gen types` will emit), `toRegistrationError` (maps PostgREST `message` → typed code; unknown → `unknown`). |
| `src/lib/utils/slug.ts` | `generateSlug(name)` (Unicode-aware: keeps Arabic letters via `\p{L}`, lowercases, dashes; `church-<timestamp>` fallback) + `ensureUniqueSlug(admin, baseSlug)` (uniqueness probe against `churches.slug`). Relocated from `auth.service.ts`. |
| `src/features/churches/services/churches.service.ts` | `listChurchesForSignup(supabase)` → `ListChurchesForSignupResult[]`. |
| `src/features/churches/services/church-request.service.ts` | `submitChurchRequest(supabase, input)` → request id. Client-side `normalize` (discriminated union) for required ar/en names, catechist, applicant, email format; lowercase email; optional phone/notes → `null`. |
| `src/features/churches/services/provisioning.service.ts` | `approveChurchRequest(supabase, requestId, authUserId, slug)` (UUID + slug-format validation), `rejectChurchRequest(supabase, requestId, reason?)`, `buildUniqueChurchSlug(admin, name)` (composes `generateSlug` + `ensureUniqueSlug` for 3C.2D). |
| `src/features/users/services/approval.service.ts` | `approveServant(supabase, servantId)`, `rejectServant(supabase, servantId, reason?)` → `boolean`. |
| `src/features/auth/services/access.service.ts` | `getMyAccessState(supabase)` → single `MyAccessStateResult` row (or `null`), for middleware + `/pending-approval`. |
| `src/features/notifications/services/notification.service.ts` | `sendNotification(input)` — server-only **service-role INSERT** into `notifications` (see transport decision below). |
| Feature index barrels | `src/features/churches/index.ts`, `src/features/notifications/index.ts`, `src/features/auth/index.ts` (new), `src/features/users/index.ts` (approval service added). |

## Files Modified

| File | Change |
| --- | --- |
| `src/features/auth/services/auth.service.ts` | Local `generateSlug`/`ensureUniqueSlug` replaced by imports from `@/lib/utils/slug`. |
| `src/features/users/index.ts` | Re-exports `approveServant`, `rejectServant`. |
| `src/types/database.types.ts` | **Unchanged in this phase.** Regen is deferred until 023 is applied (see Deferred). |

## Wrapper Inventory

| RPC (023) | Wrapper | Transport | Guards preserved | Errors surfaced |
| --- | --- | --- | --- | --- |
| `list_churches_for_signup` (S11-3) | `listChurchesForSignup` | session (anon+auth) | anon grants | n/a (none raised) |
| `get_my_access_state` (S11-5) | `getMyAccessState` | session (auth) | hardcoded `auth.uid()` | `not_authenticated` |
| `submit_church_request` (S11-4) | `submitChurchRequest` | session (anon+auth) | server-side dedupe | `church_name_required`, `catechist_name_required`, `applicant_name_required`, `email_required`, `email_already_registered`, `request_already_pending`, `church_name_exists` |
| `approve_servant` (S11-5) | `approveServant` | session (auth) | SECURITY DEFINER + `auth.uid()` + super_admin check | `not_authenticated`, `self_approval_not_allowed`, `servant_not_found`, `not_super_admin`, `servant_not_pending`, `servant_role_not_found` |
| `reject_servant` (S11-6) | `rejectServant` | session (auth) | same | same + reason passthrough |
| `approve_church_request` (S11-7) | `approveChurchRequest` | session (auth) | SECURITY DEFINER + `auth.uid()` + platform-owner check | `not_authenticated`, `not_platform_owner`, `request_not_found`, `request_not_pending`, `auth_user_not_found`, `auth_user_email_mismatch`, `church_name_exists`, `invalid_slug`, `super_admin_role_not_found` |
| `reject_church_request` (S11-8) | `rejectChurchRequest` | session (auth) | same | `not_authenticated`, `not_platform_owner`, `request_not_found`, `request_not_pending` |
| `send_notification` (S11-1) | `sendNotification` | **service-role admin INSERT** | RLS-bypassed privileged path | validated input errors |

## Security Model

- **Session-client transport for actor-guarded RPCs.** `approve_servant`, `reject_servant`, `approve_church_request`, `reject_church_request`, and `get_my_access_state` are SECURITY DEFINER and self-guard on `auth.uid()` (not_authenticated / not_super_admin / not_platform_owner). Every wrapper takes a `SupabaseClient` and calls `.rpc()` on it; the 3C.2B actions pass the **session client**, so the RPC's `auth.uid()` gates apply to the real actor. **No admin client is used for any of these** — the actor checks would otherwise be bypassed.
- **`sendNotification` is the single documented exception.** 023 S12 revokes `send_notification` EXECUTE from every client role (it is a SECURITY DEFINER helper called internally by the approval RPCs via `PERFORM`). Even the service-role admin client cannot `EXECUTE` it. The wrapper is therefore the app-layer equivalent: a service-role `INSERT` into `notifications` using the exact canonical columns the RPC writes (`church_id`, `recipient_id`, `notification_type`, `title_ar`, `title_en`, `body_ar`, `body_en`, `data`, `channel`, `sent_at`). This is the approved privileged transport (service-role write, same model as the 3C.2A.3 `user_roles` service writes). It is server-only by construction — it never touches a session client, so there is no client import path that can reach it.
- **Client-side validation is defense-in-depth only.** The RPCs re-validate every input (`church_name_required`, `invalid_slug`, etc.). The wrappers normalize UUIDs, slug format, and email before calling, and map PostgREST `message` → typed `RegistrationErrorCode` via `toRegistrationError` (unknown messages → `unknown`, never a crash).

## Type Strategy (post-023 regen survivability)

- `RegistrationFunctions` mirrors the `Database["public"]["Functions"]` shape the generator will emit (exact `p_` param names, Returns types).
- Every `.rpc()` call passes an **explicit `Args` generic** (`RegistrationFunctions["fn"]["Args"]`) and casts the response through `as unknown as RpcResult<T>`. After regeneration the real generated `Args` are structurally identical, so the call sites keep compiling unchanged.
- `RegistrationFunctions` + the hand-typed result/input types may be **dropped after regen** (the wrappers are self-contained), per D20.
- Enum coverage was verified against the migration: all **20** `RAISE EXCEPTION` codes in 023 are present in `RegistrationErrorCode` (`super_admin_role_not_found` added during this phase; `unknown` reserved for anything else).

## Validation Results

1. **TypeScript:** `npx tsc --noEmit -p tsconfig.json` → **PASSED** (0 errors).
2. **Build:** `npm run build` → **PASSED** (`✓ Compiled successfully`, all 26 routes).
3. **Lint:** `npm run lint` → **no issues in any touched file** (unused import removed). The 18 errors / 6 warnings reported are all **pre-existing** in untouched files (`child.service.ts`, dialog components, `.opencode/skills/*`), unchanged from 3C.2A.3.
4. **No unused wrappers / dead imports:** every exported wrapper is re-exported through its feature index (`churches`, `users`, `auth`, `notifications`); `RegistrationFunctions`, `toRegistrationError`, and `RpcResult` are consumed by the wrappers.
5. **Param-name audit:** every wrapper's `p_` argument set matches the 023 signatures byte-for-byte (`approve_servant(p_servant_id)`, `reject_servant(p_servant_id, p_reason)`, `approve_church_request(p_request_id, p_auth_user_id, p_slug)`, `reject_church_request(p_request_id, p_reason)`, `submit_church_request(...)`).
6. **Error-code audit:** `grep "RAISE EXCEPTION"` on 023 → 20 distinct codes; all 20 in `RegistrationErrorCode` + `KNOWN_REGISTRATION_ERROR_CODES`.

## Remaining Blockers / Deferred

1. **`database.types.ts` regeneration (D20)** — **BLOCKED on 023's apply.** The local DB is migrated only to 022 (verified via `supabase_migrations.schema_migrations` inside the container and `supabase gen types --db-url` output: no `church_requests`/8 RPC signatures). `gen types` currently reproduces the existing post-022 file (an unrelated leftover `attendance_backup_20260730` table appears and is excluded, matching the curated file). Applying 023 is gated by the 3C.2A.5 database gate review. Until then `RegistrationFunctions` + explicit generics provide the contract; after apply, regenerate and (optionally) drop the override layer.
2. **`send_notification` client contract** — no `.rpc()` wrapper exists (revoked for all clients, S12); the service-role INSERT wrapper is the sanctioned path. If a later phase needs the actual RPC, it must be granted to the service role first.
3. **`getProfileByEmail` (foundations D18)** — deferred to 3C.2B where the signup dedupe consumer exists; not added to avoid dead code in this phase.
4. **UI / middleware / actions** — signup form, church-request page, approval pages, `/pending-approval`, middleware access-state routing, and provisioning actions consume these wrappers in 3C.2B/3C.2C/3C.2D. `buildUniqueChurchSlug` is ready for 3C.2D.
5. **`audit_trigger_fn`** — internal trigger helper; no wrapper (not `.rpc()`-addressable). `write_audit_log` (019) is the audit path already consumed by `src/lib/audit.ts` (3C.2A.2).
