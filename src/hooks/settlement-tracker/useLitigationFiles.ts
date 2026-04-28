"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSTSupabase } from './useSupabase';
import { LitigationFile, CreateLitigationFileInput, UpdateLitigationFileInput } from '@/types/settlement-tracker/litigation';

export function useLitigationFiles() {
  const { supabase, userInfo } = useSTSupabase();

  return useQuery({
    queryKey: ['litigation-files', userInfo?.orgId, userInfo?.userId, userInfo?.role],
    queryFn: async (): Promise<LitigationFile[]> => {
      if (!userInfo) return [];
      let query = supabase
        .from('litigation_files')
        .select('*')
        .eq('org_id', userInfo.orgId)
        .order('date_attorney_onboarded', { ascending: false });

      // External users (ep_user) only see files assigned to them
      if (userInfo.role === 'ep_user' || userInfo.role === 'ep_admin') {
        query = query.eq('attorney_contact_id', userInfo.userId);
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to fetch litigation files: ${error.message}`);
      return (data || []) as LitigationFile[];
    },
    enabled: !!userInfo,
  });
}

export function useCreateLitigationFile() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async (input: CreateLitigationFileInput) => {
      if (!userInfo) throw new Error('Not authenticated');
      const cleaned = Object.fromEntries(
        Object.entries(input).map(([k, v]) => [k, v === '' ? null : v])
      );
      const { data, error } = await supabase
        .from('litigation_files')
        .insert({ ...cleaned, org_id: userInfo.orgId, created_by_name: userInfo.fullName, created_by_email: userInfo.email })
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to create litigation file: ${error.message}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['litigation-files'] });
    },
  });
}

export function useUpdateLitigationFile() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateLitigationFileInput) => {
      const { data, error } = await supabase
        .from('litigation_files')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to update litigation file: ${error.message}`);
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['litigation-files'] });

      // Auto-create claim health record when status changes to "Settled"
      if (data && data.status === 'Settled' && userInfo) {
        try {
          // Check if a claim health record already exists for this file
          const { data: existing } = await supabase
            .from('claim_health_records')
            .select('id')
            .eq('settlement_tracker_file_id', data.id)
            .maybeSingle();

          if (!existing) {
            await supabase.from('claim_health_records').insert({
              org_id: userInfo.orgId,
              adjuster_id: userInfo.userId,
              adjuster_name: userInfo.fullName,
              file_number: data.file_number || '',
              client_name: data.client_name || '',
              referral_source: data.referral_source || '',
              referral_representative: data.referral_rep || '',
              start_date: data.date_attorney_onboarded || new Date().toISOString().slice(0, 10),
              settlement_date: new Date().toISOString().slice(0, 10),
              starting_value: data.current_reserves || 0,
              final_settlement_value: data.current_offer || null,
              status_at_intake: 'Partial Paid',
              is_settled: true,
              total_communications: 0,
              source: 'auto',
              settlement_tracker_file_id: data.id,
              is_complete: false,
            });
            queryClient.invalidateQueries({ queryKey: ['claim-health-records'] });
          }
        } catch (e) {
          console.error('Failed to auto-create claim health record:', e);
        }
      }
    },
  });
}

export function useDeleteLitigationFiles() {
  const queryClient = useQueryClient();
  const { supabase } = useSTSupabase();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('litigation_files')
        .delete()
        .in('id', ids);
      if (error) throw new Error(`Failed to delete litigation files: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['litigation-files'] });
    },
  });
}
