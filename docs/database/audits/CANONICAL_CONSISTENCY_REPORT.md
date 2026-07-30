# Canonical Consistency Report

**Date:** 2026-07-30
**Phase:** Phase 2A (Pre-Generation Validation — Canonical Doc Consistency)

---

## 1. Scope

Verify that all 6 canonical documentation files and the execution plan use the `Church → Service → Stage → Class` entity hierarchy consistently, with no stale references to `Ministry` as a canonical entity name.

## 2. Terminology Scan

Grep performed across all canonical docs + execution plan for `ministr(y|ies|_id)`.

### Findings Summary

| # | File | Stale Entity Refs | Notes |
|---|------|-------------------|-------|
| 1 | `CANONICAL_DOMAIN_MODEL.md` | 0 | All uses are generic English ("serves in ministry") or explicit rename history |
| 2 | `CANONICAL_DATABASE_SPEC.md` | 0 | Line 499 is a migration note (`ministry_id → service_id`), not stale |
| 3 | `CANONICAL_RLS_SPEC.md` | ~~1~~ → 0 | Line 334 had `ministry_id` — **fixed** (`service_id`) |
| 4 | `CANONICAL_ROLE_MODEL.md` | 0 | "Ministry Leader" is a business title, not entity reference |
| 5 | `CANONICAL_ASSIGNMENT_MODEL.md` | 0 | All references use `service_id`, `stage_id`, `class_id` correctly |
| 6 | `EXECUTION_PLAN.md` | 0 | All `ministry` references are migration SQL (old→new), correct |
| 7 | `SCHEMA_DIFF_REPORT.md` | 0 | All `ministry` references describe old schema, correct |
| 8 | `FINAL_PRE_GENERATION_VALIDATION.md` | 0 | Flags the stale reference correctly; no issues of its own |

## 3. Corrections Applied

| Doc | Line | Before | After | Status |
|-----|------|--------|-------|--------|
| `CANONICAL_RLS_SPEC.md` | 334 | `ministry_id = ANY(get_user_service_ids())` | `service_id = ANY(get_user_service_ids())` | ✅ Applied |

## 4. Hierarchy Verification

| Hierarchy | Status |
|-----------|--------|
| `Church → Service → Stage → Class` entity nesting | ✅ Consistent across all docs |
| Service Owner: `Church → Service` | ✅ Consistent |
| Stage Owner: `Church → Service` | ✅ Consistent |
| Class Owner: `Church → Service → Stage` | ✅ Consistent |
| FK references (`church_id`, `service_id`, `stage_id`) | ✅ Consistent |
| RLS scope inheritance | ✅ Consistent |
| Role scoping (L1 Church, L2 Service, L3 Stage) | ✅ Consistent |

## 5. Verdict

```
╔══════════════════════════════════════════╗
║  CANONICAL CONSISTENCY: CONSISTENT ✅    ║
║                                          ║
║  1 documentation bug found and fixed     ║
║  0 stale entity references remain        ║
║  Hierarchy commitment matches all docs   ║
║                                          ║
║  Next: Phase 2B — Migration File Gen     ║
╚══════════════════════════════════════════╝
```
