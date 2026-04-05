-- Notification Preferences — per-user email notification toggles
-- Users opt OUT of what they don't want. Missing from disabled array = ON.

CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  email_disabled_types text[] NOT NULL DEFAULT '{}',
  sms_enabled boolean NOT NULL DEFAULT false,
  sms_disabled_types text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_read_own_prefs" ON public.notification_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_update_own_prefs" ON public.notification_preferences
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "user_insert_own_prefs" ON public.notification_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_read_all_prefs" ON public.notification_preferences
  FOR SELECT USING (true);

COMMENT ON COLUMN public.notification_preferences.email_disabled_types IS 'Array of notification types the user has turned OFF. Known types: action_items, training, compliance, company_updates, system. Missing from array = ON.';
