# CRM UI Patterns

## Dashboard Pattern

Every dashboard page should contain:

* Page title
* Breadcrumb
* KPI cards
* Quick actions
* Recent activity section
* Responsive layout

Example:

Header
├── Title
├── Breadcrumb
└── Actions

Content
├── KPI Cards
├── Charts
├── Recent Activity
└── Quick Actions

---

## List Page Pattern

Used for:

* Users
* Children
* Stages
* Attendance
* Events

Layout:

Page Header
├── Title
├── Search
└── Create Button

Filters Bar
├── Filters
├── Status Filter
└── Export Button

Table
├── Loading State
├── Empty State
└── Pagination

---

## Form Page Pattern

Used for:

* Create User
* Edit User
* Create Child
* Edit Child

Structure:

Page Header
├── Title
└── Back Button

Form
├── Sections
├── Validation Messages
├── Save Button
└── Cancel Button

Requirements:

* React Hook Form
* Zod Validation
* Loading State
* Success Feedback
* Error Feedback

---

## Details Page Pattern

Used for:

* Child Profile
* User Profile
* Event Details

Layout:

Header
├── Title
├── Actions
└── Status Badge

Tabs
├── Overview
├── History
├── Notes
└── Activity

---

## Modal Pattern

Used for:

* Delete Confirmation
* Quick Edit
* Small Forms

Requirements:

* Clear title
* Description
* Cancel button
* Primary action button

---

## Empty State Pattern

Every empty state should include:

* Icon
* Title
* Description
* Action Button

Example:

"No children found"

Create Child Button

---

## Loading Pattern

Use Skeleton components.

Never show blank pages while loading.

---

## Error Pattern

Display:

* Error title
* Error description
* Retry button

---

## Navigation Pattern

Sidebar:

* Dashboard
* Children
* Attendance
* Stages
* Users
* Events
* Reports
* Settings

Support:

* Collapsed state
* Mobile drawer
* Permission-based visibility

---

## Notification Pattern

Use Sonner Toasts.

Success:

* User created
* Child updated
* Attendance saved

Error:

* Validation failed
* Network error
* Permission denied

---

## RTL Pattern

All pages must support:

Arabic RTL

English LTR

No custom RTL hacks.
Use logical CSS properties whenever possible.
