-- Executive Intelligence Module: org hierarchy, feature assignments, AI onboarding, alert routing

-- 1. org_hierarchy — org chart nodes
CREATE TABLE IF NOT EXISTS public.org_hierarchy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  title text NOT NULL,
  reports_to uuid REFERENCES public.org_hierarchy(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_hierarchy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_hierarchy_select" ON public.org_hierarchy FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "org_hierarchy_insert" ON public.org_hierarchy FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin')));
CREATE POLICY "org_hierarchy_update" ON public.org_hierarchy FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin')));
CREATE POLICY "org_hierarchy_delete" ON public.org_hierarchy FOR DELETE TO authenticated
  USING (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin')));

-- 2. hierarchy_feature_assignments
CREATE TABLE IF NOT EXISTS public.hierarchy_feature_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hierarchy_id uuid NOT NULL REFERENCES public.org_hierarchy(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  is_owner boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hierarchy_feature_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hfa_select" ON public.hierarchy_feature_assignments FOR SELECT TO authenticated
  USING (hierarchy_id IN (SELECT id FROM public.org_hierarchy WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())));
CREATE POLICY "hfa_insert" ON public.hierarchy_feature_assignments FOR INSERT TO authenticated
  WITH CHECK (hierarchy_id IN (SELECT id FROM public.org_hierarchy WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin'))));
CREATE POLICY "hfa_update" ON public.hierarchy_feature_assignments FOR UPDATE TO authenticated
  USING (hierarchy_id IN (SELECT id FROM public.org_hierarchy WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin'))));
CREATE POLICY "hfa_delete" ON public.hierarchy_feature_assignments FOR DELETE TO authenticated
  USING (hierarchy_id IN (SELECT id FROM public.org_hierarchy WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin'))));

-- 3. ai_onboarding_interviews
CREATE TABLE IF NOT EXISTS public.ai_onboarding_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hierarchy_id uuid NOT NULL REFERENCES public.org_hierarchy(id) ON DELETE CASCADE,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_onboarding_interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interview_select" ON public.ai_onboarding_interviews FOR SELECT TO authenticated
  USING (hierarchy_id IN (SELECT id FROM public.org_hierarchy WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())));
CREATE POLICY "interview_insert" ON public.ai_onboarding_interviews FOR INSERT TO authenticated
  WITH CHECK (hierarchy_id IN (SELECT id FROM public.org_hierarchy WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin'))));
CREATE POLICY "interview_update" ON public.ai_onboarding_interviews FOR UPDATE TO authenticated
  USING (hierarchy_id IN (SELECT id FROM public.org_hierarchy WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin'))));
CREATE POLICY "interview_delete" ON public.ai_onboarding_interviews FOR DELETE TO authenticated
  USING (hierarchy_id IN (SELECT id FROM public.org_hierarchy WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin'))));

-- 4. executive_alert_routing
CREATE TABLE IF NOT EXISTS public.executive_alert_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  condition text NOT NULL,
  route_to_hierarchy_id uuid NOT NULL REFERENCES public.org_hierarchy(id) ON DELETE CASCADE,
  delivery text NOT NULL CHECK (delivery IN ('push', 'digest', 'both')) DEFAULT 'both',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.executive_alert_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ear_select" ON public.executive_alert_routing FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "ear_insert" ON public.executive_alert_routing FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin')));
CREATE POLICY "ear_update" ON public.executive_alert_routing FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin')));
CREATE POLICY "ear_delete" ON public.executive_alert_routing FOR DELETE TO authenticated
  USING (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'system_admin')));

-- 5. Seed: executive_onboarding AI context template
INSERT INTO public.ai_context_templates (feature_key, name, system_prompt)
VALUES (
  'executive_onboarding',
  'Executive Onboarding Interview',
  'You are an executive intelligence onboarding assistant for a company management portal. Based on the user''s assigned platform features, generate 3-5 targeted interview questions to understand their priorities, pain points, and how they want to be alerted about issues in their areas of responsibility. Return JSON: { "questions": ["question1", "question2", ...] }'
)
ON CONFLICT (feature_key) DO NOTHING;
