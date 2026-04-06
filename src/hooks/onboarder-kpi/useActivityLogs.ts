"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOKSupabase } from './useSupabase';
import { OnboardingActivityLog, ActivityType, ContactTarget, CallResult } from '@/types/onboarder-kpi';

export function useActivityLogs(clientId?: string) {
  const { supabase, userInfo } = useOKSupabase();

  return useQuery({
    queryKey: ['onboarding-activity-logs', clientId],
    queryFn: async (): Promise<OnboardingActivityLog[]> => {
      if (!userInfo || !clientId) return [];
      const { data, error } = await supabase
        .from('onboarding_activity_logs')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Failed to fetch activity logs: ${error.message}`);
      return (data || []) as OnboardingActivityLog[];
    },
    enabled: !!userInfo && !!clientId,
  });
}

export function useLogActivity() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useOKSupabase();

  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      activity_type: ActivityType;
      subject?: string;
      body?: string;
      contact_target?: ContactTarget;
      call_result?: CallResult;
    }) => {
      if (!userInfo) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('onboarding_activity_logs')
        .insert({
          ...input,
          org_id: userInfo.orgId,
          user_name: userInfo.fullName,
        })
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to log activity: ${error.message}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-activity-logs'] });
    },
  });
}
