-- Training / University Schema
-- 6 new tables: training_categories, training_courses, training_lessons, training_quiz_questions, training_assignments, training_progress
-- Also adds 'training' to action_items item_type CHECK constraint

CREATE TABLE public.training_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.training_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read" ON public.training_categories FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "admin_write" ON public.training_categories FOR ALL USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()) AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'system_admin'));

CREATE TABLE public.training_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category_id uuid REFERENCES public.training_categories(id) ON DELETE SET NULL,
  level text NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  passing_score integer NOT NULL DEFAULT 80,
  thumbnail_url text,
  instructor_name text,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read" ON public.training_courses FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "admin_write" ON public.training_courses FOR ALL USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()) AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'system_admin'));

CREATE TABLE public.training_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  lesson_type text NOT NULL CHECK (lesson_type IN ('video', 'document', 'quiz')),
  video_url text,
  file_url text,
  file_name text,
  duration_seconds integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.training_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read" ON public.training_lessons FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "admin_write" ON public.training_lessons FOR ALL USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()) AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'system_admin'));

CREATE TABLE public.training_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.training_lessons(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  options jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.training_quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read" ON public.training_quiz_questions FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "admin_write" ON public.training_quiz_questions FOR ALL USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()) AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'system_admin'));

CREATE TABLE public.training_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to_name text,
  assigned_by_name text,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'failed')),
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(course_id, assigned_to)
);
ALTER TABLE public.training_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read" ON public.training_assignments FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "admin_write" ON public.training_assignments FOR ALL USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()) AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'system_admin'));
CREATE POLICY "user_update_own" ON public.training_assignments FOR UPDATE USING (assigned_to = auth.uid());

CREATE TABLE public.training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_percentage integer NOT NULL DEFAULT 0,
  completed_lessons jsonb NOT NULL DEFAULT '[]',
  quiz_scores jsonb NOT NULL DEFAULT '{}',
  enrolled_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  total_time_spent_seconds integer NOT NULL DEFAULT 0,
  UNIQUE(user_id, course_id)
);
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_read" ON public.training_progress FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "user_write_own" ON public.training_progress FOR ALL USING (user_id = auth.uid());
CREATE POLICY "admin_read" ON public.training_progress FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()) AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin', 'system_admin'));

-- Add 'training' to action_items item_type
ALTER TABLE public.action_items DROP CONSTRAINT IF EXISTS action_items_item_type_check;
ALTER TABLE public.action_items ADD CONSTRAINT action_items_item_type_check CHECK (item_type IN ('task', 'claim', 'training'));

-- Seed default categories
INSERT INTO public.training_categories (org_id, name, description, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Onboarding', 'New employee orientation and setup', 1),
  ('00000000-0000-0000-0000-000000000001', 'Technical', 'Software, tools, and technical skills', 2),
  ('00000000-0000-0000-0000-000000000001', 'Compliance', 'Regulatory and compliance requirements', 3),
  ('00000000-0000-0000-0000-000000000001', 'Leadership', 'Management and leadership development', 4),
  ('00000000-0000-0000-0000-000000000001', 'Safety', 'Workplace safety and procedures', 5);
