# Launch Day Checklist — Church Ministry CRM

**Date:** ________________  
**Lead Engineer:** ________________  
**Start Time:** ________________  
**Target Duration:** 3 hours (Sprints 0 + 1)  

---

## Prerequisites (Complete BEFORE Launch Day)

### Required Accounts

| Account | Status | Owner | URL |
|---------|--------|-------|-----|
| Supabase account (Pro plan billing) | ☐ | Infrastructure | https://supabase.com/dashboard |
| Vercel account (Pro plan billing) | ☐ | Engineering | https://vercel.com |
| GitHub repository (church-ministry-crm) | ☐ | Engineering | https://github.com/.../church-ministry-crm |
| Cloudflare account (domain) | ☐ | Operations | https://dash.cloudflare.com |
| Resend or SendGrid (SMTP) | ☐ | Operations | https://resend.com |
| Sentry account (optional for Sprint 3) | ☐ | Engineering | https://sentry.io |
| Better Stack account (optional for Sprint 3) | ☐ | Engineering | https://betterstack.com |
| 1Password or vault for secrets | ☐ | All | — |

### Required Credentials (Have Ready)

| Credential | Source | Owner |
|-----------|--------|-------|
| Supabase Dashboard login | Supabase account | Infrastructure |
| Vercel Dashboard login | Vercel account | Engineering |
| GitHub personal access token (classic, repo scope) | GitHub → Settings → Developer Settings → Tokens | Engineering |
| Domain registrar login | Cloudflare | Operations |
| Google OAuth client ID + secret (if enabling) | Google Cloud Console → APIs & Services → Credentials | Operations |
| SMTP API key (Resend/SendGrid) | Resend dashboard → API Keys | Operations |
| Credit card (Supabase Pro $25/mo + Vercel Pro $20/mo) | — | Management |

### Required Domain (Register Before Launch Day)

| Item | Value | Status |
|------|-------|--------|
| Chosen domain | `________________` | ☐ |
| Registered at Cloudflare Registrar | — | ☐ |
| Cloudflare nameservers active | — | ☐ |
| DNS zone created in Cloudflare | — | ☐ |

---

## Sprint 0: Foundation (~1.5 hours)

### Step 0.1 — Create Production Supabase Project

| # | Action | Est. | Command / Detail | ✅ |
|---|--------|------|------------------|---|
| 0.1.1 | Log into Supabase Dashboard | 1 min | https://supabase.com/dashboard | ☐ |
| 0.1.2 | Click "New project" | 1 min | — | ☐ |
| 0.1.3 | Enter project name | 1 min | `church-ministry-crm-prod` | ☐ |
| 0.1.4 | Set database password | 2 min | Generate 32-char random: `openssl rand -base64 24` → save to 1Password | ☐ |
| 0.1.5 | Select region | 1 min | `eu-west-1` (or `us-east-1` if primary users are US-based) | ☐ |
| 0.1.6 | Select pricing plan | 1 min | **Pro** ($25/mo) — required for `vector` + PITR | ☐ |
| 0.1.7 | Click "Create new project" | 1 min | Wait ~2 min for provisioning | ☐ |
| 0.1.8 | Verify project status is "Healthy" | 1 min | Supabase Dashboard → Project → Status | ☐ |

### Step 0.2 — Enable Extensions

| # | Action | Est. | Command / Detail | ✅ |
|---|--------|------|------------------|---|
| 0.2.1 | Open SQL Editor | 1 min | Supabase Dashboard → SQL Editor | ☐ |
| 0.2.2 | Enable vector extension | 1 min | `CREATE EXTENSION IF NOT EXISTS vector;` | ☐ |
| 0.2.3 | Enable pgcrypto extension | 1 min | `CREATE EXTENSION IF NOT EXISTS pgcrypto;` | ☐ |
| 0.2.4 | Verify extensions | 1 min | `SELECT * FROM pg_extension WHERE extname IN ('vector', 'pgcrypto');` | ☐ |

### Step 0.3 — Link Local CLI to Production

| # | Action | Est. | Command / Detail | ✅ |
|---|--------|------|------------------|---|
| 0.3.1 | Get project reference ID | 1 min | Supabase Dashboard → Project Settings → General → Reference ID | ☐ |
| 0.3.2 | Link local project | 1 min | `supabase link --project-ref <ref>` | ☐ |
| 0.3.3 | Verify link | 1 min | `supabase status` → shows linked project ref | ☐ |

### Step 0.4 — Apply Database Migrations

| # | Action | Est. | Command / Detail | ✅ |
|---|--------|------|------------------|---|
| 0.4.1 | Verify local branch is correct | 1 min | `git branch` → `main` or `code_enhancement` with all fixes | ☐ |
| 0.4.2 | Push migrations to production | 5 min | `supabase db push` | ☐ |
| 0.4.3 | Verify all 22 migrations applied | 2 min | Check output — no errors, 22 migrations listed | ☐ |
| 0.4.4 | Verify table count | 1 min | Run verification query (see Step 0.8) | ☐ |

### Step 0.5 — Configure Supabase Auth

| # | Action | Est. | Command / Detail | ✅ |
|---|--------|------|------------------|---|
| 0.5.1 | Open Auth settings | 1 min | Supabase Dashboard → Authentication → Settings | ☐ |
| 0.5.2 | Disable "Allow new users to sign up" | 1 min | **DISABLE** — MVP should only allow admin-created accounts | ☐ |
| 0.5.3 | Set session duration | 1 min | **24 hours** (access token) / **7 days** (refresh token) | ☐ |
| 0.5.4 | Set security: email confirmations | 1 min | **ON** — confirm emails before allowing access | ☐ |
| 0.5.5 | Configure SMTP (Resend/SendGrid) | 5 min | See `SUPABASE_PRODUCTION_SETUP_GUIDE.md` §4 | ☐ |
| 0.5.6 | Test SMTP | 2 min | Send test email from Supabase Auth settings | ☐ |
| 0.5.7 | Enable Google OAuth (optional) | 10 min | Supabase Dashboard → Auth → Providers → Google | ☐ |
| 0.5.8 | Set rate limits | 1 min | Auth → Rate Limits: 30 req/min | ☐ |

### Step 0.6 — Enable Backups (PITR)

| # | Action | Est. | Command / Detail | ✅ |
|---|--------|------|------------------|---|
| 0.6.1 | Open Database → Backups | 1 min | Supabase Dashboard → Database → Backups | ☐ |
| 0.6.2 | Click "Enable PITR" | 1 min | 7-day retention (included in Pro) | ☐ |
| 0.6.3 | Verify status "Active" | 1 min | Backups page shows PITR status green | ☐ |

### Step 0.7 — Rotate & Collect Secrets

| # | Action | Est. | Command / Detail | ✅ |
|---|--------|------|------------------|---|
| 0.7.1 | Rotate anon key | 2 min | Supabase Dashboard → Settings → API → Rotate anon key → copy new value | ☐ |
| 0.7.2 | Copy service_role key | 1 min | Supabase Dashboard → Settings → API → service_role key | ☐ |
| 0.7.3 | Copy project URL | 1 min | `https://<ref>.supabase.co` | ☐ |
| 0.7.4 | Store all 4 production secrets in 1Password | 2 min | See `ENVIRONMENT_VARIABLE_MATRIX.md` for exact names | ☐ |

### Step 0.8 — Verify Production Database

| # | Action | Est. | Command / Detail | ✅ |
|---|--------|------|------------------|---|
| 0.8.1 | Verify 29 tables | 2 min | `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';` — expect 26+ (29 with backups) | ☐ |
| 0.8.2 | Verify 52 permissions | 1 min | `SELECT count(*) FROM permissions;` — expect **52** | ☐ |
| 0.8.3 | Verify 93 policies | 1 min | `SELECT count(*) FROM pg_policies WHERE schemaname = 'public';` — expect **93** | ☐ |
| 0.8.4 | Verify user_role_type enum | 1 min | `SELECT enumlabel FROM pg_enum JOIN pg_type t ON t.oid = enumtypid WHERE t.typname = 'user_role_type';` — 4 values | ☐ |

**CHECKPOINT A** — Database ready. If any verification fails → **DO NOT PROCEED** to Sprint 1. Diagnose and fix before continuing.

---

## Sprint 1: Hosting (~1.5 hours)

### Step 1.1 — Create Vercel Project

| # | Action | Est. | Command / Detail | ✅ |
|---|--------|------|------------------|---|
| 1.1.1 | Log into Vercel | 1 min | https://vercel.com/login | ☐ |
| 1.1.2 | Click "Add New → Project" | 1 min | Vercel Dashboard → Overview → Add New → Project | ☐ |
| 1.1.3 | Import GitHub repository | 2 min | Search for `church-ministry-crm` → click Import | ☐ |
| 1.1.4 | Framework preset | 1 min | Verify **Next.js** is auto-detected | ☐ |
| 1.1.5 | Root directory | 1 min | Keep `./` (default) | ☐ |
| 1.1.6 | Build command | 1 min | Keep `npm run build` (default) | ☐ |
| 1.1.7 | Output directory | 1 min | Keep `.next` (default) | ☐ |
| 1.1.8 | Install command | 1 min | Keep `npm install` (default) | ☐ |
| 1.1.9 | Do NOT deploy yet | — | Click **Deploy** will fail (env vars missing) — close the dialog instead | ☐ |

### Step 1.2 — Configure Environment Variables

| # | Action | Est. | Command / Detail | ✅ |
|---|--------|------|------------------|---|
| 1.2.1 | Open Project Settings → Environment Variables | 1 min | Vercel Dashboard → Project → Settings → Environment Variables | ☐ |
| 1.2.2 | Add `NEXT_PUBLIC_SUPABASE_URL` (Production) | 1 min | Value: `https://<prod-ref>.supabase.co` | ☐ |
| 1.2.3 | Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production) | 1 min | Value: rotated anon key from Step 0.7.1 | ☐ |
| 1.2.4 | Add `SUPABASE_SERVICE_ROLE_KEY` (Production) | 1 min | Value: service_role key from Step 0.7.2 | ☐ |
| 1.2.5 | Add `SUPABASE_URL` (Production) | 1 min | Same as `NEXT_PUBLIC_SUPABASE_URL` | ☐ |
| 1.2.6 | Add `SUPABASE_ANON_KEY` (Production) | 1 min | Same as `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ☐ |
| 1.2.7 | Add all 5 vars for Preview environment | 2 min | Use **staging** Supabase project values (separate from production) | ☐ |
| 1.2.8 | Add all 5 vars for Development environment | 2 min | Use **local** Supabase values (http://127.0.0.1:54321) | ☐ |
| 1.2.9 | Verify entries | 1 min | 15 total entries (5 vars × 3 environments) | ☐ |
| 1.2.10 | Encrypt secrets | 1 min | Vercel auto-encrypts — verify padlock icon next to each Production variable | ☐ |

### Step 1.3 — Update next.config.ts

| # | Action | Est. | Command / Detail | ✅ |
|---|--------|------|------------------|---|
| 1.3.1 | Open `next.config.ts` | 1 min | In editor | ☐ |
| 1.3.2 | Add `output: "standalone"` | 1 min | Insert into `NextConfig` object | ☐ |
| 1.3.3 | Commit and push | 2 min | `git add next.config.ts && git commit -m "chore: add output standalone for Vercel" && git push` | ☐ |

### Step 1.4 — First Production Deploy

| # | Action | Est. | Command / Detail | ✅ |
|---|--------|------|------------------|---|
| 1.4.1 | Open Vercel Dashboard → Project → Deployments | 1 min | — | ☐ |
| 1.4.2 | Click "Deploy" (or redeploy latest commit) | 1 min | Vercel will build and deploy | ☐ |
| 1.4.3 | Wait for build to complete | 3-5 min | Monitor build logs for errors | ☐ |
| 1.4.4 | Verify deployment status "Ready" | 1 min | Green checkmark | ☐ |
| 1.4.5 | Open production URL | 1 min | `https://church-ministry-crm.vercel.app` | ☐ |
| 1.4.6 | Verify login page loads | 1 min | HTTP 200, no console errors | ☐ |
| 1.4.7 | Verify CSS/Tailwind renders | 1 min | Page has proper styling (not unstyled HTML) | ☐ |
| 1.4.8 | Verify i18n routing works | 1 min | Visit `/ar/dashboard` → redirects to login with Arabic locale | ☐ |
| 1.4.9 | Check browser console | 1 min | Zero errors | ☐ |

### Step 1.5 — Configure Custom Domain

| # | Action | Est. | Command / Detail | ✅ |
|---|--------|------|------------------|---|
| 1.5.1 | Open Vercel Project → Settings → Domains | 1 min | — | ☐ |
| 1.5.2 | Enter custom domain | 1 min | `crm.<church-name>.com` | ☐ |
| 1.5.3 | Copy Vercel DNS target | 1 min | `cname.vercel-dns.com` | ☐ |
| 1.5.4 | Add CNAME record in Cloudflare DNS | 2 min | Cloudflare Dashboard → DNS → Records → Add: `CNAME @ cname.vercel-dns.com` + `CNAME www cname.vercel-dns.com` | ☐ |
| 1.5.5 | Disable Cloudflare proxy (orange cloud → grey) | 1 min | Cloudflare proxy conflicts with Vercel SSL — set to **DNS only** | ☐ |
| 1.5.6 | Wait for SSL provisioning | 3-5 min | Vercel auto-provisions Let's Encrypt certificate | ☐ |
| 1.5.7 | Verify `https://crm.<church-name>.com` loads | 1 min | Valid SSL, login page renders | ☐ |

### Step 1.6 — Enable GitHub Integration

| # | Action | Est. | Command / Detail | ✅ |
|---|--------|------|------------------|---|
| 1.6.1 | Open Vercel Project → Settings → Git | 1 min | — | ☐ |
| 1.6.2 | Verify GitHub connected | 1 min | Should show `church-ministry-crm` repository | ☐ |
| 1.6.3 | Set Production Branch | 1 min | `main` | ☐ |
| 1.6.4 | Enable auto-deploy on push | 1 min | Vercel auto-deploys when `main` branch receives push | ☐ |
| 1.6.5 | Test preview deploys | 5 min | Create a test PR → Vercel bot comments with preview URL within 2 min | ☐ |
| 1.6.6 | Delete test PR | 1 min | Clean up | ☐ |

**CHECKPOINT B** — Application deployed. If any step fails → refer to `PRODUCTION_ROLLBACK_RUNBOOK.md` for rollback procedures.

---

## Post-Launch Verification (Immediate)

| # | Check | Action | Expected | ✅ |
|---|-------|--------|----------|---|
| P1 | Auth flow | Login as admin user | Dashboard loads, no redirect loop | ☐ |
| P2 | Beneficiary list | Navigate to beneficiaries page | Table renders, no RLS errors | ☐ |
| P3 | Create record | Submit a new beneficiary | 200 response, data persists | ☐ |
| P4 | Session persistence | Refresh page after login | Still logged in | ☐ |
| P5 | Console errors | Open browser DevTools → Console | Zero errors | ☐ |
| P6 | Network errors | Open browser DevTools → Network | All API calls 200/204 | ☐ |
| P7 | RTL layout | Navigate to `/ar/dashboard` | Right-to-left layout correct | ☐ |
| P8 | Mobile responsive | Resize browser to 375px width | No layout breakage | ☐ |

---

## Rollback During Launch

If any step fails irrecoverably:

| Situation | Action | Est. Time |
|-----------|--------|-----------|
| Supabase project creation fails | File support ticket with Supabase. Use staging project temporarily. | 30 min |
| Migration fails on production | Run `supabase db reset --linked` to revert. See `PRODUCTION_ROLLBACK_RUNBOOK.md`. | 15 min |
| Vercel build fails | Check build logs. Most common: missing env var, TypeScript error, npm install failure. | 10 min |
| Domain SSL fails | Use `*.vercel.app` URL temporarily. SSL auto-provisions within 5 min. | 0 min |
| App loads but auth fails | Check `NEXT_PUBLIC_SUPABASE_ANON_KEY` value — likely mismatch with project. | 5 min |

---

## Sign-Off

| Role | Name | Signature | Time |
|------|------|-----------|------|
| Lead Engineer | | | |
| Infrastructure | | | |
| Project Manager | | | |
| CTO (if applicable) | | | |

**Launch Complete Time:** ________________  
**Launch Outcome:** SUCCESS / ROLLED BACK / PARTIAL
