-- KPI Snapshots — universal KPI pipeline for Executive Intelligence
-- Every module (claim_health, onboarding, training, etc.) writes here.
-- Executive Intelligence reads from here.
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  source_module  text NOT NULL,                     -- 'claim_health', 'onboarding', 'training', etc.
  metric_key     text NOT NULL,                     -- 'avg_days_to_settlement', 'avg_pct_increase', etc.
  metric_value   numeric(14,4) NOT NULL DEFAULT 0,
  metric_unit    text NOT NULL DEFAULT '',           -- 'days', '%', 'count', 'per_day'
  period_start   date NOT NULL,
  period_end     date NOT NULL,
  metadata       jsonb DEFAULT '{}',                 -- optional extra context
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_kpi_org ON kpi_snapshots(org_id);
CREATE INDEX idx_kpi_module ON kpi_snapshots(source_module);
CREATE INDEX idx_kpi_key ON kpi_snapshots(metric_key);
CREATE INDEX idx_kpi_period ON kpi_snapshots(period_start, period_end);

-- RLS
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;

-- Admins and super admins can read KPIs
CREATE POLICY "Admins read kpi snapshots"
  ON kpi_snapshots FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('admin','super_admin','system_admin')
    )
  );

-- Any authenticated user can insert KPIs (modules write on behalf of users)
CREATE POLICY "Authenticated users insert kpi snapshots"
  ON kpi_snapshots FOR INSERT
  WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );
