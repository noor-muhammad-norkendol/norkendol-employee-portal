"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEKSupabase } from './useSupabase';
import { Estimate, CreateEstimateInput, UpdateEstimateInput } from '@/types/estimator-kpi';

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
    mutationFn: async (input: CreateEstimateInput) => {
      if (!userInfo) throw new Error('Not authenticated');
      const cleaned = Object.fromEntries(
        Object.entries(input).map(([k, v]) => [k, v === '' ? null : v])
      );
      const { data, error } = await supabase
        .from('estimates')
        .insert({
          ...cleaned,
          org_id: userInfo.orgId,
          estimator_id: userInfo.userId,
          estimator_name: userInfo.fullName,
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
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
