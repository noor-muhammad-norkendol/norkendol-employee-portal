-- Claim Health Records — per-claim data entered by adjusters (or auto-created from settlement tracker)
CREATE TABLE IF NOT EXISTS claim_health_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  adjuster_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  adjuster_name text NOT NULL DEFAULT '',

  -- Claim identification
  claim_id      text NOT NULL DEFAULT '',          -- e.g. CL-2026-0001
  client_name   text NOT NULL DEFAULT '',

  -- Referral info
  referral_source          text NOT NULL DEFAULT '',
  referral_representative  text NOT NULL DEFAULT '',

  -- Timeline
  start_date       date NOT NULL DEFAULT CURRENT_DATE,
  settlement_date  date,

  -- Financial
  starting_value          numeric(12,2) NOT NULL DEFAULT 0,
  final_settlement_value  numeric(12,2),

  -- Status
  status_at_intake  text NOT NULL DEFAULT 'Denied'
    CHECK (status_at_intake IN ('Denied','Below Deductible','Partial Paid','Fully Paid')),
  is_settled        boolean NOT NULL DEFAULT false,

  -- Communication
  total_communications  int NOT NULL DEFAULT 0,

  -- Adjuster-completed fields (not available from settlement tracker)
  roof_squares     numeric(8,2),
  roof_material    text,
  additional_details  text,

  -- Source tracking
  source  text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','auto')),
  settlement_tracker_file_id  uuid,   -- links back to litigation_files.id if auto-created

  -- Completion tracking
  is_complete  boolean NOT NULL DEFAULT false,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_chr_org ON claim_health_records(org_id);
CREATE INDEX idx_chr_adjuster ON claim_health_records(adjuster_id);
CREATE INDEX idx_chr_settled ON claim_health_records(is_settled);

-- RLS
ALTER TABLE claim_health_records ENABLE ROW LEVEL SECURITY;

-- Users see own records
CREATE POLICY "Users see own claim health records"
  ON claim_health_records FOR SELECT
  USING (adjuster_id = auth.uid());

-- Users insert own records
CREATE POLICY "Users insert own claim health records"
  ON claim_health_records FOR INSERT
  WITH CHECK (adjuster_id = auth.uid());

-- Users update own records
CREATE POLICY "Users update own claim health records"
  ON claim_health_records FOR UPDATE
  USING (adjuster_id = auth.uid());

-- Admins see all org records
CREATE POLICY "Admins see all org claim health records"
  ON claim_health_records FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('admin','super_admin','system_admin')
    )
  );

-- Admins can insert for any user in org (for auto-creation)
CREATE POLICY "Admins insert org claim health records"
  ON claim_health_records FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE id = auth.uid() AND role IN ('admin','super_admin','system_admin')
    )
  );
