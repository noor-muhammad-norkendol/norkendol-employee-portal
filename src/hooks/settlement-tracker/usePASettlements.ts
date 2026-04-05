"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSTSupabase } from './useSupabase';
import { PASettlement, PASettlementWithFile, CreatePASettlementInput, UpdatePASettlementInput } from '@/types/settlement-tracker/pa-settlement';

const PA_SETTLEMENT_SELECT = `
  *,
  litigation_file:litigation_files(
    file_number,
    client_name,
    referral_source,
    state
  )
`;

export function usePASettlements() {
  const { supabase, userInfo } = useSTSupabase();

  return useQuery({
    queryKey: ['pa_settlements', 'active', userInfo?.orgId],
    queryFn: async (): Promise<PASettlementWithFile[]> => {
      if (!userInfo) return [];
      const { data, error } = await supabase
        .from('pa_settlements')
        .select(PA_SETTLEMENT_SELECT)
        .eq('org_id', userInfo.orgId)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch PA settlements: ${error.message}`);
      }

      return (data || []) as PASettlementWithFile[];
    },
    enabled: !!userInfo,
  });
}

export function useArchivedPASettlements() {
  const { supabase, userInfo } = useSTSupabase();

  return useQuery({
    queryKey: ['pa_settlements', 'archived', userInfo?.orgId],
    queryFn: async (): Promise<PASettlementWithFile[]> => {
      if (!userInfo) return [];
      const { data, error } = await supabase
        .from('pa_settlements')
        .select(PA_SETTLEMENT_SELECT)
        .eq('org_id', userInfo.orgId)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch archived PA settlements: ${error.message}`);
      }

      return (data || []) as PASettlementWithFile[];
    },
    enabled: !!userInfo,
  });
}

export function useAllPASettlementsForLiquidity() {
  const { supabase, userInfo } = useSTSupabase();

  return useQuery({
    queryKey: ['pa_settlements', 'all', userInfo?.orgId],
    queryFn: async (): Promise<PASettlementWithFile[]> => {
      if (!userInfo) return [];
      const { data, error } = await supabase
        .from('pa_settlements')
        .select(PA_SETTLEMENT_SELECT)
        .eq('org_id', userInfo.orgId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch all PA settlements: ${error.message}`);
      }

      return (data || []) as PASettlementWithFile[];
    },
    enabled: !!userInfo,
  });
}

export function usePASettlement(id: string) {
  const { supabase, userInfo } = useSTSupabase();

  return useQuery({
    queryKey: ['pa_settlements', id],
    queryFn: async (): Promise<PASettlement | null> => {
      if (!userInfo) return null;
      const { data, error } = await supabase
        .from('pa_settlements')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch PA settlement: ${error.message}`);
      }

      return data as PASettlement | null;
    },
    enabled: !!id && !!userInfo,
  });
}

export function useCreatePASettlement() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async (input: CreatePASettlementInput) => {
      if (!userInfo) throw new Error('Not authenticated');
      const cleaned = Object.fromEntries(
        Object.entries(input).map(([k, v]) => [k, v === '' ? null : v])
      );
      const { data, error } = await supabase
        .from('pa_settlements')
        .insert({ ...cleaned, org_id: userInfo.orgId })
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to create PA settlement: ${error.message}`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pa_settlements'] });
    }
  });
}

export function useUpdatePASettlement() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdatePASettlementInput) => {
      if (!userInfo) throw new Error('Not authenticated');
      const cleaned = Object.fromEntries(
        Object.entries(updates).map(([k, v]) => [k, v === '' ? null : v])
      );
      const { data, error } = await supabase
        .from('pa_settlements')
        .update(cleaned)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to update PA settlement: ${error.message}`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pa_settlements'] });
    }
  });
}

export function useArchivePASettlement() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async ({ id, archivedBy }: { id: string; archivedBy: string }) => {
      if (!userInfo) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('pa_settlements')
        .update({ archived_at: new Date().toISOString(), archived_by: archivedBy })
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to archive PA settlement: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pa_settlements'] });
    }
  });
}

export function useUnarchivePASettlement() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!userInfo) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('pa_settlements')
        .update({ archived_at: null, archived_by: null })
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to unarchive PA settlement: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pa_settlements'] });
    }
  });
}

export function useDeletePASettlement() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!userInfo) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('pa_settlements')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete PA settlement: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pa_settlements'] });
    }
  });
}
