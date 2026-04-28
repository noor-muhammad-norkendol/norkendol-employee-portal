-- CRM Phase 1, Step 1: Canonical `claims` table
--
-- Creates the canonical per-claim record that becomes the hub of the CRM
-- module. Spokes (onboarding_clients, estimates, litigation_files, mediations,
-- appraisals, pa_settlements, claim_health_records) FK into this via claim_id
-- in subsequent migration steps.
--
-- Applied to live DB (`hkscsovtejeedjebytsv`) on 2026-04-27 via the Supabase
-- dashboard SQL Editor, chunk by chunk. This file captures the exact
-- statements that were run, in run order, so the repo's migration history
-- matches the live schema.
--
-- See `.planning/CRM-PLAN.md` for the full Phase 1 plan, decision log, and
-- subsequent steps.

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 1 — Table + comment
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE claims (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,

  -- Identifiers
  file_number              text NOT NULL,
  claim_number             text,

  -- Client (flat for v1; Clients table is a future phase)
  client_name              text,
  client_first_name        text,
  client_last_name         text,

  -- Property / loss location (flat for v1; Properties table is a future phase)
  loss_address             text,
  loss_street              text,
  loss_line2               text,
  loss_city                text,
  loss_state               text,
  loss_zip                 text,
  loss_description         text,

  -- Loss specifics
  peril                    text CHECK (peril IS NULL OR peril IN (
    'Water','Fire','Hurricane','Hail','Wind','Wind/Hail','Flood',
    'Lightning','Theft','Vandalism','Other'
  )),
  date_of_loss             date,

  -- Insurer / policy (flat for v1; claim_insurer_policy is Phase 9)
  insurance_company        text,
  policy_number            text,
  carrier_adjuster         text,
  carrier_adjuster_email   text,
  carrier_adjuster_phone   text,

  -- Active driver — single adjuster per "Assigned badge = active driver only"
  assigned_adjuster_id     uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Phase rollup
  current_phase            text NOT NULL DEFAULT 'Intake' CHECK (current_phase IN (
    'Intake','Estimating','Negotiation','In Litigation','In Mediation',
    'In Appraisal','In PA Settlement','Closed'
  )),

  -- Lifecycle
  is_legacy                boolean NOT NULL DEFAULT false,
  closed_at                timestamptz,

  -- Audit
  created_by               uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT claims_file_number_unique_per_org UNIQUE (org_id, file_number)
);

COMMENT ON TABLE claims IS
  'Canonical per-claim record. Hub of the CRM hub-and-spoke architecture. '
  'Spokes (onboarding_clients, estimates, litigation_files, mediations, '
  'appraisals, pa_settlements, claim_health_records) FK into this via claim_id '
  'added in subsequent migration steps.';

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 2 — Indexes
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX claims_org_id_idx            ON claims(org_id);
CREATE INDEX claims_file_number_idx       ON claims(file_number);
CREATE INDEX claims_claim_number_idx      ON claims(claim_number) WHERE claim_number IS NOT NULL;
CREATE INDEX claims_assigned_adjuster_idx ON claims(assigned_adjuster_id) WHERE assigned_adjuster_id IS NOT NULL;
CREATE INDEX claims_current_phase_idx     ON claims(current_phase);
CREATE INDEX claims_loss_state_idx        ON claims(loss_state);
CREATE INDEX claims_is_legacy_idx         ON claims(is_legacy) WHERE is_legacy = true;

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 3a — Enable RLS + SELECT policies
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- SELECT: admins see all org claims
CREATE POLICY "Admins see all org claims"
  ON claims FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role IN ('admin','super_admin','system_admin')
    )
  );

-- SELECT: assigned adjuster sees own claims (non-admin internal users)
CREATE POLICY "Adjuster sees assigned claim"
  ON claims FOR SELECT
  USING (
    assigned_adjuster_id = auth.uid()
    AND auth.uid() IN (
      SELECT id FROM users WHERE user_type = 'internal' AND status = 'active'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 3b — INSERT, UPDATE, DELETE policies
-- ────────────────────────────────────────────────────────────────────────────

-- INSERT: any active internal user, scoped to their org
CREATE POLICY "Internal users insert org claims"
  ON claims FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND user_type = 'internal'
        AND status = 'active'
    )
  );

-- UPDATE: assigned adjuster updates own claim
CREATE POLICY "Adjuster updates assigned claim"
  ON claims FOR UPDATE
  USING (
    assigned_adjuster_id = auth.uid()
    AND auth.uid() IN (
      SELECT id FROM users WHERE user_type = 'internal' AND status = 'active'
    )
  );

-- UPDATE: admins update any org claim
CREATE POLICY "Admins update org claims"
  ON claims FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role IN ('admin','super_admin','system_admin')
    )
  );

-- DELETE: admins only
CREATE POLICY "Admins delete org claims"
  ON claims FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role IN ('admin','super_admin','system_admin')
    )
  );

-- External partners (ep_user, ep_admin) get no policies → no access in Step 1.
-- Step 7 will add personnel-mediated access for both internal non-admins and
-- external partners once `claim_personnel` exists.
