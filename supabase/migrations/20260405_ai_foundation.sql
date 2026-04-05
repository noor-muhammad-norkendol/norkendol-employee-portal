-- AI Foundation Schema
-- ai_context_templates: Norkendol-managed locked prompts per feature
-- org_settings: per-org AI configuration + business context

-- ═══════════════════════════════════════════════
-- AI Context Templates (system_admin only)
-- ═══════════════════════════════════════════════

CREATE TABLE public.ai_context_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  system_prompt text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_context_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_admin_read" ON public.ai_context_templates
  FOR SELECT USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'system_admin'
  );

CREATE POLICY "system_admin_write" ON public.ai_context_templates
  FOR ALL USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'system_admin'
  );

-- ═══════════════════════════════════════════════
-- Org Settings (one row per org)
-- ═══════════════════════════════════════════════

CREATE TABLE public.org_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.orgs(id) ON DELETE CASCADE,
  ai_provider text CHECK (ai_provider IN ('anthropic', 'openai')),
  ai_api_key_encrypted text,
  ai_model text,
  business_context text,
  ai_interview_completed boolean,
  onboarding_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_admin_read" ON public.org_settings
  FOR SELECT USING (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'system_admin')
  );

CREATE POLICY "org_super_admin_write" ON public.org_settings
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('super_admin', 'system_admin')
  );

CREATE POLICY "org_super_admin_update" ON public.org_settings
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('super_admin', 'system_admin')
  );

-- ═══════════════════════════════════════════════
-- Seed data
-- ═══════════════════════════════════════════════

-- Training Course Generator template
INSERT INTO public.ai_context_templates (feature_key, name, description, system_prompt, version) VALUES (
  'training_course_generator',
  'Training Course Generator',
  'Analyzes a training transcript and generates a structured course with title, description, category suggestion, difficulty level, and quiz questions.',
  E'You are a training course creation assistant. Given a transcript of a training session, generate a structured course.\n\nYou MUST respond with valid JSON only — no markdown, no explanation, no extra text.\n\nRequired JSON schema:\n{\n  "title": "string — concise course title (max 100 chars)",\n  "description": "string — 2-3 sentence course description",\n  "suggested_category": "string — one of: Onboarding, Technical, Compliance, Leadership, Safety, or Other",\n  "level": "string — one of: beginner, intermediate, advanced",\n  "quiz_questions": [\n    {\n      "question_text": "string — clear question based on the transcript content",\n      "options": [\n        { "label": "string — answer option", "is_correct": boolean }\n      ]\n    }\n  ]\n}\n\nRules:\n- Generate exactly 5 quiz questions unless the transcript is too short (minimum 3)\n- Each question must have exactly 4 options with exactly 1 correct answer\n- Questions must be directly answerable from the transcript content\n- Do not invent information not present in the transcript\n- Title should be professional and specific, not generic\n- Description should summarize what the learner will gain\n- Level should reflect the complexity of the material',
  1
);

-- Default org_settings row for the existing org
INSERT INTO public.org_settings (org_id) VALUES ('00000000-0000-0000-0000-000000000001');
