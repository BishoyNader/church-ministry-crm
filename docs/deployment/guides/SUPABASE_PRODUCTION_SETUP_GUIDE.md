# Supabase Production Setup Guide — Church Ministry CRM

**Last Updated:** 2026-07-30  
**Target Plan:** Pro ($25/mo)  
**Target Region:** eu-west-1 (or us-east-1)  

---

## 1. Project Creation

### 1.1 Create Project via Dashboard

1. Navigate to https://supabase.com/dashboard
2. Click **"New project"**
3. Fill in:

| Field | Value |
|-------|-------|
| Name | `church-ministry-crm-prod` |
| Database Password | Generate: `openssl rand -base64 24` → save to 1Password |
| Region | `eu-west-1` (Ireland) or `us-east-1` (N. Virginia) |
| Pricing Plan | **Pro** ($25/month) |

4. Click **"Create new project"**
5. Wait ~2 minutes for provisioning
6. Verify project status shows **"Healthy"**

### 1.2 Project Reference ID

After creation, locate:
- Supabase Dashboard → Project Settings → General → **Reference ID**
- Format: 20-character alphanumeric string (e.g., `dyfgflmrsmzgvpknbesi`)
- This is the `<project-ref>` used throughout this guide

---

## 2. Database Extensions

### 2.1 Enable Extensions

Open **SQL Editor** and execute:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### 2.2 Verify Extensions

```sql
SELECT * FROM pg_extension WHERE extname IN ('vector', 'pgcrypto');
```

**Expected:** 2 rows returned.

---

## 3. Database Migrations

### 3.1 Local CLI Setup

```bash
# Ensure you're on the correct branch with all fixes
git branch        # should be 'main' or deployment branch
git status        # should be clean

# Link local project to production Supabase
supabase link --project-ref <prod-project-ref>
# Enter database password when prompted
```

### 3.2 Apply Migrations

```bash
supabase db push
```

**Expected output:**
```
Applying migration 001_initial_schema.sql...
Applying migration 002_rls_policies.sql...
...
Applying migration 022_rls_implementation.sql...
Finished supabase db push.
```

All 22 migrations must apply without errors.

### 3.3 Verify Migration State

```bash
supabase migration list
```

All 22 migrations should show `[X]` (applied).

### 3.4 Post-Migration Verification

Execute these queries in **SQL Editor**:

```sql
-- Table count
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 29 (26 canonical + 3 backup tables)

-- Permission count
SELECT count(*) FROM permissions;
-- Expected: 52

-- RLS policy count
SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
-- Expected: 93

-- user_role_type enum values
SELECT enumlabel FROM pg_enum
JOIN pg_type t ON t.oid = enumtypid
WHERE t.typname = 'user_role_type'
ORDER BY enumsortorder;
-- Expected: platform_owner, super_admin, admin, servant
```

---

## 4. Authentication Configuration

### 4.1 Auth Settings

Supabase Dashboard → **Authentication → Settings**:

| Setting | Value | Notes |
|---------|-------|-------|
| Allow new users to sign up | **OFF** | MVP uses admin-created accounts only |
| Confirm email | **ON** | Users must verify email before accessing |
| Secure email change | **ON** | Requires confirmation of both old and new email |
| Allow anonymous sign-ins | **OFF** | Not needed |
| Session duration — access token | **3600** (1 hour) | Default is fine |
| Session duration — refresh token | **432000** (5 days) | Default; users stay logged in |
| Mailer OTP expiration | **3600** (1 hour) | Default |

### 4.2 SMTP Configuration

Required for branded email delivery. Without SMTP, Supabase sends from `no-reply@supabase.co`.

**Option A: Resend (Recommended)**

1. Sign up at https://resend.com
2. Verify domain (add TXT DNS record for DKIM)
3. Create API key: Resend Dashboard → API Keys
4. In Supabase Dashboard → Auth → Settings → **SMTP Settings**:

| Field | Value |
|-------|-------|
| SMTP Host | `smtp.resend.com` |
| SMTP Port | `465` |
| SMTP User | `resend` |
| SMTP Password | `re_<your-api-key>` (the full API key) |
| Sender Name | `Church Ministry CRM` |
| Sender Email | `noreply@<your-domain>.com` |

5. Click **"Save"**
6. Click **"Send test email"** — verify delivery

**Option B: SendGrid**

1. Sign up at https://sendgrid.com
2. Create API key: Settings → API Keys → Create Key (Full Access)
3. Verify sender: Settings → Sender Authentication → verify domain
4. Same SMTP configuration as above with SendGrid credentials

### 4.3 OAuth Providers (Optional — Post-MVP)

**Google OAuth:**

1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add Authorized Redirect URI: `https://<prod-ref>.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret
5. Supabase Dashboard → Auth → Providers → Google → Enable → paste credentials

---

## 5. Point-in-Time Recovery (PITR)

### 5.1 Enable PITR

1. Supabase Dashboard → **Database → Backups**
2. Click **"Enable PITR"**
3. 7-day retention is included in Pro plan
4. Status should show **"Active"** after a few minutes

### 5.2 Verify Backup Status

```sql
SELECT * FROM supabase_backups ORDER BY created_at DESC LIMIT 1;
```

Note: PITR is primarily managed via the Dashboard. The SQL above is a general check.

---

## 6. Storage Buckets (Post-MVP)

Not required for MVP launch, but configure when file uploads are needed.

```sql
-- Create storage buckets with RLS
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);
```

Storage RLS policies can be added later.

---

## 7. Rate Limiting

Supabase Dashboard → **Authentication → Rate Limits**:

| Endpoint | Rate Limit | Notes |
|----------|-----------|-------|
| Token refresh | 30 req/min | Per IP |
| Signup | 5 req/min | Per IP (disabled — OFF) |
| Login | 30 req/min | Per IP |
| Magic link | 5 req/min | Per email |

Default Supabase rate limits are reasonable for MVP. Adjust if you see auth throttling errors.

---

## 8. API Key Management

### 8.1 Rotate Anon Key

1. Supabase Dashboard → **Settings → API**
2. Click **"Rotate anon key"**
3. Copy the new anon key immediately (old key invalidated within 60s)
4. Update Vercel environment variables: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Re-deploy application

### 8.2 Copy Service Role Key

1. Supabase Dashboard → **Settings → API**
2. Copy `service_role key` (below the anon key)
3. Store in 1Password
4. Add to Vercel: `SUPABASE_SERVICE_ROLE_KEY` (Production only)

---

## 9. Health Check Queries

After full setup, run these to confirm everything is operational:

```sql
-- 1. Extensions enabled
SELECT extname, extversion FROM pg_extension ORDER BY extname;

-- 2. All canonical tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE '%backup%'
ORDER BY table_name;

-- 3. RLS enabled on all main tables
SELECT relname FROM pg_class
WHERE relrowsecurity = true
  AND relnamespace = 'public'::regnamespace
  AND relkind = 'r'
  AND relname NOT LIKE '%backup%'
ORDER BY relname;

-- 4. Helper functions exist
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('get_user_church_id', 'user_is_platform_owner',
                  'user_is_super_admin', 'user_is_admin',
                  'get_user_service_ids', 'get_user_stage_ids',
                  'get_user_class_ids', 'get_user_assigned_beneficiary_ids',
                  'write_audit_log', 'seed_church_roles')
ORDER BY proname;

-- 5. Auth schema exists
SELECT count(*) FROM auth.users;
-- Expected: 0 (empty production — will be populated)
```
