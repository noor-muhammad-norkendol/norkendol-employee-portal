-- Onboarder KPI System — 4 tables
-- onboarding_clients: core client record
-- onboarding_activity_logs: contact/communication tracking
-- onboarding_status_history: audit trail
-- onboarding_time_logs: session time tracking

-- ════════════════════════════════════════════
-- 1. ONBOARDING CLIENTS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS onboarding_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  created_by_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_by_name text NOT NULL DEFAULT '',

  -- Client info
  client_name text NOT NULL DEFAULT '',
  referral_source text,
  state text,
  peril text CHECK (peril IS NULL OR peril IN (
    'Water','Fire','Hurricane','Hail','Wind','Wind/Hail','Flood','Lightning','Theft','Vandalism','Other'
  )),
  onboard_type text CHECK (onboard_type IS NULL OR onboard_type IN (
    'portal','auto-contract','paper-contract','live'
  )),
  email text,
  phone text,

  -- Assignment
  assigned_user_id uuid REFERENCES public.users(id),
  assigned_user_name text,
  assigned_pa_name text,
  assignment_type text,
  date_of_loss date,

  -- Pipeline status
  status text NOT NULL DEFAULT 'new' CHECK (status IN (
    'new','step_2','step_3','final_step','on_hold',
    'completed','erroneous','revised','abandoned'
  )),
  status_entered_at timestamptz NOT NULL DEFAULT now(),
  first_attempt_at timestamptz,

  -- Contract
  contract_status text DEFAULT 'not_sent' CHECK (contract_status IS NULL OR contract_status IN (
    'not_sent','sent','signed','viewed','bounced','failed'
  )),
  contract_sent_at timestamptz,
  contract_url text,

  -- Lifecycle
  completed_at timestamptz,
  abandoned_at timestamptz,
  abandonment_reason text,
  initial_hours numeric(6,2) DEFAULT 0,
  step_0_confirmed boolean NOT NULL DEFAULT false,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oc_org ON onboarding_clients(org_id);
CREATE INDEX idx_oc_created_by ON onboarding_clients(created_by_id);
CREATE INDEX idx_oc_assigned ON onboarding_clients(assigned_user_id);
CREATE INDEX idx_oc_status ON onboarding_clients(status);
CREATE INDEX idx_oc_created_at ON onboarding_clients(created_at);

ALTER TABLE onboarding_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own onboarding clients"
  ON onboarding_clients FOR SELECT USING (
    created_by_id = auth.uid() OR assigned_user_id = auth.uid()
  );
CREATE POLICY "Users insert onboarding clients"
  ON onboarding_clients FOR INSERT WITH CHECK (created_by_id = auth.uid());
CREATE POLICY "Users update own onboarding clients"
  ON onboarding_clients FOR UPDATE USING (
    created_by_id = auth.uid() OR assigned_user_id = auth.uid()
  );
CREATE POLICY "Users delete own onboarding clients"
  ON onboarding_clients FOR DELETE USING (created_by_id = auth.uid());
CREATE POLICY "Admins see all org onboarding clients"
  ON onboarding_clients FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('admin','super_admin','system_admin'))
  );
CREATE POLICY "Admins manage all org onboarding clients"
  ON onboarding_clients FOR ALL USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('admin','super_admin','system_admin'))
  );

-- ════════════════════════════════════════════
-- 2. ONBOARDING ACTIVITY LOGS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS onboarding_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES onboarding_clients(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  activity_type text NOT NULL CHECK (activity_type IN (
    'call','text','email','note','document','status_change'
  )),
  subject text,
  body text,
  contact_target text CHECK (contact_target IS NULL OR contact_target IN (
    'insured','referral_source','pa','contractor','other'
  )),
  call_result text CHECK (call_result IS NULL OR call_result IN (
    'answered','no_answer','voicemail','busy'
  )),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oal_client ON onboarding_activity_logs(client_id);
CREATE INDEX idx_oal_org ON onboarding_activity_logs(org_id);

ALTER TABLE onboarding_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own client activity logs"
  ON onboarding_activity_logs FOR SELECT USING (
    client_id IN (SELECT id FROM onboarding_clients WHERE created_by_id = auth.uid() OR assigned_user_id = auth.uid())
  );
CREATE POLICY "Users insert activity logs"
  ON onboarding_activity_logs FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );
CREATE POLICY "Admins see all org activity logs"
  ON onboarding_activity_logs FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('admin','super_admin','system_admin'))
  );

-- ════════════════════════════════════════════
-- 3. ONBOARDING STATUS HISTORY
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS onboarding_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES onboarding_clients(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  changed_by text,
  notes text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_osh_client ON onboarding_status_history(client_id);
CREATE INDEX idx_osh_org ON onboarding_status_history(org_id);

ALTER TABLE onboarding_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own client status history"
  ON onboarding_status_history FOR SELECT USING (
    client_id IN (SELECT id FROM onboarding_clients WHERE created_by_id = auth.uid() OR assigned_user_id = auth.uid())
  );
CREATE POLICY "Users insert status history"
  ON onboarding_status_history FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );
CREATE POLICY "Admins see all org status history"
  ON onboarding_status_history FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('admin','super_admin','system_admin'))
  );

-- ════════════════════════════════════════════
-- 4. ONBOARDING TIME LOGS
-- ════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS onboarding_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  client_id uuid REFERENCES onboarding_clients(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('entry_form','client_work')),
  status_at_time text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_otl_client ON onboarding_time_logs(client_id);
CREATE INDEX idx_otl_org ON onboarding_time_logs(org_id);

ALTER TABLE onboarding_time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own time logs"
  ON onboarding_time_logs FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );
CREATE POLICY "Users insert time logs"
  ON onboarding_time_logs FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );
CREATE POLICY "Admins see all org time logs"
  ON onboarding_time_logs FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('admin','super_admin','system_admin'))
  );
