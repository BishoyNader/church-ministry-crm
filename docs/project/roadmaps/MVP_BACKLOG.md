# MVP Backlog — Church Ministry Platform

**Version:** 1.0  
**Priority scale:** P0 (blocking), P1 (important), P2 (nice-to-have)  
**Effort scale:** 1 = <1 day, 2 = 1–2 days, 3 = 3–5 days, 5 = 1+ week

---

## Epic 1: Infrastructure & Foundation

### Feature 1.1 — Project Setup
**Priority:** P0 | **Effort:** 2 | **Dependencies:** None

#### Story 1.1.1 — Initialize Next.js project
- Initialize Next.js 16 App Router with TypeScript
- Configure Tailwind 4, shadcn/ui
- Configure next-intl for i18n
- Verify RTL rendering works

#### Story 1.1.2 — Configure CI pipeline
- GitHub Actions: lint → typecheck → build → test
- Branch protection rules on main/staging
- Pre-commit hooks (husky + lint-staged)

#### Story 1.1.3 — Configure Supabase project
- Create Supabase projects (local, dev, staging, production)
- Install Supabase CLI
- Configure local development database
- Generate initial TypeScript types

#### Story 1.1.4 — Set up environment configuration
- Create `.env.local.example` with placeholder values
- Verify `.gitignore` excludes all `.env*`
- Add env validation at startup

**Acceptance Criteria:** Project builds, CI passes, local DB connects, RTL works.

### Feature 1.2 — Database Schema
**Priority:** P0 | **Effort:** 5 | **Dependencies:** Feature 1.1

#### Story 1.2.1 — Create core tables (churches, profiles, services, stages, classes)
**Tasks:**
- Write migration 001_core_schema.sql
- Enable RLS on all tables
- Add church_id to all tables
- Create unique index on churches.slug
- Create index on (church_id, deleted_at) for profiles

#### Story 1.2.2 — Create servant tables
**Tasks:**
- Write migration 002_servants.sql
- Add unique constraint linking servants.id → profiles.id
- Add temporal tracking columns (start_date, end_date)

#### Story 1.2.3 — Create beneficiary tables
**Tasks:**
- Write migration 003_beneficiaries.sql
- Add beneficiary_assignments with is_current flag
- Add unique constraint on (beneficiary_id, is_current)

#### Story 1.2.4 — Create attendance tables
**Tasks:**
- Write migration 004_attendance.sql
- Add unique constraint on (stage_id, session_date)
- Add check constraint: exactly one of beneficiary_id or servant_id must be set

#### Story 1.2.5 — Create follow-up and spiritual tables
**Tasks:**
- Write migration 005_followups.sql
- Write migration 006_spiritual.sql
- Add unique constraint on (servant_id, entry_date) for spiritual journal

#### Story 1.2.6 — Create notification and audit tables
**Tasks:**
- Write migration 007_notifications.sql
- Write migration 008_audit.sql
- Add indexes on (recipient_id, is_read) and (church_id, created_at)

#### Story 1.2.7 — Create RBAC tables
**Tasks:**
- Write migration 009_rbac.sql
- Add unique constraint on permissions.code
- Add unique constraint on (role_id, permission_id)

#### Story 1.2.8 — Write RLS policies
**Tasks:**
- Write migration 010_rls_policies.sql
- Create tenant_isolation policy for each table
- Create super_admin_read policy (bypass for Priests)
- Create servant_scope policy for user-level access
- Create spiritual_owner_or_priest policy

#### Story 1.2.9 — Seed default data
**Tasks:**
- Write migration 011_seed_data.sql
- Create seed_church_roles() function
- Create all permission codes
- Assign all permissions to super_admin

#### Story 1.2.10 — Create indexes
**Tasks:**
- Write migration 012_indexes.sql
- Create all indexes from DATABASE_REQUIREMENTS.md section 6

**Acceptance Criteria:** All 12 migrations run cleanly. RLS policies verified by test.

### Feature 1.3 — Shared UI Components
**Priority:** P0 | **Effort:** 3 | **Dependencies:** Feature 1.1

#### Story 1.3.1 — Create app shell
- Responsive sidebar navigation
- Header with church name, locale toggle, notification bell, user menu
- Mobile bottom navigation
- Breadcrumbs

#### Story 1.3.2 — Create data table component
- Sortable columns
- Pagination
- Search/filter bar
- Row actions menu
- Empty state slot
- Loading skeleton

#### Story 1.3.3 — Create form primitives
- Form field wrapper (label, error, helper text)
- Text input, select, date picker, textarea
- Searchable select (for stage/servant pickers)
- File upload (for import)
- Form submit button with loading state

#### Story 1.3.4 — Create feedback components
- Toast notification system
- Confirmation dialog
- Error boundary
- Empty state component (illustration + message + CTA)
- Loading skeleton component

#### Story 1.3.5 — Create guard components
- `PermissionGuard` — wraps children, checks permission code
- `RoleGuard` — wraps children, checks minimum role
- Both render nothing when unauthorized (not just CSS hide)

**Acceptance Criteria:** Components render correctly in both LTR and RTL.

---

## Epic 2: Authentication & RBAC

### Feature 2.1 — Authentication
**Priority:** P0 | **Effort:** 3 | **Dependencies:** Feature 1.2

#### Story 2.1.1 — Implement login page
**Tasks:**
- Create `/[locale]/login` page
- Login form with email + password
- Zod validation schema
- Server Action: `loginAction()`
- Error handling (invalid credentials, inactive account)
- Redirect to dashboard on success
- RTL-compatible layout

#### Story 2.1.2 — Implement signup page
**Tasks:**
- Create `/[locale]/signup` page
- Church registration form (church name Ar/En, admin name, email, password)
- Server Action: `signupAction()`
- Create church → create auth user → create profile → seed roles → assign super_admin
- Transactional: roll back auth user if any step fails
- Redirect to login on success

#### Story 2.1.3 — Implement password reset
**Tasks:**
- Create `/[locale]/forgot-password` page
- Create `/[locale]/reset-password` page
- Server Action: `forgotPasswordAction()` → Supabase Auth reset
- Server Action: `resetPasswordAction()` → update password

#### Story 2.1.4 — Implement auth middleware
**Tasks:**
- Create `src/middleware.ts`
- Public routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/`
- All other routes: redirect to login if unauthenticated
- Check account active status
- Check church active status

#### Story 2.1.5 — Implement logout
**Tasks:**
- Server Action: `logoutAction()`
- Clear session cookies
- Audit log
- Redirect to login

**Acceptance Criteria:** Full auth flow working end-to-end.

### Feature 2.2 — RBAC Enforcement
**Priority:** P0 | **Effort:** 3 | **Dependencies:** Feature 2.1, Feature 1.2

#### Story 2.2.1 — Implement permission check service
**Tasks:**
- Create `src/features/rbac/services/rbac.service.ts`
- Implement `loadUserPermissions()` — loads permissions from DB, caches per request
- Implement `hasPermission(code)` — checks single permission
- Implement `hasAnyPermission(codes)` — checks any of the list
- Implement `hasAllPermissions(codes)` — checks all in list

#### Story 2.2.2 — Implement stage-level access check
**Tasks:**
- Implement `getUserStageAssignments()` — loads servant's stage assignments
- Implement `hasStageAccess(stageId, requiredRole)` — checks stage-level access
- Implement `getAccessibleStageIds(requiredRole)` — returns all stage IDs user can access

#### Story 2.2.3 — Create UI guard components
**Tasks:**
- `PermissionGuard` — renders children only if user has permission
- `RoleGuard` — renders children only if user meets minimum role
- Both accept fallback prop (optional: show nothing, message, or custom element)

#### Story 2.2.4 — Create role assignment UI
**Tasks:**
- Create role management page under Settings
- List users with current roles
- Assign/revoke role (Super Admin only)
- Audit log on role change

**Acceptance Criteria:** Permission checks pass on all layers.

---

## Epic 3: Church Structure

### Feature 3.1 — Service Management
**Priority:** P0 | **Effort:** 2 | **Dependencies:** Feature 2.2

#### Story 3.1.1 — Service list page
**Tasks:**
- Create `/[locale]/services` page
- List services with name, stage count, status, sort order
- Create service button
- Soft-delete with confirmation

#### Story 3.1.2 — Service create/edit form
**Tasks:**
- Form fields: name_ar, name_en, description_ar, description_en, sort_order
- Zod validation
- Server Action: `createServiceAction()`, `updateServiceAction()`
- Audit log on create/update/delete

**Acceptance Criteria:** Service CRUD complete.

### Feature 3.2 — Stage Management
**Priority:** P0 | **Effort:** 2 | **Dependencies:** Feature 3.1

#### Story 3.2.1 — Stage list page
**Tasks:**
- Create `/[locale]/services/[serviceId]/stages` page
- List stages with name, age range, class count, sort order
- Create stage button
- Soft-delete with cascade check

#### Story 3.2.2 — Stage create/edit form
**Tasks:**
- Form fields: name_ar, name_en, description_ar, description_en, age_min, age_max, sort_order
- Server Action with permission check
- Audit log

**Acceptance Criteria:** Stage CRUD complete within service context.

### Feature 3.3 — Class Management
**Priority:** P1 | **Effort:** 1 | **Dependencies:** Feature 3.2

#### Story 3.3.1 — Class list within stage
**Tasks:**
- Class list shown as sub-section on stage page
- Create/edit/soft-delete
- Sort order

**Note:** Class is optional. If no classes exist, stage operates without class grouping.

**Acceptance Criteria:** Class CRUD complete (can be skipped if timeline is tight).

---

## Epic 4: Servant Management

### Feature 4.1 — Servant CRUD
**Priority:** P0 | **Effort:** 5 | **Dependencies:** Feature 3.1, Feature 3.2

#### Story 4.1.1 — Servant list page
**Tasks:**
- Create `/[locale]/servants` page
- Data table: name, email, phone, stage, role, approval status, active status
- Filters: stage, approval status, role, search (name/email/phone)
- Pagination
- Actions: view, edit, deactivate, approve/reject

#### Story 4.1.2 — Servant detail page
**Tasks:**
- Create `/[locale]/servants/[servantId]` page
- Profile information section
- Assignment timeline (service history)
- Current stage assignments
- Activity log (recent follow-ups, attendance)

#### Story 4.1.3 — Servant create/edit form
**Tasks:**
- All fields from PRD_V3: full_name_ar, full_name_en, DOB, gender, mobile, WhatsApp, email, address, church, confession_father, join_date, notes
- Stage assignment (select service → select stage → select role)
- Zod validation
- Server Action with permission check (`servants.create` / `servants.update`)
- Audit log

#### Story 4.1.4 — Servant deactivation
**Tasks:**
- Server Action: `deactivateServantAction()`
- End all current stage assignments (set end_date)
- Reassign beneficiaries to another servant (or prompt)
- Audit log

**Acceptance Criteria:** Servant CRUD complete.

### Feature 4.2 — Servant Approval Workflow
**Priority:** P0 | **Effort:** 2 | **Dependencies:** Feature 4.1

#### Story 4.2.1 — Self-registration form
**Tasks:**
- Create `/[locale]/register` public page
- Form fields: name, email, phone, church selection (slug-based)
- On submit: create servant with `approval_status = 'pending'`
- Notify Super Admin (in-app notification)

#### Story 4.2.2 — Approval queue
**Tasks:**
- Create `/[locale]/servants/pending` page (Super Admin only)
- List pending servants with registration details
- Approve button → set `approval_status = 'approved'`, `approved_by`, `approved_at`
- Reject button → set `approval_status = 'rejected'`, optional reason
- Notify servant of result (in-app notification)

**Acceptance Criteria:** Approval workflow complete.

### Feature 4.3 — Servant Stage Assignment
**Priority:** P0 | **Effort:** 2 | **Dependencies:** Feature 4.1, Feature 3.2

#### Story 4.3.1 — Assign servant to stage
**Tasks:**
- UI on servant detail page: "Assign to Stage"
- Select service → select stage → select role (admin/user)
- Server Action: `assignServantToStageAction()`
- Create `servant_stage_assignments` row with `start_date = today`
- Audit log

#### Story 4.3.2 — End servant assignment
**Tasks:**
- UI: "End Assignment" button on active assignments
- Set `end_date` on current assignment
- Beneficiary reassignment prompt if servant has assigned beneficiaries

**Acceptance Criteria:** Assignment management complete.

### Feature 4.4 — Servant Bulk Import
**Priority:** P1 | **Effort:** 3 | **Dependencies:** Feature 4.1

#### Story 4.4.1 — Template download
**Tasks:**
- Create `/[locale]/servants/import` page
- "Download Template" button → generates `.xlsx` with headers
- Headers: full_name_ar, full_name_en, email, phone, gender, dob, stage_name, role

#### Story 4.4.2 — Import execution
**Tasks:**
- File upload (Excel): Server Action receives file
- Parse with `xlsx` library
- Validate each row against Zod schema
- Return validation report: { success_count, error_rows: [{ row, field, error }] }
- On confirm: insert all valid rows in transaction
- Audit log with summary

**Acceptance Criteria:** Bulk import working with validation.

### Feature 4.5 — Service History
**Priority:** P1 | **Effort:** 1 | **Dependencies:** Feature 4.3

#### Story 4.5.1 — Display assignment timeline
**Tasks:**
- Timeline component on servant detail page
- Shows all servant_stage_assignments ordered by start_date
- Current assignment highlighted
- Past assignments show end_date

**Acceptance Criteria:** Timeline renders correctly.

---

## Epic 5: Beneficiary Management

### Feature 5.1 — Beneficiary CRUD
**Priority:** P0 | **Effort:** 3 | **Dependencies:** Feature 4.1, Feature 3.2

#### Story 5.1.1 — Beneficiary list page
**Tasks:**
- Create `/[locale]/beneficiaries` page
- Data table: name, stage, responsible servant, status, phone
- Filters: stage, servant, status, search (name/phone)
- Pagination
- Actions: view, edit, transfer, deactivate

#### Story 5.1.2 — Beneficiary detail page
**Tasks:**
- Create `/[locale]/beneficiaries/[beneficiaryId]` page
- Profile information section
- Current assignment (stage, servant)
- Assignment history timeline
- Attendance history summary
- Follow-up list

#### Story 5.1.3 — Beneficiary create/edit form
**Tasks:**
- All fields from PRD_V3: full_name_ar, full_name_en, DOB, gender, address, school, mobile, father_mobile, mother_mobile, WhatsApp, confession_father, notes
- Assignment: select service → select stage → select class (optional) → select servant
- Zod validation
- Server Action with permission check (`beneficiaries.create` / `beneficiaries.update`)
- Audit log

#### Story 5.1.4 — Beneficiary deactivation
**Tasks:**
- Server Action: `deactivateBeneficiaryAction()`
- Soft delete (set `deleted_at`, status = 'inactive')
- Preserve attendance and follow-up records (keep but mark beneficiary as inactive)

**Acceptance Criteria:** Beneficiary CRUD complete.

### Feature 5.2 — Beneficiary Transfer
**Priority:** P0 | **Effort:** 2 | **Dependencies:** Feature 5.1

#### Story 5.2.1 — Transfer between stages
**Tasks:**
- Transfer UI on beneficiary detail page
- Select target stage (+ optional servant)
- Server Action: `transferBeneficiaryAction()`
- Create new beneficiary_assignments row with `is_current = true`
- Set previous assignment `is_current = false`, `end_date = now()`
- Audit log with old/new stage + servant

#### Story 5.2.2 — Transfer history display
**Tasks:**
- Timeline component on beneficiary detail page
- Shows all beneficiary_assignments ordered by start_date
- Current assignment highlighted
- Shows who performed the transfer

**Acceptance Criteria:** Transfer creates history record. Previous owner loses access.

### Feature 5.3 — Beneficiary Bulk Import
**Priority:** P1 | **Effort:** 3 | **Dependencies:** Feature 5.1

#### Story 5.3.1 — Template download
**Tasks:**
- Download button on import page → `.xlsx` with headers
- Headers: full_name_ar, full_name_en, dob, gender, stage_name, servant_email, father_mobile, mother_mobile

#### Story 5.3.2 — Import execution
**Tasks:**
- Same pipeline as servant import (shared import service)
- Validate + report + confirm
- Audit log

**Acceptance Criteria:** Bulk import working with validation.

---

## Epic 6: Attendance

### Feature 6.1 — Attendance Recording
**Priority:** P0 | **Effort:** 3 | **Dependencies:** Feature 5.1, Feature 3.2

#### Story 6.1.1 — Session page (single mode)
**Tasks:**
- Create `/[locale]/attendance/record` page
- Select service → select stage → select date (defaults to today)
- Show beneficiary list with status dropdown (Present/Absent/Excused)
- Submit button → create session + records
- Server Action: `createAttendanceAction()`
- Audit log

#### Story 6.1.2 — Bulk attendance mode
**Tasks:**
- Toggle on session page: "Bulk Mode"
- Mark all as Present with one click
- Individually adjust specific beneficiaries
- Submit same as single mode

#### Story 6.1.3 — Servant attendance recording
**Tasks:**
- Separate section on session page: "Servant Attendance"
- List servants assigned to the stage
- Mark Present/Absent/Excused

**Acceptance Criteria:** Attendance recording complete for both modes.

### Feature 6.2 — Attendance History
**Priority:** P0 | **Effort:** 2 | **Dependencies:** Feature 6.1

#### Story 6.2.1 — Per-beneficiary history
**Tasks:**
- Attendance table on beneficiary detail page
- Shows session date, status, recorded by
- Weekly/monthly view toggle

#### Story 6.2.2 — Per-stage history
**Tasks:**
- Create `/[locale]/attendance/history` page
- Select stage → date range
- Table: beneficiary name, status per date, attendance rate
- Weekly summary: total sessions, present %, absent %, excused %

**Acceptance Criteria:** Attendance history renders correctly.

### Feature 6.3 — Absence Alerts
**Priority:** P0 | **Effort:** 2 | **Dependencies:** Feature 6.1, Epic 9 (notifications)

#### Story 6.3.1 — Consecutive absence detection
**Tasks:**
- Implement `get_consecutive_absent_beneficiaries()` SQL function
- Call after each attendance session submission
- If threshold (3) reached → create notification
- Include beneficiary name, count, responsible servant in notification data

#### Story 6.3.2 — Absence alerts page
**Tasks:**
- Create `/[locale]/attendance/alerts` page
- List active alerts: beneficiary, count, servant, stage
- Mark alert as "resolved" (attendance recorded after alert)
- Super Admin view: all alerts. User view: own alerts.

**Acceptance Criteria:** Absence alerts fire correctly. Alerts page renders.

---

## Epic 7: Follow-Up Management

### Feature 7.1 — Follow-Up CRUD
**Priority:** P0 | **Effort:** 2 | **Dependencies:** Feature 5.1, Feature 4.1

#### Story 7.1.1 — Follow-up list page
**Tasks:**
- Create `/[locale]/followups` page
- Tabs: My Follow-ups, Overdue
- Data table: beneficiary, type, scheduled date, status, assigned to
- Filters: status, type, beneficiary
- Actions: edit, complete, cancel

#### Story 7.1.2 — Create/edit follow-up form
**Tasks:**
- Form: beneficiary (searchable), type, notes, outcome, next action, assigned servant, scheduled_at
- Status workflow: Open → In Progress → Completed → Cancelled
- Server Action with permission check
- Audit log

#### Story 7.1.3 — Follow-up history on beneficiary profile
**Tasks:**
- List of follow-ups on beneficiary detail page
- Ordered by date, most recent first
- Shows status, assigned servant, outcome

**Acceptance Criteria:** Follow-up CRUD complete.

---

## Epic 8: Spiritual Growth

### Feature 8.1 — Spiritual Journal
**Priority:** P0 | **Effort:** 3 | **Dependencies:** Feature 4.1

#### Story 8.1.1 — Journal entry form
**Tasks:**
- Create `/[locale]/spiritual` page
- Date selector (defaults to today)
- Toggle switches for: Morning Prayer, Third Hour, Sixth Hour, Ninth Hour, Sunset, Sleep, Bible Reading, Confession, Communion
- Textarea for spiritual notes
- Server Action: `createSpiritualEntryAction()` — UPSERT on (servant_id, entry_date)
- Privacy notice displayed at top

#### Story 8.1.2 — Journal view (own entries)
**Tasks:**
- Calendar view or list view (toggle)
- List: date, summary of checked items, notes preview
- Click to edit entry
- Streak counter: consecutive days with at least one field checked

#### Story 8.1.3 — Journal view (Priest)
**Tasks:**
- Super Admin: servant selector → show that servant's entries
- Same layout as servant view
- Every access logged in audit (servant_id, priest_id, timestamp)

**Acceptance Criteria:** Journal CRUD complete. Privacy enforced. Priest access audited.

### Feature 8.2 — Privacy Enforcement
**Priority:** P0 | **Effort:** 1 | **Dependencies:** Feature 8.1

#### Story 8.2.1 — RLS policy verification
**Tasks:**
- Verify RLS: servant sees own entries only
- Verify RLS: Priest sees all entries in church
- Verify RLS: Admin sees no entries
- Verify RLS: Platform Owner sees no entries

#### Story 8.2.2 — Audit logging for Priest access
**Tasks:**
- App-layer audit wrapper: every Priest read calls `auditLog()` with action = 'access', entity_type = 'spiritual_journal'
- Verify audit log contains actor, target, timestamp

#### Story 8.2.3 — Export exclusion
**Tasks:**
- Verify spiritual_journal_entries is excluded from all export queries
- Verify no API endpoint or Server Action exposes spiritual data to export

**Acceptance Criteria:** Privacy model verified by tests. Export exclusion verified.

---

## Epic 9: Notifications

### Feature 9.1 — Notification Center
**Priority:** P0 | **Effort:** 2 | **Dependencies:** Feature 2.1

#### Story 9.1.1 — Notification creation service
**Tasks:**
- Create `createNotification()` service function
- Parameters: churchId, recipientId, type, title, body, data
- Create row in notifications table
- Debounce: skip if identical notification (type + recipient + entity_id) within last 24h

#### Story 9.1.2 — Bell icon + dropdown
**Tasks:**
- Notification bell in header (client component)
- Poll for unread count (TanStack Query, refetch 60s)
- Dropdown: last 10 notifications, each with mark-as-read
- Unread count badge on bell

#### Story 9.1.3 — Notification center page
**Tasks:**
- Create `/[locale]/notifications` page
- Paginated list (25 per page)
- Filters: type, date range, read/unread
- Bulk mark-as-read
- Click → navigate to context (beneficiary profile, servant profile, etc.)

**Acceptance Criteria:** Notification center complete.

### Feature 9.2 — Alert Integration
**Priority:** P0 | **Effort:** 2 | **Dependencies:** Feature 9.1

#### Story 9.2.1 — Absence alert integration
**Tasks:**
- Connect attendance absence detector to notification service
- Type: 'consecutive_absence'
- Recipient: responsible servant
- Title: "غياب متكرر - {beneficiary_name}"

#### Story 9.2.2 — Approval request integration
**Tasks:**
- Connect servant self-registration to notification service
- Type: 'approval_required'
- Recipient: all Super Admins in church

#### Story 9.2.3 — Approval result integration
**Tasks:**
- Connect approval action to notification service
- Type: 'approval_result'
- Recipient: the registered servant

#### Story 9.2.4 — Follow-up reminder integration
**Tasks:**
- Check for follow-ups with `scheduled_at <= now()` and `status = 'open'`
- Run on each login (for MVP; cron in Phase 2)
- Create notification for assigned servant

**Acceptance Criteria:** All alert sources create notifications.

---

## Epic 10: Dashboards

### Feature 10.1 — Role-Specific Dashboards
**Priority:** P0 | **Effort:** 3 | **Dependencies:** Epic 4, Epic 5, Epic 6, Epic 8

#### Story 10.1.1 — Super Admin dashboard
**Tasks:**
- Create `/[locale]/dashboard` page (Super Admin layout)
- Widget: Total servants (active/pending) — source: servants table
- Widget: Total beneficiaries — source: beneficiaries table
- Widget: Attendance rate this week — source: attendance_records
- Widget: Follow-up completion rate — source: followups
- Widget: Pending approvals count — source: servants
- Widget: Absence alerts count — source: notifications
- All widgets are RSC with Suspense boundaries

#### Story 10.1.2 — Admin dashboard
**Tasks:**
- Same route, different layout (Admin layout)
- Widget: Attendance rate per stage (assigned stages only) — source: attendance_records
- Widget: Beneficiary count per stage — source: beneficiaries
- Widget: Servant count per stage — source: servant_stage_assignments
- Widget: Overdue follow-ups — source: followups
- Widget: Weekly attendance trend (simple bar chart using Recharts)

#### Story 10.1.3 — User dashboard
**Tasks:**
- Same route, different layout (User layout)
- Widget: My assigned beneficiaries count — source: beneficiary_assignments
- Widget: Today's attendance status — source: attendance_records
- Widget: Upcoming follow-ups (next 7 days) — source: followups
- Widget: Overdue follow-ups count — source: followups
- Widget: Spiritual journal streak — source: spiritual_journal_entries

**Acceptance Criteria:** Dashboards render correct data per role.

---

## Epic 11: Import / Export

### Feature 11.1 — Import Pipeline
**Priority:** P1 | **Effort:** 3 | **Dependencies:** Epic 4, Epic 5

#### Story 11.1.1 — Shared import service
**Tasks:**
- Create `src/features/import-export/services/import.service.ts`
- `parseImportFile<T>(file, schema)` — parse Excel, validate rows, return { valid, errors }
- `generateTemplate(columns)` — generate `.xlsx` with headers
- `executeImport(data, insertFn)` — transaction insert with audit

#### Story 11.1.2 — Servant import page
**Tasks:**
- Create import page UI (or reuse existing pattern)
- Download template → upload → validate → review → confirm

#### Story 11.1.3 — Beneficiary import page
**Tasks:**
- Same pattern as servant import

**Acceptance Criteria:** Import pipeline works for both entities.

### Feature 11.2 — Export (Basic)
**Priority:** P2 | **Effort:** 2 | **Dependencies:** Epic 4, Epic 5

#### Story 11.2.1 — CSV export
**Tasks:**
- Export servants: all fields except spiritual data
- Export beneficiaries: all fields
- Export attendance: session date, beneficiary, status
- Export follow-ups: all fields

**Acceptance Criteria:** CSV exports produce valid files.

---

## Epic 12: Audit & Settings

### Feature 12.1 — Audit Log Viewer
**Priority:** P1 | **Effort:** 1 | **Dependencies:** All prior epics (they create audit logs)

#### Story 12.1.1 — Audit page
**Tasks:**
- Create `/[locale]/settings/audit` page (Super Admin only)
- Data table: timestamp, actor, action, entity_type, entity_id
- Filters: entity_type, action, actor, date range
- Expanded row: old_values → new_values diff
- Pagination

**Acceptance Criteria:** Audit page shows all logged events.

### Feature 12.2 — Church Settings
**Priority:** P1 | **Effort:** 1 | **Dependencies:** Feature 2.1

#### Story 12.2.1 — Church profile settings
**Tasks:**
- Edit church name (Ar/En), logo, locale
- View subscription info (Phase 2: edit)
- Server Action with permission check (`settings.update`)

**Acceptance Criteria:** Church settings page functional.

---

## Epic 13: Platform Owner Admin (Phase 2)

**Note:** This epic is explicitly OUT of MVP scope per PRD_V3. Listed here for reference.

- Tenant list
- Subscription management
- System monitoring
- Audit log viewer (cross-tenant)

---

## Backlog Summary

| Epic | Features | Stories | Total Effort | Priority |
|------|----------|---------|-------------|----------|
| 1 — Infrastructure | 3 | 20 | 13 | P0 |
| 2 — Auth & RBAC | 2 | 9 | 8 | P0 |
| 3 — Church Structure | 3 | 6 | 5 | P0 |
| 4 — Servant Management | 5 | 12 | 13 | P0 |
| 5 — Beneficiary Mgmt | 3 | 8 | 8 | P0 |
| 6 — Attendance | 3 | 7 | 7 | P0 |
| 7 — Follow-Up | 1 | 3 | 2 | P0 |
| 8 — Spiritual Growth | 2 | 6 | 4 | P0 |
| 9 — Notifications | 2 | 7 | 4 | P0 |
| 10 — Dashboards | 1 | 3 | 3 | P0 |
| 11 — Import/Export | 2 | 5 | 5 | P1 |
| 12 — Audit & Settings | 2 | 3 | 2 | P1 |
| **Total** | **29** | **89** | **74** | |
