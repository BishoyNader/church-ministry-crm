# Production Deployment Runbook — Phase 2C: Schema Migration (007–022)

**Target:** Production Supabase project + Next.js application deployment  
**Prepared:** 2026-07-30  
**Staging Verified:** ✅ All 22 migrations pass, 93/93 policies created, 52 permissions  

---

## Prerequisites

| # | Check | Owner | Status |
|---|-------|-------|--------|
| P1 | Production Supabase project exists (not yet configured) | Infrastructure | ❌ |
| P2 | Production Supabase DB URL, anon key, service role key obtained | Infrastructure | ❌ |
| P3 | `vector` extension enabled on Pro/Team plan (required by 001) | Infrastructure | ❌ |
| P4 | `shadcn` license active (v4 commercial license required) | Legal/Engineering | ❌ |
| P5 | Production DNS configured (Vercel/Cloudflare) | Infrastructure | ❌ |
| P6 | Production environment secrets populated in hosting provider | Engineering | ❌ |
| P7 | Read replica available for verification queries | Infrastructure | ❌ |
| P8 | `supabase/production` branch created and linked to production project | Engineering | ❌ |
| P9 | Current staging DB dumped and available for rollback comparison | Engineering | ❌ |
| P10 | `git tag v2.0.0-rc1` created at current HEAD | Engineering | ❌ |
| P11 | Deployment window announced to stakeholders | Communications | ❌ |
| P12 | All team members on standby (DB admin, backend, frontend) | Management | ❌ |

---

## Deployment Timeline

**Target window:** 4 hours (09:00–13:00 UTC)  
**Max acceptable downtime:** 30 minutes  
**Rollback deadline:** 13:30 UTC (30 min after window close)

---

### T-60 min: Pre-Deployment Checks

| Time | Step | Owner | Action | Verification |
|------|------|-------|--------|-------------|
| 08:00 | 1 | Infrastructure | Verify production Supabase project is accessible | `supabase link --project-ref <prod-ref>` succeeds |
| 08:05 | 2 | Infrastructure | Verify `vector` extension enabled | `SELECT * FROM pg_extension WHERE extname = 'vector'` |
| 08:10 | 3 | Infrastructure | Capture production database baseline | `pg_dump -Fc --no-owner --no-privileges -f /tmp/prod_pre_deploy.dump` |
| 08:15 | 4 | Engineering | Verify production env vars match `.env.local.example` | Compare all 4 keys: URL, anon, service_role |
| 08:20 | 5 | Engineering | Run pre-flight integrity check on production | Execute `SELECT count(*) FROM permissions` — log current value |
| 08:25 | 6 | Engineering | Auth.users integrity check | `SELECT count(*) FROM auth.users` — log |
| 08:30 | 7 | Engineering | Verify no pending Supabase migrations | `supabase migration list` shows all 22 as `[X]` on production branch |
| 08:35 | 8 | Engineering | Set `statement_timeout = '180s'` on DB session | `ALTER DATABASE postgres SET statement_timeout = '180000'` |
| 08:40 | 9 | Engineering | Verify read replica lag < 5s | Check replica lag metric |
| 08:45 | 10 | Engineering | Announce deployment start in team channel | `[DEPLOY] Phase 2C starting. Target: READY_FOR_PRODUCTION. ETA: 13:00 UTC.` |
| 08:50 | 11 | Engineering | Enable maintenance mode (if available) | Set application to maintenance page |

---

### T+0 min: Database Migrations (CRITICAL PATH)

All migrations are independent in schema but have dependency ordering. Each is applied sequentially via `supabase db push` or direct psql on the production branch.

**Rollback checkpoint:** After each migration group, verify success before proceeding.

| Time | Step | Owner | Action | Rollback Checkpoint |
|------|------|-------|--------|---------------------|
| 09:00 | 12 | DB Admin | Apply migration 007 (services table) | ✅ services table created, 11 columns |
| 09:02 | 13 | DB Admin | Apply migration 008 (classes table) | ✅ classes table created, 10 columns |
| 09:04 | 14 | DB Admin | Apply migration 009 (churches +3 cols) | ✅ contact_email, contact_phone, address_ar added |
| 09:06 | 15 | DB Admin | Apply migration 010 (profiles +2 cols) | ✅ spiritual_title, preferred_language added |
| 09:08 | 16 | DB Admin | Apply migration 011 (servants table) | ✅ servants table created, 12 columns |
| 09:11 | 17 | DB Admin | Apply migration 012 (ssa table) | ✅ servant_stage_assignments created |
| 09:14 | 18 | DB Admin | Apply migration 013 (beneficiaries rename) | ✅ children → beneficiaries, 3 backup indexes noted |
| 09:18 | 19 | DB Admin | Apply migration 014 (beneficiary_assignments) | ⚠️ **HIGH RISK** — data migration + DROP COLUMN CASCADE |
| 09:23 | 20 | DB Admin | Apply migration 015 (attendance restructure) | ✅ attendance_sessions + attendance_records created |
| 09:26 | 21 | DB Admin | Apply migration 016 (followups update) | ⚠️ **HIGH RISK** — 3 PK drops + deleted_at + enum change |
| 09:31 | 22 | DB Admin | Apply migration 017 (spiritual journal) | ✅ spiritual_journal_entries created |
| 09:33 | 23 | DB Admin | Apply migration 018 (notifications update) | ✅ channel_value dropped, type → channel renamed |
| 09:36 | 24 | DB Admin | Apply migration 019 (audit logs update) | ✅ action → text, write_audit_log recreated |
| 09:40 | 25 | DB Admin | Apply migration 020 (user_roles update) | ✅ assigned_by NOT NULL, start_date populated |
| 09:43 | 26 | DB Admin | Apply migration 021 (role & permissions) | ⚠️ **CRITICAL** — DROP FUNCTION CASCADE, DELETE 7 codes |
| 09:48 | 27 | DB Admin | Apply migration 022 (RLS implementation) | ⚠️ **CRITICAL** — 93 policies, 25 tables RLS-enabled |

**Total migration execution time:** ~60 minutes  
**Most risky:** 022 (RLS — largest scope, 414 lines) and 021 (data deletion)

---

### T+60 min: Post-Migration Verification

| Time | Step | Owner | Action | Verification |
|------|------|-------|--------|-------------|
| 10:00 | 28 | DB Admin | Verify table count | `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'` — expect 26 canonical (excluding backups) |
| 10:03 | 29 | DB Admin | Verify permission count | `SELECT count(*) FROM permissions` — expect 52 |
| 10:05 | 30 | DB Admin | Verify RLS policy count | `SELECT count(*) FROM pg_policies WHERE schemaname = 'public'` — expect 93 |
| 10:08 | 31 | DB Admin | Verify FK constraints | Run FK check query from PRODUCTION_VERIFICATION_CHECKLIST |
| 10:12 | 32 | DB Admin | Verify no orphan columns | Check no `ministry_id` or `child_id` columns remain |
| 10:15 | 33 | DB Admin | Verify enum values | `SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'user_role_type'` — expect 4 values |
| 10:18 | 34 | DB Admin | Verify RLS helper functions | `SELECT proname FROM pg_proc WHERE proname IN ('get_user_church_id', 'user_is_platform_owner', 'user_is_super_admin', 'user_is_admin')` — all 8 must exist |
| 10:22 | 35 | DB Admin | Verify write_audit_log function | `SELECT pg_get_functiondef('write_audit_log(uuid,text,text,uuid,jsonb,jsonb)'::regprocedure)` — must accept text, not audit_action |

---

### T+90 min: Application Deployment

| Time | Step | Owner | Action | Verification |
|------|------|-------|--------|-------------|
| 10:30 | 36 | Engineering | Update production env vars with new anon key (if rotated) | Verify NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY |
| 10:35 | 37 | Engineering | Build application | `npm run build` — must exit 0 |
| 10:45 | 38 | Engineering | Deploy to production hosting | `vercel --prod` or equivalent |
| 10:50 | 39 | Engineering | Verify app loads | HTTP 200 on production URL |
| 10:52 | 40 | Engineering | Verify auth flow | Login with test admin account — must redirect to dashboard |
| 10:55 | 41 | Engineering | Verify RLS does not block legitimate access | Test basic CRUD operations as admin user |
| 11:00 | 42 | Engineering | Verify i18n routing (Arabic default) | `/{lang}` routing — Arabic content loads |
| 11:05 | 43 | Engineering | Verify beneficiaries page loads | Must show data (not RLS errors) |
| 11:08 | 44 | Engineering | Verify services/stages/classes pages | Each page must render |
| 11:12 | 45 | Engineering | Verify attendance creation | Create attendance record — must succeed |
| 11:15 | 46 | Engineering | Check browser console for 403/500 errors | Zero auth or RLS errors in console |

---

### T+135 min: Smoke Tests & Monitoring

| Time | Step | Owner | Action | Verification |
|------|------|-------|--------|-------------|
| 11:15 | 47 | Engineering | Run automated smoke test suite | All tests pass |
| 11:25 | 48 | Engineering | Monitor error rates | < 0.1% error rate in production logs |
| 11:30 | 49 | Engineering | Monitor API response times | P95 < 500ms |
| 11:35 | 50 | Infrastructure | Verify read replica consistency | Replica lag < 10s |
| 11:40 | 51 | Engineering | Verify Supabase edge function logs | No unexpected errors |
| 11:45 | 52 | Engineering | Test with 3 concurrent users | No lock contention |
| 11:50 | 53 | Engineering | Announce deployment complete | `[DEPLOY] Phase 2C complete. READY_FOR_PRODUCTION.` |

---

### T+180 min: Stabilization Window

| Time | Step | Owner | Action |
|------|------|-------|--------|
| 12:00 | 54 | Engineering | Monitor error dashboard for 60 min |
| 12:30 | 55 | Engineering | Mid-window health check |
| 13:00 | 56 | Engineering | Close deployment window |

---

## Rollback Checkpoints Summary

| Checkpoint | Time | Condition | Decision |
|------------|------|-----------|----------|
| C1 | T+30 | Migrations 007–015 all pass | If any fails → ROLLBACK to pre-deploy dump |
| C2 | T+60 | Migrations 016–022 all pass | If any fails → ROLLBACK (CASCADE restores column drops) |
| C3 | T+90 | Post-migration verification passes | If verification fails → ROLLBACK before app deploy |
| C4 | T+135 | Application smoke tests pass | If critical flow fails → ROLLBACK both app and DB |
| C5 | T+180 | Stabilization window — no errors | If error rate > 1% → ROLLBACK |

---

## Communication Plan

| Event | Channel | Message |
|-------|---------|---------|
| Deployment starts | Team Slack/Teams | `[DEPLOY] Phase 2C starting. Read-only mode ETA 10 min.` |
| DB migration complete | Team Slack/Teams | `[DEPLOY] DB migrations complete (22/22). Verification in progress.` |
| App deployment starts | Team Slack/Teams | `[DEPLOY] Application version 0.1.0 deploying now.` |
| App deployment complete | Team Slack/Teams | `[DEPLOY] Application deployed. Smoke tests in progress.` |
| Rollback initiated | Team Slack/Teams | `[ROLLBACK] Rollback triggered at checkpoint Cn. Reason: ...` |
| Window closed | Stakeholder email | `Phase 2C deployment complete. All systems nominal.` |
