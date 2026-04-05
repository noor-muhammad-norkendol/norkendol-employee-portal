export type LegalActionType = 
  | 'CRN' 
  | 'Demand' 
  | 'Offer' 
  | 'Mediation' 
  | 'Deposition (Corp Rep)' 
  | 'Deposition (Plaintiff)' 
  | 'Expert Disclosure' 
  | 'Hearing' 
  | 'Motion (MSJ)' 
  | 'Trial' 
  | 'Settlement Processing' 
  | 'Other';

export type LegalActionStatus = 
  | 'Planned' 
  | 'Scheduled' 
  | 'Completed' 
  | 'Skipped' 
  | 'Canceled';

export interface LegalAction {
  id: string;
  litigation_file_id: string;
  action_type: LegalActionType;
  status: LegalActionStatus;
  title: string;
  due_date?: string;
  scheduled_date?: string;
  completed_date?: string;
  unlocked_date?: string;
  notes?: string;
  order_index: number;
  result?: string;
  doc_links?: string;
  created_by_name?: string;
  created_by_email?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLegalActionInput {
  litigation_file_id: string;
  action_type: LegalActionType;
  status: LegalActionStatus;
  title: string;
  due_date?: string;
  scheduled_date?: string;
  completed_date?: string;
  unlocked_date?: string;
  notes?: string;
  order_index?: number;
  result?: string;
  doc_links?: string;
  created_by_name?: string;
  created_by_email?: string;
}

export interface UpdateLegalActionInput extends Partial<CreateLegalActionInput> {
  id: string;
}

export interface LitigationFileRollups {
  litigationFileId: string;
  stepCount: number;
  nextDueDate?: string;
  lastCompletedDate?: string;
}

export const ACTION_TYPE_OPTIONS: LegalActionType[] = [
  'CRN',
  'Demand', 
  'Offer',
  'Mediation',
  'Deposition (Corp Rep)',
  'Deposition (Plaintiff)',
  'Expert Disclosure',
  'Hearing',
  'Motion (MSJ)',
  'Trial',
  'Settlement Processing',
  'Other'
];

export const ACTION_STATUS_OPTIONS: LegalActionStatus[] = [
  'Planned',
  'Scheduled',
  'Completed',
  'Skipped',
  'Canceled'
];

export const DEFAULT_TITLES: Record<LegalActionType, string> = {
  'CRN': 'File CRN',
  'Demand': 'Send Demand Letter',
  'Offer': 'Settlement Offer',
  'Mediation': 'Mediation',
  'Deposition (Corp Rep)': 'Corp Rep Deposition',
  'Deposition (Plaintiff)': 'Plaintiff Deposition',
  'Expert Disclosure': 'Expert Disclosure',
  'Hearing': 'Court Hearing',
  'Motion (MSJ)': 'Motion for Summary Judgment',
  'Trial': 'Trial',
  'Settlement Processing': 'Settlement Processing',
  'Other': 'Other Action'
};

export function getActionStatusClassName(status: LegalActionStatus): string {
  const statusMap: Record<LegalActionStatus, string> = {
    'Planned': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'Scheduled': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'Completed': 'bg-green-500/20 text-green-300 border-green-500/30',
    'Skipped': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    'Canceled': 'bg-red-500/20 text-red-300 border-red-500/30'
  };
  return statusMap[status] || statusMap.Planned;
}

export function getActionTypeClassName(actionType: LegalActionType): string {
  const typeMap: Record<LegalActionType, string> = {
    'CRN': 'bg-primary/20 text-primary border-primary/30',
    'Demand': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'Offer': 'bg-green-500/20 text-green-300 border-green-500/30',
    'Mediation': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'Deposition (Corp Rep)': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'Deposition (Plaintiff)': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    'Expert Disclosure': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    'Hearing': 'bg-red-500/20 text-red-300 border-red-500/30',
    'Motion (MSJ)': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'Trial': 'bg-red-600/20 text-red-400 border-red-600/30',
    'Settlement Processing': 'bg-green-600/20 text-green-400 border-green-600/30',
    'Other': 'bg-gray-500/20 text-gray-300 border-gray-500/30'
  };
  return typeMap[actionType] || typeMap.Other;
}

export function formatScheduledDate(scheduledDate?: string): string {
  if (!scheduledDate) return '-';
  return new Date(scheduledDate).toLocaleString();
}

export const STEPS_CSV_HEADERS = [
  'litigationFileId',
  'fileNumber',
  'actionType',
  'title', 
  'status',
  'dueDate',
  'scheduledDate',
  'completedDate',
  'orderIndex',
  'result',
  'notes'
].join(',');