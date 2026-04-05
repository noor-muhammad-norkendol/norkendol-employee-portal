export type MediationStatus = 'Requested' | 'Scheduling' | 'Set' | 'Settled Before' | 'Settled' | 'Impasse';

export type DisputeType = 'Mediation' | 'Arbitration';

export type AttorneyEngagementType = 'Assisting' | 'Fully Onboarded';

export interface Mediation {
  id: string;
  litigation_file_id: string;
  dispute_type: DisputeType;
  mediator?: string;
  mediation_firm?: string;
  mediator_phone?: string;
  mediator_email?: string;
  mediation_date?: string;
  meeting_link?: string;
  status: MediationStatus;
  is_litigated: boolean;
  attorney_onboarded_date?: string;
  notes?: string;
  carrier_rep_name?: string;
  carrier_rep_phone?: string;
  carrier_rep_email?: string;
  carrier_offer?: number;
  our_counter?: number;
  mediator_rating?: number;
  mediator_review?: string;
  carrier_rep_rating?: number;
  carrier_rep_review?: string;
  agreed_amount?: number;
  attorney_name?: string;
  attorney_firm?: string;
  attorney_phone?: string;
  attorney_email?: string;
  attorney_engagement_type?: AttorneyEngagementType;
  attorney_assigned_date?: string;
  attorney_notes?: string;
  archived_at?: string;
  archived_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMediationInput {
  litigation_file_id: string;
  dispute_type?: DisputeType;
  mediator?: string;
  mediation_firm?: string;
  mediator_phone?: string;
  mediator_email?: string;
  mediation_date?: string;
  meeting_link?: string;
  status?: MediationStatus;
  is_litigated?: boolean;
  attorney_onboarded_date?: string;
  notes?: string;
  carrier_rep_name?: string;
  carrier_rep_phone?: string;
  carrier_rep_email?: string;
  carrier_offer?: number;
  our_counter?: number;
  mediator_rating?: number;
  mediator_review?: string;
  carrier_rep_rating?: number;
  carrier_rep_review?: string;
  agreed_amount?: number;
  attorney_name?: string;
  attorney_firm?: string;
  attorney_phone?: string;
  attorney_email?: string;
  attorney_engagement_type?: AttorneyEngagementType;
  attorney_assigned_date?: string;
  attorney_notes?: string;
}

export interface UpdateMediationInput extends Partial<CreateMediationInput> {
  id: string;
}

export interface MediationWithFile extends Mediation {
  litigation_file?: {
    file_number: string;
    client_name: string;
    referral_source: string;
    referral_rep?: string;
    state: string;
  };
}

export interface MediationUpdate {
  id: string;
  mediation_id: string;
  entered_by: string;
  description: string;
  status_at_update?: string;
  next_action_date?: string;
  created_at: string;
}

export interface CreateMediationUpdateInput {
  mediation_id: string;
  entered_by: string;
  description: string;
  status_at_update?: string;
  next_action_date?: string;
}

export const MEDIATION_STATUS_OPTIONS: MediationStatus[] = [
  'Requested',
  'Scheduling',
  'Set',
  'Settled Before',
  'Settled',
  'Impasse',
];

export const DISPUTE_TYPE_OPTIONS: DisputeType[] = [
  'Mediation',
  'Arbitration',
];

export function getDisputeLabels(disputeType: DisputeType) {
  return disputeType === 'Arbitration'
    ? { practitioner: 'Arbitrator', dateLabel: 'Arbitration Date', fileType: 'Arbitration File', trackName: 'Arbitration' }
    : { practitioner: 'Mediator', dateLabel: 'Mediation Date', fileType: 'Mediation File', trackName: 'Mediation' };
}

/** Display name for status — "Settled Before" becomes "Settled Before Mediation/Arbitration" */
export function getStatusDisplayName(status: MediationStatus, disputeType: DisputeType): string {
  if (status === 'Settled Before') {
    return `Settled Before ${disputeType}`;
  }
  return status;
}
