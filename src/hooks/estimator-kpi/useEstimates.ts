"use client";
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useEKSupabase } from './useSupabase';
import { Estimate, CreateEstimateInput, UpdateEstimateInput } from '@/types/estimator-kpi';

// Spoke #9 auto-create: when an estimate hits status='review', CREATE-ONCE
// a team_lead_reviews Phase 2 row. 'review' is the natural "estimator done,
// awaiting TL review before going to carrier" gate per the existing status
// enum. If a Phase 2 row already exists for this (org, file_number) combo,
// we do NOT touch it — preserves any review work the TL has done.
async function ensureTLSPhase2Row(supabase: SupabaseClient, row: Estimate) {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) {
    console.warn('[TLS Phase 2] skipped: no signed-in user');
    return;
  }
  if (!row.file_number) {
    console.warn('[TLS Phase 2] skipped: estimate row has no file_number', { row });
    return;
  }

  const { data: existing, error: checkErr } = await supabase
    .from('team_lead_reviews')
    .select('id')
    .eq('org_id', row.org_id)
    .eq('file_number', row.file_number)
    .eq('phase', 'phase_2')
    .maybeSingle();
  if (checkErr) {
    console.error('[TLS Phase 2] existence check failed:', checkErr);
    return;
  }
  if (existing) {
    console.info('[TLS Phase 2] row already exists — skipping', { file_number: row.file_number });
    return;
  }

  const r = row as Estimate & {
    policy_number?: string | null;
    loss_address?: string | null;
    peril_other?: string | null;
    severity?: number | null;
  };
  const payload = {
    org_id: row.org_id,
    file_number: row.file_number,
    claim_number: row.claim_number || null,
    policy_number: r.policy_number || null,
    client_name: row.client_name || null,
    loss_address: r.loss_address || null,
    peril: row.peril || null,
    peril_other: r.peril_other || null,
    severity: r.severity ?? null,
    phase: 'phase_2' as const,
    status: 'pending' as const,
    created_by: userId,
  };
  const { error: insertErr } = await supabase.from('team_lead_reviews').insert(payload);
  if (insertErr) {
    console.error('[TLS Phase 2] INSERT failed:', insertErr, 'payload:', payload);
    return;
  }
  console.info('[TLS Phase 2] row created for', row.file_number);
}

export function useEstimates() {
  const { supabase, userInfo } = useEKSupabase();

  return useQuery({
    queryKey: ['estimates', userInfo?.orgId, userInfo?.userId, userInfo?.role],
    queryFn: async (): Promise<Estimate[]> => {
      if (!userInfo) return [];
      let query = supabase
        .from('estimates')
        .select('*')
        .eq('org_id', userInfo.orgId)
        .order('date_received', { ascending: false });

      const adminRoles = ['admin', 'super_admin', 'system_admin'];
      if (!adminRoles.includes(userInfo.role)) {
        query = query.eq('estimator_id', userInfo.userId);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to fetch estimates: ${error.message}`);
      return (data || []) as Estimate[];
    },
    enabled: !!userInfo,
  });
}

export function useCreateEstimate() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useEKSupabase();

  return useMutation({
    mutationFn: async (input: CreateEstimateInput & { parentEstimateId?: string | null }) => {
      if (!userInfo) throw new Error('Not authenticated');
      const { parentEstimateId, ...rest } = input;
      const cleaned = Object.fromEntries(
        Object.entries(rest).map(([k, v]) => [k, v === '' ? null : v])
      );

      // Find root parent and calculate revision number
      let rootId: string | null = null;
      let revision_number = 0;
      if (parentEstimateId) {
        // Check if the matched estimate is itself a child — if so, trace up to root
        const { data: matched } = await supabase
          .from('estimates')
          .select('id, parent_estimate_id')
          .eq('id', parentEstimateId)
          .single();
        rootId = matched?.parent_estimate_id || matched?.id || parentEstimateId;

        // Count all existing children of the root
        const { count } = await supabase
          .from('estimates')
          .select('id', { count: 'exact', head: true })
          .eq('parent_estimate_id', rootId);
        revision_number = (count ?? 0) + 1;
      }

      const { data, error } = await supabase
        .from('estimates')
        .insert({
          ...cleaned,
          org_id: userInfo.orgId,
          estimator_id: userInfo.userId,
          estimator_name: userInfo.fullName,
          parent_estimate_id: rootId || null,
          revision_number,
        })
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to create estimate: ${error.message}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
    },
  });
}

// Debounced search for matching file numbers (for revision linking)
export function useSearchEstimatesByFileNumber(fileNumber: string) {
  const { supabase, userInfo } = useEKSupabase();
  const [results, setResults] = useState<Estimate[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!fileNumber || fileNumber.length < 3 || !userInfo) {
      setResults([]);
      return;
    }

    setSearching(true);
    timerRef.current = setTimeout(async () => {
      // Find the most recent estimate with this file number (any in the chain)
      const { data } = await supabase
        .from('estimates')
        .select('*')
        .eq('org_id', userInfo.orgId)
        .eq('file_number', fileNumber)
        .order('revision_number', { ascending: false })
        .limit(1);
      setResults((data || []) as Estimate[]);
      setSearching(false);
    }, 500);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [fileNumber, userInfo, supabase]);

  return { results, searching };
}

export function useUpdateEstimate() {
  const queryClient = useQueryClient();
  const { supabase } = useEKSupabase();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateEstimateInput) => {
      // Recalculate total_time if time fields changed
      const timeUpdates: Record<string, unknown> = { ...updates };
      if ('active_time_minutes' in updates || 'blocked_time_minutes' in updates || 'revision_time_minutes' in updates) {
        const active = updates.active_time_minutes ?? 0;
        const blocked = updates.blocked_time_minutes ?? 0;
        timeUpdates.total_time_minutes = active + blocked;
      }

      const { data, error } = await supabase
        .from('estimates')
        .update({ ...timeUpdates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to update estimate: ${error.message}`);

      // Auto-create TLS Phase 2 row when estimate hits 'review' status.
      // Idempotent — running multiple times is a no-op.
      if (data && (data as Estimate).status === 'review') {
        try {
          await ensureTLSPhase2Row(supabase, data as Estimate);
        } catch (e) {
          // Non-fatal: log but don't fail the estimate update.
          console.error('TLS Phase 2 auto-create failed:', e);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      queryClient.invalidateQueries({ queryKey: ['team-lead-reviews'] });
    },
  });
}

export function useDeleteEstimate() {
  const queryClient = useQueryClient();
  const { supabase } = useEKSupabase();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('estimates')
        .delete()
        .eq('id', id);
      if (error) throw new Error(`Failed to delete estimate: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
    },
  });
}
