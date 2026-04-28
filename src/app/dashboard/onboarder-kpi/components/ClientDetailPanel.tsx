"use client";

import React, { useEffect, useRef } from "react";
import { useActivityLogs } from "@/hooks/onboarder-kpi/useActivityLogs";
import { useLogActivity } from "@/hooks/onboarder-kpi/useActivityLogs";
import { useOnboardingSession } from "@/hooks/onboarder-kpi/useOnboardingSession";
import { useOKSupabase } from "@/hooks/onboarder-kpi/useSupabase";
import { useUpdateOnboardingClient } from "@/hooks/onboarder-kpi/useOnboardingClients";
import { useLogStatusChange } from "@/hooks/onboarder-kpi/useStatusHistory";
import { publishKPIEvent, buildClaimContext } from "@/hooks/onboarder-kpi/publishKPIEvent";
import type { OnboardingClient, OnboardingStatus, ContactTarget } from "@/types/onboarder-kpi";
import { STATUS_LABELS, STATUS_OPTIONS } from "@/types/onboarder-kpi";

// Statuses that act as soft-delete (card disappears from dashboard) — not
// shown in the normal Move To row, accessed via dedicated buttons with a
// confirm prompt
const ARCHIVAL_STATUSES: OnboardingStatus[] = ['erroneous', 'abandoned'];
import StageActionChecklist from "./StageActionChecklist";
import ActionComposer from "./ActionComposer";
import { usePALookup } from "@/hooks/onboarder-kpi/usePALookup";
import { STATUS_COLORS, btnOutline } from "./styles";
import type { PanelAction } from "./WorkboardTable";

interface Props {
  client: OnboardingClient | null;
  open: boolean;
  onClose: () => void;
  onEdit: (client: OnboardingClient) => void;
  onDelete: (id: string) => void;
  initialAction?: PanelAction;
}

const CONTACT_TARGETS: ContactTarget[] = ["insured", "contractor", "pa"];

export default function ClientDetailPanel({ client, open, onClose, onEdit, onDelete, initialAction }: Props) {
  const { supabase, userInfo } = useOKSupabase();
  const { data: activityLogs = [] } = useActivityLogs(client?.id);
  const logActivity = useLogActivity();
  const updateMut = useUpdateOnboardingClient();
  const logStatusChange = useLogStatusChange();
  const { data: paInfo } = usePALookup(client?.assigned_pa_name);
  const [moving, setMoving] = React.useState<OnboardingStatus | null>(null);

  // Spoke-unique behavior: track per-user time spent on this card while it
  // sits in this phase. Sessions auto-close on panel close, idle (>21 min),
  // and phase change. See useOnboardingSession for the full lifecycle.
  // The clientContext is embedded in the time_in_phase KPI event so the
  // EI Data tab can render rich rows without joining onboarding_clients.
  useOnboardingSession({
    supabase,
    orgId: userInfo?.orgId,
    userId: userInfo?.userId,
    userName: userInfo?.fullName,
    clientId: open && client ? client.id : null,
    phase: open && client ? client.status : null,
    enabled: open && !!client,
    clientContext: open && client ? {
      ...buildClaimContext(client as unknown as Record<string, unknown>),
      user_name: userInfo?.fullName,
      user_email: userInfo?.email,
    } : undefined,
  });

  async function handleMoveTo(targetStatus: OnboardingStatus) {
    if (!client || targetStatus === client.status || moving) return;

    // Archival statuses (erroneous/abandoned) trigger a confirmation toast.
    // Once confirmed, the card disappears from the dashboard — soft delete.
    const isArchival = ARCHIVAL_STATUSES.includes(targetStatus);
    if (isArchival) {
      const verb = targetStatus === 'abandoned' ? 'abandoned' : 'erroneous';
      const ok = confirm(
        `Are you sure you want to mark this claim ${verb}? It will be removed from the dashboard.`
      );
      if (!ok) return;
    }

    setMoving(targetStatus);
    try {
      const fromStatus = client.status;
      await Promise.all([
        updateMut.mutateAsync({
          id: client.id,
          status: targetStatus,
          status_entered_at: new Date().toISOString(),
          ...(targetStatus === "completed" ? { completed_at: new Date().toISOString() } : {}),
          ...(targetStatus === "abandoned" ? { abandoned_at: new Date().toISOString() } : {}),
        }),
        logStatusChange.mutateAsync({
          client_id: client.id,
          from_status: fromStatus,
          to_status: targetStatus,
        }),
        logActivity.mutateAsync({
          client_id: client.id,
          activity_type: "status_change",
          subject: `Status changed: ${STATUS_LABELS[fromStatus]} → ${STATUS_LABELS[targetStatus]}`,
        }),
      ]);

      // KPI event publishing — fire-and-forget, never blocks the user op
      if (userInfo?.orgId) {
        const claimCtx = {
          ...buildClaimContext(client as unknown as Record<string, unknown>),
          user_name: userInfo.fullName,
          user_email: userInfo.email,
        };
        const baseMeta = {
          user_id: userInfo.userId,
          file_number: client.file_number,
          from_phase: fromStatus,
        };
        if (targetStatus === 'abandoned') {
          publishKPIEvent(supabase, {
            orgId: userInfo.orgId,
            metricKey: 'claim_abandoned',
            metadata: baseMeta,
            claimContext: claimCtx,
          });
        } else if (targetStatus === 'erroneous') {
          publishKPIEvent(supabase, {
            orgId: userInfo.orgId,
            metricKey: 'claim_erroneous',
            metadata: baseMeta,
            claimContext: claimCtx,
          });
        } else {
          publishKPIEvent(supabase, {
            orgId: userInfo.orgId,
            metricKey: 'phase_completed',
            metadata: { ...baseMeta, to_phase: targetStatus },
            claimContext: claimCtx,
          });
        }
      }

      // Auto-close panel when archiving — card no longer exists in the user view
      if (isArchival) onClose();
    } catch (e) {
      console.error("[Move To] failed:", e);
    } finally {
      setMoving(null);
    }
  }
  const notesRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  // Track active composer action (email/text/call prompt)
  const [composerAction, setComposerAction] = React.useState<"email" | "text" | "call" | null>(null);

  // When panel opens with an action, activate the right thing
  useEffect(() => {
    if (!open || !initialAction) {
      setComposerAction(null);
      return;
    }
    if (initialAction === "email" || initialAction === "text" || initialAction === "call") {
      setComposerAction(initialAction);
      const timer = setTimeout(() => {
        composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      if (initialAction === "notes" && notesRef.current) {
        notesRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        noteInputRef.current?.focus();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [open, initialAction, client?.id]);

  if (!client) return null;

  const sc = STATUS_COLORS[client.status] || STATUS_COLORS.new;

  async function handleAddNote() {
    if (!noteInputRef.current?.value.trim() || !client) return;
    await logActivity.mutateAsync({
      client_id: client.id,
      activity_type: "note",
      subject: "Note added",
      body: noteInputRef.current.value.trim(),
    });
    noteInputRef.current.value = "";
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999,
            transition: "opacity 0.2s",
          }}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: 1050,
          maxWidth: "90vw",
          background: "var(--bg-surface)", borderLeft: "1px solid var(--border-color)",
          zIndex: 1000,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                {client.client_name}
              </h2>
              {client.file_number && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>{client.file_number}</p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, padding: 4 }}
            >
              &#x2715;
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <span style={{
              display: "inline-block", padding: "2px 10px", borderRadius: 4,
              fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.text,
            }}>
              {STATUS_LABELS[client.status]}
            </span>
            <button style={{ ...btnOutline, fontSize: 11, padding: "2px 8px" }} onClick={() => onEdit(client)}>
              Revise
            </button>
            <button
              style={{ ...btnOutline, fontSize: 11, padding: "2px 8px", color: "#ef4444", borderColor: "#ef4444" }}
              onClick={() => { if (confirm("Delete this client?")) { onDelete(client.id); onClose(); } }}
            >
              Delete
            </button>
          </div>
          {/* Move To: row — only normal workflow phases. Archival statuses
              (erroneous/abandoned) get dedicated red buttons below.
              'revised' is driven by the Revise button click, not Move To. */}
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginRight: 4 }}>
              Move to:
            </span>
            {STATUS_OPTIONS
              .filter((s) => s !== client.status && s !== 'erroneous' && s !== 'abandoned' && s !== 'revised')
              .map((s) => {
              const isMoving = moving === s;
              return (
                <button
                  key={s}
                  onClick={() => handleMoveTo(s)}
                  disabled={moving !== null}
                  style={{
                    ...btnOutline,
                    fontSize: 11,
                    padding: "3px 9px",
                    opacity: moving !== null && !isMoving ? 0.4 : 1,
                    cursor: moving !== null ? "not-allowed" : "pointer",
                  }}
                  title={`Move to ${STATUS_LABELS[s]}`}
                >
                  {isMoving ? "Moving…" : STATUS_LABELS[s]}
                </button>
              );
            })}
          </div>
          {/* Archive row — soft-delete the card with a confirm prompt */}
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginRight: 4 }}>
              Archive:
            </span>
            <button
              onClick={() => handleMoveTo('erroneous')}
              disabled={moving !== null || client.status === 'erroneous'}
              style={{
                ...btnOutline,
                fontSize: 11,
                padding: "3px 9px",
                color: "#ef4444",
                borderColor: "#ef4444",
                opacity: moving !== null && moving !== 'erroneous' ? 0.4 : 1,
                cursor: moving !== null ? "not-allowed" : "pointer",
              }}
              title="Mark as erroneous (entered in error). Removed from dashboard, archived to KPI data."
            >
              {moving === 'erroneous' ? "Saving…" : "Mark Erroneous"}
            </button>
            <button
              onClick={() => handleMoveTo('abandoned')}
              disabled={moving !== null || client.status === 'abandoned'}
              style={{
                ...btnOutline,
                fontSize: 11,
                padding: "3px 9px",
                color: "#ef4444",
                borderColor: "#ef4444",
                opacity: moving !== null && moving !== 'abandoned' ? 0.4 : 1,
                cursor: moving !== null ? "not-allowed" : "pointer",
              }}
              title="Mark as abandoned (policyholder gave up). Removed from dashboard, archived to KPI data."
            >
              {moving === 'abandoned' ? "Saving…" : "Mark Abandoned"}
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {/* Action Composer — email/text/call picker */}
          {composerAction && client && (
            <div ref={composerRef}>
              <ActionComposer
                client={client}
                action={composerAction}
                onDone={() => setComposerAction(null)}
              />
            </div>
          )}

          {/* Contact Info */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Contact Info</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
              {client.email && (
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Email</span>
                  <div><a href={`mailto:${client.email}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{client.email}</a></div>
                </div>
              )}
              {client.phone && (
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Phone</span>
                  <div><a href={`tel:${client.phone}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{client.phone}</a></div>
                </div>
              )}
              {client.loss_address && (
                <div style={{ gridColumn: "span 2" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Loss Address</span>
                  <div style={{ color: "var(--text-primary)" }}>{client.loss_address}</div>
                </div>
              )}
              {client.contractor_name && (
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Contractor</span>
                  <div style={{ color: "var(--text-primary)" }}>{client.contractor_name}</div>
                  {client.contractor_email && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{client.contractor_email}</div>}
                </div>
              )}
              {client.assigned_pa_name && (
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>PA</span>
                  <div style={{ color: "var(--text-primary)" }}>{client.assigned_pa_name}</div>
                  {paInfo?.email && <div style={{ fontSize: 11 }}><a href={`mailto:${paInfo.email}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{paInfo.email}</a></div>}
                  {paInfo?.phone && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{paInfo.phone}</div>}
                </div>
              )}
              {client.insurance_company && (
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Insurance</span>
                  <div style={{ color: "var(--text-primary)" }}>{client.insurance_company}</div>
                </div>
              )}
              {client.claim_number && (
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>Claim #</span>
                  <div style={{ color: "var(--text-primary)" }}>{client.claim_number}</div>
                </div>
              )}
            </div>
          </div>

          {/* Stage Action Checklists */}
          <div ref={callRef} style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>
              Stage Actions — {STATUS_LABELS[client.status]}
            </p>
            {CONTACT_TARGETS.map((target) => (
              <StageActionChecklist
                key={target}
                clientId={client.id}
                stage={client.status}
                contactTarget={target}
                initialAction={initialAction === "call" && target === "insured" ? "call" : null}
              />
            ))}
          </div>

          {/* Quick Add Note */}
          <div ref={notesRef} style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Quick Note</p>
            <textarea
              ref={noteInputRef}
              style={{
                width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-color)",
                color: "var(--text-primary)", borderRadius: 6, padding: "8px 10px", fontSize: 13,
                minHeight: 60, resize: "vertical", outline: "none",
              }}
              placeholder="Add a note..."
            />
            <button
              style={{ ...btnOutline, fontSize: 11, padding: "4px 10px", marginTop: 6 }}
              onClick={handleAddNote}
              disabled={logActivity.isPending}
            >
              {logActivity.isPending ? "Saving..." : "Add Note"}
            </button>
          </div>

          {/* Activity History */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
              Activity History
              {activityLogs.length > 0 && <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 6 }}>({activityLogs.length})</span>}
            </p>
            {activityLogs.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 12 }}>No activity yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {activityLogs.slice(0, 20).map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: "8px 10px", borderRadius: 6,
                      border: "1px solid var(--border-color)", fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {log.activity_type === "call" ? "\u{1F4DE}" : log.activity_type === "email" ? "\u{2709}\uFE0F" : log.activity_type === "text" ? "\u{1F4AC}" : log.activity_type === "note" ? "\u{1F4DD}" : "\u{1F504}"}
                        {" "}{log.subject || log.activity_type}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {new Date(log.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    {log.body && (
                      <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 11 }}>{log.body}</p>
                    )}
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      {log.user_name}
                      {log.contact_target && ` \u2192 ${log.contact_target}`}
                      {log.call_result && ` \u00b7 ${log.call_result}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Client Notes */}
          {client.notes && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Saved Notes</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{client.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
