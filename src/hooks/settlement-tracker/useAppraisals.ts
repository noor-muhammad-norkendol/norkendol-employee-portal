"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSTSupabase } from './useSupabase';
import { Appraisal, CreateAppraisalInput, UpdateAppraisalInput, AppraisalWithFile } from '@/types/settlement-tracker/appraisal';

const APPRAISAL_SELECT = `
  *,
  litigation_file:litigation_files(
    file_number,
    client_name,
    referral_source,
    referral_rep,
    state
  )
`;

export function useAppraisals() {
  const { supabase, userInfo } = useSTSupabase();

  return useQuery({
    queryKey: ['appraisals', 'active', userInfo?.orgId],
    queryFn: async (): Promise<AppraisalWithFile[]> => {
      if (!userInfo) return [];
      const { data, error } = await supabase
        .from('appraisals')
        .select(APPRAISAL_SELECT)
        .eq('org_id', userInfo.orgId)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch appraisals: ${error.message}`);
      }

      return (data || []) as AppraisalWithFile[];
    },
    enabled: !!userInfo,
  });
}

export function useArchivedAppraisals() {
  const { supabase, userInfo } = useSTSupabase();

  return useQuery({
    queryKey: ['appraisals', 'archived', userInfo?.orgId],
    queryFn: async (): Promise<AppraisalWithFile[]> => {
      if (!userInfo) return [];
      const { data, error } = await supabase
        .from('appraisals')
        .select(APPRAISAL_SELECT)
        .eq('org_id', userInfo.orgId)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch archived appraisals: ${error.message}`);
      }

      return (data || []) as AppraisalWithFile[];
    },
    enabled: !!userInfo,
  });
}

export function useAppraisal(id: string) {
  const { supabase, userInfo } = useSTSupabase();

  return useQuery({
    queryKey: ['appraisals', id],
    queryFn: async (): Promise<Appraisal | null> => {
      if (!userInfo) return null;
      const { data, error } = await supabase
        .from('appraisals')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch appraisal: ${error.message}`);
      }

      return data as Appraisal | null;
    },
    enabled: !!id && !!userInfo,
  });
}

export function useAllAppraisalsForLiquidity() {
  const { supabase, userInfo } = useSTSupabase();

  return useQuery({
    queryKey: ['appraisals', 'all', userInfo?.orgId],
    queryFn: async (): Promise<AppraisalWithFile[]> => {
      if (!userInfo) return [];
      const { data, error } = await supabase
        .from('appraisals')
        .select(APPRAISAL_SELECT)
        .eq('org_id', userInfo.orgId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch all appraisals: ${error.message}`);
      }

      return (data || []) as AppraisalWithFile[];
    },
    enabled: !!userInfo,
  });
}

export function useAppraisalByFileId(litigationFileId: string) {
  const { supabase, userInfo } = useSTSupabase();

  return useQuery({
    queryKey: ['appraisals', 'by-file', litigationFileId],
    queryFn: async (): Promise<Appraisal | null> => {
      if (!userInfo) return null;
      const { data, error } = await supabase
        .from('appraisals')
        .select('*')
        .eq('litigation_file_id', litigationFileId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch appraisal: ${error.message}`);
      }

      return data as Appraisal | null;
    },
    enabled: !!litigationFileId && !!userInfo,
  });
}

export function useCreateAppraisal() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async (input: CreateAppraisalInput) => {
      if (!userInfo) throw new Error('Not authenticated');
      const cleaned = Object.fromEntries(
        Object.entries(input).map(([k, v]) => [k, v === '' ? null : v])
      );
      const { data, error } = await supabase
        .from('appraisals')
        .insert({ ...cleaned, org_id: userInfo.orgId })
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to create appraisal: ${error.message}`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisals'] });
    }
  });
}

export function useUpdateAppraisal() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateAppraisalInput) => {
      if (!userInfo) throw new Error('Not authenticated');
      const cleaned = Object.fromEntries(
        Object.entries(updates).map(([k, v]) => [k, v === '' ? null : v])
      );
      const { data, error } = await supabase
        .from('appraisals')
        .update(cleaned)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to update appraisal: ${error.message}`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisals'] });
    }
  });
}

export function useArchiveAppraisal() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async ({ id, archivedBy }: { id: string; archivedBy: string }) => {
      if (!userInfo) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('appraisals')
        .update({ archived_at: new Date().toISOString(), archived_by: archivedBy })
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to archive appraisal: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisals'] });
    }
  });
}

export function useUnarchiveAppraisal() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!userInfo) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('appraisals')
        .update({ archived_at: null, archived_by: null })
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to unarchive appraisal: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisals'] });
    }
  });
}

export function useDeleteAppraisal() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!userInfo) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('appraisals')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete appraisal: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appraisals'] });
    }
  });
}
