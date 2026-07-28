# Church Ministry CRM — UI & UX Patterns

## Design Goals

The application should feel:

* Modern
* Clean
* Professional
* Mobile-first
* Fast
* Accessible

The UI should resemble modern SaaS products.

Examples:

* Linear
* Notion
* Vercel
* Stripe Dashboard
* Supabase Dashboard

---

# Layout Pattern

Application Shell:

Header
Sidebar
Content Area

Desktop:

Sidebar visible

Mobile:

Collapsible drawer menu

---

# Spacing System

Use Tailwind spacing consistently.

Preferred spacing:

gap-2
gap-4
gap-6
gap-8

Avoid random spacing values.

---

# Card Pattern

Use cards for:

* Statistics
* Forms
* Details
* Dashboards

Structure:

Card
CardHeader
CardContent
CardFooter

---

# Page Pattern

Every page should follow:

Page Header

Title
Description
Actions

Main Content

Cards
Tables
Forms

Example:

Users

Title
Description
Create User Button

User Table

---

# Form Pattern

Form Layout:

Card
Form Fields
Actions

Rules:

* Labels above fields
* Required fields clearly marked
* Validation messages below fields

Buttons:

Primary Action
Secondary Action

---

# Table Pattern

All management modules should use tables.

Features:

* Search
* Pagination
* Sorting
* Empty State

Columns should be concise.

Avoid overcrowded tables.

---

# Dialog Pattern

Use dialogs for:

* Create
* Edit
* Delete Confirmation

Avoid navigation to separate pages when a modal is sufficient.

---

# Destructive Actions

Delete actions must:

1. Require confirmation.
2. Use destructive styling.
3. Explain consequences.

---

# Dashboard Pattern

Dashboard pages should contain:

Statistics Cards

Recent Activity

Quick Actions

Charts

Recent Records

---

# Responsive Rules

Mobile First

Breakpoints:

sm
md
lg
xl

Never design desktop first.

All pages must work on:

* Phones
* Tablets
* Laptops
* Desktop monitors

---

# Accessibility

All forms require:

* Labels
* Keyboard navigation
* Focus states

Avoid icon-only actions without tooltips.

---

# Colors

Use theme tokens.

Support:

* Light Mode
* Dark Mode

Never hardcode colors if theme tokens exist.

---

# Empty States

Every list page must support:

No Data State

Include:

* Message
* Explanation
* Action Button

Example:

"No stages found"

"Create your first stage to get started."

---

# Loading States

Use skeleton loaders.

Avoid spinner-only pages.

---

# Permission-Based UI

Hide actions the user cannot perform.

Examples:

Create Button

Edit Button

Delete Button

Export Button

Use:

PermissionGuard

Do not show unavailable actions.

---

# CRM Module Standards

Every CRUD module should contain:

List Page

Create Form

Edit Form

View Details

Delete Action

Search

Pagination

Permission Checks

React Query Integration

Zod Validation

Examples:

Users

Stages

Children

Attendance

Events

Documents

Notifications

Reports

All modules should follow the same UX structure and interaction patterns.
