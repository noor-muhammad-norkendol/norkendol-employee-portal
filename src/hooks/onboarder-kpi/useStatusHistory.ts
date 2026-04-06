"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOKSupabase } from './useSupabase';
import { OnboardingStatusHistory } from '@/types/onboarder-kpi';

export function useStatusHistory(clientId?: string) {
  const { supabase, userInfo } = useOKSupabase();

  return useQuery({
    queryKey: ['onboarding-status-history', clientId],
    queryFn: async (): Promise<OnboardingStatusHistory[]> => {
      if (!userInfo || !clientId) return [];
      const { data, error } = await supabase
        .from('onboarding_status_history')
        .select('*')
        .eq('client_id', clientId)
        .order('changed_at', { ascending: false });
      if (error) throw new Error(`Failed to fetch status history: ${error.message}`);
      return (data || []) as OnboardingStatusHistory[];
    },
    enabled: !!userInfo && !!clientId,
  });
}

export function useLogStatusChange() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useOKSupabase();

  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      from_status: string;
      to_status: string;
      notes?: string;
    }) => {
      if (!userInfo) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('onboarding_status_history')
        .insert({
          ...input,
          org_id: userInfo.orgId,
          changed_by: userInfo.fullName,
        })
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to log status change: ${error.message}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-status-history'] });
    },
  });
}
