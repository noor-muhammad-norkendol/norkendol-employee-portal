-- Claim Calculator: Release type templates
-- Admins configure the verbiage/opening statements per release type.
-- Adjusters see these as read-only when using the calculator.

CREATE TABLE IF NOT EXISTS public.claim_release_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  opening_statement text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.claim_release_types ENABLE ROW LEVEL SECURITY;

-- All authenticated users in the org can read (adjusters need to see release types)
CREATE POLICY "claim_release_types_select" ON public.claim_release_types
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid()));

-- Only super_admin+ can write
CREATE POLICY "claim_release_types_insert" ON public.claim_release_types
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin')));

CREATE POLICY "claim_release_types_update" ON public.claim_release_types
  FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin')));

CREATE POLICY "claim_release_types_delete" ON public.claim_release_types
  FOR DELETE TO authenticated
  USING (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin')));
