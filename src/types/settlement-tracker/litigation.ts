import { LitigationFileRollups } from '@/types/settlement-tracker/legalAction';

export type LitigationStatus =
  | 'Open'
  | 'Pending CRN'
  | 'Post-CRN'
  | 'In Discovery'
  | 'In Mediation'
  | 'In Trial'
  | 'Settled'
  | 'Closed (No Pay)';

export type LitigationPhase =
  | 'Attorney Onboarding'
  | 'Pending CRN'
  | 'CRN Running'
  | 'Pre-Suit Notice'
  | 'Initial Disclosures'
  | 'Discovery'
  | 'Mediation'
  | 'Trial'
  | 'Settlement'
  | 'Closed';

export interface LitigationFile {
  id: string;
  file_number: string;
  client_name: string;
  date_attorney_onboarded: string;
  attorney_firm: string;
  attorney_contact?: string;
  referral_source: string;
  referral_rep?: string;
  peril?: string;
  status: LitigationStatus;
  phase: LitigationPhase;
  policy_number?: string;
  loss_address?: string;
  date_crn_filed?: string;
  state: string;
  state_workflow_type?: string;
  next_action?: string;
  next_action_date?: string;
  notes?: string;
  attorney_contact_id?: string;
  created_by_name?: string;
  created_by_email?: string;
  current_reserves?: number;
  current_offer?: number;
  created_at: string;
  updated_at: string;
  rollups?: LitigationFileRollups;
}

export interface CreateLitigationFileInput {
  file_number: string;
  client_name: string;
  date_attorney_onboarded: string;
  attorney_firm: string;
  attorney_contact?: string;
  referral_source: string;
  referral_rep?: string;
  peril?: string;
  status: LitigationStatus;
  phase: LitigationPhase;
  policy_number?: string;
  loss_address?: string;
  date_crn_filed?: string;
  state: string;
  state_workflow_type?: string;
  next_action?: string;
  next_action_date?: string;
  current_reserves?: number;
  current_offer?: number;
  notes?: string;
  created_by_name?: string;
  created_by_email?: string;
}

export interface UpdateLitigationFileInput extends Partial<CreateLitigationFileInput> {
  id: string;
}

export const STATUS_OPTIONS: LitigationStatus[] = [
  'Open',
  'Pending CRN', 
  'Post-CRN',
  'In Discovery',
  'In Mediation', 
  'In Trial',
  'Settled',
  'Closed (No Pay)'
];

export const PHASE_OPTIONS_BY_STATE = {
  FL: [
    'Attorney Onboarding',
    'Pending CRN',
    'CRN Running', 
    'Discovery',
    'Mediation',
    'Trial',
    'Settlement',
    'Closed'
  ] as LitigationPhase[],
  TX: [
    'Attorney Onboarding',
    'Pre-Suit Notice',
    'Initial Disclosures',
    'Discovery',
    'Mediation',
    'Trial',
    'Settlement',
    'Closed'
  ] as LitigationPhase[],
  GA: [
    'Attorney Onboarding',
    'Pre-Suit Notice',
    'Discovery',
    'Mediation',
    'Trial',
    'Settlement',
    'Closed'
  ] as LitigationPhase[],
  LA: [
    'Attorney Onboarding',
    'Pre-Suit Notice',
    'Discovery',
    'Mediation',
    'Trial',
    'Settlement',
    'Closed'
  ] as LitigationPhase[],
  SC: [
    'Attorney Onboarding',
    'Pre-Suit Notice',
    'Discovery',
    'Mediation',
    'Trial',
    'Settlement',
    'Closed'
  ] as LitigationPhase[]
};

export const CSV_HEADERS = [
  'fileNumber',
  'clientName', 
  'dateAttorneyOnboarded',
  'attorneyFirm',
  'attorneyContact',
  'referralSource',
  'status',
  'phase',
  'policyNumber',
  'lossAddress',
  'dateCRNFiled',
  'notes'
].join(',');

export function getStatusClassName(status: LitigationStatus): string {
  const statusMap: Record<LitigationStatus, string> = {
    'Open': 'status-open',
    'Pending CRN': 'status-pending-crn', 
    'Post-CRN': 'status-post-crn',
    'In Discovery': 'status-in-discovery',
    'In Mediation': 'status-in-mediation',
    'In Trial': 'status-in-trial',
    'Settled': 'status-settled',
    'Closed (No Pay)': 'status-closed'
  };
  return statusMap[status] || 'status-open';
}

export function calculateDaysSinceOnboarded(onboardedDate: string): number {
  const diffMs = Math.abs(Date.now() - new Date(onboardedDate).getTime());
  return Math.ceil(diffMs / 86_400_000);
}

export function calculateDaysToCRN(dateAttorneyOnboarded?: string, dateCRNFiled?: string): number | null {
  if (!dateAttorneyOnboarded || !dateCRNFiled) return null;
  const diffMs = new Date(dateCRNFiled).getTime() - new Date(dateAttorneyOnboarded).getTime();
  return Math.ceil(diffMs / 86_400_000);
}

export function isCRNExpired61(dateCRNFiled?: string): boolean {
  return isCRNUnlockReady(dateCRNFiled ?? null);
}

export function isOverdue(d?: string | Date | null): boolean {
  if (!d) return false;
  const due = new Date(d);
  due.setHours(23, 59, 59, 999);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return due.getTime() < today.getTime();
}

export function isDueSoon(
  d?: string | Date | null,
  windowDays: number = 7
): boolean {
  if (!d) return false;
  const due = new Date(d);
  due.setHours(23, 59, 59, 999);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  if (diffMs < 0) return false;
  return Math.ceil(diffMs / 86_400_000) <= windowDays;
}

export function isCRNUnlockReady(dateCRNFiled: string | Date | null): boolean {
  if (!dateCRNFiled) return false;
  
  const crnDate = new Date(dateCRNFiled);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const daysSinceCRN = Math.floor((today.getTime() - crnDate.getTime()) / 86_400_000);
  return daysSinceCRN >= 61;
}

export function hasPostCRNStep(steps: any[]): boolean {
  const postCRNTypes = [
    'Deposition (Corp Rep)', 
    'Deposition (Plaintiff)', 
    'Expert Disclosure',
    'Hearing',
    'Motion (MSJ)',
    'Trial',
    'Mediation'
  ];
  
  return steps.some(s => 
    postCRNTypes.includes(s.action_type) && 
    s.status !== 'Canceled'
  );
}