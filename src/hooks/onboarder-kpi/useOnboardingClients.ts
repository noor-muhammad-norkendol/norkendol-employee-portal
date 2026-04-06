"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOKSupabase } from './useSupabase';
import { OnboardingClient, CreateClientInput, UpdateClientInput, OnboardingStatus } from '@/types/onboarder-kpi';

export function useOnboardingClients(statusFilter?: OnboardingStatus) {
  const { supabase, userInfo } = useOKSupabase();

  return useQuery({
    queryKey: ['onboarding-clients', userInfo?.orgId, userInfo?.userId, userInfo?.role, statusFilter],
    queryFn: async (): Promise<OnboardingClient[]> => {
      if (!userInfo) return [];
      let query = supabase
        .from('onboarding_clients')
        .select('*')
        .eq('org_id', userInfo.orgId)
        .order('created_at', { ascending: false });

      const adminRoles = ['admin', 'super_admin', 'system_admin'];
      if (!adminRoles.includes(userInfo.role)) {
        query = query.or(`created_by_id.eq.${userInfo.userId},assigned_user_id.eq.${userInfo.userId}`);
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to fetch onboarding clients: ${error.message}`);
      return (data || []) as OnboardingClient[];
    },
    enabled: !!userInfo,
  });
}

export function useCreateOnboardingClient() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useOKSupabase();

  return useMutation({
    mutationFn: async (input: CreateClientInput) => {
      if (!userInfo) throw new Error('Not authenticated');
      const cleaned = Object.fromEntries(
        Object.entries(input).map(([k, v]) => [k, v === '' ? null : v])
      );
      const { data, error } = await supabase
        .from('onboarding_clients')
        .insert({
          ...cleaned,
          org_id: userInfo.orgId,
          created_by_id: userInfo.userId,
          created_by_name: userInfo.fullName,
        })
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to create client: ${error.message}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-clients'] });
    },
  });
}

export function useUpdateOnboardingClient() {
  const queryClient = useQueryClient();
  const { supabase } = useOKSupabase();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateClientInput) => {
      const { data, error } = await supabase
        .from('onboarding_clients')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to update client: ${error.message}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-clients'] });
    },
  });
}

export function useDeleteOnboardingClient() {
  const queryClient = useQueryClient();
  const { supabase } = useOKSupabase();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('onboarding_clients')
        .delete()
        .eq('id', id);
      if (error) throw new Error(`Failed to delete client: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-clients'] });
    },
  });
}
