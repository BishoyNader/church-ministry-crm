# Phase 3C — Specification Change Log

**Phase:** 3C — Registration & Church Provisioning
**Date:** 2026-07-31
**Purpose:** Controlled specification amendment following Phase 3C.1 architecture validation (blocking security findings C-1/C-2/C-3 and corrections A1–A4).
**Scope:** Documentation only — no code, no migrations, no application logic.

---

## 1. REGISTRATION_DATABASE_CHANGES.md

### 1.1 §4.4 `approve_servant` role lookup — **A1 (invalid schema reference removed)**

| | |
|---|---|
| **Old behavior** | `role := (SELECT id FROM roles WHERE church_id=church_id AND role_type='servant' AND deleted_at IS NULL)` |
| **New behavior** | `role := (SELECT id FROM roles WHERE church_id = p_church_id AND role_type = 'servant')` with a note that `roles` has no `deleted_at` column and `UNIQUE(church_id, role_type)` guarantees a single servant role per church |
| **Reason** | The `roles` table (migration 001) has no `deleted_at` column; the filter would fail at runtime. Uniqueness is already guaranteed by the `UNIQUE (church_id, role_type)` constraint. |

### 1.2 §4.4 `approve_servant` role grant — **A3 (temporal re-grant)**

| | |
|---|---|
| **Old behavior** | Single `INSERT … ON CONFLICT DO NOTHING` |
| **New behavior** | Reactivation-first: `UPDATE user_roles SET end_date = NULL WHERE church_id/…/end_date IS NOT NULL`; insert only if no row was reactivated. Explicitly no `ON CONFLICT DO NOTHING`. |
| **Reason** | Under the non-partial `UNIQUE (church_id, user_id, role_id)`, `ON CONFLICT DO NOTHING` silently no-ops on re-approval after demotion, leaving an approved servant with no active role. |

### 1.3 §6.3 `user_roles` write discipline — **A3 (chosen strategy documented)**

| | |
|---|---|
| **Old behavior** | "No DDL" + generic "insert new rows / set end_date" guidance |
| **New behavior** | Documents **reactivation-first** as the chosen re-approval strategy (rationale: non-partial UNIQUE blocks archive-and-insert) and specifies supporting DDL: replace the UNIQUE constraint with partial unique index `ON user_roles (church_id, user_id, role_id) WHERE end_date IS NULL` (P0.2 batch) |
| **Reason** | Approval criteria require the temporal re-grant behavior to be explicitly specified; the DDL makes the temporal model fully canonical. |

### 1.4 §7 `church_requests` immutable policies — **A2 (permissive deny)**

| | |
|---|---|
| **Old behavior** | `immutable_review` UPDATE `**DENY** (USING false)`; `immutable_delete` DELETE `**DENY** (USING false)` |
| **New behavior** | `immutable_review` `USING (false) WITH CHECK (false)`; `immutable_delete` `USING (false)`; both explicitly marked **PERMISSIVE deny — NOT `AS RESTRICTIVE`**; added policy-semantics note that permissive OR keeps `platform_owner_all` functional |
| **Reason** | A `RESTRICTIVE` deny is ANDed and would block the platform owner's own UPDATE via `platform_owner_all`, locking the review queue. `WITH CHECK (false)` also rejects spoofed new-row values. |

### 1.5 §8 audit-logging reminder — **A4 (audit subsystem correction)**

| | |
|---|---|
| **Old behavior** | One-sentence reminder: "re-verify the `audit_trigger_fn` breakage … these triggers may currently fail and roll back DML" |
| **New behavior** | Full §8.1 "Audit subsystem restoration (A4)": root cause (`DROP TYPE audit_action CASCADE` in 019 drops the function + 5 triggers → **silent audit gap**, not rollback); restoration plan (recreate function with `actor_id` + TEXT action; recreate 7 triggers incl. `attendance_sessions`, `attendance_records`, `beneficiaries`; drop dead `audit_attendance` on `attendance_backup_20260730`); verification SQL |
| **Reason** | The prior characterization was incorrect: the function/triggers were dropped by CASCADE, so DML succeeds silently without audit rows. Restoration must be fully specified for the audit criterion to pass. |

### 1.6 §10 Estimated Migration Surface — **C-1/C-2/C-3 + A4 + A3 (expanded scope)**

| | |
|---|---|
| **Old behavior** | 6 items: new table, nullable column, 7 RPCs, `church_requests` policies, `profiles.own_profile_insert`, types regen |
| **New behavior** | 9 items, adding: policy replacements (`user_roles`/`servants`/`notifications` `tenant_isolation` → SELECT-only), audit restoration (function + 7 triggers + drop dead trigger), partial unique index on `user_roles`. Notes: **no other existing policy is modified**; rollback path updated |
| **Reason** | Approval criteria require self-escalation, self-approval, and notification-bypass closures plus audit restoration to be part of the migration batch. |

---

## 2. REGISTRATION_RBAC_IMPACT.md

### 2.1 §4 restructure — **C-1/C-2/C-3 findings introduced**

| | |
|---|---|
| **Old behavior** | §4 "Security Controls Matrix" asserted guarantees as conclusions (e.g., "pending user's self-write is impossible") |
| **New behavior** | §4 "Security Findings & Controls" leads with a findings table (C-1 CRITICAL, C-2 HIGH, C-3 MEDIUM), each with severity, evidence, and remediation status; prior incorrect conclusions explicitly marked as **incorrect** |
| **Reason** | Replace previous conclusions with actual schema findings, per Phase 3C.1 validation. |

### 2.2 §4.1 No privilege escalation path — **C-1 correction**

| | |
|---|---|
| **Old behavior** | `user_roles` RLS row: "Writes gated by `super_admin_all` … pending user's self-write is impossible (no policy grants INSERT to them)" |
| **New behavior** | Row replaced by "**C-1 remediation — `user_roles.tenant_isolation` → SELECT-only**" removing ALL write scope; only write paths are `super_admin_all`, SECURITY DEFINER RPCs, or service-role admin client. Added temporal re-grant control row |
| **Reason** | The old claim was false: `tenant_isolation FOR ALL` grants same-church INSERT. |

### 2.3 §4.2 No self-approval path — **C-2 correction**

| | |
|---|---|
| **Old behavior** | "RPCs check `auth.uid() <> p_servant_id`; Structurally impossible anyway…" |
| **New behavior** | Three layers: (1) `servants.tenant_isolation` → SELECT-only; (2) RPC `auth.uid() <> p_servant_id`; (3) structural (no super_admin role). C-2 explicitly flagged HIGH |
| **Reason** | A pending user could previously UPDATE their own servant row (and others' in the same church) via the FOR ALL policy, bypassing the RPC guard. |

### 2.4 §4.5 Unauthorized role assignment — **clarified**

| | |
|---|---|
| **Old behavior** | "`user_roles` RLS has no `admin` write policy (only `super_admin_all` write; `admin_read` is SELECT-only)" |
| **New behavior** | Adds "`tenant_isolation` is now SELECT-only after C-1 remediation — the only write policy left is `super_admin_all`" |
| **Reason** | Consistency with the C-1 policy change. |

### 2.5 §4.6 / §4.7 — **notification hardening + defense-in-depth**

| | |
|---|---|
| **Old behavior** | §4.6 was "Defense-in-depth summary" |
| **New behavior** | New §4.6 "Notification write hardening (C-3)": `notifications.tenant_isolation` → SELECT-only; all notification creation flows through `send_notification` (SECURITY DEFINER), not exposed to clients. Former §4.6 renumbered to §4.7 with RLS-layer description updated |
| **Reason** | Notification write bypass must be closed or explicitly documented per approval criteria. |

### 2.6 §3.3 End `user_roles` history deletion — **A3 alignment**

| | |
|---|---|
| **Old behavior** | "closes the old row (`end_date = CURRENT_DATE`) and inserts the new one" |
| **New behavior** | Distinguishes archive-and-insert (reassignment) vs **reactivation-first** (re-approval); documents partial unique index `WHERE end_date IS NULL` replacing the UNIQUE constraint |
| **Reason** | Consistency with the chosen A3 strategy. |

### 2.7 §5 RLS Delta — **expanded**

| | |
|---|---|
| **Old behavior** | 5 items; `servants`: "no change"; no `user_roles`/`notifications` policy items |
| **New behavior** | 7 items adding `user_roles`, `servants`, `notifications` `tenant_isolation` → SELECT-only replacements with read-path preservation notes |
| **Reason** | The three policy replacements are now first-class migration items. |

### 2.8 §6 Compliance table — **updated**

| | |
|---|---|
| **Old behavior** | "Approval is audited | ✅ `audit_logs` rows for approve/reject with actor + old/new state" |
| **New behavior** | "Approval is audited | ✅ Compliant (`audit_logs`, RPCs + restored triggers)" |
| **Reason** | Reflects the audit restoration (A4) as a required component. |

### 2.9 §7 Residual Risks — **corrected**

| | |
|---|---|
| **Old behavior** | "`audit_trigger_fn` column drift could roll back DML" (High); assignRoles delete (Medium) |
| **New behavior** | "Audit triggers absent since 019 CASCADE — silent audit gap" (High); A3 re-grant edge (Medium); added read-only residual-risk note |
| **Reason** | Correct characterization of the audit gap; incorporate A3 handling. |

---

## 3. PHASE_3C_IMPLEMENTATION_PLAN.md (consistency)

### 3.1 P0.2 / P0.3 rows

| | |
|---|---|
| **Old behavior** | 0.2: "Replace `assignRoles` DELETE with `end_date` archival"; 0.3: "Verify `audit_trigger_fn` against `actor_id` rename … recreate if broken" |
| **New behavior** | 0.2: adds reactivation-first re-approval + partial unique index (A3); 0.3: "Recreate `audit_trigger_fn` (actor_id, TEXT) + all dependent audit triggers; verify with smoke SQL (A4)" |
| **Reason** | Keep plan aligned with the amended spec. |

### 3.2 Phase 3C.1 table — **expanded & renumbered (1.1–1.14)**

| | |
|---|---|
| **Old behavior** | 1.1–1.11 (no policy replacements, no audit restoration, no index change) |
| **New behavior** | 1.11 policy replacements (C-1/C-2/C-3), 1.12 audit restoration (A4), 1.13 partial unique index (A3); verification line now references the remediation regression matrix R-1…R-15 |
| **Reason** | Migration surface must include the remediation items. |

### 3.3 §3 Database Impact Summary / §4 Security Review / §6 Risks / §8 Verdict

| | |
|---|---|
| **Old behavior** | Impact summary listed only additive changes; findings table called the audit issue "references renamed column"; verdict "APPROVED_FOR_IMPLEMENTATION" with 4 conditions |
| **New behavior** | Impact summary adds 4 replacement/recreation rows; findings table adds C-1/C-2/C-3; risk 1 reworded to silent audit gap; verdict points to `IMPLEMENTATION_READINESS_VERDICT.md` and adds condition 5 (policy replacements in the batch) |
| **Reason** | Consistency across the spec set; single authoritative readiness gate. |

---

## 4. New Documents

| File | Contents |
|---|---|
| `PHASE_3C_SECURITY_REMEDIATION.md` | Executive summary; findings C-1/C-2/C-3 with attack-path SQL; required policy changes + resulting write paths + invariant; audit-trigger restoration plan (function SQL + trigger list + verification SQL); 15-row regression test matrix; final security posture + accepted residual risks |
| `IMPLEMENTATION_READINESS_VERDICT.md` | Approval-criteria checklist (6 items) mapped to the amended spec; verdict decision |

---

## 5. Change Summary by Category

| Category | Files affected |
|---|---|
| A1 invalid schema reference | REGISTRATION_DATABASE_CHANGES.md |
| A2 permissive deny | REGISTRATION_DATABASE_CHANGES.md |
| A3 temporal re-grant | REGISTRATION_DATABASE_CHANGES.md, REGISTRATION_RBAC_IMPACT.md, PHASE_3C_IMPLEMENTATION_PLAN.md |
| A4 audit restoration | REGISTRATION_DATABASE_CHANGES.md, REGISTRATION_RBAC_IMPACT.md, PHASE_3C_IMPLEMENTATION_PLAN.md |
| C-1 user_roles escalation | REGISTRATION_RBAC_IMPACT.md, PHASE_3C_IMPLEMENTATION_PLAN.md, PHASE_3C_SECURITY_REMEDIATION.md |
| C-2 servants self-approval | REGISTRATION_RBAC_IMPACT.md, PHASE_3C_IMPLEMENTATION_PLAN.md, PHASE_3C_SECURITY_REMEDIATION.md |
| C-3 notification bypass | REGISTRATION_RBAC_IMPACT.md, PHASE_3C_IMPLEMENTATION_PLAN.md, PHASE_3C_SECURITY_REMEDIATION.md |
| Migration surface expansion | REGISTRATION_DATABASE_CHANGES.md, PHASE_3C_IMPLEMENTATION_PLAN.md |

---

## 6. Phase 3C.2 gate amendments (A5–A10)

Source: `PHASE_3C_DATABASE_IMPLEMENTATION_GATE.md` (Phase 3C.2 pre-implementation audit of migrations 001–022; verdict `REQUIRES_SPEC_UPDATE` → re-gate `APPROVED_FOR_MIGRATION_GENERATION`).

| Amendment | Change | Files affected |
|---|---|---|
| **A5** (M-2) | Removed invalid `audit_children → children` reference (013 renamed `children` → `beneficiaries`); trigger set 7 → 6; smoke test uses `entity_type='beneficiaries'`; legacy rows pre-013 keep `entity_type='children'` | REGISTRATION_DATABASE_CHANGES.md §8.1/§10, PHASE_3C_SECURITY_REMEDIATION.md §4/R-14, PHASE_3C_IMPLEMENTATION_PLAN.md 1.12/§3, IMPLEMENTATION_READINESS_VERDICT.md crit. 4 |
| **A6** (M-1) | **Accept-and-document** pending-user residual risk: 022 `tenant_isolation` FOR ALL on ~18 operational tables is church-scoped, not role-gated → pending users retain same-church operational read/DML (incl. role-row deletion). All "zero access / zero-trust" claims corrected; R-8 rewritten to role-gated surfaces (new R-8A asserts closed write surfaces); new §3.3 documents the decision | PHASE_3C_SECURITY_REMEDIATION.md §3.2/§3.3/R-8/R-8A/§6, REGISTRATION_RBAC_IMPACT.md §4.7/§5/§7, REGISTRATION_WORKFLOW_SPEC.md §3.2/§3.3, PHASE_3C_IMPLEMENTATION_PLAN.md §5/§8 |
| **A7** (M-3) | Write-path invariant reworded: SECURITY DEFINER RPCs **or service-role admin client** (signup-time `profiles`/`servants` creation); approval transitions remain RPC-only | PHASE_3C_SECURITY_REMEDIATION.md §3.2 |
| **A8** | RPC count normalized: 8 functions = 7 client-facing + `send_notification` helper | REGISTRATION_DATABASE_CHANGES.md §4, PHASE_3C_IMPLEMENTATION_PLAN.md §1/§3 |
| **A9** | Pre-migration verification for `notifications.old_metadata` (018 leftover, undocumented); stale `database.types.ts` (021-dropped functions) | REGISTRATION_DATABASE_CHANGES.md §6.1, PHASE_3C_IMPLEMENTATION_PLAN.md 1.14 |
| **A10** | Explicit decision: **retain** `idx_user_roles_user_active`; constraint drop name `user_roles_church_id_user_id_role_id_key` | REGISTRATION_DATABASE_CHANGES.md §6.3/§9, PHASE_3C_IMPLEMENTATION_PLAN.md §3 |

### 6.1 New documents (Phase 3C.2 audit)

| File | Contents |
|---|---|
| `PHASE_3C_DATABASE_AUDIT_REPORT.md` | Impact audit of the 8 target tables; RLS dependency audit; audit-subsystem verification (silent gap); notification architecture audit; role-assignment audit; findings M-1/M-2/M-3, N-1…N-9 |
| `PHASE_3C_DEPENDENCY_GRAPH.md` | Full RLS function graph (13 functions; 8 ACTIVE/3 ORPHANED/2 INERT); modification blast radius; 3C dependency rules |
| `PHASE_3C_MIGRATION_COLLISION_REPORT.md` | Collision check of all planned objects vs 001–022 (no collisions; M-2 invalid reference; ordering + exact-name requirements) |
| `PHASE_3C_DATABASE_IMPLEMENTATION_GATE.md` | Gate record: verdict `REQUIRES_SPEC_UPDATE` → amendments A5–A10 → re-gate **`APPROVED_FOR_MIGRATION_GENERATION`** |
