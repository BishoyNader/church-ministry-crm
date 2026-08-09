# Sprint 2 — Security Hardening Review

**Phase 3 deliverable · Enterprise Production Hardening Sprint**

This document records the security hardening implemented in Sprint 2, the reasoning behind each decision, and the residual risks that remain for the production rollout.

---

## 1. Rate Limiting

### Implemented

| Surface | Mechanism | Limit |
|---|---|---|
| Public server actions (`login`, `signup`, `forgot-password`) | `assertRateLimit` in each action (`src/features/auth/actions/auth.actions.ts`) | 10 / 5 / 5 per IP per minute |
| Public server action (`submitChurchRequest`) | `assertRateLimit` (`src/features/churches/actions/church-request.actions.ts`) | 3 per IP per minute |
| Anonymous page views on public paths | Proxy-level limiter in `src/proxy.ts` | 120/min page views, 10/min server-action POSTs |

Implementation: `src/lib/rate-limit.ts` — a sliding-window in-memory store with periodic pruning and a hard memory cap (10k keys), plus `getClientIp()` (honors `x-forwarded-for` / `x-real-ip`) and `assertRateLimit()` for server actions. On denial the proxy returns HTTP 429 with a `Retry-After` header; actions return a localized-friendly error message.

### Documented limitation

The store is **per-runtime-instance**. On serverless platforms each isolate has its own window, so this is a first line of defense, **not a global throttle**. For distributed enforcement, the recommended production upgrade is a DB-backed limiter (a `rate_limit_events` table or an edge-network rule). This does **not** weaken RLS or business authorization — it only slows abusive callers.

### Verification

- `npx tsc --noEmit` — clean
- `npm run lint` — clean (no new warnings)
- Unit tests cover the store behavior (`tests/unit/rate-limit.test.ts`)

## 2. Security Headers

Applied globally via `next.config.ts` `headers()`:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Strict-Transport-Security` (production only) | `max-age=63072000; includeSubDomains; preload` |

### CSP caveat

`script-src` and `style-src` include `'unsafe-inline'` because Next.js injects inline RSC hydration payloads. **Follow-up:** a nonce-based strict CSP (Next.js `middleware` nonce support) that removes `'unsafe-inline'` from `script-src`. `frame-ancestors 'none'` + `X-Frame-Options: DENY` already block clickjacking.

## 3. CSRF Review

- All mutations go through **Next.js Server Actions**, which enforce built-in **Origin/Host validation** (`checkOrigin`). Cross-site form posts cannot invoke actions.
- The cron endpoint requires `Authorization: Bearer $CRON_SECRET` with a **timing-safe comparison**; the secret is never accepted via query string.
- No authenticated state-changing GET endpoints exist.
- **Conclusion:** no additional CSRF token layer is required; the built-in origin check is the control.

## 4. Authentication Hardening

| Control | Status |
|---|---|
| Session validation on every request (proxy `updateSession` → `supabase.auth.getUser()`) | ✅ implemented (pre-existing, verified) |
| Access gate: inactive account / unapproved servant / no roles → redirected to pending-approval | ✅ implemented (`get_my_access_state`) |
| Login rejects inactive accounts and missing profiles with localized messages | ✅ implemented |
| Password policy: minimum 8 characters (zod `min(8)` on login/signup/reset) | ✅ implemented |
| Signup requires a church selection (uuid) | ✅ implemented |
| Platform-owner bootstrap gated by env token + single-flight DB guard | ✅ implemented |
| **Residual:** Supabase Auth email enumeration / account-lockout settings must be configured in the Supabase dashboard (SMTP, `Enable email confirmations`, `Prevent brute force` are dashboard settings, not code) | ⚠️ operational |

## 5. Public Endpoint Inventory

| Endpoint | Auth | Rate limited | Notes |
|---|---|---|---|
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | anon | ✅ | Actions limited 10/5/5 per IP/min |
| `/church-request` | anon | ✅ | Action limited 3 per IP/min |
| Church signup dropdown (`list_churches_for_signup`) | anon | via proxy | Identity fields only (RPC 023) |
| `/api/health` | anon | — | Booleans only; no-store; no data leak |
| `/api/cron/notifications` | `CRON_SECRET` | — | timing-safe, header-only |
| All `/[locale]/(app)/*` routes | session | — | RLS + server-action permission checks enforce |

## 6. Residual Risks for Production

1. **Distributed rate limiting** — upgrade to a DB-backed limiter before public launch under load.
2. **Strict CSP (nonce)** — remove `'unsafe-inline'` from `script-src`.
3. **Supabase dashboard settings** — email confirmation, brute-force protection, SMTP from a verified domain.
4. **Sentry / error monitoring** — Sprint 2 Phase 6 adds structured logging; wire an error sink (Sentry) before launch.
5. **Dependency audit** — `npm audit` reports 9 vulnerabilities (3 moderate, 6 high), dominated by the legacy `xlsx` package. Plan a replacement (e.g. `exceljs` or `SheetJS CE` vendor update) or move XLSX parsing to the server with a maintained library.
