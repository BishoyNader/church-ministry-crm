# MVP Readiness Checklist — Church Ministry Platform

**Version:** 1.0  

Use this checklist to gate the MVP release. Every item must be checked before marking MVP as complete.

---

## 1. Infrastructure

### 1.1 Project Setup
- [ ] Next.js 16 project builds without errors (`npm run build`)
- [ ] TypeScript strict mode passes (`npm run typecheck`)
- [ ] Lint passes with zero errors (`npm run lint`)
- [ ] Tailwind 4 configured with custom design tokens
- [ ] shadcn/ui components initialized
- [ ] next-intl configured for Ar + En with RTL support
- [ ] `.env.local.example` checked into repo with placeholders
- [ ] `.env*` in `.gitignore`
- [ ] Environment validation at startup (missing vars → error)

### 1.2 CI/CD
- [ ] GitHub Actions workflow runs lint → typecheck → build → test
- [ ] Branch protection rules on `main` and `staging`
- [ ] Pre-commit hooks installed (husky + lint-staged)
- [ ] Supabase local configured in CI

### 1.3 Supabase
- [ ] Local Supabase project initializes
- [ ] Dev/staging/production Supabase projects created
- [ ] TypeScript types generated from database schema

---

## 2. Database

### 2.1 Migrations (012)
- [ ] 001_core_schema.sql — applies cleanly
- [ ] 002_servants.sql — applies cleanly
- [ ] 003_beneficiaries.sql — applies cleanly
- [ ] 004_attendance.sql — applies cleanly
- [ ] 005_followups.sql — applies cleanly
- [ ] 006_spiritual.sql — applies cleanly
- [ ] 007_notifications.sql — applies cleanly
- [ ] 008_audit.sql — applies cleanly
- [ ] 009_rbac.sql — applies cleanly
- [ ] 010_rls_policies.sql — applies cleanly
- [ ] 011_seed_data.sql — applies cleanly
- [ ] 012_indexes.sql — applies cleanly
- [ ] All 12 migrations run as a single batch without error

### 2.2 RLS
- [ ] Every table has RLS enabled
- [ ] Tenant isolation policy on every table (by church_id)
- [ ] Servant can only read own spiritual journal
- [ ] Priest can read all spiritual journals in church
- [ ] Super Admin has blanket read on all church data
- [ ] Unauthenticated requests return empty
- [ ] Cross-church data leakage impossible (verified by test)

### 2.3 Constraints
- [ ] All unique constraints verified
- [ ] All foreign key constraints verified
- [ ] Check constraint on attendance_records (one of beneficiary_id or servant_id)
- [ ] Soft delete implemented on all entity tables
- [ ] Soft delete behavior documented (cascade vs restrict on FK)

### 2.4 Seed Data
- [ ] Default roles created: platform_owner, super_admin, admin, user
- [ ] All 35+ permission codes created
- [ ] All permissions assigned to super_admin
- [ ] `seed_church_roles()` function tested

---

## 3. Authentication

- [ ] Login page renders and authenticates
- [ ] Signup page creates church + auth user + profile + roles (transactional)
- [ ] Signup rolls back on any failure
- [ ] Forgot password flow sends reset email
- [ ] Reset password flow updates password
- [ ] Auth middleware redirects unauthenticated users
- [ ] Auth middleware checks account active status
- [ ] Logout clears session and redirects
- [ ] Rate limiting on login attempts (3 attempts → 15s cooldown)
- [ ] Session refresh mechanism working (Supabase auto-refresh)

---

## 4. RBAC

- [ ] `hasPermission()` implemented and working
- [ ] `hasAnyPermission()` implemented and working
- [ ] `hasAllPermissions()` implemented and working
- [ ] `getUserStageAssignments()` returns correct data
- [ ] `hasStageAccess()` checks role within stage
- [ ] `PermissionGuard` component renders/ hides correctly
- [ ] `RoleGuard` component renders/hides correctly
- [ ] Role management page functional (Super Admin only)
- [ ] Permission check on every Server Action
- [ ] Permission check on every RSC page (redirect or forbidden)
- [ ] RLS as second layer of defense

---

## 5. Church Structure

- [ ] Service CRUD (list, create, edit, soft-delete)
- [ ] Stage CRUD within service context
- [ ] Class CRUD within stage context (optional)
- [ ] Sort order respected in all lists
- [ ] Audit log on every CRUD operation
- [ ] All operations gated by permission checks

---

## 6. Servant Management

- [ ] Servant list with data table, filters, pagination
- [ ] Servant detail with profile, assignment timeline, activity
- [ ] Servant create with all fields from PRD_V3
- [ ] Servant edit with pre-filled form
- [ ] Servant deactivation with end-date on assignments
- [ ] Deactivation prompts beneficiary reassignment
- [ ] Stage assignment UI (select service → select stage → select role)
- [ ] End assignment with date
- [ ] Approval workflow: self-register → pending → approve/reject
- [ ] Notification sent on approval result
- [ ] Bulk import with template download + validation report
- [ ] Service history timeline on detail page
- [ ] All operations gated by permission checks

---

## 7. Beneficiary Management

- [ ] Beneficiary list with data table, filters, pagination
- [ ] Beneficiary detail with profile, assignments, attendance, follow-ups
- [ ] Beneficiary create with all fields from PRD_V3
- [ ] Beneficiary edit with pre-filled form
- [ ] Beneficiary deactivation (soft delete)
- [ ] Deactivation preserves attendance/follow-up records
- [ ] Transfer between stages with history
- [ ] Transfer creates new assignment, ends old one
- [ ] Previous owner loses access after transfer
- [ ] Bulk import with template download + validation report
- [ ] All operations gated by permission checks

---

## 8. Attendance

- [ ] Session page with stage selection + date
- [ ] Mark individual attendance: Present / Absent / Excused
- [ ] Bulk mode: mark all Present, adjust individually
- [ ] Servant attendance recording (separate section)
- [ ] Per-beneficiary attendance history on profile
- [ ] Per-stage attendance history with date range
- [ ] Weekly summary with attendance rate
- [ ] Consecutive absence detection (3+)
- [ ] Absence alert notification created
- [ ] Absence alerts list page with resolve action
- [ ] All operations gated by permission checks

---

## 9. Follow-Up

- [ ] Follow-up list with tabs (My, Overdue, All)
- [ ] Create follow-up with beneficiary, type, date, assigned servant
- [ ] Edit follow-up
- [ ] Status workflow: Open → In Progress → Completed → Cancelled
- [ ] Follow-up history on beneficiary profile
- [ ] Overdue detection
- [ ] Follow-up reminder notification on login
- [ ] All operations gated by permission checks

---

## 10. Spiritual Growth

- [ ] Journal entry form with toggle switches for practices
- [ ] UPSERT on (servant_id, entry_date)
- [ ] Calendar or list view (toggle)
- [ ] Streak counter (consecutive days)
- [ ] Priest view of servant's journal
- [ ] Priest access is audited (audit_log entry)
- [ ] Servant-only access (Admin cannot view)
- [ ] Platform Owner cannot view
- [ ] Export exclusion (spiritual data excluded from all exports)
- [ ] Privacy notice displayed on journal page

---

## 11. Notifications

- [ ] Notification creation service
- [ ] 24h debounce (same type + recipient + entity_id)
- [ ] Bell icon in header with unread count
- [ ] Unread count polls every 60s (TanStack Query)
- [ ] Dropdown: last 10 notifications
- [ ] Mark-as-read on click
- [ ] Notification center page with pagination + filters
- [ ] Bulk mark-as-read
- [ ] Click navigates to context
- [ ] Absence alert integration
- [ ] Approval request integration
- [ ] Approval result integration
- [ ] Follow-up reminder integration

---

## 12. Dashboards

### 12.1 Super Admin
- [ ] Total servants count widget
- [ ] Total beneficiaries count widget
- [ ] Attendance rate (current week) widget
- [ ] Follow-up completion rate widget
- [ ] Pending approvals count widget
- [ ] Absence alerts count widget
- [ ] All widgets show correct data
- [ ] All widgets have loading skeleton
- [ ] Widget error doesn't crash page

### 12.2 Admin
- [ ] Attendance rate by stage widget
- [ ] Beneficiary count by stage widget
- [ ] Servant count by stage widget
- [ ] Overdue follow-ups widget
- [ ] Weekly attendance trend chart (Recharts)
- [ ] Data scoped to assigned stages

### 12.3 User
- [ ] My beneficiaries count widget
- [ ] Today's attendance status widget
- [ ] Spiritual journal streak widget
- [ ] Upcoming follow-ups widget (7 days)
- [ ] Overdue follow-ups widget

---

## 13. UI/UX & Design System

- [ ] App shell with sidebar navigation
- [ ] Mobile bottom navigation (< md breakpoint)
- [ ] Sidebar collapsible
- [ ] Breadcrumbs on all pages
- [ ] Data table with sort, pagination, search
- [ ] All forms use form-field pattern
- [ ] All pages handle loading state (skeleton)
- [ ] All pages handle empty state (illustration + CTA)
- [ ] All pages handle error state (error boundary + retry)
- [ ] All pages handle not-found (detail pages)
- [ ] Toast notification system
- [ ] Confirmation dialogs for destructive actions
- [ ] RTL layout verified on all pages
- [ ] Color contrast meets WCAG AA
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] All interactive elements have labels

---

## 14. Security & Hardening

- [ ] No service_role key in browser bundle
- [ ] No hardcoded secrets
- [ ] All Server Actions check permissions
- [ ] RLS policies verified by integration tests
- [ ] SQL injection: parameterized queries everywhere
- [ ] XSS: all user content rendered safely (no `dangerouslySetInnerHTML`)
- [ ] Audit log on all CRUD operations
- [ ] Audit log on spiritual journal access (Priest)
- [ ] Rate limiting on auth endpoints
- [ ] CORS configured for production domain only
- [ ] Helmet (or equivalent) security headers
- [ ] Cookie security flags: HttpOnly, Secure, SameSite
- [ ] Content Security Policy configured

---

## 15. Testing

- [ ] Unit tests for RBAC service (all functions)
- [ ] Unit tests for form validation schemas
- [ ] Integration tests for all DB migrations
- [ ] Integration tests for RLS policies (all scenarios)
- [ ] Integration tests for DB functions
- [ ] Component tests for shared components (DataTable, PermissionGuard, FormField)
- [ ] E2E: New Church Registration (CP1)
- [ ] E2E: Servant Lifecycle (CP2)
- [ ] E2E: Beneficiary Lifecycle (CP3)
- [ ] E2E: Attendance Recording (CP4)
- [ ] E2E: Follow-up Workflow (CP5)
- [ ] E2E: Spiritual Journal (CP6)
- [ ] E2E: RBAC Enforcement (CP7)
- [ ] E2E: Bulk Import (CP8)
- [ ] E2E: RTL Navigation (CP9)
- [ ] All 33 screens load without 500 error
- [ ] Lighthouse: FCP < 1.5s, LCP < 2.5s, TBT < 200ms
- [ ] axe-core scan: zero violations on all pages

---

## 16. Documentation

- [ ] PRD_V3 final
- [ ] GAP_ANALYSIS
- [ ] MVP_SCOPE
- [ ] DATABASE_REQUIREMENTS
- [ ] RBAC_ARCHITECTURE
- [ ] SYSTEM_ARCHITECTURE
- [ ] IMPLEMENTATION_ROADMAP
- [ ] MVP_BACKLOG
- [ ] SCREEN_INVENTORY
- [ ] DESIGN_SYSTEM_REQUIREMENTS
- [ ] DASHBOARD_SPECIFICATIONS
- [ ] QA_TEST_PLAN
- [ ] MVP_READINESS_CHECKLIST (this document)
- [ ] README updated with setup instructions
- [ ] SECURITY.md

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Tech Lead | | | |
| QA Lead | | | |
| Stakeholder | | | |

---

## Known Gaps (MVP Exclusions)

The following are explicitly deferred:

- **WebSocket / real-time sync** — Notifications poll only; deferred to Phase 2
- **Dark mode** — CSS variable infrastructure exists but not activated
- **Platform Owner Dashboard** — Multi-tenant admin UI
- **Subscription / billing** — Payment integration
- **Advanced reporting** — Rich analytics, PDF reports
- **Mobile push notifications** — In-app only
- **Cron-based reminders** — Login-triggered only
- **API rate limiting (non-auth)** — Deferred
- **Load testing** — Guidelines exist, not executed
- **Penetration testing** — Automated scan only

---

## Checklist Usage

1. **Daily:** Developers check items as they complete them
2. **Weekly:** Tech Lead reviews progress against roadmap
3. **Sprint-end:** QA Lead runs automated + manual tests
4. **Release gate:** All P0 items must be checked; P1/P2 can have documented exceptions
5. **Exceptions:** Each unchecked P0 requires written sign-off from Product Owner + Tech Lead explaining the risk and remediation timeline
