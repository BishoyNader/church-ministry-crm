-- ============================================================================
-- Church Ministry CRM — Promotion Table Grants for API Roles
-- Migration: 053_promotion_table_grants.sql
-- Action:
--   Supabase managed projects apply ALTER DEFAULT PRIVILEGES to every new
--   table, so tables created by migrations 046/049/050 are readable by the
--   anon/authenticated/service_role API roles there. The LOCAL development
--   stack does NOT apply default privileges to tables pushed via
--   `supabase db push --local`, so a Church Admin session got
--   "permission denied for table promotion_cycles" on local (and the promotion
--   page showed "فشل تحميل سجل الترقيات"). This migration makes the grants
--   explicit and idempotent so both environments behave identically. RLS
--   still gates every row (tenant_isolation SELECT / RPC-only writes), so
--   these grants enable access without weakening security.
-- Dependencies: 046/049/050 (table creation).
-- ============================================================================

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.annual_promotions TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.promotion_entries TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.promotion_cycles TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.promotion_servant_transitions TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.servant_service_assignments TO anon, authenticated, service_role;

COMMIT;

-- ============================================================================
-- VERIFICATION (post-apply)
-- V1 — Local (docker exec supabase_db_* psql -U postgres -d postgres):
--   SELECT has_table_privilege('anon','promotion_cycles','SELECT'),
--          has_table_privilege('authenticated','promotion_cycles','SELECT'),
--          has_table_privilege('service_role','promotion_cycles','SELECT');
--   -- true | true | true
-- ============================================================================

-- ============================================================================
-- ROLLBACK
--   REVOKE ALL ON TABLE public.annual_promotions, public.promotion_entries,
--     public.promotion_cycles, public.promotion_servant_transitions,
--     public.servant_service_assignments FROM anon, authenticated;
--   (service_role keeps its grants.)
-- ============================================================================
