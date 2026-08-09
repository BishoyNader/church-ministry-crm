# Permission Matrix — Church Ministry CRM

**Source of truth:** migrations `021_role_and_permissions.sql`, `026_platform_owner_bootstrap.sql`, `028_security_remediation.sql`, `036_role_matrix_stage_manager.sql` (Sprint 2 correction).

**Roles:** `platform_owner` (global, `church_id = NULL`) · `super_admin` · `admin` · `stage_manager` (added in 036) · `servant`.

Legend: ✓ granted · – not granted

| Permission code | PO | Super Admin | Admin | Stage Mgr | Servant |
|---|---|---|---|---|---|
| `beneficiaries.read` | – | ✓ | ✓ | ✓ | ✓ |
| `beneficiaries.create` | – | ✓ | ✓ | ✓ | – |
| `beneficiaries.update` | – | ✓ | ✓ | ✓ | ✓ |
| `beneficiaries.delete` | – | ✓ | – | – | – |
| `beneficiaries.transfer` | – | ✓ | ✓ | – | – |
| `attendance.read` | – | ✓ | ✓ | ✓ | ✓ |
| `attendance.create` | – | ✓ | ✓¹ | ✓ | ✓ |
| `attendance.export` | – | ✓ | ✓ | ✓ | – |
| `followups.read` | – | ✓ | ✓ | ✓ | ✓ |
| `followups.create` | – | ✓ | ✓¹ | ✓ | ✓ |
| `followups.update` | – | ✓ | ✓¹ | ✓ | ✓ |
| `followups.delete` | – | ✓ | ✓¹ | ✓ | ✓ |
| `servants.read` | – | ✓ | ✓ | ✓ | – |
| `servants.create` | – | ✓ | ✓¹ | – | – |
| `servants.update` | – | ✓ | ✓ | – | – |
| `servants.delete` | – | ✓ | – | – | – |
| `servants.approve` | – | ✓ | – | – | – |
| `servants.assign` | – | ✓ | ✓ | – | – |
| `services.read` | – | ✓ | ✓ | ✓ | ✓ |
| `services.create` | – | ✓ | – | – | – |
| `services.update` | – | ✓ | ✓¹ | – | – |
| `services.delete` | – | ✓ | ✓¹ | – | – |
| `classes.read` | – | ✓ | ✓ | ✓ | ✓ |
| `classes.create` | – | ✓ | ✓ | – | – |
| `classes.update` | – | ✓ | ✓ | – | – |
| `classes.delete` | – | ✓ | ✓¹ | – | – |
| `stages.read` | – | ✓ | ✓ | ✓ | ✓ |
| `stages.create` | – | ✓ | ✓ | – | – |
| `stages.update` | – | ✓ | ✓ | – | – |
| `stages.delete` | – | ✓ | – | – | – |
| `spiritual.read` | – | ✓ | – | – | ✓ |
| `spiritual.create` | – | ✓ | – | – | ✓ |
| `tenants.read` | ✓ | – | – | – | – |
| `tenants.create` | ✓ | – | – | – | – |
| `tenants.update` | ✓ | – | – | – | – |
| `tenants.delete` | ✓ | – | – | – | – |
| `users.read` | ✓ | ✓ | ✓ | – | – |
| `users.update` | – | ✓ | ✓ | – | – |
| `notifications.read` | ✓ | ✓ | ✓¹ | ✓ | ✓ |
| `notifications.manage` | – | ✓ | – | – | – |
| `reports.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `reports.export` | ✓ | ✓ | ✓ | – | – |
| `import.execute` | – | ✓ | ✓ | – | – |
| `export.execute` | – | ✓ | ✓ | – | – |
| `audit.read` | ✓ | ✓ | – | – | – |
| `settings.read` | – | ✓ | ✓¹ | – | – |
| `settings.update` | – | ✓ | ✓¹ | – | – |
| `billing.read` | ✓ | – | – | – | – |
| `subscriptions.manage` | ✓ | – | – | – | – |
| `support.manage` | ✓ | – | – | – | – |
| `system.audit` | ✓ | – | – | – | – |
| `system.metrics` | ✓ | – | – | – | – |

¹ Added by migration **036** — the Sprint 2 permission-matrix correction. Before 036, the `admin` role lacked `attendance.create`, follow-up CRUD, `notifications.read`, `settings.*`, `services.update/delete`, `classes.delete`, and `servants.create`, while `servant` had some of these — an inversion that blocked Admins from core ministry work.

## Notes

1. **Platform Owner** holds only the platform bundle (`tenants.*`, `system.*`, `billing.*`, `users.read`, `reports.*`, `audit.read`, `notifications.read`) and — by design — **no church-data permissions** (`beneficiaries.*`, `attendance.*`, `followups.*`, `services.*`, `classes.*`, `stages.*`, `spiritual.*`). Tenant isolation policies exclude the PO (church_id NULL).
2. **Stage Manager** (036) is a stage-scoped operator: beneficiaries, attendance, follow-ups, and read-only access to services/stages/classes/servants + notifications + reports. Stage-level RLS (via `servant_stage_assignments` + `user_has_stage_access`) is the enforcement boundary — a stage manager without stage assignments sees nothing.
3. **Super Admin** receives every non-platform permission (`module NOT IN ('tenants','system')`), excluding billing/subscriptions/system codes.
4. **Privilege-escalation audit (Sprint 2):** no role grants a permission outside its hierarchy; `servants.approve` is super-admin-only; `stages.delete` and `beneficiaries.delete` are super-admin-only; no self-promotion paths exist (`create_church_user`, `assignRoles`, and `bootstrap_platform_owner` are guarded by super-admin checks / service-role-only EXECUTE).
5. **Dead codes:** `tenants.delete` is seeded but no UI/action consumes it today (PO UI uses update + status toggles). Kept in the catalog for the platform contract; flagged in the tech-debt backlog.
