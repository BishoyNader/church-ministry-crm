# Vercel Deployment Guide — Church Ministry CRM

**Last Updated:** 2026-07-30  
**Framework:** Next.js 16 (App Router)  
**Package Manager:** npm  
**Node Version:** 22.x  

---

## 1. Prerequisites

Before starting, ensure you have:

- [ ] Vercel account (sign up at https://vercel.com/signup)
- [ ] Vercel Pro plan ($20/mo) — required for team features and higher limits
- [ ] GitHub repository (`church-ministry-crm`) with push access
- [ ] Production Supabase project created and migrations applied (see `SUPABASE_PRODUCTION_SETUP_GUIDE.md`)
- [ ] All 5 environment variables collected (see `ENVIRONMENT_VARIABLE_MATRIX.md`)

---

## 2. Project Creation

### 2.1 Vercel Dashboard (Recommended)

1. Navigate to https://vercel.com/dashboard
2. Click **"Add New → Project"** (top right)
3. Click **"Import Git Repository"**
4. Search for `church-ministry-crm` in the list
5. Click **"Import"**

### 2.2 CLI Alternative

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link project (creates project if not exists)
vercel link

# Verify link
vercel env ls  # Should show empty — we'll add in step 4
```

---

## 3. Build Configuration

### 3.1 Vercel Dashboard Settings

After importing the repository, configure these settings before deploying:

| Setting | Value | Notes |
|---------|-------|-------|
| Framework Preset | **Next.js** | Auto-detected |
| Root Directory | `./` | Default |
| Build Command | `npm run build` | Default |
| Output Directory | `.next` | Default |
| Install Command | `npm install` | Default |
| Node.js Version | **22.x** | Match local development |
| Build and Development Settings → Build Command | `npx next build` | Override if custom build needed |

### 3.2 next.config.ts Updates

Ensure `next.config.ts` includes `output: "standalone"` for optimized Vercel deployments:

```typescript
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",  // <-- ADD THIS LINE
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
export default withNextIntl(nextConfig);
```

Commit and push this change before deploying:

```bash
git add next.config.ts
git commit -m "chore: add output standalone for Vercel"
git push
```

---

## 4. Environment Variables

### 4.1 Configure via Dashboard

1. Vercel Dashboard → Project → **Settings → Environment Variables**
2. Add each variable:

**Production Environment:**

| Name | Value | Encrypt |
|------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<prod-ref>.supabase.co` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (production anon key) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (production service key) | Yes |
| `SUPABASE_URL` | `https://<prod-ref>.supabase.co` | Yes |
| `SUPABASE_ANON_KEY` | `eyJ...` (production anon key) | Yes |

3. Repeat for **Preview** and **Development** environments with staging/local values.

**Preview Environment (staging):**

Use the existing staging Supabase project (`dyfgflmrsmzgvpknbesi`):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dyfgflmrsmzgvpknbesi.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging service key |
| `SUPABASE_URL` | Same as staging URL |
| `SUPABASE_ANON_KEY` | Same as staging anon key |

**Development Environment (local):**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From `supabase status` output |
| `SUPABASE_URL` | Same as local URL |
| `SUPABASE_ANON_KEY` | Same as local anon key |

### 4.2 Configure via CLI (Alternative)

```bash
# Production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Paste value, press Enter
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production

# Repeat for preview and development environments
# vercel env add <NAME> preview
# vercel env add <NAME> development
```

### 4.3 Verify Configuration

```bash
vercel env ls
```

Expected output: 15 entries (5 variables × 3 environments)

---

## 5. First Production Deploy

### 5.1 Via Dashboard

1. Vercel Dashboard → Project → **Deployments**
2. Click **"Deploy"** (or will auto-deploy if configured)
3. Monitor build logs:
   ```
   Cloning repository...
   Installing dependencies...
   Running build...
   ✔  Build completed
   ✔  Deploying...
   ✔  Deployment ready
   ```
4. Note the deployment URL: `https://church-ministry-crm.vercel.app`

### 5.2 Via CLI

```bash
# Deploy to production
vercel --prod
```

The CLI will build and deploy. Output:
```
🔍  Inspect: https://vercel.com/your-team/church-ministry-crm/...
✅  Production: https://church-ministry-crm.vercel.app
```

### 5.3 Common Build Errors

| Error | Likely Cause | Fix |
|-------|-------------|-----|
| `Missing SUPABASE_URL` | Env vars not set | Verify all 5 env vars are configured for Production environment |
| `Module not found` | npm install failed | Check `package-lock.json` is committed, run `npm ci` locally |
| `TypeScript error` | Strict mode catching issue | Fix type error in source code, re-push |
| `Build failed` at lint step | ESLint error | Run `npm run lint` locally and fix |

---

## 6. Custom Domain Setup

### 6.1 Add Domain in Vercel

1. Vercel Dashboard → Project → **Settings → Domains**
2. Enter your domain: `crm.<your-church>.com`
3. Click **"Add"**
4. Vercel shows DNS configuration required

### 6.2 Configure DNS (Cloudflare)

1. Log into Cloudflare Dashboard → **DNS → Records**
2. Add these records:

| Type | Name | Target | Proxy Status |
|------|------|--------|--------------|
| CNAME | `@` | `cname.vercel-dns.com` | **DNS only** (grey cloud) |
| CNAME | `www` | `cname.vercel-dns.com` | **DNS only** (grey cloud) |

**⚠️ Important:** Set proxy to **DNS only** (grey cloud icon), not Proxied (orange cloud). Vercel handles SSL and DDoS protection. Cloudflare's proxy can conflict with Vercel's SSL termination.

### 6.3 SSL Certificate

Vercel automatically provisions a Let's Enctypt SSL certificate:

1. After adding DNS records, wait 1–5 minutes
2. Vercel Dashboard → Domains → Status shows **"Certificate provisioning"** → **"Valid"**
3. Visit `https://crm.<your-church>.com` — must show valid SSL padlock

### 6.4 Force HTTPS

Vercel automatically redirects HTTP → HTTPS. No additional configuration needed.

---

## 7. Git Integration & Auto-Deploy

### 7.1 Configure in Vercel Dashboard

1. Vercel Dashboard → Project → **Settings → Git**
2. Verify GitHub connection shows `church-ministry-crm`
3. **Production Branch:** `main`
4. **Auto-deploy:** Enable (green toggle)
5. **Ignore Build Step:** Leave empty (build on every push)

### 7.2 Preview Deployments

With Git integration enabled:
- Every PR to `main` triggers a preview deployment
- Vercel bot posts the preview URL as a PR comment
- Preview URL format: `https://church-ministry-crm-git-<branch>-<team>.vercel.app`

### 7.3 Deploy Hooks (Optional)

For triggering deployments from external services:

1. Vercel Dashboard → Project → **Settings → Git → Deploy Hooks**
2. Create hook for `main` branch
3. Use `curl -X POST <hook-url>` for external triggers (e.g., after DB migration)

---

## 8. Post-Deployment Verification

Execute these checks after each deployment:

### 8.1 URL Tests

```bash
# Application loads
curl -s -o /dev/null -w "%{http_code}" https://crm.<your-church>.com/login
# Expected: 200

# SSL valid
curl -sI https://crm.<your-church>.com | grep "HTTP/"
# Expected: HTTP/2 200
```

### 8.2 Browser Tests

| Test | Expected |
|------|----------|
| Load login page | Page renders with Tailwind styles |
| Navigate to `/ar/login` | Arabic RTL layout |
| Navigate to `/en/login` | English LTR layout |
| Open DevTools → Console | Zero errors |
| Open DevTools → Network | All Supabase calls to production URL |
| Login as admin | Redirect to dashboard |
| Refresh page | Session persists (still logged in) |

---

## 9. Vercel Analytics (Post-MVP)

1. Vercel Dashboard → Project → **Analytics**
2. Click **"Enable Speed Insights"**
3. Click **"Enable Web Analytics"**
4. No code changes needed — Vercel injects analytics automatically

---

## 10. Troubleshooting

### 10.1 Deployment Stuck at "Building"

```
npm ERR! code ENOENT
npm ERR! syscall open
```

**Fix:** Ensure all files are committed and pushed. Vercel clones the exact commit — uncommitted files are not included.

### 10.2 "Application error: connection refused"

**Cause:** Supabase URL or anon key mismatch.  
**Fix:** Verify `NEXT_PUBLIC_SUPABASE_URL` matches the production Supabase project URL.

### 10.3 "Auth session not found" after login

**Cause:** Cookie configuration issue with SSR.  
**Fix:** Ensure `@supabase/ssr` is configured correctly in `middleware.ts`. Check that cookies are set with `Secure` flag (automatic on HTTPS).

### 10.4 Custom domain shows "Not found"

**Cause:** DNS not propagated or proxy enabled.  
**Fix:** 
1. Verify Cloudflare DNS records point to `cname.vercel-dns.com`
2. Ensure Cloudflare proxy is **DISABLED** (grey cloud)
3. Wait up to 5 minutes for DNS propagation

### 10.5 Build takes longer than expected

**Cause:** Large `.next` cache or cold start.  
**Fix:** First build on Vercel is always slower. Subsequent builds use cache. If consistently slow, check for large assets in `/public`.
