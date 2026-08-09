# Church Ministry CRM

Production-grade multi-tenant SaaS platform for church ministry management —
built with Next.js, Supabase, and a church-scoped RBAC model.

> **Status:** v1.0 production-hardened. CI/CD, automated tests, security
> hardening, monitoring, bilingual EN/AR i18n, and role-matrix fixes landed in
> the Sprint 2 Enterprise Production Hardening pass.

## Tech Stack

- **Frontend:** Next.js (App Router), React 19, TypeScript, Tailwind CSS,
  shadcn/ui + Base UI, TanStack Query, next-intl
- **Backend:** Next.js Server Actions (BFF), Supabase (PostgreSQL + Auth)
- **Database:** 37 migrations (schema, RLS, SECURITY DEFINER RPCs, indexes),
  Supabase Postgres
- **Hosting:** Vercel (see deployment guides) · **Default language:** Arabic (RTL)

## Features

- Multi-tenant churches with a church-provisioning wizard and church requests
- Platform Owner administration (churches, users, audit, import/export)
- Role-based access control: platform_owner, super_admin, admin,
  stage_manager, servant
- Children / beneficiaries, services, stages, classes, attendance, follow-ups,
  spiritual journal, notifications (scheduled), reports, dashboard
- Full EN/AR translations (1,250 keys, exact parity, CI-guarded)
- Audit logging, RLS hardening, rate limiting, security headers, monitoring

## Getting Started

```bash
# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local

# Run database migrations
supabase db push

# Start development server
npm run dev
```

### Quality gates

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint
npm run test           # Vitest unit + component tests
npm run test:e2e       # Playwright (requires built app / running server)
npm run check:i18n     # en/ar parity + referenced-key + hardcoded-string guard
npm run build          # Production build
```

All gates run in CI (`.github/workflows/ci.yml`) and must pass on every PR.

## Documentation

| Area | Documents |
| --- | --- |
| Architecture | [System architecture](docs/architecture/SYSTEM_ARCHITECTURE.md) · [Class access](docs/architecture/CLASS_ACCESS_ARCHITECTURE.md) |
| Security | [RBAC architecture](docs/security/RBAC_ARCHITECTURE.md) · [Permission matrix](docs/security/PERMISSION_MATRIX.md) · [Sprint 2 security review](docs/security/SPRINT2_SECURITY_REVIEW.md) |
| Deployment | [Vercel guide](docs/deployment/guides/VERCEL_DEPLOYMENT_GUIDE.md) · [Supabase setup](docs/deployment/guides/SUPABASE_PRODUCTION_SETUP_GUIDE.md) · [Env matrix](docs/deployment/guides/ENVIRONMENT_VARIABLE_MATRIX.md) · [Runbooks](docs/deployment/runbooks/) |
| Operations | [Monitoring](docs/operations/MONITORING.md) · [Recovery](docs/deployment/runbooks/PRODUCTION_RECOVERY_RUNBOOK.md) |
| Quality | [Enterprise readiness audit](docs/ENTERPRISE_READINESS_AUDIT.md) · [Testing](docs/testing/) |
| Roadmap | [NEXT_TASK](docs/project/NEXT_TASK.md) · [Known issues](docs/project/KNOWN_ISSUES.md) |

## Database Migrations

`supabase/migrations/` contains 37 ordered migrations (001–037). Latest:

- **036** — role-matrix fix + `stage_manager` role
- **037** — dashboard trends aggregation RPC (performance)

Apply with the Supabase CLI; never edit applied migrations in place — add a new
numbered migration.

## License

Private — All rights reserved.
