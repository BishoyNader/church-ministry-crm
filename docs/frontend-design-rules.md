# Frontend Design Rules

## Core Principles

* Mobile-first design
* Accessibility first
* Arabic RTL support
* English LTR support
* Consistent spacing
* Consistent typography
* Dark mode support

## Design System

Use:

* shadcn/ui
* Tailwind CSS
* Lucide icons

Do not create custom UI components when shadcn/ui already provides a suitable component.

## Layout Standards

Application layout:

* Sidebar navigation
* Header
* Breadcrumbs
* Main content area
* Responsive mobile menu

## Forms

Every form must include:

* React Hook Form
* Zod validation
* Loading state
* Success feedback
* Error feedback

## Tables

Every data table must support:

* Search
* Sorting
* Pagination
* Empty state
* Loading skeleton

## Colors

Use semantic colors only:

* Primary
* Secondary
* Success
* Warning
* Destructive

Avoid hardcoded colors.

## Accessibility

All components must:

* Support keyboard navigation
* Include aria labels where needed
* Maintain visible focus states

## CRM Experience

The application should feel like:

* Modern SaaS
* Fast
* Clean
* Professional
* Enterprise-ready
