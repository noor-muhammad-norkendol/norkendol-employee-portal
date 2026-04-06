"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEKSupabase } from './useSupabase';
import { EstimateBlocker, BlockerType } from '@/types/estimator-kpi';

export function useEstimateBlockers(estimateId?: string) {
  const { supabase, userInfo } = useEKSupabase();

  return useQuery({
    queryKey: ['estimate-blockers', estimateId],
    queryFn: async (): Promise<EstimateBlocker[]> => {
      if (!estimateId) return [];
      const { data, error } = await supabase
        .from('estimate_blockers')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('blocked_at', { ascending: false });
      if (error) throw new Error(`Failed to fetch blockers: ${error.message}`);
      return (data || []) as EstimateBlocker[];
    },
    enabled: !!userInfo && !!estimateId,
  });
}

export function useCreateBlocker() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useEKSupabase();

  return useMutation({
    mutationFn: async (input: {
      estimate_id: string;
      blocker_type: BlockerType;
      blocker_name: string;
      blocker_reason?: string;
    }) => {
      if (!userInfo) throw new Error('Not authenticated');
      const now = new Date().toISOString();

      // 1. Create blocker record
      const { data: blocker, error: bErr } = await supabase
        .from('estimate_blockers')
        .insert({
          org_id: userInfo.orgId,
          estimate_id: input.estimate_id,
          blocker_type: input.blocker_type,
          blocker_name: input.blocker_name,
          blocker_reason: input.blocker_reason || null,
          blocked_at: now,
          created_by_id: userInfo.userId,
          created_by_name: userInfo.fullName,
        })
        .select()
        .maybeSingle();
      if (bErr) throw new Error(`Failed to create blocker: ${bErr.message}`);

      // 2. Update estimate status to blocked
      const { error: eErr } = await supabase
        .from('estimates')
        .update({
          status: 'blocked',
          current_blocker_type: input.blocker_type,
          current_blocker_name: input.blocker_name,
          current_blocker_reason: input.blocker_reason || null,
          current_blocked_at: now,
          updated_at: now,
        })
        .eq('id', input.estimate_id);
      if (eErr) throw new Error(`Failed to update estimate status: ${eErr.message}`);

      // 3. Log audit event
      await supabase.from('estimate_events').insert({
        org_id: userInfo.orgId,
        estimate_id: input.estimate_id,
        event_type: 'blocker_set',
        new_value: `${input.blocker_type}: ${input.blocker_name}`,
        created_by_id: userInfo.userId,
        created_by_name: userInfo.fullName,
      });

      return blocker;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      queryClient.invalidateQueries({ queryKey: ['estimate-blockers'] });
    },
  });
}

export function useResolveBlocker() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useEKSupabase();

  return useMutation({
    mutationFn: async (input: {
      blocker_id: string;
      estimate_id: string;
      resolution_note?: string;
      current_blocked_time_minutes: number; // existing blocked_time on the estimate
    }) => {
      if (!userInfo) throw new Error('Not authenticated');
      const now = new Date().toISOString();

      // 1. Get the blocker to calculate duration
      const { data: blocker } = await supabase
        .from('estimate_blockers')
        .select('blocked_at')
        .eq('id', input.blocker_id)
        .single();

      const durationMinutes = blocker
        ? Math.round((Date.now() - new Date(blocker.blocked_at).getTime()) / 60000)
        : 0;

      // 2. Resolve the blocker
      const { error: bErr } = await supabase
        .from('estimate_blockers')
        .update({
          resolved_at: now,
          duration_minutes: durationMinutes,
          resolution_note: input.resolution_note || null,
        })
        .eq('id', input.blocker_id);
      if (bErr) throw new Error(`Failed to resolve blocker: ${bErr.message}`);

      // 3. Update estimate — add blocked time, clear blocker fields, set in-progress
      const newBlockedMinutes = input.current_blocked_time_minutes + durationMinutes;
      const { error: eErr } = await supabase
        .from('estimates')
        .update({
          status: 'in-progress',
          blocked_time_minutes: newBlockedMinutes,
          total_time_minutes: newBlockedMinutes, // will be recalculated with active_time on next save
          current_blocker_type: null,
          current_blocker_name: null,
          current_blocker_reason: null,
          current_blocked_at: null,
          updated_at: now,
        })
        .eq('id', input.estimate_id);
      if (eErr) throw new Error(`Failed to update estimate: ${eErr.message}`);

      // 4. Log audit event
      await supabase.from('estimate_events').insert({
        org_id: userInfo.orgId,
        estimate_id: input.estimate_id,
        event_type: 'blocker_resolved',
        old_value: `Blocked for ${durationMinutes} min`,
        new_value: input.resolution_note || 'Resolved',
        created_by_id: userInfo.userId,
        created_by_name: userInfo.fullName,
      });

      return { durationMinutes };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      queryClient.invalidateQueries({ queryKey: ['estimate-blockers'] });
    },
  });
}
