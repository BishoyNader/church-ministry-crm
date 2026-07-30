# QA Test Plan — Church Ministry Platform

**Version:** 1.0  
**Scope:** MVP Phases 1–13  
**Strategy:** Automated (unit + integration + E2E) + Manual exploratory  

---

## 1. Testing Stack

| Layer | Tool | Scope |
|-------|------|-------|
| Unit (services, utils) | Vitest | Server Actions, service functions, validations |
| Integration (DB queries) | Vitest + Supabase local | RLS policies, DB functions, migrations |
| Component (React) | Vitest + Testing Library | Components, hooks, forms |
| E2E (critical paths) | Playwright | Auth flows, servant CRUD, attendance recording |
| Performance | Lighthouse CI | Dashboard, list pages |
| Accessibility | axe-core (via Playwright) | All pages WCAG AA |

---

## 2. Unit Tests (Vitest)

### 2.1 Service Layer

| Suite | Tests | Priority |
|-------|-------|----------|
| **RBAC service** | | |
| | `hasPermission` returns true for valid permission | P0 |
| | `hasPermission` returns false for missing permission | P0 |
| | `hasAnyPermission` returns true if any match | P0 |
| | `hasAllPermissions` returns false if any missing | P0 |
| | `getUserStageAssignments` returns only active assignments | P0 |
| | `getAccessibleStageIds` respects role filter | P1 |
| | Cached results per request (no duplicate DB calls) | P1 |
| **Auth service** | | |
| | `loginAction` fails with invalid credentials | P0 |
| | `loginAction` fails for inactive account | P0 |
| | `signupAction` creates church + auth user + profile + roles | P0 |
| | `signupAction` rolls back on failure | P0 |
| | `logoutAction` clears session | P0 |
| **Notification service** | | |
| | `createNotification` creates row | P0 |
| | `createNotification` debounces identical within 24h | P1 |
| **Import service** | | |
| | `parseImportFile` returns valid rows and error rows | P1 |
| | `parseImportFile` rejects invalid email | P1 |
| | `parseImportFile` rejects missing required fields | P1 |
| | `generateTemplate` produces valid xlsx with headers | P2 |

### 2.2 Form Validation

| Suite | Tests | Priority |
|-------|-------|----------|
| **Servant schema** | | |
| | Validates required fields | P0 |
| | Rejects invalid email | P0 |
| | Rejects invalid phone format | P1 |
| | Accepts Arabic-only name (no English required) | P0 |
| **Beneficiary schema** | | |
| | Validates required fields | P0 |
| | Rejects negative age (future DOB) | P1 |
| | Accepts at least one contact phone | P0 |
| **Stage schema** | | |
| | Validates age_min < age_max | P1 |
| | Accepts null age range (no restriction) | P1 |

### 2.3 Utility Functions

| Suite | Tests | Priority |
|-------|-------|----------|
| | Format phone number to international | P1 |
| | Calculate age from DOB | P1 |
| | Generate slug from church name | P1 |
| | RTL-aware text truncation | P2 |

---

## 3. Integration Tests (Vitest + Supabase Local)

### 3.1 Migration Tests

| Test | Priority |
|------|----------|
| All migrations run without error | P0 |
| All tables have RLS enabled | P0 |
| All tables have church_id column | P0 |
| All unique constraints are created | P0 |
| All foreign key constraints are created | P0 |
| Seed data creates default roles and permissions | P0 |
| Seed data assigns all permissions to super_admin | P0 |

### 3.2 RLS Tests

| Scenario | SQL | Expected | Priority |
|----------|-----|----------|----------|
| Servant sees own spiritual journal only | `SELECT * FROM spiritual_journal_entries` | Own rows only | P0 |
| Priest sees all spiritual journal entries | `SELECT * FROM spiritual_journal_entries` | All rows in church | P0 |
| Unauthenticated sees nothing | `SELECT * FROM profiles` | Empty | P0 |
| Servant from Church A cannot see Church B data | `SELECT * FROM profiles` | Own church only | P0 |
| Servant cannot soft-delete another servant | `UPDATE profiles SET deleted_at = now() WHERE id = ?` | Permission denied | P0 |
| Priest can soft-delete any servant | Same query | Succeeds | P1 |
| Servant can see own attendance records | `SELECT * FROM attendance_records` | Scoped to own | P0 |

### 3.3 DB Function Tests

| Function | Test | Priority |
|----------|------|----------|
| `get_consecutive_absent_beneficiaries()` | Returns correct beneficiaries with 3+ absences | P0 |
| `get_consecutive_absent_beneficiaries()` | Returns empty when no absences | P0 |
| `seed_church_roles()` | Creates roles and permissions for new church | P0 |

---

## 4. Component Tests (Vitest + Testing Library)

### 4.1 Shared Components

| Component | Tests | Priority |
|-----------|-------|----------|
| **DataTable** | | |
| | Renders rows from data prop | P0 |
| | Sorts columns on header click | P0 |
| | Paginates correctly | P0 |
| | Shows empty state when no data | P0 |
| | Shows loading skeleton when loading | P0 |
| | Renders in RTL (headers right-aligned) | P1 |
| **PermissionGuard** | | |
| | Renders children when user has permission | P0 |
| | Renders null when user lacks permission | P0 |
| | Renders fallback when provided and no permission | P1 |
| **FormField** | | |
| | Renders label, input, and error message | P0 |
| | Shows required indicator | P0 |
| | Associates label with input via htmlFor | P0 |
| **ConfirmDialog** | | |
| | Renders title and message | P0 |
| | Calls onConfirm on confirm click | P0 |
| | Calls onCancel on cancel click | P0 |
| | Closes on backdrop click | P1 |
| **Toast** | | |
| | Renders with correct variant styling | P0 |
| | Auto-dismisses after timeout | P1 |
| | Stacks multiple toasts | P1 |

### 4.2 Form Components

| Component | Tests | Priority |
|-----------|-------|----------|
| **ServantForm** | | |
| | Renders all fields | P0 |
| | Pre-fills values on edit mode | P0 |
| | Shows validation errors on submit | P0 |
| | Calls Server Action on submit | P0 |
| **BeneficiaryForm** | | |
| | Same coverage as ServantForm | P0 |
| **StageAssignmentForm** | | |
| | Filters stages by selected service | P0 |
| | Shows only unassigned servants | P1 |

---

## 5. E2E Tests (Playwright)

### 5.1 Critical Paths

**CP1 — New Church Registration**
```
1. Navigate to /en/signup
2. Fill church name, admin name, email, password
3. Submit
4. Verify redirect to /en/login
5. Verify login with new credentials succeeds
6. Verify dashboard loads with default data
```

**CP2 — Servant Lifecycle**
```
1. Login as Super Admin
2. Navigate to Servants → Create
3. Fill all fields, assign to stage
4. Submit
5. Verify servant appears in list
6. Click servant → verify detail page
7. Edit a field → submit → verify change
8. Deactivate → verify status change
```

**CP3 — Beneficiary Lifecycle**
```
1. Login as Super Admin
2. Navigate to Beneficiaries → Create
3. Fill all fields, assign to stage + servant
4. Submit
5. Verify beneficiary appears in list
6. Transfer to another stage → verify transfer history
7. Deactivate → verify status change
```

**CP4 — Attendance Recording**
```
1. Login as admin/user with stage access
2. Navigate to Attendance → Record
3. Select stage
4. Mark beneficiaries Present/Absent/Excused
5. Submit
6. Verify attendance history shows records
7. Verify absence alert created (if 3+ consecutive)
```

**CP5 — Follow-up Workflow**
```
1. Login as user
2. Navigate to Follow-ups → Create
3. Select beneficiary, type, schedule date
4. Submit
5. Verify appears in Upcoming list
6. Mark as Completed → verify status change
7. Verify completion rate updated on dashboard
```

**CP6 — Spiritual Journal**
```
1. Login as servant
2. Navigate to Spiritual
3. Toggle practices, add notes
4. Submit
5. Verify entry saved
6. Verify streak counter incremented
7. Login as Priest → navigate to servant's journal → verify readable
8. Verify audit log entry created for Priest access
```

**CP7 — RBAC Enforcement**
```
1. Login as User role
2. Attempt to navigate to /en/settings/roles
3. Verify redirect or forbidden state
4. Login as Super Admin
5. Navigate to /en/settings/roles → verify accessible
6. Change servant's role → verify change persisted
```

**CP8 — Bulk Import**
```
1. Login as Super Admin
2. Navigate to Servants → Import
3. Download template
4. Fill template with 5 rows (1 invalid)
5. Upload → verify validation report shows 1 error
6. Fix error → re-upload → verify 5 successes
```

**CP9 — RTL Navigation**
```
1. Switch locale to Arabic
2. Verify sidebar on right
3. Verify all pages render without layout breakage
4. Verify form labels right-aligned
5. Verify data reads right-to-left
6. Verify notification bell on left side
```

### 5.2 Regression Suite

Run before each release:

| # | Test | Priority |
|---|------|----------|
| 1 | Load all 33 screens — verify no 500 errors | P0 |
| 2 | Verify all forms submit and validate | P0 |
| 3 | Verify all data tables paginate | P0 |
| 4 | Verify all filters return correct results | P1 |
| 5 | Verify all CRUD operations audit-logged | P0 |
| 6 | Verify RLS isolation (Church A vs Church B) | P0 |
| 7 | Verify notification bell shows correct count | P1 |
| 8 | Verify all dashboards by role | P0 |

---

## 6. Performance Tests

### 6.1 Lighthouse Budgets

| Metric | Target | Device |
|--------|--------|--------|
| First Contentful Paint | < 1.5s | Mobile |
| Largest Contentful Paint | < 2.5s | Mobile |
| Total Blocking Time | < 200ms | Mobile |
| Cumulative Layout Shift | < 0.1 | Mobile |
| Speed Index | < 3.0s | Mobile |
| Accessibility score | > 95 | Both |
| Best Practices | > 90 | Both |

### 6.2 Load Tests (Phase 2)

Not in MVP scope. Basic guidelines:
- 100 concurrent users
- 50 requests/sec on main API endpoints
- Response time < 500ms P95
- Error rate < 0.1%

---

## 7. Security Tests

### 7.1 Automated

| Test | Tool | Priority |
|------|------|----------|
| SQL injection scan | OWASP ZAP | P0 |
| XSS scan | OWASP ZAP | P0 |
| Missing auth headers check | Custom script | P1 |
| Sensitive data in response check | Custom script | P0 |
| RLS bypass attempts | Custom integration tests | P0 |

### 7.2 Manual

| Check | Priority |
|-------|----------|
| Can I access another church's data by changing church_id in URL? | P0 |
| Can I see spiritual journal of a servant I don't work with? | P0 |
| Can I delete/alter data I shouldn't have access to? | P0 |
| Can I register without email verification? | P1 |

---

## 8. Accessibility Tests

### 8.1 Automated (axe-core)

| Check | Target | Priority |
|-------|--------|----------|
| All pages pass axe-core audit | No violations | P0 |
| Color contrast meets WCAG AA | All text 4.5:1 | P0 |
| Keyboard navigation | All interactive elements reachable | P0 |
| Focus indicators visible | All interactive elements | P0 |
| Form fields have labels | All inputs | P0 |
| Images have alt text | All img elements | P0 |

### 8.2 Manual

| Check | Priority |
|-------|----------|
| Navigate entire app with keyboard only | P0 |
| Screen reader test (VoiceOver/NVDA) — main flows | P1 |
| Zoom to 200% — no content cut off | P1 |
| Reduced motion — no animations | P2 |

---

## 9. Acceptance Criteria (Per Epic)

| Epic | Must Pass |
|------|-----------|
| Infrastructure | All migrations run, CI passes, RLS enabled |
| Auth & RBAC | Login→Register→Logout→RLS chain works |
| Church Structure | Service→Stage→Class CRUD works |
| Servant Management | CRUD + approval + assignment + import |
| Beneficiary Mgmt | CRUD + transfer + import |
| Attendance | Record + history + absence alerts |
| Follow-Up | CRUD + status workflow + reminders |
| Spiritual Growth | Journal CRUD + privacy + audit |
| Notifications | Creation + bell + center + alerts |
| Dashboards | Role-specific data rendering |
| Import/Export | Template + validation + data import |
| Audit & Settings | Audit viewer + church settings + role mgmt |

---

## 10. QA Environment Requirements

| Requirement | Specification |
|-------------|---------------|
| Supabase project | Supabase local (Docker) for CI |
| Test data | Seed script generating: 3 churches, 5 stages, 10 servants, 20 beneficiaries |
| Test accounts | 1 super_admin, 1 admin (Stage A), 1 user (Stage A), 1 user (Stage B) |
| Locale | Both Arabic and English |
| CI integration | GitHub Actions — vitest + playwright on push to main/staging |
| Test database | Supabase local, reset between test runs |
| Playwright recording | Video + trace on failure |
