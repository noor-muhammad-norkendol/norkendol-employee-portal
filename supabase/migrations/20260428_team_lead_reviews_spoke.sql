-- Spoke #9: Team Lead Support (Phase 1 + Phase 2 reviews)
-- Created 2026-04-28
--
-- Single table holds both phases via the `phase` discriminator. One row per
-- (claim, phase) combination — UNIQUE(org_id, file_number, phase). Phase 1 sits
-- between Onboarding and Scope of Loss; Phase 2 sits between Estimating and
-- Adjuster KPI.
--
-- Carries the full 9-column canonical set per the Canonical CRM Spoke Standard
-- (HANDOFF.md, locked 2026-04-28). Peril is driven by the peril_types lookup,
-- so no CHECK constraint on the peril column.
--
-- Auto-create: rows are inserted by app code in the upstream spoke's update
-- mutation when the upstream row's status flips to a terminal value
-- (Onboarder 'completed' → Phase 1 row; Estimator 'closed'/'settled' → Phase 2
-- row). NOT a DB trigger — visible/debuggable, matches existing zero-trigger
-- pattern.
--
-- Applied to live DB (`hkscsovtejeedjebytsv`) on 2026-04-28 chunk-by-chunk via
-- the Supabase dashboard SQL Editor. This file captures the exact statements
-- that were run, in run order.
--
-- Access model:
--   - SELECT: super_admin all org / creator own / assigned adjuster on linked
--     claim / reviewer assigned to row (NEW pattern for auto-created rows)
--   - INSERT: any active internal user (auto-create runs as signed-in user)
--   - UPDATE: creator OR reviewer OR super_admin
--   - DELETE: super_admin only

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 1 — Table + comment
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE team_lead_reviews (
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

  -- Status — per-spoke meaning: review state
  status                   text NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','in_review','approved','kicked_back')),

  -- TLS-specific: phase discriminator
  phase                    text NOT NULL
                           CHECK (phase IN ('phase_1','phase_2')),

  -- TLS-specific: review metadata
  reviewer_id              uuid REFERENCES users(id) ON DELETE SET NULL,
  decision_at              timestamptz,
  decision_notes           text,
  kick_back_reason         text,

  -- Audit
  created_by               uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT team_lead_reviews_unique_per_claim_phase
    UNIQUE (org_id, file_number, phase)
);

COMMENT ON TABLE team_lead_reviews IS
  'Team Lead Support reviews (Spoke #9). One row per (claim, phase) — Phase 1 '
  'gates pre-Estimating; Phase 2 gates pre-Adjuster. Carries the full 9-column '
  'canonical set per the Canonical CRM Spoke Standard. Rows auto-created by '
  'upstream spoke''s update mutation when status flips to a terminal value.';

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 2 — Indexes
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX team_lead_reviews_org_id_idx
  ON team_lead_reviews (org_id);

CREATE INDEX team_lead_reviews_claim_id_idx
  ON team_lead_reviews (claim_id) WHERE claim_id IS NOT NULL;

CREATE INDEX team_lead_reviews_file_number_idx
  ON team_lead_reviews (file_number) WHERE file_number IS NOT NULL;
CREATE INDEX team_lead_reviews_claim_number_idx
  ON team_lead_reviews (claim_number) WHERE claim_number IS NOT NULL;
CREATE INDEX team_lead_reviews_policy_number_idx
  ON team_lead_reviews (policy_number) WHERE policy_number IS NOT NULL;
CREATE INDEX team_lead_reviews_client_name_idx
  ON team_lead_reviews (client_name) WHERE client_name IS NOT NULL;
CREATE INDEX team_lead_reviews_loss_address_idx
  ON team_lead_reviews (loss_address) WHERE loss_address IS NOT NULL;

CREATE INDEX team_lead_reviews_status_idx
  ON team_lead_reviews (status);

CREATE INDEX team_lead_reviews_phase_idx
  ON team_lead_reviews (phase);

CREATE INDEX team_lead_reviews_reviewer_id_idx
  ON team_lead_reviews (reviewer_id) WHERE reviewer_id IS NOT NULL;

CREATE INDEX team_lead_reviews_created_at_idx
  ON team_lead_reviews (created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 3a — Enable RLS + SELECT policies
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE team_lead_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin sees all org tls reviews"
  ON team_lead_reviews FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role = 'super_admin'
    )
  );

CREATE POLICY "Internal users see own tls reviews"
  ON team_lead_reviews FOR SELECT
  USING (
    created_by = auth.uid()
    AND auth.uid() IN (
      SELECT id FROM users WHERE user_type = 'internal' AND status = 'active'
    )
  );

CREATE POLICY "Adjuster sees tls reviews on assigned claim"
  ON team_lead_reviews FOR SELECT
  USING (
    claim_id IN (
      SELECT id FROM claims
      WHERE assigned_adjuster_id = auth.uid()
    )
    AND auth.uid() IN (
      SELECT id FROM users WHERE user_type = 'internal' AND status = 'active'
    )
  );

CREATE POLICY "Reviewer sees tls reviews assigned to them"
  ON team_lead_reviews FOR SELECT
  USING (
    reviewer_id = auth.uid()
    AND auth.uid() IN (
      SELECT id FROM users WHERE user_type = 'internal' AND status = 'active'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 3b — Write policies
-- ────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Internal users insert org tls reviews"
  ON team_lead_reviews FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND user_type = 'internal'
        AND status = 'active'
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Creator updates own tls reviews"
  ON team_lead_reviews FOR UPDATE
  USING (
    created_by = auth.uid()
    AND auth.uid() IN (
      SELECT id FROM users WHERE user_type = 'internal' AND status = 'active'
    )
  );

CREATE POLICY "Reviewer updates assigned tls reviews"
  ON team_lead_reviews FOR UPDATE
  USING (
    reviewer_id = auth.uid()
    AND auth.uid() IN (
      SELECT id FROM users WHERE user_type = 'internal' AND status = 'active'
    )
  );

CREATE POLICY "Super admin updates org tls reviews"
  ON team_lead_reviews FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin deletes org tls reviews"
  ON team_lead_reviews FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role = 'super_admin'
    )
  );
