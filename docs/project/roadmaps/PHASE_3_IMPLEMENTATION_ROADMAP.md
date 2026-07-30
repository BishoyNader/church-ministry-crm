# Phase 3 Implementation Roadmap — Infrastructure & Deployment

**Prepared:** 2026-07-30  
**Target:** Production-ready infrastructure for Church Ministry CRM MVP  
**Priority:** Fastest path to MVP launch with acceptable operational safety  
**Overall Effort:** ~2–3 days (one developer, focused)

---

## Sprint Structure

```
Sprint 0:  Foundation  ────►  Day 1  (Supabase + Domain)
Sprint 1:  Hosting     ────►  Day 1  (Vercel + Deploy)
Sprint 2:  CI/CD       ────►  Day 2  (GitHub Actions + Branch Protection)
Sprint 3:  Observability──►  Day 2  (Sentry + Monitoring + Backups)
Sprint 4:  Quality     ────►  Day 3  (Tests + Verification)
```

---

## Sprint 0: Foundation (~2 hours)

**Goal:** Production database ready to receive the application.

### Task 0.1 — Create Production Supabase Project

| Detail | Value |
|--------|-------|
| **Effort** | 30 min |
| **Owner** | Infrastructure |
| **Action** | Create Supabase project via dashboard |
| **Plan** | Pro ($25/mo), region eu-west-1 (or us-east-1 if primary users are US-based) |
| **DB password** | Generate 32-char random, store in 1Password |
| **Project name** | `church-ministry-crm-prod` |
| **Verification** | `supabase link --project-ref <ref>` succeeds |

### Task 0.2 — Apply Database Migrations

| Detail | Value |
|--------|-------|
| **Effort** | 15 min |
| **Owner** | DB Admin |
| **Action** | Run all 22 migrations on production |
| **Command** | `supabase db push --linked` |
| **Pre-check** | Verify staging dump matches production target (no schema divergence) |
| **Verification** | 52 permissions, 93 policies, 29 tables (see `PRODUCTION_VERIFICATION_CHECKLIST.md`) |

### Task 0.3 — Configure Supabase Auth

| Detail | Value |
|--------|-------|
| **Effort** | 30 min |
| **Owner** | Backend |
| **Actions** | 1. Enable email confirmations<br>2. Enable Google OAuth (get client ID/secret from Google Cloud Console)<br>3. Set up SMTP (Resend or SendGrid for branded emails)<br>4. Configure session duration (24h default, 7d remember-me)<br>5. Set rate limits (30 req/min for production) |
| **Verification** | Test signup + login flow with real email address |

### Task 0.4 — Enable Backups

| Detail | Value |
|--------|-------|
| **Effort** | 10 min |
| **Owner** | Infrastructure |
| **Action** | Enable PITR in Supabase Dashboard → Database → Backups |
| **Verification** | Confirm backup status shows "Active" |

### Task 0.5 — Register Domain

| Detail | Value |
|--------|-------|
| **Effort** | 15 min |
| **Owner** | Operations |
| **Action** | Register domain (e.g., `church-ministry.app` or customer subdomain) |
| **Provider** | Cloudflare Registrar ($~10/yr, at-cost pricing) |
| **Verification** | Domain is registered and accessible in Cloudflare dashboard |

### Task 0.6 — Rotate & Store Environment Secrets

| Detail | Value |
|--------|-------|
| **Effort** | 10 min |
| **Owner** | Infrastructure |
| **Actions** | 1. Rotate anon key in Supabase Dashboard<br>2. Copy all 4 keys to 1Password vault<br>3. Generate Sentry DSN (placeholder for Sprint 3)<br>4. Generate Vercel API token (placeholder for Sprint 2) |
| **Secrets to store** | `SUPABASE_URL`, `SUPABASE_ANON_KEY` (new rotated), `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `SENTRY_DSN` (pending) |

---

## Sprint 1: Hosting (~2 hours)

**Goal:** Application deployed and accessible at production URL.

### Task 1.1 — Create Vercel Project

| Detail | Value |
|--------|-------|
| **Effort** | 20 min |
| **Owner** | Engineering |
| **Actions** | 1. Login to Vercel (vercel.com)<br>2. Import GitHub repository `church-ministry-crm`<br>3. Framework preset: Next.js<br>4. Build command: `npm run build` (default)<br>5. Root directory: `./` (default) |
| **Verification** | Vercel project dashboard shows green "Ready" status |

### Task 1.2 — Configure Environment Variables

| Detail | Value |
|--------|-------|
| **Effort** | 15 min |
| **Owner** | Engineering |
| **Variables** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| **Environments** | Production, Preview, Development — three sets |
| **Verification** | `vercel env ls` shows all entries |

### Task 1.3 — Configure next.config.ts

| Detail | Value |
|--------|-------|
| **Effort** | 5 min |
| **Owner** | Engineering |
| **Action** | Add `output: "standalone"` to `nextConfig` object |
| **Why** | Optimizes build output for Vercel serverless functions |

### Task 1.4 — First Production Deploy

| Detail | Value |
|--------|-------|
| **Effort** | 10 min |
| **Owner** | Engineering |
| **Action** | `vercel --prod` |
| **Verification** | 1. URL loads (HTTP 200)<br>2. Login page renders<br>3. Console shows no errors |

### Task 1.5 — Configure Custom Domain

| Detail | Value |
|--------|-------|
| **Effort** | 15 min |
| **Owner** | Engineering |
| **Actions** | 1. Vercel Dashboard → Project → Domains<br>2. Add custom domain: `crm.church-name.com`<br>3. Follow Vercel DNS instructions<br>4. Update Cloudflare DNS with CNAME to `cname.vercel-dns.com`<br>5. Wait for SSL provisioning (~5 min) |
| **Verification** | `https://crm.church-name.com` loads with valid SSL |

### Task 1.6 — Configure Preview Deployments

| Detail | Value |
|--------|-------|
| **Effort** | 5 min |
| **Owner** | Engineering |
| **Action** | Enable Vercel GitHub integration (auto-deploys on PR) |
| **Verification** | Open a test PR — Vercel bot comments with preview URL |

---

## Sprint 2: CI/CD (~2.5 hours)

**Goal:** Automated quality gates prevent broken code from reaching production.

### Task 2.1 — Create GitHub Actions CI Workflow

| Detail | Value |
|--------|-------|
| **Effort** | 1 hour |
| **Owner** | Engineering |
| **File** | `.github/workflows/ci.yml` |
| **Triggers** | `pull_request` to `main` and `develop` |
| **Jobs** | 1. Lint (`npm run lint`)<br>2. Typecheck (`npx tsc --noEmit`)<br>3. Build (`npm run build`) |
| **Node version** | 22 |
| **Verification** | Push a branch, open PR — all 3 jobs pass green |

### Task 2.2 — Enable Branch Protection

| Detail | Value |
|--------|-------|
| **Effort** | 10 min |
| **Owner** | Engineering |
| **Actions** | GitHub → Settings → Branches → Add rule for `main`:<br>1. Require PR before merge<br>2. Require status checks (CI passes)<br>3. Require linear history<br>4. Do not allow bypass |
| **Verification** | Try pushing directly to main — GitHub rejects |

### Task 2.3 — Enable Vercel Auto-Deploy from Main

| Detail | Value |
|--------|-------|
| **Effort** | 5 min |
| **Owner** | Engineering |
| **Action** | Configure in Vercel Dashboard → Git → Production Branch: `main` |
| **Verification** | Merge PR to main — Vercel auto-deploys to production |

### Task 2.4 — Configure Vercel Deploy Hooks

| Detail | Value |
|--------|-------|
| **Effort** | 10 min |
| **Owner** | Engineering |
| **Action** | Create deploy hook in Vercel → Settings → Git → Deploy Hooks |
| **Purpose** | Custom trigger for re-deploy without git push (e.g., after Supabase migration) |
| **Verification** | `curl -X POST <deploy-hook-url>` triggers deployment |

### Task 2.5 — Optimize Build Output

| Detail | Value |
|--------|-------|
| **Effort** | 30 min |
| **Owner** | Engineering |
| **Actions** | 1. Analyze bundle with `ANALYZE=true npm run build`<br>2. Remove unused dependencies (audit shadcn tree-shaking)<br>3. Consider dynamic imports for heavy pages (dashboard charts)<br>4. Verify `@sentry/nextjs` doesn't bloat initial bundle |

---

## Sprint 3: Observability (~2 hours)

**Goal:** Know when the application breaks and be able to diagnose.

### Task 3.1 — Install & Configure Sentry

| Detail | Value |
|--------|-------|
| **Effort** | 1 hour |
| **Owner** | Engineering |
| **Commands** | `npm install @sentry/nextjs && npx @sentry/wizard -i nextjs` |
| **Config** | `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` |
| **Settings** | Traces sample rate: 0.1 (10%)<br>Replays: session 10%, on-error 100% |
| **Verification** | Force an error — verify it appears in Sentry dashboard |

### Task 3.2 — Set Up Uptime Monitoring

| Detail | Value |
|--------|-------|
| **Effort** | 15 min |
| **Owner** | Engineering |
| **Provider** | Better Stack (betterstack.com) — free 3-monitor plan |
| **Endpoints** | 1. `https://crm.church-name.com/login` (200 OK)<br>2. `https://crm.church-name.com/api/health` (200, if exists)<br>3. Supabase project health endpoint |
| **Alert integrations** | Slack webhook + email |
| **Verification** | Stop local app — alert fires within 60s |

### Task 3.3 — Enable Vercel Analytics

| Detail | Value |
|--------|-------|
| **Effort** | 5 min |
| **Owner** | Engineering |
| **Actions** | Vercel Dashboard → Project → Analytics → Enable Speed Insights + Web Analytics |
| **Verification** | Visit production URL — dashboard shows page views within 5 min |

### Task 3.4 — Set Up Supabase Database Monitoring

| Detail | Value |
|--------|-------|
| **Effort** | 15 min |
| **Owner** | Infrastructure |
| **Actions** | 1. Enable pg_stat_statements (Supabase Dashboard → Database → Query Performance)<br>2. Set up email alerts for: storage > 80%, compute > 80%, billing threshold |
| **Verification** | Alerts page shows configured thresholds |

### Task 3.5 — Configure Automated Backups

| Detail | Value |
|--------|-------|
| **Effort** | 30 min |
| **Owner** | Infrastructure |
| **Actions** | 1. Deploy weekly backup script to a lightweight server (e.g., DigitalOcean $6 droplet)<br>2. Install `b2` CLI and authenticate<br>3. Create Backblaze B2 bucket: `church-crm-backups`<br>4. Test backup + restore cycle |
| **Cron** | `0 3 * * 0 /usr/local/bin/weekly-backup.sh` (Sunday 03:00 UTC) |

---

## Sprint 4: Quality (~1 day)

**Goal:** Basic test coverage for critical user flows.

### Task 4.1 — Install Vitest

| Detail | Value |
|--------|-------|
| **Effort** | 1 hour |
| **Owner** | Engineering |
| **Commands** | `npm install -D vitest @vitejs/plugin-react` |
| **Config** | `vitest.config.ts` with React plugin |
| **Test location** | `src/**/*.test.ts` (co-located with source) |
| **Verification** | `npx vitest run` exits 0 with 1+ passing test |

### Task 4.2 — Write Utility Tests

| Detail | Value |
|--------|-------|
| **Effort** | 2 hours |
| **Owner** | Engineering |
| **Targets** | 1. `src/lib/utils.ts` — test `cn()` class merging<br>2. `src/lib/direction.ts` — test RTL/LTR direction logic<br>3. `src/lib/supabase/config.ts` — test env var validation |
| **Verification** | All tests pass, CI includes `npm run test` |

### Task 4.3 — Install Playwright

| Detail | Value |
|--------|-------|
| **Effort** | 30 min |
| **Owner** | Engineering |
| **Commands** | `npm install -D @playwright/test && npx playwright install` |
| **Config** | `playwright.config.ts` with production URL target |
| **Verification** | `npx playwright test` runs and exits 0 |

### Task 4.4 — Write E2E Smoke Tests (MVP Critical Path)

| Detail | Value |
|--------|-------|
| **Effort** | 4 hours |
| **Owner** | Engineering |
| **Test cases** | See `PRODUCTION_VERIFICATION_CHECKLIST.md` Sections B1–B3 |
| **Priority** | 1. Auth flow (login, logout, redirect)<br>2. Dashboard loads (200, no console errors)<br>3. Create/read/update beneficiary<br>4. Record attendance<br>5. RLS enforcement (servant cannot delete) |
| **Verification** | All 5 smoke tests pass against staging environment |

### Task 4.5 — Add Test to CI Pipeline

| Detail | Value |
|--------|-------|
| **Effort** | 15 min |
| **Owner** | Engineering |
| **Action** | Add `npm run test` to `.github/workflows/ci.yml` |
| **Verification** | PR triggers test execution — green status |

---

## Post-Launch: Sprint 5 (Week 1)

| # | Task | Owner | Priority |
|---|------|-------|----------|
| 1 | Monitor error rates — verify Sentry < 5 errors/day | Engineering | High |
| 2 | Review Supabase query performance — optimize slow queries | DB Admin | High |
| 3 | Set up Google Search Console (if public-facing) | Marketing | Medium |
| 4 | Configure Vercel log drains (to Axiom or similar) | Engineering | Medium |
| 5 | Review Vercel Analytics — optimize LCP/CLS | Frontend | Medium |
| 6 | Set up content security policy headers | Engineering | Medium |
| 7 | Configure rate limiting (Vercel WAF or Supabase) | Engineering | Low |
| 8 | Review Sentry performance traces — optimize hot paths | Engineering | Low |

---

## Dependency Graph

```
Sprint 0 (Foundation)
├── 0.1 Supabase project (no deps)
├── 0.2 Apply migrations (depends on 0.1)
├── 0.3 Configure auth (depends on 0.1)
├── 0.4 Enable backups (depends on 0.1)
├── 0.5 Register domain (no deps)
└── 0.6 Rotate secrets (depends on 0.1)

Sprint 1 (Hosting)
├── 1.1 Create Vercel project (depends on 0.6)
├── 1.2 Configure env vars (depends on 1.1, 0.6)
├── 1.3 Configure next.config.ts (no deps)
├── 1.4 First deploy (depends on 1.2, 1.3)
├── 1.5 Configure domain (depends on 1.4, 0.5)
└── 1.6 Preview deploys (depends on 1.1)

Sprint 2 (CI/CD)
├── 2.1 CI workflow (depends on 1.4 — tests need a target)
├── 2.2 Branch protection (depends on 2.1 — needs CI checks)
├── 2.3 Auto-deploy (depends on 1.1)
├── 2.4 Deploy hooks (depends on 1.1)
└── 2.5 Bundle optimization (depends on 1.4)

Sprint 3 (Observability)
├── 3.1 Sentry (depends on 1.4 — needs production URL)
├── 3.2 Uptime monitoring (depends on 1.5 — needs domain)
├── 3.3 Vercel Analytics (depends on 1.4)
├── 3.4 DB monitoring (depends on 0.1)
└── 3.5 Backup automation (depends on 0.4)

Sprint 4 (Quality)
├── 4.1 Vitest setup (no deps)
├── 4.2 Unit tests (depends on 4.1)
├── 4.3 Playwright setup (depends on 1.5 — needs URL)
├── 4.4 E2E tests (depends on 4.3)
└── 4.5 CI test integration (depends on 4.2, 2.1)
```

**Critical path:** 0.1 → 0.6 → 1.1 → 1.2 → 1.4 → 1.5 → 3.2  
**Minimum viable launch:** Sprints 0 + 1 complete = **~4 hours**

---

## Time Estimate Summary

| Sprint | Tasks | Est. Time | Cumulative |
|--------|-------|-----------|------------|
| Sprint 0: Foundation | 6 tasks | 1.5 hours | 1.5 hours |
| Sprint 1: Hosting | 6 tasks | 1.5 hours | **3.0 hours** |
| Sprint 2: CI/CD | 5 tasks | 2.0 hours | 5.0 hours |
| Sprint 3: Observability | 5 tasks | 2.0 hours | 7.0 hours |
| Sprint 4: Quality | 5 tasks | 6.5 hours | 13.5 hours |

**MVP launch in 1 day** (Sprints 0 + 1 = ~3 hours focused work)  
**Full operational readiness in 2–3 days** (all 5 sprints)

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Supabase Pro plan `vector` extension unavailable | Low | High | Verify extension availability on Pro plan before creating project. Alternative: disable vector features for MVP. |
| Vercel deployment fails on first try | Medium | Medium | Test `npm run build` locally before deploying. Common issues: env var naming, Node version mismatch. |
| Email delivery fails (SMTP config) | Medium | Medium | Test signup flow immediately after auth config. Fallback: use Supabase built-in email (no-reply@supabase.co). |
| Sentry source maps not uploading | Low | Low | Verify source map upload in Vercel build logs. Unminified errors degrade debugging but don't block launch. |
| Domain DNS propagation delays | Low | Medium | Configure domain 24h before planned launch. Use Vercel's `*.vercel.app` domain during DNS propagation. |
| Google OAuth not configured | Medium | Low | MVP can launch with email/password only. OAuth adds convenience but isn't blocking. |
| Backup script fails silently | Low | High | Add backup verification step (`pg_restore --list` check). Send failure alert to Slack. |
