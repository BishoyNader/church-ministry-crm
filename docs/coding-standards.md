# Church Ministry CRM — Coding Standards

## Project Overview

Church Ministry CRM is a multi-tenant church management platform built using:

* Next.js 16 (App Router)
* TypeScript (Strict Mode)
* Supabase
* React Query
* Zustand
* Next Intl
* Shadcn/UI
* Tailwind CSS v4
* Zod

All code must follow these standards.

---

# Architecture Rules

## Feature-Based Structure

All business logic must live inside feature modules.

Example:

src/features/users
src/features/stages
src/features/children
src/features/attendance

Each feature should contain:

components/
hooks/
services/
types/
schemas/
utils/

Avoid placing business logic in pages.

---

## Shared Components

Reusable UI components belong in:

src/components/ui

Reusable layout components belong in:

src/components/layout

Reusable application-wide components belong in:

src/components/shared

---

## Service Layer

All Supabase access must be isolated inside services.

Example:

src/features/stages/services/stage.service.ts

Do not call Supabase directly inside pages or UI components.

Incorrect:

const { data } = await supabase
.from("stages")
.select("*")

inside a component.

Correct:

const stages = await stageService.getStages()

---

## React Query

All server data should be managed through React Query.

Use:

* useQuery
* useMutation
* query invalidation

Avoid manual loading state management whenever possible.

---

## State Management

Use Zustand only for:

* UI state
* Filters
* Sidebar state
* Theme state
* Wizard state

Do not store server data in Zustand.

Server data belongs in React Query.

---

# Database Rules

## Single Source of Truth

Never invent tables.

Never invent columns.

Never invent relationships.

Always inspect:

supabase/migrations/

before generating code.

---

## Multi-Tenant Rules

Every business entity must be scoped by church_id.

Examples:

stages
children
attendance
events
documents

Queries must always respect tenant boundaries.

---

## RBAC Rules

Permissions must come from:

permissions.code

Never hardcode permission strings.

Always use:

src/features/rbac/constants/permissions.ts

Example:

PERMISSION_CODES.USERS_READ

instead of:

"users.read"

---

## Role Checks

Always use RBAC helpers.

Example:

PermissionGuard

or

checkUserPermission()

Never duplicate permission logic.

---

# TypeScript Rules

## Strict Mode

Avoid:

any

Use explicit types.

Create types inside:

types/

Example:

stage.types.ts
user.types.ts

---

## Reuse Types

Before creating a type:

1. Search existing types.
2. Extend existing types when possible.

Avoid duplicate interfaces.

---

## Naming

Types:

Stage
User
Permission

Inputs:

CreateStageInput
UpdateStageInput

Schemas:

createStageSchema
updateStageSchema

Services:

stageService

Hooks:

useStages

Components:

StageForm
StageTable

---

# Validation

Use Zod only.

Do not use:

* Yup
* Joi
* Custom validation

Validation files belong in:

schemas/

Example:

stage.schema.ts

---

# UI Rules

Use:

* Shadcn/UI components
* Tailwind utilities

Do not introduce new UI libraries.

---

## Forms

Use:

* React Hook Form
* Zod Resolver

Pattern:

Form
Schema
Mutation

---

## Tables

Use reusable table components.

Support:

* Empty state
* Loading state
* Error state

---

## Loading States

Never leave blank screens.

Use:

* Skeletons
* Loading indicators

---

## Error Handling

Show user-friendly messages.

Do not expose raw database errors.

---

# Internationalization

All user-facing text must support:

* English
* Arabic

Use:

messages/en.json
messages/ar.json

Do not hardcode display text.

---

# Security

Never expose:

* Service Role Keys
* Secrets
* Internal credentials

Use environment variables.

Always assume users can manipulate the browser.

Server-side validation is required.

---

# Development Workflow

Branch Strategy:

feature/*

→ merge into staging

staging

→ testing

staging → main

via Pull Request

Never commit directly to main.

Never develop directly on main.

---

# AI Assistant Rules

Before generating code:

1. Inspect existing files.
2. Reuse existing architecture.
3. Reuse existing services.
4. Reuse existing types.
5. Reuse existing UI components.

Never create duplicate patterns.

If information is missing:

Ask for clarification instead of inventing structures.

Never invent tables, columns, APIs, or business rules.
