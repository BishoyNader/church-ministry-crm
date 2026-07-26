# Church Ministry CRM — Phase 1 Implementation Roadmap

## Phase 1 Scope

Build the foundation: authentication, user management, stage management, child management, attendance tracking, and dashboard.

**Modules:** Auth → Users → Stages → Children → Attendance → Dashboard

**Estimated duration:** 6–8 weeks (1 developer)

---

## Milestone 0: Project Setup (Week 1)

### 0.1 Initialize Next.js Project

- [ ] Create Next.js 15 app with TypeScript, Tailwind, App Router
- [ ] Configure path aliases (`@/*`)
- [ ] Install core dependencies:
  - `@supabase/supabase-js`, `@supabase/ssr`
  - `@tanstack/react-query`, `zustand`
  - `react-hook-form`, `@hookform/resolvers`, `zod`
  - `next-intl` (i18n)
  - `next-themes` (dark mode)
  - `recharts`, `@tanstack/react-table`
  - `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`
- [ ] Initialize shadcn/ui with RTL support
- [ ] Configure ESLint, Prettier

### 0.2 Supabase Setup

- [ ] Create Supabase project (dev + staging)
- [ ] Run migrations: `001_initial_schema.sql`, `002_rls_policies.sql`, `003_seed_permissions.sql`
- [ ] Enable phone auth in Supabase Dashboard
- [ ] Create storage buckets: `child-photos`, `documents`, `church-assets`
- [ ] Generate TypeScript types: `supabase gen types typescript`
- [ ] Configure `.env.local` with Supabase keys

### 0.3 Core Infrastructure

- [ ] `lib/supabase/client.ts` — browser client
- [ ] `lib/supabase/server.ts` — server client with cookies
- [ ] `lib/supabase/middleware.ts` — session refresh
- [ ] `middleware.ts` — auth guard, locale detection
- [ ] `components/providers/` — theme, query, locale, auth providers
- [ ] `messages/ar.json`, `messages/en.json` — base translations
- [ ] Root layout with RTL/LTR, Arabic font (Cairo/Tajawal)
- [ ] `lib/permissions/` — permission constants and check utilities
- [ ] `types/database.types.ts` — generated Supabase types
- [ ] `types/api.types.ts` — ActionResult, PaginatedResponse

### 0.4 App Shell

- [ ] Dashboard layout: sidebar, header, mobile nav
- [ ] Auth layout: centered card
- [ ] Navigation items (placeholder routes)
- [ ] Breadcrumbs, page header component
- [ ] Empty state, loading skeleton, toast system

**Deliverable:** Running app with auth middleware, RTL layout, empty dashboard shell.

---

## Milestone 1: Authentication (Week 1–2)

### 1.1 Auth Feature Module

```
features/auth/
  components/login-form.tsx
  components/signup-form.tsx
  components/forgot-password-form.tsx
  components/reset-password-form.tsx
  schemas/auth.schema.ts
  hooks/use-auth.ts
```

### 1.2 Server Actions & Service

- [ ] `actions/auth.actions.ts`
  - `signUp(data)` — create auth user + church + profile + super_admin role
  - `signIn(data)` — email or phone login
  - `signOut()` — clear session
  - `resetPassword(email)` — send reset link
  - `updatePassword(token, password)` — set new password
- [ ] `services/auth.service.ts`
  - Church creation with slug generation
  - Call `seed_church_roles(church_id)`
  - Assign super_admin role to first user
  - Update `last_login_at` on sign in

### 1.3 Auth Pages

- [ ] `/login` — email + phone tabs, remember me checkbox
- [ ] `/signup` — church name, user name, email, phone, password
- [ ] `/forgot-password` — email input
- [ ] `/reset-password` — new password form

### 1.4 Session Management

- [ ] Middleware redirects unauthenticated users to `/login`
- [ ] Redirect authenticated users away from auth pages
- [ ] Remember me: extended session cookie duration
- [ ] Audit log on login/logout

**Deliverable:** Full signup → login → dashboard flow. First user is Super Admin.

---

## Milestone 2: User Management (Week 2–3)

### 2.1 User Feature Module

```
features/users/
  components/user-table.tsx
  components/user-form.tsx
  components/role-assignment.tsx
  components/stage-assignment.tsx
  schemas/user.schema.ts
  hooks/use-users.ts
  hooks/use-user-mutations.ts
```

### 2.2 Server Actions & Service

- [ ] `actions/user.actions.ts`
  - `getUsers(filters, pagination)`
  - `getUserById(id)`
  - `createUser(data)` — invite via Supabase Auth admin
  - `updateUser(id, data)`
  - `deactivateUser(id)` — soft delete
  - `assignRole(userId, roleId)`
  - `removeRole(userId, roleId)`
  - `assignStage(userId, stageId)`
  - `removeStage(userId, stageId)`
- [ ] `services/user.service.ts`
  - Permission checks before each operation
  - Prevent self-deactivation
  - Prevent removing last admin

### 2.3 User Pages

- [ ] `/users` — paginated table with search, role filter, status filter
- [ ] `/users/new` — create user form
- [ ] `/users/[id]` — edit profile, manage roles, manage stage assignments

### 2.4 Permission Integration

- [ ] Hide create/edit/delete based on user permissions
- [ ] Role assignment UI (checkboxes for available roles)
- [ ] Stage assignment UI (multi-select for stages)

**Deliverable:** Church Admin can manage users, assign roles, assign stages.

---

## Milestone 3: Stage Management (Week 3)

### 3.1 Stage Feature Module

```
features/stages/
  components/ministry-list.tsx
  components/ministry-form.tsx
  components/stage-list.tsx
  components/stage-form.tsx
  schemas/stage.schema.ts
  hooks/use-ministries.ts
  hooks/use-stages.ts
```

### 3.2 Server Actions & Service

- [ ] `actions/stage.actions.ts`
  - `getMinistries()`
  - `createMinistry(data)`
  - `updateMinistry(id, data)`
  - `deactivateMinistry(id)`
  - `getStages(ministryId?)`
  - `createStage(data)`
  - `updateStage(id, data)`
  - `deactivateStage(id)`
  - `reorderStages(ministryId, orderedIds)`
- [ ] `services/stage.service.ts`
  - Validate age range (min < max)
  - Prevent deactivating stage with active children

### 3.3 Stage Pages

- [ ] `/stages` — ministry accordion with nested stage lists
- [ ] Inline create/edit for ministries and stages
- [ ] Drag-and-drop reorder (optional, can defer)

**Deliverable:** Church Admin can create ministries and stages with age ranges.

---

## Milestone 4: Child Management (Week 3–5)

### 4.1 Child Feature Module

```
features/children/
  components/child-table.tsx
  components/child-form.tsx
  components/child-profile.tsx
  components/child-timeline.tsx
  components/child-filters.tsx
  schemas/child.schema.ts
  hooks/use-children.ts
  hooks/use-child-mutations.ts
```

### 4.2 Server Actions & Service

- [ ] `actions/child.actions.ts`
  - `getChildren(filters, pagination)` — search by name, phone, stage, status
  - `getChildById(id)`
  - `createChild(data)`
  - `updateChild(id, data)`
  - `deactivateChild(id)`
  - `transferChild(id, newStageId)`
  - `getChildTimeline(id)` — attendance records (Phase 1 scope)
- [ ] `services/child.service.ts`
  - Full profile validation (personal, parent, contact, spiritual, medical, educational)
  - Stage access check on create/update
  - Photo upload via storage service

### 4.3 Child Pages

- [ ] `/children` — searchable, filterable table (TanStack Table)
  - Filters: stage, ministry, status, gender, search by name/phone
  - Pagination (20 per page)
- [ ] `/children/new` — multi-section form (tabs or accordion)
  - Personal, Parent, Contact, Spiritual, Medical, Educational sections
- [ ] `/children/[id]` — profile view with all data sections
- [ ] `/children/[id]/timeline` — chronological activity (attendance in P1)

### 4.4 Child Form Sections

| Section | Fields |
|---------|--------|
| Personal | Name (AR/EN), DOB, gender, photo |
| Parent | Father, mother, phone, email, address |
| Contact | Mobile, emergency contact |
| Spiritual | Baptism date, confession frequency, notes |
| Medical | Conditions, allergies, medications |
| Educational | School, grade level |
| Assignment | Ministry, stage, status |

**Deliverable:** Full child CRUD with search, filters, profile view, timeline.

---

## Milestone 5: Attendance (Week 5–6)

### 5.1 Attendance Feature Module

```
features/attendance/
  components/attendance-grid.tsx
  components/attendance-row.tsx
  components/attendance-history.tsx
  components/attendance-stats.tsx
  schemas/attendance.schema.ts
  hooks/use-attendance.ts
  hooks/use-attendance-mutations.ts
```

### 5.2 Server Actions & Service

- [ ] `actions/attendance.actions.ts`
  - `getWeeklyAttendance(stageId, date)` — all children in stage for week
  - `recordAttendance(records[])` — bulk upsert for a date
  - `updateAttendance(id, status, notes)`
  - `getAttendanceHistory(childId, dateRange)`
  - `getAttendanceStats(stageId, dateRange)` — present/absent/excused counts
- [ ] `services/attendance.service.ts`
  - Upsert logic (one record per child per date)
  - Stage access validation
  - Calculate attendance rate percentages

### 5.3 Attendance Pages

- [ ] `/attendance` — weekly grid view
  - Stage selector dropdown
  - Week date picker (default: current week)
  - Grid: child name × day columns with P/A/E toggle buttons
  - Bulk save button
  - Quick stats bar (present %, absent count)
- [ ] `/attendance/history` — historical view
  - Filter by stage, date range, status
  - Table with child name, date, status, recorded by

**Deliverable:** Weekly attendance recording with history and basic stats.

---

## Milestone 6: Dashboard (Week 6–7)

### 6.1 Dashboard Feature Module

```
features/dashboard/
  components/kpi-cards.tsx
  components/attendance-chart.tsx
  components/stage-breakdown.tsx
  components/recent-activity.tsx
  hooks/use-dashboard-stats.ts
```

### 6.2 Server Actions & Service

- [ ] `actions/dashboard.actions.ts`
  - `getDashboardStats()` — aggregate KPIs
- [ ] `services/dashboard.service.ts`
  - Total active children count
  - This week's attendance rate (overall + per stage)
  - New children this month
  - Recent audit log entries (last 10)
  - Stage breakdown chart data

### 6.3 Dashboard Page

- [ ] `/` (dashboard home) — KPI cards row
  - Total Children
  - Attendance Rate (this week)
  - New This Month
  - Active Stages
- [ ] Attendance trend chart (Recharts — last 8 weeks)
- [ ] Stage breakdown (bar chart or pie)
- [ ] Recent activity feed (audit log)

**Performance target:** Dashboard loads in < 2 seconds.

**Deliverable:** Functional dashboard with real KPIs from database.

---

## Milestone 7: Polish & Hardening (Week 7–8)

### 7.1 i18n Completion

- [ ] Complete Arabic translations for all Phase 1 screens
- [ ] English translations for all keys
- [ ] Locale switcher in header
- [ ] RTL/LTR layout verified on all pages
- [ ] Arabic date/number formatting

### 7.2 Responsive & Accessibility

- [ ] Mobile-first responsive on all pages
- [ ] Mobile navigation (sheet/drawer)
- [ ] Attendance grid usable on tablet
- [ ] Keyboard navigation
- [ ] ARIA labels on interactive elements
- [ ] Color contrast (WCAG AA)

### 7.3 Error Handling & Loading States

- [ ] Global error boundary
- [ ] Skeleton loaders on all data pages
- [ ] Toast notifications for all mutations
- [ ] Form validation error messages in Arabic
- [ ] Empty states with actionable CTAs

### 7.4 Security Hardening

- [ ] Rate limiting on auth endpoints
- [ ] CSRF protection via Server Actions
- [ ] Input sanitization (XSS prevention)
- [ ] Verify all RLS policies with test users per role
- [ ] Audit log verification on all mutations

### 7.5 Performance

- [ ] TanStack Query caching strategy (stale times per entity)
- [ ] Pagination on all list views
- [ ] Search debounce (300ms)
- [ ] Lighthouse audit > 90 performance score

### 7.6 Deployment

- [ ] Cloudflare Pages project setup
- [ ] Environment variables configured
- [ ] Supabase staging project with migrations
- [ ] Sentry error tracking initialized
- [ ] Production smoke test

**Deliverable:** Production-ready Phase 1 deployed to staging.

---

## Dependency Graph

```
M0: Setup
 │
 ├── M1: Auth ──────────────────────────┐
 │                                       │
 ├── M2: Users (depends on Auth) ───────┤
 │                                       │
 ├── M3: Stages (depends on Auth) ──────┤
 │         │                             │
 │         ├── M4: Children ────────────┤
 │         │      │                      │
 │         │      ├── M5: Attendance ───┤
 │         │      │                      │
 │         └──────┴── M6: Dashboard ────┤
 │                                       │
 └────────────── M7: Polish ────────────┘
```

---

## Definition of Done — Phase 1

- [ ] User can sign up, creating a church and becoming Super Admin
- [ ] User can log in with email or phone
- [ ] Church Admin can manage users, roles, and stage assignments
- [ ] Church Admin can create ministries and stages
- [ ] Authorized users can CRUD child profiles with all data sections
- [ ] Users can record weekly attendance (present/absent/excused)
- [ ] Dashboard shows accurate KPIs and charts
- [ ] All data isolated by church_id via RLS
- [ ] RBAC enforced at database, server, and UI levels
- [ ] Arabic RTL is the default experience
- [ ] App is responsive (mobile, tablet, desktop)
- [ ] Dark mode and light mode supported
- [ ] Audit logs capture all mutations
- [ ] Deployed to staging environment

---

## Post-Phase 1 (Future Phases Preview)

| Phase | Modules | Key Features |
|-------|---------|--------------|
| Phase 2 | Follow-Up, Events, Notifications, Reports | CRM pipeline, event registration, email alerts, PDF/Excel export |
| Phase 3 | AI Copilot, Analytics, Risk Detection | OpenAI RAG, pgvector, performance summaries, absence risk |
| Phase 4 | WhatsApp, Mobile, Advanced AI | WhatsApp notifications, PWA/mobile app, autonomous AI actions |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Supabase phone auth config complexity | Medium | Test early in M1; fallback to email-only initially |
| RTL layout bugs with shadcn/ui | Medium | Test RTL from M0; use logical properties |
| RLS policy gaps | High | Test with 5 role types before M4; automated RLS tests |
| Attendance grid performance (100+ children) | Medium | Virtual scrolling; batch upsert |
| Arabic font loading impact | Low | Self-host fonts; font-display: swap |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Dashboard load time | < 2 seconds |
| Search response | < 500ms |
| Lighthouse performance | > 90 |
| RLS test coverage | 100% of policies verified |
| Arabic translation coverage | 100% of Phase 1 UI |
| Mobile usability | All core flows work on 375px viewport |
