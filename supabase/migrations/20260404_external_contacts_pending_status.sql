-- Add 'pending' and 'rejected' to the status CHECK constraint
ALTER TABLE public.external_contacts DROP CONSTRAINT IF EXISTS external_contacts_status_check;
ALTER TABLE public.external_contacts ADD CONSTRAINT external_contacts_status_check
  CHECK (status IN ('active', 'inactive', 'pending', 'rejected'));

-- Change default to 'pending'
ALTER TABLE public.external_contacts ALTER COLUMN status SET DEFAULT 'pending';

-- Ensure the org-user INSERT policy exists (drop admin-only if still there)
DROP POLICY IF EXISTS "Admins can insert external contacts" ON public.external_contacts;
DROP POLICY IF EXISTS "Org users can insert external contacts" ON public.external_contacts;
CREATE POLICY "Org users can insert external contacts"
  ON public.external_contacts FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  );
