"use client";
import { LegalAction, LegalActionType } from '@/types/settlement-tracker/legalAction';
import { LitigationPhase, LitigationStatus } from '@/types/settlement-tracker/litigation';

const PHASE_MAP: Record<LegalActionType, LitigationPhase> = {
  'CRN': 'CRN Running',
  'Deposition (Corp Rep)': 'Discovery',
  'Deposition (Plaintiff)': 'Discovery',
  'Expert Disclosure': 'Discovery',
  'Mediation': 'Mediation',
  'Motion (MSJ)': 'Trial',
  'Hearing': 'Trial',
  'Trial': 'Trial',
  'Settlement Processing': 'Settlement',
  'Demand': 'CRN Running',
  'Offer': 'CRN Running',
  'Other': 'CRN Running',
};

const ACTIVE_STATUSES = ['Scheduled', 'Completed'] as const;

function hasActiveStepOfType(steps: LegalAction[], actionTypes: string[]): boolean {
  return steps.some(
    s => actionTypes.includes(s.action_type) && ACTIVE_STATUSES.includes(s.status as typeof ACTIVE_STATUSES[number])
  );
}

export function derivePhaseFromSteps(steps: LegalAction[]): LitigationPhase | null {
  const activeSteps = steps
    .filter(s => ACTIVE_STATUSES.includes(s.status as typeof ACTIVE_STATUSES[number]))
    .sort((a, b) => {
      if (a.status === 'Scheduled' && b.status !== 'Scheduled') return -1;
      if (b.status === 'Scheduled' && a.status !== 'Scheduled') return 1;

      const dateA = a.scheduled_date || a.completed_date || a.due_date;
      const dateB = b.scheduled_date || b.completed_date || b.due_date;
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  if (activeSteps.length === 0) return null;

  return PHASE_MAP[activeSteps[0].action_type] || null;
}

export function deriveStatusFromSteps(steps: LegalAction[]): LitigationStatus | null {
  if (steps.some(s => s.action_type === 'Settlement Processing' && s.status === 'Completed')) {
    return 'Settled';
  }
  if (hasActiveStepOfType(steps, ['Motion (MSJ)', 'Hearing', 'Trial'])) return 'In Trial';
  if (hasActiveStepOfType(steps, ['Mediation'])) return 'In Mediation';
  if (hasActiveStepOfType(steps, ['Deposition (Corp Rep)', 'Deposition (Plaintiff)', 'Expert Disclosure'])) return 'In Discovery';
  if (hasActiveStepOfType(steps, ['CRN'])) return 'Post-CRN';

  return null;
}

const MANUAL_OVERRIDE_KEY = 'litigation_manual_overrides';

export interface ManualOverride {
  fileId: string;
  field: 'phase' | 'status';
  value: string;
  timestamp: string;
}

function loadOverrides(): ManualOverride[] {
  return JSON.parse(localStorage.getItem(MANUAL_OVERRIDE_KEY) || '[]');
}

function saveOverrides(overrides: ManualOverride[]): void {
  localStorage.setItem(MANUAL_OVERRIDE_KEY, JSON.stringify(overrides));
}

function findOverride(fileId: string, field: 'phase' | 'status'): ManualOverride | undefined {
  return loadOverrides().find(o => o.fileId === fileId && o.field === field);
}

function filterOutOverride(overrides: ManualOverride[], fileId: string, field: 'phase' | 'status'): ManualOverride[] {
  return overrides.filter(o => !(o.fileId === fileId && o.field === field));
}

export function setManualOverride(fileId: string, field: 'phase' | 'status', value: string): void {
  const filtered = filterOutOverride(loadOverrides(), fileId, field);
  filtered.push({ fileId, field, value, timestamp: new Date().toISOString() });
  saveOverrides(filtered);
}

export function hasRecentManualOverride(fileId: string, field: 'phase' | 'status'): boolean {
  const override = findOverride(fileId, field);
  if (!override) return false;

  const daysSince = Math.floor((Date.now() - new Date(override.timestamp).getTime()) / 86_400_000);
  return daysSince < 7;
}

export function getManualOverride(fileId: string, field: 'phase' | 'status'): ManualOverride | null {
  return findOverride(fileId, field) ?? null;
}

export function removeManualOverride(fileId: string, field: 'phase' | 'status'): void {
  saveOverrides(filterOutOverride(loadOverrides(), fileId, field));
}

export function getAutoSuggestions(steps: LegalAction[]) {
  return {
    phase: derivePhaseFromSteps(steps),
    status: deriveStatusFromSteps(steps),
  };
}
