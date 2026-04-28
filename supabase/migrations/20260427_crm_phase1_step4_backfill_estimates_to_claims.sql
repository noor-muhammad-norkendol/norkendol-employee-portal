-- CRM Phase 1, Step 4: Backfill `claims` from existing portal data
--
-- Per CRM-PLAN.md, Step 4 backfills `claims` rows from the seven spokes
-- (onboarding_clients, estimates, litigation_files, mediations, appraisals,
-- pa_settlements, claim_health_records). In the live DB at the time this ran,
-- only `estimates` had rows that needed backfilling:
--
--   spoke                | total_rows | backfill_eligible
--   ---------------------+------------+------------------
--   appraisals           |          0 |          0
--   claim_health_records |          0 |          0
--   estimates            |          6 |          6
--   litigation_files     |          0 |          0
--   mediations           |          0 |          0
--   onboarding_clients   |          2 |          0  (neither row had status='completed')
--   pa_settlements       |          0 |          0
--
-- Within `estimates`, all 6 rows shared a single file_number (parent + 5
-- revisions of the same claim — the parent_estimate_id + revision_number
-- columns from `20260406_estimator_kpi_revisions.sql`). Per the canonical
-- claim model, one file_number = one claim, regardless of revision count.
-- DISTINCT ON (file_number) ORDER BY revision_number DESC, created_at DESC
-- picks the latest revision per claim — yielding exactly 1 claims row.
--
-- Per locked Decision Log entry (2026-04-27): "Migration strategy: launch-day
-- forward = new model. Legacy claims tagged with `AL` prefix to prevent
-- number collision." All backfilled file_numbers get `AL-` prefix.
--
-- Per locked decision (Q2 in CRM-PLAN): assigned_adjuster_id stays NULL on
-- backfilled rows that don't come from a completed onboarding_clients (only
-- onboarding_clients carries the assigned_user_id signal; estimates rows
-- carry estimator_id, which is a different role). The estimator_id is
-- captured on `created_by` instead.
--
-- Phase derivation (Option B chosen 2026-04-27): current_phase derived from
-- estimates.status — `closed` or `settled` → 'Closed', else 'Estimating'.
-- closed_at populated only when current_phase = 'Closed'.
--
-- Applied to live DB (`hkscsovtejeedjebytsv`) on 2026-04-27 via the Supabase
-- dashboard SQL Editor. Result: 6 estimates rows → 1 claims row.
--
-- Spokes other than `estimates` are no-ops in this dev environment but the
-- pattern would extend identically for any of them when their rows exist.
-- Future production rollover from CCS historical data is a separate one-time
-- import job, not part of this Step 4 (per locked decision).

INSERT INTO claims (
  org_id,
  file_number,
  claim_number,
  client_name,
  loss_state,
  peril,
  date_of_loss,
  policy_number,
  carrier_adjuster,
  carrier_adjuster_email,
  carrier_adjuster_phone,
  insurance_company,
  current_phase,
  closed_at,
  is_legacy,
  created_by,
  created_at,
  updated_at
)
SELECT DISTINCT ON (file_number)
  org_id,
  'AL-' || file_number     AS file_number,
  claim_number,
  client_name,
  loss_state,
  peril,
  loss_date                AS date_of_loss,
  policy_number,
  carrier_adjuster,
  carrier_adjuster_email,
  carrier_adjuster_phone,
  carrier                  AS insurance_company,
  CASE
    WHEN status IN ('closed', 'settled') THEN 'Closed'
    ELSE 'Estimating'
  END                      AS current_phase,
  CASE
    WHEN status = 'settled' THEN COALESCE(settlement_date::timestamptz, date_completed)
    WHEN status = 'closed'  THEN COALESCE(date_closed, date_completed)
    ELSE NULL
  END                      AS closed_at,
  true                     AS is_legacy,
  estimator_id             AS created_by,
  created_at,
  now()                    AS updated_at
FROM estimates
WHERE file_number IS NOT NULL AND file_number <> ''
ORDER BY file_number, revision_number DESC NULLS LAST, created_at DESC;
