-- Estimator KPI System — 4 tables
-- estimates: core record per estimate
-- estimate_blockers: blocker history (parent-child with estimates)
-- estimate_events: audit trail
-- sla_rules: severity-based SLA targets

-- ════════════════════════════════════════════
-- 1. ESTIMATES
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  estimator_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  estimator_name text NOT NULL DEFAULT '',

  -- File identification
  file_number text NOT NULL DEFAULT '',
  claim_number text,
  policy_number text,

  -- Client info
  client_name text NOT NULL DEFAULT '',
  property_type text CHECK (property_type IS NULL OR property_type IN ('residential','commercial','multi-family','other')),
  loss_state text,
  loss_date date,

  -- Referral
  referral_source text,
  referral_representative text,

  -- Carrier
  carrier text,
  carrier_adjuster text,
  carrier_adjuster_email text,
  carrier_adjuster_phone text,

  -- Contractor
  contractor_company text,
  contractor_rep text,
  contractor_rep_email text,
  contractor_rep_phone text,

  -- Loss details
  peril text CHECK (peril IS NULL OR peril IN (
    'Wind','Wind/Hail','Hail','Hurricane','Flood','Fire','Water','Lightning','Theft','Vandalism','Other'
  )),
  severity int CHECK (severity IS NULL OR (severity >= 1 AND severity <= 5)),

  -- Financial
  estimate_value numeric(12,2) NOT NULL DEFAULT 0,
  rcv numeric(12,2),
  acv numeric(12,2),
  depreciation numeric(12,2),
  deductible numeric(12,2),
  net_claim numeric(12,2),
  overhead_profit_pct numeric(5,2),

  -- Time tracking (split clock)
  active_time_minutes int NOT NULL DEFAULT 0,
  blocked_time_minutes int NOT NULL DEFAULT 0,
  revision_time_minutes int NOT NULL DEFAULT 0,
  total_time_minutes int NOT NULL DEFAULT 0,

  -- Status
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN (
    'assigned','in-progress','blocked','review','sent-to-carrier',
    'revision-requested','revised','settled','closed','unable-to-start'
  )),

  -- Current blocker (populated when status = blocked)
  current_blocker_type text,
  current_blocker_name text,
  current_blocker_reason text,
  current_blocked_at timestamptz,

  -- Settlement / liquidity
  actual_settlement numeric(12,2),
  settlement_date date,
  is_settled boolean NOT NULL DEFAULT false,
  settlement_variance numeric(12,2),

  -- Revisions
  revisions int NOT NULL DEFAULT 0,

  -- SLA
  sla_target_hours numeric(6,2),
  sla_breached boolean NOT NULL DEFAULT false,
  sla_breached_at timestamptz,

  -- Lifecycle dates
  date_received date NOT NULL DEFAULT CURRENT_DATE,
  date_started timestamptz,
  date_completed timestamptz,
  date_sent_to_carrier timestamptz,
  date_closed timestamptz,

  -- Notes
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_est_org ON estimates(org_id);
CREATE INDEX idx_est_estimator ON estimates(estimator_id);
CREATE INDEX idx_est_status ON estimates(status);
CREATE INDEX idx_est_date_received ON estimates(date_received);

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own estimates"
  ON estimates FOR SELECT USING (estimator_id = auth.uid());
CREATE POLICY "Users insert own estimates"
  ON estimates FOR INSERT WITH CHECK (estimator_id = auth.uid());
CREATE POLICY "Users update own estimates"
  ON estimates FOR UPDATE USING (estimator_id = auth.uid());
CREATE POLICY "Users delete own estimates"
  ON estimates FOR DELETE USING (estimator_id = auth.uid());
CREATE POLICY "Admins see all org estimates"
  ON estimates FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('admin','super_admin','system_admin'))
  );
CREATE POLICY "Admins insert org estimates"
  ON estimates FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('admin','super_admin','system_admin'))
  );

-- ════════════════════════════════════════════
-- 2. ESTIMATE BLOCKERS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS estimate_blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  blocker_type text NOT NULL CHECK (blocker_type IN (
    'scoper','public-adjuster','carrier','contractor','client','internal','documentation','other'
  )),
  blocker_name text NOT NULL DEFAULT '',
  blocker_reason text,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  duration_minutes int,
  resolution_note text,
  created_by_id uuid REFERENCES public.users(id),
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_eb_estimate ON estimate_blockers(estimate_id);
CREATE INDEX idx_eb_org ON estimate_blockers(org_id);

ALTER TABLE estimate_blockers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own estimate blockers"
  ON estimate_blockers FOR SELECT USING (
    estimate_id IN (SELECT id FROM estimates WHERE estimator_id = auth.uid())
  );
CREATE POLICY "Users insert own estimate blockers"
  ON estimate_blockers FOR INSERT WITH CHECK (created_by_id = auth.uid());
CREATE POLICY "Users update own estimate blockers"
  ON estimate_blockers FOR UPDATE USING (created_by_id = auth.uid());
CREATE POLICY "Admins see all org estimate blockers"
  ON estimate_blockers FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('admin','super_admin','system_admin'))
  );

-- ════════════════════════════════════════════
-- 3. ESTIMATE EVENTS (audit trail)
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS estimate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'status_change','blocker_set','blocker_resolved','value_updated','time_logged'
  )),
  old_value text,
  new_value text,
  created_by_id uuid REFERENCES public.users(id),
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ee_estimate ON estimate_events(estimate_id);
CREATE INDEX idx_ee_org ON estimate_events(org_id);

ALTER TABLE estimate_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read estimate events"
  ON estimate_events FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('admin','super_admin','system_admin'))
  );
CREATE POLICY "Users read own estimate events"
  ON estimate_events FOR SELECT USING (
    estimate_id IN (SELECT id FROM estimates WHERE estimator_id = auth.uid())
  );
CREATE POLICY "Authenticated users insert estimate events"
  ON estimate_events FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- ════════════════════════════════════════════
-- 4. SLA RULES
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sla_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  severity int NOT NULL CHECK (severity >= 1 AND severity <= 5),
  target_hours numeric(6,2) NOT NULL,
  warning_hours numeric(6,2) NOT NULL,
  timeout_hours numeric(6,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, severity)
);

ALTER TABLE sla_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All org users read sla rules"
  ON sla_rules FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );
CREATE POLICY "Admins manage sla rules"
  ON sla_rules FOR ALL USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('super_admin','system_admin'))
  );
