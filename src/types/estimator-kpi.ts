// ── Status & Options ──────────────────────────────

export type EstimateStatus =
  | 'assigned' | 'in-progress' | 'blocked' | 'review'
  | 'sent-to-carrier' | 'revision-requested' | 'revised'
  | 'settled' | 'closed' | 'unable-to-start';

export type PropertyType = 'residential' | 'commercial' | 'multi-family' | 'other';

export type Peril =
  | 'Wind' | 'Wind/Hail' | 'Hail' | 'Hurricane' | 'Flood'
  | 'Fire' | 'Water' | 'Lightning' | 'Theft' | 'Vandalism' | 'Other';

export type BlockerType =
  | 'scoper' | 'public-adjuster' | 'carrier' | 'contractor'
  | 'client' | 'internal' | 'documentation' | 'other';

export const STATUS_OPTIONS: EstimateStatus[] = [
  'assigned', 'in-progress', 'blocked', 'review', 'sent-to-carrier',
  'revision-requested', 'revised', 'settled', 'closed', 'unable-to-start',
];

export const PERIL_OPTIONS: Peril[] = [
  'Wind', 'Wind/Hail', 'Hail', 'Hurricane', 'Flood',
  'Fire', 'Water', 'Lightning', 'Theft', 'Vandalism', 'Other',
];

export const SEVERITY_OPTIONS = [1, 2, 3, 4, 5] as const;

export const PROPERTY_TYPE_OPTIONS: PropertyType[] = [
  'residential', 'commercial', 'multi-family', 'other',
];

export const BLOCKER_TYPE_OPTIONS: BlockerType[] = [
  'scoper', 'public-adjuster', 'carrier', 'contractor',
  'client', 'internal', 'documentation', 'other',
];

// Severity descriptions for UI
export const SEVERITY_LABELS: Record<number, string> = {
  1: '< 30 min', 2: '< 1 hour', 3: '< 3 hours', 4: '< 6 hours', 5: '< 12 hours',
};

// Allowed status transitions
export const ALLOWED_TRANSITIONS: Record<EstimateStatus, EstimateStatus[]> = {
  'assigned': ['in-progress', 'unable-to-start'],
  'in-progress': ['blocked', 'review', 'sent-to-carrier', 'unable-to-start'],
  'blocked': ['in-progress'],
  'review': ['in-progress', 'sent-to-carrier'],
  'sent-to-carrier': ['revision-requested', 'settled'],
  'revision-requested': ['revised', 'in-progress'],
  'revised': ['sent-to-carrier'],
  'settled': ['closed'],
  'closed': [],
  'unable-to-start': ['assigned'],
};

// ── Core Types ────────────────────────────────────

export interface Estimate {
  id: string;
  org_id: string;
  estimator_id: string;
  estimator_name: string;
  file_number: string;
  claim_number?: string | null;
  policy_number?: string | null;
  client_name: string;
  property_type?: PropertyType | null;
  loss_state?: string | null;
  loss_date?: string | null;
  referral_source?: string | null;
  referral_representative?: string | null;
  carrier?: string | null;
  carrier_adjuster?: string | null;
  carrier_adjuster_email?: string | null;
  carrier_adjuster_phone?: string | null;
  contractor_company?: string | null;
  contractor_rep?: string | null;
  contractor_rep_email?: string | null;
  contractor_rep_phone?: string | null;
  peril?: Peril | null;
  severity?: number | null;
  estimate_value: number;
  rcv?: number | null;
  acv?: number | null;
  depreciation?: number | null;
  deductible?: number | null;
  net_claim?: number | null;
  overhead_profit_pct?: number | null;
  active_time_minutes: number;
  blocked_time_minutes: number;
  revision_time_minutes: number;
  total_time_minutes: number;
  status: EstimateStatus;
  current_blocker_type?: string | null;
  current_blocker_name?: string | null;
  current_blocker_reason?: string | null;
  current_blocked_at?: string | null;
  actual_settlement?: number | null;
  settlement_date?: string | null;
  is_settled: boolean;
  settlement_variance?: number | null;
  revisions: number;
  sla_target_hours?: number | null;
  sla_breached: boolean;
  sla_breached_at?: string | null;
  date_received: string;
  date_started?: string | null;
  date_completed?: string | null;
  date_sent_to_carrier?: string | null;
  date_closed?: string | null;
  notes?: string | null;
  parent_estimate_id?: string | null;
  revision_number: number;
  created_at: string;
  updated_at: string;
}

export interface CreateEstimateInput {
  file_number: string;
  client_name: string;
  claim_number?: string | null;
  policy_number?: string | null;
  property_type?: PropertyType | null;
  loss_state?: string | null;
  loss_date?: string | null;
  referral_source?: string | null;
  referral_representative?: string | null;
  carrier?: string | null;
  carrier_adjuster?: string | null;
  carrier_adjuster_email?: string | null;
  carrier_adjuster_phone?: string | null;
  contractor_company?: string | null;
  contractor_rep?: string | null;
  contractor_rep_email?: string | null;
  contractor_rep_phone?: string | null;
  peril?: Peril | null;
  severity?: number | null;
  estimate_value?: number;
  active_time_minutes?: number;
  revision_time_minutes?: number;
  revisions?: number;
  status?: EstimateStatus;
  notes?: string | null;
}

export interface UpdateEstimateInput extends Partial<CreateEstimateInput> {
  id: string;
  blocked_time_minutes?: number;
  total_time_minutes?: number;
  current_blocker_type?: string | null;
  current_blocker_name?: string | null;
  current_blocker_reason?: string | null;
  current_blocked_at?: string | null;
  actual_settlement?: number | null;
  settlement_date?: string | null;
  is_settled?: boolean;
  settlement_variance?: number | null;
  sla_target_hours?: number | null;
  sla_breached?: boolean;
  date_started?: string | null;
  date_completed?: string | null;
  date_sent_to_carrier?: string | null;
  date_closed?: string | null;
}

export interface EstimateBlocker {
  id: string;
  org_id: string;
  estimate_id: string;
  blocker_type: BlockerType;
  blocker_name: string;
  blocker_reason?: string | null;
  blocked_at: string;
  resolved_at?: string | null;
  duration_minutes?: number | null;
  resolution_note?: string | null;
  created_by_id?: string | null;
  created_by_name?: string | null;
  created_at: string;
}

export interface EstimateEvent {
  id: string;
  org_id: string;
  estimate_id: string;
  event_type: 'status_change' | 'blocker_set' | 'blocker_resolved' | 'value_updated' | 'time_logged';
  old_value?: string | null;
  new_value?: string | null;
  created_by_id?: string | null;
  created_by_name?: string | null;
  created_at: string;
}

export interface SLARule {
  id: string;
  org_id: string;
  severity: number;
  target_hours: number;
  warning_hours: number;
  timeout_hours: number;
}

// ── KPI Metrics ───────────────────────────────────

export interface EstimatorMetrics {
  estimatorId: string;
  estimatorName: string;
  dollarsPerHour: number;
  dollarsPerMinute: number;
  totalValue: number;
  totalActiveHours: number;
  revisionRate: number;
  firstTimeApprovalRate: number;
  avgDaysHeld: number;
  estimateCount: number;
  severityBreakdown: Record<number, number>;
  avgTimeBySeverity: Record<number, number>;
  avgValueBySeverity: Record<number, number>;
}

export interface TeamMetrics {
  avgDollarsPerHour: number;
  avgRevisionRate: number;
  avgFirstTimeApproval: number;
  avgDaysHeld: number;
  totalWeeklyVolume: number;
  totalWeeklyValue: number;
  estimatorRankings: (EstimatorMetrics & { overallScore: number; rank: number })[];
}

// Default SLA targets (used if no org-specific rules exist)
export const DEFAULT_SLA_TARGETS: Record<number, { target: number; warning: number; timeout: number }> = {
  1: { target: 0.5, warning: 0.33, timeout: 4 },
  2: { target: 1.0, warning: 0.75, timeout: 8 },
  3: { target: 3.0, warning: 2.0, timeout: 12 },
  4: { target: 6.0, warning: 4.5, timeout: 24 },
  5: { target: 12.0, warning: 9.0, timeout: 24 },
};
