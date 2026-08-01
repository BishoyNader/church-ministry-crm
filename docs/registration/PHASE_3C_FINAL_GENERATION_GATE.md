# Phase 3C.1 — Final Generation Gate

**Phase:** 3C — Registration & Church Provisioning
**Date:** 2026-07-31
**Verdict:** `READY_TO_GENERATE_MIGRATIONS`
**Gate:** checked against the Phase 3C.1 design-package criteria (Validated Rules checklist + risk/ambiguity scan of the four design deliverables).

---

## 1. Design-package completeness

| Deliverable | Present | Status |
|---|---|---|
| `PHASE_3C_MIGRATION_EXECUTION_PLAN.md` | ✅ | S1–S12 execution order, P0.1–P0.7 pre-flights, V0–V6 verification, §4 (no permission changes), §5 (RPC behavior notes), §6 rollback R1–R5, §7 open items (D-1…D-8 locked) |
| `PHASE_3C_OBJECT_CHANGE_MATRIX.md` | ✅ | Every touched object: current state → target state → migration action → rollback action, across tables/indexes/constraints/policies/triggers/functions/privileges/catalog |
| `PHASE_3C_DATA_SAFETY_REVIEW.md` | ✅ | Four proofs (no data loss §1, no tenant-isolation break §2, no privilege escalation §3, no audit gap §4), highest-risk statement §5, longest lock §6, rollback-critical objects §7, Validated Rules checklist §8 |
| `PHASE_3C_FINAL_GENERATION_GATE.md` | ✅ | this document |

## 2. Validated Rules checklist (re-verified from design docs)

| Rule | Status | Where |
|---|---|---|
| Existing production data remains valid | ✅ | safety §1; matrix §2/§3 (constraint replacement is superset-proof); P0.4 |
| Existing users keep access | ✅ | safety §2 (SELECT paths preserved on all four replaced policies) |
| Existing churches unaffected | ✅ | matrix §1/§4 (churches untouched; provisioning is runtime, RPC-only) |
| Existing servant assignments unaffected | ✅ | matrix §1 (assignments tables untouched); safety §8 |
| Existing roles unaffected | ✅ | execution plan §4; matrix §8 (catalog unchanged, 52 codes) |
| Existing permissions unaffected | ✅ | matrix §8; execution plan §4 |
| Audit continuity preserved | ✅ | safety §4 (gap closed at commit; `write_audit_log` unchanged; app direct INSERTs still permitted) |
| Registration feature fully supported | ✅ | matrix §6 (8 RPCs) + §1 (church_requests) + V6 flow smoke |

## 3. Risk / ambiguity scan of the design package

Residual risk items from the previous gate (A6 accept-and-document) and this batch's design reviews are all **documented, non-blocking, and verifiable**:

| Item | Class | Handling |
|---|---|---|
| Pending users' same-church church-scoped access (022 FOR ALL on ~18 tables) | accepted residual (A6) | out of scope; asserted on role-gated surfaces only (R-8/R-8A) |
| `profiles.own_profile_insert` fail-closed (D-5) | design decision | signup path is service-role admin client; V5/R-16 |
| `church_requests` review-column spoof at submit (N-10) | cosmetic | review RPCs overwrite all fields; non-blocking |
| `old_metadata` leftover (N-1) | legacy | pre-flight P0.2 documents it; no change |
| Longest lock (S8) | Med | P0.4 guard, scratch-first, maintenance window |
| Rollback-critical objects | Mitigated | R1–R5 + snapshot; blocked-rollback cases enumerated (safety §7) |
| New risk or ambiguity surfaced by the three new design docs | **none** | cross-checked matrix ↔ execution plan ↔ safety: object lists, action/rollback pairs, and rule evidence all agree |

## 4. Verdict

**`READY_TO_GENERATE_MIGRATIONS`**

The design package is complete and self-consistent. The SQL author may now generate `supabase/migrations/023_phase3c_registration.sql` strictly per `PHASE_3C_MIGRATION_EXECUTION_PLAN.md` (locked signatures §1.2, privilege surface §1.3, D-1…D-8, execution order S1–S12, P0 pre-flights, V0–V6 verification, R1–R5 rollback).

**Gate re-check condition:** if generation surfaces any conflict with the matrix, a change in scope, or a verification failure (V1–V6), stop and return to this gate with `REQUIRES_PLAN_CHANGES` and the item that must be corrected.
