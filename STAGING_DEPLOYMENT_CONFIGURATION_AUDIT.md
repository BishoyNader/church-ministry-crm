# Staging Deployment Configuration Audit

**Commit:** 929bd5de4e08845d5d2e20ae42032c8782286ca6  
**Branch:** staging  
**Date:** 2026-07-30  

---

## 1. Framework Configuration

### 1.1 next.config.ts

| Setting | Current | Required | Status |
|---------|---------|----------|--------|
| `output` | Not set (default: `server`) | Not required | ✅ Correct — `standalone` is for Docker, not Vercel |
| `env` block | Maps 4 Supabase env vars | Optional | ✅ Harmless but redundant for `NEXT_PUBLIC_*` |
| next-intl plugin | `createNextIntlPlugin("./src/i18n/request.ts")` | Required | ✅ Correct |
| TypeScript | n/a | n/a | ✅ 0 errors |

**Observation:** The existing `VERCEL_DEPLOYMENT_GUIDE.md` section 3.2 recommends `output: "standalone"`. This is **incorrect for Vercel** — `standalone` is for self-hosted Docker deployments. Vercel's serverless output mode (the default) is the correct and optimal configuration. The deployment guide should be corrected.

### 1.2 vercel.json

**Status:** Not present  
**Impact:** None — Vercel auto-detects Next.js 16 with correct defaults  
**Recommendation:** Optional — add only if function configuration (memory, timeout, regions) or custom headers/redirects are needed

### 1.3 Build Scripts (package.json)

| Script | Command | Status |
|--------|---------|--------|
| `build` | `next build` | ✅ Correct — Vercel default |
| `dev` | `next dev` | ✅ Local development |
| `start` | `next start` | ✅ Local production test |
| `lint` | `eslint` | ✅ 0 errors, 4 warnings |
| `postinstall` | Not defined | ✅ No postinstall needed |

### 1.4 Node.js Version

| Aspect | Status |
|--------|--------|
| `engines.node` in package.json | ❌ **Not defined** |
| `.nvmrc` | Not present |
| `.node-version` | Not present |
| Vercel default | 22.x (matches VERCEL_DEPLOYMENT_GUIDE.md) |

**Risk:** Without `engines.node` pinning, a future Vercel platform update could change the default Node.js version. **Recommendation:** Add `"engines": { "node": ">=22.0.0" }` to package.json.

### 1.5 TypeScript & ESLint

| Check | Result | Blocks build? |
|-------|--------|--------------|
| `tsc --noEmit` | ✅ 0 errors | No |
| `npm run lint` | ✅ 0 errors, 4 warnings | No (warnings only) |

### 1.6 PostCSS

```
@tailwindcss/postcss v4 — correct for Tailwind CSS v4
```

---

## 2. Supabase Client Configuration

### 2.1 Module Inventory

| Module | File | Runtime | Env Vars Used |
|--------|------|---------|--------------|
| Config | `src/lib/supabase/config.ts` | Any | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Admin | `src/lib/supabase/admin.ts` | Server | `supabaseUrl` + `serviceRoleKey` from config |
| Server | `src/lib/supabase/server.ts` | Server | `supabaseUrl` + `supabaseAnonKey` from config |
| Browser | `src/lib/supabase/client.ts` | Client | `supabaseUrl` + `supabaseAnonKey` from config |
| Middleware | `src/lib/supabase/middleware.ts` | Edge | `supabaseUrl` + `supabaseAnonKey` from config |

### 2.2 Fallback Resolution (config.ts)

```
NEXT_PUBLIC_SUPABASE_URL  ??  SUPABASE_URL     → supabaseUrl
NEXT_PUBLIC_SUPABASE_ANON_KEY  ??  SUPABASE_ANON_KEY  → supabaseAnonKey
SUPABASE_SERVICE_ROLE_KEY  (no fallback)        → serviceRoleKey
```

All 5 variables should be set in Vercel. The `SUPABASE_URL` and `SUPABASE_ANON_KEY` fallbacks provide resilience if the `NEXT_PUBLIC_*` variants fail to resolve.

---

## 3. Required Environment Variable Inventory

| # | Variable | Scope | Public? | Required in Vercel? | Runtime Error If Missing |
|---|----------|-------|---------|---------------------|-------------------------|
| 1 | `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | ✅ Public (browser-safe) | **Yes** | Config throws immediately |
| 2 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | ✅ Public (browser-safe) | **Yes** | Config throws immediately |
| 3 | `SUPABASE_SERVICE_ROLE_KEY` | Server only | ❌ **Server-only** | **Yes** | Admin client throws on use |
| 4 | `SUPABASE_URL` | Server (fallback) | Inlined (same as #1) | Optional | Falls back to #1 |
| 5 | `SUPABASE_ANON_KEY` | Server (fallback) | Inlined (same as #2) | Optional | Falls back to #2 |

### 3.1 Where Each Variable Is Used

| Variable | Used In |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `config.ts` → all 4 clients. Also in `next.config.ts` env block. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `config.ts` → server.ts, client.ts, middleware.ts. Also in `next.config.ts` env block. |
| `SUPABASE_SERVICE_ROLE_KEY` | `config.ts` → admin.ts → auth.service.ts (signup), user.service.ts (createUser) |
| `SUPABASE_URL` | Fallback in `config.ts`, mapped in `next.config.ts` env block |
| `SUPABASE_ANON_KEY` | Fallback in `config.ts`, mapped in `next.config.ts` env block |

### 3.2 Staging Values

| Variable | Value | Source |
|----------|-------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dyfgflmrsmzgvpknbesi.supabase.co` | Supabase staging project dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon key) | Supabase staging project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service role key) | Supabase staging project → Settings → API |
| `SUPABASE_URL` | `https://dyfgflmrsmzgvpknbesi.supabase.co` | Same as staging URL |
| `SUPABASE_ANON_KEY` | Same as anon key | Same as staging anon key |

**Can be generated after project creation:** ✅ All values come from the Supabase staging project dashboard — no code changes needed. Values can be entered directly into Vercel environment variable UI.

---

## 4. Middleware & Edge Runtime Compatibility

### 4.1 Middleware Stack

```
request → next-intl/middleware (i18n redirect)
       → @supabase/ssr (auth session)
       → Auth logic (redirect authenticated users off login, unauthenticated users to login)
       → response
```

### 4.2 Edge Runtime Verification

| Component | Edge-Compatible? | Notes |
|-----------|-----------------|-------|
| `next-intl/middleware` createMiddleware | ✅ Yes | Designed for Edge |
| `@supabase/ssr` createServerClient | ✅ Yes | Uses request/response cookie pattern |
| `request.cookies.getAll()` | ✅ Yes | Edge-native API |
| `response.cookies.set()` | ✅ Yes | Edge-native API |
| `NextResponse.redirect()` | ✅ Yes | Edge-native API |

### 4.3 Auth Flow

The middleware enforces:
- Authenticated users on auth pages → redirect to `/dashboard`
- Unauthenticated users on protected pages → redirect to `/login`
- `/reset-password` is accessible without auth (special case)

---

## 5. Stale Cloudflare References

| Location | Reference | Action Needed |
|----------|-----------|--------------|
| `README.md:15` | `Hosting: Cloudflare Pages` | Update to "Hosting: Vercel" |
| `.cursor/rules/project-rules.md:51-52` | Mentions Cloudflare Pages/Workers | Update to reference Vercel |
| `docs/project/roadmaps/PHASE_3_IMPLEMENTATION_ROADMAP.md:74` | Cloudflare Registrar for domain | ✅ Still relevant (DNS only) |

**No Cloudflare Pages or Workers configuration files exist** in the repository. No `wrangler.toml`, no `functions/` directory, no Cloudflare-specific build scripts.

---

## 6. Configuration Gap Summary

| Gap | Severity | Impact | Fix |
|-----|----------|--------|-----|
| `engines.node` not pinned in package.json | MEDIUM | Future Vercel Node version change could break build | Add `"engines": { "node": ">=22.0.0" }` |
| `VERCEL_DEPLOYMENT_GUIDE.md` recommends `output: "standalone"` | LOW | Misleading — standalone is for Docker, not Vercel | Remove or clarify in deployment guide |
| `README.md` says Cloudflare Pages | LOW | Outdated info for contributors | Update to Vercel |
| No `vercel.json` | LOW | No explicit config, defaults used | Optional — add only if needed |

**No configuration gaps that block a Vercel project creation.**

---

## 7. Deployment Configuration Verification Checklist

| Check | Result |
|-------|--------|
| Build command (`npm run build` → `next build`) | ✅ Correct |
| Install command (`npm install`) | ✅ Default |
| Node.js version (Vercel default = 22.x) | ✅ Compatible (Next.js 16 requires Node ≥ 18.18) |
| `output: "standalone"` | ❌ Not set ✅ (not needed — default serverless mode is correct) |
| TypeScript compilation | ✅ 0 errors |
| ESLint | ✅ 0 errors (4 warnings — non-blocking) |
| Middleware Edge runtime | ✅ Compatible (next-intl + @supabase/ssr) |
| Supabase SSR cookie pattern | ✅ Edge-compatible (request/response pattern) |
| Public env vars (`NEXT_PUBLIC_*`) | ✅ 2 defined |
| Server-only env vars | ✅ 1 defined (`SUPABASE_SERVICE_ROLE_KEY`) |
| Fallback env vars | ✅ 2 defined (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) |
| No Cloudflare-specific config | ✅ Clean |
| No API routes | ✅ (simplifies deployment) |

---

## 8. Recommended Pre-Creation Fixes

| Priority | Fix | File | Effort |
|----------|-----|------|--------|
| 1 | Pin Node.js engine | `package.json` | 1m |
| 2 | Fix `output: "standalone"` doc error | `docs/deployment/guides/VERCEL_DEPLOYMENT_GUIDE.md` | 2m |
| 3 | Update Cloudflare hosting reference | `README.md` | 1m |
| 4 | Update Cloudflare hosting reference | `.cursor/rules/project-rules.md` | 1m |

All fixes are optional — none block project creation or first deployment. The staging Supabase project (`dyfgflmrsmzgvpknbesi`) already has migrations applied and is ready to connect.

---

## Verdict

**READY_TO_CREATE_VERCEL_PROJECT** — 0 configuration blockers. All 5 environment variables are identified and their values are obtainable from the existing Supabase staging project dashboard. No code changes are required. No build-breaking issues exist. TypeScript and ESLint pass cleanly. Vercel project creation can proceed immediately.
