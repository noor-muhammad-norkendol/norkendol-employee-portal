-- Canonical `file_number` sweep across the 7 CRM spokes
--
-- Per Frank's locked decision (2026-04-27 / 2026-04-28): every CRM spoke must
-- carry the same five canonical identifiers (`file_number`, `claim_number`,
-- `policy_number`, `client_name`, `loss_address`) using exactly those column
-- names. No synonyms in code, no per-table renames. See memory entries
-- `feedback_canonical_vocabulary.md` and `feedback_cross_spoke_consistency.md`.
--
-- This migration is the FIRST PASS — file_number only. The other four
-- canonical columns (claim_number / policy_number / client_name / loss_address)
-- have known gaps on pa_settlements / mediations / appraisals (which today
-- pull all of them via JOIN through litigation_file_id) and on
-- litigation_files (missing claim_number) — those gaps will be closed in
-- subsequent migrations.
--
-- State BEFORE this migration:
--   onboarding_clients   ✓ has file_number (added in 20260417_claim_lookup_fields.sql)
--   estimates            ✓ has file_number (from 20260406_estimator_kpi.sql)
--   litigation_files     ✓ has file_number NOT NULL (the master)
--   pa_settlements       ✗ missing — joins through litigation_file_id
--   mediations           ✗ missing — joins through litigation_file_id
--   appraisals           ✗ missing — joins through litigation_file_id
--   claim_health_records ✗ has `claim_id text` — semantically a file_number
--                          but misnamed since the table was created
--
-- State AFTER this migration: all 7 spokes have a `file_number text` column.
-- pa_settlements / mediations / appraisals columns are nullable and empty
-- for now; backfill from the joined `litigation_files.file_number` is a
-- separate follow-up that pairs with Step 5 (claim_id FK addition) per
-- CRM-PLAN.md.
--
-- Applied to live DB (`hkscsovtejeedjebytsv`) on 2026-04-27 evening / early
-- 2026-04-28 via the Supabase dashboard SQL Editor. Code sweep across the 4
-- TypeScript files that referenced `claim_health_records.claim_id` (and the 2
-- UI labels that said "Claim ID") landed in the same commit as this file.

-- 1. claim_health_records: rename misnamed text column to canonical name
ALTER TABLE claim_health_records RENAME COLUMN claim_id TO file_number;

-- 2. pa_settlements: add file_number (was JOINed via litigation_file_id)
ALTER TABLE pa_settlements ADD COLUMN file_number text;

-- 3. mediations: add file_number (was JOINed via litigation_file_id)
ALTER TABLE mediations ADD COLUMN file_number text;

-- 4. appraisals: add file_number (was JOINed via litigation_file_id)
ALTER TABLE appraisals ADD COLUMN file_number text;
