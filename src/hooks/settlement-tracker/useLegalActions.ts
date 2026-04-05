"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSTSupabase } from './useSupabase';
import { LegalAction, CreateLegalActionInput, UpdateLegalActionInput, LitigationFileRollups } from '@/types/settlement-tracker/legalAction';

const LEGAL_ACTION_QUERY_KEYS = [
  ['legal-actions'],
  ['litigation-file-rollups'],
  ['bulk-litigation-file-rollups'],
] as const;

function invalidateAllLegalActionQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  for (const queryKey of LEGAL_ACTION_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey });
  }
}

function parseRollups(fileId: string, data: unknown): LitigationFileRollups {
  if (!data) {
    return { litigationFileId: fileId, stepCount: 0, nextDueDate: undefined, lastCompletedDate: undefined };
  }
  const d = data as Record<string, unknown>;
  return {
    litigationFileId: fileId,
    stepCount: (d.step_count as number) || 0,
    nextDueDate: (d.next_due_date as string) || undefined,
    lastCompletedDate: (d.last_completed_date as string) || undefined,
  };
}

export function useLegalActions(litigationFileId?: string) {
  const { supabase } = useSTSupabase();
  return useQuery({
    queryKey: ['legal-actions', litigationFileId],
    queryFn: async (): Promise<LegalAction[]> => {
      let query = supabase
        .from('legal_actions')
        .select('*')
        .order('order_index', { ascending: true })
        .order('due_date', { ascending: true });
      if (litigationFileId) {
        query = query.eq('litigation_file_id', litigationFileId);
      }
      const { data, error } = await query;
      if (error) throw new Error(`Failed to fetch legal actions: ${error.message}`);
      return (data || []) as LegalAction[];
    },
    enabled: !!litigationFileId,
  });
}

export function useLitigationFileRollups(litigationFileId: string) {
  const { supabase } = useSTSupabase();
  return useQuery({
    queryKey: ['litigation-file-rollups', litigationFileId],
    queryFn: async (): Promise<LitigationFileRollups> => {
      const { data, error } = await supabase.rpc('get_litigation_file_rollups', { file_id: litigationFileId });
      if (error) throw new Error(`Failed to fetch rollups: ${error.message}`);
      return parseRollups(litigationFileId, data);
    },
    enabled: !!litigationFileId,
  });
}

export function useBulkLitigationFileRollups(fileIds: string[]) {
  const { supabase } = useSTSupabase();
  return useQuery({
    queryKey: ['bulk-litigation-file-rollups', fileIds.sort().join(',')],
    queryFn: async (): Promise<Record<string, LitigationFileRollups>> => {
      if (fileIds.length === 0) return {};
      const results = await Promise.all(
        fileIds.map(async (fileId) => {
          const { data, error } = await supabase.rpc('get_litigation_file_rollups', { file_id: fileId });
          if (error) console.warn(`Failed to fetch rollups for file ${fileId}:`, error);
          return { fileId, rollups: parseRollups(fileId, error ? null : data) };
        })
      );
      return Object.fromEntries(results.map(({ fileId, rollups }) => [fileId, rollups]));
    },
    enabled: fileIds.length > 0,
    staleTime: 30000,
  });
}

export function useCreateLegalAction() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useSTSupabase();
  return useMutation({
    mutationFn: async (input: CreateLegalActionInput) => {
      const cleaned = Object.fromEntries(
        Object.entries(input).map(([k, v]) => [k, v === '' ? null : v])
      );
      const { data, error } = await supabase
        .from('legal_actions')
        .insert({ ...cleaned, created_by_name: userInfo?.fullName, created_by_email: userInfo?.email })
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to create legal action: ${error.message}`);
      return data;
    },
    onSuccess: () => invalidateAllLegalActionQueries(queryClient),
  });
}

export function useUpdateLegalAction() {
  const queryClient = useQueryClient();
  const { supabase } = useSTSupabase();
  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateLegalActionInput) => {
      const { data, error } = await supabase
        .from('legal_actions')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to update legal action: ${error.message}`);
      return data;
    },
    onSuccess: () => invalidateAllLegalActionQueries(queryClient),
  });
}

export function useDeleteLegalActions() {
  const queryClient = useQueryClient();
  const { supabase } = useSTSupabase();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('legal_actions').delete().in('id', ids);
      if (error) throw new Error(`Failed to delete legal actions: ${error.message}`);
    },
    onSuccess: () => invalidateAllLegalActionQueries(queryClient),
  });
}

export function useBulkUpdateLegalActions() {
  const queryClient = useQueryClient();
  const { supabase } = useSTSupabase();
  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<CreateLegalActionInput> }) => {
      const results = await Promise.all(
        ids.map(id => supabase.from('legal_actions').update(updates).eq('id', id).select().maybeSingle())
      );
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw new Error(`Failed to update ${errors.length} legal actions`);
      return results.map(r => r.data);
    },
    onSuccess: () => invalidateAllLegalActionQueries(queryClient),
  });
}

export function useReorderLegalActions() {
  const queryClient = useQueryClient();
  const { supabase } = useSTSupabase();
  return useMutation({
    mutationFn: async (updates: { id: string; order_index: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase.from('legal_actions').update({ order_index: update.order_index }).eq('id', update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateAllLegalActionQueries(queryClient),
  });
}
