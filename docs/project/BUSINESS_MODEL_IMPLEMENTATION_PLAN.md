# Business Model Implementation Plan — Church Ministry CRM

Status: **Architecture review complete — awaiting approval before code generation**
Date: 2026-08-03
Base: migrations 001–025 applied; prior P0/P1 bug-fix batch (dashboard/children + church English name removal) complete and verified.
Supersedes: `BUSINESS_REQUIREMENTS_AUDIT.md` (this is the finalized, decisioned plan).

---

## 1. Current-State Analysis

### Already exists (verified)
- **Schema (001–025):** 26 live tables; RLS enabled everywhere; audit framework (`audit_logs` append-only, `write_audit_log`, 6 audit triggers); Phase 3C church+servant registration RPCs; `beneficiary_assignments` history model; temporal `user_roles`; 52-code permission catalog; `church_requests` with unique pending-email.
- **Auth flows:** signup → pending → `/pending-approval` → `approve_servant` RPC; church request → PO review → atomic provisioning.
- **Wired features:** beneficiaries CRUD + detail (attendance/followup tabs), beneficiary attendance batch entry, followups CRUD, stages/ministries CRUD, users + role/stage assignment + pending-registrations queue, dashboard (charts), church-request admin page, public signup/church-request.
- **Design system:** cohesive oklch tokens, RTL/Arabic, dark mode, skeletons, empty states, permission-gated UI.

### Broken (verified — the four facts, all confirmed by source + runtime probe)
| # | Finding | Evidence |
|---|---|---|
| F1 | Server-action RBAC always fails: `rbac.service.ts` uses `@/lib/supabase/client` (`createBrowserClient`) inside Node server actions → no session → `hasPermission()` = `false` for every request. | `src/features/rbac/services/rbac.service.ts:1`; runtime probe returned `session: null`. |
| F2 | `AppShell` (sidebar/header/nav) mounted only on orphan `src/app/page.tsx`; all real `[locale]` routes render without navigation or sign-out. | `src/app/page.tsx:3,18`; no layout imports `app-shell`. |
| F3 | Platform Owner unprovisionable: `roles.church_id`/`user_roles.church_id` NOT NULL; no `platform_owner` role row or grant anywhere. | grep of all migrations; `022:31`. |
| F4 | RLS writes tenant-scoped, not permission-scoped: `tenant_isolation FOR ALL` on ~17 tables lets any church member write directly; `beneficiary_assignments` immutability and journal privacy defeated; `profiles.own_profile_update` has no `WITH CHECK`; `record_attendance` INSERT has no stage-scope check. | `022:332–335`, `022:219`, `022:316`. |

### Missing (business-required)
Spiritual Journal UI, Reports module + CSV, Notifications center + automation (birthdays/absences/followup reminders), Settings, Servant attendance, Excel import, Assignments module, Servants module, Stage-Leader role, role-aware navigation, per-role dashboards, Events, platform management surfaces.

---

## 2. Role Model Review

### Required model → implementation mapping
| Level | Required role | DB `role_type` | Status |
|---|---|---|---|
| 1 | Platform Owner | `platform_owner` | **Unprovisionable (F3)** — fix in 026 |
| 2 | Ministry Admin (أمين الخدمة) | **`super_admin`** (relabel display) | Exists, over-granted (holds platform codes); approve/assign already super_admin-only ✓ |
| 3 | Stage Leader (أمين مرحلة) | **`stage_leader`** — NEW | **Missing** (collapsed into `servant` in 021) — add in 030 |
| 4 | Servant | `servant` | Exists; over-granted (`beneficiaries.update` + all `followups.*` without scope) |

### Permission changes needed
- **super_admin → Ministry Admin:** drop platform codes (`tenants.*`, `system.*`, `billing.*`, `subscriptions.manage`, `support.manage`); add `settings.read/update`, `audit.read`, `notifications.read`; keep approve/assign/transfer. Display relabel: `أمين الخدمة` / `Ministry Admin`.
- **admin (deputy tier):** add `attendance.create`, `followups.create/update/delete`, `settings.read`, `notifications.read`. Keep it subordinate (no approve, no tenants).
- **stage_leader (NEW):** scoped bundle = `beneficiaries.read/update` + `attendance.create/read` + `followups.create/read/update/delete` + `servants.read/update/assign` + `reports.read/export` + `notifications.read` + `services/stages/classes.read`, all **stage-scoped** (enforced in RLS + actions). No spiritual (private), no users, no settings, no delete, no tenants.
- **servant:** keep 15 codes but enforce assignment-scope in actions and RLS (view/edit only assigned beneficiaries; followups only own/assigned). Remove nothing now (additive).
- **New role_seed function** supersedes `seed_church_roles` (021) via `CREATE OR REPLACE` in 026; relabel; new `stage_leader` bundle added in 030.
- Wire currently-unused codes as features land: `spiritual.*` (033), `notifications.*` (031), `import.execute` (036), `reports.export` (032), `classes.*` (assignments), `settings.*`/`audit.read` (037), `beneficiaries.transfer` (switch `transferChildAction` gate from `beneficiaries.update`).

---

## 3. Database Review

### Contradiction found & resolved
**Journal privacy:** requirement = strict owner-only. Schema `022:334` has `priest_read` (super_admin reads) — **contradiction**. Resolution (requirements win): in 026, `DROP POLICY priest_read` **and** `DROP POLICY tenant_isolation` on `spiritual_journal_entries` (the permissive tenant SELECT leaks to all church members); keep `servant_owner ALL` + `deny_admin_spiritual` RESTRICTIVE. Journal becomes owner-only.

### New tables
- `beneficiary_promotions` (027, optional-but-recommended): `id, church_id, beneficiary_id FK, from_service_id, from_stage_id, to_service_id, to_stage_id, class_id, promotion_year int, reason, decided_by FK profiles, created_at`. Gives a clean "promotion history" report source without scanning assignments. (Audit-log already covers events; this is the domain query model.)

### Columns
- `beneficiary_assignments`: `servant_id DROP NOT NULL` (decouple promotion from servant availability); add `promotion_year int`.
- `spiritual_journal_entries`: add `liturgy_attendance bool DEFAULT false` (requirement lists Liturgy; table only has `communion`).
- `roles.church_id` / `user_roles.church_id`: `DROP NOT NULL` (allow the global `platform_owner` role with `church_id IS NULL`).
- `notifications.old_metadata`: drop in 040 cleanup (never read).

### Constraints
- Partial unique: `uq_ba_current ON beneficiary_assignments (beneficiary_id) WHERE is_current = true` — after dedupe (keep latest per beneficiary, close others). Kills the C4 duplicate bug at the DB.
- Relax `attendance_sessions UNIQUE (stage_id, session_date)` → allow per-class/multi-session days (P2, additive: replace with `UNIQUE(stage_id, class_id, session_date)` after data check).
- `followups.type` CHECK constraint (040).

### Indexes (027)
- `pg_trgm` GIN on `beneficiaries.full_name_ar` (search).
- `beneficiary_assignments (servant_id) WHERE is_current` (servant dashboard).
- `followups (status, scheduled_at) WHERE deleted_at IS NULL` (overdue).
- `notifications (recipient_id, is_read, sent_at DESC)` already exists; add `(recipient_id) WHERE is_read = false` partial for unread count.
- `church_requests (reviewed_by)` for PO queue history.

### RPC updates
| RPC | Change |
|---|---|
| `transfer_beneficiary` (024) | Add `p_new_servant_id uuid DEFAULT NULL`, `p_class_id uuid DEFAULT NULL`, `p_promotion_year int DEFAULT NULL`; idempotent; writes audit incl. promotion_year. |
| `create_beneficiary_with_assignment` (024) | No signature change; optionally accept class + year in 027 variant. |
| `approve_servant` (023) | Allow Ministry Admin: change guard `user_is_super_admin` → `user_is_admin` (both super_admin and admin pass); still prevents self-approval. |
| `grant_platform_owner(p_user_id uuid)` | NEW SECURITY DEFINER, service_role-only; inserts `user_roles` (church_id NULL) for the global PO role; guards duplicates + active-grant uniqueness. |
| `user_is_platform_owner()` | Rewrite: `role_type='platform_owner' AND church_id IS NULL AND active grant`. |
| `get_my_access_state` (023) | No change (role_types already returned). |
| `seed_church_roles` (021) | `CREATE OR REPLACE` with corrected bundles + relabeled names (026). |

### RLS policy matrix for 026 (per-table final state)
| Table | Change |
|---|---|
| services / stages / classes | `tenant_isolation FOR ALL` → **FOR SELECT**; writes via existing `admin_write` (`user_is_admin`) + `super_admin_all`. |
| beneficiaries | `tenant_isolation FOR ALL` → **FOR SELECT**; writes via `admin_write` + `super_admin_all`; reads via `admin_read`/`servant_read`. |
| beneficiary_assignments | `tenant_isolation` → **FOR SELECT**; writes only via 024 RPCs (SECURITY DEFINER); `immutable_update/delete` now effective. |
| followups | `tenant_isolation` → **FOR SELECT**; servant writes via `own_all` (own/assigned); admin via `admin_read` + `super_admin_all`. |
| attendance_sessions | `tenant_isolation` → **FOR SELECT**; inserts via `stage_scope_insert` (already stage-scoped). |
| attendance_records | `tenant_isolation` → **FOR SELECT**; `record_attendance` INSERT gains **stage-scope** (session's stage ∈ `get_user_stage_ids()`). |
| servant_stage_assignments | `tenant_isolation` → **FOR SELECT**; writes via `admin_write`; stage-leader write policy added in 030. |
| profiles | `own_profile_update`: add **immutability trigger** (`BEFORE UPDATE OF church_id` → raise unless super/service) — deterministic, avoids RLS-within-UPDATE ambiguity. |
| spiritual_journal_entries | **DROP `tenant_isolation` + `priest_read`**; keep `servant_owner ALL` + `deny_admin_spiritual`. Strictly private. |
| events / event_registrations / documents / ai_* | `tenant_isolation` → **FOR SELECT**; writes via `super_admin_all`/`owner_scope` (modules are P2). |
| churches / notifications / audit_logs / roles / permissions / role_permissions / user_roles / servants / church_requests | Unchanged (already correct). |

---

## 4. UI/UX Review

### Role-specific navigation trees (central config; permission-filtered)

**Servant:** Dashboard · Beneficiaries (assigned) · Attendance · Follow-ups · Spiritual Journal · Reports · Notifications · Settings
**Stage Leader:** Dashboard · Beneficiaries (stage) · Servants (stage) · Attendance · Follow-ups · Reports · Notifications · Settings
**Ministry Admin (super_admin):** Dashboard · Beneficiaries · Servants · Assignments · Attendance · Follow-ups · Reports · Notifications · Users & Approvals · Stages · Settings · Audit Logs
**Platform Owner:** Dashboard · Church Requests · Churches · Platform Users · Audit Logs · Subscriptions · Settings
Nav rendered by `AppShell` mounted in a new `(app)` layout; mobile bottom nav (P2 polish); header gains avatar + name + role + profile menu + notifications bell (unread badge).

### Dashboard layouts
- **Servant:** KPI cards — Assigned Beneficiaries · Attendance % · Open Follow-ups · Spiritual Streak. Quick actions (Beneficiaries, Attendance, Follow-ups, Journal, Reports, Settings). Notification list (birthdays, consecutive absences, followup reminders). Assigned-beneficiary table + weekly trend.
- **Stage Leader:** KPIs — Stage attendance % · Stage servants · Stage beneficiaries · Follow-ups. Quick actions. Stage alerts (missing attendance, birthdays, long absences, new servant activity).
- **Ministry Admin:** KPIs — active beneficiaries · active servants · attendance trends · open followups. **Approval center widget** (pending servant registrations → `/users`). **Assignment management widget** (recent transfers, current assignments → `/assignments`). Reports links.
- **Platform Owner:** pending church requests · active churches · subscription metrics · platform analytics (churches/users/attendance across tenants) · audit insights.

### Notification UX
Bell in header (unread badge) → inbox page (`/notifications`): list, filter by type, mark read/unread, mark-all-read. Types: `birthday`, `absence`, `followup_reminder`, `registration_pending`, `church_request_pending`, `system`. Generation by scheduled job (Vercel cron → service-role server action, or `pg_cron`), idempotent per (recipient, type, entity, day).

---

## 5. Migration Plan

All additive; never renumber; never drop data; each ships verification block + rollback statement.

### P0 — Unblock & harden (fixes F1–F4 + integrity)
| Migr. | Content | Risk | Rollback |
|---|---|---|---|
| **026** `rbac_and_rls_hardening.sql` | PO provisioning (`church_id` nullable on roles/user_roles; global PO role row + platform-code grants; `user_is_platform_owner()` rewrite; `grant_platform_owner` RPC, service_role-only); RLS policy matrix above (tenant_isolation→SELECT; drop journal tenant+priest_read; profile church immutability trigger; stage-scoped `record_attendance`); `seed_church_roles` relabel + de-scope super_admin; `approve_servant` → `user_is_admin`. | **High** — write-policy narrowing can break legit flows. | `ALTER TABLE` reversions + policy re-create; apply with role×action smoke matrix on a seeded DB |
| **027** `beneficiary_promotion.sql` | Dedupe current assignments + `uq_ba_current`; `servant_id` nullable; `promotion_year`; `transfer_beneficiary` extension (servant/class/year); optional `beneficiary_promotions`; indexes (pg_trgm, servant-current, overdue followups, unread). | Medium — unique index needs clean dedupe. | Drop index/columns; revert RPC signature |
| Frontend P0 | F1: `rbac.service` → server client (thread into actions). F2: `(app)` layout mounting `AppShell`; remove orphan root page. F5: render `KpiCards`, fix follow-up donut `open`, fix `RecentChildren` badge. i18n missing keys (beneficiary form/detail/table). PO bootstrap step (documented SQL/action). | High (F1) | — |

### P1 — Business model & required features
| Migr. | Content | Risk | Rollback |
|---|---|---|---|
| **028** `stage_leader_role.sql` | Add `stage_leader` to `user_role_type`; `seed_church_roles` stage_leader bundle; stage-scoped write policies on SSA/attendance/followups via new `user_has_stage_write` helper; app scope enforcement in servant/leader actions + nav trees + per-role dashboards + header (avatar/role/bell). | Medium — role-scope in app must mirror RLS. | Drop enum value + policies; revert bundle |
| **029** `notification_automation.sql` | Generator SQL (`today_birthdays`, `consecutive_absences`, `overdue_followups`, `pending_registrations`, `pending_church_requests`) + `generate_notification_batch()` idempotent inserts; Vercel-cron wrapper action (or `pg_cron`). | Low | Disable cron; delete generated rows optional |
| **030** `reports_helpers.sql` | `report_attendance_summary`, `report_servant_summary`, `report_growth`, `report_followup_effectiveness`, `report_promotion_history`, `report_absences` — row functions for CSV. | Low | DROP FUNCTION |
| Frontend P1 | Reports module (+CSV), Notifications center, Spiritual Journal UI (+ `liturgy_attendance`), Servant attendance, Servants module, Assignments module (transfer UI with servant/class/year), Excel import (SheetJS, validation + preview), Settings group (profile/password/preferences; admin: church settings, roles mgmt, audit viewer), Events module. | Medium | — |

### P2 — Platform & polish
| Migr. | Content | Risk | Rollback |
|---|---|---|---|
| **031** `platform_surfaces.sql` | Platform analytics queries; subscription/billing tables if needed; system broadcast support. | Low | — |
| **032** `cleanup.sql` | Drop backup tables (`ministries_backup`, `user_stage_assignments_backup`, `attendance_backup`), `spiritual_records`, `notifications.old_metadata`, orphaned helpers (`user_has_permission`, `get_user_servant_id`, `get_user_assigned_beneficiary_ids`), duplicate journal unique index; rename stale `idx_event_registrations_child`/`trg_children_updated_at`; `followups.type` CHECK; relax session uniqueness. | Low — delete-only after reference audit | Manual restore from backup files |
| Frontend P2 | Platform dashboards, subscription/billing UI, system broadcast; UX primitives (`Table`, `Toast`, `Avatar`, `DropdownMenu`, `Tooltip`, `Pagination`, `Switch`); mobile bottom nav; regenerate `database.types.ts`; test coverage. | Low | — |

---

## 6. Implementation Order (smallest-risk first)

**Phase A — Fix (F1/F2 first, then F3/F4):**
1. F1 server-client RBAC fix (one-file + action audit) → re-verify all 35 actions.
2. F2 `(app)` layout + AppShell mount → navigation restored.
3. 026 migration + smoke matrix → RLS correct, PO provisioned.
4. 027 migration → promotion integrity.
5. Dashboard/i18n P0 fixes.

**Phase B — Role model:** 028 stage_leader + nav trees + per-role dashboards + scope enforcement.

**Phase C — Required features:** 029 automation, 030 reports SQL, then Reports → Notifications → Spiritual Journal → Servant attendance → Servants → Assignments → Import → Settings → Events (each: UI + actions + RLS check).

**Phase D — Platform + hardening:** 031 platform surfaces → 032 cleanup → 033 regen types → UX primitives → tests.

**Gate:** each phase ends with lint/tsc/build green, a DB smoke test per affected role, and Phase 3C regression (submit/approve/reject church + servant).

---

## Risk register (top)
1. **026 RLS narrowing locks out a legit flow** → per-table matrix + seeded role×action smoke test + rollback migration.
2. **Phase 3C regression** → only `CREATE OR REPLACE` on 023 RPCs (approve_servant guard), never structural; regression-test the 8 RPCs.
3. **PO bootstrap chicken-egg** → service_role-only `grant_platform_owner` RPC + documented first-PO bootstrap, not UI-dependent.
4. **F1 fix regression window** → all 35 actions re-audited; client guards untouched.
5. **uq_ba_current vs bad data** → dedupe (close all but latest) before index creation.
6. **Stage-scope parity between app and RLS** → single helper (`user_has_stage_write`) used by both action layer and policies.

---

*Awaiting approval. On approval: Phase A, step 1 (F1 fix), then step 2 (AppShell), then migration 026.*
