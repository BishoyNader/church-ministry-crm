# Children Management Module Specification

## Overview

The Children Management module is the core ministry record system of the Church Ministry CRM.

It manages child registration, profile management, stage assignment, lifecycle tracking, and church-specific child records.

This module must operate within the platform's multi-tenant architecture. All child data belongs exclusively to a single church and must never be visible to other churches.

---

# Goals

The module should allow church servants and leaders to:

* Register new children
* Maintain child profiles
* Assign children to ministries and stages
* Track child lifecycle status
* Search and filter children
* View child history and details
* Soft-delete children while preserving historical records

---

# Multi-Tenant Requirements

Every child record must belong to exactly one church.

Requirements:

* All records contain church_id
* All queries are scoped by church_id
* RLS policies enforce tenant isolation
* Users may only access children belonging to their church
* No cross-church visibility is permitted

---

# Child Lifecycle

A child progresses through ministry engagement stages.

Pipeline Stages:

1. new_visitor
2. first_followup
3. regular_attendee
4. active_member
5. leader_candidate

The pipeline stage is independent from the ministry stage assignment.

Example:

* Child belongs to Youth Ministry → Grade 10 Stage
* Child pipeline stage = regular_attendee

---

# Functional Requirements

## Child Registration

Users with children.create permission can:

* Create child profiles
* Assign ministry
* Assign stage
* Add parent information
* Add medical information
* Add education information
* Add spiritual information

Required Fields:

* first_name_ar
* last_name_ar
* ministry_id
* stage_id

---

## Child Management

Users with children.update permission can:

* Edit profile information
* Change ministry
* Change stage
* Update contact information
* Update status
* Update pipeline stage

---

## Child Search

Users with children.read permission can:

Search by:

* Arabic name
* English name
* Parent phone
* Mobile number

Filter by:

* Ministry
* Stage
* Status
* Pipeline stage

---

## Child Detail View

The system provides a complete child profile.

Sections:

### Personal Information

* Names
* Date of birth
* Gender
* Photo
* Enrollment information

### Parent Information

* Father
* Mother
* Parent contact information
* Emergency contact

### Medical Information

* Allergies
* Conditions
* Medications

### Spiritual Information

* Baptism
* Confession
* Spiritual notes

### Education Information

* School
* Grade level

---

## Child Deactivation

Children are never hard-deleted.

Deletion process:

* Set deleted_at
* Remove from active lists
* Preserve attendance history
* Preserve follow-up history
* Preserve audit history

---

# Permissions

Required permissions:

* children.read
* children.create
* children.update
* children.delete

Role expectations:

* Super Admin
* Church Admin

have full access.

Stage Leaders and Servants are limited to assigned stages.

---

# Security Requirements

* All mutations use Server Actions
* No client-side direct database mutations
* All actions write audit logs
* All actions validate input using Zod
* RLS enforcement is mandatory

---

# Audit Logging

The following actions must create audit entries:

* Child Created
* Child Updated
* Child Transferred
* Child Deactivated

Audit logs must contain:

* user_id
* church_id
* child_id
* action
* timestamp

---

# Out of Scope

The following are not part of this module:

* Attendance recording
* Follow-up management
* Analytics
* Reporting
* Bulk import
* Export functionality

These belong to separate modules.

---

# Success Criteria

The module is complete when users can:

* Create children
* Edit children
* Search children
* Filter children
* View child details
* Transfer children between stages
* Soft-delete children

while maintaining full tenant isolation and auditability.
