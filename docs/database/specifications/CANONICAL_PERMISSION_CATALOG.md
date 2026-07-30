# Canonical Permission Catalog

**Date:** 2026-07-30  
**Status:** Final — single source of truth  
**Supersedes:** RBAC_ARCHITECTURE.md §3 Permission Code Catalog  

---

## Naming Rules

1. Format: `{module}.{action}` — lowercase, no role names embedded
2. Actions: `create`, `read`, `update`, `delete`, `approve`, `assign`, `transfer`, `export`, `manage`
3. No duplicate or overlapping permissions
4. No role names in permission codes (e.g., use `servants.read`, not `admin.read_servants`)

---

## Module: users

| Code | Description | Can Receive |
|------|-------------|-------------|
| `users.read` | View user profile details | super_admin, admin (scoped) |
| `users.update` | Update user profile details | super_admin, admin (scoped) |

---

## Module: servants

| Code | Description | Can Receive |
|------|-------------|-------------|
| `servants.create` | Create a new servant record | super_admin |
| `servants.read` | View servant list and profiles | super_admin, admin (scoped) |
| `servants.update` | Edit servant details | super_admin, admin (scoped) |
| `servants.delete` | Deactivate/delete a servant | super_admin |
| `servants.approve` | Approve or reject servant registration | super_admin |
| `servants.assign` | Create servant stage/class assignments | super_admin, admin (scoped) |

---

## Module: beneficiaries

| Code | Description | Can Receive |
|------|-------------|-------------|
| `beneficiaries.create` | Create a new beneficiary | super_admin, admin (scoped) |
| `beneficiaries.read` | View beneficiary list and profiles | super_admin, admin (scoped), stage_leader (scoped), class_leader (scoped), servant (assigned only) |
| `beneficiaries.update` | Edit beneficiary details | super_admin, admin (scoped), servant (assigned, limited fields) |
| `beneficiaries.delete` | Deactivate/delete a beneficiary | super_admin |
| `beneficiaries.transfer` | Transfer beneficiary between stages/servants | super_admin, admin (scoped) |

**Limited fields for servant update:** notes, status (servant cannot edit name, DOB, medical info, parent contact).

---

## Module: services

| Code | Description | Can Receive |
|------|-------------|-------------|
| `services.create` | Create a new service | super_admin |
| `services.read` | View service list and details | super_admin, admin (scoped), servant (own) |
| `services.update` | Edit service details | super_admin |
| `services.delete` | Delete/archive a service | super_admin |

---

## Module: stages

| Code | Description | Can Receive |
|------|-------------|-------------|
| `stages.create` | Create a new stage | super_admin, admin (scoped) |
| `stages.read` | View stage list and details | super_admin, admin (scoped), servant (own) |
| `stages.update` | Edit stage details | super_admin, admin (scoped) |
| `stages.delete` | Delete/archive a stage | super_admin |

---

## Module: classes

| Code | Description | Can Receive |
|------|-------------|-------------|
| `classes.create` | Create a new class | super_admin, admin (scoped) |
| `classes.read` | View class list and details | super_admin, admin (scoped), servant (own) |
| `classes.update` | Edit class details | super_admin, admin (scoped) |
| `classes.delete` | Delete/archive a class | super_admin |

---

## Module: attendance

| Code | Description | Can Receive |
|------|-------------|-------------|
| `attendance.create` | Record attendance for a session | super_admin, servant (scoped) |
| `attendance.read` | View attendance records | super_admin, admin (scoped), servant (own + assigned) |
| `attendance.export` | Export attendance data | super_admin, admin (scoped) |

---

## Module: followups

| Code | Description | Can Receive |
|------|-------------|-------------|
| `followups.create` | Create a follow-up record | servant (assigned) |
| `followups.read` | View follow-up records | super_admin, admin (scoped), servant (own + assigned beneficiaries) |
| `followups.update` | Update a follow-up record | servant (own), super_admin |
| `followups.delete` | Delete a follow-up record | servant (own), super_admin |

---

## Module: spiritual

| Code | Description | Can Receive |
|------|-------------|-------------|
| `spiritual.create` | Create a spiritual journal entry | servant (own) |
| `spiritual.read` | View spiritual journal entries | servant (own), super_admin (church-wide, audited) |

**Privacy invariant:** Admin NEVER receives spiritual permissions. Platform Owner NEVER receives spiritual permissions.

---

## Module: notifications

| Code | Description | Can Receive |
|------|-------------|-------------|
| `notifications.read` | View notifications | servant (own) |
| `notifications.manage` | Manage notification settings | super_admin |

---

## Module: reports

| Code | Description | Can Receive |
|------|-------------|-------------|
| `reports.read` | View reports and dashboards | super_admin, admin (scoped), servant (personal) |
| `reports.export` | Export report data | super_admin, admin (scoped) |

---

## Module: settings

| Code | Description | Can Receive |
|------|-------------|-------------|
| `settings.read` | View church settings | super_admin |
| `settings.update` | Update church settings | super_admin |

---

## Module: audit

| Code | Description | Can Receive |
|------|-------------|-------------|
| `audit.read` | View audit logs | super_admin, platform_owner |

---

## Module: import_export

| Code | Description | Can Receive |
|------|-------------|-------------|
| `import.execute` | Execute bulk import | super_admin, admin (scoped) |
| `export.execute` | Execute bulk export | super_admin, admin (scoped) |

---

## Module: tenants (Platform Owner only)

| Code | Description | Can Receive |
|------|-------------|-------------|
| `tenants.create` | Create a new tenant church | platform_owner |
| `tenants.read` | View tenant church list and details | platform_owner |
| `tenants.update` | Update tenant church details | platform_owner |
| `tenants.delete` | Suspend/delete a tenant church | platform_owner |

---

## Module: system (Platform Owner only)

| Code | Description | Can Receive |
|------|-------------|-------------|
| `subscriptions.manage` | Manage subscription plans and billing | platform_owner |
| `billing.read` | View billing data and invoices | platform_owner |
| `system.metrics` | View system usage metrics | platform_owner |
| `system.audit` | View system-wide audit logs | platform_owner |
| `support.manage` | Manage support tickets | platform_owner |

---

## Full Catalog Summary

| Module | Count | Codes |
|--------|-------|-------|
| users | 2 | `users.read`, `users.update` |
| servants | 6 | `servants.create`, `.read`, `.update`, `.delete`, `.approve`, `.assign` |
| beneficiaries | 5 | `beneficiaries.create`, `.read`, `.update`, `.delete`, `.transfer` |
| services | 4 | `services.create`, `.read`, `.update`, `.delete` |
| stages | 4 | `stages.create`, `.read`, `.update`, `.delete` |
| classes | 4 | `classes.create`, `.read`, `.update`, `.delete` |
| attendance | 3 | `attendance.create`, `.read`, `.export` |
| followups | 4 | `followups.create`, `.read`, `.update`, `.delete` |
| spiritual | 2 | `spiritual.create`, `.read` |
| notifications | 2 | `notifications.read`, `.manage` |
| reports | 2 | `reports.read`, `.export` |
| settings | 2 | `settings.read`, `.update` |
| audit | 1 | `audit.read` |
| import_export | 2 | `import.execute`, `export.execute` |
| tenants (PO) | 4 | `tenants.create`, `.read`, `.update`, `.delete` |
| system (PO) | 5 | `subscriptions.manage`, `billing.read`, `system.metrics`, `system.audit`, `support.manage` |
| **Total** | **52** | |

---

## Permission-to-Role Mapping

| Code | platform_owner | super_admin | admin | servant |
|------|:---:|:---:|:---:|:---:|
| users.read | - | ✅ | ✅ (scoped) | - |
| users.update | - | ✅ | ✅ (scoped) | - |
| servants.create | - | ✅ | - | - |
| servants.read | - | ✅ | ✅ (scoped) | - |
| servants.update | - | ✅ | ✅ (scoped) | - |
| servants.delete | - | ✅ | - | - |
| servants.approve | - | ✅ | - | - |
| servants.assign | - | ✅ | ✅ (scoped) | - |
| beneficiaries.create | - | ✅ | ✅ (scoped) | - |
| beneficiaries.read | - | ✅ | ✅ (scoped) | ✅ (assigned) |
| beneficiaries.update | - | ✅ | ✅ (scoped) | ✅ (limited) |
| beneficiaries.delete | - | ✅ | - | - |
| beneficiaries.transfer | - | ✅ | ✅ (scoped) | - |
| services.create | - | ✅ | - | - |
| services.read | - | ✅ | ✅ (scoped) | ✅ (own) |
| services.update | - | ✅ | - | - |
| services.delete | - | ✅ | - | - |
| stages.create | - | ✅ | ✅ (scoped) | - |
| stages.read | - | ✅ | ✅ (scoped) | ✅ (own) |
| stages.update | - | ✅ | ✅ (scoped) | - |
| stages.delete | - | ✅ | - | - |
| classes.create | - | ✅ | ✅ (scoped) | - |
| classes.read | - | ✅ | ✅ (scoped) | ✅ (own) |
| classes.update | - | ✅ | ✅ (scoped) | - |
| classes.delete | - | ✅ | - | - |
| attendance.create | - | ✅ | - | ✅ (scoped) |
| attendance.read | - | ✅ | ✅ (scoped) | ✅ (own+assigned) |
| attendance.export | - | ✅ | ✅ (scoped) | - |
| followups.create | - | - | - | ✅ (assigned) |
| followups.read | - | ✅ | ✅ (scoped) | ✅ (own) |
| followups.update | - | ✅ | - | ✅ (own) |
| followups.delete | - | ✅ | - | ✅ (own) |
| spiritual.create | - | - | - | ✅ (own) |
| spiritual.read | - | ✅ (audited) | - | ✅ (own) |
| notifications.read | - | ✅ | - | ✅ (own) |
| notifications.manage | - | ✅ | - | - |
| reports.read | - | ✅ | ✅ (scoped) | ✅ (personal) |
| reports.export | - | ✅ | ✅ (scoped) | - |
| settings.read | - | ✅ | - | - |
| settings.update | - | ✅ | - | - |
| audit.read | ✅ | ✅ | - | - |
| import.execute | - | ✅ | ✅ (scoped) | - |
| export.execute | - | ✅ | ✅ (scoped) | - |
| tenants.* | ✅ | - | - | - |
| subscriptions.* | ✅ | - | - | - |
| billing.* | ✅ | - | - | - |
| system.* | ✅ | - | - | - |
| support.* | ✅ | - | - | - |
