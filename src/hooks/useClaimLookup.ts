"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// Normalized result from any source table
export interface ClaimLookupMatch {
  source_table: 'onboarding_clients' | 'estimates' | 'litigation_files' | 'claim_health_records';
  source_id: string;
  claim_number?: string | null;
  file_number?: string | null;
  client_name?: string | null;
  loss_address?: string | null;
  carrier?: string | null;
  state?: string | null;
  peril?: string | null;
  loss_date?: string | null;
  referral_source?: string | null;
  referral_representative?: string | null;
  policy_number?: string | null;
  email?: string | null;
  phone?: string | null;
  property_type?: string | null;
  carrier_adjuster?: string | null;
  contractor_company?: string | null;
  contractor_rep?: string | null;
  contractor_rep_email?: string | null;
  contractor_rep_phone?: string | null;
}

export type LookupField = 'claim_number' | 'file_number' | 'client_name' | 'address';

interface UseClaimLookupOptions {
  supabase: SupabaseClient;
  orgId: string | undefined;
  searchTerm: string;
  searchField: LookupField;
  enabled?: boolean;
}

// Normalize rows from different tables into a common shape
function normalizeOnboarding(row: Record<string, unknown>): ClaimLookupMatch {
  return {
    source_table: 'onboarding_clients',
    source_id: row.id as string,
    claim_number: row.claim_number as string | null,
    file_number: row.file_number as string | null,
    client_name: row.client_name as string | null,
    loss_address: row.loss_address as string | null,
    state: row.state as string | null,
    peril: row.peril as string | null,
    loss_date: row.date_of_loss as string | null,
    referral_source: row.referral_source as string | null,
    email: row.email as string | null,
    phone: row.phone as string | null,
  };
}

function normalizeEstimate(row: Record<string, unknown>): ClaimLookupMatch {
  return {
    source_table: 'estimates',
    source_id: row.id as string,
    claim_number: row.claim_number as string | null,
    file_number: row.file_number as string | null,
    client_name: row.client_name as string | null,
    carrier: row.carrier as string | null,
    state: row.loss_state as string | null,
    peril: row.peril as string | null,
    loss_date: row.loss_date as string | null,
    referral_source: row.referral_source as string | null,
    referral_representative: row.referral_representative as string | null,
    policy_number: row.policy_number as string | null,
    property_type: row.property_type as string | null,
    carrier_adjuster: row.carrier_adjuster as string | null,
    contractor_company: row.contractor_company as string | null,
    contractor_rep: row.contractor_rep as string | null,
    contractor_rep_email: row.contractor_rep_email as string | null,
    contractor_rep_phone: row.contractor_rep_phone as string | null,
  };
}

function normalizeLitigation(row: Record<string, unknown>): ClaimLookupMatch {
  return {
    source_table: 'litigation_files',
    source_id: row.id as string,
    file_number: row.file_number as string | null,
    client_name: row.client_name as string | null,
    loss_address: row.loss_address as string | null,
    state: row.state as string | null,
    peril: row.peril as string | null,
    referral_source: row.referral_source as string | null,
    referral_representative: row.referral_rep as string | null,
    policy_number: row.policy_number as string | null,
  };
}

function normalizeClaimHealth(row: Record<string, unknown>): ClaimLookupMatch {
  return {
    source_table: 'claim_health_records',
    source_id: row.id as string,
    claim_number: row.claim_id as string | null,
    client_name: row.client_name as string | null,
    referral_source: row.referral_source as string | null,
    referral_representative: row.referral_representative as string | null,
  };
}

export function useClaimLookup({ supabase, orgId, searchTerm, searchField, enabled = true }: UseClaimLookupOptions) {
  const [matches, setMatches] = useState<ClaimLookupMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    setMatches([]);
    setSearching(false);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!enabled || !orgId || !searchTerm || searchTerm.length < 3) {
      setMatches([]);
      return;
    }

    setSearching(true);
    timerRef.current = setTimeout(async () => {
      const results: ClaimLookupMatch[] = [];

      // Build field-specific queries for each table
      const isExact = searchField === 'claim_number' || searchField === 'file_number';

      // 1. onboarding_clients
      try {
        let q = supabase.from('onboarding_clients').select('*').eq('org_id', orgId);
        if (searchField === 'claim_number') q = q.eq('claim_number', searchTerm);
        else if (searchField === 'file_number') q = q.eq('file_number', searchTerm);
        else if (searchField === 'client_name') q = q.ilike('client_name', `%${searchTerm}%`);
        else if (searchField === 'address') q = q.ilike('loss_address', `%${searchTerm}%`);
        const { data } = await q.limit(5);
        if (data) results.push(...data.map(normalizeOnboarding));
      } catch { /* skip */ }

      // 2. estimates
      try {
        let q = supabase.from('estimates').select('*').eq('org_id', orgId);
        if (searchField === 'claim_number') q = q.eq('claim_number', searchTerm);
        else if (searchField === 'file_number') q = q.eq('file_number', searchTerm);
        else if (searchField === 'client_name') q = q.ilike('client_name', `%${searchTerm}%`);
        else if (searchField === 'address') { setSearching(false); return; } // estimates has no address
        // Only get the most recent per file_number
        q = q.order('created_at', { ascending: false });
        const { data } = await q.limit(5);
        if (data) results.push(...data.map(normalizeEstimate));
      } catch { /* skip */ }

      // 3. litigation_files
      try {
        let q = supabase.from('litigation_files').select('*').eq('org_id', orgId);
        if (searchField === 'claim_number') { /* litigation_files has no claim_number — skip */ }
        else if (searchField === 'file_number') q = q.eq('file_number', searchTerm);
        else if (searchField === 'client_name') q = q.ilike('client_name', `%${searchTerm}%`);
        else if (searchField === 'address') q = q.ilike('loss_address', `%${searchTerm}%`);

        if (searchField !== 'claim_number') {
          const { data } = await q.limit(5);
          if (data) results.push(...data.map(normalizeLitigation));
        }
      } catch { /* skip */ }

      // 4. claim_health_records
      try {
        let q = supabase.from('claim_health_records').select('*').eq('org_id', orgId);
        if (searchField === 'claim_number') q = q.eq('claim_id', searchTerm);
        else if (searchField === 'client_name') q = q.ilike('client_name', `%${searchTerm}%`);
        else if (searchField === 'file_number' || searchField === 'address') { /* no such fields — skip */ }

        if (searchField === 'claim_number' || searchField === 'client_name') {
          const { data } = await q.limit(5);
          if (data) results.push(...data.map(normalizeClaimHealth));
        }
      } catch { /* skip */ }

      // Deduplicate by client_name + claim_number + file_number combo
      const seen = new Set<string>();
      const deduped = results.filter((r) => {
        const key = `${r.client_name || ''}|${r.claim_number || ''}|${r.file_number || ''}|${r.loss_address || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setMatches(deduped);
      setSearching(false);
    }, 500);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [supabase, orgId, searchTerm, searchField, enabled]);

  return { matches, searching, clear };
}
