# Coding Standards

## Architecture

Use Feature-Based Architecture.

Structure:

src/
├── features/
├── components/
├── lib/
├── services/
├── providers/
├── hooks/
└── types/

Business logic belongs inside features.

---

## Feature Structure

Every feature must contain:

feature-name/
├── actions/
├── components/
├── hooks/
├── schemas/
├── services/
├── types/
└── utils/

Example:

features/users/
features/children/
features/stages/

---

## TypeScript

Requirements:

* Strict typing
* No any
* Explicit return types
* Reusable interfaces

Avoid:

any
unknown abuse
type assertions when unnecessary

---

## Components

Rules:

* Single responsibility
* Reusable
* Small and focused

Avoid:

500+ line components

Split large components.

---

## State Management

Use:

* React Query for server state
* Zustand for client state

Avoid:

Deep prop drilling

---

## Forms

Use:

* React Hook Form
* Zod

Every form must:

* Validate inputs
* Handle loading state
* Handle errors

---

## API & Database

Never call Supabase directly from UI components.

Use:

services/

Example:

UserForm
↓
UserService
↓
Supabase

---

## Authentication

All auth logic belongs in:

features/auth

Never duplicate auth logic.

---

## Authorization

All permission checks belong in:

features/rbac

Never hardcode permissions.

Bad:

if (role === "admin")

Good:

hasPermission("users.create")

---

## Localization

Every user-facing string must be translated.

Use:

messages/en.json
messages/ar.json

Never hardcode UI text.

---

## Styling

Use:

* Tailwind CSS
* shadcn/ui

Avoid:

Inline styles

---

## Imports

Use path aliases.

Prefer:

@/features/users

Instead of:

../../../users

---

## Logging

Use centralized logging utilities.

Never leave console.log in production code.

---

## Error Handling

Every async operation must:

* Catch errors
* Return typed results
* Display user-friendly messages

---

## Security

Never trust client-side permissions.

Enforce permissions:

* UI
* Server Actions
* RLS Policies

All three layers must validate access.

---

## Testing Readiness

Code should be written so that:

* Services are testable
* Hooks are testable
* Components are testable

Avoid tightly coupled code.

---

## Build Requirements

Before every commit:

npm run lint
npm run build

Both must pass successfully.
