# Attendance Module Specification

## Overview

The Attendance module records and manages child attendance for ministries and stages.

Attendance is separated from Children Management to maintain clear domain boundaries and support future reporting and analytics features.

---

# Goals

The module should allow leaders and servants to:

* Record attendance
* Update attendance
* Review attendance history
* Monitor attendance trends
* Support future reporting and dashboards

---

# Multi-Tenant Requirements

Every attendance record belongs to:

* One church
* One child
* One stage
* One attendance date

Attendance data must never be visible across churches.

---

# Attendance Status Types

Supported values:

* present
* absent
* excused

---

# Functional Requirements

## Record Attendance

Authorized users can:

* Select stage
* Select date
* View children in stage
* Record attendance status
* Add optional notes

Attendance is saved as a batch operation.

---

## Edit Attendance

Authorized users can:

* Modify attendance status
* Update notes
* Correct mistakes

---

## Attendance History

Users can:

* View attendance history for a child
* View attendance history for a stage
* View attendance history for a ministry

---

## Attendance Sheet

The system should provide:

* Date selector
* Stage selector
* Child roster
* Attendance status controls
* Save action

---

# Permissions

Required permissions:

* attendance.read
* attendance.create
* attendance.update
* attendance.delete

---

# Security Requirements

* RLS enforced
* Server Actions only
* Zod validation
* Audit logging
* Tenant isolation

---

# Audit Logging

Audit events:

* Attendance Recorded
* Attendance Updated
* Attendance Deleted

Each event stores:

* church_id
* child_id
* stage_id
* attendance_date
* user_id

---

# Future Enhancements

Future phases may include:

* Attendance analytics
* Attendance dashboards
* Monthly summaries
* Absence alerts
* Export functionality
* Ministry performance metrics

---

# Out of Scope

Current module excludes:

* Reporting
* Dashboards
* Predictive analytics
* Notifications

These belong to later roadmap phases.

---

# Success Criteria

The module is complete when authorized users can:

* Record attendance
* Update attendance
* View attendance history

while preserving security, auditability, and tenant isolation.
