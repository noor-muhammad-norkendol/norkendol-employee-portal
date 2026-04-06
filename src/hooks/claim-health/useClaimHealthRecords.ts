"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCHSupabase } from './useSupabase';
import { ClaimHealthRecord, CreateClaimHealthInput, UpdateClaimHealthInput } from '@/types/claim-health';

export function useClaimHealthRecords() {
  const { supabase, userInfo } = useCHSupabase();

  return useQuery({
    queryKey: ['claim-health-records', userInfo?.orgId, userInfo?.userId, userInfo?.role],
    queryFn: async (): Promise<ClaimHealthRecord[]> => {
      if (!userInfo) return [];
      let query = supabase
        .from('claim_health_records')
        .select('*')
        .eq('org_id', userInfo.orgId)
        .order('created_at', { ascending: false });

      // Non-admin users only see their own records
      const adminRoles = ['admin', 'super_admin', 'system_admin'];
      if (!adminRoles.includes(userInfo.role)) {
        query = query.eq('adjuster_id', userInfo.userId);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to fetch claim health records: ${error.message}`);
      return (data || []) as ClaimHealthRecord[];
    },
    enabled: !!userInfo,
  });
}

export function useCreateClaimHealth() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useCHSupabase();

  return useMutation({
    mutationFn: async (input: CreateClaimHealthInput) => {
      if (!userInfo) throw new Error('Not authenticated');
      const cleaned = Object.fromEntries(
        Object.entries(input).map(([k, v]) => [k, v === '' ? null : v])
      );
      const { data, error } = await supabase
        .from('claim_health_records')
        .insert({
          ...cleaned,
          org_id: userInfo.orgId,
          adjuster_id: userInfo.userId,
          adjuster_name: userInfo.fullName,
        })
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to create claim health record: ${error.message}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim-health-records'] });
    },
  });
}

export function useUpdateClaimHealth() {
  const queryClient = useQueryClient();
  const { supabase } = useCHSupabase();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateClaimHealthInput) => {
      const { data, error } = await supabase
        .from('claim_health_records')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to update claim health record: ${error.message}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim-health-records'] });
    },
  });
}

export function useDeleteClaimHealth() {
  const queryClient = useQueryClient();
  const { supabase } = useCHSupabase();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('claim_health_records')
        .delete()
        .eq('id', id);
      if (error) throw new Error(`Failed to delete claim health record: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claim-health-records'] });
    },
  });
}
