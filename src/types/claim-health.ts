export type ClaimStatusAtIntake = 'Denied' | 'Below Deductible' | 'Partial Paid' | 'Fully Paid';

export interface ClaimHealthRecord {
  id: string;
  org_id: string;
  adjuster_id: string;
  adjuster_name: string;
  claim_id: string;
  client_name: string;
  referral_source: string;
  referral_representative: string;
  start_date: string;
  settlement_date?: string | null;
  starting_value: number;
  final_settlement_value?: number | null;
  status_at_intake: ClaimStatusAtIntake;
  is_settled: boolean;
  total_communications: number;
  roof_squares?: number | null;
  roof_material?: string | null;
  additional_details?: string | null;
  source: 'manual' | 'auto';
  settlement_tracker_file_id?: string | null;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateClaimHealthInput {
  claim_id: string;
  client_name: string;
  referral_source: string;
  referral_representative: string;
  start_date: string;
  settlement_date?: string | null;
  starting_value: number;
  final_settlement_value?: number | null;
  status_at_intake: ClaimStatusAtIntake;
  is_settled: boolean;
  total_communications: number;
  roof_squares?: number | null;
  roof_material?: string | null;
  additional_details?: string | null;
  source?: 'manual' | 'auto';
  settlement_tracker_file_id?: string | null;
}

export interface UpdateClaimHealthInput extends Partial<CreateClaimHealthInput> {
  id: string;
  is_complete?: boolean;
}

export const STATUS_AT_INTAKE_OPTIONS: ClaimStatusAtIntake[] = [
  'Denied', 'Below Deductible', 'Partial Paid', 'Fully Paid',
];

export const ROOF_MATERIAL_OPTIONS = [
  '3-Tab Shingle', 'Architectural Shingle', 'Metal', 'Tile', 'Slate', 'Flat/TPO', 'Wood Shake', 'Other',
];

// Per-claim calculated metrics
export interface ClaimHealthMetrics {
  daysToSettlement?: number;
  percentageChange?: number;
  daysClaimOpen: number;
  communicationFrequency: number;
}

// Aggregate KPIs across all claims
export interface ClaimHealthKPIs {
  averageDaysToSettlement: number;
  averagePercentageIncrease: number;
  averageCommunicationFrequency: number;
  totalActiveClaims: number;
  totalSettledClaims: number;
  totalClaims: number;
  referralSourcePerformance: { source: string; avgIncrease: number; count: number }[];
}
