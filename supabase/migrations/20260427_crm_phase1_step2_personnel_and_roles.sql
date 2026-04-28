-- CRM Phase 1, Step 2: claim_personnel_roles + claim_personnel
--
-- Wires up the people side of the CRM hub-and-spoke. Two tables:
--
-- 1. claim_personnel_roles — admin-editable lookup of role definitions
--    (org-scoped). Adding a new role = INSERT a row, no migration. Roles are
--    seeded with 23 starter values mirroring CCS's actual role taxonomy
--    (Adjuster Supervisor, Estimator, Account Executive, etc. plus external
--    TPN roles like Attorney, Appraiser, Umpire).
--
-- 2. claim_personnel — m2m linking claims to the people working them. The
--    person can be EITHER an internal users(id) OR an external
--    external_contacts(id), with a CHECK enforcing exactly one is non-null
--    (claim_personnel_person_xor). Per-row dynamic fee_pct (no role-level
--    defaults — fees vary per claim per person). Bidirectional visibility
--    toggle via has_visible_access. Separate "fully removed" lifecycle via
--    removed_at / removed_by / removal_reason.
--
-- Applied to live DB (`hkscsovtejeedjebytsv`) on 2026-04-27 via the Supabase
-- dashboard SQL Editor, chunk by chunk. This file captures the exact
-- statements that were run, in run order, so the repo's migration history
-- matches the live schema.
--
-- See `.planning/CRM-PLAN.md` for the full Phase 1 plan, decision log, and
-- subsequent steps. Approach C (lookup table) was chosen because hardcoded
-- role lists are exactly why ClaimWizard mislabels Warren Harbin on the
-- Wetzel claim — Norkendol does not replicate that limitation.

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk A — claim_personnel_roles: table + indexes + comment + RLS + policies
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE claim_personnel_roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name            text NOT NULL,
  role_kind       text NOT NULL CHECK (role_kind IN ('internal','external','either')),
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 100,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT claim_personnel_roles_name_unique_per_org UNIQUE (org_id, name)
);

CREATE INDEX claim_personnel_roles_org_id_idx    ON claim_personnel_roles(org_id);
CREATE INDEX claim_personnel_roles_role_kind_idx ON claim_personnel_roles(role_kind);
CREATE INDEX claim_personnel_roles_active_idx    ON claim_personnel_roles(is_active) WHERE is_active = true;

COMMENT ON TABLE claim_personnel_roles IS
  'Lookup of role definitions used in claim_personnel. Org-scoped and admin-editable. '
  'Adding a new role = INSERT a row (no migration). Soft-disable via is_active=false '
  'preserves history on existing claim_personnel rows.';

ALTER TABLE claim_personnel_roles ENABLE ROW LEVEL SECURITY;

-- SELECT: admins see all org rows
CREATE POLICY "Admins see all org roles"
  ON claim_personnel_roles FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role IN ('admin','super_admin','system_admin')
    )
  );

-- SELECT: non-admin internal users see active rows in their org
CREATE POLICY "Internal users see active org roles"
  ON claim_personnel_roles FOR SELECT
  USING (
    is_active = true
    AND org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND user_type = 'internal'
        AND status = 'active'
    )
  );

-- INSERT: admins only
CREATE POLICY "Admins insert org roles"
  ON claim_personnel_roles FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role IN ('admin','super_admin','system_admin')
    )
  );

-- UPDATE: admins only
CREATE POLICY "Admins update org roles"
  ON claim_personnel_roles FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role IN ('admin','super_admin','system_admin')
    )
  );

-- DELETE: admins only
CREATE POLICY "Admins delete org roles"
  ON claim_personnel_roles FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role IN ('admin','super_admin','system_admin')
    )
  );

-- External partners: no policies → no access.

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk B — Seed claim_personnel_roles with 23 starter roles
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO claim_personnel_roles (org_id, name, role_kind, sort_order)
SELECT o.id, role_data.name, role_data.role_kind, role_data.sort_order
FROM orgs o
CROSS JOIN (VALUES
  -- INTERNAL (sort 100-219 for ordering)
  ('Adjuster Supervisor',           'internal', 110),
  ('Estimator',                     'internal', 120),
  ('Estimator Supervisor',          'internal', 130),
  ('Account Executive',             'internal', 140),
  ('Account Manager',               'internal', 150),
  ('Case Manager',                  'internal', 160),
  ('National Recruiting Manager',   'internal', 170),
  ('Strategic Growth',              'internal', 180),
  ('Onboarder',                     'internal', 190),
  ('Regional President',            'internal', 200),
  ('Regional Vice President',       'internal', 210),
  ('Contract Signer',               'internal', 215),
  ('Manager',                       'internal', 219),

  -- EXTERNAL (sort 300-379)
  ('Attorney',                      'external', 310),
  ('Appraiser',                     'external', 320),
  ('Umpire',                        'external', 330),
  ('Contractor',                    'external', 340),
  ('Engineer',                      'external', 350),
  ('Restoration',                   'external', 360),
  ('Mortgagee',                     'external', 370),

  -- EITHER (sort 500-599)
  ('Public Adjuster',               'either',   510),
  ('Referral Source',               'either',   520),
  ('Other',                         'either',   599)
) AS role_data(name, role_kind, sort_order);

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk C — claim_personnel: table + indexes + comment
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE claim_personnel (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  claim_id              uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,

  -- Polymorphic person reference: exactly one must be non-null
  user_id               uuid REFERENCES users(id) ON DELETE RESTRICT,
  external_contact_id   uuid REFERENCES external_contacts(id) ON DELETE RESTRICT,

  -- Role
  role_id               uuid NOT NULL REFERENCES claim_personnel_roles(id) ON DELETE RESTRICT,
  role_other            text,

  -- Per-row dynamic
  fee_pct               numeric(5,2),
  has_visible_access    boolean NOT NULL DEFAULT true,

  -- Lifecycle audit
  added_at              timestamptz NOT NULL DEFAULT now(),
  added_by              uuid REFERENCES users(id) ON DELETE SET NULL,
  removed_at            timestamptz,
  removed_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  removal_reason        text,

  -- Standard
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT claim_personnel_person_xor CHECK (
    (user_id IS NOT NULL AND external_contact_id IS NULL)
    OR (user_id IS NULL AND external_contact_id IS NOT NULL)
  )
);

CREATE INDEX claim_personnel_org_id_idx              ON claim_personnel(org_id);
CREATE INDEX claim_personnel_claim_id_idx            ON claim_personnel(claim_id);
CREATE INDEX claim_personnel_user_id_idx             ON claim_personnel(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX claim_personnel_external_contact_id_idx ON claim_personnel(external_contact_id) WHERE external_contact_id IS NOT NULL;
CREATE INDEX claim_personnel_role_id_idx             ON claim_personnel(role_id);
CREATE INDEX claim_personnel_visible_idx             ON claim_personnel(has_visible_access) WHERE has_visible_access = true;

COMMENT ON TABLE claim_personnel IS
  'M2M linking claims to the people working them. Person can be EITHER an internal '
  'user (user_id) OR an external TPN contact (external_contact_id) — exactly one is '
  'enforced by claim_personnel_person_xor CHECK. Role references claim_personnel_roles. '
  'has_visible_access=false soft-hides from active dashboards while preserving the '
  'audit/fee record. removed_at set marks the row as fully removed (added in error). '
  'See CRM-PLAN.md decision log for the bidirectional visibility / removal_reason semantics.';

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk D — claim_personnel RLS: enable + SELECT policies
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE claim_personnel ENABLE ROW LEVEL SECURITY;

-- SELECT: admins see all org rows
CREATE POLICY "Admins see all org claim personnel"
  ON claim_personnel FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role IN ('admin','super_admin','system_admin')
    )
  );

-- SELECT: non-admin internal users see rows where they are the person OR they are
-- the assigned adjuster on the row's claim
CREATE POLICY "Internal users see relevant claim personnel"
  ON claim_personnel FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE user_type = 'internal' AND status = 'active'
    )
    AND (
      user_id = auth.uid()
      OR claim_id IN (
        SELECT id FROM claims WHERE assigned_adjuster_id = auth.uid()
      )
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk E — claim_personnel RLS: INSERT, UPDATE, DELETE policies
-- ────────────────────────────────────────────────────────────────────────────

-- INSERT: any active internal user, scoped to their org
CREATE POLICY "Internal users insert org claim personnel"
  ON claim_personnel FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND user_type = 'internal'
        AND status = 'active'
    )
  );

-- UPDATE: assigned adjuster updates their claim's personnel
CREATE POLICY "Adjuster updates assigned claim personnel"
  ON claim_personnel FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE user_type = 'internal' AND status = 'active'
    )
    AND claim_id IN (
      SELECT id FROM claims WHERE assigned_adjuster_id = auth.uid()
    )
  );

-- UPDATE: admins update any org row
CREATE POLICY "Admins update org claim personnel"
  ON claim_personnel FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role IN ('admin','super_admin','system_admin')
    )
  );

-- DELETE: admins only
CREATE POLICY "Admins delete org claim personnel"
  ON claim_personnel FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role IN ('admin','super_admin','system_admin')
    )
  );

-- External partners (ep_user, ep_admin) get no policies → no access in Step 2.
-- Step 7 will broaden access for both internal non-admins and external partners
-- once the full personnel-mediated access model is in place.
