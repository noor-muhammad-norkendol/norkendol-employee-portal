-- Training Certificates — auto-issued on course completion

CREATE TABLE public.training_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  certificate_number text NOT NULL UNIQUE,
  issued_at timestamptz DEFAULT now(),
  final_score numeric(5,2),
  final_grade text,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_status text NOT NULL DEFAULT 'auto_approved' CHECK (review_status IN ('auto_approved', 'pending_review', 'approved', 'flagged')),
  review_notes text,
  UNIQUE(user_id, course_id)
);

CREATE INDEX idx_certificates_org ON public.training_certificates(org_id);
CREATE INDEX idx_certificates_user ON public.training_certificates(user_id);
CREATE INDEX idx_certificates_course ON public.training_certificates(course_id);

ALTER TABLE public.training_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_read_own_certs" ON public.training_certificates
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admin_read_org_certs" ON public.training_certificates
  FOR SELECT USING (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'system_admin')
  );

CREATE POLICY "admin_update_org_certs" ON public.training_certificates
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'system_admin')
  );

CREATE POLICY "service_insert_certs" ON public.training_certificates
  FOR INSERT WITH CHECK (true);
