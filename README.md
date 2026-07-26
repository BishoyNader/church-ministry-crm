# Church Ministry CRM

Production-grade multi-tenant SaaS platform for church ministry management.

## Status

**Phase 1 — Planning Complete**

Architecture, database schema, ERD, folder structure, Supabase SQL migrations, RLS policies, and implementation roadmap are defined. No application code yet.

## Tech Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query
- **Backend:** Next.js Server Actions, Supabase (PostgreSQL + Auth + Storage)
- **Hosting:** Cloudflare Pages
- **Default Language:** Arabic (RTL)

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System design, layers, multi-tenancy, security |
| [Database Schema](docs/database-schema.md) | Full table definitions, enums, indexes |
| [ERD](docs/erd.md) | Entity relationship diagrams (Mermaid) |
| [Folder Structure](docs/folder-structure.md) | Project layout and conventions |
| [RLS Policies](docs/rls-policies.md) | Row Level Security reference |
| [Implementation Roadmap](docs/implementation-roadmap.md) | Phase 1 milestones and tasks |

## Database Migrations

```
supabase/migrations/
├── 001_initial_schema.sql    # Tables, enums, functions, triggers
├── 002_rls_policies.sql      # Row Level Security policies
└── 003_seed_permissions.sql  # Permission catalog
```

Apply with Supabase CLI:

```bash
supabase db push
```

## Phase 1 Modules

1. Authentication
2. User Management
3. Stage Management
4. Child Management
5. Attendance
6. Dashboard

## Getting Started (After Code Generation)

```bash
# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local

# Run migrations
supabase db push

# Start development server
npm run dev
```

## License

Private — All rights reserved.
