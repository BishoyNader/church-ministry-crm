# Phase 3C.2A.2 — Audit Logging Alignment: Implementation Report

**Status:** IMPLEMENTED
**Date:** 2026-08-01
**Scope:** Align every audit_logs write path with the canonical post-019 schema; standardize the audit payload; remove obsolete `user_id`/enum/helper references.

## Context

Migration `supabase/migrations/019_audit_logs_update.sql` made the audit schema canonical:
- `user_id` → **`actor_id`** (019:12)
- `action` enum → **TEXT** (019:18)
- dropped `ip_address` / `user_agent` (019:24–25)
- `entity_id` **NOT NULL** (019:31–32)
- added **`metadata`** jsonb (019:38)

`auth.service.ts` had already been corrected to `actor_id`. Three server-action helpers (children, stages, users) were still inserting the obsolete `user_id` column, which no longer exists post-019 — those inserts would fail at runtime with a `column user_id does not exist` error.

## Files Modified

| File | Change |
| --- | --- |
| `src/lib/audit.ts` | **NEW** — single shared canonical audit helper `writeAuditLog(...)`. Resolves `actor_id` (current user) and `church_id` (profile), inserts the canonical payload, and is the **only** audit insert path in the app. |
| `src/features/children/actions/child.actions.ts` | Removed local `auditLog` helper; all 9 call sites route through `writeAuditLog`. |
| `src/features/stages/actions/stage.actions.ts` | Removed local `auditLog` helper; all 7 call sites route through `writeAuditLog`. |
| `src/features/users/actions/user.actions.ts` | Removed local `auditLog` helper; all 5 call sites route through `writeAuditLog`. |
| `src/features/auth/services/auth.service.ts` | Login + logout inserts now route through `writeAuditLog` for payload consistency. |

## Old Audit Format (pre-alignment)

All three action helpers shared this shape (obsolete post-019):

```ts
await supabase.from("audit_logs").insert({
  church_id: profile.church_id,
  user_id: user.id,        // ✗ column renamed to actor_id in 019
  action,                  // passed as string already (ok)
  entity_type: entityType,
  entity_id: entityId,
  old_values: oldValues ?? null,
  new_values: newValues ?? null,
  // metadata: never populated  ✗
});
```

Each helper duplicated the user/profile resolution + insert + error handling (3 copies), and `auth.service.ts` had a 4th inline copy. The local helpers were untyped against `Database` (they accepted `Awaited<ReturnType<typeof createClient>>`, whose client resolves to `any`-typed `from()`), so the invalid `user_id` column name and the missing `metadata` were not caught by the type checker.

## New Audit Format (canonical)

Single shared helper `src/lib/audit.ts`:

```ts
export async function writeAuditLog(
  supabase: SupabaseClient<Database>,
  action: string,          // TEXT (post-019), free-form
  entityType: string,
  entityId: string,        // required NOT NULL
  oldValues?: Record<string, unknown> | null,
  newValues?: Record<string, unknown> | null,
  metadata?: AuditMetadata | null,   // AuditMetadata = { reason?: string; ... }
): Promise<void>
```

Insert payload (typed against `Database["public"]["Tables"]["audit_logs"]["Insert"]`):

```ts
await supabase.from("audit_logs").insert({
  church_id: profile.church_id,   // resolved from actor profile
  actor_id: user.id,              // current authenticated user
  action,
  entity_type: entityType,
  entity_id: entityId,            // always populated
  old_values: oldValues ?? null,
  new_values: newValues ?? null,
  metadata: metadata ?? {},       // always populated (jsonb object)
});
```

Required fields verified present on every insert: `actor_id`, `church_id`, `entity_type`, `entity_id`, `action`, `metadata`.

## Required-Fields Coverage

| Field | Present | Source |
| --- | --- | --- |
| `actor_id` | ✅ | current user via `auth.getUser()` |
| `church_id` | ✅ | resolved from `profiles.church_id` |
| `entity_type` | ✅ | caller-supplied ("child", "attendance", "followup", "ministry", "stage", "user", "session") |
| `entity_id` | ✅ | caller-supplied (always non-null; NOT NULL enforced) |
| `action` | ✅ | TEXT, caller-supplied (create/update/delete/login/logout) |
| `metadata` | ✅ | always populated (`{}` default; `{ reason }` supported) |

## Validation Performed

1. **Search — `audit_logs.user_id`:** `grep -rn "user_id" src/ | grep -i audit` → **zero matches**. (The only remaining `user_id` in `auth.service.ts:187` is a `user_roles` column insert, not audit.)
2. **Search — obsolete helpers:** `grep -rn "auditLog(" src/features/` → **zero matches**. All three local helpers removed.
3. **Search — single insert path:** `grep -rn 'from("audit_logs")' src/` → only `src/lib/audit.ts:32`. All audit writes now flow through one canonical helper.
4. **Search — removed enum assumptions:** `grep -rn "audit_action" src/` → **zero matches**.
5. **TypeScript build:** `npm run build` → **PASSED** (Next.js production build, all 26 routes, no type errors). Note: the shared helper is the first audit write path actually typed against `Database["public"]["Tables"]["audit_logs"]["Insert"]`; the `Json` cast at the boundary is required because the previous helpers were effectively `any`-typed.
6. **Lint:** `npm run lint` → no issues in any touched file. 18 pre-existing errors / 6 warnings remain, all in files untouched by this task (`child.service.ts`, dialogs, `.opencode/skills/*`).

## Remaining Audit Gaps

1. **`write_audit_log` RPC not consumed:** the canonical SECURITY DEFINER RPC (`019:57`) remains unused by the app; the shared helper performs a direct typed insert (RLS `append_only` with `WITH CHECK (true)` allows it, 022:347). Routing through the RPC is deferred to 3C.2A.4 (RPC wrappers, out of scope here).
2. **`metadata.reason` not yet supplied:** the helper supports `{ reason }` but no call site currently passes one; follow-up features (e.g. deactivation/approval reasons in 3C.2D) should populate it.
3. **login/logout actor-church timing:** login audits `userId` after profile validation and logout audits before `signOut()` — unchanged behavior, now through the shared helper.
4. **Pre-existing working-tree changes:** unrelated uncommitted changes (registration, migration 023, etc.) predate this task; this report's diff is limited to the files listed above.
