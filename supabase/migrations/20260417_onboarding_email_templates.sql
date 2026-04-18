-- Onboarding email/text templates per stage per contact target
-- Managed by admins in Executive Intelligence > KPI Admin > Onboarding

create table if not exists onboarding_email_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  stage text not null,
  contact_target text not null,
  channel text not null default 'email',
  email_subject text default '',
  email_body text default '',
  text_message text default '',
  updated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_onboarding_templates_unique
  on onboarding_email_templates(org_id, stage, contact_target, channel);

alter table onboarding_email_templates enable row level security;

create policy "org_templates_select"
  on onboarding_email_templates for select
  using (org_id in (select org_id from public.users where id = auth.uid()));

create policy "org_templates_insert"
  on onboarding_email_templates for insert
  with check (org_id in (select org_id from public.users where id = auth.uid()));

create policy "org_templates_update"
  on onboarding_email_templates for update
  using (org_id in (select org_id from public.users where id = auth.uid()));

create policy "org_templates_delete"
  on onboarding_email_templates for delete
  using (org_id in (select org_id from public.users where id = auth.uid()));
