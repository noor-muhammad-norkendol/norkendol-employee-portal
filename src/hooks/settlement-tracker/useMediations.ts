"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSTSupabase } from './useSupabase';
import { Mediation, CreateMediationInput, UpdateMediationInput, MediationWithFile } from '@/types/settlement-tracker/mediation';

const MEDIATION_SELECT = `
  *,
  litigation_file:litigation_files(
    file_number,
    client_name,
    referral_source,
    referral_rep,
    state
  )
`;

export function useMediations() {
  const { supabase, userInfo } = useSTSupabase();

  return useQuery({
    queryKey: ['mediations', 'active', userInfo?.orgId],
    queryFn: async (): Promise<MediationWithFile[]> => {
      if (!userInfo) return [];
      const { data, error } = await supabase
        .from('mediations')
        .select(MEDIATION_SELECT)
        .eq('org_id', userInfo.orgId)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch mediations: ${error.message}`);
      }

      return (data || []) as MediationWithFile[];
    },
    enabled: !!userInfo,
  });
}

export function useArchivedMediations() {
  const { supabase, userInfo } = useSTSupabase();

  return useQuery({
    queryKey: ['mediations', 'archived', userInfo?.orgId],
    queryFn: async (): Promise<MediationWithFile[]> => {
      if (!userInfo) return [];
      const { data, error } = await supabase
        .from('mediations')
        .select(MEDIATION_SELECT)
        .eq('org_id', userInfo.orgId)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch archived mediations: ${error.message}`);
      }

      return (data || []) as MediationWithFile[];
    },
    enabled: !!userInfo,
  });
}

export function useMediation(id: string) {
  const { supabase, userInfo } = useSTSupabase();

  return useQuery({
    queryKey: ['mediations', id],
    queryFn: async (): Promise<Mediation | null> => {
      if (!userInfo) return null;
      const { data, error } = await supabase
        .from('mediations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch mediation: ${error.message}`);
      }

      return data as Mediation | null;
    },
    enabled: !!id && !!userInfo,
  });
}

export function useAllMediationsForLiquidity() {
  const { supabase, userInfo } = useSTSupabase();

  return useQuery({
    queryKey: ['mediations', 'all', userInfo?.orgId],
    queryFn: async (): Promise<MediationWithFile[]> => {
      if (!userInfo) return [];
      const { data, error } = await supabase
        .from('mediations')
        .select(MEDIATION_SELECT)
        .eq('org_id', userInfo.orgId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch all mediations: ${error.message}`);
      }

      return (data || []) as MediationWithFile[];
    },
    enabled: !!userInfo,
  });
}

export function useMediationByFileId(litigationFileId: string) {
  const { supabase, userInfo } = useSTSupabase();

  return useQuery({
    queryKey: ['mediations', 'by-file', litigationFileId],
    queryFn: async (): Promise<Mediation | null> => {
      if (!userInfo) return null;
      const { data, error } = await supabase
        .from('mediations')
        .select('*')
        .eq('litigation_file_id', litigationFileId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch mediation: ${error.message}`);
      }

      return data as Mediation | null;
    },
    enabled: !!litigationFileId && !!userInfo,
  });
}

export function useCreateMediation() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async (input: CreateMediationInput) => {
      if (!userInfo) throw new Error('Not authenticated');
      // Convert empty strings to null for date columns
      const cleaned = Object.fromEntries(
        Object.entries(input).map(([k, v]) => [k, v === '' ? null : v])
      );
      const { data, error } = await supabase
        .from('mediations')
        .insert({ ...cleaned, org_id: userInfo.orgId })
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to create mediation: ${error.message}`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediations'] });
    }
  });
}

export function useUpdateMediation() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateMediationInput) => {
      if (!userInfo) throw new Error('Not authenticated');
      // Convert empty strings to null for date columns
      const cleaned = Object.fromEntries(
        Object.entries(updates).map(([k, v]) => [k, v === '' ? null : v])
      );
      const { data, error } = await supabase
        .from('mediations')
        .update(cleaned)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to update mediation: ${error.message}`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediations'] });
    }
  });
}

export function useArchiveMediation() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async ({ id, archivedBy }: { id: string; archivedBy: string }) => {
      if (!userInfo) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('mediations')
        .update({ archived_at: new Date().toISOString(), archived_by: archivedBy })
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to archive mediation: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediations'] });
    }
  });
}

export function useUnarchiveMediation() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!userInfo) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('mediations')
        .update({ archived_at: null, archived_by: null })
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to unarchive mediation: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediations'] });
    }
  });
}

export function useDeleteMediation() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!userInfo) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('mediations')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete mediation: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediations'] });
    }
  });
}
