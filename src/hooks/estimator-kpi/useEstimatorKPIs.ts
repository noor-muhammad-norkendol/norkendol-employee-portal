"use client";
import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Estimate, EstimatorMetrics, TeamMetrics } from '@/types/estimator-kpi';
import { useEKSupabase } from './useSupabase';

const DAY_MS = 86_400_000;

// ── Per-Estimator Metrics (pure function) ──────────

export function calculateEstimatorMetrics(
  estimates: Estimate[],
  estimatorId: string,
  estimatorName: string,
): EstimatorMetrics {
  const mine = estimates.filter((e) => e.estimator_id === estimatorId);

  // Only count estimates with severity, time, and value
  const valid = mine.filter((e) => e.severity != null && e.active_time_minutes > 0 && e.estimate_value > 0);

  if (valid.length === 0) {
    return {
      estimatorId, estimatorName, dollarsPerHour: 0, dollarsPerMinute: 0,
      totalValue: 0, totalActiveHours: 0, revisionRate: 0, firstTimeApprovalRate: 0,
      avgDaysHeld: 0, estimateCount: mine.length, severityBreakdown: {},
      avgTimeBySeverity: {}, avgValueBySeverity: {},
    };
  }

  const totalValue = valid.reduce((s, e) => s + e.estimate_value, 0);
  const totalActiveMinutes = valid.reduce((s, e) => s + e.active_time_minutes + e.revision_time_minutes, 0);
  const totalActiveHours = totalActiveMinutes / 60;

  const dollarsPerHour = totalActiveHours > 0 ? totalValue / totalActiveHours : 0;
  const dollarsPerMinute = totalActiveMinutes > 0 ? totalValue / totalActiveMinutes : 0;

  const totalRevisions = valid.reduce((s, e) => s + e.revisions, 0);
  const revisionRate = totalRevisions / valid.length;

  const firstTimeCount = valid.filter((e) => e.revisions === 0).length;
  const firstTimeApprovalRate = (firstTimeCount / valid.length) * 100;

  const now = Date.now();
  const sumDays = valid.reduce((s, e) => {
    const start = new Date(e.date_received).getTime();
    return s + (now - start) / DAY_MS;
  }, 0);
  const avgDaysHeld = sumDays / valid.length;

  // Severity breakdown
  const severityBreakdown: Record<number, number> = {};
  const timeBySev: Record<number, { total: number; count: number }> = {};
  const valueBySev: Record<number, { total: number; count: number }> = {};

  for (const e of valid) {
    const sev = e.severity!;
    severityBreakdown[sev] = (severityBreakdown[sev] || 0) + 1;
    if (!timeBySev[sev]) timeBySev[sev] = { total: 0, count: 0 };
    timeBySev[sev].total += e.active_time_minutes;
    timeBySev[sev].count += 1;
    if (!valueBySev[sev]) valueBySev[sev] = { total: 0, count: 0 };
    valueBySev[sev].total += e.estimate_value;
    valueBySev[sev].count += 1;
  }

  const avgTimeBySeverity: Record<number, number> = {};
  for (const [sev, v] of Object.entries(timeBySev)) {
    avgTimeBySeverity[Number(sev)] = Math.round(v.total / v.count);
  }
  const avgValueBySeverity: Record<number, number> = {};
  for (const [sev, v] of Object.entries(valueBySev)) {
    avgValueBySeverity[Number(sev)] = Math.round((v.total / v.count) * 100) / 100;
  }

  return {
    estimatorId, estimatorName, dollarsPerHour: Math.round(dollarsPerHour * 100) / 100,
    dollarsPerMinute: Math.round(dollarsPerMinute * 100) / 100,
    totalValue: Math.round(totalValue * 100) / 100,
    totalActiveHours: Math.round(totalActiveHours * 100) / 100,
    revisionRate: Math.round(revisionRate * 100) / 100,
    firstTimeApprovalRate: Math.round(firstTimeApprovalRate * 100) / 100,
    avgDaysHeld: Math.round(avgDaysHeld * 10) / 10,
    estimateCount: mine.length, severityBreakdown, avgTimeBySeverity, avgValueBySeverity,
  };
}

// ── Overall Score (weighted formula from source) ───

export function calculateOverallScore(m: EstimatorMetrics): number {
  const dphScore = Math.min(m.dollarsPerHour / 15000, 1) * 40;
  const revScore = Math.max(0, (2 - m.revisionRate) / 2) * 30;
  const ftaScore = (m.firstTimeApprovalRate / 100) * 20;
  const dayScore = Math.max(0, (3 - m.avgDaysHeld) / 3) * 10;
  return Math.round((dphScore + revScore + ftaScore + dayScore) * 100) / 100;
}

// ── Team Metrics (aggregate across all estimators) ──

export function calculateTeamMetrics(estimates: Estimate[]): TeamMetrics {
  // Get unique estimators
  const estimatorMap = new Map<string, string>();
  for (const e of estimates) {
    if (!estimatorMap.has(e.estimator_id)) {
      estimatorMap.set(e.estimator_id, e.estimator_name);
    }
  }

  const rankings: (EstimatorMetrics & { overallScore: number; rank: number })[] = [];

  for (const [id, name] of estimatorMap) {
    const metrics = calculateEstimatorMetrics(estimates, id, name);
    const overallScore = calculateOverallScore(metrics);
    rankings.push({ ...metrics, overallScore, rank: 0 });
  }

  // Sort by overall score descending
  rankings.sort((a, b) => b.overallScore - a.overallScore);
  rankings.forEach((r, i) => { r.rank = i + 1; });

  const count = rankings.length || 1;
  return {
    avgDollarsPerHour: Math.round((rankings.reduce((s, r) => s + r.dollarsPerHour, 0) / count) * 100) / 100,
    avgRevisionRate: Math.round((rankings.reduce((s, r) => s + r.revisionRate, 0) / count) * 100) / 100,
    avgFirstTimeApproval: Math.round((rankings.reduce((s, r) => s + r.firstTimeApprovalRate, 0) / count) * 100) / 100,
    avgDaysHeld: Math.round((rankings.reduce((s, r) => s + r.avgDaysHeld, 0) / count) * 10) / 10,
    totalWeeklyVolume: rankings.reduce((s, r) => s + r.estimateCount, 0),
    totalWeeklyValue: Math.round(rankings.reduce((s, r) => s + r.totalValue, 0) * 100) / 100,
    estimatorRankings: rankings,
  };
}

// ── Settlement Accuracy ──────────────────────────

export function calculateSettlementAccuracy(estimate: Estimate): {
  variance: number;
  accuracyPct: number;
  rating: 'Excellent' | 'Good' | 'Needs Review';
} | null {
  if (!estimate.actual_settlement || !estimate.estimate_value) return null;
  const variance = estimate.actual_settlement - estimate.estimate_value;
  const accuracyPct = estimate.estimate_value !== 0
    ? Math.abs(variance / estimate.estimate_value) * 100
    : 0;
  const rating = accuracyPct <= 10 ? 'Excellent' : accuracyPct <= 25 ? 'Good' : 'Needs Review';
  return { variance: Math.round(variance * 100) / 100, accuracyPct: Math.round(accuracyPct * 100) / 100, rating };
}

// ── React Hooks ──────────────────────────────────

export function useEstimatorKPIs(estimates: Estimate[]): TeamMetrics {
  return useMemo(() => calculateTeamMetrics(estimates), [estimates]);
}

export function useWriteEstimatorKPISnapshots() {
  const { supabase, userInfo } = useEKSupabase();

  return useMutation({
    mutationFn: async (team: TeamMetrics) => {
      if (!userInfo) throw new Error('Not authenticated');
      const today = new Date().toISOString().slice(0, 10);
      const rows = [
        { metric_key: 'avg_dollars_per_hour', metric_value: team.avgDollarsPerHour, metric_unit: '$/hr' },
        { metric_key: 'avg_revision_rate', metric_value: team.avgRevisionRate, metric_unit: 'rate' },
        { metric_key: 'avg_first_time_approval', metric_value: team.avgFirstTimeApproval, metric_unit: '%' },
        { metric_key: 'avg_days_held', metric_value: team.avgDaysHeld, metric_unit: 'days' },
        { metric_key: 'total_weekly_volume', metric_value: team.totalWeeklyVolume, metric_unit: 'count' },
        { metric_key: 'total_weekly_value', metric_value: team.totalWeeklyValue, metric_unit: '$' },
      ].map((r) => ({
        ...r,
        org_id: userInfo.orgId,
        source_module: 'estimator_kpi',
        period_start: today,
        period_end: today,
      }));

      const { error } = await supabase.from('kpi_snapshots').insert(rows);
      if (error) throw new Error(`Failed to write estimator KPI snapshots: ${error.message}`);
    },
  });
}
