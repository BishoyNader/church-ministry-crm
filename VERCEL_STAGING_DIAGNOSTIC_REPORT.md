# Vercel Staging Diagnostic Report

**Prepared:** 2026-07-30  
**Commit:** 929bd5de4e08845d5d2e20ae42032c8782286ca6  
**Branch:** staging  
**Framework:** Next.js 16.2.12 with next-intl 4.13.4  

---

## Diagnosis Summary

| Severity | Count |
|----------|-------|
| BLOCKER | 2 |
| HIGH | 2 |
| MEDIUM | 2 |
| LOW | 2 |

---

## BLOCKER

### B1. No Vercel project exists

**Finding:** `.vercel/` directory does not exist. No Vercel project has been created or linked. The GitHub repository has not been imported into Vercel.

**Impact:** Deployment is impossible. Every step in `VERCEL_DEPLOYMENT_GUIDE.md` sections 2–4 must be executed.

**Fix:**
1. Navigate to https://vercel.com/dashboard
2. Click **"Add New → Project"** → select `church-ministry-crm` from GitHub
3. Or via CLI: `npm i -g vercel && vercel login && vercel link`

**Effort:** 15 minutes

### B2. Environment variables not configured

**Finding:** None of the 5 required environment variables are configured in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL` (optional fallback)
- `SUPABASE_ANON_KEY` (optional fallback)

The application throws at startup if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing (`src/lib/supabase/config.ts:10-12`).

**Impact:** Build succeeds but runtime crashes with `Missing Supabase environment variables`.

**Fix:** After project creation, add all 5 variables in Vercel Dashboard → Settings → Environment Variables, separated by environment (Production / Preview / Development).

| Variable | Staging Value |
|----------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dyfgflmrsmzgvpknbesi.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (staging anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | (staging service role key) |
| `SUPABASE_URL` | Same as staging URL |
| `SUPABASE_ANON_KEY` | Same as staging anon key |

**Effort:** 10 minutes

---

## HIGH

### H1. Missing `SUPABASE_SERVICE_ROLE_KEY` for auth signup

**Finding:** `src/features/auth/services/auth.service.ts` uses `createAdminClient()` (lines 39, 102), which calls `getSupabaseServiceRoleKey()` (`src/lib/supabase/admin.ts:6`). This function throws if `SUPABASE_SERVICE_ROLE_KEY` is not set.

**Impact:** User signup (`/signup`) will fail with a 500 error. Login and other operations that use the anon key client work fine.

**Mitigation:** Already required by B2 — adding `SUPABASE_SERVICE_ROLE_KEY` to Vercel env vars resolves this.

**Effort:** Covered by B2 fix (1 minute extra)

### H2. Vercel CLI not installed

**Finding:** `vercel` command is not available in the local environment.

**Impact:** Cannot use CLI-based setup (`vercel link`, `vercel env add`). All Vercel configuration must be done through the web dashboard.

**Mitigation:** Use Vercel Dashboard for project creation and env var configuration. CLI is optional.

**Effort:** None (dashboard workflow is sufficient)

---

## MEDIUM

### M1. No `vercel.json`

**Finding:** No `vercel.json` exists. Vercel auto-detects Next.js framework with default settings.

**Impact:** None for basic deployment. Defaults are correct for Next.js 16. Without `vercel.json` you lose ability to configure:
- Custom build commands per environment
- Region preference
- `headers` / `redirects` / `rewrites` (could use next.config.ts instead)
- Function configuration (memory, timeout, maxDuration)

**Recommendation:** Add a minimal `vercel.json` only if custom regions or function configuration is needed. Current defaults are acceptable for staging.

**Effort:** 5 minutes (optional)

### M2. `next.config.ts` `env` block is redundant

**Finding:** `next.config.ts` explicitly maps `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and `SUPABASE_ANON_KEY` through the `env` block. `NEXT_PUBLIC_*` vars are automatically available at build time on Vercel. Non-public vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) being in the `env` block means they are inlined into the client bundle — acceptable since they mirror the public anon key values.

**Impact:** None functionally. The redundant mapping adds ~10 lines with no benefit.

**Recommendation:** Clean up in a future refactor. Not urgent.

**Effort:** 5 minutes (optional)

---

## LOW

### L1. `.vercel/` not in `.gitignore`

**Finding:** After running `vercel link`, Vercel creates a `.vercel/` directory with project metadata. This is not listed in `.gitignore`.

**Impact:** Risk of accidentally committing local Vercel project metadata.

**Recommendation:** Add `.vercel` to `.gitignore`.

**Effort:** 1 minute

### L2. Root `README.md` references Cloudflare Pages

**Finding:** `README.md:15` states `Hosting: Cloudflare Pages`. The deployment decision (`DEPLOYMENT_PLATFORM_DECISION.md`) chose Vercel over Cloudflare (153 vs 97 score).

**Impact:** Misleading for new contributors. Low priority.

**Recommendation:** Update to `Hosting: Vercel`.

**Effort:** 1 minute

---

## Pre-Build Verification

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| ESLint (`npm run lint`) | ✅ 0 errors, 4 warnings |
| i18n message files | ✅ `src/messages/ar.json`, `en.json` exist |
| Supabase client modules | ✅ All 5 modules present |
| Middleware (proxy.ts) | ✅ Edge-compatible cookie APIs |
| Dependencies | ✅ 20 deps, all resolvable |

---

## Recommended Fix Order

| Order | Fix | Severity | Effort |
|-------|-----|----------|--------|
| 1 | Create Vercel project (import from GitHub) | BLOCKER | 15m |
| 2 | Configure 5 environment variables | BLOCKER | 10m |
| 3 | Add `.vercel` to `.gitignore` | LOW | 1m |
| 4 | (Optional) Add `vercel.json` for explicit config | MEDIUM | 5m |
| 5 | (Optional) Clean up `next.config.ts` env block | MEDIUM | 5m |
| 6 | (Optional) Update `README.md` hosting line | LOW | 1m |

**Total critical effort:** ~25 minutes (items 1–2)  
**Total optional effort:** ~12 minutes (items 3–6)

---

## Verdict

**STAGING_DEPLOYMENT_BLOCKED** — 2 BLOCKER issues prevent deployment. Resolution requires creating a Vercel project and configuring 5 environment variables (~25 minutes of work). No code changes are required; the repository is build-verified and deployable once infrastructure is provisioned.
