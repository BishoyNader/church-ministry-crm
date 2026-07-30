# Infrastructure Gap Analysis

**Review Date:** 2026-07-30  
**Scope:** Production deployment infrastructure for Church Ministry CRM  
**Method:** Current-state audit vs MVP production requirements  

---

## 1. Hosting Architecture

### Current State

| Component | Current | Required for Production | Gap |
|-----------|---------|------------------------|-----|
| Application platform | Local `next dev` only | Production Next.js hosting | ❌ Not configured — never deployed |
| Build output | Default `.next/` | `.next/` + `output: "standalone"` for edge | ⚠️ Missing optimization |
| Containerization | None | Not strictly required on Vercel | ✅ No gap (Vercel-native) |
| CDN | None | Global CDN for static assets | ❌ Not configured |
| Edge functions | None | Supabase edge functions unused | ✅ Not needed |
| File storage | Local | Supabase Storage for uploads | ❌ Not configured |
| DNS | None | Production domain with SSL | ❌ Not configured |
| Staging environment | Local Supabase only | Separate staging URL | ⚠️ Partial — Supabase staging project exists, no app staging URL |

### Required Changes

- Create Vercel project linked to GitHub repository
- Configure production, preview, and staging deployments
- Set `output: "standalone"` in `next.config.ts`
- Configure CDN caching rules for static assets
- Set up custom domain with automatic SSL

---

## 2. Supabase Configuration

### Current State

| Component | Current | Required for Production | Gap |
|-----------|---------|------------------------|-----|
| Project | Staging only (`dyfgflmrsmzgvpknbesi`) | Production Supabase project | ❌ Does not exist |
| Plan | Free (local dev) | Pro ($25/mo) — needs `vector` extension | ❌ Not provisioned |
| Extensions | `pgcrypto` + `vector` | Both required | ⚠️ `vector` requires Pro plan |
| Auth providers | Email/password only | Email + OAuth (Google, Apple) | ⚠️ OAuth not configured |
| Storage buckets | None | Document uploads, profile images | ❌ Not created |
| Edge functions | None | Not required for MVP | ✅ No gap |
| Database backups | Local docker volumes | PITR (included in Pro) | ❌ Not configured |
| Read replica | None | Not required until >1M MAU | ✅ No gap for MVP |
| Connection pooling | pgBouncer (included) | Supabase pooler URL | ⚠️ Exists but unused |

### Required Changes

1. **Create production Supabase project** (Pro plan, eu-west-1 or us-east-1)
2. **Enable `vector` extension** — requires Pro plan minimum
3. **Configure auth providers** — enable Google OAuth for production
4. **Enable PITR backups** — included in Pro plan
5. **Create storage buckets** — `documents`, `avatars`, `exports` with RLS policies
6. **Set up row-level security** — already done in migration 022
7. **Rotate anon key** — generate new anon key for production
8. **Configure rate limiting** — Supabase project settings

---

## 3. Environment Variables & Secrets

### Current State

| Variable | Current Value | Production Required | Status |
|----------|---------------|-------------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Production project URL | ❌ Placeholder |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` | Production project anon key | ❌ Placeholder |
| `SUPABASE_SERVICE_ROLE_KEY` | `your-service-role-key` | Production project service key | ❌ Placeholder |
| `SUPABASE_URL` | Placeholder | Production project URL | ❌ Placeholder |
| `SUPABASE_ANON_KEY` | Placeholder | Production anon key | ❌ Placeholder |

### Required Changes

- Generate and store all 5 secrets in Vercel Environment Variables
- Use separate secrets per environment (production, preview, development)
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client bundle
- Add staging environment variables for preview deployments

---

## 4. CI/CD Pipeline

### Current State

| Capability | Current | Required | Gap |
|------------|---------|----------|-----|
| Version control | Git (GitHub) | GitHub repository | ✅ Done |
| CI platform | None | GitHub Actions | ❌ Not configured |
| Lint on PR | None | `npm run lint` pass required | ❌ Not configured |
| Typecheck on PR | None | `tsc --noEmit` pass required | ❌ Not configured |
| Build on PR | None | `npm run build` pass required | ❌ Not configured |
| Auto-deploy main | None | Vercel production deploy | ❌ Not configured |
| Auto-deploy branches | None | Vercel preview deploys | ❌ Not configured |
| Branch protection | None | main branch protected | ❌ Not configured |
| Status checks | None | Required before merge | ❌ Not configured |

### Required Changes

1. Create `.github/workflows/ci.yml` — lint + typecheck + build
2. Create `.github/workflows/deploy.yml` — Vercel deploy on push to main
3. Configure branch protection rules on GitHub
4. Add status check requirements for PR merge

---

## 5. Monitoring & Observability

### Current State

| Capability | Current | Required | Gap |
|------------|---------|----------|-----|
| Error tracking | None | Sentry | ❌ Not configured |
| Performance monitoring | None | Vercel Analytics | ❌ Not configured |
| Uptime monitoring | None | External health check | ❌ Not configured |
| Database monitoring | None | Supabase dashboard | ⚠️ Available but not accessed |
| API monitoring | None | Vercel Analytics | ❌ Not configured |
| Alerting | None | Slack/email alerts | ❌ Not configured |
| Log aggregation | None | Vercel Logs + Sentry | ❌ Not configured |
| Dashboard | None | Grafana or similar | ❌ Not configured for MVP |

### Required Changes

- **Sentry** — free tier (5k events/month) sufficient for MVP launch
- **Vercel Analytics** — free for Speed Insights + Web Analytics
- **Better Stack (formerly Better Uptime)** — free 3-monitor plan for uptime checks
- **Supabase Dashboard** — use built-in monitoring for DB queries, auth, storage

---

## 6. Testing

### Current State

| Capability | Current | Required | Gap |
|------------|---------|----------|-----|
| Unit tests | None | Vitest or Jest | ❌ Not configured |
| Integration tests | None | Playwright or similar | ❌ Not configured |
| E2E tests | None | Playwright | ❌ Not configured |
| Test CI integration | None | Runs on PR | ❌ Not configured |
| Test coverage | None | Not tracking | ❌ Not configured |
| QA test plan | Documented | Manual execution only | ⚠️ Document exists, no automation |

### Required Changes

- Install Vitest for unit tests (lightweight, fast, compatible with Next.js)
- Install Playwright for E2E tests (industry standard for Next.js)
- Create minimal test suite covering critical flows: auth, CRUD, RLS enforcement
- Add test execution to CI pipeline
- **Prioritize** — tests can be added incrementally after MVP launch

---

## 7. Domain & SSL

### Current State

| Item | Current | Required | Gap |
|------|---------|----------|-----|
| Domain | None | e.g., `crm.church-name.com` | ❌ Not purchased |
| SSL certificate | None | Automatic via Vercel | ⚠️ Included with Vercel |
| Custom domain in Vercel | None | Configured in Vercel dashboard | ❌ Not configured |
| Email domain | None | `noreply@church-name.com` for Supabase emails | ❌ Not configured |
| DNS hosting | None | Cloudflare or Vercel DNS | ❌ Not configured |

### Required Changes

- Register domain (e.g., `church-ministry.app` or customer subdomain)
- Configure DNS to point to Vercel nameservers
- Enable automatic SSL in Vercel dashboard

---

## 8. Backup & Disaster Recovery

### Current State

| Capability | Current | Required | Gap |
|------------|---------|----------|-----|
| Database backups | None | Supabase PITR (Pro) | ❌ Not configured |
| Database dumps | Manual only | Automated daily dump | ❌ Not configured |
| File backup | None | Supabase Storage auto-backup | ❌ Not configured |
| Environment backup | None | `.env.local` not in VCS | ⚠️ Purposely excluded |
| Disaster recovery plan | None | Documented in runbook | ⚠️ Runbook exists, no DR test |
| Recovery time objective | None | < 1 hour for MVP | ❌ Not defined |

### Required Changes

- Enable Supabase PITR (included in Pro plan, 7-day retention)
- Schedule weekly `pg_dump` to S3-compatible storage (Backblaze B2 or similar)
- Document recovery procedure in runbook
- Perform one DR drill before production launch

---

## Summary — Gap Severity

| Area | Severity | Effort to Fix | Priority |
|------|----------|---------------|----------|
| Production Supabase project | 🔴 BLOCKER | 1 hour | **P0 — Do before launch** |
| Hosting platform | 🔴 BLOCKER | 2 hours | **P0 — Do before launch** |
| Environment variables | 🔴 BLOCKER | 30 min | **P0 — Do before launch** |
| CI/CD pipeline | 🟡 HIGH | 4 hours | P1 — Before launch |
| Error tracking (Sentry) | 🟡 HIGH | 1 hour | P1 — Before launch |
| Uptime monitoring | 🟡 HIGH | 30 min | P1 — Before launch |
| Domain & SSL | 🟡 HIGH | 1 hour | P1 — Before launch |
| Backup & DR | 🟡 HIGH | 2 hours | P1 — Before launch |
| Performance monitoring | 🟢 MEDIUM | 30 min | P2 — Week 1 post-launch |
| Testing | 🟢 MEDIUM | 16 hours | P2 — Week 2 post-launch |
| Containerization | ⚪ LOW | — | Not required for Vercel MVP |
| Read replica | ⚪ LOW | — | Not required for MVP |
