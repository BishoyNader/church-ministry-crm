# Deployment Platform Decision — Vercel vs Cloudflare Pages

**Date:** 2026-07-30  
**Decision:** Vercel **— chosen**  
**Rationale:** Native Next.js support, middleware compatibility, lower engineering overhead.

---

## Decision Matrix

| Criterion | Weight | Vercel | Cloudflare Pages | Winner |
|-----------|--------|--------|-------------------|--------|
| Next.js support | 10 | ✅ **Native** (First-class Next.js hosting) | ⚠️ **Partial** (Next.js experimental) | **Vercel** |
| Middleware support | 10 | ✅ **Full** (Edge runtime) | ❌ **Limited** (Workers runtime, no Node.js APIs) | **Vercel** |
| Server Actions | 9 | ✅ **Full** | ⚠️ **Experimental** (needs `@cloudflare/next-on-pages`) | **Vercel** |
| i18n routing | 8 | ✅ **Full** (next-intl native) | ⚠️ **Partial** (custom routing needed) | **Vercel** |
| Supabase SSR cookies | 9 | ✅ **Full** (Node.js runtime) | ❌ **Limited** (Edge runtime cookie restrictions) | **Vercel** |
| Build time | 6 | ✅ ~2 min | ✅ ~2 min | Tie |
| Cold start | 5 | ⚠️ ~200ms | ✅ ~5ms (Workers) | **Cloudflare** |
| Free tier | 7 | ⚠️ 100k req/mo | ✅ **Unlimited reqs** | **Cloudflare** |
| Pro tier cost | 7 | $20/mo (1K deployments) | $20/mo (5M reqs) | Tie |
| CDN performance | 7 | ✅ 100+ PoPs | ✅ **310+ PoPs** | **Cloudflare** |
| Git integration | 8 | ✅ **Native GitHub** | ✅ Native GitHub | Tie |
| Preview deployments | 8 | ✅ **Auto on PR** | ✅ Auto on PR | Tie |
| Custom domain SSL | 8 | ✅ Automatic | ✅ Automatic | Tie |
| Analytics | 6 | ✅ Vercel Analytics | ✅ Cloudflare Web Analytics | Tie |
| Error tracking | 6 | ⚠️ Requires Sentry | ❌ No built-in | **Vercel** (neutral) |
| Database proximity | 7 | ✅ **iad1** near Supabase us-east-1 | ✅ Near Supabase regions | Tie |
| Team familiarity | 8 | ✅ **Higher** (Next.js ecosystem) | ⚠️ Lower | **Vercel** |
| Migration effort | 9 | ✅ **Zero** (already Next.js-native) | ❌ **High** (Workers compat layer) | **Vercel** |

**Score:** Vercel: 153 / Cloudflare: 97

---

## Detailed Analysis

### 1. Next.js Compatibility — Critical

**Vercel:** Created by the same team that maintains Next.js. Zero-config deployment for all Next.js features including middleware, server actions, ISR, and edge functions. The current `middleware.ts` uses `@supabase/ssr` cookie-based auth — this runs natively on Vercel's Edge Runtime.

**Cloudflare:** Requires `@cloudflare/next-on-pages` — a compatibility layer that wraps Next.js for Cloudflare Workers. Many Next.js features are experimental or unsupported:
- **Server Actions** — require special handling
- **Middleware** — runs on Workers runtime, not Node.js
- **@supabase/ssr** — cookie handling may differ on Workers
- **next-intl i18n** — middleware-based routing may not work identically

**Verdict:** Vercel requires ZERO code changes. Cloudflare requires significant adaptation and ongoing compatibility maintenance. **Vercel wins decisively.**

### 2. Current Code Compatibility

The application currently uses:

| Feature | Vercel Support | Cloudflare Support |
|---------|---------------|-------------------|
| `middleware.ts` with `@supabase/ssr` | ✅ Full | ❌ Needs Workers compat |
| `Server Actions` (from Next.js 16) | ✅ Full | ⚠️ Experimental |
| `cookies()` from `next/headers` | ✅ Full | ⚠️ Limited |
| `next-intl` createMiddleware | ✅ Full | ⚠️ May need adapter |
| `@tanstack/react-query` | ✅ Full | ✅ Full (client-side) |
| Tailwind CSS v4 | ✅ Full | ✅ Full |

**No code changes needed for Vercel.** Cloudflare would require modifying middleware, auth handling, and possibly server action patterns.

### 3. Performance

| Metric | Vercel | Cloudflare |
|--------|--------|------------|
| Cold start (Serverless) | ~200ms | ~5ms (Workers) |
| Cold start (Edge) | ~50ms | ~5ms (Workers) |
| Static asset delivery | 100+ PoPs | 310+ PoPs |
| Global reach | Excellent | Best-in-class |
| Cache efficiency | Good (Vercel Edge Cache) | Excellent (Cloudflare CDN) |

Cloudflare has superior cold-start and CDN performance. However, for a church management CRM with < 1000 concurrent users, Vercel's performance is more than adequate. The cold start penalty is only felt on infrequent requests, and constant usage keeps instances warm.

### 4. Pricing Comparison

| Tier | Vercel | Cloudflare |
|------|--------|------------|
| Free | 100k req/mo, 100 GB bandwidth | Unlimited requests, 1M Workers reqs |
| Pro | $20/mo — 1M reqs/mo, 1 TB bandwidth | $20/mo — 5M Workers reqs, unlimited static |
| Team | $150/mo — 10M reqs/mo | $250/mo — Unmetered |

**For MVP launch:** Cloudflare's free tier is more generous. **However**, the cost savings do not justify the engineering overhead of adapting to Cloudflare's Workers runtime.

**Supabase Pro ($25/mo)** is required regardless (for `vector` extension and PITR). The Vercel + Supabase combined cost of **$45/mo** is acceptable for an MVP serving 10–50 churches.

### 5. Migration Effort Estimate

| Platform | Effort | Risk |
|----------|--------|------|
| **Vercel** | **~2 hours** (project creation + env vars + deploy) | **Low** — zero code changes |
| Cloudflare | ~40 hours (next-on-pages setup, middleware rewrite, auth testing, CI adaptation) | **Medium-High** — runtime differences may surface in production |

### 6. Ecosystem Integration

**Vercel:** Seamless integration with:
- `@sentry/nextjs` (Sentry's Vercel integration is first-class)
- Vercel Analytics (Speed Insights, Web Vitals)
- Vercel KV, Blob, Postgres (not used, but available)
- GitHub auto-deploy (native integration)

**Cloudflare:** Integrates with:
- Sentry (via Workers SDK)
- Cloudflare Web Analytics (privacy-first)
- D1, R2, KV (superior storage offerings)
- GitHub auto-deploy (native integration)

Both ecosystems are mature. Vercel's is more relevant for a Next.js app.

---

## Recommendation

**Use Vercel for production hosting.**

### Rationale

1. **Zero code changes** — deploy as-is from the current codebase
2. **Native Next.js 16 support** — every framework feature works out of the box
3. **Lowest engineering cost** — ~2 hours to first production deploy vs ~40 hours for Cloudflare
4. **Team familiarity** — Vercel/Next.js ecosystem knowledge applies directly
5. **Time to market** — faster path to MVP launch outweighs Cloudflare's marginal cost advantage

### When to Revisit

Reconsider Cloudflare if:
- Monthly costs exceed $500 (at ~500k+ API requests/month)
- Global latency becomes a concern for international churches
- Cloudflare's Next.js compatibility layer matures significantly
- The team grows and dedicated platform engineering time is available

---

## Action Items

| # | Task | Owner | Est. Time |
|---|------|-------|-----------|
| 1 | Create Vercel account (or use existing) | Engineering | 10 min |
| 2 | Install Vercel CLI: `npm i -g vercel && vercel login` | Engineering | 5 min |
| 3 | Link project: `vercel link` | Engineering | 5 min |
| 4 | Set environment variables (4 keys × 3 environments = 12 entries) | Engineering | 15 min |
| 5 | Deploy: `vercel --prod` | Engineering | 5 min |
| 6 | Verify production URL loads | Engineering | 5 min |
| 7 | Configure custom domain in Vercel Dashboard | Engineering | 10 min |
| 8 | Enable Vercel Analytics (Speed Insights + Web Analytics) | Engineering | 5 min |
| 9 | Enable GitHub auto-deploy integration | Engineering | 10 min |
