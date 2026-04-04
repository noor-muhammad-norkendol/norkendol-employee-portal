-- TPN Phase 7: Activity log for external contact changes
CREATE TABLE tpn_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES external_contacts(id) ON DELETE SET NULL,
  firm_id uuid REFERENCES firms(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tpn_activity_log_org ON tpn_activity_log(org_id, created_at DESC);

ALTER TABLE tpn_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_activity" ON tpn_activity_log
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "authenticated_insert_activity" ON tpn_activity_log
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
  );
