"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSTSupabase } from './useSupabase';
import { Settlement, CreateSettlementInput, UpdateSettlementInput, SettlementWithFile } from '@/types/settlement-tracker/settlement';

export function useSettlements() {
  const { supabase } = useSTSupabase();

  return useQuery({
    queryKey: ['settlements'],
    queryFn: async (): Promise<SettlementWithFile[]> => {
      const { data, error } = await supabase
        .from('settlements')
        .select(`
          *,
          litigation_file:litigation_files(
            file_number,
            client_name,
            attorney_firm,
            attorney_contact,
            referral_source,
            created_at
          )
        `)
        .is('deleted_at', null)
        .order('date_settled', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch settlements: ${error.message}`);
      }

      return (data || []) as SettlementWithFile[];
    }
  });
}

export function useSettlement(id: string) {
  const { supabase } = useSTSupabase();

  return useQuery({
    queryKey: ['settlements', id],
    queryFn: async (): Promise<Settlement | null> => {
      const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch settlement: ${error.message}`);
      }

      return data as Settlement | null;
    },
    enabled: !!id
  });
}

export function useSettlementByFileId(litigationFileId: string) {
  const { supabase } = useSTSupabase();

  return useQuery({
    queryKey: ['settlements', 'by-file', litigationFileId],
    queryFn: async (): Promise<Settlement | null> => {
      const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .eq('litigation_file_id', litigationFileId)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch settlement: ${error.message}`);
      }

      return data as Settlement | null;
    },
    enabled: !!litigationFileId
  });
}

export function useCreateSettlement() {
  const { supabase } = useSTSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSettlementInput) => {
      const { data, error } = await supabase
        .from('settlements')
        .insert(input)
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to create settlement: ${error.message}`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
    }
  });
}

export function useUpdateSettlement() {
  const { supabase } = useSTSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateSettlementInput) => {
      const { data, error } = await supabase
        .from('settlements')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to update settlement: ${error.message}`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
    }
  });
}

export function useDeleteSettlement() {
  const { supabase } = useSTSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('settlements')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete settlement: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
    }
  });
}

export function useSettlementTotals() {
  const { data: settlements = [] } = useSettlements();

  return settlements.reduce(
    (acc, settlement) => ({
      totalSettlements: acc.totalSettlements + settlement.settlement_amount,
      totalFees: acc.totalFees + (settlement.attorney_fees || 0),
      totalCosts: acc.totalCosts + settlement.costs,
      totalNetToClient: acc.totalNetToClient + settlement.net_to_client,
      count: acc.count + 1,
    }),
    {
      totalSettlements: 0,
      totalFees: 0,
      totalCosts: 0,
      totalNetToClient: 0,
      count: 0,
    }
  );
}
