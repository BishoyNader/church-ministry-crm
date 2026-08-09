# Church Ministry CRM — Enterprise Readiness Audit (v1.0 Gate)

**Audit date:** 2026-08-06
**Branch:** `feature/role-hierarchy-stage-manager`
**Scope:** Analysis only — no files modified, no migrations, no fixes.
**Method:** Static analysis (typecheck, lint, production build), DB-layer inventory (35 migrations, RLS, RPCs, indexes), i18n parity/value scans, permission-matrix cross-reference, and architecture review of all 315 source files (~38,270 LOC).

---

## 1. Executive Summary

The application is **architecturally sound and remarkably well-disciplined** for its size. It has a genuinely professional feature-module layout, a mature RLS-first security model with hardened SECURITY DEFINER RPCs, complete bilingual coverage (1,195 translation keys with exact en/ar parity), a cohesive design system with RTL support, and it **builds, typechecks, and lints cleanly**.

However, it is **not yet ready for a production v1.0 release**. The three structural gaps are:

1. **Zero automated tests and zero CI.** `package.json` contains no test framework and no test scripts; `.github/workflows` is empty. The comprehensive test plan in `docs/testing/QA_TEST_PLAN.md` was never implemented. For a multi-tenant platform handling children's personal data, this is the single largest risk.
2. **Incomplete/contradictory role hierarchy.** The branch and milestone claim "Stage Manager support" and "Role Hierarchy Improvements," but the string `stage_manager` appears **zero times** in source and migrations. The DB enum is `(platform_owner, super_admin, admin, servant)`. The `servant_stage_assignments.role` column exists (default `'servant'`, docs say `'admin'|'user'`) but is **never set by the application**. The seeded `admin` role is missing core capabilities that the `servant` role has (e.g., `attendance.create`, follow-up CRUD, `settings.read`, `notifications.read`).
3. **No operational hardening.** No rate limiting on public endpoints, no security headers (CSP/HSTS/X-Frame-Options), no monitoring/Sentry despite `SYSTEM_ARCHITECTURE.md` documenting it, no backup/restore automation, and a **stale README** that still says "No application code yet."

---

## Phase 1 — Architecture Review

**Verdict: 8/10. Genuinely clean and consistent.**

### What is strong

- **Feature-based organization** — every feature lives in `src/features/<feature>/{actions, services, components, hooks, schemas, types, index.ts}`. 19 features, all following the same convention. This is the single best-quality aspect of the codebase.
- **BFF via Server Actions** — actions are thin authz + orchestration shells over services; services are pure `(supabase, args) → result` functions. Testable by design.
- **Shared UI kit** — `src/components/ui/*` (base-ui-backed button, dialog, select, sheet, tabs…), `feedback/` (loading/empty/error/success), `layout/` (app-shell, page-header, stat-card), `charts/`.
- **i18n wiring** — `[locale]` route group, `proxy.ts` (next-intl + Supabase session), `request.ts` dynamic message loading, locale-aware `Link`/`useRouter`. Default locale `ar` with `localePrefix: "always"` — correct for an Arabic-first product.
- **TanStack Query** — every feature hook derives from server actions with namespaced query keys and targeted invalidation (`CHILD_QUERY_KEYS.list/detail`).

### Issues found

| # | Finding | Evidence |
|---|---|---|
| A1 | **RBAC service duplication** — `rbac.service.ts` (browser client) and `rbac.server.ts` (server client) are near-identical wrappers over `rbac-queries.ts`. Two APIs to maintain. | `src/features/rbac/services/` |
| A2 | **14 files > 400 lines** (5 over 500, `child.actions.ts` at 899) — strong signal for refactor. | see Refactoring backlog |
| A3 | **Pagination implemented 9+ times** by hand (`pageInfo`/`prev`/`next`), no shared primitive. | `child-list-page`, `user-list-page`, `servant-list-page`, `audit-page`, `churches-page`, `services-page`, `classes-page`, `church-users-table`, `church-audit-table` |
| A4 | **Dead RPCs / unused keys** — e.g. `services.table.stageCount` translation value exists in `ar.json` as English but the key is never referenced; 37 DB functions, only 5 called from the app (most of the rest are RLS/trigger helpers — but several are provably unused). | scans |
| A5 | **Docs drift** — `README.md` (Next 15, Cloudflare Pages, "No application code yet"), `SYSTEM_ARCHITECTURE.md` (Sentry/Vercel Analytics/Storage not implemented), `KNOWN_ISSUES.md` ("no cron", "spiritual journal not implemented" — both now exist). | files |
| A6 | **Authz helper naming inconsistency** — `assertUserManagementPermission` (`users/actions/context.ts`) vs `checkUserPermission` everywhere else; both do the same job. | files |

---

## Phase 2 — Permission & Security Audit

**Verdict: 7/10. The RLS/DB layer is strong; the role-matrix layer is inconsistent.**

### Enforcement model (verified)

- **RLS is the enforcement layer.** 47 tables with RLS enabled, **244 policy statements**, tenant isolation via `church_id` on every table, immutable audit triggers, and **75 SECURITY DEFINER functions**, each with internal `auth.uid()` + `user_is_*()` guards, `search_path = public, auth`, and `REVOKE … FROM PUBLIC/anon` + `GRANT … TO authenticated` lockdown (migrations 023/024/035). The proxy (`src/proxy.ts`) explicitly comments *"UX-only routing — RLS remains the enforcement layer."* **Correct and commendable.**
- **Server actions are permission-gated.** 19/25 action files call `hasPermission`/`checkUserPermission`. The 6 without guards are correct by design: `auth.actions` (login/signup), `access.actions` (self-state), `church.actions` (public signup dropdown via `list_churches_for_signup` RPC — identity fields only), `church-request.actions` (public submission, schema-validated), `platform-owner.admin.actions` (one-time **bootstrap token** gated + DB single-flight guard), `user-import.actions` (guarded via `assertUserManagementPermission`).
- **Cron secured** with `CRON_SECRET` + `timingSafeEqual`, header-only (never query string), 300s window, and scheduler writes audit rows. Health endpoint is no-store, exposes booleans only.
- **Audit logging is widespread** — 13 files write `writeAuditLog`/`writeUserAudit`; mutation RPCs write audit rows internally (024/035). Remaining gaps are read-only actions (acceptable) plus a few to verify (below).

### Issues found

| # | Severity | Finding | Evidence |
|---|---|---|---|
| S1 | 🔴 HIGH | **Admin role is missing core capabilities the Servant role has.** Seeded `admin` (021) lacks `attendance.create` (servant HAS it), `followups.create/update/delete` (servant has full CRUD), `settings.read/update`, `notifications.read`. Result: a church Admin **cannot record attendance, manage follow-ups, open Settings, or see Notifications** — while a plain Servant can record attendance. Almost certainly a seed-matrix bug. | `021_role_and_permissions.sql` |
| S2 | 🔴 HIGH | **"Stage Manager" role is unimplemented.** Zero occurrences of `stage_manager` in src + migrations. The schema has `servant_stage_assignments.role` (default `'servant'`; docs say `'admin'\|'user'`) but `assignStages` never sets it, and no UI exposes it. Milestone claim ≠ shipped capability. | grep; `user.service.ts`; RBAC doc |
| S3 | 🟠 MED | **No rate limiting anywhere.** Public unauthenticated endpoints (`/login`, `/signup`, `/forgot-password`, `/church-request`, church list) are brute-force/spam/abuse-able. No library, no throttling in proxy. | package.json; proxy.ts |
| S4 | 🟠 MED | **No security headers.** No CSP, HSTS, X-Frame-Options, X-Content-Type-Options in `next.config.ts` or `vercel.json`. | config files |
| S5 | 🟠 MED | **No CI** — no lint/typecheck/tests run on commit; single-branch workflow, no PR gates. | `.github/workflows` empty |
| S6 | 🟡 LOW | `users`/`approvals` screens gated on `users.read`/`servants.approve` respectively — Admin lacks `servants.approve`, so the Approval Center is effectively super-admin-only (may be intended, but contradicts "Church Manager" narrative). | 021; nav gating |
| S7 | 🟡 LOW | `notifyPlatformOwnersForChurchRequest` hardcodes Arabic/English notification text outside i18n files (translation-lite but works). | `church-request.actions.ts` |
| S8 | 🟡 LOW | **Verify** audit coverage on approve/reject flows (`approval-center.actions`, `approval.actions`) — they guard with `hasPermission` but no explicit `writeAuditLog`; depends on RPC-internal auditing. | audit grep |

**Tenant isolation:** verified sound — every query in services filters `church_id`; RLS enforces even if a service forgot; stage-scoped users get RLS-filtered subsets (the dashboard `scopeNotice` is therefore accurate).

---

## Phase 3 — Translation Audit

**Verdict: 8.5/10. The strongest non-functional area.**

### Verified programmatically

- **1,195 keys in both `en.json` and `ar.json` — exact parity, 0 missing in either direction** (flattened-key diff).
- **100 `useTranslations` namespaces referenced across the app — 100 resolve to real objects in both files, 0 missing.**
- **Arabic is genuine:** 1,119/1,195 values are pure Arabic; 75 mixed (Arabic + placeholder/Latin names); only **1** is pure ASCII.
- ICU plurals in use (`admin.churchRequests.resultsCount`), rich validation/empty/loading/error keys per module.

### Issues found

| # | Severity | Finding |
|---|---|---|
| T1 | 🟠 MED | **12 hardcoded English placeholders** render in Arabic mode — all in church admin forms: `church-form-dialog.tsx` (9: "Arabic church name", "English church name", "church-slug", "contact@church.org", "trial", "active", "ar"…), `church-config-form.tsx` (2), `church-admin-creation.tsx` (1). |
| T2 | 🟡 LOW | **1 untranslated ar.json value:** `services.table.stageCount = {count}` — and the key is also **dead** (never referenced). |
| T3 | 🟡 LOW | **`global-error.tsx` is English-only** ("Application Error" / "Try again") — outside the i18n tree by design, but for an Arabic-first product this is the page users see on a hard crash. Consider a dual-language static fallback. |
| T4 | 🟡 LOW | **Brand string "Church CRM" hardcoded 4×** (`public/page`, `app-shell` ×2, `auth-page`) — not user-facing *content*, but centralize it. |

**Bottom line:** "No English should appear when Arabic is selected" — nearly true today; the 12 form placeholders are the only real violations (plus the hard-crash page).

---

## Phase 4 — UX Audit

**Verdict: 7.5/10. Polished, RTL-aware, well-componentized; some consistency and a11y gaps.**

### Strengths

- Cohesive design system (Tailwind 4 theme tokens, `surface-*`/`ministry` palette, diffused shadows, rounded-hero/card radii), dark/light via `next-themes`, full RTL (`dir` + `useDirection` + `flex-row-reverse` shell, `ms`/`me` logical utilities).
- Micro-interactions: hover scales, active nav dot, theme toggle, skeleton nav while RBAC loads.
- State coverage: `LoadingState`, `EmptyState`, `ErrorState`, `SuccessState`, skeletons, per-module empty-state copy.
- Accessibility baseline: skip-to-content link, `role="status"/"alert"`, 103 `aria-*` attributes, base-ui Dialog/Select/Sheet (focus trap + ARIA), accessible dialogs with `SheetTitle`, aria-current nav.
- Dashboard is a strong showcase (KPIs, trend charts, pipeline, overdue hero).

### Issues found

| # | Severity | Finding |
|---|---|---|
| U1 | 🟠 MED | **No toast/notification system** — success/error feedback is ad-hoc inline text; patterns differ per module (`saveSuccess` vs inline alerts vs error states). Inconsistent feedback UX. |
| U2 | 🟠 MED | **Pagination UX duplicated** (9 hand-rolled variants) with slightly different copy/labels; no shared component to guarantee keyboard/ARIA consistency. |
| U3 | 🟡 LOW | **`children/[childId]` is SSG** — the shell is prerendered static; content is client-fetched behind PermissionGuard, so behavior is correct, but it's an odd pattern for a data page (adds a static shell + client flash). |
| U4 | 🟡 LOW | No `prefers-reduced-motion` handling verified; no focus-visible styling audit; `dashboard-page` scope notice may confuse users whose RLS subset differs from expectations. |
| U5 | 🟡 LOW | `child-form-dialog.tsx` (481 lines) and `user-import-panel.tsx` (433) are overloaded — form UX becomes hard to maintain/test. |

---

## Phase 5 — Performance Audit

**Verdict: 6/10. Fine defaults, real scaling risks.**

### Issues found

| # | Severity | Finding | Evidence |
|---|---|---|---|
| P1 | 🔴 HIGH | **Dashboard loads entire tables into JS and aggregates client-side** — all beneficiaries, all follow-ups, all attendance in last 12 months, all assignments. Author's own TODOs say "migrate to SQL aggregation using `date_trunc()` / `GROUP BY`". Breaks at church scale. | `dashboard.service.ts` (5 TODOs) |
| P2 | 🟠 MED | **`batchAttendance` issues one upsert per beneficiary** (`Promise.all` of N queries) — N+1 on the most bulk-heavy screen. | `child.service.ts` |
| P3 | 🟠 MED | **No lazy loading at all** — zero `next/dynamic`/`React.lazy`; `xlsx` (~400KB) and `recharts` are eagerly bundled into route chunks. | grep |
| P4 | 🟡 LOW | `get_my_access_state` RPC fires on **every request through the proxy** (every navigation) — fine now, worth caching/limiting. | `proxy.ts` |
| P5 | 🟡 LOW | No React Query `placeholderData`, no prefetch, no suspense; broad invalidation (`["children"]`-family) refetches entire lists after single-row mutations. | hooks |
| P6 | ✅ OK | Query defaults sane (staleTime 30s, gcTime 5m, retry 1, `refetchOnWindowFocus: false`); fonts via `next/font` (Geist + Noto Sans Arabic, `display: swap`); 73 indexes across migrations (48 in 001). | provider, migrations |

---

## Phase 6 — Code Quality Audit

**Verdict: 7.5/10. Typecheck ✅, build ✅, lint 0 errors / 7 warnings.**

| Finding | Detail |
|---|---|
| ✅ `tsc --noEmit` | Clean, exit 0 |
| ✅ `next build` | Compiled in 7.7s, all 32 routes generated, 0 errors |
| ⚠️ ESLint | **0 errors, 7 warnings**: 4× `react-hooks/incompatible-library` (React Compiler can't memoize `react-hook-form` `watch()` — benign but flags the RHF pattern), 1 unused var (`optionalEmail` in `child.schema.ts`), plus misc |
| ⚠️ `as any` | `child.service.ts` and others use eslint-disabled `any` row types for joins (acceptable for PostgREST shape-mapping, but a `@database.types` polish pass would remove them) |
| ⚠️ Code smells | 5 TODO markers (all in dashboard service), 10 `console.error/log` (legitimate), no `@ts-ignore` |
| ⚠️ Unused | Dead translation key (`services.table.stageCount`), 12 unused-per-grep permission codes (e.g. `billing.read`, `subscriptions.manage`, `support.manage`, `system.*` — catalog is seeded but no UI/action consumes them), several unverified DB functions |
| ⚠️ Size | 14 files > 400 lines (see backlog) |

---

## Phase 7 — Production Readiness Audit

**Verdict: 5.5/10.**

| Area | Status |
|---|---|
| Health endpoint | ✅ `GET /api/health` — DB probe + env checks + latency/uptime, no-store, `503` on failure |
| Cron | ✅ `vercel.json` schedule + `CRON_SECRET` timing-safe auth + audit trail per run |
| Error boundaries | ✅ `global-error.tsx`, route `error.tsx` (i18n), `not-found.tsx` (i18n) |
| Logging | ⚠️ `console.error` only — no structured logs, no request logging, no error ingestion |
| Monitoring | ❌ **None.** `SYSTEM_ARCHITECTURE.md` documents Sentry + Vercel Analytics; **Sentry is not in `package.json`** |
| Backup / restore | ❌ **No automated strategy** — only a one-off `backups/staging-before-phase3c.sql`; docs runbooks exist but nothing wired |
| Deployment / rollback | ⚠️ Vercel + `PRODUCTION_DEPLOYMENT_RUNBOOK.md` + rollback runbook exist; **no CI pipeline** to gate deploys |
| Env vars / secrets | ✅ `.env*` gitignored; `ENVIRONMENT_VARIABLE_MATRIX.md` exists; `.env.local.example` present (verify no real secrets inside) |
| Security headers | ❌ None configured |
| Rate limiting | ❌ None |
| Invite / password reset | ✅ PO bootstrap invite + `generateLink`, Supabase reset flow, `email_confirm` handling |
| Audit trail | ✅ Strong (RLS-immutable `audit_logs`, trigger + app-level + RPC-level writes) |

---

## Phase 8 — Testing Audit

**Verdict: 1/10. The critical gap.**

- `package.json`: **no test dependencies, no test scripts** (only `dev/build/start/lint`).
- **Zero test files** across the repository.
- `docs/testing/QA_TEST_PLAN.md` specifies Vitest (unit/integration/component), Playwright (E2E), Lighthouse CI, axe-core — **all unimplemented**.
- `MVP_READINESS_CHECKLIST.md` and `UAT_AND_STAGING_SMOKE_TEST.md` describe manual UAT scripts — documentation only.
- Manual staging smoke-test docs exist and are valuable, but there is no regression safety net over 35 migrations of multi-tenant data logic.

---

## Scores (0–10)

| # | Dimension | Score |
|---|---|---|
| 2 | **Architecture** | **8.0** |
| 3 | **Security** | **7.0** |
| 4 | **UX** | **7.5** |
| 5 | **Performance** | **6.0** |
| 6 | **Translation** | **8.5** |
| 7 | **Testing** | **1.0** |
| 8 | **Production Readiness** | **5.5** |
| 9 | **Overall Readiness (v1.0)** | **6.0** |

---

## 10. High-priority issues (block v1.0)

| ID | Issue | Impact |
|---|---|---|
| HP1 | Zero automated tests + zero CI (Phase 6/8) | Regression risk on multi-tenant data ops; nothing gates deploys |
| HP2 | Admin role missing `attendance.create`, follow-up CRUD, `settings.*`, `notifications.read` (S1) | Church Admins can't do core ministry work; servants can do *more* than admins |
| HP3 | "Stage Manager" role unimplemented despite milestone claim (S2) | Product narrative ≠ shipped capability; stage-role column never set |
| HP4 | No rate limiting on public auth/submission endpoints (S3) | Brute force, spam church requests, abuse |
| HP5 | No security headers (S4) | CSP/HSTS missing for a PII-heavy product |
| HP6 | Dashboard/reports full-table JS aggregation (P1) | Fails at real church scale; documented as TODO |

## 11. Medium-priority issues

- MP1: No monitoring/Sentry (despite docs) — production blind spot
- MP2: 12 hardcoded English placeholders in church forms (T1)
- MP3: Backup/restore automation absent (staging SQL dump only)
- MP4: N+1 batch attendance upserts (P2)
- MP5: No lazy loading of `xlsx`/charts (P3)
- MP6: No toast system — inconsistent feedback UX (U1)
- MP7: Duplicated pagination primitives (U2/A3)
- MP8: Approval-Center restricted to super-admin only (S6) — confirm intent
- MP9: RBAC client/server service duplication (A1)

## 12. Low-priority issues

- LP1: `global-error.tsx` English-only (T3)
- LP2: Dead translation key + dead permission codes (T2, Phase 6)
- LP3: Hardcoded brand string ×4 (T4)
- LP4: 7 ESLint warnings (RHF `watch()` + unused var)
- LP5: `get_my_access_state` RPC per proxy request (P4)
- LP6: `children/[childId]` SSG shell (U3)
- LP7: Supabase `snippets/` dir owned by root; no local `config.toml`
- LP8: Authz helper naming inconsistency (A6)

---

## 13. Technical debt backlog

1. **Docs drift** — rewrite `README.md` (says "no code yet", Next 15, Cloudflare), refresh `KNOWN_ISSUES.md`, reconcile `SYSTEM_ARCHITECTURE.md` (Sentry/Storage claims) with reality.
2. **Permission catalog drift** — 12 seeded codes (`billing.read`, `subscriptions.manage`, `support.manage`, `system.audit`, `system.metrics`, …) with no consumer; decide ship-vs-prune.
3. **Role-hierarchy half-implementation** — `servant_stage_assignments.role` default vs docs; stage-scope RLS exists but no assignment UI/flow.
4. **Dead/unverified DB functions** — 37 functions, 5 app-called; audit the remaining 32 (triggers/RLS helpers vs obsolete).
5. **Stale process artifacts** — `STAGING_*`, `VERCEL_STAGING_*`, `PHASE_3C_*` docs (~50 files) need archival triage before they mislead.
6. **`as any` row-mapping** in services (child/attendance/followups joins).
7. **Unused translation key** (`services.table.stageCount`).

## 14. Refactoring backlog

| File | Lines | Action |
|---|---|---|
| `child.actions.ts` | 899 | Split by resource (child/attendance/followup) |
| `child.service.ts` | 773 | Split; extract row-mapper types |
| `church-admin.service.ts` | 703 | Split by domain (churches/users/requests/reports) |
| `church-admin.actions.ts` | 659 | Mirror service split |
| `stage.service.ts` / `stage.actions.ts` | 611/593 | Split ministry vs stage vs assignment |
| `import-export.service.ts` | 593 | Extract per-entity importers |
| `user.actions.ts` / `user.service.ts` | 575/538 | Extract role/stage assignment flows (some already in `context.ts`) |
| `servant-list-page.tsx` | 508 | Extract table/dialogs |
| `child-form-dialog.tsx` | 481 | Extract sectioned field groups |
| Shared primitives | — | One `Pagination`, one `ToastProvider`, one `useTable` hook; dedupe rbac service |

---

## 15. Recommended implementation order

1. **CI + quality gates** (lint → typecheck → build on PR; add branch protection)
2. **Test foundation** (Vitest + Testing Library; P0 suites from `QA_TEST_PLAN.md`: RBAC, auth, services, schemas)
3. **Rate limiting + security headers** (proxy/middleware throttling; CSP/HSTS in `next.config.ts`)
4. **Permission matrix fix** (admin role seed; decide stage-manager model — implement `role` assignment UI + `user_has_stage_access` policy wiring, or drop the claim)
5. **Dashboard/reports SQL aggregation** (replace JS aggregation with DB-side `GROUP BY`/`date_trunc` queries or an RPC)
6. **Translation polish** (12 placeholders, global-error fallback, kill dead keys)
7. **UX consistency** (shared pagination, toast system, form split refactors)
8. **Observability** (Sentry, structured logging, request/error logging)
9. **Backup/restore automation** (scheduled dumps, restore dry-run runbook validation)
10. **E2E (Playwright)** critical paths: signup→approval→attendance→follow-up; RTL + a11y (axe) checks
11. **Docs refresh** (README, KNOWN_ISSUES, architecture truth)

## 16. Estimated effort (1 dev, focused)

| Item | Estimate |
|---|---|
| CI + quality gates | 1–2 d |
| Vitest foundation + P0 suites | 4–6 d |
| Rate limiting + security headers | 1–2 d |
| Permission matrix + stage-manager decision | 2–3 d |
| Dashboard/reports SQL aggregation | 3–5 d |
| Translation polish | 1 d |
| Shared pagination + toast + form splits | 3–4 d |
| Sentry + logging | 1–2 d |
| Backup/restore automation | 1–2 d |
| Playwright E2E + a11y | 5–7 d |
| Docs refresh | 1–2 d |
| **Total** | **~3–5 weeks** |

## 17. Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Regression in multi-tenant data ops without tests | High | High | Tests + CI before any further changes (order #1–2) |
| Auth brute-force / public-endpoint spam | Medium | Medium | Rate limiting (order #3) |
| Permission confusion (admin vs servant) causing operational mistakes | Medium | Medium | Seed fix + role-matrix review (order #4) |
| Dashboard perf degradation at scale | Medium | Medium | SQL aggregation (order #5) |
| RLS regression during fixes | Low–Med | High | Migration test suite (022/028 verification scripts already documented) |
| Docs misleading new contributors / auditors | High | Low | Docs refresh (order #11) |

## 18. Go-live recommendation

> ### ⛔ NOT READY — Ready after fixes (est. 3–5 weeks)
>
> **Not Ready for production v1.0 today.** The application is a *strong* candidate: the security model (RLS + hardened RPCs) and translation completeness are genuinely production-grade. But with **zero automated tests, no CI, no rate limiting, no security headers, no monitoring, and a broken/absent stage-manager role**, shipping now would be irresponsible for a platform holding children's and families' data.
>
> **Ready after the HP backlog (orders #1–5) lands** — specifically: CI+quality gates, the P0 test foundation, rate limiting + headers, the permission/role-matrix fix, and dashboard SQL aggregation. At that point the same scores realistically move to Architecture 8, Security 8.5, UX 7.5, Performance 7.5, Translation 8.5, Testing 6, Production Readiness 8 — an honest **~7.5/10 "go"**.

---

*This report is intended as the master roadmap for all remaining work before the first production release (v1.0). Evidence is reproducible with the scans and commands referenced throughout.*
