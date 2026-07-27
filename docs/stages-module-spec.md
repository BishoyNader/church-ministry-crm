# Stages Module

## Purpose

Stages represent ministry groups inside a church.

Examples:
- KG1
- KG2
- Primary 1
- Primary 2
- Preparatory
- Secondary

Each stage belongs to exactly one church.

---

## Permissions

Required permissions:

- stages.read
- stages.create
- stages.update
- stages.delete

---

## Database

Table: stages

Fields:

- id (uuid)
- church_id (uuid)
- name_ar
- name_en
- description_ar
- description_en
- sort_order
- is_active
- created_at
- updated_at

---

## UI Pages

/stages

Displays:

- Search
- Filters
- Stage table
- Create button

/stages/new

Create stage form

/stages/[id]/edit

Edit stage form

---

## Components

- StageTable
- StageForm
- StageFilters
- StageDeleteDialog

---

## Service Layer

- listStages()
- getStageById()
- createStage()
- updateStage()
- deleteStage()

---

## Validation

name_ar required

church_id required

sort_order >= 0

---

## RBAC

Use PermissionGuard.

Required permission for page access:

stages.read

Required permission for creation:

stages.create

Required permission for editing:

stages.update

Required permission for deletion:

stages.delete