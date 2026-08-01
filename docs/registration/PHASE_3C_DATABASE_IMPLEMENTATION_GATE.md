# Phase 3C.2 — Database Implementation Gate

**Phase:** 3C — Registration & Church Provisioning
**Date:** 2026-07-31
**Status of the spec entering this gate:** `READY_FOR_DATABASE_IMPLEMENTATION` (per `IMPLEMENTATION_READINESS_VERDICT.md`)

---

## Gate Verdict

# ⛔ REQUIRES_SPEC_UPDATE

**Not `APPROVED_FOR_MIGRATION_GENERATION`.** No migration, SQL, RPC, or policy may be generated until the amendments in §3 are applied and the gate is re-run. **Not `BLOCKED`**: the migration surface itself is sound, all collisions are resolved, and the required amendments are concrete and bounded.

---

## 1. Success-criteria checklist (from the audit brief)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | No undocumented dependencies exist | ⚠️ **Held except as documented** | N-1 (`old_metadata`), N-2 (stale types), N-3 (orphan helpers) are now documented with verification steps — none block the DDL. **M-3** (servants write-path wording) must be reconciled in the spec. |
| 2 | No unresolved collision risks exist | ✅ **Met** | `PHASE_3C_MIGRATION_COLLISION_REPORT.md` — zero collisions; ordering + exact-name requirements captured. |
| 3 | Audit subsystem state is known | ⚠️ **Known, but the restoration plan is broken** | Verified: `audit_trigger_fn` + 5 triggers dropped by 019 CASCADE; `write_audit_log` exists but unused; silent gap. **M-2:** A4 targets the non-existent `children` table — restoration will fail as written. |
| 4 | Notification assumptions are verified | ✅ **Met (with caveat)** | Nullable `church_id` is safe (recipient_scope role-independent; index FK-independent; `audit_logs.church_id` precedent). No existing write path; `send_notification` chokepoint valid. Caveat N-1. |
| 5 | Temporal role model is verified | ✅ **Met** | Non-partial `UNIQUE (church_id, user_id, role_id)` makes A3's reactivation-first the only legal re-grant; partial unique index `uq_user_roles_active` is correct and collision-free. |
| 6 | RLS dependency graph is complete | ✅ **Met** | `PHASE_3C_DEPENDENCY_GRAPH.md` — 11 functions mapped; `get_user_role()` does not exist; `user_has_permission`/`get_user_servant_id`/`get_user_assigned_beneficiary_ids` are orphans; modification blast radius documented. |
| 7 | No schema/spec mismatches remain | ❌ **FAILED** | **M-1** (pending-user "zero access" claims false vs 022) and **M-2** (invalid `children` reference in A4). |

**Result: 5/7 met, 2 mismatches block the gate.**

---

## 2. Blocking findings (must be resolved in the spec)

### M-1 — Pending-user "zero access" is false against migration 022 (HIGH)

`PHASE_3C_SECURITY_REMEDIATION.md` R-8 expects **0 rows** for a pending user selecting services/stages/classes/beneficiaries/attendance/followups; `REGISTRATION_RBAC_IMPACT.md` §5 claims RLS "denies all operational data to pending users"; `REGISTRATION_WORKFLOW_SPEC.md` §3.2/§3.3 claim "zero effective access" / "RLS prevents any operational read/write".

**Reality (022):** `tenant_isolation` on 17 operational tables is `FOR ALL USING (church_id = get_user_church_id())` — **permissive and church-scoped only**. A pending user has a real `church_id`, so they pass SELECT **and** INSERT/UPDATE/DELETE on services, stages, classes, beneficiaries (PII), beneficiary_assignments, servant_stage_assignments, attendance_sessions, attendance_records, followups, spiritual_journal_entries, events, event_registrations, documents, ai_conversations, ai_messages, document_embeddings, roles, role_permissions; plus full reads of `profiles`, `audit_logs`, `notifications` (post-fix), `churches`, `user_roles`, `servants`. Concretely: a pending user can read every church member's profile and every beneficiary's personal data, read the whole audit trail, and write beneficiaries/attendance/followups/events/documents — or **DELETE the church's `super_admin` role row** (CASCADE-revokes all grants). `roles.read_all` (022) also exposes role ids, making C-1's role-discovery step trivial after the `user_roles` fix.

The remediation closed exactly three write surfaces (grants, servant approval, notifications). It explicitly leaves "no other existing policy" modified. Therefore the claimed zero-trust posture is **not achievable** by the planned batch, and R-8 **will fail** as written.

**Required decision (spec amendment A6):** choose one and document it in `REGISTRATION_RBAC_IMPACT.md`, `PHASE_3C_SECURITY_REMEDIATION.md` (R-8), and `REGISTRATION_WORKFLOW_SPEC.md` (§3.2/§3.3):
- **(a) Accept and document** pending-user church-scoped read access (and the non-role RBAC-metadata write surface) as a pre-existing, accepted residual risk; rewrite R-8's expectation to match the schema (assert *role-gated* tables return 0 rows via assignment scopes, and assert the three closed write surfaces are denied) and correct the §5/§3.x claims; **or**
- **(b) Scope-expand the remediation** to gate operational access for role-less users (e.g., add `AND EXISTS(active user_roles)` / role-gates to operational policies, or introduce a restrictive "deny for role-less" policy following the `deny_admin_spiritual` precedent, 022:335). This is a **much larger** policy change than the current "no other policy modified" scope and must be re-costed in `PHASE_3C_IMPLEMENTATION_PLAN.md`.

The gate can only pass with a written decision and consistent verification expectations.

### M-2 — A4 audit restoration references the non-existent `children` table (HIGH)

Migration `013:12` renamed `children` → `beneficiaries`; no migration recreates it. `REGISTRATION_DATABASE_CHANGES.md` §8.1 and `PHASE_3C_SECURITY_REMEDIATION.md` §4 both instruct `audit_children → children`, and the smoke test filters `entity_type = 'children'`. `CREATE TRIGGER audit_children ON children` will fail with `relation "children" does not exist`.

**Required amendment (A5):** remove `audit_children → children` from the trigger list (coverage for beneficiaries is provided by the new `audit_beneficiaries`); change the §8.1 smoke test to `entity_type = 'beneficiaries'`; update R-14's table list; note that legacy audit rows written before 013 retain `entity_type = 'children'`.

### M-3 — Servants write-path wording contradiction (MEDIUM)

`REGISTRATION_WORKFLOW_SPEC.md` §3.2 creates the pending profile + servant row via the **service-role admin client**; `PHASE_3C_SECURITY_REMEDIATION.md` §3.1 lists "service-role admin client" as a legitimate writer; but §3.2 of the same doc asserts "every write in the 3C flow passes through a SECURITY DEFINER RPC". These cannot both stand.

**Required amendment (A7):** reword the §3.2 invariant to "every write in the 3C flow passes through a SECURITY DEFINER RPC **or the service-role admin client**" and explicitly state that the signup-time `servants`/`profiles` row creation is an admin-client write (RLS-bypassed), while approval transitions remain RPC-only.

---

## 3. Required spec amendments before migration generation

| # | Amend | Change |
|---|---|---|
| A5 | `REGISTRATION_DATABASE_CHANGES.md` §8.1, `PHASE_3C_SECURITY_REMEDIATION.md` §4, R-14 | Fix `audit_children → children` → beneficiaries; smoke test `entity_type='beneficiaries'` |
| A6 | `REGISTRATION_RBAC_IMPACT.md` §5, `PHASE_3C_SECURITY_REMEDIATION.md` R-8 + §3.2, `REGISTRATION_WORKFLOW_SPEC.md` §3.2/§3.3 | Decide pending-user operational access posture; align R-8 expectations and all "zero access" claims with the actual 022 RLS behavior |
| A7 | `PHASE_3C_SECURITY_REMEDIATION.md` §3.2 | Reconcile the "RPC-only writes" invariant with the admin-client signup path |
| A8 | `REGISTRATION_DATABASE_CHANGES.md` §4/§10, `PHASE_3C_IMPLEMENTATION_PLAN.md` §1/§3 | Normalize RPC count (8 functions = 7 client-facing + `send_notification` helper) |
| A9 | `REGISTRATION_DATABASE_CHANGES.md` §6.1/§8.1, `PHASE_3C_IMPLEMENTATION_PLAN.md` 1.14 | Add `notifications.old_metadata` live-verification step and note the stale `database.types.ts` (Functions list still contains 021-dropped functions) |
| A10 | `PHASE_3C_IMPLEMENTATION_PLAN.md` §3 / index impact | State the explicit choice on `idx_user_roles_user_active` (retain or drop) and confirm `user_roles_church_id_user_id_role_id_key` as the constraint name |

Also: verify live-DB `old_metadata` and the exact `user_roles` constraint name on the scratch project before the batch (both are named in `PHASE_3C_MIGRATION_COLLISION_REPORT.md` §6).

---

## 4. What is confirmed and does NOT change

- ✅ All additive objects are collision-free (`PHASE_3C_MIGRATION_COLLISION_REPORT.md`).
- ✅ The three `tenant_isolation` replacements (C-1/C-2/C-3) and `own_profile_insert` hardening are correct and must ship in the same batch as the RPCs.
- ✅ Audit subsystem state is **known** (silent gap since 019; root cause per A4 is correct — only the `children` reference is wrong).
- ✅ `notifications.church_id` nullable is safe; `send_notification` chokepoint valid.
- ✅ A3 reactivation-first + partial unique index is the correct temporal re-grant model.
- ✅ Dependency graph complete; `get_user_role()` does not exist; orphan helpers must not be adopted.
- ✅ No migration 023+ exists; 3C is the first post-022 batch.

---

## 5. Re-gate procedure

1. Apply amendments A5–A10 to the spec documents.
2. Re-run this gate: re-check criteria 1 and 7 (criterion 2–6 are already satisfied and stable).
3. On PASS → verdict becomes `APPROVED_FOR_MIGRATION_GENERATION`; then proceed to Phase 3C.1 migration-batch authoring with the amended spec as the sole source of truth.

---

## 6. Re-gate record (2026-07-31) — ✅ PASS

**Amendments applied (A5–A10):**

| # | Amendment | Where applied | Result |
|---|---|---|---|
| A5 | Remove `audit_children → children` (M-2); smoke test `entity_type='beneficiaries'`; trigger count 7 → 6 | `REGISTRATION_DATABASE_CHANGES.md` §8.1/§10; `PHASE_3C_SECURITY_REMEDIATION.md` §4/R-14; `PHASE_3C_IMPLEMENTATION_PLAN.md` 1.12/§3; `IMPLEMENTATION_READINESS_VERDICT.md` crit. 4 | ✅ |
| A6 | **Accept-and-document** pending-user posture (option a): role-gated surfaces = 0 rows; 3C write surfaces closed; church-scoped operational access = accepted residual risk (§3.3) | `PHASE_3C_SECURITY_REMEDIATION.md` §3.2/§3.3/R-8/R-8A/§6; `REGISTRATION_RBAC_IMPACT.md` §4.7/§5/§7; `REGISTRATION_WORKFLOW_SPEC.md` §3.2/§3.3 | ✅ |
| A7 | Reword invariant: writes pass through SECURITY DEFINER RPCs **or the service-role admin client** (signup-time row creation); approval transitions RPC-only | `PHASE_3C_SECURITY_REMEDIATION.md` §3.2 | ✅ |
| A8 | RPC count normalized: 8 functions = 7 client-facing + `send_notification` helper | `REGISTRATION_DATABASE_CHANGES.md` §4; `PHASE_3C_IMPLEMENTATION_PLAN.md` §1/§3 | ✅ |
| A9 | Pre-migration verification for `notifications.old_metadata`; stale `database.types.ts` note | `REGISTRATION_DATABASE_CHANGES.md` §6.1; `PHASE_3C_IMPLEMENTATION_PLAN.md` 1.14 | ✅ |
| A10 | **Retain** `idx_user_roles_user_active`; constraint drop name `user_roles_church_id_user_id_role_id_key` | `REGISTRATION_DATABASE_CHANGES.md` §6.3/§9; `PHASE_3C_IMPLEMENTATION_PLAN.md` §3 | ✅ |

**Criteria re-check (items 1 and 7 from §1):**

| Criterion | Status |
|---|---|
| 1 — No undocumented dependencies remain | ✅ **Met** — N-1/N-2/N-3 documented with verification steps; M-3 wording reconciled (A7); the accepted residual risk (A6) is now explicitly documented rather than implied |
| 7 — No schema/spec mismatches remain | ✅ **Met** — M-1 resolved by A6 (claims aligned with actual 022 behavior; R-8 expectation corrected); M-2 resolved by A5 (A4 targets `beneficiaries`) |

**Final verdict: ✅ APPROVED_FOR_MIGRATION_GENERATION.**

The migration batch (Phase 3C.1, tasks 1.1–1.14) may be authored against the amended spec. Remaining pre-migration runtime verifications on the scratch/live DB (not spec blockers): `notifications.old_metadata` presence (A9), exact `user_roles` constraint name (A10), and the A4 verification SQL (§8.1 step 3) — all listed in `PHASE_3C_MIGRATION_COLLISION_REPORT.md` §6.
