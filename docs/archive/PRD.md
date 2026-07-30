# Church Ministry Platform — Product Requirements Document V2

**Status:** Draft  
**Version:** 2.0  
**Classification:** Internal — Stakeholders, Engineering, Design, QA  

---

## 1. Executive Summary

The Church Ministry Platform is a multi‑tenant SaaS solution purpose‑built for the operational and spiritual needs of churches. It replaces fragmented tools (spreadsheets, messaging groups, paper records) with a unified, privacy‑first system that covers the full lifecycle of church ministry: servant management, beneficiary tracking, attendance, follow‑ups, spiritual growth, notifications, and analytics.

Each tenant (church) operates in complete isolation. Data, users, roles, and configuration never cross tenant boundaries. The platform supports Arabic and English with full RTL/LTR layout switching.

The MVP targets the core workflow — servant → beneficiary → attendance → follow‑up — and expands in subsequent phases to spiritual growth, notifications engine, and platform‑owner tooling. The product vision is to become the canonical operational system for church administration across the Arabic‑speaking world and beyond.

---

## 2. Product Vision

**Every church, regardless of size, deserves modern administrative tooling that respects its unique structure, language, and spiritual mission.**

The platform will be the trusted operating system for church ministry — handling the operational complexity so priests, ministry leaders, and servants can focus on people, not paperwork. It will set the standard for church‑focused SaaS through exceptional UX, strong privacy guarantees, and deep respect for church hierarchy and tradition.

---

## 3. Business Objectives

| Objective | Metric | Target |
|-----------|--------|--------|
| Tenant acquisition | Active churches | 50 in year 1, 500 in year 3 |
| Servant engagement | Weekly active servants | >60% of registered servants |
| Attendance coverage | Sessions with recorded attendance | >90% of scheduled sessions |
| Follow‑up completion | Follow‑ups marked done vs. created | >75% completion rate |
| User satisfaction | NPS score | >50 |
| Revenue | MRR | $10K (year 1), $100K (year 3) |

---

## 4. User Personas

### 4.1 Youssef — Platform Owner

- **Role:** System administrator / operator of the SaaS platform
- **Goals:** Monitor tenant health, manage subscriptions, handle escalations
- **Pain points:** No visibility into tenant usage, manual billing, no way to debug tenant issues
- **Needs:** Tenant dashboard, subscription CRUD, impersonation (read‑only), audit log viewer, system metrics

### 4.2 Father Mikhail — Priest

- **Role:** Highest authority inside a church
- **Goals:** Oversee all ministry activity, access spiritual records, manage leadership
- **Pain points:** Paper records, no visibility into servant engagement, no consolidated reports
- **Needs:** Cross‑ministry dashboards, spiritual record access, role assignment, servant approval workflow

### 4.3 George — Ministry Leader

- **Role:** Responsible for one or more stages/ministries
- **Goals:** Track servant performance, monitor attendance, review follow‑ups
- **Pain points:** Can't see across his stages, no attendance trend data, manual Excel tracking
- **Needs:** Stage‑level dashboards, attendance reports, follow‑up review, servant roster management

### 4.4 Mary — Servant

- **Role:** Regular servant working directly with beneficiaries
- **Goals:** Record attendance, log follow‑ups, access assigned beneficiaries
- **Pain points:** No central place to track her work, duplicate data entry, missed follow‑ups
- **Needs:** Mobile‑friendly attendance, quick follow‑up forms, beneficiary list, personal spiritual journal

### 4.5 Mina — Beneficiary (Child/Student)

- **Role:** Recipient of ministry services (managed by parents/servants)
- **Goals:** N/A (managed by adults)
- **Needs:** Accurate records, privacy, safe data handling

---

## 5. Role Matrix

| Role | Scope | Can Create | Can Read | Can Update | Can Delete | Can Approve |
|------|-------|------------|----------|------------|------------|-------------|
| Platform Owner | System | Tenants, subscriptions, admins | All tenant data (aggregate) | Tenants, plans | Tenants | N/A |
| Priest | Church | Ministries, stages, roles, servants | All church data | All church data | Ministries, stages | Servant activation |
| Ministry Leader | Assigned ministries/stages | Attendance, follow‑ups, stages | Assigned ministry data | Beneficiaries, attendance | Follow‑ups (own) | N/A |
| Servant | Assigned beneficiaries | Attendance, follow‑ups, spiritual journal | Assigned beneficiaries | Beneficiaries (limited) | Follow‑ups (own) | N/A |

---

## 6. Functional Requirements

### FR‑1 Tenant Management
- FR‑1.1 Platform Owner can create, suspend, and delete tenants
- FR‑1.2 Each tenant receives an isolated database schema or row‑level security boundary
- FR‑1.3 Tenant provisioning is automated (self‑service signup or admin‑created)
- FR‑1.4 Tenants have a slug‑based subdomain or path prefix

### FR‑2 Subscription & Billing
- FR‑2.1 Multiple subscription tiers (e.g., Starter, Growth, Enterprise)
- FR‑2.2 Trial period configurable per plan (default 14 days)
- FR‑2.3 Usage limits per tier (max servants, max beneficiaries, storage)
- FR‑2.4 Invoicing and payment integration (Stripe or equivalent)
- FR‑2.5 Downgrade/upgrade with proration

### FR‑3 Church Configuration
- FR‑3.1 Church profile (name, logo, contact, address, slug)
- FR‑3.2 Feature flags per church
- FR‑3.3 Locale preference (Arabic / English)
- FR‑3.4 Configurable role permissions (Priest‑level override)
- FR‑3.5 Notification channel preferences

### FR‑4 User & Servant Management
- FR‑4.1 Invite‑based user creation (email invitation)
- FR‑4.2 Self‑registration with Priest approval workflow
- FR‑4.3 Bulk import via Excel with downloadable template
- FR‑4.4 Servant profile: full name (Ar/En), DOB, gender, mobile, WhatsApp, email, address, church, ministry, stage, confession father, join date, service history, notes
- FR‑4.5 Servant activation requires Priest approval
- FR‑4.6 Deactivation / archival (soft‑delete)
- FR‑4.7 Assignment history tracking

### FR‑5 Beneficiary Management
- FR‑5.1 Beneficiary profile: full name (Ar/En), DOB, gender, address, school, mobile, father mobile, mother mobile, WhatsApp, confession father, notes
- FR‑5.2 Manual creation, bulk Excel import, downloadable template
- FR‑5.3 Assignment to church → ministry → stage → responsible servant
- FR‑5.4 Transfer between stages and servants with assignment history
- FR‑5.5 Soft‑delete with restore capability

### FR‑6 Ministry & Stage Management
- FR‑6.1 Ministry entity (name Ar/En, description, sort order)
- FR‑6.2 Stage entity (name Ar/En, description, age range, sort order)
- FR‑6.3 Ministries contain stages (one‑to‑many)
- FR‑6.4 Stages can be archived
- FR‑6.5 Ministry Leader assignment per ministry / stage

### FR‑7 Attendance
- FR‑7.1 Record beneficiary attendance per session (Present / Absent / Excused)
- FR‑7.2 Record servant attendance
- FR‑7.3 Weekly session attendance tracking
- FR‑7.4 Consecutive absence alerts (configurable threshold, default 3 weeks)
- FR‑7.5 Low attendance rate alerts
- FR‑7.6 Missing attendance submission reminders

### FR‑8 Follow‑Up Management
- FR‑8.1 Create follow‑up record: date, type, notes, outcome, next action, assigned servant
- FR‑8.2 Follow‑up reminders (due‑date based)
- FR‑8.3 Follow‑up history per beneficiary
- FR‑8.4 Status tracking (Open, In Progress, Completed, Cancelled)
- FR‑8.5 Assignment and reassignment

### FR‑9 Spiritual Growth Module
- FR‑9.1 Track: Morning Prayer, Third Hour, Sixth Hour, Ninth Hour, Sunset, Sleep, Bible Reading, Confession, Communion, Spiritual Notes
- FR‑9.2 **Private by default** — only the recording servant and Priest can view
- FR‑9.3 Configurable church‑level visibility rules
- FR‑9.4 Audit log for every access to spiritual records
- FR‑9.5 No export of spiritual data (by design — privacy)
- FR‑9.6 Optional reminder scheduling

### FR‑10 Notifications
- FR‑10.1 In‑app notification center (bell icon, dropdown, full page)
- FR‑10.2 Email notifications (transactional: invite, approval, alert)
- FR‑10.3 WhatsApp integration (Phase 2)
- FR‑10.4 Notification templates per type
- FR‑10.5 Per‑channel opt‑out at user level
- FR‑10.6 Notification history

### FR‑11 Reporting & Dashboards
- FR‑11.1 Platform Owner dashboard (church growth, active subs, system usage)
- FR‑11.2 Priest dashboard (ministry performance, attendance trends, follow‑up completion, servant engagement)
- FR‑11.3 Ministry Leader dashboard (stage performance, attendance, follow‑up metrics)
- FR‑11.4 Servant dashboard (assigned beneficiaries, attendance history, follow‑up tasks)

### FR‑12 Import / Export
- FR‑12.1 Excel import for servants, beneficiaries, attendance, follow‑ups
- FR‑12.2 Excel export for same entities
- FR‑12.3 CSV export
- FR‑12.4 Downloadable template files (with headers and instructions)
- FR‑12.5 Import validation report (success count, error rows)

### FR‑13 Audit & Compliance
- FR‑13.1 Immutable audit log (append‑only)
- FR‑13.2 Tracked events: login, permission changes, beneficiary updates, servant updates, attendance changes, follow‑up changes, spiritual record access
- FR‑13.3 Audit log viewer (Priest and Platform Owner)
- FR‑13.4 Retention policy configurable (default 1 year)

---

## 7. Non‑Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR‑1 | Tenant isolation | Row‑level security or schema‑per‑tenant; no data leakage |
| NFR‑2 | Page load time (server) | <2s P95 |
| NFR‑3 | Page load time (client) | <1s TTI for authenticated pages |
| NFR‑4 | API response time | <200ms P95 for read endpoints |
| NFR‑5 | Uptime | 99.9% (excluding planned maintenance) |
| NFR‑6 | i18n | Arabic + English; full RTL/LTR support |
| NFR‑7 | Accessibility | WCAG 2.1 AA |
| NFR‑8 | Mobile responsiveness | All workflows functional on 375px+ screens |
| NFR‑9 | Data retention | Audit logs: 1 year; Soft‑delete: 90 days |
| NFR‑10 | Backup | Daily automated backups, point‑in‑time recovery |
| NFR‑11 | Encryption at rest | AES‑256 |
| NFR‑12 | Encryption in transit | TLS 1.3 |

---

## 8. User Stories

### US‑1 Servant Registration
> As a prospective servant, I want to register my interest online so that the Priest can review and activate my account.

### US‑2 Beneficiary Transfer
> As a Ministry Leader, I want to transfer a beneficiary from one stage to another so that they continue receiving age‑appropriate ministry.

### US‑3 Consecutive Absence Alert
> As a servant, I want to be notified when a beneficiary misses 3 consecutive sessions so that I can follow up.

### US‑4 Spiritual Journal Entry
> As a servant, I want to record my daily spiritual practices privately so that only I and the Priest can review my growth.

### US‑5 Bulk Attendance
> As a servant, I want to mark attendance for all beneficiaries in my stage at once so that I save time.

### US‑6 Follow‑Up Reminder
> As a servant, I want receive a reminder when a follow‑up is due so that I never miss a check‑in.

### US‑7 Priest Approval Queue
> As a Priest, I want to review and approve or reject new servant registrations so that only trusted individuals serve.

### US‑8 Tenant Usage Report
> As a Platform Owner, I want to view monthly active users per church so that I can identify engagement trends.

---

## 9. Acceptance Criteria

### AC‑1 Servant Registration Approval
1. User submits registration form with required fields
2. Priest receives in‑app notification + email
3. Priest reviews profile and clicks Approve or Reject
4. On approval, servant receives welcome email with login link
5. On rejection, servant receives notification with reason
6. Timeline: approval within 48 hours → automatic escalation to Platform Owner

### AC‑2 Beneficiary Transfer with History
1. Ministry Leader selects beneficiary → Transfer
2. Selects target stage and optional new responsible servant
3. System records old and new assignment with timestamp and actor
4. Beneficiary appears in new stage immediately
5. Assignment history viewable on beneficiary profile
6. Previous servant loses edit access; new servant gains access

### AC‑3 Attendance Consecutive Absence Alert
1. System checks attendance after each session submission
2. If beneficiary has 3 consecutive Absent statuses → trigger alert
3. Alert sent to responsible servant (in‑app + email)
4. Alert appears in notification center
5. Priest receives summary if >5 beneficiaries hit threshold

---

## 10. Permission Matrix

| Feature | Platform Owner | Priest | Ministry Leader | Servant |
|---------|---------------|--------|-----------------|---------|
| View church | ✅ | ✅ | ✅ | ✅ |
| Edit church settings | ✅ | ✅ | ❌ | ❌ |
| Manage ministries | ❌ | ✅ | ✅ (assigned) | ❌ |
| Manage stages | ❌ | ✅ | ✅ (assigned) | ❌ |
| View all servants | ✅ | ✅ | ✅ (assigned) | ❌ |
| Approve servants | ❌ | ✅ | ❌ | ❌ |
| View all beneficiaries | ❌ | ✅ | ✅ (assigned) | ✅ (assigned) |
| Create beneficiary | ❌ | ✅ | ✅ | ❌ |
| Edit beneficiary | ❌ | ✅ | ✅ | ✅ (limited) |
| Record attendance | ❌ | ✅ | ✅ | ✅ |
| View attendance reports | ✅ | ✅ | ✅ (assigned) | ✅ (own) |
| Create follow‑ups | ❌ | ✅ | ✅ | ✅ |
| View all follow‑ups | ❌ | ✅ | ✅ (assigned) | ❌ |
| Spiritual journal (own) | ❌ | ✅ | ❌ | ✅ |
| View spiritual journal (others) | ❌ | ✅ | ❌ | ❌ |
| View audit logs | ✅ | ✅ | ❌ | ❌ |
| Manage subscriptions | ✅ | ❌ | ❌ | ❌ |
| Import/Export | ❌ | ✅ | ✅ | ❌ |
| Manage notifications | ❌ | ✅ | ❌ | ❌ |

---

## 11. Feature Breakdown

### Core (MVP)
- Church registration / onboarding
- User authentication (email + password)
- Role‑based access control
- Servant management (CRUD + bulk import + approval workflow)
- Beneficiary management (CRUD + bulk import + assignment)
- Ministry & Stage management (CRUD)
- Attendance (single + bulk)
- Follow‑up management
- Basic dashboard (per role)
- Arabic + English i18n
- RTL/LTR layout

### Phase 2
- Spiritual Growth module
- Notifications engine (in‑app + email)
- Excel/CSV export
- Advanced dashboards
- Beneficiary transfer history
- Consecutive absence alerts
- Subscription & billing (Stripe)
- Platform Owner dashboard

### Phase 3
- Mobile‑optimized workflows
- WhatsApp notifications
- Calendar integration
- Servant self‑registration portal
- Advanced reporting (charts, exports)
- Audit log viewer
- Feature flags
- Usage limits enforcement

---

## 12. System Modules

1. **Tenant Management** — provisioning, isolation, slug routing
2. **Auth & Identity** — login, signup, password reset, session management
3. **RBAC Engine** — roles, permissions, guards (route‑level + component‑level)
4. **Church Config** — profile, locale, feature flags, notification prefs
5. **Servant Module** — CRUD, import, approval workflow, service history
6. **Beneficiary Module** — CRUD, import, assignment, transfer history
7. **Ministry & Stage** — hierarchy management
8. **Attendance** — session recording, bulk mode, alerts
9. **Follow‑Up** — records, reminders, status tracking
10. **Spiritual Growth** — private journal, restricted access, audit
11. **Notifications** — engine, templates, channels (in‑app, email, WhatsApp)
12. **Reports & Dashboards** — role‑specific analytics
13. **Import / Export** — Excel/CSV pipeline, template generation, validation
14. **Audit** — append‑only log, viewer, retention
15. **Billing** — plans, subscriptions, invoices, Stripe integration

---

## 13. Navigation Structure

### App Shell (authenticated)

```
[Logo] [Church Name]                    [Ar/En] [Bell] [Avatar ▼]
──────────────────────────────────────────────────────────────────
│ Dashboard                              │
│ Ministries                             │
│   ├── All Ministries                   │
│   └── Stages                           │
│ Servants                               │
│   ├── All Servants                     │
│   ├── Pending Approval                 │
│   └── Import                           │
│ Beneficiaries                          │
│   ├── All Beneficiaries                │
│   ├── By Stage                         │
│   ├── Transfers                        │
│   └── Import                           │
│ Attendance                             │
│   ├── Record Attendance                │
│   ├── Attendance History               │
│   └── Alerts                           │
│ Follow‑Ups                             │
│   ├── My Follow‑Ups                    │
│   ├── All Follow‑Ups                   │
│   └── Overdue                          │
│ Spiritual (servant)                    │
│ Reports                                │
│ Settings                               │
│   ├── Church Profile                   │
│   ├── Roles & Permissions              │
│   ├── Notification Settings            │
│   └── Import / Export                  │
└─────────────────────────────────────────
```

### Platform Owner (separate admin area)

```
[Platform Admin]
──────────────────────────────────────────
│ Dashboard                              │
│ Churches                               │
│   ├── All Churches                     │
│   ├── Pending                          │
│   └── Suspended                        │
│ Subscriptions                          │
│   ├── Plans                            │
│   ├── Invoices                         │
│   └── Trials                           │
│ System                                 │
│   ├── Usage Metrics                    │
│   ├── Audit Log                        │
│   └── Support Tickets                  │
└─────────────────────────────────────────
```

---

## 14. Information Architecture

### Entity Relationship (logical)

```
Church
├── Ministries
│   └── Stages
│       ├── ServantAssignments
│       └── BeneficiaryAssignments
├── Servants
│   ├── UserAccount
│   ├── ServantProfile
│   ├── ServiceHistory
│   └── SpiritualJournal
├── Beneficiaries
│   ├── BeneficiaryProfile
│   ├── AssignmentHistory
│   └── AttendanceRecords
├── Attendance
│   ├── Sessions
│   └── Records (beneficiary + servant)
├── FollowUps
│   ├── Records
│   └── Reminders
├── Notifications
│   ├── Templates
│   └── Logs
├── AuditLogs
├── Roles
│   └── Permissions
└── Config
    ├── FeatureFlags
    └── LocalePreferences
```

### Key constraints

- Servants and Beneficiaries are **always** church‑scoped (never cross‑tenant)
- Ministries are **always** church‑scoped
- Stages belong to exactly one ministry
- A beneficiary belongs to exactly one stage at a time
- Assignment history is append‑only (immutable once written)
- Spiritual journal records are user + church scoped with Priest access

---

## 15. Dashboard Definitions

### Platform Owner Dashboard

| Widget | Data Source | Refresh |
|--------|-------------|---------|
| Active churches (total, % change) | Tenant table | Real‑time |
| New churches this month | Tenant table + signup date | Daily |
| MRR / ARR | Billing system | Real‑time |
| Subscription distribution (plan breakdown) | Billing system | Daily |
| System uptime | Health check | Real‑time |
| Top 5 churches by active users | Usage aggregation | Daily |
| Pending support tickets | Support system | Real‑time |

### Priest Dashboard

| Widget | Data Source | Refresh |
|--------|-------------|---------|
| Total servants (active, pending) | Servant table | Real‑time |
| Total beneficiaries | Beneficiary table | Real‑time |
| Attendance rate (current week) | Attendance records | Real‑time |
| Follow‑up completion rate | Follow‑up table | Daily |
| Servants with pending approvals | Servant table | Real‑time |
| Consecutive absence alerts count | Alert engine | Real‑time |
| Ministry attendance comparison | Attendance aggregation | Weekly |
| Servant engagement (login frequency) | Auth logs | Weekly |

### Ministry Leader Dashboard

| Widget | Data Source | Refresh |
|--------|-------------|---------|
| Stage performance (attendance %) | Attendance records | Real‑time |
| Beneficiary count per stage | Beneficiary table | Real‑time |
| Servant count per stage | Servant assignments | Real‑time |
| Overdue follow‑ups | Follow‑up table | Real‑time |
| Weekly attendance trend | Attendance aggregation | Weekly |
| Top servants by follow‑up completion | Follow‑up aggregation | Weekly |

### Servant Dashboard

| Widget | Data Source | Refresh |
|--------|-------------|---------|
| My assigned beneficiaries | Beneficiary assignments | Real‑time |
| Today's attendance status | Attendance records | Real‑time |
| Upcoming follow‑ups | Follow‑up table | Real‑time |
| Overdue follow‑ups count | Follow‑up table | Real‑time |
| My attendance history | Attendance records (self) | Weekly |
| Spiritual journal streak | Spiritual journal | Real‑time |

---

## 16. Reporting Requirements

### RR‑1 Church Growth Report (Platform Owner)
- New churches per month (chart)
- Active vs. inactive churches
- Geographic distribution
- Average servants per church

### RR‑2 Ministry Performance Report (Priest)
- Attendance rate per ministry / stage
- Servant‑to‑beneficiary ratio
- Follow‑up completion rate per ministry
- Servant retention (joined vs. deactivated)

### RR‑3 Attendance Report (Ministry Leader)
- Weekly attendance trend (line chart)
- Attendance by status (pie chart)
- Most‑absent beneficiaries
- Servant attendance rate

### RR‑4 Servant Activity Report (Priest)
- Login frequency
- Follow‑up velocity (created vs. completed)
- Attendance recording frequency
- Spiritual journal consistency

### RR‑5 Beneficiary Report (Servant)
- Beneficiary list with status
- Attendance per beneficiary
- Follow‑up history per beneficiary
- Transfer history

---

## 17. Notification Requirements

### NR‑1 Notification Types

| Type | Trigger | Channel | Priority |
|------|---------|---------|----------|
| Servant registration | New registration | In‑app, Email | High |
| Approval required | Registration pending >24h | Email (Priest) | Medium |
| Approval result | Approve/Reject action | In‑app, Email | High |
| Beneficiary 3‑consecutive absence | Attendance recorded | In‑app, Email | High |
| Follow‑up due | Due date reached | In‑app | Medium |
| Follow‑up overdue | Due date + 24h | In‑app, Email | High |
| Birthday | Beneficiary birthday | In‑app | Low |
| Attendance reminder | Session day (9 AM) | In‑app, Email | Medium |
| Missing attendance | Session day + 2h | In‑app | Medium |
| Spiritual journal reminder | Custom schedule | In‑app | Low |
| Subscription expiring | 7 days before end | Email | High |
| Subscription expired | Expiration date | Email | High |

### NR‑2 In‑App Notification Center
- Bell icon with unread count badge
- Dropdown shows last 10 notifications with mark‑as‑read
- Full page at `/notifications` with pagination, filters (type, date, read/unread)
- Bulk mark‑as‑read
- Clicking a notification navigates to relevant context (e.g., beneficiary profile)

---

## 18. Security Requirements

### SR‑1 Authentication
- Password minimum: 8 characters, complexity required
- Rate limiting on login: 5 attempts per 15 minutes per IP
- Session timeout: 24 hours (configurable)
- MFA optional (Phase 2)

### SR‑2 Authorization
- Every Server Action checks authentication + permission
- Every API route checks authentication + permission
- Every database query respects RLS / tenant isolation
- Default‑deny: no action succeeds without explicit permission

### SR‑3 Data Protection
- All PII encrypted at rest (AES‑256)
- All traffic encrypted in transit (TLS 1.3)
- Service‑role / admin credentials never in client bundle
- No secrets in `.env.example` — placeholders only

### SR‑4 Audit
- All mutations logged with actor, timestamp, old/new values
- Audit log is append‑only (no deletes, no updates)
- Spiritual record access logged separately
- Retention: 1 year minimum

### SR‑5 Tenant Isolation
- RLS policies enforce `church_id` on every query
- No cross‑tenant API or DB access possible
- Subdomain / path‑based tenant routing

---

## 19. Privacy Requirements

### PR‑1 Spiritual Data
- Visible only to the recording servant and the Priest
- Church‑level visibility rules (Priest can tighten, never loosen)
- No export of spiritual data
- Separate audit trail for spiritual record access
- No analytics or aggregation on spiritual data

### PR‑2 PII
- Beneficiary PII not shared between ministries without explicit permission
- Servant contact info visible only to Priest and Ministry Leader
- Phone numbers never exposed in lists without explicit need
- GDPR‑style data deletion request workflow

### PR‑3 Data Portability
- Church can export all non‑spiritual data at any time
- Export format: JSON or CSV
- Full data deletion on tenant cancellation (30‑day grace period)

---

## 20. Multi‑Tenant Requirements

### MTR‑1 Isolation Model
- **Row‑level security** (preferred): single database, `church_id` on every table
- RLS policy on every table: `church_id = auth.user.church_id()`
- Service‑role client reserved for auth creation and system operations only
- Regular client (`authenticated` role) used for all application queries

### MTR‑2 Tenant Provisioning
- Self‑service: church registration → automatic provisioning
- Admin: Platform Owner creates tenant manually
- On provisioning: create schema entries, seed roles/permissions, send welcome

### MTR‑3 Tenant Deletion
- Soft‑delete: tenant marked as `deleted_at`
- 30‑day grace period for data export
- Hard delete after 30 days (cron job)
- All user sessions invalidated on deletion

### MTR‑4 Feature Flags
- Per‑tenant feature flags (e.g., "spiritual module enabled", "whatsapp enabled")
- Flags stored in `tenant_config` table
- Flags evaluated at request time

### MTR‑5 Usage Limits
- Per‑plan limits: max servants, max beneficiaries, storage (MB), API calls/day
- Limits enforced in Server Actions and service layer
- Warning notification at 80% usage
- Blocking at 100% usage (with upgrade prompt)

---

## 21. Import / Export Requirements

### IER‑1 Import Pipeline
1. User downloads template (.xlsx) with column headers and validation rules
2. User fills data and uploads
3. Server validates each row (format, required fields, duplicates)
4. Validation report returned: X succeeded, Y errors with row numbers and reasons
5. User can download error report
6. On confirm, valid rows are imported; no partial imports (all or nothing within a batch)

### IER‑2 Export Pipeline
1. User selects entity + optional filters (stage, date range, etc.)
2. System generates .xlsx or .csv file
3. File served via signed URL (expires in 1 hour)
4. Export history logged in audit

### IER‑3 Templates
- Servant template: full_name_ar, full_name_en, email, phone, gender, dob, ministry, stage
- Beneficiary template: full_name_ar, full_name_en, dob, gender, stage, parent_phone, etc.
- Attendance template: beneficiary_id, stage_id, date, status
- Follow‑up template: beneficiary_id, type, scheduled_at, assigned_to, notes

---

## 22. Mobile Requirements

### MR‑1 Responsive Breakpoints

| Breakpoint | Target | Layout |
|------------|--------|--------|
| 375px – 639px | Mobile phone | Single column, bottom nav, full‑screen modals |
| 640px – 1023px | Tablet | Two‑column, sidebar collapsed, left drawer nav |
| 1024px+ | Desktop | Full sidebar, multi‑column layouts, side panels |

### MR‑2 Mobile‑Specific Workflows
- **Quick Attendance:** tap stage → tap beneficiaries → mark P/A/E → submit (3 taps per beneficiary)
- **Quick Follow‑Up:** tap beneficiary → short form (type, notes, submit)
- **Beneficiary Lookup:** search by name or phone, view profile, call parent (tel: link)
- **Notifications:** swipe to mark read, tap to navigate

### MR‑3 Touch Targets
- Minimum tap target: 44×44px
- No hover‑dependent interactions
- Swipe gestures for list actions (delete, archive)

### MR‑4 Offline
- Phase 2: cache last‑loaded stage beneficiary list
- Phase 3: offline attendance with sync

---

## 23. UI/UX Requirements

### UXR‑1 Design Principles
- **Clarity:** One primary action per screen, minimal cognitive load
- **Speed:** Keyboard shortcuts for power users, optimistic UI updates
- **Respect for Arabic:** True RTL mirroring (not just text‑align), Arabic‑first typography
- **Consistency:** Single design system (components, spacing, typography, color)

### UXR‑2 Visual Design
- Clean, ample whitespace; no crowded tables
- Card‑based layouts for dashboards
- Professional illustrations for empty states
- Skeleton loaders for all async content
- Toast notifications for success/error states
- Confirmation dialogs for destructive actions
- Inline validation with clear error messages

### UXR‑3 Arabic Experience
- Font: Noto Naskh Arabic (headings) + Noto Sans Arabic (body)
- Full RTL mirroring: sidebar on the right, form labels on the right, pagination reversed
- Date formats: Hijri + Gregorian optional
- Numbers: Arabic numeral support (configurable: ١٢٣ vs 123)

### UXR‑4 Empty States
- Zero servants: illustration + "Invite your first servant" CTA
- Zero beneficiaries: illustration + "Add your first beneficiary" CTA (link to import)
- Zero attendance: illustration + "Record today's attendance" CTA
- Zero follow‑ups: illustration + "Create your first follow‑up" CTA

### UXR‑5 Loading & Error States
- Skeleton screens matching card/table layout
- Error state: message + retry button
- 404: illustration + "This page doesn't exist" + return to dashboard link
- Network error: banner + auto‑retry (3 attempts)

---

## 24. MVP Scope

The MVP delivers the complete servant → beneficiary → attendance → follow‑up workflow for a single church. It is a fully functional product that a church can use day‑one.

### In Scope

| Module | What's Included |
|--------|-----------------|
| Authentication | Email + password, login, signup, password reset |
| Church onboarding | Church registration, basic setup wizard |
| RBAC | Priest, Ministry Leader, Servant roles; permission checks on all actions |
| Servant management | CRUD, bulk import via Excel, approval workflow, profile with all fields |
| Beneficiary management | CRUD, bulk import, assignment to stage + servant |
| Ministry & Stage | CRUD, hierarchy, archive |
| Attendance | Single + bulk recording, history view |
| Follow‑up | CRUD, status tracking, history |
| Dashboards | Role‑specific dashboards (Priest, Ministry Leader, Servant) |
| i18n | Arabic + English, full RTL/LTR |
| Import | Excel import for servants and beneficiaries with templates |
| Audit | App‑end audit logging (not full immutable store) |

### Explicitly Out of Scope (MVP)

- Spiritual Growth module
- Notifications engine (in‑app alerts only via inline feedback)
- WhatsApp integration
- Subscription / billing (manual for MVP)
- Platform Owner admin area
- Beneficiary transfer history
- Consecutive absence alerts
- Offline support
- MFA

---

## 25. Phase 2 Scope

Delivered 3 months after MVP.

| Module | What's Added |
|--------|--------------|
| Spiritual Growth | Full private journal module with Priest visibility, audit trail |
| Notifications Engine | In‑app notification center with bell icon, dropdown, full page; email via transactional provider |
| Alerts | Consecutive absence alerts, missing attendance reminders |
| Excel Export | Full export for all entities |
| Beneficiary Transfers | Transfer UI with assignment history timeline |
| Advanced Dashboards | Charts, trends, comparison views |
| Subscription & Billing | Stripe integration, plan management, invoicing |
| Platform Owner Area | Tenant list, usage metrics, basic system monitoring |

---

## 26. Phase 3 Scope

Delivered 6 months after Phase 2.

| Module | What's Added |
|--------|--------------|
| Mobile Optimization | Dedicated mobile navigation, quick attendance, bottom sheet forms |
| WhatsApp Notifications | Twilio / WhatsApp Business API integration |
| Calendar Integration | iCal export, Google Calendar sync |
| Self‑Registration Portal | Public signup page for prospective servants |
| Advanced Reporting | Custom date ranges, saved reports, PDF export |
| Audit Log Viewer | Searchable, filterable UI with event timeline |
| Feature Flags UI | Church‑level feature toggle management |
| Usage Limits | Automated enforcement, upgrade prompts, hard limits |
| Offline Mode | Service worker caching, offline attendance with background sync |

---

## 27. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data leakage between tenants | Low | Critical | RLS policies tested in CI; regular penetration tests |
| Low servant adoption | Medium | High | Invest in onboarding wizard, mobile‑first attendance, training materials |
| Arabic UX poor quality | Medium | High | Arabic‑speaking designer on staff; user testing with real churches |
| Spiritual data privacy breach | Low | Critical | Separate encryption layer; audit logging; minimal access surface |
| Priest resistance to technology | Medium | Medium | Offline‑capable MVP; Excel import/export as bridge; champion program |
| Scaling issues with RLS | Low | Medium | Connection pooling; query optimization; ready for schema‑per‑tenant if needed |
| Regulatory compliance (GDPR) | Low | Medium | Data deletion workflow; privacy‑by‑design from day one |
| Subscription churn | Medium | High | Engagement metrics monitored; proactive account management |

---

## 28. Assumptions

1. Churches have at least one person with basic computer literacy to act as the system administrator
2. Internet connectivity is available during ministry sessions (for attendance recording)
3. Mobile phone penetration among servants is near 100%
4. The Priest delegates operational tasks to Ministry Leaders but retains oversight
5. Churches operate on a weekly schedule (weekly sessions, weekly attendance)
6. The primary growth channel is word‑of‑mouth between churches
7. Beneficiaries are children/students — they do not have their own accounts (managed by servants)
8. Spiritual growth data is considered highly sensitive and subject to church‑specific disclosure rules
9. Arabic is the primary language for at least 80% of initial users
10. Excel literacy is high among administrators handling bulk imports

---

## 29. Success Metrics

| Metric | MVP Target | Phase 2 Target | Phase 3 Target |
|--------|-----------|----------------|----------------|
| Active churches | 10 | 50 | 200 |
| Servants per church (avg) | 15 | 30 | 50 |
| Beneficiaries per church (avg) | 50 | 100 | 200 |
| Weekly attendance recorded | >60% of sessions | >75% | >85% |
| Follow‑up completion rate | >50% | >65% | >75% |
| Servant weekly active rate | >40% | >55% | >65% |
| Spiritual journal weekly entries | N/A | >30% of servants | >45% |
| NPS | >30 | >45 | >55 |
| Page load time (P95) | <3s | <2s | <1.5s |
| Support tickets per church/month | <5 | <3 | <2 |

---

## 30. Recommended Future Roadmap

### Year 1
- **Q1:** MVP launch (3 pilot churches)
- **Q2:** Iterate based on feedback; onboard 10 churches
- **Q3:** Phase 2 — Spiritual Growth, Notifications, Billing
- **Q4:** 50 churches; Platform Owner dashboard; subscription revenue live

### Year 2
- **Q1:** Phase 3 — Mobile optimization, WhatsApp, Self‑registration
- **Q2:** 100 churches; advanced reporting
- **Q3:** Church‑specific customization options (branding, custom fields)
- **Q4:** 200 churches; API for third‑party integrations

### Year 3+
- AI‑powered insights: attendance prediction, at‑risk beneficiary identification
- Mobile native apps (iOS / Android)
- Multi‑church federation (shared events across churches)
- Community features (servant forums, resource sharing)
- Enterprise tier: dedicated infrastructure, SLA guarantees, dedicated support
- Ecosystem: plugin marketplace, church‑specific app store

---

*End of PRD V2*
