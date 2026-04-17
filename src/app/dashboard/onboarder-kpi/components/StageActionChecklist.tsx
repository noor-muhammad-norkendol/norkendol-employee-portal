"use client";

import React, { useState } from "react";
import { useStageActions, useCompleteStageAction } from "@/hooks/onboarder-kpi/useStageActions";
import type { ActivityType, ContactTarget, CallResult } from "@/types/onboarder-kpi";
import { btnPrimary, btnOutline } from "./styles";

const ACTIONS: { type: ActivityType; label: string; icon: string }[] = [
  { type: "text", label: "Text", icon: "\u{1F4AC}" },
  { type: "email", label: "Email", icon: "\u{2709}\uFE0F" },
  { type: "call", label: "Call", icon: "\u{1F4DE}" },
];

const CALL_RESULTS: { value: CallResult; label: string }[] = [
  { value: "answered", label: "Answered" },
  { value: "voicemail", label: "Voicemail" },
  { value: "no_answer", label: "No Answer" },
  { value: "busy", label: "Busy / Wrong #" },
];

const TARGET_LABELS: Record<string, string> = {
  insured: "Insured",
  contractor: "Contractor",
  pa: "Public Adjuster",
};

interface Props {
  clientId: string;
  stage: string;
  contactTarget: ContactTarget;
  initialAction?: ActivityType | null;
}

export default function StageActionChecklist({ clientId, stage, contactTarget, initialAction }: Props) {
  const { data: actions = [] } = useStageActions(clientId, stage);
  const completeMut = useCompleteStageAction();
  const [confirmAction, setConfirmAction] = useState<ActivityType | null>(initialAction || null);
  const [callResult, setCallResult] = useState<CallResult>("answered");
  const [notes, setNotes] = useState("");

  function isCompleted(actionType: string): { done: boolean; by?: string; at?: string } {
    const match = actions.find(
      (a) => a.action_type === actionType && a.contact_target === contactTarget && a.completed_at
    );
    if (!match) return { done: false };
    return {
      done: true,
      by: match.completed_by || undefined,
      at: match.completed_at
        ? new Date(match.completed_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        : undefined,
    };
  }

  async function handleConfirm() {
    if (!confirmAction) return;
    await completeMut.mutateAsync({
      client_id: clientId,
      stage,
      action_type: confirmAction,
      contact_target: contactTarget,
      subject: `${confirmAction} to ${TARGET_LABELS[contactTarget] || contactTarget}`,
      body: notes || undefined,
      call_result: confirmAction === "call" ? callResult : undefined,
    });
    setConfirmAction(null);
    setNotes("");
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {TARGET_LABELS[contactTarget] || contactTarget}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {ACTIONS.map(({ type, label, icon }) => {
          const status = isCompleted(type);
          return (
            <div key={type}>
              <button
                onClick={() => !status.done && setConfirmAction(type)}
                disabled={status.done}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "6px 10px", borderRadius: 6,
                  background: status.done ? "rgba(74,222,128,0.08)" : "transparent",
                  border: status.done ? "1px solid rgba(74,222,128,0.2)" : "1px solid var(--border-color)",
                  cursor: status.done ? "default" : "pointer",
                  color: status.done ? "#4ade80" : "var(--text-primary)",
                  fontSize: 13, textAlign: "left",
                }}
              >
                <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>
                  {status.done ? "\u2713" : "\u25CB"}
                </span>
                <span>{icon} {label}</span>
                {status.done && status.at && (
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)" }}>
                    {status.by} \u00b7 {status.at}
                  </span>
                )}
              </button>

              {/* Inline confirm */}
              {confirmAction === type && !status.done && (
                <div style={{ padding: "8px 10px", marginTop: 4, background: "var(--bg-page)", borderRadius: 6, border: "1px solid var(--border-color)" }}>
                  {type === "call" && (
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Call Result</label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {CALL_RESULTS.map((cr) => (
                          <button
                            key={cr.value}
                            onClick={() => setCallResult(cr.value)}
                            style={{
                              padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                              border: callResult === cr.value ? "1px solid var(--accent)" : "1px solid var(--border-color)",
                              background: callResult === cr.value ? "rgba(74,222,128,0.15)" : "transparent",
                              color: callResult === cr.value ? "var(--accent)" : "var(--text-primary)",
                              cursor: "pointer",
                            }}
                          >
                            {cr.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <textarea
                    style={{
                      width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border-color)",
                      color: "var(--text-primary)", borderRadius: 6, padding: "6px 8px", fontSize: 12,
                      minHeight: 40, resize: "vertical", outline: "none",
                    }}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes..."
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <button
                      style={{ ...btnPrimary, fontSize: 11, padding: "4px 10px" }}
                      onClick={handleConfirm}
                      disabled={completeMut.isPending}
                    >
                      {completeMut.isPending ? "Saving..." : "Confirm"}
                    </button>
                    <button
                      style={{ ...btnOutline, fontSize: 11, padding: "4px 10px" }}
                      onClick={() => { setConfirmAction(null); setNotes(""); }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
