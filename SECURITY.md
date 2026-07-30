# Security Policy

## Environment Variable Handling

### Critical Rules

1. **Never commit real credentials.** The `.env*` pattern in `.gitignore` prevents `.env.local` from being committed. The `.env.local.example` file must **never** contain real keys.

2. **`SUPABASE_SERVICE_ROLE_KEY` is a highly privileged key.** It bypasses all Row-Level Security (RLS) policies and has full admin access to your Supabase project. Treat it like a root password.

3. **Use the correct Supabase client for the operation:**

   | Client | When to use |
   |--------|-------------|
   | `createClient()` (browser) | Client-side components (runs under the user's session) |
   | `createClient()` (server) | Server Actions and Route Handlers (runs under the user's session, respects RLS) |
   | `createAdminClient()` | **Only** when an operation requires bypassing RLS or calling `admin.auth.admin.*` methods (e.g., creating/deleting auth users during signup) |

4. **Minimize admin client usage.** Every use of `createAdminClient()` bypasses RLS and permission checks. Always prefer the authenticated server client (`createClient()` from `server.ts`) and let RLS enforce access control.

### Environment Variables

```
# Required — public client-side keys
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Required — server-only (bypasses RLS), NEVER expose to the client
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Setup for Local Development

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
2. Replace all placeholder values with your actual Supabase project credentials from the Supabase Dashboard → Project Settings → API.
3. Never share your `.env.local` file.

### Verifying Credentials Are Not Committed

```bash
# Check if any .env files would be committed
git ls-files | grep -E '\.env'

# Ensure .env.local is not tracked
git ls-files .env.local  # should return nothing
```

## Reporting a Vulnerability

Contact the repository maintainer directly. Do not open public issues for security vulnerabilities.

## Responsible Disclosure

We follow a 90-day disclosure timeline. If you discover a vulnerability, please report it privately so we can release a fix before public disclosure.
