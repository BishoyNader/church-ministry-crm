# Implementation Roadmap — Church Ministry Platform

**Version:** 1.0  
**Source documents:** PRD_V3.md, MVP_SCOPE.md, DATABASE_REQUIREMENTS.md, RBAC_ARCHITECTURE.md, SYSTEM_ARCHITECTURE.md  
**Target:** MVP launch (13 phases, estimated 16–20 weeks)

---

## Phase 0 — Security & Stability Foundation

**Objective:** Establish secure development practices, env configuration, and CI/CD before writing any application code.

**Estimated duration:** 1 week  
**Complexity:** S  
**Dependencies:** None (start here)

### Features
- Repository setup with branch protection rules
- Environment variable validation at startup
- `.env.example` with placeholder values (verified: no real credentials in repo)
- `.gitignore` verification (`.env*`, `node_modules`, `.next`, `supabase/.temp`)
- Linting and formatting configuration (ESLint + Prettier)
- TypeScript strict mode configuration
- CI pipeline (GitHub Actions): lint → typecheck → build
- Pre-commit hooks (husky + lint-staged)
- Sentry error tracking setup (DSN per environment)
- Vercel project linking (preview, staging, production)

### Risks
- Risk: Secrets committed early. Mitigation: pre-commit hook scanning `.env*` files, CI blocks any push with real credentials.

### Acceptance Criteria
- [ ] `git push` triggers lint + typecheck + build in CI
- [ ] `.env.example` contains zero real credentials
- [ ] TypeScript strict mode passes on empty project
- [ ] Sentry reports test error successfully
- [ ] Branch protection enforced on `main` and `staging`

### Definition of Done
- CI pipeline green
- Sentry dashboard showing project
- All developers can run `npm run dev` locally
- `.env.local.example` documented and verified

---

## Phase 1 — Database & RLS Foundation

**Objective:** Create the complete database schema, RLS policies, seed data, and migration pipeline.

**Estimated duration:** 2 weeks  
**Complexity:** XL  
**Dependencies:** Phase 0

### Features
- Supabase project setup (production, staging, local)
- Migration 001–012 (see `DATABASE_REQUIREMENTS.md` section 8)
- RLS policies for every tenant-scoped table
- Seed data: default roles, permissions, system configuration
- Database functions: `get_church_id()`, `get_consecutive_absent_beneficiaries()`
- Indexes for all query paths (see `DATABASE_REQUIREMENTS.md` section 6)
- Supabase type generation (`supabase gen types typescript`)
- Migration CI/CD (auto-apply on deploy)
- Rollback plan for each migration

### Risks
- Risk: Missing RLS policy causes data leak. Mitigation: RLS policy tests in CI (see QA plan).
- Risk: Migration order dependency. Mitigation: all migrations idempotent, tested against fresh DB.
- Unresolved decision: Soft-delete grace period (30 days per DATABASE_REQUIREMENTS). Confirmed — 30 days adopted.

### Acceptance Criteria
- [ ] All 20 tables created with correct columns and constraints
- [ ] RLS enabled on every tenant-scoped table
- [ ] `tenant_isolation` policy prevents cross-church reads (verified by test)
- [ ] `super_admin_read` policy allows Priest to see all church data
- [ ] Seed roles (super_admin, admin, user) created with correct permissions
- [ ] All indexes created (verify via `EXPLAIN ANALYZE` on key queries)
- [ ] Migration runs cleanly from empty DB to latest
- [ ] Rollback restores previous state

### Definition of Done
- Supabase local DB matches production schema
- TypeScript types generated from database
- Migration CI job passes
- RLS penetration test passes (church A cannot see church B data)

---

## Phase 2 — Authentication & Tenant Isolation

**Objective:** Implement user authentication, session management, church registration, and login flow.

**Estimated duration:** 1.5 weeks  
**Complexity:** M  
**Dependencies:** Phase 1

### Features
- Login page (`/[locale]/login`)
- Signup page (`/[locale]/signup`) — creates church + seeds roles + assigns super_admin
- Forgot password / reset password flow
- Auth middleware (protects all routes except public)
- Server-side auth client (`createClient()` from `server.ts`)
- Client-side auth client (`createClient()` from `client.ts`)
- Auth state management (TanStack Query for session)
- Login/logout audit logging
- Account deactivation check (inactive users blocked at login)
- Public route configuration

### Risks
- Risk: Session refresh fails silently. Mitigation: `@supabase/ssr` handles refresh; Sentry monitors auth errors.
- Risk: Signup creates incomplete tenant state (missing roles, etc.). Mitigation: transactional signup — if any step fails, roll back auth user creation.

### Acceptance Criteria
- [ ] User can register, receive confirmation, and log in
- [ ] Church + profile + default roles created on signup
- [ ] Inactive accounts blocked at login
- [ ] Password reset email sent and flow completes
- [ ] Auth middleware redirects unauthenticated users to login
- [ ] Audit log records login/logout events
- [ ] RTL layout on login page works correctly

### Definition of Done
- Login/signup flow tested end-to-end
- Auth middleware protects all non-public routes
- Audit log contains login events

---

## Phase 3 — RBAC & Permission System

**Objective:** Implement role management, permission checking, and UI guards.

**Estimated duration:** 1.5 weeks  
**Complexity:** L  
**Dependencies:** Phase 2

### Features
- Permission check utility (`hasPermission(code)`)
- Stage-level access check (`hasStageAccess(stageId, role)`)
- `PermissionGuard` component (client-side)
- `RoleGuard` component (client-side)
- User role assignment UI (Super Admin assigns roles to users)
- Permission loading with per-request caching
- Server Action permission pattern (enforced via lint rule in Phase 0)
- RLS policies for role-based access (already in Phase 1, verify here)

### Unresolved Decision
- Should `hasPermission()` accept a `churchId` parameter or always use the current user's church? **Decision:** Always use the authenticated user's church. The function derives church_id from the session profile. This prevents parameter injection.

### Risks
- Risk: Permission check inconsistency between UI and Server Action. Mitigation: Single source of truth — `hasPermission()` is used in both layers.
- Risk: Missing permission check on a Server Action. Mitigation: Code review checklist item. Automated lint rule in Phase 2.

### Acceptance Criteria
- [ ] `hasPermission()` returns correct result for each role
- [ ] `PermissionGuard` hides elements from unauthorized users
- [ ] `PermissionGuard` does not render hidden children (security, not just CSS)
- [ ] `hasStageAccess()` correctly scopes to assigned stages
- [ ] Super Admin can assign/revoke roles
- [ ] All existing Server Actions reject unauthorized requests
- [ ] Audit log records role/permission changes

### Definition of Done
- Permission matrix fully implemented
- UI guards + Server Action guards + RLS guards all aligned
- Permission change audit logging verified

---

## Phase 4 — Church / Service / Stage / Class Structure

**Objective:** Implement the hierarchical church structure management.

**Estimated duration:** 1.5 weeks  
**Complexity:** M  
**Dependencies:** Phase 3

### Features
- Service CRUD (create, read, update, soft-delete)
- Stage CRUD (within a service)
- Class CRUD (optional, within a stage)
- Sort order management (drag-and-drop reorder, Phase 2)
- Service/stage/class list pages with hierarchy tree
- Soft delete with cascade rules
- RLS: Super Admin sees all; Admin sees assigned services; User sees nothing (service management is admin-level)

### Risks
- Risk: Cascade delete blocks when beneficiaries assigned. Mitigation: Show error with count of active beneficiaries. Require transfer first.
- Unresolved decision: Should Admin be able to create stages within their assigned services? **Decision:** Yes — Admin can manage stages within services they are assigned to.

### Acceptance Criteria
- [ ] Super Admin can create/edit/archive services
- [ ] Admin can create/edit stages within assigned services
- [ ] Class creation is optional — stages work without classes
- [ ] Soft-delete blocked when active beneficiaries exist
- [ ] Sort order is respected in list views
- [ ] RTL layout renders hierarchy correctly

### Definition of Done
- Full CRUD working for Service → Stage → Class
- Soft-delete cascade rules enforced
- RLS policies restrict access as specified

---

## Phase 5 — Servant Management

**Objective:** Implement servant CRUD, approval workflow, bulk import, and stage assignment.

**Estimated duration:** 2.5 weeks  
**Complexity:** XL  
**Dependencies:** Phase 4

### Features
- Servant profile page (all fields per PRD_V3)
- Servant list page (filterable, searchable, paginated)
- Servant creation form (manual)
- Servant self-registration form (public → pending approval)
- Servant approval queue (Super Admin approves/rejects)
- Bulk import via Excel with template download
- Import validation report
- Servant-to-stage assignment (with role: admin/user)
- Annual reassignment workflow (freeze → reassign → notify)
- Service history timeline on profile
- Soft-delete (deactivate)
- Email notification on approval/rejection (Phase 2: email; MVP: in-app)

### Risks
- Risk: Self-registration floods system. Mitigation: Rate-limited to 3 per hour per IP.
- Risk: Excel import encoding issues with Arabic. Mitigation: Force UTF-8, validate with real Arabic data. Template uses explicit UTF-8 BOM.
- Risk: Annual reassignment data loss. Mitigation: Temporal assignments (start_date/end_date) — never delete, only set end_date.

### Unresolved Decisions
- Should self-registration require email verification before the Priest sees it? **Decision:** No — Priest sees the request immediately. Email verification is Phase 2.
- What is the default role for a self-registered servant? **Decision:** `user`. The Priest can promote to `admin` after approval.

### Acceptance Criteria
- [ ] Servant created manually appears in list
- [ ] Self-registered servant appears in pending queue
- [ ] Super Admin approves → servant activated; rejects → servant notified
- [ ] Bulk import with valid data succeeds; invalid data shows error report
- [ ] Template download produces valid `.xlsx` with correct column headers
- [ ] Servant assigned to stage with role; assignment reflected in permissions
- [ ] Annual reassignment: old assignment ended, new assignment created, history preserved
- [ ] Service history shows timeline of all assignments

### Definition of Done
- Servant CRUD complete
- Approval workflow complete
- Bulk import complete with template
- Stage assignment complete
- Service history tracked

---

## Phase 6 — Beneficiary Management

**Objective:** Implement beneficiary CRUD, bulk import, stage assignment, and transfer history.

**Estimated duration:** 2 weeks  
**Complexity:** L  
**Dependencies:** Phase 4, Phase 5 (servants must exist for assignment)

### Features
- Beneficiary profile page (all fields per PRD_V3)
- Beneficiary list page (filterable by stage, servant, status, searchable)
- Beneficiary creation form (manual)
- Assignment to service → stage → class → servant
- Transfer between stages and servants (with immutable history)
- Assignment history timeline on profile
- Bulk import via Excel with template download
- Import validation report
- Soft-delete (deactivate)
- Graduation workflow (status → 'graduated')

### Risks
- Risk: Transfer history mutation. Mitigation: `beneficiary_assignments` is insert-only. Current assignment identified by `is_current = true`.
- Risk: Orphan beneficiaries (no servant). Mitigation: Assignment requires servant_id. Cannot remove last servant without reassigning.

### Acceptance Criteria
- [ ] Beneficiary created and assigned to stage + servant
- [ ] Beneficiary list filters by stage, servant, status, search
- [ ] Transfer to new stage creates assignment record; history preserved
- [ ] Transfer to new servant creates assignment record; previous servant loses access
- [ ] Bulk import validates each row; error report downloadable
- [ ] Template download produces valid `.xlsx`
- [ ] Soft-delete removes from active lists; restore works

### Definition of Done
- Beneficiary CRUD complete
- Transfer with history complete
- Bulk import complete with template

---

## Phase 7 — Attendance

**Objective:** Implement attendance recording, bulk mode, session management, and absence alerts.

**Estimated duration:** 2 weeks  
**Complexity:** L  
**Dependencies:** Phase 6 (beneficiaries must exist)

### Features
- Session creation (stage + date — auto-creates if not exists)
- Single attendance recording (one beneficiary at a time)
- Bulk attendance recording (mark all as present, then adjust)
- Servant attendance recording (separate from beneficiary)
- Attendance history view (per beneficiary, per stage, per date)
- Consecutive absence detection (sync, after each session submit)
- Absence alert notification creation
- Attendance rate calculation (for dashboard widgets)
- Weekly tracking view

### Unresolved Decision
- Should absence alert detection run synchronously (after each session submission) or asynchronously (cron)?  
  **Decision:** MVP runs synchronously for immediate feedback. Performance concern flagged — if a session has >200 beneficiaries, the detection query may be slow. Mitigation: optimized SQL function (see SYSTEM_ARCHITECTURE section 13.4). Phase 2 moves this to cron.

### Risks
- Risk: Duplicate session for same stage+date. Mitigation: Unique constraint `(stage_id, session_date)` on `attendance_sessions`.
- Risk: Slow bulk submission for large stages (100+ beneficiaries). Mitigation: Single `UPSERT` call with array of records, not individual inserts.

### Acceptance Criteria
- [ ] Servant selects stage + date → sees beneficiary list
- [ ] Single mode: mark each beneficiary Present/Absent/Excused
- [ ] Bulk mode: all marked Present, servant adjusts specific ones
- [ ] Servant attendance recorded separately
- [ ] Audit log records each attendance submission
- [ ] 3 consecutive absences → notification created
- [ ] Attendance history shows per-beneficiary timeline
- [ ] Weekly view shows attendance rate per stage

### Definition of Done
- Single + bulk attendance working
- Consecutive absence alerts firing
- Attendance history viewable
- Audit logging on all submissions

---

## Phase 8 — Spiritual Growth

**Objective:** Implement the private spiritual journal with Priest visibility and privacy controls.

**Estimated duration:** 1.5 weeks  
**Complexity:** M  
**Dependencies:** Phase 5 (servants must exist)

### Features
- Daily journal entry form (all 10 fields + notes)
- Journal view (servant: own entries; Priest: all entries in church)
- One entry per day constraint (UPSERT on `(servant_id, entry_date)`)
- Privacy enforcement (RLS: owner or super_admin only)
- Priest access audit logging
- Streak tracking (consecutive days with at least one field checked)
- Optional reminder settings (servant-configurable)
- No export (data excluded from all bulk operations)

### Risks
- Risk: Privacy bypass via analytics. Mitigation: Spiritual data excluded from ALL aggregate queries. Separate table with no cross-table joins in analytics.
- Risk: Priest access not logged. Mitigation: App-layer enforcement — every Priest read goes through `readSpiritualJournal()` wrapper that logs first.

### Unresolved Decisions
- Should the Priest see entries in real-time or with a delay? **Decision:** Real-time. The privacy concern is about WHO sees it, not WHEN.
- Should the servant be notified when the Priest views their journal? **Decision:** No — this could discourage honest journaling. Only audit-logged, not notified.

### Acceptance Criteria
- [ ] Servant creates daily entry with all fields
- [ ] Duplicate entry for same date → UPSERT (edit existing)
- [ ] Servant sees only own entries
- [ ] Priest sees all entries in church
- [ ] Admin sees NO spiritual data
- [ ] Platform Owner sees NO spiritual data
- [ ] Export excludes spiritual data
- [ ] Every Priest view is audit-logged with timestamp and actor
- [ ] Streak count shows consecutive active days

### Definition of Done
- Journal CRUD working with privacy enforcement
- Priest access audit-logged
- Export exclusion verified
- Streak calculation working

---

## Phase 9 — Notifications

**Objective:** Build the in-app notification center and integrate with alert triggers from attendance and follow-ups.

**Estimated duration:** 1.5 weeks  
**Complexity:** M  
**Dependencies:** Phase 5, Phase 7, Phase 8 (alert sources)

### Features
- Notification database table and RLS
- Notification creation service (used by attendance, follow-up, approval modules)
- Bell icon with unread count badge
- Notification dropdown (last 10)
- Full notification center page (paginated, filterable)
- Mark-as-read (single + bulk)
- Click-to-navigate (notification → context)
- Notification types: all types defined in SYSTEM_ARCHITECTURE section 12.2
- Rate-limited notification creation (debounce per type per recipient per day)

### Risks
- Risk: Notification spam (e.g., daily absence alerts for the same beneficiary). Mitigation: Debounce — only one alert per type per beneficiary per day.
- Risk: Notification center performance with thousands of notifications. Mitigation: Pagination (25 per page), soft-delete after 90 days.

### Acceptance Criteria
- [ ] Bell icon shows unread count
- [ ] Dropdown shows last 10 unread notifications
- [ ] Full page shows all notifications with pagination
- [ ] Filters: type, date range, read/unread
- [ ] Mark-as-read works (single + bulk)
- [ ] Click navigates to correct context
- [ ] Absence alerts create notifications
- [ ] Follow-up reminders create notifications
- [ ] Approval requests create notifications

### Definition of Done
- Notification center fully functional
- All alert sources integrated
- Debounce working (no duplicate notifications)
- 90-day auto-cleanup (cron: Phase 2; manual for MVP)

---

## Phase 10 — Dashboards & Reports

**Objective:** Build role-specific dashboards with widgets and KPIs.

**Estimated duration:** 1.5 weeks  
**Complexity:** M  
**Dependencies:** Phase 5, Phase 6, Phase 7, Phase 8 (data sources)

### Features
- Super Admin dashboard (5+ widgets)
- Admin dashboard (stage-scoped widgets)
- User dashboard (personal widgets)
- Attendance rate widget (per stage)
- Follow-up completion widget
- Servant engagement widget (login frequency)
- Spiritual journal streak widget (user only)
- Pending approvals widget (Super Admin only)
- Absence alerts widget

### Risks
- Risk: Dashboard queries slow with large datasets. Mitigation: All widgets use aggregate SQL queries with indexes. Phase 2: materialized views.

### Acceptance Criteria
- [ ] Super Admin sees church-wide stats
- [ ] Admin sees stage-scoped stats (only assigned stages)
- [ ] User sees personal stats (own beneficiaries, attendance, journal)
- [ ] Widgets load within 2 seconds
- [ ] Empty states display correctly (no data → illustration + CTA)
- [ ] Widgets respect RLS (no cross-church data)

### Definition of Done
- All role-specific dashboards rendering
- Widget data verified against manual SQL queries
- Empty states for all widgets

---

## Phase 11 — Import / Export

**Objective:** Finalize import pipeline and add export functionality.

**Estimated duration:** 1 week  
**Complexity:** M  
**Dependencies:** Phase 5, Phase 6

### Features
- Excel import for servants (verify template, parsing, validation)
- Excel import for beneficiaries (verify template, parsing, validation)
- Import validation report (success count + error rows)
- Template download endpoints (servant, beneficiary)
- CSV export (basic — Phase 2 adds Excel export)
- Export audit logging

### Risks
- Risk: Arabic text corruption in Excel. Mitigation: Force UTF-8 with BOM. Test with Arabic data before launch.
- Risk: Large file upload timeout. Mitigation: MVP limit 500 rows per import. Async processing Phase 2.

### Acceptance Criteria
- [ ] Template downloads produce valid `.xlsx`
- [ ] Valid import → data appears in system
- [ ] Invalid import → error report shows row numbers and reasons
- [ ] Partial import is atomic (all or nothing)
- [ ] Import events logged in audit
- [ ] CSV export produces valid file

### Definition of Done
- Import pipeline complete for servants and beneficiaries
- Export working (CSV)
- All imports/exports audited

---

## Phase 12 — Audit & Compliance

**Objective:** Implement the audit log viewer and verify immutability.

**Estimated duration:** 0.5 weeks  
**Complexity:** S  
**Dependencies:** All previous phases (audit logging already integrated)

### Features
- Audit log viewer page (Super Admin)
- Filters: entity type, action, actor, date range
- Paginated list
- Expanded diff view (old_values → new_values)
- Verify app-level audit immutability (no delete/update endpoints)
- Audit retention documentation

### Acceptance Criteria
- [ ] Audit page accessible to Super Admin
- [ ] Filters work correctly
- [ ] Diff view shows changes clearly
- [ ] No API or Server Action allows audit log deletion
- [ ] Audit logs retained for minimum 90 days

### Definition of Done
- Audit viewer complete
- Immutability verified
- Retention documented

---

## Phase 13 — QA / Hardening / Production Readiness

**Objective:** Final QA pass, performance optimization, security hardening, and production configuration.

**Estimated duration:** 2 weeks  
**Complexity:** L  
**Dependencies:** All previous phases

### Features
- Full QA test pass (see QA_TEST_PLAN.md)
- Performance optimization (slow queries, missing indexes, N+1 fixes)
- Security penetration test (tenant isolation, auth bypass, permission bypass)
- Load testing (simulate 50 concurrent users)
- Error monitoring configuration (Sentry: source maps, performance traces)
- Production environment configuration (Vercel domains, Supabase production project)
- SSL/TLS verification
- Backup strategy verification
- Rollback plan documentation
- Runbook creation (deploy, restore, incident response)

### Risks
- Risk: Performance issues found late. Mitigation: Performance testing integrated from Phase 1 (indexes). Load test in Phase 13 validates.
- Risk: RLS bypass found during pen test. Mitigation: Dedicated RLS test suite run in CI.

### Acceptance Criteria
- [ ] All Phase 1–12 ACs passing
- [ ] Zero critical/high security findings from pen test
- [ ] Load test: 50 concurrent users, <2s response time
- [ ] Sentry error tracking active with source maps
- [ ] Production backup verified (restore test)
- [ ] Runbook reviewed by team
- [ ] MVP_READINESS_CHECKLIST.md all items checked

### Definition of Done
- MVP ready for launch
- Production environment live
- Monitoring active
- Runbook documented

---

## Summary Timeline

| Phase | Duration | Complexity | Cumulative |
|-------|----------|------------|------------|
| 0 — Security & Stability | 1 week | S | Week 1 |
| 1 — Database & RLS | 2 weeks | XL | Week 3 |
| 2 — Authentication | 1.5 weeks | M | Week 4.5 |
| 3 — RBAC | 1.5 weeks | L | Week 6 |
| 4 — Church Structure | 1.5 weeks | M | Week 7.5 |
| 5 — Servant Management | 2.5 weeks | XL | Week 10 |
| 6 — Beneficiary Mgmt | 2 weeks | L | Week 12 |
| 7 — Attendance | 2 weeks | L | Week 14 |
| 8 — Spiritual Growth | 1.5 weeks | M | Week 15.5 |
| 9 — Notifications | 1.5 weeks | M | Week 17 |
| 10 — Dashboards | 1.5 weeks | M | Week 18.5 |
| 11 — Import/Export | 1 week | M | Week 19.5 |
| 12 — Audit | 0.5 week | S | Week 20 |
| 13 — QA + Hardening | 2 weeks | L | Week 22 |

**Total estimated duration: 22 weeks (5.5 months)**

---

## Rework Warning Areas

1. **Attendance alert timing (sync vs async):** Phase 7 implements sync detection. If performance is unacceptable, Phase 9 or Phase 13 may need to refactor to async (cron). Plan for this: keep the detection query as a separate function that can be called either way.

2. **Phase 5 (Servant) and Phase 6 (Beneficiary)** have significant overlap in import logic. Consider building a shared import pipeline in Phase 5 that Phase 6 extends, rather than duplicating.

3. **Notification integration points:** Phase 9 depends on Phase 5 (approvals), Phase 7 (absence alerts), and Phase 8. Ensure those phases create notification data in the expected format. Define the notification creation interface in Phase 5 and enforce it.

4. **Class entity optionality:** Every screen that handles stage-level data must conditionally show/hide class-level controls. This adds complexity to 6+ screens. Consider deferring Class entity to Phase 2 if it blocks MVP timeline.

5. **Dashboard data sources:** Phase 10 depends on data from 4 prior phases. If any phase is delayed, dashboard widgets for that data source must show empty/loading states. Plan for graceful degradation.
