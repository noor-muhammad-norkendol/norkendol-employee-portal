-- Stage action checklists for onboarder KPI
-- Tracks Text/Email/Call actions per client per stage per contact target (insured/contractor/pa)

create table if not exists onboarding_stage_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  client_id uuid not null references onboarding_clients(id) on delete cascade,
  stage text not null,
  action_type text not null,
  contact_target text not null,
  activity_log_id uuid references onboarding_activity_logs(id),
  completed_at timestamptz,
  completed_by text,
  created_at timestamptz default now()
);

create index if not exists idx_stage_actions_client_stage
  on onboarding_stage_actions(client_id, stage);

-- RLS
alter table onboarding_stage_actions enable row level security;

create policy "org_stage_actions_select"
  on onboarding_stage_actions for select
  using (org_id in (select org_id from public.users where id = auth.uid()));

create policy "org_stage_actions_insert"
  on onboarding_stage_actions for insert
  with check (org_id in (select org_id from public.users where id = auth.uid()));

create policy "org_stage_actions_update"
  on onboarding_stage_actions for update
  using (org_id in (select org_id from public.users where id = auth.uid()));
