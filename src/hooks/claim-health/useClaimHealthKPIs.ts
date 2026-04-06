"use client";
import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ClaimHealthRecord, ClaimHealthMetrics, ClaimHealthKPIs } from '@/types/claim-health';
import { useCHSupabase } from './useSupabase';

// Calculate per-claim metrics (pure function)
export function calculateClaimMetrics(claim: ClaimHealthRecord): ClaimHealthMetrics {
  const startMs = new Date(claim.start_date).getTime();
  const nowMs = Date.now();
  const DAY_MS = 86_400_000;

  let daysToSettlement: number | undefined;
  if (claim.is_settled && claim.settlement_date) {
    daysToSettlement = Math.floor((new Date(claim.settlement_date).getTime() - startMs) / DAY_MS);
  }

  let percentageChange: number | undefined;
  if (claim.final_settlement_value != null && claim.starting_value !== 0) {
    percentageChange = ((claim.final_settlement_value - claim.starting_value) / Math.abs(claim.starting_value)) * 100;
  }

  const daysClaimOpen = Math.floor((nowMs - startMs) / DAY_MS);
  const communicationFrequency = daysClaimOpen > 0
    ? Math.round((claim.total_communications / daysClaimOpen) * 100) / 100
    : 0;

  return { daysToSettlement, percentageChange, daysClaimOpen, communicationFrequency };
}

// Calculate aggregate KPIs across all claims (pure function)
export function calculateKPIs(claims: ClaimHealthRecord[]): ClaimHealthKPIs {
  if (claims.length === 0) {
    return {
      averageDaysToSettlement: 0, averagePercentageIncrease: 0,
      averageCommunicationFrequency: 0, totalActiveClaims: 0,
      totalSettledClaims: 0, totalClaims: 0, referralSourcePerformance: [],
    };
  }

  const metrics = claims.map((c) => ({ claim: c, m: calculateClaimMetrics(c) }));

  // Avg days to settlement (settled only)
  const settledWithDays = metrics.filter((x) => x.m.daysToSettlement != null);
  const avgDays = settledWithDays.length > 0
    ? Math.round((settledWithDays.reduce((s, x) => s + x.m.daysToSettlement!, 0) / settledWithDays.length) * 10) / 10
    : 0;

  // Avg percentage increase (settled with final value)
  const withPct = metrics.filter((x) => x.m.percentageChange != null);
  const avgPct = withPct.length > 0
    ? Math.round((withPct.reduce((s, x) => s + x.m.percentageChange!, 0) / withPct.length) * 100) / 100
    : 0;

  // Avg communication frequency (all claims)
  const avgComm = Math.round((metrics.reduce((s, x) => s + x.m.communicationFrequency, 0) / metrics.length) * 100) / 100;

  const totalSettled = claims.filter((c) => c.is_settled).length;
  const totalActive = claims.length - totalSettled;

  // Referral source performance
  const bySource: Record<string, { sum: number; count: number }> = {};
  for (const x of withPct) {
    const src = x.claim.referral_source || 'Unknown';
    if (!bySource[src]) bySource[src] = { sum: 0, count: 0 };
    bySource[src].sum += x.m.percentageChange!;
    bySource[src].count += 1;
  }
  const referralSourcePerformance = Object.entries(bySource)
    .map(([source, v]) => ({ source, avgIncrease: Math.round((v.sum / v.count) * 100) / 100, count: v.count }))
    .sort((a, b) => b.avgIncrease - a.avgIncrease);

  return {
    averageDaysToSettlement: avgDays,
    averagePercentageIncrease: avgPct,
    averageCommunicationFrequency: avgComm,
    totalActiveClaims: totalActive,
    totalSettledClaims: totalSettled,
    totalClaims: claims.length,
    referralSourcePerformance,
  };
}

// Hook to use KPIs derived from claim records
export function useClaimHealthKPIs(records: ClaimHealthRecord[]): ClaimHealthKPIs {
  return useMemo(() => calculateKPIs(records), [records]);
}

// Hook to write KPI snapshots to the kpi_snapshots table
export function useWriteKPISnapshots() {
  const { supabase, userInfo } = useCHSupabase();

  return useMutation({
    mutationFn: async (kpis: ClaimHealthKPIs) => {
      if (!userInfo) throw new Error('Not authenticated');
      const today = new Date().toISOString().slice(0, 10);
      const rows = [
        { metric_key: 'avg_days_to_settlement', metric_value: kpis.averageDaysToSettlement, metric_unit: 'days' },
        { metric_key: 'avg_pct_increase', metric_value: kpis.averagePercentageIncrease, metric_unit: '%' },
        { metric_key: 'avg_communication_frequency', metric_value: kpis.averageCommunicationFrequency, metric_unit: 'per_day' },
        { metric_key: 'total_active_claims', metric_value: kpis.totalActiveClaims, metric_unit: 'count' },
        { metric_key: 'total_settled_claims', metric_value: kpis.totalSettledClaims, metric_unit: 'count' },
        { metric_key: 'total_claims', metric_value: kpis.totalClaims, metric_unit: 'count' },
      ].map((r) => ({
        ...r,
        org_id: userInfo.orgId,
        source_module: 'claim_health',
        period_start: today,
        period_end: today,
      }));

      const { error } = await supabase.from('kpi_snapshots').insert(rows);
      if (error) throw new Error(`Failed to write KPI snapshots: ${error.message}`);
    },
  });
}
