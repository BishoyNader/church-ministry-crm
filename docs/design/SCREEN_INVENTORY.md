# Screen Inventory — Church Ministry Platform

**Version:** 1.0  
**Scope:** MVP (Phases 1–13 of IMPLEMENTATION_ROADMAP.md)  
**Total screens:** 33  

Each screen includes: route, layout type, required permissions, data source, and notes.

---

## 1. Public Screens (no auth)

| # | Screen | Route | Layout | Permissions | Data Source | Notes |
|---|--------|-------|--------|-------------|-------------|-------|
| 1 | Landing Page | `/[locale]/` | Public | None | Static | Church-specific landing, hero, features |
| 2 | Login | `/[locale]/login` | Public | None | Supabase Auth | Email + password form |
| 3 | Signup | `/[locale]/signup` | Public | None | Supabase Auth + DB | Church + admin registration |
| 4 | Forgot Password | `/[locale]/forgot-password` | Public | None | Supabase Auth | Email-based reset |
| 5 | Reset Password | `/[locale]/reset-password` | Public | None | Supabase Auth | Token-based new password |
| 6 | Servant Registration | `/[locale]/register` | Public | None | servants table | Self-registration → pending approval |

---

## 2. Dashboard

| # | Screen | Route | Layout | Permissions | Data Source | Notes |
|---|--------|-------|--------|-------------|-------------|-------|
| 7 | Dashboard | `/[locale]/dashboard` | App Shell | servants.dashboard | Aggregated | Role-specific widgets (Super Admin / Admin / User) |

---

## 3. Servant Management

| # | Screen | Route | Layout | Permissions | Data Source | Notes |
|---|--------|-------|--------|-------------|-------------|-------|
| 8 | Servant List | `/[locale]/servants` | App Shell | servants.view | servants table | Data table, filters, pagination |
| 9 | Servant Detail | `/[locale]/servants/[id]` | App Shell | servants.view | servants + assignments | Profile, timeline, attendance, follow-ups |
| 10 | Servant Create | `/[locale]/servants/new` | App Shell | servants.create | Form → Server Action | All servant fields |
| 11 | Servant Edit | `/[locale]/servants/[id]/edit` | App Shell | servants.update | Form → Server Action | Pre-filled |
| 12 | Servant Import | `/[locale]/servants/import` | App Shell | servants.import | File → parse → preview → confirm | Template download + validation report |
| 13 | Pending Approvals | `/[locale]/servants/pending` | App Shell | servants.approve | servants (pending) | Approval queue |

---

## 4. Beneficiary Management

| # | Screen | Route | Layout | Permissions | Data Source | Notes |
|---|--------|-------|--------|-------------|-------------|-------|
| 14 | Beneficiary List | `/[locale]/beneficiaries` | App Shell | beneficiaries.view | beneficiaries table | Data table, filters, pagination |
| 15 | Beneficiary Detail | `/[locale]/beneficiaries/[id]` | App Shell | beneficiaries.view | beneficiaries + assignments + attendance + followups | Full profile |
| 16 | Beneficiary Create | `/[locale]/beneficiaries/new` | App Shell | beneficiaries.create | Form → Server Action | All beneficiary fields |
| 17 | Beneficiary Edit | `/[locale]/beneficiaries/[id]/edit` | App Shell | beneficiaries.update | Form → Server Action | Pre-filled |
| 18 | Beneficiary Import | `/[locale]/beneficiaries/import` | App Shell | beneficiaries.import | File → parse → preview → confirm | Template download + validation report |

---

## 5. Church Structure

| # | Screen | Route | Layout | Permissions | Data Source | Notes |
|---|--------|-------|--------|-------------|-------------|-------|
| 19 | Service List | `/[locale]/services` | App Shell | services.view | services table | CRUD list |
| 20 | Service Create/Edit | `/[locale]/services/[id]/edit` | App Shell | services.create, services.update | Form → Server Action | Inline or modal |
| 21 | Stage List (within Service) | `/[locale]/services/[sid]/stages` | App Shell | stages.view | stages table | Nested under service |
| 22 | Stage Create/Edit | `/[locale]/services/[sid]/stages/[id]/edit` | App Shell | stages.create, stages.update | Form → Server Action | Inline or modal |

---

## 6. Attendance

| # | Screen | Route | Layout | Permissions | Data Source | Notes |
|---|--------|-------|--------|-------------|-------------|-------|
| 23 | Record Attendance | `/[locale]/attendance/record` | App Shell | attendance.create | Sessions + records | Beneficiary + servant attendance |
| 24 | Attendance History | `/[locale]/attendance/history` | App Shell | attendance.view | Aggregate | Per-stage, date range, rate |
| 25 | Absence Alerts | `/[locale]/attendance/alerts` | App Shell | attendance.view | notifications + attendance | Alert list, mark resolved |

---

## 7. Follow-Up

| # | Screen | Route | Layout | Permissions | Data Source | Notes |
|---|--------|-------|--------|-------------|-------------|-------|
| 26 | Follow-Up List | `/[locale]/followups` | App Shell | followups.view | followups table | Data table, filters, tabs |
| 27 | Follow-Up Create/Edit | `/[locale]/followups/[id]/edit` | App Shell | followups.create, followups.update | Form → Server Action | |

---

## 8. Spiritual Growth

| # | Screen | Route | Layout | Permissions | Data Source | Notes |
|---|--------|-------|--------|-------------|-------------|-------|
| 28 | Spiritual Journal (Own) | `/[locale]/spiritual` | App Shell | spiritual.view_own | spiritual_journal_entries | Calendar/list toggle, streak |
| 29 | Spiritual Journal (Priest) | `/[locale]/spiritual/servants/[id]` | App Shell | spiritual.view_all | spiritual_journal_entries | Audited access |

---

## 9. Notifications

| # | Screen | Route | Layout | Permissions | Data Source | Notes |
|---|--------|-------|--------|-------------|-------------|-------|
| 30 | Notification Center | `/[locale]/notifications` | App Shell | notifications.view | notifications table | Paginated, filtered |

---

## 10. Settings

| # | Screen | Route | Layout | Permissions | Data Source | Notes |
|---|--------|-------|--------|-------------|-------------|-------|
| 31 | Church Settings | `/[locale]/settings/church` | App Shell | settings.update | churches table | Name, logo, locale |
| 32 | Role Management | `/[locale]/settings/roles` | App Shell | roles.manage | roles + permissions | Assign/revoke roles |
| 33 | Audit Log | `/[locale]/settings/audit` | App Shell | audit.view | audit_logs table | Super Admin only |

---

## Screen Summary

| Category | Count |
|----------|-------|
| Public | 6 |
| Dashboard | 1 |
| Servant Management | 6 |
| Beneficiary Management | 5 |
| Church Structure | 4 |
| Attendance | 3 |
| Follow-Up | 2 |
| Spiritual Growth | 2 |
| Notifications | 1 |
| Settings | 3 |
| **Total** | **33** |

---

## Layout Types

**Public Layout** (`src/app/[locale]/(public)/layout.tsx`)
- Minimal header (logo only)
- No sidebar
- Centered card layout for forms
- Footer with church info (optional)

**App Shell Layout** (`src/app/[locale]/(app)/layout.tsx`)
- Sidebar (collapsible) — navigation links
- Header — breadcrumbs, notification bell, user menu, locale toggle
- Main content area — full width, padded
- Mobile: bottom navigation bar instead of sidebar

**Settings Layout** (`src/app/[locale]/(settings)/layout.tsx`)
- App Shell with sub-navigation for settings sections
- Left sidebar: Church, Roles, Audit links
- Main area: selected section content

---

## RTL Considerations

- Every layout and component must test in RTL mode
- Sidebar flips to right side
- Breadcrumbs reverse direction
- Data table headers align right
- Form labels align right, inputs left
- Date picker calendar renders in Arabic locale
- Notification bell position flips
- Icons in navigation: mirror for RTL (e.g., arrow icons)

---

## Loading States

Every screen should handle:
- **Loading:** Suspense fallback skeleton matching page layout
- **Empty:** Illustrated empty state with CTA to create first item
- **Error:** Error boundary with retry button and error details (hidden behind expand)
- **Not Found:** 404 with back-to-dashboard link (for detail pages)
- **Forbidden:** Permission denied message with contact-admin suggestion
