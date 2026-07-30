# Canonical Project Structure — Church Ministry CRM

**Version:** 1.0  
**Approved:** 2026-07-30  
**Applies to:** All current and future files in this repository  

---

## 1. Approved Directory Hierarchy

```
/ (root)
├── src/                              # Application source code
│   ├── app/                          # Next.js App Router pages
│   ├── components/                   # Shared UI components
│   ├── features/                     # Feature modules (auth, children, dashboard, etc.)
│   ├── i18n/                         # Internationalization
│   ├── lib/                          # Library utilities
│   ├── providers/                    # React providers
│   └── types/                        # TypeScript type definitions
│
├── supabase/
│   └── migrations/                   # SQL migration files (001–999)
│
├── docs/                             # All documentation
│   ├── architecture/                 # System architecture documents
│   ├── database/
│   │   ├── specifications/           # Canonical specs, domain models, RLS specs
│   │   ├── migrations/               # Migration plans, execution plans, manifests
│   │   ├── audits/                   # Audit reports, compliance matrices, execution reports
│   │   └── validation/               # Baselines, verification scripts, pre-validation
│   ├── deployment/
│   │   ├── runbooks/                 # Production runbooks, checklists, rollback plans
│   │   ├── infrastructure/           # Infrastructure plans, gap analyses, platform decisions
│   │   └── guides/                   # Setup guides (Supabase, Vercel, env vars)
│   ├── design/                       # Design system specs, screen inventories
│   ├── project/
│   │   ├── roadmaps/                 # Implementation roadmaps, backlogs, phase plans
│   │   └── decisions/                # Gate reviews, ARDs, conflict matrices
│   ├── security/                     # RBAC, RLS, data migration risk docs
│   ├── testing/                      # QA test plans, readiness checklists
│   └── archive/                      # Superseded/historical documents
│
├── public/                           # Static assets (favicon, images, SVGs)
│
├── .github/
│   └── workflows/                    # CI/CD pipeline definitions
│
├── .agents/                          # AI skill definitions (self-managed)
│
├── # Configuration files at root:
│   ├── next.config.ts
│   ├── postcss.config.mjs
│   ├── eslint.config.mjs
│   ├── tsconfig.json
│   ├── components.json
│   ├── middleware.ts
│   ├── package.json
│   ├── package-lock.json
│   ├── .gitignore
│   ├── .env.local (gitignored)
│   ├── .env.local.example
│   ├── README.md
│   └── SECURITY.md
```

---

## 2. Naming Conventions

### 2.1 File Names

| Category | Convention | Example |
|----------|------------|---------|
| SQL migrations | `{NNN}_{description}.sql` | `022_rls_implementation.sql` |
| Markdown docs | `{UPPER_SNAKE_CASE}.md` | `MIGRATION_AUDIT_REPORT.md`, `CANONICAL_RLS_SPEC.md` |
| Runbooks | `{UPPER_SNAKE_CASE}.md` | `PRODUCTION_DEPLOYMENT_RUNBOOK.md` |
| Checklists | `{UPPER_SNAKE_CASE}.md` | `LAUNCH_DAY_CHECKLIST.md` |
| Source (TS/TSX) | `{kebab-case}.ts` / `{kebab-case}.tsx` | `child-form-dialog.tsx`, `auth.service.ts` |
| Config files | As required by framework | `next.config.ts`, `tailwind.config.ts` |

### 2.2 Directory Names

| Category | Convention | Example |
|----------|------------|---------|
| Feature modules | `{kebab-case}` | `src/features/children/`, `src/features/dashboard/` |
| Documentation categories | `{lowercase}` | `docs/database/`, `docs/deployment/` |
| Documentation subcategories | `{lowercase-plural}` | `docs/database/audits/`, `docs/deployment/runbooks/` |

---

## 3. Documentation Placement Rules

### 3.1 Database Documentation

| Document Type | Location |
|---------------|----------|
| Canonical database specification | `docs/database/specifications/` |
| Domain model documentation | `docs/database/specifications/` |
| RLS specification | `docs/database/specifications/` |
| Permission catalog | `docs/database/specifications/` |
| Role model | `docs/database/specifications/` |
| Migration plan | `docs/database/migrations/` |
| Migration manifest | `docs/database/migrations/` |
| Execution plan | `docs/database/migrations/` |
| Staging execution order | `docs/database/migrations/` |
| Schema diff report | `docs/database/audits/` |
| Migration audit report | `docs/database/audits/` |
| Compliance matrix | `docs/database/audits/` |
| Consistency report | `docs/database/audits/` |
| SQL audit report | `docs/database/audits/` |
| Execution audit report | `docs/database/audits/` |
| Go/no-go verdict | `docs/database/audits/` |
| Execution log | `docs/database/audits/` |
| Pre-migration baseline | `docs/database/validation/` |
| Pre-generation validation | `docs/database/validation/` |
| Verification script | `docs/database/validation/` |
| Row count verification | `docs/database/validation/` |

### 3.2 Deployment Documentation

| Document Type | Location |
|---------------|----------|
| Deployment runbook | `docs/deployment/runbooks/` |
| Rollback runbook | `docs/deployment/runbooks/` |
| Verification checklist | `docs/deployment/runbooks/` |
| Readiness checklist | `docs/deployment/runbooks/` |
| Launch day checklist | `docs/deployment/runbooks/` |
| Infrastructure plan | `docs/deployment/infrastructure/` |
| Infrastructure gap analysis | `docs/deployment/infrastructure/` |
| Platform decision doc | `docs/deployment/infrastructure/` |
| Supabase setup guide | `docs/deployment/guides/` |
| Vercel deployment guide | `docs/deployment/guides/` |
| Environment variable matrix | `docs/deployment/guides/` |
| Go-live gate doc | `docs/deployment/` |

### 3.3 Project Documentation

| Document Type | Location |
|---------------|----------|
| Implementation roadmap | `docs/project/roadmaps/` |
| Phase execution plan | `docs/project/roadmaps/` |
| MVP backlog | `docs/project/roadmaps/` |
| MVP scope | `docs/project/roadmaps/` |
| Product requirements | `docs/project/` (current) or `docs/archive/` (superseded) |
| Gate review | `docs/project/decisions/` |
| Architecture decision record | `docs/project/decisions/` |
| Document conflict matrix | `docs/project/decisions/` |
| Gap analysis | `docs/project/decisions/` |

---

## 4. Migration Placement Rules

| Rule | Detail |
|------|--------|
| All SQL migrations | `supabase/migrations/{NNN}_{description}.sql` |
| Migration numbering | Sequential 3-digit prefix (001, 002, ..., 022, 023) |
| Migration content | One logical change per migration file |
| Migration manifests | `docs/database/migrations/MIGRATION_MANIFEST.md` |
| Migration plans | `docs/database/migrations/` |
| Migration execution logs | `docs/database/audits/` |
| Do NOT place | Migration files outside `supabase/migrations/` |
| Do NOT place | Migration documentation in `supabase/migrations/` |

---

## 5. Audit Placement Rules

| Rule | Detail |
|------|--------|
| Database audits | `docs/database/audits/` |
| Deployment audits | `docs/deployment/infrastructure/` (gap analyses) |
| Project audits | `docs/project/decisions/` (gate reviews) |
| Audit naming | `{SCOPE}_{TYPE}_REPORT.md` — e.g., `MIGRATION_AUDIT_REPORT.md` |
| Audit files are | Read-only snapshots — do not edit after creation |
| Superseded audits | Move to `docs/archive/` |

---

## 6. Generated-File Placement Rules

| Rule | Detail |
|------|--------|
| AI-generated reports | Must be placed in the appropriate `docs/` subdirectory — NEVER at root |
| AI-generated specs | `docs/database/specifications/` |
| AI-generated audits | `docs/database/audits/` |
| AI-generated runbooks | `docs/deployment/runbooks/` |
| AI-generated plans | `docs/project/roadmaps/` |
| AI-generated configuration | Must be reviewed and either committed to proper location or rejected |
| Temporary analysis files | Place in root only during active work, relocate before merge commit |
| Naming for generated files | Follow existing naming conventions (see Section 2) |
| Header requirement | Every generated doc must include a `**Prepared:** {date}` line |

---

## 7. Root-Level File Permit List

Only these files may exist at the repository root:

| File | Purpose |
|------|---------|
| `README.md` | Project overview |
| `SECURITY.md` | Security policy (GitHub-recognized) |
| `middleware.ts` | Next.js middleware (framework-required) |
| `next.config.ts` | Next.js configuration (framework-required) |
| `postcss.config.mjs` | PostCSS configuration (framework-required) |
| `eslint.config.mjs` | ESLint configuration (framework-required) |
| `tsconfig.json` | TypeScript configuration (framework-required) |
| `components.json` | shadcn/ui configuration (framework-required) |
| `package.json` | npm package definition (framework-required) |
| `package-lock.json` | npm lockfile (framework-required) |
| `skills-lock.json` | AI skills lock |
| `.gitignore` | Git ignore rules |
| `.env.local.example` | Environment variable template |
| `.github/` | GitHub configuration directory |
| `src/` | Application source code |
| `supabase/` | Supabase configuration and migrations |
| `docs/` | All documentation |
| `public/` | Static assets |

**No other files may reside at the root.** All generated reports, plans, audits, and checklists must be inside `docs/`.
