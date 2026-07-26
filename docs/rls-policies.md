# Church Ministry CRM — RLS Policies Reference

## Overview

Row Level Security (RLS) is the primary enforcement layer for tenant isolation and authorization. Every tenant-scoped table has RLS enabled. Policies are evaluated on every query using helper functions that read the authenticated user's profile, roles, permissions, and stage assignments.

---

## Helper Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `get_user_church_id()` | uuid | Current user's church_id from profiles |
| `get_user_role_types()` | user_role_type[] | All role types assigned to current user |
| `user_has_role(role)` | boolean | Check for specific role |
| `user_has_any_role(roles[])` | boolean | Check for any role in array |
| `user_has_permission(code)` | boolean | Check permission via role_permissions join |
| `user_has_stage_access(stage_id)` | boolean | Admin OR assigned to stage |
| `user_is_church_admin_or_above()` | boolean | super_admin OR church_admin |

All helpers are `SECURITY DEFINER` and `STABLE` for performance within a single query.

---

## Policy Matrix — Phase 1 Tables

### churches

| Operation | Who Can Access |
|-----------|----------------|
| SELECT | Users where `church_id` matches |
| INSERT | Any authenticated user (signup flow) |
| UPDATE | Church Admin or Super Admin |

### ministries / stages

| Operation | Who Can Access |
|-----------|----------------|
| SELECT | All users in church (non-deleted) |
| INSERT | Users with `stages.create` permission |
| UPDATE | Users with `stages.update` permission |
| DELETE | Users with `stages.delete` permission |

### profiles

| Operation | Who Can Access |
|-----------|----------------|
| SELECT | All users in church (non-deleted) |
| INSERT | Users with `users.create` permission |
| UPDATE (self) | Own profile |
| UPDATE (admin) | Users with `users.update` permission |
| DELETE | Users with `users.delete` (cannot delete self) |

### roles / role_permissions / user_roles / user_stage_assignments

| Operation | Who Can Access |
|-----------|----------------|
| SELECT | All users in church |
| INSERT | Church Admin+ or `users.manage` permission |
| UPDATE | Church Admin+ (non-system roles only) |
| DELETE | Church Admin+ (non-system roles only) |

### children

| Operation | Who Can Access |
|-----------|----------------|
| SELECT | Church Admin+ OR assigned to child's stage |
| INSERT | `children.create` + stage access |
| UPDATE | `children.update` + stage access |
| DELETE | `children.delete` + Church Admin+ |

### attendance

| Operation | Who Can Access |
|-----------|----------------|
| SELECT | Church Admin+ OR assigned to stage |
| INSERT | `attendance.create` + stage access |
| UPDATE | `attendance.update` + stage access |
| DELETE | `attendance.delete` + Church Admin+ |

### audit_logs

| Operation | Who Can Access |
|-----------|----------------|
| SELECT | Users with `audit.read` permission |
| INSERT | Any authenticated user (via triggers/functions) |

---

## Stage Scoping Logic

Stage Leaders, Servants, and Viewers are restricted to stages listed in `user_stage_assignments`. The access check:

```sql
user_is_church_admin_or_above()
OR EXISTS (
  SELECT 1 FROM user_stage_assignments
  WHERE user_id = auth.uid() AND stage_id = target_stage_id
)
```

Church Admin and Super Admin bypass stage scoping for all operations.

---

## Role → Permission Mapping

### Super Admin
All permissions including `churches.*`.

### Church Admin
All permissions except `churches.*` (platform-level).

### Stage Leader
```
children.read, children.create, children.update
attendance.read, attendance.create, attendance.update
followups.read, followups.create, followups.update
stages.read, users.read
events.read, events.create, events.update
reports.read, reports.export
documents.read, documents.create
```

### Servant
```
children.read, children.update
attendance.read, attendance.create, attendance.update
followups.read, followups.create
stages.read, events.read
documents.read
```

### Viewer
All `*.read` permissions only.

---

## Storage Bucket Policies

Apply via Supabase Dashboard or storage migration:

### child-photos
- **Path:** `{church_id}/children/{child_id}/{filename}`
- **SELECT:** authenticated + `documents.read` + path church_id matches
- **INSERT:** authenticated + `documents.create` + path church_id matches
- **DELETE:** authenticated + `documents.delete` + Church Admin+

### documents
- **Path:** `{church_id}/{entity_type}/{entity_id}/{filename}`
- Same policies as child-photos

### church-assets
- **Path:** `{church_id}/{filename}`
- **SELECT:** all authenticated users in church
- **INSERT/UPDATE/DELETE:** Church Admin+ only

---

## Security Notes

1. **No service role on client** — Service role key used only in Server Actions for signup bootstrap
2. **RLS is authoritative** — Frontend permission checks are UX-only
3. **Audit triggers** — Fire on INSERT/UPDATE/DELETE for children, attendance, profiles, user_roles
4. **Soft deletes** — SELECT policies filter `deleted_at IS NULL`
5. **Cross-tenant impossible** — Every policy includes `church_id = get_user_church_id()`

---

## Testing RLS

Verify policies with Supabase SQL editor using `SET request.jwt.claims`:

```sql
-- Simulate authenticated user
SET request.jwt.claim.sub = 'user-uuid-here';

-- Should only return own church data
SELECT * FROM children;

-- Should fail for other church
SELECT * FROM children WHERE church_id = 'other-church-uuid';
```

Or use Supabase client with different user sessions in integration tests.

---

## Migration Files

| File | Contents |
|------|----------|
| `001_initial_schema.sql` | Tables, enums, indexes, helper functions, audit triggers |
| `002_rls_policies.sql` | All RLS policies for every table |
| `003_seed_permissions.sql` | Global permission catalog |

Apply in order via `supabase db push` or Supabase Dashboard SQL editor.
