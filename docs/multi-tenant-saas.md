# Multi-Tenant SaaS Architecture

## Purpose

This document defines the multi-tenant architecture of the Church Ministry CRM platform.

The goal is to support multiple churches using the same application while ensuring complete data isolation between churches.

Each church operates as an independent tenant with its own users, ministries, stages, children, attendance records, follow-ups, reports, and settings.

No church must be able to view, modify, export, or access data belonging to another church.

---

# SaaS Vision

The platform is designed as a Software-as-a-Service (SaaS) solution where:

* One platform serves many churches.
* Each church has its own tenant environment.
* Each church has its own Super Admin.
* Each church manages its own users and permissions.
* All church data remains isolated.
* Platform administrators can manage the system without accessing church data unless explicitly authorized.

---

# Tenant Definition

A tenant represents a single church.

Every tenant has:

* Church Name
* Church Slug
* Church Status
* Church Settings
* Church Language
* Church Timezone
* Subscription Plan
* Church Logo
* Church Contact Information

Example:

Church A

* Super Admin
* Church Admins
* Leaders
* Servants
* Children
* Attendance

Church B

* Super Admin
* Church Admins
* Leaders
* Servants
* Children
* Attendance

Church C

* Super Admin
* Church Admins
* Leaders
* Servants
* Children
* Attendance

Each church operates independently.

---

# Core Principle: Tenant Isolation

The most important rule of the platform is:

A church can only access its own data.

Every query, API request, service, report, export, and dashboard must be scoped by church_id.

Cross-tenant access is forbidden.

---

# Tenant Isolation Requirements

## Database Level

Every business table must contain:

```sql
church_id UUID NOT NULL
```

Examples:

```sql
churches
profiles
ministries
stages
children
attendance
followups
notifications
events
audit_logs
```

All records must belong to exactly one church.

---

## Application Level

Every authenticated user belongs to exactly one church.

Example:

```text
User
 └── church_id
```

The application must determine the current church context from the authenticated user.

No request should rely on a client-provided church identifier.

The authenticated session is the source of truth.

---

## API Level

All server actions must validate:

1. User is authenticated.
2. User belongs to a church.
3. User has required permissions.
4. Requested data belongs to the same church.

---

## Query Level

All data retrieval must be church-scoped.

Example:

Correct:

```sql
SELECT *
FROM children
WHERE church_id = current_user_church_id;
```

Incorrect:

```sql
SELECT *
FROM children;
```

---

# Row Level Security (RLS)

RLS is the primary protection mechanism.

Every business table must have RLS enabled.

Example:

```sql
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
```

Policies must validate:

```sql
church_id = get_user_church_id()
```

before granting access.

---

# Church Ownership Model

Every church has one initial Super Admin.

The Super Admin is created during church onboarding.

Responsibilities:

* Manage church users
* Manage permissions
* Manage ministries
* Manage stages
* Manage children
* Manage attendance
* Manage church settings

The Super Admin cannot access another church.

---

# Role Hierarchy

## Platform Roles

These roles belong to the SaaS provider.

### Platform Owner

Full platform control.

Capabilities:

* Manage subscriptions
* Manage platform settings
* Manage system health
* View tenant metadata

Cannot directly access church data unless using approved support workflows.

### Platform Support

Limited operational access.

Capabilities:

* Troubleshooting
* Tenant support
* Account assistance

Access must be audited.

---

## Church Roles

These roles belong to a church.

### Super Admin

Highest church-level role.

Capabilities:

* Full church management
* User management
* Permission management
* Ministry management
* Stage management

### Church Admin

Administrative role.

Capabilities:

* Operational management
* Staff management
* Reporting

Restrictions defined by permissions.

### Stage Leader

Manages assigned stages.

Capabilities:

* View assigned children
* Record attendance
* Follow-ups

Restricted to assigned stages.

### Servant

Limited ministry access.

Capabilities:

* Child records
* Attendance participation
* Follow-up participation

Restricted by permissions.

### Viewer

Read-only access.

---

# Church Onboarding Flow

Future implementation.

## Step 1

Create Church

Required:

* Church Name
* Church Slug
* Country
* Timezone
* Language

---

## Step 2

Create Super Admin

Required:

* Name
* Email
* Password

---

## Step 3

Provision Church

Automatically:

* Create church record
* Create profile
* Seed default roles
* Seed default permissions
* Assign Super Admin role

---

## Step 4

Email Verification

The Super Admin verifies ownership.

---

## Step 5

First Login

The church enters the platform and begins setup.

---

# Subscription Model

Planned future enhancement.

Possible plans:

## Free

* Limited users
* Limited storage
* Basic reports

## Starter

* More users
* More storage
* Attendance tracking

## Professional

* Advanced reporting
* Automation
* Notifications

## Enterprise

* Unlimited usage
* Priority support
* Advanced integrations

---

# Audit Logging

All sensitive actions must be audited.

Examples:

* Login
* Logout
* User creation
* User deletion
* Permission changes
* Ministry updates
* Stage updates
* Child updates
* Attendance updates

Audit records must include:

* User ID
* Church ID
* Action
* Timestamp
* Entity
* Entity ID

---

# Data Export Rules

Churches may export only their own data.

Exports must be filtered by:

```text
church_id
```

Cross-church exports are prohibited.

---

# Backup Strategy

Backups are platform-wide.

Restoration procedures must preserve tenant isolation.

No restoration process should expose one church's data to another church.

---

# Security Principles

1. Zero trust between tenants.
2. RLS enabled on all business tables.
3. Permission checks on all mutations.
4. Audit logs for sensitive actions.
5. Authentication required for all protected routes.
6. Church isolation enforced at database level.
7. Church isolation enforced at application level.
8. Church isolation enforced at API level.

---

# Future SaaS Features

Planned after core CRM completion:

* Self-service church registration
* Subscription management
* Billing integration
* Church marketplace
* Multi-language church portals
* SMS integration
* WhatsApp integration
* Advanced analytics
* AI-powered ministry insights

---

# Non-Negotiable Rule

At no point may a church access data belonging to another church.

Tenant isolation takes priority over convenience, performance optimizations, and feature development.

Any feature that cannot guarantee tenant isolation must not be released.
