# Production Infrastructure Plan — Church Ministry CRM

**Prepared:** 2026-07-30  
**Target:** MVP launch with minimal viable operational safety  
**Platform Decision:** Vercel (see `DEPLOYMENT_PLATFORM_DECISION.md`)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Users                              │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────────┐
│                  Vercel (CDN + Edge)                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │                Vercel Edge Network               │   │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐   │   │
│  │  │ Static   │ │  Next.js │ │  Middleware     │   │   │
│  │  │ Assets   │ │  SSR     │ │  (Auth + i18n)  │   │   │
│  │  └──────────┘ └──────────┘ └────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │          Vercel Function Runtime (Node.js)        │   │
│  │  ┌─────────────────────┐ ┌────────────────────┐   │   │
│  │  │  Server Actions     │ │  API Routes (BFF)  │   │   │
│  │  └─────────────────────┘ └────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │ @supabase/supabase-js
┌────────────────────▼────────────────────────────────────┐
│                   Supabase (Production)                   │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐   │
│  │  PostgreSQL  │ │  Auth        │ │  Storage       │   │
│  │  (Pro Plan)  │ │ (Email+OAuth)│ │  (Documents)   │   │
│  └──────────────┘ └──────────────┘ └────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Supabase Production Setup

### 1.1 Project Creation

```bash
# Create production project via Supabase Dashboard
# Region: eu-west-1 (closest to current staging)
# Plan: Pro ($25/month)
# DB password: Generate strong password, store in 1Password/Vault

# Link production project locally
supabase link --project-ref <prod-project-ref>
supabase db push  # Apply all 22 migrations
```

### 1.2 Post-Creation Configuration

| Step | Action | Command/Details |
|------|--------|-----------------|
| 1 | Enable `vector` extension | `CREATE EXTENSION IF NOT EXISTS vector;` in Supabase SQL Editor |
| 2 | Generate new anon key | Supabase Dashboard → Settings → API → Rotate anon key |
| 3 | Configure Auth settings | Dashboard → Auth → Settings: session duration (24h), email confirmations ON |
| 4 | Enable Google OAuth | Dashboard → Auth → Providers → Google: configure client ID + secret |
| 5 | Create storage buckets | `documents/`, `avatars/`, `exports/` with RLS policies |
| 6 | Enable PITR | Dashboard → Database → Backups → Enable PITR (7-day retention) |
| 7 | Configure rate limiting | Dashboard → Auth → Rate Limits: 30 req/min for production |
| 8 | Set up custom SMTP | Dashboard → Auth → Settings → SMTP: SendGrid or Resend for branded emails |

### 1.3 Environment Variables

```bash
# Production
NEXT_PUBLIC_SUPABASE_URL=https://<prod-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<prod-service-role-key>

# Staging (preview deploys)
NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
```

---

## 2. Vercel Deployment Setup

### 2.1 Project Configuration

```bash
# Install Vercel CLI
npm i -g vercel

# Login and link project
vercel login
vercel link

# Set up environments
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Repeat for preview + development environments
```

### 2.2 Build Configuration

Update `next.config.ts` to add production-optimized settings:

```typescript
const nextConfig: NextConfig = {
  output: "standalone",  // Enable for Vercel optimization
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
  // Add after MVP launch:
  // images: { remotePatterns: [...] },  // For user-uploaded images
  // redirects: async () => [...],       // For URL migrations
};
```

### 2.3 Vercel Project Settings

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Build Command | `npm run build` |
| Output Directory | `.next` |
| Install Command | `npm install` |
| Node.js Version | 22.x |
| Region | `iad1` (US East) or `dub1` (Europe) |
| Git Integration | GitHub (`church-ministry-crm` repo) |
| Production Branch | `main` |
| Preview Deployments | Auto on PR creation |
| Custom Domain | `crm.<church-name>.com` (configure post-MVP) |

### 2.4 Environment-Specific Domains

| Environment | Domain | Branch |
|-------------|--------|--------|
| Production | `crm.church-name.com` | `main` |
| Staging | `staging.crm.church-name.com` | `develop` |
| Preview | `pr-{number}.vercel.app` | PR branches |

---

## 3. CI/CD Pipeline

### 3.1 GitHub Actions — CI (`ci.yml`)

```yaml
name: CI
on: [pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run build
```

### 3.2 GitHub Actions — Deploy (`deploy.yml`)

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

**Note:** Vercel's native GitHub integration (configured in Vercel Dashboard → Git) is simpler and recommended over manual Actions. The CI workflow above is for lint/typecheck/build only; Vercel auto-deploys via its GitHub app.

---

## 4. Monitoring Stack

### 4.1 Error Tracking — Sentry

| Item | Detail |
|------|--------|
| Plan | Free (5k events/month — sufficient for MVP launch) |
| Integration | `@sentry/nextjs` — auto-instrumentation |
| Setup | `npx @sentry/wizard -i nextjs` |
| Alerts | Slack integration for `error` level events |
| Source maps | Upload source maps to Sentry via Vercel integration |

Key Sentry config:
```typescript
// sentry.client.config.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,  // 10% sampling for MVP
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

### 4.2 Performance Monitoring — Vercel Analytics

| Item | Detail |
|------|--------|
| Web Vitals | Free — enabled in Vercel Dashboard |
| Speed Insights | Free — measure LCP, CLS, INP |
| Usage Analytics | Free — page views, unique visitors |

Enable via Vercel Dashboard → Project → Analytics.

### 4.3 Uptime Monitoring — Better Stack

| Item | Detail |
|------|--------|
| Plan | Free (3 monitors, 10s check interval) |
| Endpoints to monitor | `https://crm.church-name.com/login` (200 OK) |
| Alert method | Email + Slack webhook |
| Config | GET check, 30s timeout, expect 200 |

### 4.4 Database Monitoring — Supabase Dashboard

| Item | Detail |
|------|--------|
| Query performance | Built-in — Database → Query Performance |
| Auth activity | Built-in — Auth → Users → Usage |
| Storage usage | Built-in — Storage → Usage |
| API usage | Built-in — API → Usage |
| Alerts | Supabase Pro includes email alerts for billing, storage, and compute |

---

## 5. Backup & Disaster Recovery

### 5.1 Automated Backups

| Backup Type | Frequency | Retention | Location |
|-------------|-----------|-----------|----------|
| PITR (Supabase Pro) | Continuous | 7 days | Supabase infrastructure |
| pg_dump (weekly) | Sunday 03:00 UTC | 4 weeks | Backblaze B2 + local |
| Storage files | Continuous | 30 days | Supabase Storage (auto) |

### 5.2 Backup Script

```bash
#!/bin/bash
# weekly-backup.sh — Run via cron on Sunday 03:00 UTC

TIMESTAMP=$(date +%Y%m%d)
BACKUP_DIR="/backups/church-crm"
FILENAME="church-crm-prod-${TIMESTAMP}.dump"

# Database dump
pg_dump -Fc --no-owner --no-privileges \
  "$PROD_DATABASE_URL" \
  -f "${BACKUP_DIR}/${FILENAME}"

# Upload to Backblaze B2
b2 upload-file church-crm-backups \
  "${BACKUP_DIR}/${FILENAME}" \
  "database/${FILENAME}"

# Cleanup local files older than 7 days
find "$BACKUP_DIR" -name "*.dump" -mtime +7 -delete

# Verify backup integrity
pg_restore --list "${BACKUP_DIR}/${FILENAME}" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "Backup verified: ${FILENAME}"
else
  echo "BACKUP CORRUPT: ${FILENAME}" | \
    mail -s "BACKUP FAILURE" ops@church-name.com
fi
```

### 5.3 Disaster Recovery Procedure

See `PRODUCTION_ROLLBACK_RUNBOOK.md` for full detail. Recovery time estimate:

| Scenario | Recovery Time | Method |
|----------|---------------|--------|
| Accidental data loss | < 15 min | PITR to 5 min before incident |
| Complete DB failure | < 30 min | Restore from latest pg_dump |
| Region outage | < 2 hours | Restore in another Supabase region |
| Full infrastructure loss | < 4 hours | Rebuild from Vercel + Supabase + backup |

---

## 6. Domain & SSL Setup

### 6.1 Domain Registration

| Option | Provider | Cost | Notes |
|--------|----------|------|-------|
| Recommended | Cloudflare Registrar | ~$10/yr | At-cost pricing, free DNS, no markup |
| Alternative | Namecheap | ~$12/yr | Cheaper initial, but renewal higher |
| Alternative | Google Domains | ~$12/yr | Simple, integrates with Google services |

**Recommendation:** Cloudflare Registrar for at-cost domain pricing + free DNS.

### 6.2 SSL Certificate

Automatic via Vercel — no manual SSL configuration needed. Vercel provisions and auto-renews Let's Encrypt certificates for all custom domains.

### 6.3 DNS Configuration

```
Type    Name              Value                              TTL
CNAME   @                 cname.vercel-dns.com               300
CNAME   www               cname.vercel-dns.com               300
CNAME   staging           cname.vercel-dns.com               300
```

---

## 7. Environment Security

### 7.1 Secret Management

| Secret | Location | Access |
|--------|----------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel Environment Variables | Vercel production only |
| `SENTRY_DSN` | Vercel Environment Variables | All environments |
| `VERCEL_TOKEN` | GitHub Secrets | CI/CD only |
| Supabase DB password | 1Password | Engineering team |
| Vercel login credentials | 1Password | Engineering team |

### 7.2 `.env.local` Management

- `.env.local` is in `.gitignore` — never committed
- `.env.local.example` serves as the template for new developers
- Production secrets NEVER appear in `.env.local.example`
- Each developer maintains their own `.env.local` for local development

---

## 8. Cost Estimate (Monthly)

| Service | Plan | Monthly Cost |
|---------|------|-------------|
| Supabase | Pro ($25/mo) | $25.00 |
| Vercel | Pro ($20/mo) | $20.00 |
| Domain | Cloudflare (annual) | ~$0.83 |
| Sentry | Free (5k events) | $0.00 |
| Better Stack | Free (3 monitors) | $0.00 |
| Backblaze B2 | Pay-as-you-go | ~$1.00 |
| **Total** | | **~$46.83/mo** |

*Scale costs:* When MAU exceeds 50k or API calls exceed 500k/month, Vercel Pro → Enterprise ($150+/mo) and Supabase Pro → Team ($599/mo) may be required.

---

## 9. Implementation Order

| Step | Task | Owner | Est. Time | Dependencies |
|------|------|-------|-----------|--------------|
| 1 | Create production Supabase project (Pro plan) | Infrastructure | 30 min | None |
| 2 | Run migrations on production | DB Admin | 15 min | Step 1 |
| 3 | Generate and rotate anon key | Infrastructure | 5 min | Step 1 |
| 4 | Configure Supabase Auth + OAuth | Backend | 30 min | Step 1 |
| 5 | Enable PITR and verify backups | Infrastructure | 10 min | Step 1 |
| 6 | Register domain | Operations | 15 min | None |
| 7 | Create Vercel project and link GitHub | Engineering | 30 min | Steps 1, 6 |
| 8 | Configure environment variables in Vercel | Engineering | 15 min | Steps 1, 7 |
| 9 | Deploy to Vercel production | Engineering | 10 min | Steps 7, 8 |
| 10 | Configure custom domain + SSL (auto) | Engineering | 10 min | Steps 6, 7 |
| 11 | Set up GitHub Actions CI | Engineering | 2 hours | Step 7 |
| 12 | Enable branch protection on main | Engineering | 10 min | Step 11 |
| 13 | Configure Sentry | Engineering | 1 hour | Step 9 |
| 14 | Set up uptime monitoring | Engineering | 30 min | Step 9 |
| 15 | Schedule automated backups | Infrastructure | 1 hour | Step 5 |
| 16 | Add output: "standalone" to next.config.ts | Engineering | 5 min | Step 7 |
| 17 | Install Vitest + write smoke tests | Engineering | 8 hours | — |
| 18 | Install Playwright + write E2E tests | Engineering | 16 hours | — |
| 19 | Enable Vercel Analytics | Engineering | 5 min | Step 9 |
| 20 | Set up Supabase Storage buckets | Backend | 30 min | Step 1 |
