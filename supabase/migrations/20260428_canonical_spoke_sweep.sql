-- Canonical CRM Spoke Standard sweep — full canonical column set on all 7 spokes
--
-- Companion to 20260428_canonical_file_number_sweep.sql, which captured the
-- file_number-only first pass earlier the same day. This migration captures
-- everything else applied to live (`hkscsovtejeedjebytsv`) on 2026-04-28
-- via the Supabase dashboard SQL Editor in chunked admin sessions:
--
--   1. peril_types lookup table (admin-editable, org-scoped, seeded with 12 perils)
--   2. Add the rest of the IDENTIFIERS (claim_number / policy_number / client_name /
--      loss_address) wherever they were missing.
--   3. Add CHARACTERISTICS (peril / peril_other / severity) wherever they were
--      missing, and drop the old peril CHECK enums on spokes that had one.
--   4. pa_settlements: rename `claim_severity text` → `severity int` with CHECK 1-5
--      to match the canonical type.
--
-- Locked design: see HANDOFF.md top section "Canonical CRM Spoke Standard",
-- `.planning/CRM-PLAN.md` decision-log row dated 2026-04-28, and the memory
-- entries `feedback_canonical_spoke_standard.md` and
-- `feedback_canonical_vocabulary.md`. Two categories on every spoke:
--
--   IDENTIFIERS (searchable):  file_number, claim_number, policy_number,
--                              client_name, loss_address
--   CHARACTERISTICS (display): peril, peril_other, severity (status deferred)
--
-- All 7 current spokes are confirmed compliant after this migration:
-- onboarding_clients, estimates, litigation_files, mediations, appraisals,
-- pa_settlements, claim_health_records.

-- ════════════════════════════════════════════════════════════════════
-- 1. peril_types — admin-editable lookup table
-- ════════════════════════════════════════════════════════════════════
-- Org-scoped (each org can curate its own peril list). Spoke columns reference
-- peril_types.name by text, NOT by FK — keeps text portability and lets a peril
-- be deleted from the lookup without breaking historical claim records. The
-- "Other" peril stays at sort_order 999 so it sticks to the bottom of UI lists;
-- when a user picks "Other" the spoke's `peril_other` text column captures the
-- free-form description (e.g., "plane crash").

CREATE TABLE IF NOT EXISTS peril_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 100,
  created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT peril_types_name_unique_per_org UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS peril_types_org_id_idx     ON peril_types (org_id);
CREATE INDEX IF NOT EXISTS peril_types_sort_order_idx ON peril_types (sort_order);
CREATE INDEX IF NOT EXISTS peril_types_active_idx     ON peril_types (is_active) WHERE is_active = true;

ALTER TABLE peril_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users see active org perils"
  ON peril_types FOR SELECT
  USING (
    is_active = true
    AND org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid() AND user_type = 'internal' AND status = 'active'
    )
  );

CREATE POLICY "Admins see all org perils"
  ON peril_types FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid() AND status = 'active'
        AND role IN ('admin','super_admin','system_admin')
    )
  );

CREATE POLICY "Admins insert org perils"
  ON peril_types FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid() AND status = 'active'
        AND role IN ('admin','super_admin','system_admin')
    )
  );

CREATE POLICY "Admins update org perils"
  ON peril_types FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid() AND status = 'active'
        AND role IN ('admin','super_admin','system_admin')
    )
  );

CREATE POLICY "Admins delete org perils"
  ON peril_types FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid() AND status = 'active'
        AND role IN ('admin','super_admin','system_admin')
    )
  );

-- Seed the 12 starter perils for every existing org. New orgs get seeded by
-- the application's org-bootstrap path (TODO if not already in place).
INSERT INTO peril_types (org_id, name, sort_order)
SELECT o.id, p.name, p.sort_order
FROM orgs o
CROSS JOIN (VALUES
  ('Wind/Hail',  10),
  ('Wind',       20),
  ('Hail',       30),
  ('Hurricane',  40),
  ('Fire',       50),
  ('Lightning',  60),
  ('Flood',      70),
  ('Smoke',      80),
  ('Vandalism',  90),
  ('Theft',     100),
  ('Water',     110),
  ('Other',     999)
) AS p(name, sort_order)
ON CONFLICT (org_id, name) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════
-- 2. Drop the old per-spoke peril CHECK enums
-- ════════════════════════════════════════════════════════════════════
-- Spokes that originally hardcoded the peril list as a CHECK constraint
-- (onboarding_clients, estimates, and any others) now defer to peril_types.
-- The peril column on every spoke is plain text — the lookup is enforced in
-- the UI layer, not at the column level, so admins can add/retire perils
-- without DDL changes.

ALTER TABLE onboarding_clients DROP CONSTRAINT IF EXISTS onboarding_clients_peril_check;
ALTER TABLE estimates          DROP CONSTRAINT IF EXISTS estimates_peril_check;
ALTER TABLE litigation_files   DROP CONSTRAINT IF EXISTS litigation_files_peril_check;
ALTER TABLE mediations         DROP CONSTRAINT IF EXISTS mediations_peril_check;
ALTER TABLE appraisals         DROP CONSTRAINT IF EXISTS appraisals_peril_check;
ALTER TABLE pa_settlements     DROP CONSTRAINT IF EXISTS pa_settlements_peril_check;

-- ════════════════════════════════════════════════════════════════════
-- 3. onboarding_clients — already had file_number, claim_number, policy_number,
--    client_name, loss_address, peril (with the old enum CHECK that section 2
--    drops). Adds: peril_other, severity. The policy_number ALTER below is a
--    no-op guard via IF NOT EXISTS.
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE onboarding_clients ADD COLUMN IF NOT EXISTS policy_number text;
ALTER TABLE onboarding_clients ADD COLUMN IF NOT EXISTS peril_other   text;
ALTER TABLE onboarding_clients ADD COLUMN IF NOT EXISTS severity      integer;
ALTER TABLE onboarding_clients
  ADD CONSTRAINT onboarding_clients_severity_check
  CHECK (severity IS NULL OR (severity BETWEEN 1 AND 5));

-- ════════════════════════════════════════════════════════════════════
-- 4. estimates — already had file_number, claim_number, policy_number,
--    client_name, peril, severity (with CHECK). Adds: loss_address, peril_other.
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS loss_address text;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS peril_other  text;
-- estimates_severity_check pre-existed from 20260406_estimator_kpi.sql.

-- ════════════════════════════════════════════════════════════════════
-- 5. litigation_files — already had file_number, policy_number, client_name,
--    loss_address, peril. Adds: claim_number, peril_other, severity. The
--    policy_number ALTER below is a no-op guard via IF NOT EXISTS.
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE litigation_files ADD COLUMN IF NOT EXISTS claim_number  text;
ALTER TABLE litigation_files ADD COLUMN IF NOT EXISTS policy_number text;
ALTER TABLE litigation_files ADD COLUMN IF NOT EXISTS peril_other   text;
ALTER TABLE litigation_files ADD COLUMN IF NOT EXISTS severity      integer;
ALTER TABLE litigation_files
  ADD CONSTRAINT litigation_files_severity_check
  CHECK (severity IS NULL OR (severity BETWEEN 1 AND 5));

-- ════════════════════════════════════════════════════════════════════
-- 6. mediations — only file_number was added in the prior migration; was
--    JOINing through litigation_file_id for everything else. Adds: full
--    canonical column set.
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE mediations ADD COLUMN IF NOT EXISTS claim_number  text;
ALTER TABLE mediations ADD COLUMN IF NOT EXISTS policy_number text;
ALTER TABLE mediations ADD COLUMN IF NOT EXISTS client_name   text;
ALTER TABLE mediations ADD COLUMN IF NOT EXISTS loss_address  text;
ALTER TABLE mediations ADD COLUMN IF NOT EXISTS peril         text;
ALTER TABLE mediations ADD COLUMN IF NOT EXISTS peril_other   text;
ALTER TABLE mediations ADD COLUMN IF NOT EXISTS severity      integer;
ALTER TABLE mediations
  ADD CONSTRAINT mediations_severity_check
  CHECK (severity IS NULL OR (severity BETWEEN 1 AND 5));

-- ════════════════════════════════════════════════════════════════════
-- 7. appraisals — same shape as mediations; was JOINing through
--    litigation_file_id. Adds: full canonical column set.
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS claim_number  text;
ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS policy_number text;
ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS client_name   text;
ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS loss_address  text;
ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS peril         text;
ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS peril_other   text;
ALTER TABLE appraisals ADD COLUMN IF NOT EXISTS severity      integer;
ALTER TABLE appraisals
  ADD CONSTRAINT appraisals_severity_check
  CHECK (severity IS NULL OR (severity BETWEEN 1 AND 5));

-- ════════════════════════════════════════════════════════════════════
-- 8. pa_settlements — had file_number, plus the existing money model.
--    Adds: claim_number, policy_number, client_name, loss_address, peril,
--    peril_other. Renames claim_severity (text) → severity (int) with CHECK.
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE pa_settlements ADD COLUMN IF NOT EXISTS claim_number  text;
ALTER TABLE pa_settlements ADD COLUMN IF NOT EXISTS policy_number text;
ALTER TABLE pa_settlements ADD COLUMN IF NOT EXISTS client_name   text;
ALTER TABLE pa_settlements ADD COLUMN IF NOT EXISTS loss_address  text;
ALTER TABLE pa_settlements ADD COLUMN IF NOT EXISTS peril         text;
ALTER TABLE pa_settlements ADD COLUMN IF NOT EXISTS peril_other   text;

-- claim_severity (text) → severity (int) rename + retype.
-- Locked text→int mapping from tonight's session: Catastrophic=5, Severe=4,
-- Moderate=3, Minor=2, anything else (including NULL or unrecognized values)
-- becomes NULL. Same mapping applies to the column whether 0 rows or N rows
-- exist at apply time — keeps the migration reproducible against any future
-- state.
ALTER TABLE pa_settlements RENAME COLUMN claim_severity TO severity;
ALTER TABLE pa_settlements
  ALTER COLUMN severity TYPE integer
  USING (
    CASE severity
      WHEN 'Catastrophic' THEN 5
      WHEN 'Severe'       THEN 4
      WHEN 'Moderate'     THEN 3
      WHEN 'Minor'        THEN 2
      ELSE NULL
    END
  );
ALTER TABLE pa_settlements
  ADD CONSTRAINT pa_settlements_severity_check
  CHECK (severity IS NULL OR (severity BETWEEN 1 AND 5));

-- ════════════════════════════════════════════════════════════════════
-- 9. claim_health_records — had file_number (renamed from claim_id in the
--    prior 20260428 migration), client_name. Adds: claim_number, policy_number,
--    loss_address, peril, peril_other, severity.
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE claim_health_records ADD COLUMN IF NOT EXISTS claim_number  text;
ALTER TABLE claim_health_records ADD COLUMN IF NOT EXISTS policy_number text;
ALTER TABLE claim_health_records ADD COLUMN IF NOT EXISTS loss_address  text;
ALTER TABLE claim_health_records ADD COLUMN IF NOT EXISTS peril         text;
ALTER TABLE claim_health_records ADD COLUMN IF NOT EXISTS peril_other   text;
ALTER TABLE claim_health_records ADD COLUMN IF NOT EXISTS severity      integer;
ALTER TABLE claim_health_records
  ADD CONSTRAINT claim_health_records_severity_check
  CHECK (severity IS NULL OR (severity BETWEEN 1 AND 5));
