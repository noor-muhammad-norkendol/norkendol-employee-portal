-- Add user_id FK to link contact records to portal accounts
ALTER TABLE public.external_contacts
  ADD COLUMN user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Add created_by to track who added the contact
ALTER TABLE public.external_contacts
  ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Drop admin-only INSERT policy, replace with any-org-user INSERT
DROP POLICY "Admins can insert external contacts" ON public.external_contacts;

CREATE POLICY "Org users can insert external contacts"
  ON public.external_contacts FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  );

-- Drop admin-only UPDATE policy, replace with any-org-user UPDATE
DROP POLICY "Admins can update external contacts" ON public.external_contacts;

CREATE POLICY "Org users can update external contacts"
  ON public.external_contacts FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  );
