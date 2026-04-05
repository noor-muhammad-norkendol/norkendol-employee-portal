-- AI Usage Log — tracks every AI call for cost/audit

CREATE TABLE public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  feature_key text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric(10,6),
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_usage_log_org ON public.ai_usage_log(org_id);
CREATE INDEX idx_ai_usage_log_feature ON public.ai_usage_log(feature_key);
CREATE INDEX idx_ai_usage_log_created ON public.ai_usage_log(created_at DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Admins can view their org's usage
CREATE POLICY "org_admin_read_usage" ON public.ai_usage_log
  FOR SELECT USING (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'system_admin')
  );

-- Service role inserts (server-side only via supabaseAdmin)
CREATE POLICY "service_insert_usage" ON public.ai_usage_log
  FOR INSERT WITH CHECK (true);
