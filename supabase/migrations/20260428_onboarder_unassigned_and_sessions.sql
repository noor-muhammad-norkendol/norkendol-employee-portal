-- Onboarder KPI: UNASSIGNED bucket + per-user phase session tracking
-- Created 2026-04-28
--
-- Two changes shipped together:
--
-- 1) New 'unassigned' status on onboarding_clients — leftmost workflow value.
--    All new claims default to 'unassigned' so they land in an intake bucket
--    nobody owns. Existing 'new' rows backfilled to 'unassigned' so they
--    flow through the new model fresh. Per Frank 2026-04-28: this department
--    is unique — no possession model, just a shared pool that two onboarders
--    (Reyneil + Ardee, dept='Intake') work together.
--
-- 2) New onboarding_phase_sessions table — tracks per-user time spent on
--    each card while it's in each phase. The hook useOnboardingSession
--    inserts a row when a card panel opens, heartbeats every 60s, and
--    closes the row on unmount, on idle (>21 min no DOM activity), or on
--    phase advance. Browser crashes / network drops are swept up by an
--    opportunistic orphan cleanup that runs on every fresh session start.
--
-- Applied to live DB (`hkscsovtejeedjebytsv`) on 2026-04-28 via Supabase
-- dashboard SQL Editor, chunk by chunk.

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 1 — Status enum extension + new default
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE onboarding_clients DROP CONSTRAINT IF EXISTS onboarding_clients_status_check;

ALTER TABLE onboarding_clients ADD CONSTRAINT onboarding_clients_status_check
  CHECK (status IN (
    'unassigned','new','step_2','step_3','final_step','on_hold',
    'completed','erroneous','revised','abandoned'
  ));

ALTER TABLE onboarding_clients ALTER COLUMN status SET DEFAULT 'unassigned';

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 2 — Backfill existing 'new' rows to 'unassigned'
-- ────────────────────────────────────────────────────────────────────────────

UPDATE onboarding_clients
SET status = 'unassigned',
    status_entered_at = now(),
    updated_at = now()
WHERE status = 'new';

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 3 — New onboarding_phase_sessions table
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE onboarding_phase_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  onboarding_client_id uuid NOT NULL REFERENCES onboarding_clients(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN (
    'unassigned','new','step_2','step_3','final_step','on_hold',
    'completed','erroneous','revised','abandoned'
  )),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ended_reason text CHECK (ended_reason IS NULL OR ended_reason IN (
    'card_closed','card_advanced','idle_timeout','browser_closed','orphaned'
  )),
  duration_seconds numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 4 — Indexes
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX onboarding_phase_sessions_org_id_idx ON onboarding_phase_sessions (org_id);
CREATE INDEX onboarding_phase_sessions_client_id_idx ON onboarding_phase_sessions (onboarding_client_id);
CREATE INDEX onboarding_phase_sessions_user_id_idx ON onboarding_phase_sessions (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX onboarding_phase_sessions_phase_idx ON onboarding_phase_sessions (phase);
CREATE INDEX onboarding_phase_sessions_active_idx ON onboarding_phase_sessions (last_heartbeat_at) WHERE ended_at IS NULL;
CREATE INDEX onboarding_phase_sessions_started_at_idx ON onboarding_phase_sessions (started_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 5 — Enable RLS + policies
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE onboarding_phase_sessions ENABLE ROW LEVEL SECURITY;

-- Intake users + super_admin see all org sessions
CREATE POLICY "Intake and super_admin see all org sessions"
  ON onboarding_phase_sessions FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND (department = 'Intake' OR role = 'super_admin')
    )
  );

-- Same group can insert sessions for themselves
CREATE POLICY "Intake and super_admin insert own sessions"
  ON onboarding_phase_sessions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND (department = 'Intake' OR role = 'super_admin')
    )
  );

-- Same group can update any session in their org (heartbeats, end_session,
-- orphan cleanup all need this)
CREATE POLICY "Intake and super_admin update org sessions"
  ON onboarding_phase_sessions FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND (department = 'Intake' OR role = 'super_admin')
    )
  );

-- DELETE restricted to super_admin (preserves the audit trail)
CREATE POLICY "Super admin deletes org sessions"
  ON onboarding_phase_sessions FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role = 'super_admin'
    )
  );
