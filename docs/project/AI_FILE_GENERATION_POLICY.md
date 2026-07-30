# AI File Generation Policy — Church Ministry CRM

**Version:** 1.0  
**Effective:** 2026-07-30  
**Scope:** All AI-generated files in this repository  

---

## 1. Purpose

This policy defines where AI-generated files must be placed in the repository. It prevents root directory pollution and ensures all generated artifacts follow the canonical project structure.

---

## 2. File Placement Rules

### 2.1 Database Documentation

| Content | Target Directory | File Name Pattern |
|---------|-----------------|-------------------|
| Canonical database specification | `docs/database/specifications/` | `CANONICAL_{TOPIC}.md` |
| Domain model documentation | `docs/database/specifications/` | `CANONICAL_DOMAIN_MODEL.md` |
| Canonical permission catalog | `docs/database/specifications/` | `CANONICAL_PERMISSION_CATALOG.md` |
| Canonical role model | `docs/database/specifications/` | `CANONICAL_ROLE_MODEL.md` |
| RLS specification | `docs/database/specifications/` | `CANONICAL_RLS_SPEC.md` |
| Database requirements | `docs/database/specifications/` | `DATABASE_REQUIREMENTS.md` |
| Migration plan | `docs/database/migrations/` | `{CONTEXT}_PLAN.md` |
| Migration manifest | `docs/database/migrations/` | `MIGRATION_MANIFEST.md` |
| Execution plan | `docs/database/migrations/` | `{SCOPE}_PLAN.md` |
| Staging execution order | `docs/database/migrations/` | `STAGING_EXECUTION_ORDER.md` |
| Migration audit report | `docs/database/audits/` | `{SCOPE}_AUDIT_REPORT.md` |
| Migration readiness report | `docs/database/audits/` | `MIGRATION_READINESS_REPORT.md` |
| SQL audit report | `docs/database/audits/` | `{CONTEXT}_SQL_AUDIT_REPORT.md` |
| Compliance matrix | `docs/database/audits/` | `{CONTEXT}_COMPLIANCE_MATRIX.md` |
| Consistency report | `docs/database/audits/` | `{CONTEXT}_CONSISTENCY_REPORT.md` |
| Schema diff report | `docs/database/audits/` | `SCHEMA_DIFF_REPORT.md` |
| Go/no-go verdict | `docs/database/audits/` | `FINAL_GO_NO_GO_VERDICT.md` |
| Execution log | `docs/database/audits/` | `MIGRATION_EXECUTION_LOG.md` |
| Staging execution report | `docs/database/audits/` | `STAGING_EXECUTION_REPORT.md` |
| Pre-migration baseline | `docs/database/validation/` | `PRE_MIGRATION_BASELINE.md` |
| Validation report | `docs/database/validation/` | `{CONTEXT}_VALIDATION.md` |
| Verification script | `docs/database/validation/` | `VERIFICATION_SCRIPT.md` |

### 2.2 Deployment Documentation

| Content | Target Directory | File Name Pattern |
|---------|-----------------|-------------------|
| Deployment runbook | `docs/deployment/runbooks/` | `{SCOPE}_RUNBOOK.md` |
| Rollback runbook | `docs/deployment/runbooks/` | `{SCOPE}_ROLLBACK_RUNBOOK.md` |
| Verification checklist | `docs/deployment/runbooks/` | `{SCOPE}_VERIFICATION_CHECKLIST.md` |
| Readiness checklist | `docs/deployment/runbooks/` | `{SCOPE}_READINESS_CHECKLIST.md` |
| Launch checklist | `docs/deployment/runbooks/` | `LAUNCH_DAY_CHECKLIST.md` |
| Infrastructure plan | `docs/deployment/infrastructure/` | `{SCOPE}_INFRASTRUCTURE_PLAN.md` |
| Infrastructure gap analysis | `docs/deployment/infrastructure/` | `INFRASTRUCTURE_GAP_ANALYSIS.md` |
| Platform decision | `docs/deployment/infrastructure/` | `{PLATFORM}_DECISION.md` |
| Setup guide | `docs/deployment/guides/` | `{SERVICE}_SETUP_GUIDE.md` |
| Deployment guide | `docs/deployment/guides/` | `{PLATFORM}_DEPLOYMENT_GUIDE.md` |
| Environment variable matrix | `docs/deployment/guides/` | `ENVIRONMENT_VARIABLE_MATRIX.md` |
| Go-live gate | `docs/deployment/` | `MVP_GO_LIVE_GATE.md` |

### 2.3 Project Documentation

| Content | Target Directory | File Name Pattern |
|---------|-----------------|-------------------|
| Implementation roadmap | `docs/project/roadmaps/` | `{PHASE}_IMPLEMENTATION_ROADMAP.md` |
| Phase execution plan | `docs/project/roadmaps/` | `{PHASE}_EXECUTION_PLAN.md` |
| Phase review | `docs/project/roadmaps/` | `{PHASE}_REVIEW.md` |
| Product requirements | `docs/project/` | `PRD_{VERSION}.md` |
| MVP scope | `docs/project/roadmaps/` | `MVP_SCOPE.md` |
| MVP backlog | `docs/project/roadmaps/` | `MVP_BACKLOG.md` |
| Gate review | `docs/project/decisions/` | `{SCOPE}_GATE_REVIEW.md` |
| Architecture decision | `docs/project/decisions/` | `{TOPIC}_DECISION.md` |
| Conflict matrix | `docs/project/decisions/` | `{SCOPE}_CONFLICT_MATRIX.md` |
| Gap analysis | `docs/project/decisions/` | `{SCOPE}_GAP_ANALYSIS.md` |

### 2.4 Infrastructure & Configuration

| Content | Target Directory | File Name Pattern |
|---------|-----------------|-------------------|
| CI/CD workflow | `.github/workflows/` | `{name}.yml` |
| Environment template | Root | `.env.local.example` |
| Docker configuration | Root | `Dockerfile`, `docker-compose.yml` |

---

## 3. Prohibited Locations

| Location | Rationale | Exception |
|----------|-----------|-----------|
| Repository root (for non-permitted files) | Causes root pollution, obscures source files | None — see Section 5 for permit list |
| `src/` directory | Source code only | Documentation in code comments is acceptable |
| `supabase/migrations/` | SQL migration files only | Migration manifests or plans do NOT belong here |
| `node_modules/` | Dependency directory | Never write here |

---

## 4. File Naming Rules

| Rule | Detail |
|------|--------|
| Use UPPER_SNAKE_CASE | `CANONICAL_DATABASE_SPEC.md`, `PRODUCTION_DEPLOYMENT_RUNBOOK.md` |
| Use descriptive prefixes | `CANONICAL_` (specifications), `FINAL_` (gate docs), `PRE_` (baselines) |
| Use category suffixes | `_REPORT.md`, `_PLAN.md`, `_GUIDE.md`, `_RUNBOOK.md`, `_CHECKLIST.md` |
| Avoid generic names | NOT `report.md` — instead `MIGRATION_AUDIT_REPORT.md` |
| Include date context | Add `YYYY-MM-DD` in header, not in filename |

---

## 5. Root-Level Permit List (Non-Config)

Only these files may reside at the repository root:

```
README.md
SECURITY.md
```

All other generated documentation must be placed in `docs/` subdirectories according to Sections 2.1–2.4.

---

## 6. Enforcement Rules

| Rule | Detail |
|------|--------|
| Before merge commit | All root-level generated files must be relocated to `docs/` |
| `.gitignore` awareness | Do NOT rely on `.gitignore` for Docs — verify files are tracked |
| Review requirement | Every generated file location must be reviewed before committing |
| Header requirement | Every generated doc must include `**Prepared:** YYYY-MM-DD` |
| One topic per file | Do not combine multiple reports into a single file |
| Read-only after commit | Audits and reports become static snapshots once committed |

---

## 7. Quick Reference — By Task Type

```
Current task: Database specification
  → Place in: docs/database/specifications/
  → Example: docs/database/specifications/CANONICAL_DOMAIN_MODEL.md

Current task: Migration planning
  → Place in: docs/database/migrations/
  → Example: docs/database/migrations/STAGING_EXECUTION_ORDER.md

Current task: Migration auditing
  → Place in: docs/database/audits/
  → Example: docs/database/audits/MIGRATION_AUDIT_REPORT.md

Current task: Pre-migration validation
  → Place in: docs/database/validation/
  → Example: docs/database/validation/PRE_MIGRATION_BASELINE.md

Current task: Deployment runbook
  → Place in: docs/deployment/runbooks/
  → Example: docs/deployment/runbooks/PRODUCTION_DEPLOYMENT_RUNBOOK.md

Current task: Infrastructure planning
  → Place in: docs/deployment/infrastructure/
  → Example: docs/deployment/infrastructure/PRODUCTION_INFRASTRUCTURE_PLAN.md

Current task: Deployment guide
  → Place in: docs/deployment/guides/
  → Example: docs/deployment/guides/VERCEL_DEPLOYMENT_GUIDE.md

Current task: Project roadmap
  → Place in: docs/project/roadmaps/
  → Example: docs/project/roadmaps/PHASE_3_IMPLEMENTATION_ROADMAP.md

Current task: Gate review / decision
  → Place in: docs/project/decisions/
  → Example: docs/project/decisions/FINAL_PRODUCTION_GATE_REVIEW.md
```
