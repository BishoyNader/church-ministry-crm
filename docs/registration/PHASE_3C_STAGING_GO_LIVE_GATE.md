# Phase 3C.3 — Staging Go-Live Gate

**Phase:** 3C — Registration & Church Provisioning
**Stage:** 3C.3 — Staging Deployment Readiness Review
**Date:** 2026-08-01
**Target:** apply `023_phase3c_registration.sql` to the staging environment
**This gate:** formal sign-off authority for staging execution (apply + verify + validate).
**Companion docs:** `PHASE_3C_STAGING_DEPLOYMENT_PLAN.md`, `PHASE_3C_STAGING_TEST_MATRIX.md`,
`PHASE_3C_STAGING_ROLLBACK_PLAN.md`

---

## 1. Gate Verdict

| | |
|---|---|
| **Verdict (pre-execution):** | **READY_FOR_STAGING_EXECUTION** |
| Migration 023 audit verdict | **GO** — 0 BLOCKING / 0 HIGH / 0 MEDIUM / 4 LOW / 3 INFO (`PHASE_3C_MIGRATION_AUDIT_REPORT.md`) |
| Compliance | 100% (70/70, `PHASE_3C_COMPLIANCE_MATRIX.md`) |
| Unresolved deployment risks | **None** — all 17 classified risks are LOW/MED, each bounded by a pre-flight or immediate-verification gate (deployment plan §3.7) |
| Rollback | Defined (primary snapshot restore + in-place R1–R5) — `PHASE_3C_STAGING_ROLLBACK_PLAN.md` |
| Effective | On completion of §2 (pre-execution conditions) + §3 (Step 0–2 apply) |

---

## 2. Success Criteria (pre-execution readiness)

Every criterion below must be **PASS** before the apply step may start.

| # | Criterion | Requirement | Evidence source | Status |
|---|---|---|---|---|
| G-1 | Migration 023 audit passed | Zero BLOCKING/HIGH/MEDIUM findings; LOW items non-blocking with dispositions | `PHASE_3C_MIGRATION_AUDIT_REPORT.md` §1, §3; `PHASE_3C_GO_NO_GO_VERDICT.md` | **PASS** ✅ |
| G-2 | Rollback defined | Trigger criteria, decision tree, execution order, verification | `PHASE_3C_STAGING_ROLLBACK_PLAN.md` | **PASS** ✅ |
| G-3 | Security validation defined | R-1…R-16 regression + S12 privilege lockdown + R-16 fail-closed | Test matrix §4 (SE-01…SE-17) | **PASS** ✅ |
| G-4 | Registration flows fully covered | Existing-church request/approval/rejection + new-church submit/approve/reject + edge cases | Test matrix §2 (EC-01…EC-03) and §3 (NC-01…NC-03) | **PASS** ✅ |
| G-5 | Audit verification covered | Function def, 6 triggers, RPC audit rows, trigger smoke, immutability | Test matrix §5 (AU-01…AU-06) | **PASS** ✅ |
| G-6 | No unresolved deployment risks | Risk register: 17 items, all LOW/MED, each gated (P0.x or V1–V4); F-001…F-004 tracked non-blocking | Deployment plan §3.7, §7 | **PASS** ✅ |

**All six criteria PASS → gate is pre-authorized for execution.**

---

## 3. Pre-Execution Conditions (P0.1–P0.7 — mandatory, run before apply)

| # | Condition | Owner | Complete |
|---|---|---|---|
| P0.1 | Confirm first 3C batch (no `church_requests`, no migration 023) | DBA | ⬜ |
| P0.2 | Confirm `notifications.old_metadata` exists (A9) | DBA | ⬜ |
| P0.3 | Confirm exact UNIQUE constraint name `user_roles_church_id_user_id_role_id_key` | DBA | ⬜ |
| P0.4 | **Zero duplicate active grants** (guarantees `uq_user_roles_active` builds) | DBA | ⬜ |
| P0.5 | No authenticated-client write paths against `user_roles`/`servants`/`notifications` | App lead | ⬜ |
| P0.6 | Backup snapshot taken + verified (Step 0) | DBA | ⬜ |
| P0.7 | Scratch project: 001–023 applied; V1–V6 executed and PASS (incl. R-1…R-16) | QA | ⬜ |

Mapping to the deployment plan's PF-# checks: P0.1→PF-1/PF-2, P0.2→PF-9, P0.3→PF-7, P0.4→PF-22,
P0.5→PF-24, P0.6→PF-25/26, P0.7→PF-27.

**Exit rule:** P0.1–P0.7 all complete → proceed to Step 0/1/2. Any FAIL → `REQUIRES_CHANGES` (see §5).

---

## 4. Step-by-Step Gate Sign-Off

Complete and sign each step in order during the execution window.

| Step | Activity | Owner | Pass criterion | Result | Sign-off |
|---|---|---|---|---|---|
| 0 | **Backup** | DBA | S0.1–S0.4 pass (dump + checksum + restore smoke) | ⬜ | ⬜ |
| 1 | **Pre-flight verification** | DBA | PF-1…PF-27 all PASS | ⬜ | ⬜ |
| 2 | **Apply migration 023** | DBA | Single-transaction apply, exit 0, no partial state | ⬜ | ⬜ |
| 3 | **Database verification** | DBA | V1–V4 all PASS (schema, policies, functions/privileges, audit continuity) | ⬜ | ⬜ |
| 4 | **Registration workflow validation** | QA | Test matrix §2 (EC-*) + §3 (NC-*) primary flows PASS | ⬜ | ⬜ |
| 5 | **Security validation** | Security | Test matrix §4 (SE-01…SE-17) + §5 (AU-01…AU-06) all PASS; negative cases use real sessions | ⬜ | ⬜ |
| 6 | **Sign-off gate** | Approver | All success criteria confirmed with evidence; verdict recorded (§5) | ⬜ | ⬜ |

**Rollback escalation:** any FAIL in Steps 3–5 triggers the `PHASE_3C_STAGING_ROLLBACK_PLAN.md` decision tree.

---

## 5. Final Verdict (post-execution — record here)

| Option | Meaning | Selection |
|---|---|---|
| `STAGING_VERIFIED` | All steps 0–6 pass; staging is ready to carry the 3C registration features | ⬜ |
| `ROLLED_BACK` | A rollback trigger fired; staging returned to the 022 baseline (see rollback log) | ⬜ |
| `REQUIRES_CHANGES` | A non-blocking gap was found; changes needed before production go-live | ⬜ |

**Pre-execution determination (this package):**

`READY_FOR_STAGING_EXECUTION` — migration 023 may be applied to the staging environment **after**
P0.1–P0.7 pass and the scratch V1–V6 gate is green.

---

## 6. Signatures

| Role | Name | Date | Signature |
|---|---|---|---|
| DBA / Migration executor | | | |
| QA / Test matrix executor | | | |
| Security reviewer | | | |
| Approver | | | |

---

## 7. References

- `PHASE_3C_STAGING_DEPLOYMENT_PLAN.md` — risk review, pre-flight checklist, execution order
- `PHASE_3C_STAGING_TEST_MATRIX.md` — EC-*/NC-*/SE-*/AU-* tests
- `PHASE_3C_STAGING_ROLLBACK_PLAN.md` — trigger criteria, decision tree, R0–R5, verification
- `PHASE_3C_MIGRATION_EXECUTION_PLAN.md`, `PHASE_3C_MIGRATION_AUDIT_REPORT.md`, `PHASE_3C_GO_NO_GO_VERDICT.md`,
  `PHASE_3C_SECURITY_REMEDIATION.md`
