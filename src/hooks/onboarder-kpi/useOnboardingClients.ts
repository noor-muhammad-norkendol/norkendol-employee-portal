"use client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useOKSupabase } from './useSupabase';
import { OnboardingClient, CreateClientInput, UpdateClientInput, OnboardingStatus } from '@/types/onboarder-kpi';

// Spoke #9 auto-create: when an onboarding row hits status='completed',
// CREATE-ONCE a team_lead_reviews Phase 1 row. If a row already exists for
// this (org, file_number, phase) combo, we do NOT touch it — that preserves
// any review work the TL has done (reviewer_id, decision_notes, status, etc.).
// Trade-off: canonical fields on TLS may go stale if the onboarder row is
// edited after the TLS row exists. The right fix when that matters is for
// the TL to update the TLS row directly via the side panel.
async function ensureTLSPhase1Row(supabase: SupabaseClient, row: OnboardingClient) {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) {
    console.warn('[TLS Phase 1] skipped: no signed-in user');
    return;
  }
  if (!row.file_number) {
    console.warn('[TLS Phase 1] skipped: onboarding row has no file_number', { row });
    return;
  }

  const { data: existing, error: checkErr } = await supabase
    .from('team_lead_reviews')
    .select('id')
    .eq('org_id', row.org_id)
    .eq('file_number', row.file_number)
    .eq('phase', 'phase_1')
    .maybeSingle();
  if (checkErr) {
    console.error('[TLS Phase 1] existence check failed:', checkErr);
    return;
  }
  if (existing) {
    console.info('[TLS Phase 1] row already exists — skipping create-once', { file_number: row.file_number });
    return;
  }

  const loss_address =
    row.loss_address ||
    [row.loss_street, row.loss_line2, row.loss_city, row.loss_state, row.loss_zip]
      .filter(Boolean)
      .join(", ") ||
    null;
  const payload = {
    org_id: row.org_id,
    file_number: row.file_number,
    claim_number: row.claim_number || null,
    policy_number: row.policy_number || null,
    client_name: row.client_name || null,
    loss_address,
    peril: row.peril || null,
    peril_other: (row as OnboardingClient & { peril_other?: string | null }).peril_other || null,
    severity: (row as OnboardingClient & { severity?: number | null }).severity ?? null,
    phase: 'phase_1' as const,
    status: 'pending' as const,
    created_by: userId,
  };
  const { error: insertErr } = await supabase.from('team_lead_reviews').insert(payload);
  if (insertErr) {
    console.error('[TLS Phase 1] INSERT failed:', insertErr, 'payload:', payload);
    return;
  }
  console.info('[TLS Phase 1] row created for', row.file_number);
}

export function useOnboardingClients(statusFilter?: OnboardingStatus) {
  const { supabase, userInfo } = useOKSupabase();

  return useQuery({
    queryKey: ['onboarding-clients', userInfo?.orgId, statusFilter],
    queryFn: async (): Promise<OnboardingClient[]> => {
      if (!userInfo) return [];
      // Sandbox visibility: anyone with access to this page (Intake or
      // super_admin per page-level guard) sees the entire org pool — no
      // per-user filter. Onboarding is shared work, not owned work.
      let query = supabase
        .from('onboarding_clients')
        .select('*')
        .eq('org_id', userInfo.orgId)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      } else {
        // Default view excludes archival statuses (erroneous/abandoned/revised).
        // Those are soft-deleted from the dashboard; their data lives in
        // kpi_snapshots for KPI reporting via the EI Data tab.
        query = query.not('status', 'in', '("erroneous","abandoned","revised")');
      }

      const { data, error } = await query;
      if (error) throw new Error(`Failed to fetch onboarding clients: ${error.message}`);
      return (data || []) as OnboardingClient[];
    },
    enabled: !!userInfo,
  });
}

export function useCreateOnboardingClient() {
  const queryClient = useQueryClient();
  const { supabase, userInfo } = useOKSupabase();

  return useMutation({
    mutationFn: async (input: CreateClientInput) => {
      if (!userInfo) throw new Error('Not authenticated');
      const cleaned = Object.fromEntries(
        Object.entries(input).map(([k, v]) => [k, v === '' ? null : v])
      );
      const { data, error } = await supabase
        .from('onboarding_clients')
        .insert({
          ...cleaned,
          org_id: userInfo.orgId,
          created_by_id: userInfo.userId,
          created_by_name: userInfo.fullName,
        })
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to create client: ${error.message}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-clients'] });
    },
  });
}

export function useUpdateOnboardingClient() {
  const queryClient = useQueryClient();
  const { supabase } = useOKSupabase();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateClientInput) => {
      const { data, error } = await supabase
        .from('onboarding_clients')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to update client: ${error.message}`);

      // Auto-create TLS Phase 1 row when status hits 'completed'.
      // Idempotent — running multiple times is a no-op.
      if (data && (data as OnboardingClient).status === 'completed') {
        try {
          await ensureTLSPhase1Row(supabase, data as OnboardingClient);
        } catch (e) {
          // Non-fatal: log but don't fail the onboarding update.
          console.error('TLS Phase 1 auto-create failed:', e);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-clients'] });
      queryClient.invalidateQueries({ queryKey: ['team-lead-reviews'] });
    },
  });
}

export function useDeleteOnboardingClient() {
  const queryClient = useQueryClient();
  const { supabase } = useOKSupabase();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('onboarding_clients')
        .delete()
        .eq('id', id);
      if (error) throw new Error(`Failed to delete client: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-clients'] });
    },
  });
}
