# Staging Provisioning Runbook

**Commit:** 929bd5de4e08845d5d2e20ae42032c8782286ca6  
**Branch:** staging  
**Date:** 2026-07-30  
**Total estimated time:** 45 minutes  

---

## 0. Prerequisites

Before starting, confirm:

- [ ] You have a Vercel account with access to create projects
- [ ] You have the GitHub repository `BishoyNader/church-ministry-crm` with push access
- [ ] You have access to the Supabase staging project dashboard:
  - **Project ref:** `dyfgflmrsmzgvpknbesi`
  - **URL:** `https://supabase.com/dashboard/project/dyfgflmrsmzgvpknbesi`
- [ ] Supabase staging migrations have been applied (22/22, previously verified)
- [ ] Local build passes: `npm run build` succeeds
- [ ] You have a browser open to Vercel Dashboard

---

## 1. Environment Variable Reference

### 1.1 Required Variables

| # | Variable | Scope | Public? | Required? | Source |
|---|----------|-------|---------|-----------|--------|
| 1 | `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | ✅ Public | **Required** | Supabase Dashboard → Project Settings → API → Project URL |
| 2 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | ✅ Public | **Required** | Supabase Dashboard → Project Settings → API → anon public key |
| 3 | `SUPABASE_SERVICE_ROLE_KEY` | Server only | ❌ Secret | **Required** | Supabase Dashboard → Project Settings → API → service_role key |

### 1.2 Optional Fallback Variables

| # | Variable | Scope | Public? | Required? | Source |
|---|----------|-------|---------|-----------|--------|
| 4 | `SUPABASE_URL` | Server fallback | ⚠️ Inlined | Optional | Same value as #1 |
| 5 | `SUPABASE_ANON_KEY` | Server fallback | ⚠️ Inlined | Optional | Same value as #2 |

### 1.3 Staging Values (Exact)

Copy these from the Supabase staging project dashboard.

| Variable | Value to Enter |
|----------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dyfgflmrsmzgvpknbesi.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → **anon public** (starts with `eyJ...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → **service_role** (starts with `eyJ...`) |
| `SUPABASE_URL` | Same as `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Same as `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

> **WARNING:** `SUPABASE_SERVICE_ROLE_KEY` has full admin access to your Supabase database. Never share it, commit it, or expose it to the client.

---

## 2. Build Configuration Reference

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Framework preset** | Next.js | Auto-detected |
| **Root directory** | `./` | Default |
| **Build command** | `npm run build` | Runs `next build` |
| **Install command** | `npm install` | Default |
| **Output directory** | `.next` | Default for Vercel serverless |
| **Node.js version** | 22.x | Vercel default; no explicit engine needed |
| **Package manager** | npm | Lockfile: `package-lock.json` |

> **Note:** Do NOT set `output: "standalone"` in `next.config.ts`. Vercel's serverless deployment uses the default output mode. `standalone` is for self-hosted Docker deployments.

---

## 3. Step-by-Step Provisioning Procedure

### Phase A: Vercel Project Creation (10 min)

**A1. Navigate to Vercel Dashboard**

Open https://vercel.com/dashboard in a browser.

**A2. Import GitHub Repository**

1. Click **"Add New → Project"** (top right)
2. Click **"Import Git Repository"**
3. Find `BishoyNader/church-ministry-crm` in the list
4. Click **"Import"**

**A3. Configure Project**

In the "Configure Project" screen:

| Field | Setting |
|-------|---------|
| **Project Name** | `church-ministry-crm-staging` |
| **Framework Preset** | Next.js (auto-detected) |
| **Root Directory** | `./` (default) |
| **Build Command** | `npm run build` (auto-detected) |
| **Install Command** | `npm install` (auto-detected) |
| **Output Directory** | `.next` (auto-detected) |

Leave all other settings at defaults.

**A4. Configure Git Branch**

1. Click **"Select Git Branch"** → choose **`staging`**
2. This triggers the initial deployment from the `staging` branch
3. Do NOT click "Deploy" yet — configure environment variables first

---

### Phase B: Environment Variable Configuration (15 min)

**B1. Open Environment Variables Panel**

Vercel Dashboard → Project → **Settings → Environment Variables** (or find the env var section in the deploy dialog).

**B2. Add Preview Environment Variables**

Set all 5 variables for the **Preview** environment (staging):

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dyfgflmrsmzgvpknbesi.supabase.co` | Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon key from Supabase dashboard) | Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | (service role key from Supabase dashboard) | Preview |
| `SUPABASE_URL` | `https://dyfgflmrsmzgvpknbesi.supabase.co` | Preview |
| `SUPABASE_ANON_KEY` | (anon key from Supabase dashboard) | Preview |

**B3. Add Development Environment Variables**

Set the same 5 variables for the **Development** environment (preview deployments from PRs):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dyfgflmrsmzgvpknbesi.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | (service role key) |
| `SUPABASE_URL` | Same as staging URL |
| `SUPABASE_ANON_KEY` | Same as staging anon key |

> **Why Development env too:** PR preview deployments use the Development environment. They need the same Supabase keys to function.

**B4. Add Production Environment Variables**

Set the same 5 variables for the **Production** environment with initial placeholder values:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dyfgflmrsmzgvpknbesi.supabase.co` (staging for now) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (staging anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | (staging service role key) |
| `SUPABASE_URL` | Same as staging URL |
| `SUPABASE_ANON_KEY` | Same as staging anon key |

> **Note:** Production will get its own Supabase project before go-live. For now, staging values enable build testing.

**B5. Verify All Variables**

After adding, expect **15 entries** (5 variables × 3 environments):

```text
NEXT_PUBLIC_SUPABASE_URL       [Production]  [Preview]  [Development]
NEXT_PUBLIC_SUPABASE_ANON_KEY  [Production]  [Preview]  [Development]
SUPABASE_SERVICE_ROLE_KEY      [Production]  [Preview]  [Development]
SUPABASE_URL                   [Production]  [Preview]  [Development]
SUPABASE_ANON_KEY              [Production]  [Preview]  [Development]
```

---

### Phase C: Initial Deployment (10 min)

**C1. Trigger First Deploy**

1. Return to the project deploy page
2. Click **"Deploy"**
3. Wait for the build pipeline:

```
Cloning repository... (5-10s)
Installing dependencies... (30-60s) — 20 npm packages
Running build... (60-120s) — Next.js build
Linting... (10-20s)
✔  Build completed
✔  Deploying...
✔  Preview: https://church-ministry-crm-staging-xxx.vercel.app
```

**C2. Note Deployment URL**

The preview deployment URL follows this pattern:
```
https://church-ministry-crm-staging-git-staging-<team>.vercel.app
```

Record the actual URL for validation in Section 4.

**C3. If Build Fails**

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `Missing NEXT_PUBLIC_SUPABASE_URL` | Env vars not propagated | Re-check env vars in Vercel Dashboard, re-deploy |
| `Module not found: @supabase/ssr` | npm install failed | Verify `package-lock.json` is committed; run `rm -rf node_modules && npm ci` locally |
| TypeScript error | Strict mode issue | Check error in build log, fix in code, push fix to staging |

---

### Phase D: Git Integration Configuration (5 min)

**D1. Configure Auto-Deploy**

1. Vercel Dashboard → Project → **Settings → Git**
2. Verify GitHub connection shows `BishoyNader/church-ministry-crm`
3. **Production Branch:** Leave as `main` (not staging — staging is preview)
4. **Auto-deploy:** ✅ Enable (green toggle)
5. **Ignore Build Step:** Leave empty (build on every push)

**D2. Configure Preview Deployments**

- Every push to any branch creates a preview deployment
- Every PR to `staging` or `main` triggers a preview deployment
- Vercel bot posts the preview URL as a PR comment

---

### Phase E: Production Branch Safeguards (5 min)

**E1. Set Main Branch Protection**

The `main` branch should not auto-deploy to production yet. The Vercel project's production branch is set to `main` by default, but no `main` branch code has been deployed. This is safe — production deployment only triggers when `main` is pushed.

**E2. (Optional) Restrict Production Deployments**

If you want to prevent accidental production deploys:

1. Vercel Dashboard → Project → **Settings → Git → Production Branch**
2. Set to `main` (current)
3. No changes needed — production deployment is manual or via PR merge to `main`

**E3. Set Production Domain Safeguard**

Vercel assigns an auto-generated production domain. This is fine for now. Custom domain setup happens in Phase 3 (go-live).

---

## 4. Validation Checkpoints

Execute these checks in order after the first successful deployment.

### CP1: Build Success

```
Check:  Vercel Dashboard → Deployment → Build Logs
Expect: "Build completed successfully"
        "✔  Deployment ready"
```

### CP2: Application Loads

```bash
# Replace URL with your actual preview deployment URL
curl -s -o /dev/null -w "%{http_code}" https://<preview-url>.vercel.app/login

# Expected: 200
```

### CP3: Middleware & i18n

```bash
# Arabic login page
curl -s -o /dev/null -w "%{http_code}" https://<preview-url>.vercel.app/ar/login
# Expected: 200

# English login page
curl -s -o /dev/null -w "%{http_code}" https://<preview-url>.vercel.app/en/login
# Expected: 200

# Root redirects to Arabic
curl -s -o /dev/null -w "%{http_code}" https://<preview-url>.vercel.app/
# Expected: 307 (redirect) or 200 (if redirected)
```

### CP4: Supabase Connectivity

1. Open browser to the preview URL → `/ar/login`
2. Open DevTools → **Network** tab
3. Filter for `supabase.co` requests
4. Expected: requests to `https://dyfgflmrsmzgvpknbesi.supabase.co` appear
5. If 0 requests: env vars not reaching the client bundle

### CP5: Authentication Flow

1. Navigate to `/ar/login`
2. Enter staging credentials (use a test user from the staging Supabase project)
3. Click login
4. Expected: Redirected to `/ar/dashboard`
5. **Cookie check:** DevTools → Application → Cookies → should show Supabase auth cookie (`sb-*-auth-token`)

### CP6: Protected Route Access

1. While logged in (from CP5), navigate to `/ar/users`
2. Expected: Page loads with user list (200)
3. Open a private/incognito window → navigate to `/ar/users`
4. Expected: Redirected to `/ar/login` (401 redirect)
5. Clear cookies → navigate to `/ar/dashboard`
6. Expected: Redirected to `/ar/login`

### CP7: RBAC Verification

| Test | Action | Expected |
|------|--------|----------|
| Admin user | Login as admin, navigate to `/ar/users` | User list loads |
| Admin user | Open `/ar/users`, try to navigate to create | Create button enabled |
| Non-admin user | Login as user without `users.read` permission | `/ar/users` loads empty or returns permission error |
| Non-admin user | Navigate to `/ar/dashboard` | Dashboard loads with user's data |

### CP8: Console & Error Check

1. DevTools → **Console**
2. Expected: Zero errors, zero uncaught promises
3. Filter for `supabase` — no auth initialization errors
4. Filter for `404` — no missing route errors

---

## 5. Validation Summary Table

| CP | Check | How | Expected Result | Pass/Fail |
|----|-------|-----|-----------------|-----------|
| 1 | Build success | Vercel dashboard | ✅ Build completed | ⬜ |
| 2 | App loads | curl | HTTP 200 | ⬜ |
| 3 | i18n redirects | curl /ar/login, /en/login, / | Each returns 200 or redirect | ⬜ |
| 4 | Supabase connectivity | Browser → Network tab | Requests to staging Supabase | ⬜ |
| 5 | Login flow | Browser → login with test credentials | Redirect to dashboard | ⬜ |
| 6 | Route protection | Private window → /users | Redirect to /login | ⬜ |
| 7 | RBAC enforcement | Admin vs non-admin user | Different responses based on role | ⬜ |
| 8 | Console errors | Browser → Console | Zero errors | ⬜ |

---

## 6. Rollback

If deployment fails or validation checkpoints fail:

**R1. Rollback Vercel Project Settings**

- Vercel Dashboard → Project → **Settings**
- Revert any modified values to defaults
- Delete project and re-import if settings are unrecoverable

**R2. Rollback Vercel Env Vars**

- Vercel Dashboard → Project → **Settings → Environment Variables**
- Delete all 15 entries
- Re-enter with corrected values per Section 1.3

**R3. Rollback Deployment**

- Vercel Dashboard → Project → **Deployments**
- Find the last known-good deployment
- Click **"..." → Promote to Production** (or redeploy)

**R4. Rollback Git**

```bash
# If problematic code was pushed
git revert HEAD
git push origin staging
```

---

## 7. Post-Provisioning Checklist

After all validations pass:

- [ ] Preview URL recorded and accessible
- [ ] Auto-deploy enabled for staging branch
- [ ] PR preview deployments working
- [ ] All 8 validation checkpoints passed
- [ ] Vercel Dashboard → Project **renamed** to `church-ministry-crm-staging` (or approved name)
- [ ] Team members invited to Vercel project (if applicable)
- [ ] VERCEL_STAGING_DIAGNOSTIC_REPORT.md verdict updated to DEPLOYMENT_READY

---

## Appendices

### A. Quick Reference Card

```text
VERCEL PROJECT:
  Name:           church-ministry-crm-staging
  Framework:      Next.js 16.2.12
  Branch:         staging
  Node Version:   22.x (Vercel default)
  Build:          npm run build → next build
  Install:        npm install

SUPABASE STAGING:
  Ref:            dyfgflmrsmzgvpknbesi
  URL:            https://dyfgflmrsmzgvpknbesi.supabase.co

ENV VARS (5 × 3 environments = 15 entries):
  NEXT_PUBLIC_SUPABASE_URL       → public  → required
  NEXT_PUBLIC_SUPABASE_ANON_KEY  → public  → required
  SUPABASE_SERVICE_ROLE_KEY      → secret  → required
  SUPABASE_URL                   → public  → optional
  SUPABASE_ANON_KEY              → public  → optional

FIRST DEPLOY URL:
  https://church-ministry-crm-staging-git-staging-<team>.vercel.app
```
