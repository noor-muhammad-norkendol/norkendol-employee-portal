-- ════════════════════════════════════════════════════════════════════════════
-- Documents — company document repository keyed by department
--
-- Two tables (departments lookup + documents) plus a private storage bucket.
-- Department membership reuses the existing users.department text column.
-- Super admins manage everything; regular users read documents whose
-- department matches their own.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 1 — Departments lookup table
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS departments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  sort_order    int  NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT departments_unique_per_org UNIQUE (org_id, name)
);

COMMENT ON TABLE departments IS
  'Lookup table for the canonical list of departments per org. Joined to '
  'documents via the name string and to users via users.department.';

CREATE INDEX departments_org_id_idx ON departments (org_id);
CREATE INDEX departments_sort_idx   ON departments (org_id, sort_order, name);

-- Backfill from existing users.department free-text values
INSERT INTO departments (org_id, name)
SELECT DISTINCT org_id, department
FROM users
WHERE department IS NOT NULL
  AND department <> ''
ON CONFLICT (org_id, name) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 2 — Documents table
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,

  -- Department gating — joins to departments.name (text) so legacy users.department
  -- strings keep working without a backfill pass.
  department        text NOT NULL,

  -- Surfacing fields
  name              text NOT NULL,
  description       text,
  tags              text[] NOT NULL DEFAULT '{}',

  -- File metadata
  original_filename text NOT NULL,
  file_size         bigint NOT NULL,
  mime_type         text NOT NULL,
  storage_path      text NOT NULL UNIQUE, -- Supabase storage object key

  -- Versioning + telemetry
  version           int NOT NULL DEFAULT 1,
  download_count    int NOT NULL DEFAULT 0,

  -- Audit
  uploaded_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE documents IS
  'Company document repository. Each row is one uploaded file scoped to a '
  'single department; users see documents matching their users.department, '
  'super admins see all.';

CREATE INDEX documents_org_id_idx        ON documents (org_id);
CREATE INDEX documents_org_dept_idx      ON documents (org_id, department);
CREATE INDEX documents_org_created_idx   ON documents (org_id, created_at DESC);
CREATE INDEX documents_uploaded_by_idx   ON documents (uploaded_by) WHERE uploaded_by IS NOT NULL;
CREATE INDEX documents_tags_idx          ON documents USING GIN (tags);

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 3 — RLS on departments
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users see own org departments"
  ON departments FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND user_type = 'internal'
        AND status = 'active'
    )
  );

CREATE POLICY "Super admin manages org departments"
  ON departments FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role = 'super_admin'
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role = 'super_admin'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 4 — RLS on documents
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Super admin can see everything in their org
CREATE POLICY "Super admin sees all org documents"
  ON documents FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role = 'super_admin'
    )
  );

-- Internal users see documents in their own department
CREATE POLICY "Internal users see own dept documents"
  ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.user_type = 'internal'
        AND u.status = 'active'
        AND u.org_id = documents.org_id
        AND u.department = documents.department
    )
  );

-- Only super admins can write
CREATE POLICY "Super admin manages org documents"
  ON documents FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role = 'super_admin'
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND status = 'active'
        AND role = 'super_admin'
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- Chunk 5 — Storage bucket for the actual files
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('portal-documents', 'portal-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage path convention: {org_id}/{document_id}.{ext}

-- Read: regular users can read files whose corresponding documents row matches
-- their dept; super admins can read all org files.
CREATE POLICY "Read documents for own dept"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'portal-documents'
    AND (
      EXISTS (
        SELECT 1 FROM documents d, users u
        WHERE u.id = auth.uid()
          AND u.user_type = 'internal'
          AND u.status = 'active'
          AND d.storage_path = name
          AND d.org_id = u.org_id
          AND d.department = u.department
      )
      OR EXISTS (
        SELECT 1 FROM users u, documents d
        WHERE u.id = auth.uid()
          AND u.status = 'active'
          AND u.role = 'super_admin'
          AND d.storage_path = name
          AND d.org_id = u.org_id
      )
    )
  );

-- Write: super admin only
CREATE POLICY "Super admin writes document files"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'portal-documents'
    AND auth.uid() IN (
      SELECT id FROM users
      WHERE status = 'active'
        AND role = 'super_admin'
    )
  )
  WITH CHECK (
    bucket_id = 'portal-documents'
    AND auth.uid() IN (
      SELECT id FROM users
      WHERE status = 'active'
        AND role = 'super_admin'
    )
  );
