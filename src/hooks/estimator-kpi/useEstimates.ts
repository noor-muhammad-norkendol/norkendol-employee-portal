"use client";
import { useState, useEffect, useRef } from 'react';
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
