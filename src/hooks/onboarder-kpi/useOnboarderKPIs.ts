"use client";
import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { OnboardingClient, OnboarderMetrics, TeamOnboardingMetrics, STAGE_TARGET_HOURS } from '@/types/onboarder-kpi';
import { useOKSupabase } from './useSupabase';

const HOUR_MS = 3_600_000;

// ── Per-Onboarder Metrics ──────────────────────────

export function calculateOnboarderMetrics(
  clients: OnboardingClient[],
  onboarderId: string,
  onboarderName: string,
  periodDays: number = 7,
): OnboarderMetrics {
  const mine = clients.filter(
    (c) => c.created_by_id === onboarderId || c.assigned_user_id === onboarderId
  );

  const totalEntries = mine.length;
  const completed = mine.filter((c) => c.status === 'completed').length;
  const completionRate = totalEntries > 0 ? Math.round((completed / totalEntries) * 10000) / 100 : 0;

  // Avg time to completion (hours)
  const completedClients = mine.filter((c) => c.completed_at);
  const avgTimeToCompletionHours = completedClients.length > 0
    ? Math.round(
        completedClients.reduce((sum, c) => {
          const hrs = (new Date(c.completed_at!).getTime() - new Date(c.created_at).getTime()) / HOUR_MS;
          return sum + hrs;
        }, 0) / completedClients.length * 100
      ) / 100
    : 0;

  // Overdue rate
  const activeStatuses = ['step_2', 'step_3', 'final_step', 'on_hold'] as const;
  const active = mine.filter((c) => (activeStatuses as readonly string[]).includes(c.status));
  const now = Date.now();
  const overdueCount = active.filter((c) => {
    const target = STAGE_TARGET_HOURS[c.status as keyof typeof STAGE_TARGET_HOURS];
    if (!target) return false;
    const hoursInStage = (now - new Date(c.status_entered_at).getTime()) / HOUR_MS;
    return hoursInStage > target;
  }).length;
  const overdueRate = active.length > 0 ? Math.round((overdueCount / active.length) * 10000) / 100 : 0;

  // Conversion rate (contract sent or beyond)
  const contractSent = mine.filter((c) =>
    c.contract_status && ['sent', 'signed', 'viewed'].includes(c.contract_status)
  ).length;
  const conversionRate = totalEntries > 0 ? Math.round((contractSent / totalEntries) * 10000) / 100 : 0;

  const entriesPerDay = periodDays > 0 ? Math.round((totalEntries / periodDays) * 100) / 100 : 0;

  return {
    onboarderId, onboarderName, totalEntries, completed, completionRate,
    avgTimeToCompletionHours, overdueCount, overdueRate, conversionRate, entriesPerDay,
  };
}

// ── Team Metrics ───────────────────────────────────

export function calculateTeamOnboardingMetrics(
  clients: OnboardingClient[],
  periodDays: number = 7,
): TeamOnboardingMetrics {
  // Get unique onboarders
  const onboarderMap = new Map<string, string>();
  for (const c of clients) {
    if (c.assigned_user_id && !onboarderMap.has(c.assigned_user_id)) {
      onboarderMap.set(c.assigned_user_id, c.assigned_user_name || 'Unknown');
    }
    if (!onboarderMap.has(c.created_by_id)) {
      onboarderMap.set(c.created_by_id, c.created_by_name);
    }
  }

  const rankings: (OnboarderMetrics & { rank: number })[] = [];
  for (const [id, name] of onboarderMap) {
    const metrics = calculateOnboarderMetrics(clients, id, name, periodDays);
    rankings.push({ ...metrics, rank: 0 });
  }

  // Sort by completion rate descending
  rankings.sort((a, b) => b.completionRate - a.completionRate);
  rankings.forEach((r, i) => { r.rank = i + 1; });

  const count = rankings.length || 1;
  return {
    avgCompletionRate: Math.round((rankings.reduce((s, r) => s + r.completionRate, 0) / count) * 100) / 100,
    avgTimeToCompletion: Math.round((rankings.reduce((s, r) => s + r.avgTimeToCompletionHours, 0) / count) * 100) / 100,
    avgOverdueRate: Math.round((rankings.reduce((s, r) => s + r.overdueRate, 0) / count) * 100) / 100,
    avgConversionRate: Math.round((rankings.reduce((s, r) => s + r.conversionRate, 0) / count) * 100) / 100,
    totalEntries: rankings.reduce((s, r) => s + r.totalEntries, 0),
    totalCompleted: rankings.reduce((s, r) => s + r.completed, 0),
    onboarderRankings: rankings,
  };
}

// ── React Hooks ──────────────────────────────────

export function useOnboarderKPIs(clients: OnboardingClient[]): TeamOnboardingMetrics {
  return useMemo(() => calculateTeamOnboardingMetrics(clients), [clients]);
}

export function useWriteOnboarderKPISnapshots() {
  const { supabase, userInfo } = useOKSupabase();

  return useMutation({
    mutationFn: async (team: TeamOnboardingMetrics) => {
      if (!userInfo) throw new Error('Not authenticated');
      const today = new Date().toISOString().slice(0, 10);
      const rows = [
        { metric_key: 'avg_completion_rate', metric_value: team.avgCompletionRate, metric_unit: '%' },
        { metric_key: 'avg_time_to_completion', metric_value: team.avgTimeToCompletion, metric_unit: 'hours' },
        { metric_key: 'avg_overdue_rate', metric_value: team.avgOverdueRate, metric_unit: '%' },
        { metric_key: 'avg_conversion_rate', metric_value: team.avgConversionRate, metric_unit: '%' },
        { metric_key: 'total_entries', metric_value: team.totalEntries, metric_unit: 'count' },
        { metric_key: 'total_completed', metric_value: team.totalCompleted, metric_unit: 'count' },
      ].map((r) => ({
        ...r,
        org_id: userInfo.orgId,
        source_module: 'onboarder_kpi',
        period_start: today,
        period_end: today,
      }));

      const { error } = await supabase.from('kpi_snapshots').insert(rows);
      if (error) throw new Error(`Failed to write onboarder KPI snapshots: ${error.message}`);
    },
  });
}
