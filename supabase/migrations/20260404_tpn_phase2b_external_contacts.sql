-- Phase 2b: External contacts table
CREATE TABLE public.external_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  specialty text NOT NULL,
  specialty_other text,
  states text[],
  company_name text,
  firm_id uuid REFERENCES public.firms(id) ON DELETE SET NULL,
  city text,
  state text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

ALTER TABLE public.external_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view external contacts in their org"
  ON public.external_contacts FOR SELECT
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Admins can insert external contacts"
  ON public.external_contacts FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'ep_admin')
  );

CREATE POLICY "Admins can update external contacts"
  ON public.external_contacts FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'ep_admin')
  );

CREATE POLICY "Admins can delete external contacts"
  ON public.external_contacts FOR DELETE
  USING (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'ep_admin')
  );
