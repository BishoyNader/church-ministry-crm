# Phase 3C.2A.5 — Database Gate Review: Migration 023 Readiness

**Status:** REVIEW COMPLETE
**Date:** 2026-08-01
**Target:** `supabase/migrations/023_phase3c_registration.sql` (S1–S12, 957 lines)
**Method:** Static comparison of migration 023 against the current application codebase (`src/`), the 3C.2A phase reports, the migration audit package, and the local database state (migrated to 022 only, verified via `supabase_migrations.schema_migrations` inside the container). No code, SQL, or type changes were made.

---

## 1. Foundation Validation

### 1.1 All 2A deliverables complete

| Phase | Deliverable | Status | Evidence |
| --- | --- | --- | --- |
| 3C.2A.1 | Permissions constants synced to canonical DB catalog (`notifications.create` etc. removed) | ✅ | `PHASE_3C_2A_1_IMPLEMENTATION_REPORT.md`; `src/features/rbac/constants/permissions.ts` |
| 3C.2A.2 | Application audit logging | ✅ | `PHASE_3C_2A_2_IMPLEMENTATION_REPORT.md`; `src/lib/audit.ts` (session-client `audit_logs` INSERT + RPC usage) |
| 3C.2A.3 | `user_roles` write hardening — all writes service-role, reactivation-first, last-super-admin guard, active-grant reads | ✅ | `PHASE_3C_2A_3_IMPLEMENTATION_REPORT.md`; `user.service.ts` `syncRoleGrants`; `rbac.service.ts` active-grant reads |
| 3C.2A.4 | Typed RPC wrappers for all 8 client-relevant 023 RPCs + override type layer | ✅ | `PHASE_3C_2A_4_IMPLEMENTATION_REPORT.md`; `src/features/{churches,users,auth,notifications}`; `src/types/registration.ts` |

The migration itself passed its own audit package: **GO verdict** (`PHASE_3C_GO_NO_GO_VERDICT.md`), **70/70 compliance** (`PHASE_3C_COMPLIANCE_MATRIX.md`), zero BLOCKING/HIGH/MEDIUM findings, and **`PHASE_3C_FINAL_GENERATION_GATE.md`** locked the design (D-1…D-8) before SQL generation.

### 1.2 Previously identified blockers — closed

| Blocked item | Resolution | Status |
| --- | --- | --- |
| 3C.2A.1: stale `notifications.create` permission referenced in `permissions.ts` | Permission catalog resynced to the DB (`notifications.create` removed from the app catalog by 021) | ✅ Closed |
| 3C.2A.2: `write_audit_log`/audit integration | App audit path implemented (`src/lib/audit.ts`); DB-side audit restoration is part of 023 S9/S10 | ✅ Closed |
| 3C.2A.3: session-client `user_roles` DELETE/INSERT would be silently denied post-023 | All `user_roles` writes moved to the service-role admin client; reactivation-first diff under `uq_user_roles_active` | ✅ Closed |
| 3C.2A.4: `database.types.ts` regen "blocked on 023 apply" | Reconfirmed at §3 — regen is clean to run **after** apply; the local DB is verified at 022 only | ✅ Blocked→cleared (sequenced) |

### 1.3 Remaining application blockers

| Item | Severity | Detail |
| --- | --- | --- |
| **`signUpWithEmail` super_admin self-grant** (`src/features/auth/services/auth.service.ts:120–160`) | **Application-layer gap (not a DB-apply blocker)** | The live `/signup` route creates a `churches` row + `profiles` row + `user_roles` super_admin grant via the **service-role admin client**, then self-grants `super_admin`. It bypasses RLS entirely, so **023 does not break it** — but it directly contradicts the C-1 security model 023 establishes. Explicitly tracked since 3C.2A.3 and scheduled for removal in **3C.2B** (replaced by submit→pending→platform-owner approval). |
| `getProfileByEmail` (foundations D18) | Deferred | No consumer until 3C.2B signup dedupe. |
| Registration UI / middleware / provisioning actions | Deferred | 3C.2B/2C/2D consumers of the 2A.4 wrappers; not required for the DB apply. |

**Conclusion:** the only substantive open item is the `signUpWithEmail` self-grant. It is tracked, sequenced out of the 2A scope, does not affect the safety of the DB apply, and must be removed in 3C.2B before any production go-live.

---

## 2. Migration Compatibility

### 2.1 Schema deltas (023) vs. current application state

| 023 change | Line(s) | Application impact | Verdict |
| --- | --- | --- | --- |
| `church_requests` table + 5 RLS policies | 29–97 | New table; **no app code references it** (3C.2D pending). Regen adds it cleanly. | No break |
| `notifications.church_id` → NULLABLE | 108 | App `sendNotification` (`notification.service.ts`) already sends `churchId: string \| null`; currently a `null` insert fails NOT NULL, **after apply it succeeds** — this *fixes* the 2A.4 wrapper's null-recipient case. | Improvement |
| `user_roles` UNIQUE → partial `uq_user_roles_active (WHERE end_date IS NULL)` | 181–185 | 3C.2A.3 `syncRoleGrants` is reactivation-first (reactivate not re-insert); pre-flight P0.4 guarantees no duplicate active grants exist (impossible under the old superset UNIQUE). | No break |
| `tenant_isolation` → SELECT-only on `user_roles`, `servants`, `notifications` | 119–146 | **Zero session-client writes on these tables.** Writes audited: `user_roles` insert → admin only (`auth.service.ts:148`, `user.service.ts:387`); `notifications` insert → admin only (`notification.service.ts:38`); no `servants` writes anywhere in `src/`. Reads (SELECT) are preserved by the retained policies. | No break |
| `profiles.own_profile_insert` hardening (active-church WITH CHECK) | 158–166 | Only `profiles` write is admin-client (`auth.service.ts:120`), RLS-bypassed. No session-client profile INSERT exists. | No break |
| `audit_trigger_fn` + 6 audit triggers | 199–273 | Triggers on `profiles`, `user_roles`, `followups`, `attendance_sessions`, `attendance_records`, `beneficiaries` — all tables the app writes. Trigger writes are SECURITY DEFINER (`auth.uid()` may be NULL for service-role writes; `actor_id` is nullable). No trigger on `audit_logs` → no recursion. | No break; see §4 audit-volume risk |
| 8 SECURITY DEFINER RPCs (S11) | 291–831 | None shadow or alter a pre-023 RPC. All are new names. Existing RPCs the app calls (`seed_church_roles`, `get_user_church_id`, `user_has_*`, `write_audit_log`) are untouched. | No break |
| S12 privilege lockdown (REVOKE ALL + selective GRANT) | 835–872 | Only targets the 8 new RPCs + `send_notification`. Grants match the 2A.4 wrapper transports exactly: `list_churches_for_signup`→anon+auth, `submit_church_request`→anon+auth, `get_my_access_state`→auth, approve/reject ×4→auth+service_role, `send_notification`→**no role** (2A.4 correctly wraps it as a service-role INSERT). | No break |

### 2.2 Code paths that break immediately after apply

**None identified.** Verified exhaustively:
- No session-client `INSERT/UPDATE/DELETE` on any 023-policy-restricted table (`grep` over `src/` — only admin-client writes exist on `profiles`, `user_roles`, `churches`, `notifications`).
- `audit_logs` session INSERT (`src/lib/audit.ts:32`) is governed by the unchanged 022 RLS policies; 023 does not touch `audit_logs`.
- No `.rpc()` call targets a function whose signature 023 changes.
- The `churches` DELETE rollback in `signUpWithEmail` (`auth.service.ts:160`) still succeeds — `church_requests.reviewed_by` is `ON DELETE SET NULL`, and `notifications` FK is only referenced after provisioning (never for a brand-new rollback row).

### 2.3 Temporary compatibility shims still in use

| Shim | Purpose | Removal |
| --- | --- | --- |
| `RegistrationFunctions` override layer (`src/types/registration.ts`) + explicit `.rpc<"fn", Args>` generics + `as unknown as RpcResult<T>` casts | Compile the 8 RPC calls against the pre-023 `database.types.ts` | Droppable after post-023 regen (2A.4 D20); structurally identical to the generated `Args`, so wrappers keep compiling either way |
| `attendance_backup_20260730` leftover table | Legacy from 015; 023 only drops its dead `audit_attendance` trigger (023:237) | Outside 023 scope; table excluded from the curated `database.types.ts` |

---

## 3. Type Generation Readiness

**Expected clean.** Key facts verified against 023:
- 023 creates **no new types/enums** (zero `CREATE TYPE`). `church_requests.status` is `text` + CHECK, `servants.approval_status` is pre-existing `text`. The regen delta is therefore purely: the `church_requests` table, `notifications.church_id → string | null`, and 9 new `Functions` entries (`audit_trigger_fn` + the 8 client RPCs).
- The wrappers pass **explicit Args generics** and cast responses, so regenerated signatures cannot break a call site.
- `sendNotification` uses the **untyped admin client** (`any`), so it compiles unchanged before and after regen.

**Caveat:** the local DB is verified at migration **022 only** (container `supabase_migrations` + `gen types --db-url` reproduce the post-022 file). Regeneration must therefore happen **after** the 023 apply — running it now yields the pre-023 file (identical to the curated one, minus the unrelated `attendance_backup_20260730` table the curation excludes).

### Files expected to require attention after regeneration

| File | Expected change |
| --- | --- |
| `src/types/database.types.ts` | Regenerated output (adds `church_requests`, nullable `notifications.church_id`, 9 Functions). |
| `src/types/registration.ts` | **Optional** trim — `RegistrationFunctions` becomes redundant; `RegistrationErrorCode`/`toRegistrationError` retained. No required change; the file keeps compiling. |
| No service file | No required edits — all wrappers remain valid. |

---

## 4. Staging Apply Risk Assessment

| Level | Item | Assessment |
| --- | --- | --- |
| **Blocking** | None | — |
| **High** | None | — |
| **Medium** | `signUpWithEmail` super_admin self-grant remains live post-apply | C-1 (self-escalation) stays open at the **application layer** until 3C.2B removes `signUpWithEmail`. Not a DB-apply risk (service-role path unaffected), but it is the single item that must not go to production. Tracked since 3C.2A.3. |
| **Medium** | Audit-trigger write amplification | Every app DML on `profiles`, `user_roles`, `followups`, `attendance_sessions`, `attendance_records`, `beneficiaries` now fires `audit_trigger_fn` (SECURITY DEFINER `audit_logs` INSERT). Correctness is unaffected (no recursion, `actor_id` nullable); staging data volume makes this negligible. Monitor `audit_logs` growth. |
| **Low** | S8 lock window (drop UNIQUE + create partial index on `user_roles`) | Small staging table; transactional (never momentarily un-unique). P0.4 guarantees no duplicate active grants, so the index build cannot fail on data. |
| **Low** | `notifications.church_id` FK retained against a nullable column | Inserts with NULL now succeed (intended, platform-owner + approval-required alerts). No ORM conflict. |
| **Low** | S12 revokes could remove EXECUTE the app relies on | Only the 8 new RPCs are revoked; existing RPC grants untouched. 2A.4 transports match the new grants exactly. |
| **Precondition** | Mandatory execution conditions from the GO/NO-GO verdict (§3) | P0.1–P0.7 pre-flight on the target DB (P0.4 duplicate-active-grants check, P0.6 `pg_dump` snapshot of `notifications`/`user_roles`/`servants`/`profiles`), scratch-first apply (001–023) + **V1–V6** + RLS regression **R-1…R-16** with real sessions, then post-apply **V1–V3** on the target. These are run-conditions at apply time, not fixes. |

---

## 5. Recommendation

**READY_FOR_STAGING_APPLY**

Rationale:
- The migration is fully audited (GO verdict, 70/70 compliance, zero blocking/high/medium findings) and is transactional, data-preserving (no DML on existing rows), with a documented rollback path (R1–R5).
- The application layer is aligned: no session-client write exists on any table whose policies 023 restricts; every affected write is already service-role or RPC-based; no `.rpc()` call targets a changed function; no immediate breakage exists.
- Post-023 type regeneration is expected to be clean (no new enums; wrappers pass explicit generics; the override layer is droppable).
- The one open application item — the `signUpWithEmail` self-grant — is tracked, deliberately deferred to 3C.2B, and does not affect the safety of the DB apply (it remains a go-live gate, not a DB-apply gate).

Apply is conditional on executing the documented pre-flight (P0.1–P0.7) and scratch V1–V6 + R-1…R-16 verification at apply time, per `PHASE_3C_GO_NO_GO_VERDICT.md` §3.

---

## 6. Next Step

**Apply 023 to staging**, in this order:

1. Run **P0.1–P0.7** pre-flight against the target staging DB (P0.4 duplicate-active-grants, P0.6 snapshot).
2. Scratch-first (P0.7): apply 001–022 + 023 to a scratch project; run **V1–V6** and RLS regression **R-1…R-16** with real sessions, including both flow smokes (existing-church approve, new-church provisioning).
3. Apply `023_phase3c_registration.sql` to staging; run post-apply **V1–V3** (schema, policies, function privileges — confirm `send_notification` has no client EXECUTE).
4. **After** the apply, regenerate `src/types/database.types.ts` (`supabase gen types`) and run `npx tsc --noEmit` + `npm run build` + `npm run lint`; optionally trim `RegistrationFunctions` from `src/types/registration.ts`.
5. Proceed to **3C.2B** (registration UI), which removes `signUpWithEmail`'s self-grant and consumes the 2A.4 wrappers. That removal is the go-live gate for C-1.

No additional application implementation is required before the apply; commit/merge and type regeneration are sequenced around it (regen after apply).
