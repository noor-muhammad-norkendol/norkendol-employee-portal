-- Phase 2: TPN schema completion
-- Add missing columns to firms
ALTER TABLE public.firms
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS year_established integer,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS rating numeric(2,1);

-- Add availability to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS availability text DEFAULT 'available'
  CHECK (availability IN ('available', 'busy', 'unavailable'));

-- Create firm_documents table
CREATE TABLE IF NOT EXISTS public.firm_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  uploaded_by uuid REFERENCES public.users(id),
  uploaded_at timestamptz DEFAULT now()
);

-- RLS on firm_documents
ALTER TABLE public.firm_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view firm documents in their org"
  ON public.firm_documents FOR SELECT
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Admins can insert firm documents"
  ON public.firm_documents FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'ep_admin')
  );

CREATE POLICY "Admins can delete firm documents"
  ON public.firm_documents FOR DELETE
  USING (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'ep_admin')
  );
