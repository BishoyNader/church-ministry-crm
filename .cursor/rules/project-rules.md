# MASTER CURSOR BUILD PROMPT

You are a Senior Staff Software Engineer, SaaS Architect, UI/UX Designer, Database Architect, Security Engineer, and AI Systems Engineer.

Your task is to build a production-grade Church Ministry CRM platform.

Do not create demos, placeholders, mock implementations, fake data, or simplified examples.

Generate production-ready code only.

---

# TECHNOLOGY STACK

Frontend:

* Next.js 15 App Router
* TypeScript
* Tailwind CSS
* shadcn/ui
* React Hook Form
* Zod
* TanStack Query
* Zustand

Backend:

* Next.js Route Handlers
* Server Actions

Database:

* PostgreSQL (Supabase)

Authentication:

* Supabase Auth

Storage:

* Supabase Storage

AI:

* OpenAI API
* RAG Architecture
* pgvector

Hosting:

* Cloudflare Pages
* Cloudflare Workers

Monitoring:

* Sentry

Email:

* Resend

Charts:

* Recharts

Tables:

* TanStack Table

---

# PRIMARY REQUIREMENT

Arabic is the default language.

The entire application must support:

* Arabic
* RTL
* Responsive Design
* Mobile First
* Dark Mode
* Light Mode

English should be optional.

---

# DESIGN SYSTEM

Create a premium SaaS UI.

Inspiration:

* HubSpot
* Salesforce
* Monday.com
* Notion
* Linear

Requirements:

* Clean layouts
* Consistent spacing
* Reusable components
* Elegant typography
* Accessibility
* Fast interactions

---

# ARCHITECTURE

Use:

Feature-Based Architecture

/app
/components
/features
/lib
/hooks
/types
/services
/actions

Separate:

* UI
* Business Logic
* Data Layer

---

# DATABASE DESIGN

Create normalized database schema.

Core Tables:

churches
ministries
stages
users
roles
permissions
user_stage_assignments
children
attendance
followups
spiritual_records
events
event_registrations
notifications
audit_logs
documents
ai_conversations
ai_messages

Use UUID primary keys.

Add indexes for:

* Names
* Mobile numbers
* Stage lookups
* Attendance dates

---

# MULTI TENANCY

Every table must contain:

church_id

All queries must be tenant aware.

No cross-church data access.

---

# AUTHENTICATION

Implement:

* Email Login
* Phone Login
* Password Reset
* Remember Me

First account becomes Super Admin.

---

# AUTHORIZATION

Implement:

RBAC

Roles:

* Super Admin
* Church Admin
* Stage Leader
* Servant
* Viewer

Enforce permissions at:

* Frontend
* Backend
* Database

Implement Supabase RLS policies.

---

# MODULES

Build in order.

PHASE 1

1. Authentication
2. User Management
3. Stage Management
4. Child Management
5. Attendance
6. Dashboard

PHASE 2

7. Follow-Up
8. Events
9. Notifications
10. Reports

PHASE 3

11. AI Copilot
12. Analytics
13. Risk Detection

PHASE 4

14. WhatsApp Integration
15. Mobile Support
16. Advanced AI

---

# CHILD MANAGEMENT

Create complete child profiles.

Include:

Personal Data
Parent Data
Contact Data
Spiritual Data
Medical Data
Educational Data

Build child timeline view.

Timeline should display:

* Attendance
* Follow-Up
* Notes
* Events
* Stage Transfers

---

# ATTENDANCE

Support:

Present
Absent
Excused

Build:

* Weekly attendance screens
* History views
* Attendance reports
* Analytics

---

# FOLLOW-UP

Support:

Phone Call
Home Visit
WhatsApp
Church Meeting
Other

Maintain full history.

---

# EVENTS

Support:

* Meetings
* Camps
* Conferences
* Trips

Include:

* Registration
* Attendance
* Notifications

---

# CRM PIPELINE

Build Kanban board.

Stages:

New Visitor
First Follow-Up
Regular Attendee
Active Member
Leader Candidate

Allow drag-and-drop movement.

---

# NOTIFICATIONS

Support:

* In-App
* Email

Automations:

* Consecutive absence alerts
* Follow-up reminders
* Birthdays
* Event reminders

---

# AI COPILOT

Implement:

OpenAI Tool Calling

AI must:

* Search CRM data
* Generate reports
* Answer questions
* Summarize performance
* Detect risks
* Execute authorized actions

Requirements:

* RAG
* pgvector
* Source citations
* Permission aware retrieval

Never expose unauthorized data.

---

# AUDIT LOGGING

Track:

* Logins
* User changes
* Attendance updates
* Follow-ups
* Notifications
* AI actions

Store timestamps and user IDs.

---

# FILE STORAGE

Support:

* Child photos
* Documents
* PDFs
* Excel files

Use Supabase Storage.

Generate signed URLs.

---

# REPORTS

Generate:

* Attendance
* Follow-Up
* Growth
* Stage Performance
* Event Reports

Export:

* PDF
* Excel
* CSV

---

# PERFORMANCE

Targets:

Dashboard:
< 2 seconds

Search:
< 500ms

Use:

* Pagination
* Lazy loading
* Query optimization
* Caching

---

# SECURITY

Implement:

* RBAC
* RLS
* Input validation
* Rate limiting
* XSS protection
* CSRF protection
* Secure file uploads
* Audit trails

No security shortcuts.

---

# DEVELOPMENT PROCESS

Before generating code:

1. Create complete system architecture.
2. Create database schema.
3. Create ERD.
4. Create RLS policies.
5. Create project folder structure.
6. Create implementation roadmap.

After approval:

Build one phase at a time.

Do not skip steps.

Always prioritize maintainability, scalability, security, performance, and Arabic user experience.

