-- Spoke #8: Claim Calculator (versioned runs)
-- Created 2026-04-28
--
-- Each row = one calculation run for a claim. Adjusters can save many rows per
-- claim, transitioning status from 'proposed' to 'final'. Math state stored as
-- jsonb for flexibility; key totals also exposed as numeric columns so reports
-- can SUM/filter without parsing JSON.
--
-- Carries the full 9-column canonical set per the Canonical CRM Spoke Standard
-- (HANDOFF.md, locked 2026-04-28). Peril is driven by the peril_types lookup,
-- so no CHECK constraint on the peril column.
--
-- Applied to live DB (`hkscsovtejeedjebytsv`) on 2026-04-28 via the Supabase
-- dashboard SQL Editor, chunk by chunk. This file captures the exact statements
-- that were run, in run order, so the repo's migration history matches the
-- live schema.
--
-- Access model (4 SELECT policies + 4 write policies):
--   - super_admin sees all org runs
--   - creator (any active internal user) sees their own runs
--   - assigned adjuster sees runs on claims they own (via claims.assigned_adjuster_id)
--   - external partners: no access
--   - INSERT: any active internal user (must set self as created_by)
--   - UPDATE: creator OR super_admin
--   - DELETE: super_admin only (audit trail preserved by versioning)
--
-- "Direct manager sees reports' runs" deferred until users.manager_id or
-- org_hierarchy goes live. Add a 4th SELECT policy then.

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 1 — Table + comment
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE claim_calculator_runs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  claim_id                 uuid REFERENCES claims(id) ON DELETE SET NULL,

  -- Canonical IDENTIFIERS (5)
  file_number              text,
  claim_number             text,
  policy_number            text,
  client_name              text,
  loss_address             text,

  -- Canonical CHARACTERISTICS (3) — peril sourced from peril_types lookup, no CHECK
  peril                    text,
  peril_other              text,
  severity                 int CHECK (severity IS NULL OR severity BETWEEN 1 AND 5),

  -- Status — per-spoke meaning: 'proposed' = work in progress, 'final' = locked/sent
  status                   text NOT NULL DEFAULT 'proposed'
                           CHECK (status IN ('proposed','final')),

  -- Calculator-specific metadata
  release_type             text,
  opening_statement        text,
  notes                    text,

  -- The math
  inputs                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_coverage           numeric(14,2),
  final_balance            numeric(14,2),
  total_possible_recovered numeric(14,2),

  -- Audit
  created_by               uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE claim_calculator_runs IS
  'Versioned calculator runs. Spoke #8 — every Save = new row. '
  'Carries the full 9-column canonical set per the Canonical CRM Spoke Standard. '
  'Math state in `inputs` jsonb; key totals also exposed as numeric columns '
  'for reporting without parsing JSON.';

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 2 — Indexes
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX claim_calculator_runs_org_id_idx
  ON claim_calculator_runs (org_id);

CREATE INDEX claim_calculator_runs_claim_id_idx
  ON claim_calculator_runs (claim_id) WHERE claim_id IS NOT NULL;

CREATE INDEX claim_calculator_runs_file_number_idx
  ON claim_calculator_runs (file_number) WHERE file_number IS NOT NULL;
CREATE INDEX claim_calculator_runs_claim_number_idx
  ON claim_calculator_runs (claim_number) WHERE claim_number IS NOT NULL;
CREATE INDEX claim_calculator_runs_policy_number_idx
  ON claim_calculator_runs (policy_number) WHERE policy_number IS NOT NULL;
CREATE INDEX claim_calculator_runs_client_name_idx
  ON claim_calculator_runs (client_name) WHERE client_name IS NOT NULL;
CREATE INDEX claim_calculator_runs_loss_address_idx
  ON claim_calculator_runs (loss_address) WHERE loss_address IS NOT NULL;

CREATE INDEX claim_calculator_runs_status_idx
  ON claim_calculator_runs (status);

CREATE INDEX claim_calculator_runs_created_at_idx
  ON claim_calculator_runs (created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 3a — Enable RLS + SELECT policies (corrected mid-flight: original
-- "Admins see all" was over-permissive; replaced with super_admin only)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE claim_calculator_runs ENABLE ROW LEVEL SECURITY;

-- SELECT: super_admin sees all runs in their org (regular admin does NOT —
-- they don't use this system per Frank 2026-04-28)
CREATE POLICY "Super admin sees all org calculator runs"
  ON claim_calculator_runs FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role = 'super_admin'
    )
  );

-- SELECT: any active internal user sees runs they themselves created
CREATE POLICY "Internal users see own calculator runs"
  ON claim_calculator_runs FOR SELECT
  USING (
    created_by = auth.uid()
    AND auth.uid() IN (
      SELECT id FROM users WHERE user_type = 'internal' AND status = 'active'
    )
  );

-- SELECT: assigned adjuster on the linked claim sees runs for that claim
-- (lets a second adjuster see runs another adjuster started on the same claim)
CREATE POLICY "Adjuster sees runs on assigned claim"
  ON claim_calculator_runs FOR SELECT
  USING (
    claim_id IN (
      SELECT id FROM claims
      WHERE assigned_adjuster_id = auth.uid()
    )
    AND auth.uid() IN (
      SELECT id FROM users WHERE user_type = 'internal' AND status = 'active'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 3b — Write policies (INSERT / UPDATE / DELETE)
-- ────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Internal users insert org calculator runs"
  ON claim_calculator_runs FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND user_type = 'internal'
        AND status = 'active'
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Creator updates own calculator runs"
  ON claim_calculator_runs FOR UPDATE
  USING (
    created_by = auth.uid()
    AND auth.uid() IN (
      SELECT id FROM users WHERE user_type = 'internal' AND status = 'active'
    )
  );

CREATE POLICY "Super admin updates org calculator runs"
  ON claim_calculator_runs FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin deletes org calculator runs"
  ON claim_calculator_runs FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role = 'super_admin'
    )
  );
