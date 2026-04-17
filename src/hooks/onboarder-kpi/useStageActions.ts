"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOKSupabase } from './useSupabase';
import type { ActivityType, ContactTarget, CallResult } from '@/types/onboarder-kpi';

export interface StageAction {
  id: string;
  org_id: string;
  client_id: string;
  stage: string;
  action_type: string;
  contact_target: string;
  activity_log_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
}

export function useStageActions(clientId?: string, stage?: string) {
  const { supabase, userInfo } = useOKSupabase();

  return useQuery({
    queryKey: ['onboarding-stage-actions', clientId, stage],
    queryFn: async (): Promise<StageAction[]> => {
      if (!userInfo || !clientId || !stage) return [];
      const { data, error } = await supabase
        .from('onboarding_stage_actions')
        .select('*')
        .eq('client_id', clientId)
        .eq('stage', stage)
        .order('created_at', { ascending: true });
      if (error) throw new Error(`Failed to fetch stage actions: ${error.message}`);
      return (data || []) as StageAction[];
    },
    enabled: !!userInfo && !!clientId && !!stage,
  });
}

export function useCompleteStageAction() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useOKSupabase();

  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      stage: string;
      action_type: ActivityType;
      contact_target: ContactTarget;
      subject?: string;
      body?: string;
      call_result?: CallResult;
    }) => {
      if (!userInfo) throw new Error('Not authenticated');

      // 1. Log the activity
      const { data: activityLog, error: actError } = await supabase
        .from('onboarding_activity_logs')
        .insert({
          client_id: input.client_id,
          org_id: userInfo.orgId,
          user_name: userInfo.fullName,
          activity_type: input.action_type,
          contact_target: input.contact_target,
          subject: input.subject || `${input.action_type} to ${input.contact_target}`,
          body: input.body,
          call_result: input.call_result,
        })
        .select()
        .maybeSingle();
      if (actError) throw new Error(`Failed to log activity: ${actError.message}`);

      // 2. Record stage action completion
      const { data: stageAction, error: saError } = await supabase
        .from('onboarding_stage_actions')
        .insert({
          client_id: input.client_id,
          org_id: userInfo.orgId,
          stage: input.stage,
          action_type: input.action_type,
          contact_target: input.contact_target,
          activity_log_id: activityLog?.id || null,
          completed_at: new Date().toISOString(),
          completed_by: userInfo.fullName,
        })
        .select()
        .maybeSingle();
      if (saError) throw new Error(`Failed to record stage action: ${saError.message}`);

      return stageAction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-stage-actions'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-activity-logs'] });
    },
  });
}
