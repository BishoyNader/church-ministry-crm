-- ============================================================================
-- Dashboard & Analytics Indexes
-- Migration: 006_dashboard_analytics_indexes.sql
-- ============================================================================

-- Support filtering followups by church + status (dashboard KPI queries)
CREATE INDEX IF NOT EXISTS idx_followups_church_status
  ON followups (church_id, status);
