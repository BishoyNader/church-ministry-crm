# MVP Scope — Church Ministry Platform

**Version:** 1.0  
**Basis:** Original business requirements (Product Owner)  
**Key decision:** Spiritual Growth module is IN scope (core platform purpose).

---

## 1. Guiding Principle

The MVP must deliver a **complete, usable product** that a single church can adopt day-one for its core ministry operations. Every feature listed in the original business requirements that forms part of the daily/weekly workflow is included. Features that are operational or administrative (billing, platform admin) are deferred.

---

## 2. In Scope (MVP)

### 2.1 Tenant & Church Onboarding
- Church registration (self-service signup)
- Church profile setup (name, slug, locale preference)
- Automatic provisioning of church-scoped data
- Seeding of default roles and permissions per church

### 2.2 Authentication & Authorization
- Email + password login
- Password reset flow
- Session management (24-hour expiry)
- Role-based access control enforced at all layers
- Church-level tenant isolation (RLS)

### 2.3 Role Hierarchy (Church-Level)
- Super Admin (Priest) — full church access
- Admin (Ministry Leader) — assigned service access
- User (Servant) — assigned beneficiary access
- Permission inheritance (Super Admin → Admin → User)
- Permission checks on every Server Action and route

### 2.4 Service & Stage Management
- CRUD for Services (ministries)
- CRUD for Stages (within a service)
- Optional Class subdivision under Stage
- Sort order control
- Archive (soft delete)

### 2.5 Servant Management
- CRUD for servants
- Profile fields: full name (Ar/En), DOB, gender, mobile, WhatsApp, email, address, confession father, join date, service history, notes
- Bulk import via Excel with downloadable template
- Self-registration (public form → pending approval)
- Priest approval workflow (Approve / Reject)
- Activation / deactivation
- Assignment to service + stage with role (admin/user)
- Service history tracking (temporal assignments)

### 2.6 Beneficiary Management
- CRUD for beneficiaries
- Profile fields: full name (Ar/En), DOB, gender, address, school, mobile, father_mobile, mother_mobile, WhatsApp, confession father, notes
- Assignment to service → stage → class → responsible servant
- Bulk import via Excel with downloadable template
- Transfer between stages and servants
- Assignment history (immutable, append-only)
- Activation / deactivation (soft delete)

### 2.7 Attendance Management
- Beneficiary attendance recording (Present / Absent / Excused)
- Servant attendance recording
- Single session recording (per beneficiary)
- Bulk session recording (mark all beneficiaries in a stage at once)
- Weekly session tracking
- Attendance history view (per beneficiary, per stage, per date)
- **Consecutive absence alerts** (triggered at 3 consecutive absences)
- **Low attendance rate alerts**
- **Missing attendance submission reminders**

### 2.8 Follow-Up Management
- CRUD for follow-ups
- Fields: date, type (phone/visit/meeting/other), notes, outcome, next action, assigned servant
- Status tracking (Open / In Progress / Completed / Cancelled)
- Follow-up history per beneficiary
- Assignment and reassignment
- Due-date reminders

### 2.9 Spiritual Growth Module
Full spiritual growth tracking per the original requirements:

- Daily journal entry per servant
- Fields: Morning Prayer, Third Hour Prayer, Sixth Hour Prayer, Ninth Hour Prayer, Sunset Prayer, Sleep Prayer, Bible Reading, Confession, Communion, Spiritual Notes
- **Private by default** — visible only to the recording servant
- **Priest visibility** — Super Admin can view all spiritual records in the church
- **Configurable visibility rules** — Super Admin can tighten visibility (never loosen beyond default)
- **Audit trail** — every access by Priest is logged
- **No export** — spiritual data is never included in bulk exports
- Reminder scheduling (optional, servant-configurable)
- Personal dashboard widget (streak tracking)

### 2.10 Dashboards
- **Super Admin dashboard:** Total servants, total beneficiaries, attendance rate, follow-up completion rate, pending approvals, absence alerts
- **Admin dashboard:** Stage performance, beneficiary count per stage, servant count, overdue follow-ups, weekly attendance trend
- **User dashboard:** Assigned beneficiaries, today's attendance, upcoming follow-ups, spiritual journal streak

### 2.11 Notifications (In-App)
- In-app notification bell with unread count
- Notification types:
  - Consecutive absence alert
  - Follow-up due
  - Follow-up overdue
  - Approval required (Priest)
  - Approval result (servant)
  - Birthday reminder
  - Attendance reminder
- Notification history page with pagination

### 2.12 Import
- Excel import for servants (with template)
- Excel import for beneficiaries (with template)
- Validation report on import (success count, error rows with reasons)
- Template download endpoint

### 2.13 Audit
- App-level audit logging (service layer, not database trigger — database audit is Phase 2)
- Tracked events: login, logout, servant CRUD, beneficiary CRUD, attendance record, follow-up CRUD, transfer, spiritual access
- Audit log viewer (Super Admin only)
- 90-day retention minimum

### 2.14 Internationalization
- Full Arabic language support
- Full English language support
- RTL layout for Arabic
- LTR layout for English
- Locale stored per user preference
- All user-facing strings localized

### 2.15 UI/UX
- Clean, modern design (comparable to Linear/Notion/Vercel quality)
- Responsive layout (mobile, tablet, desktop)
- Loading states (skeleton screens)
- Empty states (illustration + CTA)
- Error states (message + retry)
- Toast notifications for success/error
- Confirmation dialogs for destructive actions

---

## 3. Explicitly Out of Scope (MVP)

| Feature | Reason | Target Phase |
|---------|--------|--------------|
| Platform Owner admin area | Only needed when >10 churches | Phase 2 |
| Subscription & billing | Manual process for MVP launches | Phase 2 |
| Email notifications | Requires transactional email provider setup | Phase 2 |
| WhatsApp notifications | API integration + compliance | Phase 3 |
| CSV export | Deferred; Excel import only for MVP | Phase 2 |
| Advanced reporting with charts | Static dashboards sufficient for MVP | Phase 2 |
| Calendar integration | No integration partner confirmed | Phase 3 |
| Offline mode | Service worker caching complex | Phase 3 |
| MFA | Security enhancement, not MVP-blocking | Phase 2 |
| Database audit triggers | App-level audit sufficient for MVP | Phase 2 |
| Self-service password change UI | MVP uses "forgot password" flow only | MVP+ |
| Servant self-registration portal | Public-facing page requires design work | Phase 2 |

---

## 4. MVP Success Criteria

1. A new church can register and complete onboarding in <10 minutes
2. A Priest can add servants, approve registrations, and assign them to stages
3. An Admin can manage beneficiaries, record attendance, and review follow-ups
4. A Servant can see their assigned beneficiaries, record attendance, create follow-ups, and log spiritual journal entries
5. Consecutive absence alerts trigger correctly at 3 missed sessions
6. The entire workflow is usable in Arabic with correct RTL rendering
7. No data from one church is visible to another church (penetration test)
8. All mutations are audited with actor, timestamp, and old/new values

---

## 5. MVP Feature List (Summary)

| # | Feature | Priority |
|---|---------|----------|
| 1 | Church registration & provisioning | P0 |
| 2 | Auth (login, password reset) | P0 |
| 3 | RBAC (Super Admin, Admin, User) | P0 |
| 4 | Service & Stage CRUD | P0 |
| 5 | Servant CRUD + bulk import + approval | P0 |
| 6 | Beneficiary CRUD + bulk import + assignment | P0 |
| 7 | Beneficiary transfer with history | P0 |
| 8 | Attendance recording (single + bulk) | P0 |
| 9 | Attendance alerts (consecutive, low rate, missing) | P0 |
| 10 | Follow-up CRUD + reminders | P0 |
| 11 | Spiritual Growth journal | P0 |
| 12 | Role-specific dashboards | P0 |
| 13 | In-app notifications | P0 |
| 14 | Audit logging | P0 |
| 15 | Arabic + English i18n + RTL/LTR | P0 |
| 16 | Responsive UI | P0 |

---

## 6. MVP Non-Goals

- Support >100 concurrent users per church (target: 50)
- Support >10,000 beneficiaries per church (target: 2,000)
- 99.99% uptime (target: 99.5%)
- Sub-minute deploy time (target: 15 minutes)
- Multi-region deployment (target: single region)
