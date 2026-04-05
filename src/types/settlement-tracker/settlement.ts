export interface Settlement {
  id: string;
  litigation_file_id: string;
  settlement_amount: number;
  attorney_fee_percent?: number;
  attorney_fees?: number;
  costs: number;
  net_to_client: number;
  date_settled: string;
  settlement_method?: string;
  notes?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSettlementInput {
  litigation_file_id: string;
  settlement_amount: number;
  attorney_fee_percent?: number;
  attorney_fees?: number;
  costs: number;
  net_to_client: number;
  date_settled: string;
  notes?: string;
}

export interface UpdateSettlementInput extends Partial<CreateSettlementInput> {
  id: string;
}

export interface SettlementFormData {
  settlement_amount: number;
  attorney_fee_percent?: number;
  attorney_fees?: number;
  costs: number;
  date_settled: string;
  notes?: string;
}

export function calculateSettlementValues(data: SettlementFormData): {
  attorney_fees: number;
  net_to_client: number;
} {
  let fees = data.attorney_fees || 0;

  if (data.attorney_fee_percent && data.settlement_amount) {
    fees = (data.settlement_amount * data.attorney_fee_percent) / 100;
  }

  const netToClient = data.settlement_amount - fees - (data.costs || 0);

  return {
    attorney_fees: Math.round(fees * 100) / 100,
    net_to_client: Math.max(0, Math.round(netToClient * 100) / 100),
  };
}

export interface SettlementWithFile extends Settlement {
  litigation_file?: {
    file_number: string;
    client_name: string;
    attorney_firm: string;
    attorney_contact?: string;
    referral_source: string;
    created_at: string;
  };
}

export const SETTLEMENT_CSV_HEADERS = [
  'fileNumber',
  'clientName',
  'attorneyFirm',
  'referralSource',
  'settlementAmount',
  'attorneyFees',
  'attorneyFeePercent',
  'costs',
  'netToClient',
  'dateSettled',
  'notes'
].join(',');