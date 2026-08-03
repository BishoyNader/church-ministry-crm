# Church Ministry CRM — Full Project Handoff

## Project

Church Ministry CRM

Stack:

* Next.js 15 App Router
* TypeScript
* React Query
* Supabase
* PostgreSQL
* RLS
* RBAC
* next-intl
* shadcn/ui
* Tailwind

Repository state:

* Production deployed
* Auth working
* Registration working
* Supabase connected
* Vercel deployed

---

# Completed Infrastructure

## Auth

Completed:

* Login
* Logout
* Forgot Password
* Reset Password
* Pending Approval flow
* Existing Church Signup
* New Church Request flow

## RBAC

Completed:

* Permission-based authorization
* Server-side permission enforcement
* Client-side permission visibility
* React Query cached access state
* Role-aware navigation

## RLS

Completed:

* Migration chain verified through 028
* Permission-scoped writes
* Tenant-scoped reads
* Church isolation
* Platform Owner bootstrap
* Immutable church ownership rules
* Audit logging

## Registration

Completed:

* Existing church registration
* Church request workflow
* Approval workflow
* Role assignment
* Stage assignment

---

# Database Status

Migrations applied conceptually through:

001 → 028

Critical migrations already completed:

024_p0_beneficiary_assignment_rpcs.sql

025_remove_church_english_name.sql

026_platform_owner_bootstrap.sql

027_rbac_rls_hardening.sql

028_security_remediation.sql

Fresh reset validation passed.

Platform Owner bootstrap verified.

No known migration blockers.

---

# Current Roles

platform_owner

super_admin
(Display name = Ministry Admin / أمين الخدمة)

admin
(Display name = Stage Leader / أمين مرحلة)

servant
(Display name = خادم)

---

# Completed Modules

## Dashboard

Completed:

* KPI cards
* Role-based dashboards
* Stage analytics
* Attendance analytics

## Children Module

Completed:

* CRUD
* Transfers
* Assignment history
* Attendance integration
* Followups integration

## Attendance Module

Completed:

* Session management
* Attendance recording
* Attendance analytics

## Followups Module

Completed:

* CRUD
* Assignment
* Scheduling metadata

## Stages Module

Completed

## Users Module

Completed

## Church Requests

Completed

## Servants Module

Completed:

* List
* Edit
* Stage assignment
* Archive
* Approval integration

## Approval Center

Completed:

* Route: /approvals
* Approval stats
* Pending users
* Pending servants
* Role assignment
* Stage assignment
* Church request integration

## Notifications Center

Completed:

* Route: /notifications
* Header bell
* Unread badge
* Pagination
* Filters
* Mark read
* Mark all read

Notification types:

* servant_pending
* church_pending
* birthday
* attendance_absence
* followup_reminder
* system

Important:
Notifications are EVENT-DRIVEN only.

There is NO:

* cron
* scheduler
* pg_cron
* edge function
* background worker

Automation not implemented yet.

## Reports Module

Completed:

* Route: /reports
* reports.read
* reports.export
* attendance analytics
* servant attendance
* beneficiary attendance
* followup analytics
* stage comparison
* monthly trends
* yearly trends
* CSV export

---

# Known Missing Modules

1. Spiritual Journal
2. Settings
3. Excel Import
4. Excel Export enhancements
5. Notification Scheduler
6. Audit Viewer
7. Services Management
8. Classes Management
9. Platform Analytics
10. Subscription/Billing

---

# Highest Priority Remaining Work

## P1

Spiritual Journal

Requirements:

* Private servant journal
* Daily spiritual tracking
* Prayer
* Bible reading
* Liturgy attendance
* Confession
* Notes

Security:

* Owner-only visibility
* No servant-to-servant access
* Respect migration 022/026 privacy model

---

## P2

Settings Module

Requirements:

* Profile
* Email
* Password
* Personal preferences
* Church settings (authorized roles only)

---

## P3

Excel Import/Export

Requirements:

* Bulk beneficiary import
* Validation
* Error reporting
* Church-scoped
* Permission protected

---

## P4

Notification Automation

Requirements:

* Birthday scan
* Repeated absence scan
* Followup due reminders
* Approval reminders

Implementation:

* Vercel Cron preferred

---

# Validation Requirements

For every change:

Run:

npx tsc --noEmit

npm run lint

npm run build

Report:

1. Files created
2. Files modified
3. Security implications
4. Validation results
5. Rollback plan

Never claim success without command output.

---

# Rules

* No mock data
* No placeholder UI
* No permission bypasses
* No service-role shortcuts unless already approved
* Respect RLS
* Respect RBAC
* Church-scoped data only
* Reuse existing patterns before creating new infrastructure
* Prefer additive changes
* Do not modify migration 001-028 behavior without explicit justification

Current project completion estimate:
~80% MVP complete

Next recommended task:
Spiritual Journal Module
