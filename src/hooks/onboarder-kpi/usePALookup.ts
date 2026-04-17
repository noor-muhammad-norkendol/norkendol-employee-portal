"use client";
import { useQuery } from '@tanstack/react-query';
import { useOKSupabase } from './useSupabase';

export interface PAContact {
  name: string;
  email: string | null;
  phone: string | null;
}

export function usePALookup(paName?: string | null) {
  const { supabase, userInfo } = useOKSupabase();

  return useQuery({
    queryKey: ['pa-lookup', paName],
    queryFn: async (): Promise<PAContact | null> => {
      if (!userInfo || !paName) return null;
      // Try exact match first, then fuzzy (first+last word) for middle name mismatches
      const { data } = await supabase
        .from('users')
        .select('full_name, email, primary_phone, work_email')
        .eq('org_id', userInfo.orgId)
        .ilike('full_name', paName)
        .limit(1);
      if (data && data.length > 0) {
        return {
          name: data[0].full_name,
          email: data[0].work_email || data[0].email || null,
          phone: data[0].primary_phone || null,
        };
      }
      // Fuzzy: try first + last name (skip middle)
      const parts = paName.trim().split(/\s+/);
      if (parts.length >= 2) {
        const first = parts[0];
        const last = parts[parts.length - 1];
        const { data: fuzzy } = await supabase
          .from('users')
          .select('full_name, email, primary_phone, work_email')
          .eq('org_id', userInfo.orgId)
          .ilike('full_name', `${first}%${last}`)
          .limit(1);
        if (fuzzy && fuzzy.length > 0) {
          return {
            name: fuzzy[0].full_name,
            email: fuzzy[0].work_email || fuzzy[0].email || null,
            phone: fuzzy[0].primary_phone || null,
          };
        }
      }
      return null;
    },
    enabled: !!userInfo && !!paName,
    staleTime: 5 * 60 * 1000, // cache for 5 min
  });
}
