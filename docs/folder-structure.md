# Church Ministry CRM — Folder Structure

## Root Layout

```
church-ministry-crm/
├── .cursor/
│   └── rules/
│       └── project-rules.md
├── app/                          # Next.js App Router
├── components/                   # Shared UI components
├── features/                     # Feature modules
├── actions/                      # Server Actions
├── services/                     # Business logic
├── lib/                          # Utilities & data access
├── hooks/                        # Shared React hooks
├── types/                        # Global TypeScript types
├── supabase/                     # Database migrations & config
├── docs/                         # Architecture & design docs
├── public/                       # Static assets
├── messages/                     # i18n translation files
├── .env.local.example
├── .env.local
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## `/app` — App Router

```
app/
├── (auth)/                       # Auth route group (no sidebar)
│   ├── layout.tsx                # Centered auth layout, RTL
│   ├── login/
│   │   └── page.tsx
│   ├── signup/
│   │   └── page.tsx
│   ├── forgot-password/
│   │   └── page.tsx
│   └── reset-password/
│       └── page.tsx
│
├── (dashboard)/                  # Protected dashboard routes
│   ├── layout.tsx                # Sidebar + header shell
│   ├── page.tsx                  # Dashboard home (redirect or KPIs)
│   ├── users/
│   │   ├── page.tsx              # User list
│   │   ├── new/
│   │   │   └── page.tsx
│   │   └── [id]/
│   │       └── page.tsx          # User detail/edit
│   ├── stages/
│   │   ├── page.tsx              # Ministry & stage management
│   │   └── [id]/
│   │       └── page.tsx
│   ├── children/
│   │   ├── page.tsx              # Child list with filters
│   │   ├── new/
│   │   │   └── page.tsx
│   │   └── [id]/
│   │       ├── page.tsx          # Child profile
│   │       └── timeline/
│   │           └── page.tsx
│   └── attendance/
│       ├── page.tsx              # Weekly attendance grid
│       └── history/
│           └── page.tsx
│
├── api/                          # Route Handlers (webhooks, health)
│   └── health/
│       └── route.ts
│
├── globals.css                   # Tailwind + RTL overrides
├── layout.tsx                    # Root layout (providers, fonts)
├── not-found.tsx
└── error.tsx
```

---

## `/components` — Shared UI

```
components/
├── ui/                           # shadcn/ui primitives
│   ├── button.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── dialog.tsx
│   ├── table.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   ├── avatar.tsx
│   ├── dropdown-menu.tsx
│   ├── sheet.tsx
│   ├── tabs.tsx
│   ├── toast.tsx
│   ├── skeleton.tsx
│   ├── pagination.tsx
│   └── ...
│
├── layout/                       # App shell components
│   ├── sidebar.tsx
│   ├── header.tsx
│   ├── mobile-nav.tsx
│   ├── breadcrumbs.tsx
│   └── page-header.tsx
│
├── providers/                    # Context providers
│   ├── theme-provider.tsx
│   ├── query-provider.tsx
│   ├── locale-provider.tsx
│   └── auth-provider.tsx
│
├── forms/                        # Reusable form components
│   ├── form-field.tsx
│   ├── form-select.tsx
│   ├── form-date-picker.tsx
│   └── form-phone-input.tsx
│
├── data-display/                 # Shared data components
│   ├── data-table.tsx
│   ├── empty-state.tsx
│   ├── loading-spinner.tsx
│   ├── stat-card.tsx
│   └── status-badge.tsx
│
└── icons/                        # Custom icon components
    └── index.tsx
```

---

## `/features` — Feature Modules

Each feature follows the same internal structure:

```
features/
├── auth/
│   ├── components/
│   │   ├── login-form.tsx
│   │   ├── signup-form.tsx
│   │   ├── forgot-password-form.tsx
│   │   └── reset-password-form.tsx
│   ├── hooks/
│   │   └── use-auth.ts
│   ├── schemas/
│   │   └── auth.schema.ts
│   ├── types/
│   │   └── auth.types.ts
│   └── index.ts
│
├── users/
│   ├── components/
│   │   ├── user-table.tsx
│   │   ├── user-form.tsx
│   │   ├── role-assignment.tsx
│   │   └── stage-assignment.tsx
│   ├── hooks/
│   │   ├── use-users.ts
│   │   └── use-user-mutations.ts
│   ├── schemas/
│   │   └── user.schema.ts
│   ├── types/
│   │   └── user.types.ts
│   └── index.ts
│
├── stages/
│   ├── components/
│   │   ├── ministry-list.tsx
│   │   ├── ministry-form.tsx
│   │   ├── stage-list.tsx
│   │   └── stage-form.tsx
│   ├── hooks/
│   │   ├── use-ministries.ts
│   │   └── use-stages.ts
│   ├── schemas/
│   │   └── stage.schema.ts
│   ├── types/
│   │   └── stage.types.ts
│   └── index.ts
│
├── children/
│   ├── components/
│   │   ├── child-table.tsx
│   │   ├── child-form.tsx
│   │   ├── child-profile.tsx
│   │   ├── child-timeline.tsx
│   │   └── child-filters.tsx
│   ├── hooks/
│   │   ├── use-children.ts
│   │   └── use-child-mutations.ts
│   ├── schemas/
│   │   └── child.schema.ts
│   ├── types/
│   │   └── child.types.ts
│   └── index.ts
│
├── attendance/
│   ├── components/
│   │   ├── attendance-grid.tsx
│   │   ├── attendance-row.tsx
│   │   ├── attendance-history.tsx
│   │   └── attendance-stats.tsx
│   ├── hooks/
│   │   ├── use-attendance.ts
│   │   └── use-attendance-mutations.ts
│   ├── schemas/
│   │   └── attendance.schema.ts
│   ├── types/
│   │   └── attendance.types.ts
│   └── index.ts
│
└── dashboard/
    ├── components/
    │   ├── kpi-cards.tsx
    │   ├── attendance-chart.tsx
    │   ├── stage-breakdown.tsx
    │   └── recent-activity.tsx
    ├── hooks/
    │   └── use-dashboard-stats.ts
    ├── types/
    │   └── dashboard.types.ts
    └── index.ts
```

---

## `/actions` — Server Actions

```
actions/
├── auth.actions.ts               # login, signup, logout, resetPassword
├── user.actions.ts               # CRUD users, assign roles/stages
├── stage.actions.ts              # CRUD ministries & stages
├── child.actions.ts              # CRUD children
├── attendance.actions.ts         # Record & query attendance
└── dashboard.actions.ts          # Aggregate stats queries
```

---

## `/services` — Business Logic

```
services/
├── auth.service.ts               # Auth orchestration
├── user.service.ts               # User management logic
├── stage.service.ts              # Ministry/stage logic
├── child.service.ts              # Child profile logic
├── attendance.service.ts         # Attendance calculations
├── dashboard.service.ts          # KPI aggregation
├── audit.service.ts              # Audit log writer
├── permission.service.ts         # RBAC checks
└── storage.service.ts            # File upload/download
```

---

## `/lib` — Utilities & Data Access

```
lib/
├── supabase/
│   ├── client.ts                 # Browser Supabase client
│   ├── server.ts                 # Server Supabase client (cookies)
│   ├── admin.ts                  # Service role client (admin ops)
│   └── middleware.ts             # Auth session refresh
│
├── i18n/
│   ├── config.ts                 # Locale configuration
│   └── utils.ts                  # Translation helpers
│
├── permissions/
│   ├── constants.ts              # Permission codes
│   ├── check.ts                  # Server-side permission checker
│   └── hooks.ts                  # Client-side permission hooks
│
├── utils/
│   ├── cn.ts                     # Tailwind class merge
│   ├── date.ts                   # Date formatting (ar-EG)
│   ├── phone.ts                  # Phone number formatting
│   ├── pagination.ts             # Pagination helpers
│   └── format.ts                 # Number/name formatting
│
├── constants/
│   ├── routes.ts                 # Route path constants
│   └── enums.ts                  # Shared enum values
│
├── sentry/
│   └── config.ts                 # Sentry initialization
│
└── validations/
    └── common.schema.ts          # Shared Zod schemas (UUID, phone, etc.)
```

---

## `/hooks` — Shared React Hooks

```
hooks/
├── use-debounce.ts
├── use-media-query.ts
├── use-permissions.ts
├── use-locale.ts
└── use-toast.ts
```

---

## `/types` — Global Types

```
types/
├── database.types.ts             # Generated Supabase types
├── api.types.ts                  # ActionResult, PaginatedResponse
├── auth.types.ts                 # Session, User types
└── index.ts                      # Barrel export
```

---

## `/supabase` — Database

```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql    # Tables, enums, indexes, functions
│   ├── 002_rls_policies.sql      # Row Level Security policies
│   └── 003_seed_permissions.sql  # Permission catalog seed
├── config.toml                   # Local Supabase config
└── seed.sql                      # Development seed data
```

---

## `/messages` — i18n

```
messages/
├── ar.json                       # Arabic translations (default)
└── en.json                       # English translations
```

---

## `/docs` — Documentation

```
docs/
├── architecture.md
├── database-schema.md
├── erd.md
├── folder-structure.md
└── implementation-roadmap.md
```

---

## `/public` — Static Assets

```
public/
├── fonts/                        # Arabic web fonts (Cairo, Tajawal)
├── icons/                        # App icons, favicons
└── images/                       # Static images
```

---

## File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase file, kebab-case folder | `child-form.tsx` |
| Hooks | camelCase with `use` prefix | `use-children.ts` |
| Schemas | kebab-case with `.schema` suffix | `child.schema.ts` |
| Actions | kebab-case with `.actions` suffix | `child.actions.ts` |
| Services | kebab-case with `.service` suffix | `child.service.ts` |
| Types | kebab-case with `.types` suffix | `child.types.ts` |
| Pages | `page.tsx` in route folder | `app/children/page.tsx` |
| Layouts | `layout.tsx` in route folder | `app/(dashboard)/layout.tsx` |

---

## Import Aliases

Configured in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/features/*": ["./features/*"],
      "@/actions/*": ["./actions/*"],
      "@/services/*": ["./services/*"],
      "@/lib/*": ["./lib/*"],
      "@/hooks/*": ["./hooks/*"],
      "@/types/*": ["./types/*"]
    }
  }
}
```

---

## Phase 1 Scope

Only the following directories will be populated during Phase 1:

- `app/(auth)/*`
- `app/(dashboard)/` — users, stages, children, attendance, dashboard pages
- `features/auth`, `features/users`, `features/stages`, `features/children`, `features/attendance`, `features/dashboard`
- `actions/*` — all Phase 1 action files
- `services/*` — all Phase 1 service files
- `lib/supabase/*`, `lib/permissions/*`, `lib/utils/*`, `lib/i18n/*`
- `components/ui/*`, `components/layout/*`, `components/providers/*`
- `supabase/migrations/*`
- `messages/ar.json`, `messages/en.json`
