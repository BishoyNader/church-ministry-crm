# Registration RBAC Impact

**Phase:** 3C — Registration & Church Provisioning  
**Date:** 2026-07-31  
**Status:** Architecture / Specification

---

## 1. Role Model Compliance

The canonical hierarchy is unchanged and preserved:

```
platform_owner → super_admin → admin → servant
```

**There is NO `pending_user` role and none is introduced.** Pending users are represented by `servants.approval_status = 'pending'` plus the absence of `user_roles` rows — exactly as the canonical role model prescribes ("No system role — represented by `servants.approval_status = 'pending'`"). RBAC never grants them anything; their lack of access is structural (no role rows) rather than a special-cased negative role.

### Effective access function

```
effectiveAccess(user) =
    profile.is_active
  ∧ servant.approval_status = 'approved'
  ∧ EXISTS(active user_roles for user)
```

All three must hold. This is the invariant used by middleware, route guards, and the RLS helpers.

---

## 2. Permissions Involved

| Permission | Role | Where used in 3C |
|---|---|---|
| `servants.approve` | super_admin | Approve/reject queue actions (existing churches) |
| `servants.read` | super_admin, admin (scoped) | Queue list rendering |
| `users.read` / `users.update` | super_admin, admin (scoped) | Profile display / edits |
| `tenants.read` | platform_owner | Church-request queue page |
| `tenants.create` | platform_owner | Provisioning (inside `approve_church_request`) |
| `notifications.read` | super_admin, servant (own) | Notification center rendering |
| `reports.read` | super_admin, admin, servant (personal) | Dashboard gate (existing) |

No new permission codes are required. The canonical catalog's 52 codes already cover the flow. (See §3.2 for the frontend constant re-sync.)

---

## 3. RBAC Code Changes Required

### 3.1 Role assignment on approval

- On **approve**: `user_roles` insert with the church's `servant` role, `assigned_by = <approving super_admin>`, `start_date = CURRENT_DATE`. This is the single point where a pending user transitions to a servant.
- On **new-church provisioning**: `user_roles` insert with `super_admin` role, `assigned_by = <platform owner>`.

### 3.2 Fix stale frontend `PERMISSION_CODES`

`src/features/rbac/constants/permissions.ts` still references removed codes (`users.manage`, `users.create`, `children.*`, `churches.*`, `auth.*`). Consequences today:

- `assignRolesAction` / `assignStagesAction` gate on `users.manage`, which no longer exists in the DB → **always denied**.
- `PermissionGuard` on pages that pass removed codes never matches → wrong access behavior.

**Action:** replace the constants with the canonical 52 codes (from `CANONICAL_PERMISSION_CATALOG.md`), then re-audit every `PermissionGuard`/`hasPermission` call site. This is a pre-requisite, not an optional cleanup.

### 3.3 End `user_roles` history deletion

`user.service.ts` `assignRoles` performs `DELETE … FROM user_roles` before re-inserting. Canonical temporal model requires setting `end_date` instead. 3C introduces a helper (RPC or server action) that **archives** the old row (`end_date = CURRENT_DATE`) for reassignments and applies **reactivation-first** for re-approvals (A3): a grant whose `end_date IS NOT NULL` is reactivated (`end_date = NULL`) rather than duplicated, since the current non-partial `UNIQUE (church_id, user_id, role_id)` would otherwise block a fresh insert. As part of P0.2, that constraint is replaced by a **partial unique index** `ON user_roles (church_id, user_id, role_id) WHERE end_date IS NULL`, making the temporal model fully canonical. This removes the last in-app path that could silently "lose" a role grant (relevant to approval correctness).

### 3.4 No admin-path to `super_admin` or tenant ops

- `super_admin` role assignment stays platform-owner-only (canonical). The provisioning RPC is the only writer of the initial `super_admin` `user_roles` row.
- `churches` INSERT is removed from the signup path; only PO-gated provisioning writes churches.
- `roles`/`role_permissions` mutation stays behind `super_admin_all` RLS (church-scoped) and platform owner (global).

---

## 4. Security Findings & Controls

**Method:** every conclusion below is validated against the actual migrated schema (001–022). Two originally-claimed guarantees did **not** hold and are corrected here; full attack paths and remediation detail are in `PHASE_3C_SECURITY_REMEDIATION.md`.

### 4.0 Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| C-1 | **CRITICAL** | `user_roles.tenant_isolation` is `FOR ALL` with rule `church_id = get_user_church_id()` (migration 022; canonical RLS spec §2.19). Any authenticated user with a church profile — including a pending user — can `INSERT` a `user_roles` row for their own church, **self-assigning `super_admin`**. The prior conclusion ("pending user's self-write is impossible") was **incorrect**. | Remediated in spec (§4.1) |
| C-2 | **HIGH** | `servants.tenant_isolation` is `FOR ALL` (022). A pending user can `UPDATE` their own servant row to `approval_status='approved'` (self-approval) or mutate any other servant row in the same church. The RPC guard `auth.uid() <> p_servant_id` is bypassable via a direct client UPDATE. | Remediated in spec (§4.2) |
| C-3 | MEDIUM | `notifications.tenant_isolation` is `FOR ALL` — same-church users can insert notifications addressed to other recipients in their church (spoofing/phishing, not escalation). | Remediated in spec (§4.6) |

### 4.1 No privilege escalation path

| Control | Mechanism |
|---|---|
| Pending users have zero role rows | No `user_roles` → no permission resolution anywhere |
| Approval grants only base `servant` role | RPC inserts a fixed role resolved by `role_type='servant'`; cannot select `super_admin`/`admin` |
| Elevated role grant is PO-only | Provisioning RPC requires `user_is_platform_owner()` |
| **C-1 remediation — `user_roles.tenant_isolation` → SELECT-only** | Removes the ALL scope that permitted same-church INSERT/UPDATE/DELETE. No RLS policy grants role-row writes to non-super-admins; the only write paths are `super_admin_all` (same-church super_admin) and the SECURITY DEFINER RPCs (`approve_servant`, `approve_church_request`, temporal helper) / service-role admin client. A pending user therefore cannot self-assign any role. |
| Temporal re-grant | Re-approval reactivates archived rows (never `ON CONFLICT DO NOTHING`) and the UNIQUE constraint becomes partial (`WHERE end_date IS NULL`) — see `REGISTRATION_DATABASE_CHANGES.md` §6.3 (A3) |

### 4.2 No self-approval path

- **C-2 remediation — `servants.tenant_isolation` → SELECT-only.** The previous `FOR ALL` policy let a pending user `UPDATE` their own servant row (and any same-church servant row). With the policy SELECT-only, servant writes are limited to `super_admin_all` and the `approve_servant`/`reject_servant` RPCs (SECURITY DEFINER).
- RPCs additionally check `auth.uid() <> p_servant_id` (second layer).
- Structurally: a pending user has no `super_admin` role, so `user_is_super_admin(church_id)` is false for them (third layer).

### 4.3 No church-creation bypass

- Signup no longer inserts into `churches`.
- `churches` INSERT requires `platform_owner_all` (RLS) or the PO-gated provisioning RPC.
- `list_churches_for_signup()` is read-only, projection-limited.

### 4.4 No cross-church approval capability

- `approve_servant`/`reject_servant` check `user_is_super_admin(<servant's church>)`, which requires an active `super_admin` role in **that same** church.
- A super_admin of church A cannot act on a servant of church B.

### 4.5 No unauthorized role assignment

- Pending→servant transition: only the approve RPC (super_admin, own church).
- Initial super_admin: only the provisioning RPC (platform owner).
- Admin cannot assign roles at all: canonical `admin` permissions exclude any role-grant code, and `user_roles` RLS has no `admin` write policy (`admin_read` is SELECT-only; `tenant_isolation` is now SELECT-only after C-1 remediation — the only write policy left is `super_admin_all`).
- Rejection preserves the status transition and records the actor in `audit_logs`.

### 4.6 Notification write hardening (C-3)

- **`notifications.tenant_isolation` → SELECT-only (recommended).** Removes the same-church cross-recipient INSERT/UPDATE/DELETE scope. Own-row access is fully preserved by `recipient_scope` (`ALL`, `recipient_id = auth.uid()`) and `super_admin_read` (SELECT) is unchanged.
- **Notification creation flows through `send_notification` only** — a SECURITY DEFINER helper invoked by the RPCs/server actions; it is not exposed to clients. There is no other in-app write path for notifications.

### 4.7 Defense-in-depth summary

| Layer | Protection |
|---|---|
| RLS (89 existing policies + 3 remediated to SELECT-only + new `church_requests` policies) | Denies **role-gated** data to pending users (no role rows); closes the 3C write surfaces (`user_roles`, `servants`, `notifications`); church-scoped for church roles. **Caveat (A6):** 022 `tenant_isolation` FOR ALL on operational tables remains same-church accessible to pending users — accepted residual risk (§3.3 of `PHASE_3C_SECURITY_REMEDIATION.md`) |
| SECURITY DEFINER RPCs | Chokepoints for approval/provisioning/notification writes with explicit `auth.uid()` checks |
| Server actions | Input validation (zod) + `hasPermission` checks before calling services |
| Middleware / route guards | UX-level redirects; never the sole control |
| Audit log | Immutable record of every grant/approval/reject (RPCs + restored triggers) |

---

## 5. RLS Delta (from `REGISTRATION_DATABASE_CHANGES.md` §7)

1. `church_requests`: PO-all, applicant-own-read, public insert, **permissive-deny** immutable review/delete.
2. `churches`: no new public policy (RPC is the surface).
3. **`user_roles.tenant_isolation` → SELECT-only (C-1).** Reads unchanged (`tenant_isolation`, `own_read`, `admin_read`, `super_admin_all` SELECT paths all preserved); the ALL write scope is removed. Writes now flow only through `super_admin_all`, the SECURITY DEFINER RPCs, or the service-role admin client.
4. **`servants.tenant_isolation` → SELECT-only (C-2).** Own-row read for `/pending-approval` is preserved via the existing `admin_read` policy (`id = auth.uid() OR …`).
5. **`notifications.tenant_isolation` → SELECT-only (C-3).** Own-row access preserved via `recipient_scope` (ALL, `recipient_id = auth.uid()`); `super_admin_read` unchanged. All notification inserts flow through `send_notification` (SECURITY DEFINER).
6. `notifications.church_id`: nullable — policies already compatible (own-row read via `recipient_scope`).
7. `profiles.own_profile_insert`: tighten `WITH CHECK` to require a real active church.
8. **Accepted residual risk (A6):** pending users keep the pre-existing church-scoped operational access granted by 022's `tenant_isolation` FOR ALL policies (services, stages, classes, beneficiaries, attendance, followups, events, documents, roles, …). 3C does **not** role-gate these tables. The RLS delta guarantee is: **role-gated** surfaces return 0 rows for pending users, and the three closed write surfaces (`user_roles`, `servants`, `notifications`) are denied. See `PHASE_3C_SECURITY_REMEDIATION.md` §3.3.

---

## 6. Canonical Compliance Review (RBAC dimension)

| Canonical requirement | 3C compliance |
|---|---|
| `platform_owner → super_admin → admin → servant` | ✅ Preserved |
| No `pending_user` role | ✅ Represented via `servants.approval_status` |
| Platform owner has no church / no servant record | ✅ Preserved (PO role row exists only at system level) |
| Super admin has servant record | ✅ New-church applicant gets a servant row at provisioning |
| Super admin promotes/demotes only within scope | ✅ Church-scoped RPCs |
| Only platform owner assigns/creates super_admin | ✅ Provisioning RPC is PO-only |
| Pending users have no permissions | ✅ No role rows |
| Rejected users can re-register | ✅ Retained account, no access, re-registration supported |
| Approval is audited | ✅ Compliant (`audit_logs`, RPCs + restored triggers) |

---

## 7. Residual Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Stale frontend permission constants mis-gate UI during migration | High | Re-sync constants + call-site audit before UI work (§3.2) |
| Audit triggers absent since 019 CASCADE — **silent** audit gap on children/followups/profiles/user_roles | High | Recreate `audit_trigger_fn` (actor_id, TEXT) + all dependent triggers in the 3C batch (A4 / P0.3) |
| `assignRoles` delete behavior masks a role grant; re-grant edge under non-partial UNIQUE | Medium | End-date archival + reactivation-first re-approval + partial unique index on active grants (§3.3, A3) |
| Public `church_requests` insert spam | Low | Rate limiting (deployment), email dedupe index, PO manual review |
| Pending users retain same-church operational access (022 `tenant_isolation` FOR ALL, incl. role-row deletion) | Medium | **Accepted and documented (A6)** — role-gated surfaces and the three 3C write surfaces remain closed; revisit in a dedicated RLS role-gating pass |
| Residual: same-church SELECT of roles/role-grants remains read-only | Info | Consistent with canonical RLS spec §2.18/§2.19; read exposure only |
