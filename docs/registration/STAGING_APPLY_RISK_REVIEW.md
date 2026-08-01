# Phase 3C.2A.5 — Staging Apply Risk Review

**Scope:** `supabase/migrations/023_phase3c_registration.sql` apply to staging (`dyfgflmrsmzgvpknbesi`).
**Basis:** baseline verified against the actual local 022 catalog; staging-side facts flagged `[STAGING-SIDE]` must be confirmed by the engineer during Step 1/2 of `STAGING_APPLY_CHECKLIST.md`.

---

## 1. Verdict

| Class | Verdict |
|---|---|
| Blocking risks | **0** |
| High risks | **0** |
| Medium risks | **2** (M-2, M-3) — both non-blocking, managed by this package |
| Low risks / observations | **3** (L-1, L-2, L-3) |

**Conclusion:** migration 023 is **READY_TO_EXECUTE_ON_STAGING** subject to the two medium-risk mitigations (drop the stray `audit_children` trigger; confirm staging-side access to apply/verify commands).

---

## 2. New baseline findings from actual verification (not in the deployment plan)

### FR-1 — `audit_trigger_fn` is stale; 5 audit triggers point at renamed/dead tables (medium impact, LOW risk to apply)

The actual baseline differs from the plan's assumption (plan expected zero audit triggers):

- `audit_trigger_fn()` (the shared audit trigger function) has a **stale definition**: it declares `v_action audit_action` (type dropped by 019) and inserts `user_id` (column renamed to `actor_id` by 019).
- It therefore raises `ERROR: type "audit_action" does not exist` on any firing DML — **no audit rows are written by app DML today** (confirmed by runtime test).
- Five triggers are wired to wrong/dead tables: `audit_profiles→profiles`, `audit_user_roles→user_roles`, `audit_followups→followups`, `audit_children→beneficiaries`, `audit_attendance→attendance_backup_20260730`.

**Assessment:** 023 S9/S10 is a **corrective repair**, not a mere replacement — it redefines the function (TEXT action, `actor_id`) and rewires triggers (drops dead `audit_attendance` at 023:237, creates `audit_profiles`, `audit_user_roles`, `audit_followups`, `audit_children`→`beneficiaries`). **No risk to the apply**; the migration makes the baseline strictly better.

### FR-2 — Stray `audit_children` trigger survives the migration (handled by Step 3)

023 drops the dead `audit_attendance` trigger but does **not** drop the leftover `audit_children` trigger on `beneficiaries`. After apply, `beneficiaries` DML would fire both `audit_children` and the new `audit_beneficiaries` → duplicated audit rows, and the naive "exactly 6 triggers" check would show 7.

**Mitigation (Step 3 of the checklist):** `DROP TRIGGER IF EXISTS audit_children ON beneficiaries;` before apply. If the approver rejects any out-of-migration SQL, accept duplicate audit rows and amend V4 to expect 7 triggers. Data-quality only — no integrity/security impact.

### FR-3 — `list_churches_for_signup` semantics confirmed correct

Verified: function filters `WHERE NOT (SELECT user_is_super_admin(churches.created_by))` and row-security is enforced on `churches` (RLS), so a signed-in **authenticated** user cannot read other users' churches via this endpoint. The R-9 expectation (users see only their own) is correct.

---

## 3. Risk matrix

### Blocking (cannot apply)

| ID | Risk | Assessment |
|---|---|---|
| B-1 | Partial apply / orphaned migration tracking | 023 is a single `BEGIN…COMMIT` transaction; any failure rolls back the entire batch. `supabase db push` records `023` in `supabase_migrations` only on success. **Not a live risk.** |

### High (mitigate or halt)

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|---|
| H-1 | RLS breach through new policies/RPCs | Low | Critical | Real-session (never service-role) security regression SE-01…SE-14 (checklist Step 7); R-1…R-16 in test matrix | Managed — **0 high risks remain after validation** |
| H-2 | Data loss from S2/S3 (DROP/alterations) | Very Low | Critical | Step 1 backup (custom-format dump of 5 critical tables + full dump); rollback path verified | Managed |

### Medium

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| M-1 | `supabase db push` needs connectivity/pooler access `[STAGING-SIDE]` | Medium | Blocking at apply time | Confirm tooling + `STAGING_DB_URL` in Step 0; fallback method (Step 4) applies file directly via psql |
| M-2 | Duplicate audit rows on `beneficiaries` if stray `audit_children` left in place (FR-2) | Certain (if Step 3 skipped) | Low (data quality) | Checklist Step 3 drop; else amend V4 to expect 7 triggers |
| M-3 | Type regen breaks the app if service files use old signatures | Low | Medium | Checklist Step 8: wrappers pass explicit generics → zero service edits needed; `tsc --noEmit` + build + lint gate before merge |
| M-4 | `approve_servant`/`reject_servant` execute grant removed from `authenticated` → existing 2A admin flow breaks | Low | High | Verified 2A.4 admin flow uses service-role admin client (3C.2A.3); no `src/` session-client write path on the 3 closed tables (PF-24) |
| M-5 | Audit function still broken if S9/S10 partially applied | Negligible | Medium | Single transaction; V4 post-apply writes test |

### Low / observations

| ID | Risk | Assessment |
|---|---|---|
| L-1 | Local DB is at 022; `supabase gen types --local` would not include 023 | Checklist Step 8 targets staging via `--db-url` (or migrate local to 023 first) |
| L-2 | `notifications.church_id` becomes nullable (S3) — no NOT NULL guard | Accepted by design; insert paths verified to always set it (3C.2A.3) |
| L-3 | `idx_user_roles_user_active` (020) vs new `uq_user_roles_active` overlap | Overlap only; both valid; S8 drops the UNIQUE constraint, keeps 020 index |

---

## 4. Security validation mapping (R-1…R-16 → test IDs)

| Security requirement | Test | Expectation |
|---|---|---|
| R-1 tenant isolation | SE-01 | Cross-tenant access DENIED |
| R-2 self-escalation | SE-02 | DENIED (no admin/super_admin grant from self) |
| R-3 self-approval | SE-03/SE-04 | DENIED for church request & servant approval |
| R-4 no cross-church effect | SE-05 | DENIED |
| R-5 no notification spoof | SE-06/SE-07 | DENIED |
| R-6 church request immutability | SE-10/SE-11 | No update/delete of requests |
| R-7 own-profile insert fail-closed | SE-09 | Authenticated DENIED; service-role allowed (SE-09a) |
| R-8 platform-owner gate | SE-13 | Non-PO DENIED on PO functions |
| R-9 signup listing | SE-14 | Authenticated sees only own church |
| R-10 audit immutability | SE-15 | `immutable_update`/`immutable_delete` hold |

---

## 5. Residual risk after apply (owned by later phases)

- Duplicate/legacy `audit_*` triggers on other renamed tables may surface in Phase 4 (migration fidelity) — tracked as a follow-up, not a blocker.
- Staging may differ from local 022 baseline (`[STAGING-SIDE]` items) — checklist pre-flight PF-1…PF-24 exists precisely to catch divergence before apply.
