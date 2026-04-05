export type AppraisalStatus =
  | 'Pending'
  | 'Appraiser Selection'
  | 'Umpire Selection'
  | 'In Progress'
  | 'Impasse'
  | 'Awarded'
  | 'Withdrawn';

export type UmpireSelection = 'Mutually Agreed' | 'Court Appointed';

export type AwardAgreedBy = 'Both Appraisers' | 'Umpire Decided' | 'All Three Parties';

export interface Appraisal {
  id: string;
  litigation_file_id: string;
  status: AppraisalStatus;
  is_litigated: boolean;

  // Our appraiser (accountable person)
  our_appraiser?: string;
  our_appraiser_phone?: string;
  our_appraiser_email?: string;
  our_appraiser_contact_id?: string;

  // Carrier appraiser
  carrier_appraiser?: string;
  carrier_appraiser_phone?: string;
  carrier_appraiser_email?: string;

  // Umpire
  umpire?: string;
  umpire_phone?: string;
  umpire_email?: string;
  umpire_selection?: UmpireSelection;

  // Inspection dates
  our_inspection_date?: string;
  umpire_inspection_date?: string;

  // Financial
  our_appraisal_amount?: number;
  carrier_appraisal_amount?: number;
  award_amount?: number;
  appraiser_fee?: number;

  // Award details
  award_agreed_by?: AwardAgreedBy;
  date_invoked?: string;
  date_resolved?: string;

  // Ratings (1-5)
  our_appraiser_rating?: number;
  our_appraiser_review?: string;
  carrier_appraiser_rating?: number;
  carrier_appraiser_review?: string;
  umpire_rating?: number;
  umpire_review?: string;

  // Notes
  notes?: string;

  // Archive
  archived_at?: string;
  archived_by?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface AppraisalWithFile extends Appraisal {
  litigation_file?: {
    file_number: string;
    client_name: string;
    referral_source: string;
    referral_rep?: string;
    state: string;
  };
}

export interface CreateAppraisalInput {
  litigation_file_id: string;
  is_litigated?: boolean;
}

export interface UpdateAppraisalInput {
  id: string;
  status?: AppraisalStatus;
  is_litigated?: boolean;
  our_appraiser?: string;
  our_appraiser_phone?: string;
  our_appraiser_email?: string;
  our_appraiser_contact_id?: string;
  carrier_appraiser?: string;
  carrier_appraiser_phone?: string;
  carrier_appraiser_email?: string;
  umpire?: string;
  umpire_phone?: string;
  umpire_email?: string;
  umpire_selection?: UmpireSelection;
  our_inspection_date?: string;
  umpire_inspection_date?: string;
  our_appraisal_amount?: number;
  carrier_appraisal_amount?: number;
  award_amount?: number;
  appraiser_fee?: number;
  award_agreed_by?: AwardAgreedBy;
  date_invoked?: string;
  date_resolved?: string;
  our_appraiser_rating?: number;
  our_appraiser_review?: string;
  carrier_appraiser_rating?: number;
  carrier_appraiser_review?: string;
  umpire_rating?: number;
  umpire_review?: string;
  notes?: string;
}

export interface AppraisalUpdate {
  id: string;
  appraisal_id: string;
  entered_by: string;
  description: string;
  status_at_update?: string;
  next_action_date?: string;
  created_at: string;
}

export interface CreateAppraisalUpdateInput {
  appraisal_id: string;
  entered_by: string;
  description: string;
  status_at_update?: string;
  next_action_date?: string;
}

export const APPRAISAL_STATUS_OPTIONS: AppraisalStatus[] = [
  'Pending',
  'Appraiser Selection',
  'Umpire Selection',
  'In Progress',
  'Impasse',
  'Awarded',
  'Withdrawn',
];

export const UMPIRE_SELECTION_OPTIONS: UmpireSelection[] = [
  'Mutually Agreed',
  'Court Appointed',
];

export const AWARD_AGREED_BY_OPTIONS: AwardAgreedBy[] = [
  'Both Appraisers',
  'Umpire Decided',
  'All Three Parties',
];

export function getAppraisalStatusColor(status: AppraisalStatus): string {
  switch (status) {
    case 'Pending': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Appraiser Selection': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'Umpire Selection': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'In Progress': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Impasse': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'Awarded': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Withdrawn': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}
