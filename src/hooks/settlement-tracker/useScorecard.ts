"use client";
import { useMemo } from 'react';
import { useLitigationFiles } from './useLitigationFiles';
import { useSettlements } from './useSettlements';
import { calculateDaysToCRN } from '@/types/settlement-tracker/litigation';

export interface AttorneyMetrics {
  attorneyFirm: string;
  totalFiles: number;
  openFiles: number;
  settledFiles: number;
  avgDaysToCRN: number | null;
  avgDaysToSettlement: number | null;
  avgSettlementAmount: number | null;
  totalSettlementAmount: number;
  totalFees: number;
  feeEfficiency: number | null;
  successRate: number;
}

export interface ContractorMetrics {
  referralSource: string;
  totalReferrals: number;
  settledCount: number;
  avgCycleTime: number | null;
  avgSettlementAmount: number | null;
  successRate: number;
  topAttorneys: { firm: string; count: number }[];
}

const MS_PER_DAY = 86_400_000;

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function avg(values: (number | null)[]): number | null {
  const filtered = values.filter((v): v is number => v !== null && !isNaN(v));
  return filtered.length > 0 ? sum(filtered) / filtered.length : null;
}

function roundedAvg(values: (number | null)[]): number | null {
  const result = avg(values);
  return result !== null ? Math.round(result) : null;
}

function calculateAvgDaysToSettlement(files: any[], settlements: any[]): number | null {
  const days = settlements.map(settlement => {
    const file = files.find((f: any) => f.id === settlement.litigation_file_id);
    if (!file) return null;

    const diffTime = new Date(settlement.date_settled).getTime() - new Date(file.date_attorney_onboarded).getTime();
    return Math.ceil(diffTime / MS_PER_DAY);
  });

  return roundedAvg(days);
}

function calculateFeeEfficiency(settlements: any[]): number | null {
  if (settlements.length === 0) return null;
  const totalSettlements = sum(settlements.map((s: any) => s.settlement_amount || 0));
  return totalSettlements > 0 ? sum(settlements.map((s: any) => s.attorney_fees || 0)) / totalSettlements : null;
}

export function useAttorneyScorecard(): AttorneyMetrics[] {
  const { data: files = [] } = useLitigationFiles();
  const { data: settlements = [] } = useSettlements();

  return useMemo(() => {
    if (!files.length) return [];

    const grouped = files.reduce((acc, file) => {
      const key = file.attorney_firm;
      if (!acc[key]) {
        acc[key] = {
          attorneyFirm: key,
          files: [],
          settlements: [],
        };
      }
      acc[key].files.push(file);

      const settlement = settlements.find(s => s.litigation_file_id === file.id);
      if (settlement) {
        acc[key].settlements.push(settlement);
      }

      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).map((group: any): AttorneyMetrics => ({
      attorneyFirm: group.attorneyFirm,
      totalFiles: group.files.length,
      openFiles: group.files.filter((f: any) => !['Settled', 'Closed (No Pay)'].includes(f.status)).length,
      settledFiles: group.settlements.length,
      avgDaysToCRN: roundedAvg(group.files.map((f: any) => calculateDaysToCRN(f.date_attorney_onboarded, f.date_crn_filed))),
      avgDaysToSettlement: calculateAvgDaysToSettlement(group.files, group.settlements),
      avgSettlementAmount: avg(group.settlements.map((s: any) => s.settlement_amount)),
      totalSettlementAmount: sum(group.settlements.map((s: any) => s.settlement_amount || 0)),
      totalFees: sum(group.settlements.map((s: any) => s.attorney_fees || 0)),
      feeEfficiency: calculateFeeEfficiency(group.settlements),
      successRate: group.files.length > 0 ? group.settlements.length / group.files.length : 0,
    }));
  }, [files, settlements]);
}

export function computeReferralMetrics(files: any[], settlements: any[]): ContractorMetrics[] {
  if (!files.length) return [];

  const grouped = files.reduce((acc: Record<string, any>, file: any) => {
    const key = file.referral_source;
    if (!acc[key]) {
      acc[key] = {
        referralSource: key,
        files: [],
        settlements: [],
        attorneyFirms: new Map<string, number>(),
      };
    }
    acc[key].files.push(file);

    const currentCount = acc[key].attorneyFirms.get(file.attorney_firm) || 0;
    acc[key].attorneyFirms.set(file.attorney_firm, currentCount + 1);

    const settlement = settlements.find((s: any) => s.litigation_file_id === file.id);
    if (settlement) {
      acc[key].settlements.push(settlement);
    }

    return acc;
  }, {} as Record<string, any>);

  return Object.values(grouped).map((group: any): ContractorMetrics => {
    const topAttorneys = Array.from(group.attorneyFirms.entries())
      .map((entry: any) => ({ firm: entry[0] as string, count: entry[1] as number }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 3);

    return {
      referralSource: group.referralSource,
      totalReferrals: group.files.length,
      settledCount: group.settlements.length,
      avgCycleTime: calculateAvgDaysToSettlement(group.files, group.settlements),
      avgSettlementAmount: avg(group.settlements.map((s: any) => s.settlement_amount)),
      successRate: group.files.length > 0 ? group.settlements.length / group.files.length : 0,
      topAttorneys,
    };
  });
}

export function useContractorMetrics(): ContractorMetrics[] {
  const { data: files = [] } = useLitigationFiles();
  const { data: settlements = [] } = useSettlements();

  return useMemo(() => computeReferralMetrics(files, settlements), [files, settlements]);
}
