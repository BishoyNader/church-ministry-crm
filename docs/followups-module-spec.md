# Follow-ups Module Specification

## Overview

The Follow-ups module manages ministry care activities and child engagement workflows.

The module tracks interactions, assignments, outcomes, and follow-up progress.

---

# Goals

The module should help churches:

* Track ministry care
* Assign responsibilities
* Monitor completion
* Maintain historical engagement records

---

# Multi-Tenant Requirements

Every follow-up belongs to:

* One church
* One child
* One stage

Data must never be shared between churches.

---

# Follow-up Types

Supported values:

* phone_call
* home_visit
* whatsapp
* church_meeting
* other

---

# Follow-up Statuses

Supported values:

* scheduled
* in_progress
* completed
* cancelled

---

# Functional Requirements

## Create Follow-up

Authorized users can:

* Select child
* Select stage
* Select type
* Schedule activity
* Assign responsible user
* Add notes

---

## Manage Follow-up

Users can:

* Update status
* Record outcomes
* Reassign ownership
* Reschedule activities

---

## Follow-up Dashboard

The system should display:

* Open follow-ups
* In-progress follow-ups
* Completed follow-ups
* Assigned follow-ups

---

## Child Timeline

Each child profile should display:

* Follow-up history
* Outcomes
* Assigned users
* Activity timeline

---

# Permissions

Required permissions:

* followups.read
* followups.create
* followups.update
* followups.delete

---

# Security Requirements

* RLS enforced
* Tenant isolation
* Server Actions only
* Zod validation
* Audit logging

---

# Audit Logging

Audit events:

* Follow-up Created
* Follow-up Updated
* Follow-up Completed
* Follow-up Reassigned
* Follow-up Deleted

Each audit record stores:

* church_id
* child_id
* followup_id
* user_id
* action
* timestamp

---

# Future Enhancements

Future roadmap items:

* Notifications
* WhatsApp integration
* SMS integration
* Reminder automation
* Escalation workflows
* Follow-up SLA tracking
* Ministry care dashboards

---

# Out of Scope

Current module excludes:

* Messaging integrations
* Automated campaigns
* AI recommendations
* Reporting dashboards

These belong to future phases.

---

# Success Criteria

The module is complete when authorized users can:

* Create follow-ups
* Assign follow-ups
* Track status
* Record outcomes
* Review history

while maintaining complete church isolation, security, and auditability.
