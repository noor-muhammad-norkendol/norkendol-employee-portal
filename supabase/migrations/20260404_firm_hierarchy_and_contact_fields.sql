-- Firm hierarchy levels table
CREATE TABLE public.firm_hierarchy_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  level_number integer NOT NULL,
  label varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(firm_id, level_number)
);

ALTER TABLE public.firm_hierarchy_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view firm hierarchy levels in their org"
  ON public.firm_hierarchy_levels FOR SELECT
  USING (firm_id IN (SELECT id FROM public.firms WHERE org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())));

CREATE POLICY "Admins can manage firm hierarchy levels"
  ON public.firm_hierarchy_levels FOR ALL
  USING (firm_id IN (SELECT id FROM public.firms WHERE org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()) AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'ep_admin')));

-- Add hierarchy columns to external_contacts
ALTER TABLE public.external_contacts
  ADD COLUMN hierarchy_level_id uuid REFERENCES public.firm_hierarchy_levels(id) ON DELETE SET NULL,
  ADD COLUMN reports_to_id uuid REFERENCES public.external_contacts(id) ON DELETE SET NULL,
  ADD COLUMN region varchar(100),
  ADD COLUMN market varchar(100);
