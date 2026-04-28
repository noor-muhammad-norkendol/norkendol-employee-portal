"use client";
import type { SupabaseClient } from '@supabase/supabase-js';

// Lightweight publisher for kpi_snapshots events. Every operationally
// meaningful onboarding action calls this. Errors are logged but never
// thrown — KPI publishing must NEVER break the user-facing operation.
//
// Schema reference (supabase/migrations/20260406_kpi_snapshots.sql):
// org_id, source_module, metric_key, metric_value, metric_unit,
// period_start, period_end, metadata jsonb.

// The full claim snapshot embedded in every event. Mirrors the columns the
// Onboarding Tracker xlsx surfaces so the EI Data tab can render rich rows
// without joining back to onboarding_clients (which can change after the
// event was logged).
export interface ClaimContext {
  // Onboarder + form-submitter
  user_name?: string | null;
  user_email?: string | null;
  // Policyholder
  client_name?: string | null;
  email?: string | null;
  phone?: string | null;
  additional_policyholder_first?: string | null;
  additional_policyholder_last?: string | null;
  additional_policyholder_email?: string | null;
  additional_policyholder_phone?: string | null;
  // Loss info
  loss_address?: string | null;
  loss_street?: string | null;
  loss_line2?: string | null;
  loss_city?: string | null;
  loss_state?: string | null;
  loss_zip?: string | null;
  loss_description?: string | null;
  date_of_loss?: string | null;
  state?: string | null;
  peril?: string | null;
  peril_other?: string | null;
  severity?: number | null;
  // Carrier
  insurance_company?: string | null;
  policy_number?: string | null;
  status_claim?: string | null;
  claim_number?: string | null;
  file_number?: string | null;
  supplement_notes?: string | null;
  // Parties
  contractor_company?: string | null;
  contractor_name?: string | null;
  contractor_email?: string | null;
  contractor_phone?: string | null;
  referral_source?: string | null;
  source_email?: string | null;
  // Assignment
  assigned_user_name?: string | null;
  assigned_pa_name?: string | null;
  onboard_type?: string | null;
  assignment_type?: string | null;
  // Notes / housekeeping
  notes?: string | null;
  initial_hours?: number | null;
}

interface PublishKPIEventArgs {
  orgId: string;
  metricKey: string;
  metricValue?: number;
  metricUnit?: string;
  metadata?: Record<string, unknown>;
  claimContext?: ClaimContext;   // merged into metadata at publish time
}

export async function publishKPIEvent(
  supabase: SupabaseClient,
  args: PublishKPIEventArgs,
): Promise<void> {
  const { orgId, metricKey, metricValue = 1, metricUnit = 'count', metadata = {}, claimContext } = args;
  const today = new Date().toISOString().slice(0, 10);
  // Strip nullish values from claimContext so the JSON payload stays tidy
  const ctxClean: Record<string, unknown> = {};
  if (claimContext) {
    for (const [k, v] of Object.entries(claimContext)) {
      if (v !== null && v !== undefined && v !== '') ctxClean[k] = v;
    }
  }
  const fullMeta = { ...ctxClean, ...metadata };
  try {
    const { error } = await supabase.from('kpi_snapshots').insert({
      org_id: orgId,
      source_module: 'onboarding',
      metric_key: metricKey,
      metric_value: metricValue,
      metric_unit: metricUnit,
      period_start: today,
      period_end: today,
      metadata: fullMeta,
    });
    if (error) {
      console.warn(`[KPI] publish failed for ${metricKey}:`, error);
      return;
    }
    console.info(`[KPI] published ${metricKey}`, { metricValue, fullMeta });
  } catch (e) {
    console.warn(`[KPI] publish threw for ${metricKey}:`, e);
  }
}

// Helper: build a ClaimContext from an OnboardingClient-like row.
// Uses 'unknown' typing because callers may pass partials or full rows.
export function buildClaimContext(row: Record<string, unknown>): ClaimContext {
  const get = <T>(k: string): T | null => (row[k] as T) ?? null;
  return {
    // Policyholder
    client_name:        get<string>('client_name'),
    email:              get<string>('email'),
    phone:              get<string>('phone'),
    additional_policyholder_first: get<string>('additional_policyholder_first'),
    additional_policyholder_last:  get<string>('additional_policyholder_last'),
    additional_policyholder_email: get<string>('additional_policyholder_email'),
    additional_policyholder_phone: get<string>('additional_policyholder_phone'),
    // Loss info
    loss_address:       get<string>('loss_address'),
    loss_street:        get<string>('loss_street'),
    loss_line2:         get<string>('loss_line2'),
    loss_city:          get<string>('loss_city'),
    loss_state:         get<string>('loss_state'),
    loss_zip:           get<string>('loss_zip'),
    loss_description:   get<string>('loss_description'),
    date_of_loss:       get<string>('date_of_loss'),
    state:              get<string>('state'),
    peril:              get<string>('peril'),
    peril_other:        get<string>('peril_other'),
    severity:           get<number>('severity'),
    // Carrier
    insurance_company:  get<string>('insurance_company'),
    policy_number:      get<string>('policy_number'),
    status_claim:       get<string>('status_claim'),
    claim_number:       get<string>('claim_number'),
    file_number:        get<string>('file_number'),
    supplement_notes:   get<string>('supplement_notes'),
    // Parties
    contractor_company: get<string>('contractor_company'),
    contractor_name:    get<string>('contractor_name'),
    contractor_email:   get<string>('contractor_email'),
    contractor_phone:   get<string>('contractor_phone'),
    referral_source:    get<string>('referral_source'),
    source_email:       get<string>('source_email'),
    // Assignment
    assigned_user_name: get<string>('assigned_user_name'),
    assigned_pa_name:   get<string>('assigned_pa_name'),
    onboard_type:       get<string>('onboard_type'),
    assignment_type:    get<string>('assignment_type'),
    // Notes
    notes:              get<string>('notes'),
    initial_hours:      get<number>('initial_hours'),
  };
}
