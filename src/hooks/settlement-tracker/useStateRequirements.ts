"use client";
import { useQuery } from '@tanstack/react-query';
import { useSTSupabase } from './useSupabase';

export interface StateRequirement {
  id: string;
  state: string;
  requirement_type: string;
  requirement_name: string;
  statutory_reference?: string;
  days_to_complete?: number;
  is_mandatory: boolean;
  prerequisite_of?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export function useStateRequirements(state?: string) {
  const { supabase } = useSTSupabase();

  return useQuery({
    queryKey: ['state-requirements', state],
    queryFn: async () => {
      let query = supabase
        .from('state_requirements')
        .select('*')
        .order('requirement_type', { ascending: true })
        .order('requirement_name', { ascending: true });

      if (state) {
        query = query.eq('state', state);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as StateRequirement[];
    },
    enabled: !!state,
  });
}

export function useAllStateRequirements() {
  const { supabase } = useSTSupabase();

  return useQuery({
    queryKey: ['state-requirements-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('state_requirements')
        .select('*')
        .order('state', { ascending: true })
        .order('requirement_type', { ascending: true })
        .order('requirement_name', { ascending: true });

      if (error) throw error;
      return data as StateRequirement[];
    },
  });
}
