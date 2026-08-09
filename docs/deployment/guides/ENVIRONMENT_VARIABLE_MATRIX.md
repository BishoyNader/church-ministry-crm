# Environment Variable Matrix — Church Ministry CRM

**Last Updated:** 2026-08-06 (Sprint 2 hardening)  
**Source of Truth:** Supabase Dashboard (keys) + Vercel Dashboard (deployment)  

---

## Variable Definitions

### 1. `NEXT_PUBLIC_SUPABASE_URL`

| Property | Value |
|----------|-------|
| **Description** | Supabase project API URL. Used by all Supabase clients (browser, server, admin). |
| **Format** | `https://<project-ref>.supabase.co` |
| **Source of Truth** | Supabase Dashboard → Settings → API → Project URL |
| **Visibility** | 🔓 **Public** — exposed to client bundle via `NEXT_PUBLIC_` prefix |
| **Environments Used** | Production, Preview, Development, Local |
| **Rotation Procedure** | Rotate by creating a new Supabase project (cannot change project URL). Only rotate if the project is decommissioned. |
| **Fallback** | `SUPABASE_URL` (server-only) |
| **Required** | YES — app will throw on startup if missing |

### 2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`

| Property | Value |
|----------|-------|
| **Description** | Supabase anonymous (public) API key. Used by browser and server clients. RLS protects data. |
| **Format** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (JWT string) |
| **Source of Truth** | Supabase Dashboard → Settings → API → anon public key |
| **Visibility** | 🔓 **Public** — exposed to client bundle via `NEXT_PUBLIC_` prefix |
| **Environments Used** | Production, Preview, Development, Local |
| **Rotation Procedure** | 1. Supabase Dashboard → Settings → API → "Rotate anon key"<br>2. Copy new key immediately (old key invalidated within 60s)<br>3. Update Vercel environment variables for all environments<br>4. Re-deploy application<br>5. Verify auth flows work with new key |
| **Rotation Frequency** | Rotate immediately if compromised. Otherwise, rotate quarterly. |
| **Fallback** | `SUPABASE_ANON_KEY` (server-only) |
| **Required** | YES — app will throw on startup if missing |

### 3. `SUPABASE_SERVICE_ROLE_KEY`

| Property | Value |
|----------|-------|
| **Description** | Supabase service role (admin) API key. Bypasses RLS. Used only in server-side admin client for privileged operations (e.g., user signup). |
| **Format** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (JWT string, different from anon key) |
| **Source of Truth** | Supabase Dashboard → Settings → API → service_role key |
| **Visibility** | 🔒 **Server-Only** — NEVER exposed to client. NOT prefixed with `NEXT_PUBLIC_`. |
| **Environments Used** | Production (required), Preview (required if staging needs admin ops), Development (optional), Local (optional) |
| **Rotation Procedure** | 1. Supabase Dashboard → Settings → API → "Rotate service_role key"<br>2. Copy new key immediately (old key invalidated within 60s)<br>3. Update Vercel environment variables for Production only<br>4. Re-deploy application<br>5. Verify server-side operations (signup, migrations) work |
| **Rotation Frequency** | Rotate immediately if exposed or compromised. Every 6 months. |
| **⚠️ Warning** | This key has **full admin access** to your Supabase project. Never commit to version control. Never use in client-side code. |
| **Required** | YES — function `getSupabaseServiceRoleKey()` throws if missing |

### 4. `SUPABASE_URL`

| Property | Value |
|----------|-------|
| **Description** | Server-only fallback for Supabase API URL. Read when `NEXT_PUBLIC_SUPABASE_URL` is not set. |
| **Format** | `https://<project-ref>.supabase.co` |
| **Source of Truth** | Same as `NEXT_PUBLIC_SUPABASE_URL` |
| **Visibility** | 🔒 **Server-Only** — NOT exposed to client |
| **Environments Used** | Production, Preview, Development (optional fallback) |
| **Rotation Procedure** | Same as `NEXT_PUBLIC_SUPABASE_URL` (never changes for the lifetime of a project) |
| **Required** | NO — only used as fallback. Keep in sync with `NEXT_PUBLIC_SUPABASE_URL`. |

### 5. `CRON_SECRET`

| Property | Value |
|----------|-------|
| **Description** | Bearer token protecting `GET /api/cron/notifications` (Vercel Cron) and the `/api/monitoring/diagnostics` fallback gate. |
| **Format** | Long random string (`openssl rand -hex 32`) |
| **Source of Truth** | Operator-generated secret |
| **Visibility** | 🔒 **Server-Only** — never in the client bundle |
| **Environments Used** | Production (required), Preview (required for cron testing) |
| **Rotation Procedure** | Generate new value, update Vercel, re-deploy, verify cron + diagnostics still work |
| **Required** | YES for cron — cron route returns 401 without it |

### 6. `DIAGNOSTICS_TOKEN`

| Property | Value |
|----------|-------|
| **Description** | Bearer token for `GET /api/monitoring/diagnostics`. Falls back to `CRON_SECRET` when unset. |
| **Format** | Long random string |
| **Visibility** | 🔒 **Server-Only** |
| **Required** | NO (falls back to `CRON_SECRET`) — recommended for operator isolation |

### 7. `LOG_FORMAT`

| Property | Value |
|----------|-------|
| **Description** | Structured log output: `json` forces JSON-lines; production defaults to JSON via `NODE_ENV`. |
| **Format** | `json` (or unset) |
| **Required** | NO |

### 8. `NEXT_PUBLIC_BUILD_TIME`

| Property | Value |
|----------|-------|
| **Description** | Build timestamp surfaced by `/api/health` (`runtime.buildTime`) for deploy verification. Injected at build time. |
| **Format** | ISO-8601 string |
| **Required** | NO (informational) |

### 9. `SUPABASE_ANON_KEY`

| Property | Value |
|----------|-------|
| **Description** | Server-only fallback for Supabase anon key. Read when `NEXT_PUBLIC_SUPABASE_ANON_KEY` is not set. |
| **Format** | Same JWT as `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Source of Truth** | Same as `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Visibility** | 🔒 **Server-Only** — NOT exposed to client |
| **Environments Used** | Production, Preview, Development (optional fallback) |
| **Rotation Procedure** | Same as `NEXT_PUBLIC_SUPABASE_ANON_KEY` — rotate in sync |
| **Required** | NO — only used as fallback. Keep in sync with `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |

---

## Environment Values

### Production

| Variable | Value | Source |
|----------|-------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<prod-ref>.supabase.co` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (production anon key) | Supabase Dashboard → Settings → API (rotated) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (production service key) | Supabase Dashboard → Settings → API |
| `SUPABASE_URL` | Same as `NEXT_PUBLIC_SUPABASE_URL` | Same source |
| `SUPABASE_ANON_KEY` | Same as `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same source (rotated) |
| `CRON_SECRET` | `openssl rand -hex 32` | Operator-generated |
| `DIAGNOSTICS_TOKEN` | `openssl rand -hex 32` (recommended) | Operator-generated |
| `LOG_FORMAT` | `json` | Operator |
| `NEXT_PUBLIC_BUILD_TIME` | ISO timestamp at deploy | CI/CD pipeline |

### Preview (Staging)

| Variable | Value | Source |
|----------|-------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<staging-ref>.supabase.co` | Staging Supabase project (existing) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (staging anon key) | Staging Supabase Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (staging service key) | Staging Supabase Dashboard |
| `SUPABASE_URL` | Same as staging URL | Same source |
| `SUPABASE_ANON_KEY` | Same as staging anon key | Same source |

### Development (Local)

| Variable | Value | Source |
|----------|-------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` | Local Supabase CLI |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (local anon key) | Output of `supabase status` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (local service key) | Output of `supabase status` |
| `SUPABASE_URL` | Same as local URL | Same source |
| `SUPABASE_ANON_KEY` | Same as local anon key | Same source |

---

## Variable Lifecycle

### How Variables Are Read

```typescript
// src/lib/supabase/config.ts
export function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  // Falls back to server-only vars if public vars are missing
  return { supabaseUrl, supabaseAnonKey };
}
```

**Fallback chain:**
1. `NEXT_PUBLIC_SUPABASE_*` (public, prefixed for client bundle)
2. `SUPABASE_*` (server-only, no prefix — NOT in client bundle)
3. Both must resolve — app throws `Missing Supabase environment variables`

### Where Variables Are Used

| File | Variable | Environment |
|------|----------|-------------|
| `src/lib/supabase/client.ts` | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser |
| `src/lib/supabase/server.ts` | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Server (Next.js) |
| `src/lib/supabase/middleware.ts` | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Edge middleware |
| `src/lib/supabase/admin.ts` | `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `next.config.ts` (env block) | All — forwarded to runtime | Build-time injection |

### Vercel Environment Configuration

Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Production | Preview | Development |
|----------|-----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Production URL | ✅ Staging URL | ✅ Local URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Production anon key | ✅ Staging anon key | ✅ Local anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Production key | ✅ Staging key | ⬜ Optional |
| `SUPABASE_URL` | ✅ Production URL | ✅ Staging URL | ✅ Local URL |
| `SUPABASE_ANON_KEY` | ✅ Production anon key | ✅ Staging anon key | ✅ Local anon key |

**Total:** 15 entries (5 vars × 3 environments)

---

## Security Rules

| Rule | Rationale |
|------|-----------|
| Never commit `.env*` files | `.env*` is in `.gitignore` |
| Never expose `SUPABASE_SERVICE_ROLE_KEY` to client | This key bypasses RLS — full admin access |
| Rotate anon key on first production setup | The development anon key may have been exposed |
| Use separate keys per environment | Prevents cross-environment data access |
| Store all secrets in 1Password/vault | Backup if team member leaves or Vercel account is compromised |
| Do not use the same anon key for staging and production | Isolation between environments |
