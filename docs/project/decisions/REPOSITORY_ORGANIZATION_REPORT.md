# Repository Organization Report — Church Ministry CRM

**Prepared:** 2026-07-30  
**Auditor:** Automated Repository Scan  

---

## 1. Current Repository Structure

```
/ (root)
├── .agents/                          # AI skill definitions
├── .claude/                          # AI tool configuration
├── .cursor/                          # AI tool configuration
├── .git/
├── .next/                            # Build cache (gitignored)
├── docs/
│   ├── architecture/                 # System architecture docs
│   ├── archive/                      # Historical documents
│   ├── database/                     # Database plans & requirements
│   ├── design/                       # Design specs
│   ├── implementation/               # Roadmaps & backlogs
│   ├── product/                      # PRD, MVP scope, gap analysis
│   ├── README.md
│   ├── security/                     # RBAC, RLS docs
│   └── testing/                      # QA test plan
├── node_modules/                     # Dependencies (gitignored)
├── public/                           # Static assets (SVG icons)
├── src/                              # Application source code (134 TS/TSX files)
├── supabase/
│   ├── .branches/                    # Git metadata (gitignored)
│   ├── .temp/                        # CLI metadata (gitignored)
│   └── migrations/                   # 22 SQL migration files
├── middleware.ts                     # Auth + i18n middleware
├── next.config.ts                    # Next.js config
├── package.json                      # Dependencies
├── package-lock.json                 # Lockfile
├── tsconfig.json                     # TypeScript config
├── postcss.config.mjs                # PostCSS config
├── eslint.config.mjs                 # ESLint config
├── components.json                   # shadcn/ui config
├── skills-lock.json                  # AI skills lock
├── .gitignore                        # Git ignore rules
├── .env.local                        # Local env secrets (gitignored)
├── .env.local.example                # Env template
├── README.md                         # Project README
├── SECURITY.md                       # Security policy
├── next-env.d.ts                     # Next.js types (generated)
├── tsconfig.tsbuildinfo              # TS cache (generated)

├── [38 ROOT-LEVEL AUDIT/PLANNING/DEPLOYMENT DOCUMENTS]
│   # CANONICAL* (8 files)
│   # MIGRATION* (5 files)
│   # EXECUTION* (2 files)
│   # FINAL* (4 files)
│   # STAGING* (4 files)
│   # PRODUCTION* (5 files)
│   # DOCUMENT* (2 files)
│   # PHASE* (2 files)
│   # PRE_*, SCHEMA_*, VERIFICATION_*, ENVIRONMENT_*, INFRASTRUCTURE_*
│   # DEPLOYMENT_*, LAUNCH_*, MVP_*, SUPABASE_*, VERCEL_*
```

---

## 2. Complete File Inventory

### 2.1 Application Source Code (134 files — stays in `src/`)

```
src/app/                    # Next.js App Router pages (12 routes)
src/components/             # UI components (26 files)
src/features/               # Feature modules: auth, children, dashboard, rbac, stages, users
src/i18n/                   # Internationalization (navigation, routing, messages)
src/lib/                    # Utilities (Supabase clients, direction helpers)
src/providers/              # React providers (query, theme)
src/types/                  # TypeScript type definitions
```

**Status:** KEEP — no changes needed.

### 2.2 Configuration Files (9 files — root level)

| File | Purpose | Recommended Location |
|------|---------|---------------------|
| `next.config.ts` | Next.js build config | Root (framework required) |
| `postcss.config.mjs` | PostCSS/Tailwind config | Root (framework required) |
| `eslint.config.mjs` | ESLint config | Root (framework required) |
| `tsconfig.json` | TypeScript config | Root (framework required) |
| `components.json` | shadcn/ui config | Root (framework required) |
| `package.json` | Dependencies | Root (npm required) |
| `package-lock.json` | Lockfile | Root (npm required) |
| `skills-lock.json` | AI skills lock | Root |
| `middleware.ts` | Next.js middleware | Root (framework required) |

**Status:** KEEP at root — framework-required locations.

### 2.3 Infrastructure & Environment (5 files — some root, some hidden)

| File | Purpose | Status |
|------|---------|--------|
| `.gitignore` | Git ignore rules | Root — KEEP |
| `.env.local` | Local secrets | Root — KEEP (gitignored) |
| `.env.local.example` | Env template | Root — KEEP |
| `next-env.d.ts` | Generated TS types | Root — KEEP (gitignored as generated) |
| `tsconfig.tsbuildinfo` | TS incremental build cache | Root — KEEP (gitignored as generated) |

### 2.4 Database Migrations (22 files — `supabase/migrations/`)

```
001_initial_schema.sql
002_rls_policies.sql
...
022_rls_implementation.sql
```

**Status:** KEEP — canonical migration location. **All 007–022 are untracked — must be staged before merge.**

### 2.5 Documentation Files (existing `docs/` directory — 21 files)

| Path | Category | Recommended Location |
|------|----------|---------------------|
| `docs/architecture/SYSTEM_ARCHITECTURE.md` | Architecture | `docs/architecture/` — KEEP |
| `docs/architecture/ARCHITECTURE_ALIGNMENT_REPORT.md` | Architecture | `docs/architecture/` — KEEP |
| `docs/architecture/CLASS_ACCESS_ARCHITECTURE.md` | Architecture | `docs/architecture/` — KEEP |
| `docs/database/DATABASE_MIGRATION_PLAN.md` | Migration plan | Move → `docs/database/migrations/` |
| `docs/database/DATABASE_REQUIREMENTS.md` | Spec | Move → `docs/database/specifications/` |
| `docs/design/*` (3 files) | Design | `docs/design/` — KEEP |
| `docs/implementation/IMPLEMENTATION_ROADMAP.md` | Roadmap | Move → `docs/project/roadmaps/` |
| `docs/implementation/MVP_BACKLOG.md` | Roadmap | Move → `docs/project/roadmaps/` |
| `docs/implementation/PHASE_1B_EXECUTION_CHECKLIST.md` | Roadmap | Move → `docs/project/roadmaps/` |
| `docs/product/GAP_ANALYSIS.md` | Decision | Move → `docs/project/decisions/` |
| `docs/product/MVP_SCOPE.md` | Roadmap | Move → `docs/project/roadmaps/` |
| `docs/product/PRD_V3.md` | Product | `docs/archive/` — KEEP |
| `docs/security/*` (3 files) | Security | `docs/security/` — KEEP |
| `docs/testing/*` (2 files) | Testing | `docs/testing/` — KEEP |
| `docs/archive/PRD.md` | Archive | `docs/archive/` — KEEP |
| `docs/README.md` | Documentation index | KEEP — update with new structure |

### 2.6 Root-Level Generated Documents (38 files — all untracked)

#### CANONICAL Specifications (8 files)

| File | Classification | Target Directory |
|------|---------------|-----------------|
| `CANONICAL_DATABASE_SPEC.md` | Database specification | `docs/database/specifications/` |
| `CANONICAL_DOMAIN_MODEL.md` | Database specification | `docs/database/specifications/` |
| `CANONICAL_ASSIGNMENT_MODEL.md` | Database specification | `docs/database/specifications/` |
| `CANONICAL_PERMISSION_CATALOG.md` | Database specification | `docs/database/specifications/` |
| `CANONICAL_RLS_SPEC.md` | Database specification | `docs/database/specifications/` |
| `CANONICAL_ROLE_MODEL.md` | Database specification | `docs/database/specifications/` |
| `CANONICAL_COMPLIANCE_MATRIX.md` | Database audit | `docs/database/audits/` |
| `CANONICAL_CONSISTENCY_REPORT.md` | Database audit | `docs/database/audits/` |

#### Migration & Execution Documents (14 files)

| File | Classification | Target Directory |
|------|---------------|-----------------|
| `MIGRATION_MANIFEST.md` | Migration manifest | `docs/database/migrations/` |
| `EXECUTION_PLAN.md` | Migration plan | `docs/database/migrations/` |
| `STAGING_DRY_RUN_PLAN.md` | Migration plan | `docs/database/migrations/` |
| `STAGING_EXECUTION_ORDER.md` | Migration plan | `docs/database/migrations/` |
| `MIGRATION_AUDIT_REPORT.md` | Migration audit | `docs/database/audits/` |
| `MIGRATION_READINESS_REPORT.md` | Migration audit | `docs/database/audits/` |
| `EXECUTION_PLAN_AUDIT_REPORT.md` | Migration audit | `docs/database/audits/` |
| `SCHEMA_DIFF_REPORT.md` | Migration audit | `docs/database/audits/` |
| `FINAL_SQL_AUDIT_REPORT.md` | Migration audit | `docs/database/audits/` |
| `FINAL_GO_NO_GO_VERDICT.md` | Migration audit | `docs/database/audits/` |
| `MIGRATION_EXECUTION_LOG.md` | Migration audit | `docs/database/audits/` |
| `STAGING_EXECUTION_REPORT.md` | Migration audit | `docs/database/audits/` |
| `PRE_MIGRATION_BASELINE.md` | Database validation | `docs/database/validation/` |
| `FINAL_PRE_GENERATION_VALIDATION.md` | Database validation | `docs/database/validation/` |
| `VERIFICATION_SCRIPT.md` | Database validation | `docs/database/validation/` |

#### Deployment & Infrastructure Documents (13 files)

| File | Classification | Target Directory |
|------|---------------|-----------------|
| `PRODUCTION_DEPLOYMENT_RUNBOOK.md` | Runbook | `docs/deployment/runbooks/` |
| `PRODUCTION_ROLLBACK_RUNBOOK.md` | Runbook | `docs/deployment/runbooks/` |
| `PRODUCTION_VERIFICATION_CHECKLIST.md` | Runbook | `docs/deployment/runbooks/` |
| `PRODUCTION_READINESS_CHECKLIST.md` | Runbook | `docs/deployment/runbooks/` |
| `LAUNCH_DAY_CHECKLIST.md` | Runbook | `docs/deployment/runbooks/` |
| `PRODUCTION_INFRASTRUCTURE_PLAN.md` | Infrastructure | `docs/deployment/infrastructure/` |
| `INFRASTRUCTURE_GAP_ANALYSIS.md` | Infrastructure | `docs/deployment/infrastructure/` |
| `DEPLOYMENT_PLATFORM_DECISION.md` | Infrastructure | `docs/deployment/infrastructure/` |
| `SUPABASE_PRODUCTION_SETUP_GUIDE.md` | Deployment guide | `docs/deployment/` |
| `VERCEL_DEPLOYMENT_GUIDE.md` | Deployment guide | `docs/deployment/` |
| `ENVIRONMENT_VARIABLE_MATRIX.md` | Deployment guide | `docs/deployment/` |
| `MVP_GO_LIVE_GATE.md` | Deployment gate | `docs/deployment/` |
| `FINAL_PRODUCTION_GATE_REVIEW.md` | Decision | `docs/project/decisions/` |

#### Project Planning Documents (4 files)

| File | Classification | Target Directory |
|------|---------------|-----------------|
| `PHASE_1C_PRE_EXECUTION_REVIEW.md` | Roadmap | `docs/project/roadmaps/` |
| `PHASE_3_IMPLEMENTATION_ROADMAP.md` | Roadmap | `docs/project/roadmaps/` |
| `DOCUMENTATION_REORGANIZATION_REPORT.md` | Decision | `docs/project/decisions/` |
| `DOCUMENT_CONFLICT_MATRIX.md` | Decision | `docs/project/decisions/` |

#### Root Documents to Keep

| File | Rationale |
|------|-----------|
| `README.md` | Standard project README — root level |
| `SECURITY.md` | GitHub-recognized security policy — root level |
| `FINAL_PRODUCTION_GATE_REVIEW.md` | Merge blocker — stays until merge, then archive |

---

## 3. Critical Issues Found

### Issue 1: `.gitignore` Excludes Entire `docs/` Directory

**File:** `.gitignore` — Line 92

```gitignore
# duplicate skill / docs dirs
data/
skills/
docs/
```

The pattern `docs/` ignores ALL files under the `docs/` directory. This was likely intended to ignore AI-agent-created documentation directories at other paths, but the blanket `docs/` also ignores the project's own documentation.

**Impact:** All 21 existing documentation files and all 38 generated documents are **NOT tracked in version control**. None of this work will be preserved in the repository.

**Fix:** Replace `docs/` with specific ignore patterns for AI-generated duplicates, or keep the ignore but document it.

### Issue 2: 16 Migration Files Untracked

007–022 are listed as `??` in `git status`. These contain critical schema changes and RLS policy implementations. Without them, the migration history is incomplete.

**Impact:** A fresh clone with `supabase db push` would only have 001–006, missing all Phase 2B work.

**Fix:** `git add supabase/migrations/007_*.sql` through `022_*.sql`.

### Issue 3: 38 Root-Level Documents Pollute Project Root

The root directory has grown from ~15 files to ~53 files due to AI-generated audit/planning documents. This makes it difficult to distinguish source code from generated reports.

**Impact:** Developer confusion, difficulty finding actual source files.

**Fix:** Relocate into `docs/` subdirectories as specified in Section 2.6.

---

## 4. Duplicate File Analysis

| Duplicate Group | Files | Action |
|----------------|-------|--------|
| `docs/archive/PRD.md` ↔ `docs/product/PRD_V3.md` | Both are product requirement documents — v3 supersedes | Keep `PRD_V3.md` in `docs/product/`, keep `PRD.md` in `docs/archive/` |
| `docs/security/RLS_IMPLEMENTATION_PLAN.md` ↔ `CANONICAL_RLS_SPEC.md` | RLS implementation plan vs RLS spec — different purposes | Both keep, move to appropriate subdirs |
| `docs/database/DATABASE_MIGRATION_PLAN.md` ↔ `EXECUTION_PLAN.md` | Both describe migration execution | Keep both (different levels of detail) |
| `PRODUCTION_READINESS_CHECKLIST.md` ↔ `PRODUCTION_VERIFICATION_CHECKLIST.md` | Both are verification checklists | Keep both (readiness vs verification are different gate stages) |

**No true duplicates found.** Multiple documents cover similar topics but serve different purposes (planning vs auditing vs execution).

---

## 5. Obsolete File Analysis

| File | Reason | Action |
|------|--------|--------|
| `docs/archive/PRD.md` | Superseded by `PRD_V3.md` | Keep (historical archive) |
| `next-env.d.ts` | Auto-generated by Next.js | Keep (gitignored) |
| `tsconfig.tsbuildinfo` | TS incremental build cache | Keep (gitignored) |
| `skills-lock.json` | AI configuration artifact | Keep (required by AI tools) |

**No truly obsolete files found.** Some are superseded but preserved for history.

---

## 6. Missing Directory Analysis

| Missing Directory | Purpose |
|-------------------|---------|
| `docs/database/specifications/` | Canonical database specs, domain models, RLS specs, permission catalogs |
| `docs/database/migrations/` | Migration plans, manifests, execution plans |
| `docs/database/audits/` | Audit reports, compliance matrices, execution reports |
| `docs/database/validation/` | Baseline captures, verification scripts, pre-generation validations |
| `docs/deployment/` | Deployment guides, env var matrices |
| `docs/deployment/runbooks/` | Runbooks, checklists, rollback plans |
| `docs/deployment/infrastructure/` | Infrastructure plans, gap analyses, platform decisions |
| `docs/project/roadmaps/` | Implementation roadmaps, backlogs, execution checklists |
| `docs/project/decisions/` | Gate reviews, conflict matrices, architecture decisions |
| `.github/workflows/` | CI/CD pipeline definitions (planned but not created) |

---

## 7. Summary

| Metric | Count |
|--------|-------|
| Total files in repository | ~240 |
| Application source files (src/) | 134 |
| Database migration files | 22 |
| Configuration files (root) | 9 |
| Documentation files (all locations) | 59 |
| Root-level generated docs | 38 |
| Files untracked in git | 56 |
| Files to move | 56 |
| Blocking issues before merge | 3 |
