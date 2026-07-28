# Domain Roadmap

## Purpose

This document defines the functional roadmap of the Church Ministry CRM platform.

It provides a high-level view of all business domains, implementation phases, dependencies, and future expansion plans.

The roadmap ensures that development follows a structured sequence and that foundational modules are completed before dependent modules are introduced.

---

# Product Vision

The Church Ministry CRM is a multi-tenant SaaS platform designed to help churches manage:

* Members
* Children
* Ministries
* Stages
* Attendance
* Follow-Ups
* Communication
* Reporting
* Analytics

while maintaining complete data isolation between churches.

---

# Development Principles

## Foundation First

Core infrastructure must be completed before ministry features.

## Domain-Driven Design

Each business domain should be implemented as an isolated feature module.

## Security by Default

Every feature must enforce:

* Authentication
* Authorization
* Tenant isolation
* Audit logging

## SaaS Ready

Every module must support multiple churches from day one.

---

# Phase 1 — Foundation

Status: Completed

Purpose:

Provide the technical infrastructure required for all future development.

Modules:

* Next.js Application Setup
* TypeScript
* Tailwind CSS
* shadcn/ui
* Supabase Integration
* Authentication Infrastructure
* Internationalization (Arabic / English)
* RTL Support
* Theme Support
* Project Architecture
* Database Migrations

Deliverables:

* Application shell
* Database schema
* Folder structure
* Development workflow

---

# Phase 2 — Identity & Access

Status: Completed

Purpose:

Control who can access the platform and what actions they can perform.

Modules:

## Authentication

Completed

Features:

* Login
* Logout
* Signup
* Password Reset
* Session Management

---

## Role-Based Access Control

Completed

Features:

* Permission System
* Roles
* Permission Guards
* Route Protection

---

## User Management

Completed

Features:

* User CRUD
* Role Assignment
* Stage Assignment
* User Activation
* User Search

---

# Phase 3 — Ministry Structure

Status: Completed

Purpose:

Model the organizational structure of a church.

Modules:

## Ministries

Completed

Features:

* Ministry CRUD
* Ministry Activation
* Ministry Ordering

---

## Stages

Completed

Features:

* Stage CRUD
* Stage Assignment
* User Assignment
* Stage Hierarchy
* Stage Statistics

---

# Phase 4 — Children Management

Status: Planned

Priority: Critical

Purpose:

Manage children and member records.

Modules:

## Children

Features:

* Child Registration
* Child Profile
* Stage Assignment
* Family Information
* Contact Information
* Medical Notes
* School Information
* Address Information
* Child Status Tracking
* Child Search
* Child Filters
* Child Transfers
* Child Notes

Dependencies:

* Authentication
* RBAC
* Users
* Ministries
* Stages

Deliverables:

* Children CRUD
* Child Detail Page
* Child History
* Child Assignment Workflow

---

# Phase 5 — Attendance Management

Status: Planned

Priority: Critical

Purpose:

Track attendance across ministries and stages.

Modules:

## Attendance

Features:

* Attendance Sessions
* Attendance Recording
* Bulk Attendance
* Attendance History
* Attendance Reports
* Attendance Trends
* Attendance Percentages

Dependencies:

* Children
* Stages
* Users

Deliverables:

* Attendance Module
* Attendance Dashboard
* Attendance Analytics

---

# Phase 6 — Follow-Up Management

Status: Planned

Priority: High

Purpose:

Ensure children receive appropriate pastoral care and follow-up.

Modules:

## Follow-Ups

Features:

* Follow-Up Records
* Visit Tracking
* Phone Call Tracking
* Follow-Up Notes
* Follow-Up Scheduling
* Follow-Up Statuses
* Escalation Workflow

Dependencies:

* Children
* Attendance
* Users

Deliverables:

* Follow-Up Module
* Follow-Up Dashboard
* Follow-Up Reports

---

# Phase 7 — Dashboards & Analytics

Status: Planned

Priority: High

Purpose:

Provide insights and operational visibility.

Modules:

## Dashboard

Features:

* Church Overview
* Ministry Overview
* Stage Overview
* Attendance KPIs
* Follow-Up KPIs

---

## Analytics

Features:

* Growth Trends
* Retention Trends
* Attendance Trends
* Ministry Health Indicators

Dependencies:

* Children
* Attendance
* Follow-Ups

Deliverables:

* Executive Dashboard
* Ministry Dashboard
* Stage Dashboard

---

# Phase 8 — Reporting

Status: Planned

Priority: High

Purpose:

Generate operational and leadership reports.

Modules:

## Reports

Features:

* Attendance Reports
* Follow-Up Reports
* Child Reports
* Ministry Reports
* Stage Reports
* User Reports

Output Formats:

* PDF
* Excel
* CSV

Dependencies:

* All operational modules

Deliverables:

* Report Builder
* Export Engine

---

# Phase 9 — Communication

Status: Planned

Priority: Medium

Purpose:

Improve communication with children, families, and servants.

Modules:

## Notifications

Features:

* In-App Notifications
* Email Notifications
* Scheduled Notifications

---

## Messaging

Future Enhancements:

* WhatsApp Integration
* SMS Integration
* Push Notifications

Dependencies:

* Children
* Follow-Ups
* Attendance

---

# Phase 10 — SaaS Platform

Status: Planned

Priority: Medium

Purpose:

Enable operation as a commercial multi-tenant platform.

Modules:

## Church Onboarding

Features:

* Self Registration
* Church Creation
* Super Admin Creation

---

## Subscription Management

Features:

* Plans
* Limits
* Billing Integration

---

## Tenant Administration

Features:

* Tenant Monitoring
* Tenant Settings
* Tenant Support

Dependencies:

* Stable CRM Core

Deliverables:

* SaaS Administration Panel

---

# Phase 11 — Integrations

Status: Planned

Priority: Medium

Modules:

* Email Providers
* SMS Providers
* WhatsApp Providers
* Calendar Providers
* Cloud Storage Providers

---

# Phase 12 — Artificial Intelligence

Status: Future

Priority: Long-Term

Purpose:

Provide ministry insights and operational assistance.

Modules:

## AI Assistant

Features:

* Natural Language Queries
* Ministry Recommendations
* Attendance Insights
* Follow-Up Suggestions

---

## Predictive Analytics

Features:

* Attendance Risk Detection
* Follow-Up Prioritization
* Growth Forecasting

Dependencies:

* Mature Data Set
* Dashboards
* Reporting

---

# Release Milestones

## v0.1

Infrastructure

Completed

---

## v0.2

Authentication & RBAC

Completed

---

## v0.3

User Management

Completed

---

## v0.4

Stage Management

Completed

---

## v0.5

Children Management

Planned

---

## v0.6

Attendance Management

Planned

---

## v0.7

Follow-Up Management

Planned

---

## v0.8

Dashboard & Analytics

Planned

---

## v0.9

Reporting

Planned

---

## v1.0

Production CRM Release

Target Scope:

* Multi-Tenant
* Children Management
* Attendance
* Follow-Ups
* Reporting
* Dashboards

Ready for Church Adoption

---

# Success Criteria

The platform is considered successful when:

* Multiple churches can use the system simultaneously.
* Data isolation is guaranteed.
* Church administrators can operate independently.
* Ministry leaders can manage their stages efficiently.
* Attendance and follow-up workflows are fully digital.
* Leadership can make decisions using reliable data.
