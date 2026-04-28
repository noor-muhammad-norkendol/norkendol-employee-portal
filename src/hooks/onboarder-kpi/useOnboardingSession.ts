"use client";
import { useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// Tracks per-user time spent on a per-claim card while it sits in a given
// phase. Inserts a row in onboarding_phase_sessions on mount, heartbeats
// every minute, watches for idle (>21 min no DOM activity), and closes the
// row on unmount with the appropriate ended_reason. Also opportunistically
// cleans up orphaned sessions (last_heartbeat older than 21 min, ended_at
// still null) on every fresh start — that's how we recover from browser
// crashes / network drops without a server-side cron.

interface UseOnboardingSessionOptions {
  supabase: SupabaseClient;
  orgId: string | undefined;
  userId: string | undefined;
  clientId: string | null;
  phase: string | null;
  enabled?: boolean;
}

const HEARTBEAT_MS = 60 * 1000;          // ping last_heartbeat_at every 60s
const IDLE_CHECK_MS = 60 * 1000;         // check for idle every 60s
const IDLE_TIMEOUT_MS = 21 * 60 * 1000;  // 21 minutes per Frank's call

export function useOnboardingSession({
  supabase, orgId, userId, clientId, phase, enabled = true,
}: UseOnboardingSessionOptions) {
  const sessionIdRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled || !orgId || !userId || !clientId || !phase) return;

    let cancelled = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let idleTimer: ReturnType<typeof setInterval> | null = null;

    function bumpActivity() {
      lastActivityRef.current = Date.now();
    }

    async function endSession(reason: 'card_closed' | 'card_advanced' | 'idle_timeout') {
      const id = sessionIdRef.current;
      if (!id) return;
      sessionIdRef.current = null;
      try {
        await supabase
          .from('onboarding_phase_sessions')
          .update({ ended_at: new Date().toISOString(), ended_reason: reason })
          .eq('id', id);
        console.info('[Session] ended', { id, reason });
      } catch (e) {
        console.warn('[Session] end failed:', e);
      }
    }

    async function startSession() {
      // Opportunistic orphan cleanup: close any of THIS user's sessions whose
      // last_heartbeat is older than the idle timeout. Catches browser crashes
      // and lost network conditions where endSession never ran.
      const cutoffIso = new Date(Date.now() - IDLE_TIMEOUT_MS).toISOString();
      try {
        await supabase
          .from('onboarding_phase_sessions')
          .update({ ended_at: cutoffIso, ended_reason: 'orphaned' })
          .is('ended_at', null)
          .lt('last_heartbeat_at', cutoffIso)
          .eq('user_id', userId);
      } catch (e) {
        console.warn('[Session] orphan cleanup failed:', e);
      }

      // Insert the new session row
      const { data, error } = await supabase
        .from('onboarding_phase_sessions')
        .insert({
          org_id: orgId,
          onboarding_client_id: clientId,
          phase,
          user_id: userId,
        })
        .select('id')
        .maybeSingle();

      if (error || !data) {
        console.error('[Session] start failed:', error);
        return;
      }
      if (cancelled) {
        // Effect cleanup ran before insert returned — close the row right away
        await supabase
          .from('onboarding_phase_sessions')
          .update({ ended_at: new Date().toISOString(), ended_reason: 'card_closed' })
          .eq('id', (data as { id: string }).id);
        return;
      }
      sessionIdRef.current = (data as { id: string }).id;
      console.info('[Session] started', { id: data.id, clientId, phase });
    }

    function heartbeat() {
      const id = sessionIdRef.current;
      if (!id) return;
      supabase
        .from('onboarding_phase_sessions')
        .update({ last_heartbeat_at: new Date().toISOString() })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.warn('[Session] heartbeat failed:', error);
        });
    }

    function checkIdle() {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed > IDLE_TIMEOUT_MS && sessionIdRef.current) {
        endSession('idle_timeout');
      }
    }

    // Kick off
    bumpActivity();
    startSession().then(() => {
      heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
      idleTimer = setInterval(checkIdle, IDLE_CHECK_MS);
    });

    // DOM activity listeners — any of these resets the idle countdown
    document.addEventListener('mousemove', bumpActivity);
    document.addEventListener('keydown', bumpActivity);
    document.addEventListener('click', bumpActivity);
    document.addEventListener('scroll', bumpActivity, { passive: true });

    return () => {
      cancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (idleTimer) clearInterval(idleTimer);
      document.removeEventListener('mousemove', bumpActivity);
      document.removeEventListener('keydown', bumpActivity);
      document.removeEventListener('click', bumpActivity);
      document.removeEventListener('scroll', bumpActivity);
      // Reason depends on whether phase changed (card advanced) or panel
      // closed. We can't know here; the consumer can call closeSession with
      // a specific reason before unmount if needed. Default = card_closed.
      endSession('card_closed');
    };
  }, [supabase, orgId, userId, clientId, phase, enabled]);
}
