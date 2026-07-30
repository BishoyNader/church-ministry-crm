# Church Ministry CRM — Documentation Index

## Canonical Directory Structure

```
docs/
├── architecture/                    # System architecture documents
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── ARCHITECTURE_ALIGNMENT_REPORT.md
│   └── CLASS_ACCESS_ARCHITECTURE.md
├── database/
│   ├── specifications/              # Canonical specs, domain models, RLS specs
│   │   ├── CANONICAL_DATABASE_SPEC.md
│   │   ├── CANONICAL_DOMAIN_MODEL.md
│   │   ├── CANONICAL_ASSIGNMENT_MODEL.md
│   │   ├── CANONICAL_PERMISSION_CATALOG.md
│   │   ├── CANONICAL_RLS_SPEC.md
│   │   ├── CANONICAL_ROLE_MODEL.md
│   │   └── DATABASE_REQUIREMENTS.md
│   ├── migrations/                  # Migration plans, manifests, execution plans
│   │   ├── DATABASE_MIGRATION_PLAN.md
│   │   ├── EXECUTION_PLAN.md
│   │   ├── MIGRATION_MANIFEST.md
│   │   ├── STAGING_DRY_RUN_PLAN.md
│   │   └── STAGING_EXECUTION_ORDER.md
│   ├── audits/                      # Audit reports, compliance matrices, execution logs
│   │   ├── CANONICAL_COMPLIANCE_MATRIX.md
│   │   ├── CANONICAL_CONSISTENCY_REPORT.md
│   │   ├── EXECUTION_PLAN_AUDIT_REPORT.md
│   │   ├── FINAL_GO_NO_GO_VERDICT.md
│   │   ├── FINAL_SQL_AUDIT_REPORT.md
│   │   ├── MIGRATION_AUDIT_REPORT.md
│   │   ├── MIGRATION_EXECUTION_LOG.md
│   │   ├── MIGRATION_READINESS_REPORT.md
│   │   ├── SCHEMA_DIFF_REPORT.md
│   │   └── STAGING_EXECUTION_REPORT.md
│   └── validation/                  # Baselines, verification scripts, pre-validation
│       ├── FINAL_PRE_GENERATION_VALIDATION.md
│       ├── PRE_MIGRATION_BASELINE.md
│       └── VERIFICATION_SCRIPT.md
├── deployment/
│   ├── runbooks/                    # Production runbooks, checklists, rollback plans
│   │   ├── LAUNCH_DAY_CHECKLIST.md
│   │   ├── PRODUCTION_DEPLOYMENT_RUNBOOK.md
│   │   ├── PRODUCTION_READINESS_CHECKLIST.md
│   │   ├── PRODUCTION_ROLLBACK_RUNBOOK.md
│   │   └── PRODUCTION_VERIFICATION_CHECKLIST.md
│   ├── infrastructure/              # Infrastructure plans, gap analyses, platform decisions
│   │   ├── DEPLOYMENT_PLATFORM_DECISION.md
│   │   ├── INFRASTRUCTURE_GAP_ANALYSIS.md
│   │   └── PRODUCTION_INFRASTRUCTURE_PLAN.md
│   ├── guides/                      # Setup guides (Supabase, Vercel, env vars)
│   │   ├── ENVIRONMENT_VARIABLE_MATRIX.md
│   │   ├── SUPABASE_PRODUCTION_SETUP_GUIDE.md
│   │   └── VERCEL_DEPLOYMENT_GUIDE.md
│   └── MVP_GO_LIVE_GATE.md
├── design/                          # Design system specs, screen inventories
│   ├── DASHBOARD_SPECIFICATIONS.md
│   ├── DESIGN_SYSTEM_REQUIREMENTS.md
│   └── SCREEN_INVENTORY.md
├── project/
│   ├── roadmaps/                    # Implementation roadmaps, backlogs, phase plans
│   │   ├── IMPLEMENTATION_ROADMAP.md
│   │   ├── MVP_BACKLOG.md
│   │   ├── MVP_SCOPE.md
│   │   ├── PHASE_1B_EXECUTION_CHECKLIST.md
│   │   ├── PHASE_1C_PRE_EXECUTION_REVIEW.md
│   │   └── PHASE_3_IMPLEMENTATION_ROADMAP.md
│   ├── decisions/                   # Gate reviews, architecture decisions, conflict matrices
│   │   ├── CANONICAL_PROJECT_STRUCTURE.md
│   │   ├── DOCUMENTATION_REORGANIZATION_REPORT.md
│   │   ├── DOCUMENT_CONFLICT_MATRIX.md
│   │   ├── FINAL_PRODUCTION_GATE_REVIEW.md
│   │   ├── GAP_ANALYSIS.md
│   │   └── REPOSITORY_ORGANIZATION_REPORT.md
│   └── AI_FILE_GENERATION_POLICY.md
├── security/                        # RBAC, RLS, data migration risk docs
│   ├── DATA_MIGRATION_RISKS.md
│   ├── RBAC_ARCHITECTURE.md
│   └── RLS_IMPLEMENTATION_PLAN.md
├── testing/                         # QA test plans, readiness checklists
│   ├── MVP_READINESS_CHECKLIST.md
│   └── QA_TEST_PLAN.md
└── archive/                         # Superseded/historical documents
    ├── PRD.md
    └── PRD_V3.md
```

## Source-of-Truth Hierarchy

| Rank | Document | Purpose |
|------|----------|---------|
| 1 | `database/specifications/CANONICAL_DATABASE_SPEC.md` | Canonical schema, entity relationships, constraints |
| 2 | `database/specifications/CANONICAL_DOMAIN_MODEL.md` | Domain model, business rules, aggregate definitions |
| 3 | `database/specifications/CANONICAL_RLS_SPEC.md` | Per-table RLS policy specification |
| 4 | `database/specifications/CANONICAL_PERMISSION_CATALOG.md` | Permission matrix, role grants, access rules |
| 5 | `database/specifications/CANONICAL_ROLE_MODEL.md` | Role definitions, hierarchy, inheritance |
| 6 | `architecture/SYSTEM_ARCHITECTURE.md` | System design, technology stack, integration patterns |
| 7 | `security/RBAC_ARCHITECTURE.md` | Role definitions, permission matrix, access rules |
| 8 | `security/RLS_IMPLEMENTATION_PLAN.md` | Per-table RLS policy specification |
| 9 | `project/roadmaps/IMPLEMENTATION_ROADMAP.md` | Phase ordering, delivery timeline, dependencies |
| 10 | `deployment/MVP_GO_LIVE_GATE.md` | Go-live gate criteria, sign-off, rollback triggers |

All other documents derive from or reference these sources of truth.

## Document Lifecycle

- **Current** — documents in active folders (`database/`, `deployment/`, `project/`, etc.)
- **Superseded** — moved to `archive/` when a newer version exists
- Documents are never deleted; only moved to `archive/`
