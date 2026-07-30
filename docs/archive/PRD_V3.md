# Church Ministry Platform — Product Requirements Document V3

**Status:** Final Draft  
**Version:** 3.0  
**Classification:** Internal — Stakeholders, Engineering, Design, QA  
**Basis:** Original business requirements (Product Owner)  

---

## 1. Executive Summary

The Church Ministry Platform is a multi‑tenant SaaS solution purpose‑built for the operational and spiritual needs of churches. It replaces fragmented tools (spreadsheets, messaging groups, paper records) with a unified, privacy‑first system that covers the full lifecycle of church ministry: **servant management, beneficiary tracking, attendance, follow‑ups, spiritual growth, notifications, and analytics.**

Each church operates in complete isolation. Data, users, roles, and configuration never cross tenant boundaries. The platform supports Arabic and English with full RTL/LTR layout switching.

The MVP delivers the complete workflow — including the Spiritual Growth module — so a church can adopt the platform day‑one for both administrative and spiritual tracking. Subsequent phases add billing, platform owner tooling, WhatsApp, and mobile optimization.

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
| Spiritual journal adoption | Weekly entries | >40% of servants |
| User satisfaction | NPS score | >50 |
| Revenue | MRR | $10K (year 1), $100K (year 3) |

---

## 4. User Personas

### 4.1 Youssef — Platform Owner

- **Role:** System administrator of the SaaS platform
- **Goals:** Monitor tenant health, manage subscriptions, handle escalations
- **Pain points:** No visibility into tenant usage, manual billing, no way to debug tenant issues
- **Needs:** Tenant dashboard, subscription CRUD, audit log viewer, system metrics

### 4.2 Father Mikhail — Priest (Super Admin)

- **Role:** Highest authority inside a church
- **Goals:** Oversee all ministry activity, access spiritual records, manage leadership assignments
- **Pain points:** Paper records, no visibility into servant engagement, no consolidated reports
- **Needs:** Cross‑service dashboards, spiritual record access, role assignment, servant approval workflow, annual reassignment tools

### 4.3 George — Ministry Leader (Admin)

- **Role:** Responsible for one or more services/stages
- **Goals:** Track servant performance, monitor attendance, review follow‑ups
- **Pain points:** Can't see across his stages, no attendance trend data, manual Excel tracking
- **Needs:** Stage‑level dashboards, attendance reports, follow‑up review, servant roster management, bulk import

### 4.4 Mary — Servant (User)

- **Role:** Regular servant working directly with beneficiaries
- **Goals:** Record attendance, log follow‑ups, access assigned beneficiaries, track spiritual growth
- **Pain points:** No central place to track her work, duplicate data entry, missed follow‑ups
- **Needs:** Mobile‑friendly attendance, quick follow‑up forms, beneficiary list, personal spiritual journal

### 4.5 Mina — Beneficiary (Child/Student)

- **Role:** Recipient of ministry services (managed by parents/servants)
- **Goals:** N/A (managed by adults)
- **Needs:** Accurate records, privacy, safe data handling

---

## 5. Role Hierarchy

### 5.1 Platform-Level Role

| Role | Scope | Description |
|------|-------|-------------|
| Platform Owner | All tenants | System administration, subscriptions, billing, monitoring, support |

### 5.2 Church-Level Roles

| Role | Business Title | Scope | Inherits From |
|------|----------------|-------|---------------|
| Super Admin | Priest, Senior Pastor | Full church | All permissions |
| Admin | Ministry Leader, Service Leader | Assigned services | User + admin permissions |
| User | Servant, Teacher, Volunteer | Assigned beneficiaries | Base permissions only |

### 5.3 Permission Inheritance

```
Super Admin ──→ ALL permissions (church-wide)
    ↑
    │  inherits
    │
Admin ──→ User permissions + admin-scoped permissions (service-wide)
    ↑
    │  inherits
    │
User ──→ Base permissions (own data, assigned beneficiaries)
```

**Rule:** A role always includes all permissions of roles below it.  
**Exception:** Platform Owner is a separate hierarchy and does not inherit church-level roles.

### 5.4 Annual Role Change Workflow

1. **Freeze period** (2 weeks before change): Assignment changes are queued
2. **Reassignment window** (1 week): Super Admin/Admin reassigns servants to stages
3. **Mass update**: `servant_stage_assignments.end_date` set on old rows; new rows created
4. **Notification**: Affected servants notified of new assignments
5. **Rollback window** (48 hours): Super Admin can revert

### 5.5 Service History Tracking

Every servant has a complete history of:
- Services and stages served
- Role held (admin/user)
- Start and end dates
- Who assigned them

Displayed as a timeline on the servant profile.

---

## 6. Data Visibility Matrix

### 6.1 Servant Visibility

| Role | Can View | Can View Details | Notes |
|------|----------|-----------------|-------|
| Platform Owner | Aggregate counts only | No | No PII access |
| Super Admin | All servants in church | Full profile | |
| Admin | Servants in assigned services | Full profile | |
| User | Own profile | Full profile | Cannot browse servant list |

### 6.2 Beneficiary Visibility

| Role | Can View | Can View Details | Notes |
|------|----------|-----------------|-------|
| Platform Owner | Aggregate counts only | No | No PII access |
| Super Admin | All beneficiaries in church | Full profile | |
| Admin | Beneficiaries in assigned services | Full profile | |
| User | Assigned beneficiaries only | Full profile | Cannot browse outside assignment |

### 6.3 Attendance Visibility

| Role | Can View | Scope |
|------|----------|-------|
| Platform Owner | Aggregates only | Per church (no PII) |
| Super Admin | All attendance records | Church-wide |
| Admin | Attendance in assigned stages | Service/Stage scope |
| User | Own recording history + own beneficiaries | Personal |

### 6.4 Spiritual Records Visibility

| Role | Can View | Scope | Audit |
|------|----------|-------|-------|
| Platform Owner | **Never** | N/A | N/A |
| Super Admin | All spiritual journals | Church-wide | Every access logged |
| Admin | **Never** | N/A | N/A |
| User | Own journal only | Self | Entry creation logged |

**Privacy invariant:** Spiritual records are NEVER visible to Admins. Super Admin visibility is the maximum. Church-level config can further restrict Super Admin access.

### 6.5 Reports Visibility

| Role | Can View | Scope |
|------|----------|-------|
| Platform Owner | System-wide aggregates | All churches (no PII) |
| Super Admin | All church reports | Church-wide |
| Admin | Reports for assigned services | Service/Stage scope |
| User | Personal dashboard | Self + assigned beneficiaries |

---

## 7. Service Structure Hierarchy

```
Church (tenant)
  └── Service (e.g., "Youth Service", "Children's Service")
       └── Stage (e.g., "Intermediate Stage", "Advanced Stage")
            └── Class (optional — e.g., "First Year", "Second Year")
                 └── Beneficiaries
                      └── Attendance Records, Follow-ups
```

**Key relationships:**
- A Church has many Services
- A Service has many Stages
- A Stage has zero or more Classes (optional)
- A Stage has many Beneficiaries (directly or via Class)
- A Servant is assigned to a Service + Stage (optionally Class) with a role

---

## 8. Functional Requirements

### FR‑1 Tenant Management
- FR‑1.1 Platform Owner can create, suspend, and delete tenants
- FR‑1.2 Tenant provisioning is automated (self-service or admin-created)
- FR‑1.3 Tenant data is fully isolated via RLS

### FR‑2 Church Configuration
- FR‑2.1 Church profile (name Ar/En, logo, slug, locale)
- FR‑2.2 Feature flags per church
- FR‑2.3 Configurable role overrides (Super Admin can tighten restrictions)

### FR‑3 Servant Management
- FR‑3.1 Full profile as specified
- FR‑3.2 Manual creation, self-registration, bulk Excel import
- FR‑3.3 Downloadable Excel template
- FR‑3.4 Priest approval workflow
- FR‑3.5 Assignment to Service + Stage + Class with role
- FR‑3.6 Service history tracking
- FR‑3.7 Annual reassignment support

### FR‑4 Beneficiary Management
- FR‑4.1 Full profile as specified
- FR‑4.2 Manual creation, bulk Excel import, downloadable template
- FR‑4.3 Assignment to Service → Stage → Class → Servant
- FR‑4.4 Transfer between stages/servants with immutable history
- FR‑4.5 Soft delete with restore

### FR‑5 Service & Stage Management
- FR‑5.1 Service entity (name Ar/En, description, sort order)
- FR‑5.2 Stage entity (name, description, age range, sort order)
- FR‑5.3 Optional Class entity under Stage
- FR‑5.4 Archive (soft delete)

### FR‑6 Attendance
- FR‑6.1 Beneficiary attendance (Present / Absent / Excused)
- FR‑6.2 Servant attendance
- FR‑6.3 Single and bulk recording
- FR‑6.4 Weekly session tracking
- FR‑6.5 Consecutive absence alerts (>3 weeks)
- FR‑6.6 Low attendance rate alerts
- FR‑6.7 Missing attendance submission reminders

### FR‑7 Follow-Up Management
- FR‑7.1 Full follow-up record (date, type, notes, outcome, next action, servant)
- FR‑7.2 Status tracking (Open / In Progress / Completed / Cancelled)
- FR‑7.3 Follow-up history per beneficiary
- FR‑7.4 Due-date reminders

### FR‑8 Spiritual Growth
- FR‑8.1 Daily journal: Morning Prayer, Third Hour, Sixth Hour, Ninth Hour, Sunset, Sleep, Bible Reading, Confession, Communion, Spiritual Notes
- FR‑8.2 Private by default — servant + Priest only
- FR‑8.3 Configurable church-level visibility (Priest can tighten)
- FR‑8.4 Audit log for every Priest access to spiritual records
- FR‑8.5 No export of spiritual data
- FR‑8.6 Optional reminder scheduling

### FR‑9 Notifications
- FR‑9.1 In-app notification center (MVP)
- FR‑9.2 Email notifications (Phase 2)
- FR‑9.3 WhatsApp integration (Phase 3)
- FR‑9.4 Types: absence alerts, follow-up reminders, approvals, birthdays, attendance reminders

### FR‑10 Reporting & Dashboards
- FR‑10.1 Role-specific dashboards
- FR‑10.2 Attendance trends, follow-up metrics, servant engagement

### FR‑11 Import / Export
- FR‑11.1 Excel import with templates
- FR‑11.2 Excel export (Phase 2)
- FR‑11.3 CSV export (Phase 2)
- FR‑11.4 Import validation report

### FR‑12 Audit
- FR‑12.1 Immutable audit log
- FR‑12.2 All mutations tracked
- FR‑12.3 Spiritual record access tracked
- FR‑12.4 Audit log viewer (Super Admin, Platform Owner)

---

## 9. Non‑Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR‑1 | Tenant isolation | RLS on every query; no data leakage |
| NFR‑2 | Page load time (server) | <2s P95 |
| NFR‑3 | Page load time (client) | <1s TTI (authenticated) |
| NFR‑4 | API response time | <200ms P95 read |
| NFR‑5 | Uptime | 99.9% |
| NFR‑6 | i18n | Arabic + English; full RTL/LTR |
| NFR‑7 | Accessibility | WCAG 2.1 AA |
| NFR‑8 | Mobile responsiveness | All workflows at 375px+ |
| NFR‑9 | Data retention | Audit: 1 year; Soft-delete: 90 days |
| NFR‑10 | Backup | Daily automated, point-in-time recovery |
| NFR‑11 | Encryption at rest | AES‑256 |
| NFR‑12 | Encryption in transit | TLS 1.3 |

---

## 10. Tenant Isolation Requirements

### 10.1 Isolation Model

**Row-Level Security (RLS)** with `church_id` on every tenant-scoped table.

### 10.2 Implementation

1. Every data table has a `church_id` column (UUID, NOT NULL, FK → churches.id)
2. RLS is enabled on every table
3. A `tenant_isolation` policy on each table:
   ```sql
   CREATE POLICY tenant_isolation ON <table>
     USING (church_id = (SELECT church_id FROM profiles WHERE id = auth.uid()));
   ```
4. The `profiles` table itself is RLS-protected — users can only see their own church
5. The `churches` table has a separate policy — users can only see their own church row

### 10.3 Admin Client Restrictions

- `createAdminClient()` (service_role) is used ONLY for:
  - Creating auth users (`admin.auth.admin.createUser()`)
  - Checking account status before login (no session exists)
  - System-level operations (Platform Owner tools)
- All application queries use the authenticated client (`createClient()` from server.ts) which respects RLS

### 10.4 Cross-Tenant Prevention

- No API endpoint accepts a `church_id` parameter from the client — the church_id is derived from the authenticated user's profile
- No database query omits a `church_id` filter for tenant-scoped tables
- Platform Owner has a separate admin interface with its own auth boundary

### 10.5 Backup Isolation

- Backups include all tenants (single database)
- Restore is full-database only (no per-tenant restore in MVP)
- Phase 2: per-tenant backup and restore capability

---

## 11. Notification Requirements

### NR‑1 Types and Channels (MVP)

| Type | Trigger | MVP Channel | Phase 2 Channel |
|------|---------|-------------|-----------------|
| Consecutive absence | 3 absent in a row | In-app | + Email |
| Follow-up due | Due date reached | In-app | + Email |
| Follow-up overdue | Due + 24h | In-app | + Email |
| Approval required | Servant registered | In-app | + Email |
| Approval result | Approve/reject | In-app | + Email |
| Birthday | Beneficiary birthday | In-app | + Email |
| Attendance reminder | Session day 9 AM | In-app | + Email |
| Missing attendance | Session + 2h | In-app | + Email |
| Spiritual reminder | Custom schedule | In-app | + Email |

### NR‑2 In-App Center

- Bell icon in header with unread badge
- Dropdown: last 10 notifications, mark-as-read
- Full page: paginated, filterable by type/date/read status
- Click → navigate to context

---

## 12. Security Requirements

- SR‑1 Password: min 8 chars, complexity, rate-limited login (5/15min)
- SR‑2 Every action checks auth + permission
- SR‑3 Every query respects RLS
- SR‑4 Secrets never in client bundle
- SR‑5 Audit log is append-only (trigger-enforced in Phase 2, app-enforced in MVP)
- SR‑6 MFA optional (Phase 2)

---

## 13. Privacy Requirements

- PR‑1 Spiritual data: servant + Priest only. No export. Audited access.
- PR‑2 Beneficiary PII not shared across services without permission
- PR‑3 GDPR-style deletion workflow
- PR‑4 Data export available for non-spiritual data

---

## 14. Database Requirements

See `DATABASE_REQUIREMENTS.md` for complete schema.

**Core entities:**
- churches, profiles, services, stages, classes
- servants, servant_stage_assignments
- beneficiaries, beneficiary_assignments
- attendance_sessions, attendance_records
- followups
- spiritual_journal_entries
- notifications, audit_logs
- roles, permissions, role_permissions, user_roles
- subscription_plans

**Key rules:**
- `church_id` on every tenant-scoped table
- Soft delete: `deleted_at` set, RLS filters `IS NULL`
- Audit: INSERT-only on `audit_logs`
- Beneficiary assignments: immutable (new row per change)
- Servant assignments: temporal (start_date/end_date)

---

## 15. RBAC Architecture

See `RBAC_ARCHITECTURE.md` for complete specification.

**Summary:**
- 4 roles: platform_owner, super_admin, admin, user
- Permission inheritance: super_admin → admin → user
- Stage-level access control via `servant_stage_assignments`
- 3 enforcement layers: UI (hide/show), Server Actions (check), Database (RLS)
- Annual reassignment workflow with history preservation

---

## 16. Import / Export Requirements

### 16.1 MVP
- Excel import for servants and beneficiaries
- Downloadable `.xlsx` templates
- Import validation report

### 16.2 Phase 2
- Excel export for all entities (except spiritual)
- CSV export
- Attendance import/export

### 16.3 Phase 3
- Scheduled exports
- Export history

---

## 17. Mobile Requirements

- Fully responsive: 375px+ mobile, 640px+ tablet, 1024px+ desktop
- Touch targets: 44×44px minimum
- Bottom navigation on mobile
- Quick attendance workflow (3 taps per beneficiary)
- No hover-dependent interactions

---

## 18. UI/UX Requirements

- Design comparable to Linear, Notion, Vercel
- Clean layouts, fast workflows
- True RTL mirroring (sidebar on right, labels on right)
- Arabic fonts: Noto Naskh Arabic (headings) + Noto Sans Arabic (body)
- Empty states with illustration + CTA
- Skeleton loaders
- Toast notifications
- Confirmation dialogs for destructive actions

---

## 19. MVP Scope

See `MVP_SCOPE.md` for complete definition.

**MVP includes:**
- Church registration, auth, RBAC
- Service, Stage, Class management
- Servant CRUD + bulk import + approval + assignment
- Beneficiary CRUD + bulk import + transfer + history
- Attendance (single + bulk) + absence alerts
- Follow-up CRUD + reminders
- **Spiritual Growth journal** (full daily schedule)
- Role-specific dashboards
- In-app notifications
- Audit logging (app-level)
- Arabic + English + RTL/LTR
- Responsive UI

---

## 20. Phase 2 Scope

- Platform Owner admin area
- Subscription & billing (Stripe)
- Email notifications
- Excel/CSV export
- Advanced dashboards with charts
- Database audit triggers (immutable)
- Self-registration portal

---

## 21. Phase 3 Scope

- WhatsApp notifications (Twilio)
- Calendar integration (iCal, Google)
- Mobile native optimization
- Offline mode (service worker)
- Feature flags UI
- Usage limits enforcement
- API for third-party integrations

---

## 22. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data leakage between tenants | Low | Critical | RLS tested in CI; regular pen tests |
| Low servant adoption | Medium | High | Onboarding wizard, mobile-first, training |
| Spiritual data privacy breach | Low | Critical | Separate audit trail, minimal access, no export |
| Scaling with RLS | Low | Medium | Connection pooling, query optimization |
| Arabic UX poor quality | Medium | High | Arabic-speaking designer, real church testing |

---

## 23. Assumptions

1. Churches have at least one person with basic computer literacy
2. Internet connectivity available during ministry sessions
3. Mobile phone penetration among servants is near 100%
4. The Priest delegates operational tasks but retains oversight
5. Churches operate on a weekly schedule
6. Arabic is the primary language for ≥80% of initial users
7. Excel literacy is high among administrators
8. Beneficiaries are children/students — they do not have their own accounts
9. Spiritual growth data is highly sensitive with church-specific disclosure rules

---

## 24. Success Metrics

| Metric | MVP (3 months) | Phase 2 (6 months) | Phase 3 (12 months) |
|--------|---------------|-------------------|---------------------|
| Active churches | 10 | 50 | 200 |
| Servants/church (avg) | 15 | 30 | 50 |
| Weekly attendance recorded | >60% | >75% | >85% |
| Follow-up completion | >50% | >65% | >75% |
| Spiritual journal adoption | >30% | >40% | >45% |
| NPS | >30 | >45 | >55 |

---

## 25. Roadmap

### Q1 (MVP Launch)
- Core workflow (servant → beneficiary → attendance → follow-up)
- Spiritual Growth module
- In-app notifications
- Arabic + English
- 3 pilot churches

### Q2 (Iteration)
- Feedback-based improvements
- 10 churches onboarded
- Excel export
- Email notifications

### Q3 (Phase 2)
- Platform Owner admin
- Subscription & billing
- Advanced dashboards
- 50 churches

### Q4 (Scale)
- Performance optimization
- 100 churches
- WhatsApp integration begins

### Year 2+
- Mobile native apps
- AI insights (attendance prediction, at-risk identification)
- Plugin ecosystem
- Enterprise tier

---

*End of PRD V3*
