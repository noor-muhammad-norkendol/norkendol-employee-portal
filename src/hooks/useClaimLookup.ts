"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// Normalized result from any source table
export interface ClaimLookupMatch {
  source_table:
    | 'onboarding_clients'
    | 'estimates'
    | 'litigation_files'
    | 'mediations'
    | 'appraisals'
    | 'pa_settlements'
    | 'claim_health_records';
  source_id: string;
  // Canonical IDENTIFIERS — present on every spoke after the 2026-04-28 sweep
  file_number?: string | null;
  claim_number?: string | null;
  policy_number?: string | null;
  client_name?: string | null;
  loss_address?: string | null;
  // Canonical CHARACTERISTICS
  peril?: string | null;
  peril_other?: string | null;
  severity?: number | null;
  // Spoke-specific extras (kept for callers that already use them)
  carrier?: string | null;
  state?: string | null;
  loss_date?: string | null;
  referral_source?: string | null;
  referral_representative?: string | null;
  email?: string | null;
  phone?: string | null;
  property_type?: string | null;
  carrier_adjuster?: string | null;
  contractor_company?: string | null;
  contractor_rep?: string | null;
  contractor_rep_email?: string | null;
  contractor_rep_phone?: string | null;
}

export type LookupField =
  | 'claim_number'
  | 'file_number'
  | 'policy_number'
  | 'client_name'
  | 'address';

interface UseClaimLookupOptions {
  supabase: SupabaseClient;
  orgId: string | undefined;
  searchTerm: string;
  searchField: LookupField;
  enabled?: boolean;
}

// Apply the canonical search filter once; the same 5 fields exist on every spoke.
function applyCanonicalFilter<Q extends { eq: (col: string, v: string) => Q; ilike: (col: string, v: string) => Q }>(
  q: Q,
  field: LookupField,
  term: string,
): Q {
  if (field === 'claim_number')   return q.eq('claim_number', term);
  if (field === 'file_number')    return q.eq('file_number', term);
  if (field === 'policy_number')  return q.eq('policy_number', term);
  if (field === 'client_name')    return q.ilike('client_name', `%${term}%`);
  return q.ilike('loss_address', `%${term}%`);
}

// Pull the canonical fields off any spoke row in one place.
function canonicalFields(row: Record<string, unknown>) {
  return {
    file_number:    row.file_number    as string | null,
    claim_number:   row.claim_number   as string | null,
    policy_number:  row.policy_number  as string | null,
    client_name:    row.client_name    as string | null,
    loss_address:   row.loss_address   as string | null,
    peril:          row.peril          as string | null,
    peril_other:    row.peril_other    as string | null,
    severity:       row.severity       as number | null,
  };
}

function normalizeOnboarding(row: Record<string, unknown>): ClaimLookupMatch {
  return {
    source_table: 'onboarding_clients',
    source_id: row.id as string,
    ...canonicalFields(row),
    state: row.state as string | null,
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
    ...canonicalFields(row),
    carrier: row.carrier as string | null,
    state: row.loss_state as string | null,
    loss_date: row.loss_date as string | null,
    referral_source: row.referral_source as string | null,
    referral_representative: row.referral_representative as string | null,
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
    ...canonicalFields(row),
    state: row.state as string | null,
    referral_source: row.referral_source as string | null,
    referral_representative: row.referral_rep as string | null,
  };
}

function normalizeMediation(row: Record<string, unknown>): ClaimLookupMatch {
  return {
    source_table: 'mediations',
    source_id: row.id as string,
    ...canonicalFields(row),
  };
}

function normalizeAppraisal(row: Record<string, unknown>): ClaimLookupMatch {
  return {
    source_table: 'appraisals',
    source_id: row.id as string,
    ...canonicalFields(row),
  };
}

function normalizePASettlement(row: Record<string, unknown>): ClaimLookupMatch {
  return {
    source_table: 'pa_settlements',
    source_id: row.id as string,
    ...canonicalFields(row),
  };
}

function normalizeClaimHealth(row: Record<string, unknown>): ClaimLookupMatch {
  return {
    source_table: 'claim_health_records',
    source_id: row.id as string,
    ...canonicalFields(row),
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

      // Every CRM spoke now carries the full canonical column set
      // (IDENTIFIERS + CHARACTERISTICS) — see HANDOFF.md "Canonical CRM Spoke
      // Standard". So one filter shape works for all 7 spokes.
      const spokes: Array<{
        table: string;
        normalize: (row: Record<string, unknown>) => ClaimLookupMatch;
      }> = [
        { table: 'onboarding_clients',   normalize: normalizeOnboarding },
        { table: 'estimates',            normalize: normalizeEstimate },
        { table: 'litigation_files',     normalize: normalizeLitigation },
        { table: 'mediations',           normalize: normalizeMediation },
        { table: 'appraisals',           normalize: normalizeAppraisal },
        { table: 'pa_settlements',       normalize: normalizePASettlement },
        { table: 'claim_health_records', normalize: normalizeClaimHealth },
      ];

      await Promise.all(
        spokes.map(async ({ table, normalize }) => {
          try {
            let q = supabase.from(table).select('*').eq('org_id', orgId);
            q = applyCanonicalFilter(q, searchField, searchTerm);
            // Estimates carry parent/child revisions — newest first so the
            // current snapshot wins on dedupe below.
            if (table === 'estimates') {
              q = q.order('created_at', { ascending: false });
            }
            const { data } = await q.limit(5);
            if (data) results.push(...data.map(normalize));
          } catch {
            /* skip spoke on error */
          }
        }),
      );

      // Deduplicate by canonical identifier combo so a claim that exists in
      // multiple spokes (typical for an active matter) doesn't show up 5 times.
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
