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
  const { supabase } = useSTSupabase();

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['litigation-files'] });
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
