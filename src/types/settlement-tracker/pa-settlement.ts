// PA Settlement types — no status workflow, this is a settlement ledger

export type Peril = 'Hurricane' | 'Hail' | 'Wind' | 'Water' | 'Fire' | 'Tornado' | 'Other';
export type ClaimSeverity = 'Minor' | 'Moderate' | 'Severe' | 'Catastrophic';
export type RoofType = 'Shingle' | 'Tile' | 'Metal' | 'Flat/TPO' | 'Slate' | 'Other';
export type SettlementBasis = 'RCV' | 'ACV';
export type SettlementType = 'Global Release' | 'Partial Payment (Open Coverage)';
export type SettlementStatus = 'Open' | 'Closed';
export type PaymentType = 'Initial Payment' | 'Supplement' | 'Depreciation Recovery' | 'O&P Recovery' | 'Final Payment' | 'Other';

export interface PASettlement {
  id: string;
  litigation_file_id: string;

  // The Parties
  referral_source?: string;
  referral_rep?: string;
  carrier?: string;
  carrier_adjuster?: string;
  carrier_adjuster_phone?: string;
  carrier_adjuster_email?: string;
  assigned_adjuster?: string;

  // The Claim
  peril?: Peril;
  claim_severity?: ClaimSeverity;
  date_of_loss?: string;
  date_settled?: string;
  days_open?: number;

  // The Roof
  roof_type?: RoofType;
  number_of_squares?: number;
  cost_per_square?: number;

  // The Money
  settlement_basis?: SettlementBasis;
  rcv_amount?: number;
  acv_amount?: number;
  depreciation?: number;
  pa_estimate?: number;
  carrier_initial_offer?: number;
  settlement_amount?: number;
  total_payments_received?: number;
  was_supplemented: boolean;
  supplement_amount?: number;
  op_included: boolean;
  op_amount?: number;
  deductible?: number;
  pa_fee_percentage?: number;
  pa_fee_amount?: number;
  net_to_client?: number;

  // Settlement Details
  settlement_type?: SettlementType;
  settlement_status: SettlementStatus;
  forthcoming_supplement_expected: boolean;

  // Coverages Settled
  coverage_a: boolean;
  coverage_b: boolean;
  coverage_c: boolean;
  coverage_d: boolean;
  endorsements_settled: boolean;
  coverage_notes?: string;

  // Carrier Adjuster Rating
  carrier_adjuster_rating?: number;
  carrier_adjuster_review?: string;

  // Notes
  notes?: string;

  // Archive
  archived_at?: string;
  archived_by?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface PASettlementWithFile extends PASettlement {
  litigation_file?: {
    file_number: string;
    client_name: string;
    state: string;
    referral_source?: string;
  };
}

export interface CreatePASettlementInput {
  litigation_file_id: string;
  referral_source?: string;
  referral_rep?: string;
  carrier?: string;
  carrier_adjuster?: string;
  carrier_adjuster_phone?: string;
  carrier_adjuster_email?: string;
  assigned_adjuster?: string;
  peril?: Peril;
  claim_severity?: ClaimSeverity;
  date_of_loss?: string | null;
  date_settled?: string | null;
  days_open?: number;
  roof_type?: RoofType;
  number_of_squares?: number;
  cost_per_square?: number;
  settlement_basis?: SettlementBasis;
  rcv_amount?: number;
  acv_amount?: number;
  depreciation?: number;
  pa_estimate?: number;
  carrier_initial_offer?: number;
  settlement_amount?: number;
  was_supplemented?: boolean;
  supplement_amount?: number;
  op_included?: boolean;
  op_amount?: number;
  deductible?: number;
  pa_fee_percentage?: number;
  pa_fee_amount?: number;
  net_to_client?: number;
  settlement_type?: SettlementType;
  settlement_status?: SettlementStatus;
  forthcoming_supplement_expected?: boolean;
  coverage_a?: boolean;
  coverage_b?: boolean;
  coverage_c?: boolean;
  coverage_d?: boolean;
  endorsements_settled?: boolean;
  coverage_notes?: string;
  notes?: string;
}

export interface UpdatePASettlementInput extends Partial<CreatePASettlementInput> {
  id: string;
  carrier_adjuster_rating?: number;
  carrier_adjuster_review?: string;
}

export interface PASettlementUpdate {
  id: string;
  pa_settlement_id: string;
  entered_by: string;
  description: string;
  next_action_date?: string;
  created_at: string;
}

export interface CreatePASettlementUpdateInput {
  pa_settlement_id: string;
  entered_by: string;
  description: string;
  next_action_date?: string | null;
}

export interface PASettlementPayment {
  id: string;
  pa_settlement_id: string;
  payment_type: PaymentType;
  amount: number;
  date_received?: string;
  description?: string;
  entered_by: string;
  created_at: string;
}

export interface CreatePASettlementPaymentInput {
  pa_settlement_id: string;
  payment_type: PaymentType;
  amount: number;
  date_received?: string | null;
  description?: string;
  entered_by: string;
}

// Dropdown option arrays
export const PERIL_OPTIONS: Peril[] = ['Hurricane', 'Hail', 'Wind', 'Water', 'Fire', 'Tornado', 'Other'];
export const CLAIM_SEVERITY_OPTIONS: ClaimSeverity[] = ['Minor', 'Moderate', 'Severe', 'Catastrophic'];
export const ROOF_TYPE_OPTIONS: RoofType[] = ['Shingle', 'Tile', 'Metal', 'Flat/TPO', 'Slate', 'Other'];
export const SETTLEMENT_BASIS_OPTIONS: SettlementBasis[] = ['RCV', 'ACV'];
export const SETTLEMENT_TYPE_OPTIONS: SettlementType[] = ['Global Release', 'Partial Payment (Open Coverage)'];
export const SETTLEMENT_STATUS_OPTIONS: SettlementStatus[] = ['Open', 'Closed'];
export const PAYMENT_TYPE_OPTIONS: PaymentType[] = ['Initial Payment', 'Supplement', 'Depreciation Recovery', 'O&P Recovery', 'Final Payment', 'Other'];

export function getSettlementStatusColor(status: SettlementStatus): string {
  switch (status) {
    case 'Open': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'Closed': return 'bg-green-500/20 text-green-400 border-green-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}
