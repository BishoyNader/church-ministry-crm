# Phase 3C.2 — RLS Dependency Graph

**Phase:** 3C — Registration & Church Provisioning
**Date:** 2026-07-31
**Basis:** migrations `001`–`022` only. All helper functions below are `SECURITY DEFINER` unless noted.

> **Note on `get_user_role()`:** no function with this name exists in migrations 001–022 or in the app. The audit task list name maps to nothing; role resolution is performed by the three 022 helpers `user_is_super_admin()`, `user_is_admin()`, `user_is_platform_owner()` (and, legacy, `user_has_permission()`). The graph below covers the functions that actually exist.

---

## 1. Function inventory (current schema)

| Function | Signature | Defined | Status |
|---|---|---|---|
| `get_user_church_id()` | `RETURNS uuid` | 001, re-created 022 | **ACTIVE** — policy-critical |
| `get_user_servant_id()` | `RETURNS uuid` | 022 | **ORPHANED** — no policy references it |
| `user_is_platform_owner()` | `RETURNS boolean` | 022 | **ACTIVE** |
| `user_is_super_admin(p_church_id uuid DEFAULT NULL)` | `RETURNS boolean` | 022 | **ACTIVE** |
| `user_is_admin(p_church_id uuid DEFAULT NULL)` | `RETURNS boolean` | 022 | **ACTIVE** |
| `user_has_permission(permission_code text)` | `RETURNS boolean` | 001 (never dropped) | **ORPHANED** — no policy references it after 022; not church-scoped, not `end_date`-aware, unaware of 021 catalog changes |
| `get_user_service_ids()` | `RETURNS uuid[]` | 022 | **ACTIVE** (policy-critical) |
| `get_user_stage_ids()` | `RETURNS uuid[]` | 022 | **ACTIVE** (policy-critical) |
| `get_user_class_ids()` | `RETURNS uuid[]` | 022 | **ACTIVE** (policy-critical) |
| `get_user_assigned_beneficiary_ids()` | `RETURNS uuid[]` | 022 | **ORPHANED** — no policy references it |
| `seed_church_roles(p_church_id uuid)` | `RETURNS void` | 001, re-created 021 | **ACTIVE** — called by provisioning RPC |
| `write_audit_log(...)` | `RETURNS uuid` | 001, re-created 019 | **ACTIVE** — unused by app (app does direct inserts via `append_only`) |
| `handle_updated_at()` | trigger fn | 001 | **ACTIVE** (11 triggers) |
| `handle_new_user()` + `on_auth_user_created` trigger | trigger fn | 001 | **INERT** — no-op, superseded by signup Server Action |

---

## 2. `get_user_church_id()`

```
SELECT church_id FROM profiles WHERE id = auth.uid()
```
(022:14–17; SECURITY DEFINER, STABLE; also defined identically in 001:605)

**Tables referenced:** `profiles`

**Policies depending on it** (all in 022):
- churches: `tenant_read`, `super_admin_update`
- services: `tenant_isolation`, `admin_write`
- stages: `tenant_isolation`, `admin_write`
- classes: `tenant_isolation`, `admin_write`
- profiles: `tenant_isolation`, `admin_scoped`
- servants: `tenant_isolation`, `admin_read`
- servant_stage_assignments: `tenant_isolation`, `admin_write`
- beneficiaries: `tenant_isolation`, `admin_write`
- beneficiary_assignments: `tenant_isolation`
- attendance_sessions: `tenant_isolation`, `record_attendance`
- attendance_records: `tenant_isolation`
- followups: `tenant_isolation`
- spiritual_journal_entries: `tenant_isolation`
- notifications: `tenant_isolation`
- audit_logs: `tenant_isolation`
- roles: `tenant_isolation`
- role_permissions: `tenant_isolation`, `super_admin_all`
- user_roles: `tenant_isolation`
- events: `tenant_isolation`
- event_registrations: `tenant_isolation`
- documents: `tenant_isolation`
- ai_conversations: `tenant_isolation`
- ai_messages: `tenant_isolation`
- document_embeddings: `tenant_isolation`

**Function dependents:** `user_is_super_admin` (default arg), `user_is_admin` (default arg), `get_user_service_ids`, `get_user_stage_ids`, `get_user_class_ids`.

**Planned 3C RPC impact:** `get_my_access_state()` reads own profile via `auth.uid()`; `approve_servant`/`reject_servant` guard via `user_is_super_admin(servants.church_id)` (which internally calls this when no arg is given — here an explicit church is passed); `approve/reject_church_request` guard via `user_is_platform_owner()` (no dependency on this function).

**Blast radius:** highest of any helper — 24 policies + 5 function dependents. Any change to its church-resolution semantics (e.g., restricting to approved users) cascades across the entire tenant surface. **The 3C batch must NOT modify it.**

---

## 3. `user_is_super_admin(p_church_id uuid DEFAULT NULL)`

(022:36–51; checks an active `super_admin` `user_roles` grant with `(end_date IS NULL OR end_date > CURRENT_DATE)` for the resolved church)

**Tables referenced:** `user_roles`, `roles`, `profiles` (via `get_user_church_id`)

**Policies depending on it** (all in 022):
- churches: `super_admin_update` (arg = church `id`)
- services, stages, classes, ssa, beneficiaries, ba, attendance_sessions, attendance_records, followups, roles, role_permissions, user_roles, events, event_registrations, documents, ai_conversations, ai_messages, document_embeddings: `super_admin_all`
- profiles: `super_admin_all`
- servants: `super_admin_all`
- notifications: `super_admin_read`
- audit_logs: `super_admin_read`
- spiritual_journal_entries: `priest_read`, `deny_admin_spiritual`

**Function dependents:** `user_is_admin` (internal), `get_user_service_ids`, `get_user_stage_ids`, `get_user_class_ids`.

**Planned 3C RPC impact:** `approve_servant`/`reject_servant` guard (cross-church rejection depends on passing the servant's church explicitly). **Critical:** this is the approval chokepoint — the RPC must pass `p_church_id = servants.church_id`, never the default, or the guard degrades to the caller's own church.

---

## 4. `user_is_admin(p_church_id uuid DEFAULT NULL)`

(022:53–68; active `super_admin` **or** `admin` grant)

**Tables referenced:** `user_roles`, `roles`, `profiles` (via `get_user_church_id`)

**Policies depending on it** (all in 022):
- services/stages/classes/ssa/beneficiaries/ba: `admin_write` (or `admin_read` on ba)
- profiles: `admin_scoped`
- user_roles: `admin_read`
- spiritual_journal_entries: `deny_admin_spiritual` (restrictive)

**Planned 3C RPC impact:** none directly (approval is super_admin-only per canonical `servants.approve`); `get_my_access_state()` may surface `role_types` including `admin`.

---

## 5. `user_is_platform_owner()`

(022:25–34; active `platform_owner` grant; note: PO has `church_id = NULL` in `profiles`, so this helper does **not** depend on `get_user_church_id`)

**Tables referenced:** `user_roles`, `roles`

**Policies depending on it** (all in 022):
- churches: `platform_owner_all`
- permissions: `platform_owner_write`
- audit_logs: `platform_owner_read`

**Planned 3C RPC impact:** `approve_church_request` / `reject_church_request` guard; `church_requests.platform_owner_all` policy. Highest-value guard in the new-church path.

---

## 6. Scope helpers (policy-critical)

| Function | Tables referenced | Policies depending (022) |
|---|---|---|
| `get_user_service_ids()` | `services`, `stages`, `ssa` (via `get_user_church_id`, `user_is_super_admin`) | services.`admin_read`; stages.`admin_read`; ssa.`admin_read`; ba.`admin_read`; beneficiaries.`admin_read`; attendance_sessions.`admin_read`; followups.`admin_read`; events.`stage_scope` |
| `get_user_stage_ids()` | `stages`, `ssa` (ditto) | classes.`admin_read`; attendance_sessions.`stage_scope_insert`/`stage_scope_select`; attendance_records.`session_scope`; beneficiaries.`servant_read`; events.`stage_scope` |
| `get_user_class_ids()` | `classes`, `ssa` (ditto) | attendance_sessions.`stage_scope_insert`/`stage_scope_select`; attendance_records.`session_scope`; beneficiaries.`servant_read` |

**Planned 3C RPC impact:** `get_my_access_state()` reads role grants directly and does not need these; R-8's pending-user sweep interacts with `tenant_isolation` rather than these scopes.

---

## 7. RPC / function impact of modifying each helper

| If you modify… | Policies broken | Functions broken | 3C RPCs impacted |
|---|---|---|---|
| `get_user_church_id()` | 24 (see §2) | 5 | `approve_servant`, `reject_servant`, `get_my_access_state` (indirect) |
| `user_is_super_admin()` | ~30 | 4 | `approve_servant`, `reject_servant` |
| `user_is_admin()` | 8 | 3 scope helpers | none |
| `user_is_platform_owner()` | 3 | — | `approve_church_request`, `reject_church_request` |
| `get_user_servant_id()` | 0 (orphan) | — | none (do not adopt) |
| `get_user_assigned_beneficiary_ids()` | 0 (orphan) | — | none (do not adopt) |
| `user_has_permission()` | 0 (orphan) | — | none (do not adopt) |
| `write_audit_log()` | 0 | — | 3C RPCs may call it for the audit trail (or insert directly) |
| `seed_church_roles()` | 0 | — | `approve_church_request` (must remain non-PO-escalating: it is SECURITY DEFINER and creates only `super_admin`/`admin`/`servant` rows — never `platform_owner`) |

---

## 8. Dependency rules for 3C

1. **Do not modify** `get_user_church_id`, `user_is_super_admin`, `user_is_admin`, `user_is_platform_owner`, or the three scope helpers in the 3C batch. The remediation changes only **policies** (three `tenant_isolation` replacements + `own_profile_insert`), not helper definitions.
2. **`approve_servant`/`reject_servant`** must pass the servant's church explicitly to `user_is_super_admin` (never the default `NULL`).
3. **Do not reintroduce `user_has_permission`** in any 3C RPC or policy — it is not church-scoped, ignores `end_date`, and predates the 021 catalog.
4. New `church_requests` policies depend only on `user_is_platform_owner` and `auth.jwt()` — no change to existing helpers.
5. Recreating `audit_trigger_fn` (A4) adds a new dependency: `audit_logs` writes from any table it is attached to; the restored triggers on `profiles`, `user_roles`, `followups`, `beneficiaries`, `attendance_sessions`, `attendance_records` will fire SECURITY DEFINER inserts that bypass RLS (owner privilege) — intended.
