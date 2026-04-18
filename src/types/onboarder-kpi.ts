// ── Status & Options ──────────────────────────────

export type OnboardingStatus =
  | 'new' | 'step_2' | 'step_3' | 'final_step' | 'on_hold'
  | 'completed' | 'erroneous' | 'revised' | 'abandoned';

export type ActivityType = 'call' | 'text' | 'email' | 'note' | 'document' | 'status_change';
export type ContactTarget = 'insured' | 'referral_source' | 'pa' | 'contractor' | 'other';
export type CallResult = 'answered' | 'no_answer' | 'voicemail' | 'busy';
export type ContractStatus = 'not_sent' | 'sent' | 'signed' | 'viewed' | 'bounced' | 'failed';
export type OnboardType = 'portal' | 'auto-contract' | 'paper-contract' | 'live';

export type Peril =
  | 'Water' | 'Fire' | 'Hurricane' | 'Hail' | 'Wind'
  | 'Wind/Hail' | 'Flood' | 'Lightning' | 'Theft' | 'Vandalism' | 'Other';

export const STATUS_OPTIONS: OnboardingStatus[] = [
  'new', 'step_2', 'step_3', 'final_step', 'on_hold',
  'completed', 'erroneous', 'revised', 'abandoned',
];

export const STATUS_LABELS: Record<OnboardingStatus, string> = {
  'new': 'Initial Contact',
  'step_2': '24hr Follow-Up',
  'step_3': '48hr Follow-Up',
  'final_step': '72hr Escalation',
  'on_hold': 'On Hold',
  'completed': 'Completed',
  'erroneous': 'Erroneous',
  'revised': 'Revised',
  'abandoned': 'Abandoned',
};

export const PERIL_OPTIONS: Peril[] = [
  'Water', 'Fire', 'Hurricane', 'Hail', 'Wind',
  'Wind/Hail', 'Flood', 'Lightning', 'Theft', 'Vandalism', 'Other',
];

export const ONBOARD_TYPE_OPTIONS: OnboardType[] = [
  'portal', 'auto-contract', 'paper-contract', 'live',
];

export const CONTRACT_STATUS_OPTIONS: ContractStatus[] = [
  'not_sent', 'sent', 'signed', 'viewed', 'bounced', 'failed',
];

export const ASSIGNMENT_TYPE_OPTIONS = [
  'Standard', 'Public Adjusting', 'Reinspection', 'Supplement', 'Cat', 'Other',
];

export const STATUS_CLAIM_OPTIONS = [
  'New', 'Active', 'Supplement', 'Pending', 'Denied',
  'Loss Below Deductible', 'Closed', 'Other',
];

export const REFERRAL_SOURCE_OPTIONS = [
  'Contractor', 'Other',
];

export const CAUSE_OF_LOSS_OPTIONS: Peril[] = [
  'Water', 'Fire', 'Hurricane', 'Hail', 'Wind',
  'Wind/Hail', 'Flood', 'Lightning', 'Theft', 'Vandalism', 'Other',
];

export const ACTIVITY_TYPE_OPTIONS: ActivityType[] = [
  'call', 'text', 'email', 'note', 'document', 'status_change',
];

export const CONTACT_TARGET_OPTIONS: ContactTarget[] = [
  'insured', 'referral_source', 'pa', 'contractor', 'other',
];

export const CALL_RESULT_OPTIONS: CallResult[] = [
  'answered', 'no_answer', 'voicemail', 'busy',
];

// Stages that have email/text templates (subset of all statuses)
export const TEMPLATE_STAGES: { key: string; label: string }[] = [
  { key: "new", label: "Initial Contact" },
  { key: "step_2", label: "24hr Follow-Up" },
  { key: "step_3", label: "48hr Follow-Up" },
  { key: "final_step", label: "72hr Escalation" },
  { key: "on_hold", label: "On Hold" },
  { key: "completed", label: "Completed" },
];

export const TEMPLATE_CONTACTS: { key: string; label: string }[] = [
  { key: "insured", label: "Insured" },
  { key: "contractor", label: "Contractor" },
  { key: "pa", label: "Public Adjuster" },
];

// Allowed status transitions
export const ALLOWED_TRANSITIONS: Record<OnboardingStatus, OnboardingStatus[]> = {
  'new': ['step_2', 'on_hold', 'completed', 'erroneous'],
  'step_2': ['step_3', 'on_hold', 'completed', 'erroneous', 'revised'],
  'step_3': ['final_step', 'on_hold', 'completed', 'erroneous', 'revised'],
  'final_step': ['on_hold', 'completed', 'erroneous', 'revised'],
  'on_hold': ['step_2', 'step_3', 'final_step', 'completed', 'erroneous', 'revised'],
  'completed': [],
  'erroneous': ['revised'],
  'revised': ['step_2', 'step_3', 'final_step', 'completed'],
  'abandoned': [],
};

// Overdue target hours per stage
export const STAGE_TARGET_HOURS: Partial<Record<OnboardingStatus, number>> = {
  'step_2': 24,
  'step_3': 48,
  'final_step': 72,
  'on_hold': 72,
};

// ── Core Types ────────────────────────────────────

export interface OnboardingClient {
  id: string;
  org_id: string;
  created_by_id: string;
  created_by_name: string;
  claim_number?: string | null;
  file_number?: string | null;
  loss_address?: string | null;
  client_name: string;
  client_first_name?: string | null;
  client_last_name?: string | null;
  additional_policyholder_first?: string | null;
  additional_policyholder_last?: string | null;
  additional_policyholder_email?: string | null;
  additional_policyholder_phone?: string | null;
  referral_source?: string | null;
  state?: string | null;
  peril?: Peril | null;
  onboard_type?: OnboardType | null;
  email?: string | null;
  phone?: string | null;
  loss_street?: string | null;
  loss_line2?: string | null;
  loss_city?: string | null;
  loss_state?: string | null;
  loss_zip?: string | null;
  loss_description?: string | null;
  contractor_company?: string | null;
  contractor_name?: string | null;
  contractor_email?: string | null;
  contractor_phone?: string | null;
  source_email?: string | null;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  assigned_pa_name?: string | null;
  assignment_type?: string | null;
  date_of_loss?: string | null;
  insurance_company?: string | null;
  policy_number?: string | null;
  status_claim?: string | null;
  supplement_notes?: string | null;
  status: OnboardingStatus;
  status_entered_at: string;
  first_attempt_at?: string | null;
  contract_status?: ContractStatus | null;
  contract_sent_at?: string | null;
  contract_url?: string | null;
  completed_at?: string | null;
  abandoned_at?: string | null;
  abandonment_reason?: string | null;
  initial_hours: number;
  step_0_confirmed: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateClientInput {
  claim_number?: string | null;
  file_number?: string | null;
  loss_address?: string | null;
  client_name: string;
  client_first_name?: string | null;
  client_last_name?: string | null;
  additional_policyholder_first?: string | null;
  additional_policyholder_last?: string | null;
  additional_policyholder_email?: string | null;
  additional_policyholder_phone?: string | null;
  referral_source?: string | null;
  state?: string | null;
  peril?: Peril | null;
  onboard_type?: OnboardType | null;
  email?: string | null;
  phone?: string | null;
  loss_street?: string | null;
  loss_line2?: string | null;
  loss_city?: string | null;
  loss_state?: string | null;
  loss_zip?: string | null;
  loss_description?: string | null;
  contractor_company?: string | null;
  contractor_name?: string | null;
  contractor_email?: string | null;
  contractor_phone?: string | null;
  source_email?: string | null;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  assigned_pa_name?: string | null;
  assignment_type?: string | null;
  date_of_loss?: string | null;
  insurance_company?: string | null;
  policy_number?: string | null;
  status_claim?: string | null;
  supplement_notes?: string | null;
  initial_hours?: number;
  notes?: string | null;
}

export interface UpdateClientInput extends Partial<CreateClientInput> {
  id: string;
  status?: OnboardingStatus;
  status_entered_at?: string;
  first_attempt_at?: string | null;
  contract_status?: ContractStatus | null;
  contract_sent_at?: string | null;
  contract_url?: string | null;
  completed_at?: string | null;
  abandoned_at?: string | null;
  abandonment_reason?: string | null;
  step_0_confirmed?: boolean;
}

export interface OnboardingActivityLog {
  id: string;
  org_id: string;
  client_id: string;
  user_name: string;
  activity_type: ActivityType;
  subject?: string | null;
  body?: string | null;
  contact_target?: ContactTarget | null;
  call_result?: CallResult | null;
  created_at: string;
}

export interface OnboardingStatusHistory {
  id: string;
  org_id: string;
  client_id: string;
  from_status: string;
  to_status: string;
  changed_by?: string | null;
  notes?: string | null;
  changed_at: string;
}

export interface OnboardingTimeLog {
  id: string;
  org_id: string;
  user_name: string;
  client_id?: string | null;
  activity_type: 'entry_form' | 'client_work';
  status_at_time?: string | null;
  started_at: string;
  ended_at?: string | null;
  duration_seconds?: number | null;
  created_at: string;
}

// ── KPI Metrics ───────────────────────────────────

export interface OnboarderMetrics {
  onboarderId: string;
  onboarderName: string;
  totalEntries: number;
  completed: number;
  completionRate: number;
  avgTimeToCompletionHours: number;
  overdueCount: number;
  overdueRate: number;
  conversionRate: number;
  entriesPerDay: number;
}

export interface TeamOnboardingMetrics {
  avgCompletionRate: number;
  avgTimeToCompletion: number;
  avgOverdueRate: number;
  avgConversionRate: number;
  totalEntries: number;
  totalCompleted: number;
  onboarderRankings: (OnboarderMetrics & { rank: number })[];
}
