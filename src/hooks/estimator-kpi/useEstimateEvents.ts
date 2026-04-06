"use client";
import { useQuery, useMutation } from '@tanstack/react-query';
import { useEKSupabase } from './useSupabase';
import { EstimateEvent } from '@/types/estimator-kpi';

export function useEstimateEvents(estimateId?: string) {
  const { supabase, userInfo } = useEKSupabase();

  return useQuery({
    queryKey: ['estimate-events', estimateId],
    queryFn: async (): Promise<EstimateEvent[]> => {
      if (!estimateId) return [];
      const { data, error } = await supabase
        .from('estimate_events')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Failed to fetch events: ${error.message}`);
      return (data || []) as EstimateEvent[];
    },
    enabled: !!userInfo && !!estimateId,
  });
}

export function useLogEstimateEvent() {
  const { supabase, userInfo } = useEKSupabase();

  return useMutation({
    mutationFn: async (input: {
      estimate_id: string;
      event_type: EstimateEvent['event_type'];
      old_value?: string;
      new_value?: string;
    }) => {
      if (!userInfo) throw new Error('Not authenticated');
      const { error } = await supabase.from('estimate_events').insert({
        org_id: userInfo.orgId,
        estimate_id: input.estimate_id,
        event_type: input.event_type,
        old_value: input.old_value || null,
        new_value: input.new_value || null,
        created_by_id: userInfo.userId,
        created_by_name: userInfo.fullName,
      });
      if (error) throw new Error(`Failed to log event: ${error.message}`);
    },
  });
}
