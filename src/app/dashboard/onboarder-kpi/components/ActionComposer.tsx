"use client";

import React, { useState } from "react";
import type { OnboardingClient, ContactTarget } from "@/types/onboarder-kpi";
import { useCompleteStageAction } from "@/hooks/onboarder-kpi/useStageActions";
import { usePALookup } from "@/hooks/onboarder-kpi/usePALookup";
import { btnPrimary, btnOutline } from "./styles";

type RecipientMode = "to" | "cc" | null;

interface ContactRow {
  target: ContactTarget;
  label: string;
  email: string | null;
  phone: string | null;
}

const CALL_RESULTS = [
  { value: "answered" as const, label: "Answered" },
  { value: "voicemail" as const, label: "Voicemail" },
  { value: "no_answer" as const, label: "No Answer" },
  { value: "busy" as const, label: "Busy / Wrong #" },
];

interface Props {
  client: OnboardingClient;
  action: "email" | "text" | "call";
  onDone: () => void;
}

export default function ActionComposer({ client, action, onDone }: Props) {
  const { data: paInfo } = usePALookup(client.assigned_pa_name);
  const completeMut = useCompleteStageAction();

  const contacts: ContactRow[] = [
    { target: "insured" as ContactTarget, label: "Insured", email: client.email || null, phone: client.phone || null },
    { target: "contractor" as ContactTarget, label: "Contractor", email: client.contractor_email || null, phone: client.contractor_phone || null },
    { target: "pa" as ContactTarget, label: client.assigned_pa_name ? `PA — ${client.assigned_pa_name}` : "Public Adjuster", email: paInfo?.email || null, phone: paInfo?.phone || null },
  ];

  // Email/Text: track To/CC per contact
  const [recipients, setRecipients] = useState<Record<string, RecipientMode>>({
    insured: "to", // default insured to To
    contractor: null,
    pa: null,
  });

  // Call: track who and result
  const [callTarget, setCallTarget] = useState<ContactTarget>("insured");
  const [callResult, setCallResult] = useState<"answered" | "voicemail" | "no_answer" | "busy">("answered");

  function cycleRecipient(target: string) {
    setRecipients((prev) => {
      const current = prev[target];
      const next: RecipientMode = current === null ? "to" : current === "to" ? "cc" : null;
      return { ...prev, [target]: next };
    });
  }

  function handleOpenEmail() {
    const toEmails: string[] = [];
    const ccEmails: string[] = [];

    for (const c of contacts) {
      const mode = recipients[c.target];
      if (!c.email) continue;
      if (mode === "to") toEmails.push(c.email);
      else if (mode === "cc") ccEmails.push(c.email);
    }

    const fileRef = client.file_number ? ` [${client.file_number}]` : "";
    const subject = action === "text"
      ? `Quick update on your claim${fileRef}`
      : `Re: ${client.client_name}${fileRef}`;

    const params = new URLSearchParams();
    params.set("subject", subject);
    if (ccEmails.length > 0) params.set("cc", ccEmails.join(","));

    const url = `mailto:${toEmails.map(encodeURIComponent).join(",")}?${params.toString()}`;
    window.open(url, "_blank");
    onDone();
  }

  async function handleLogCall() {
    try {
      await completeMut.mutateAsync({
        client_id: client.id,
        stage: client.status,
        action_type: "call",
        contact_target: callTarget,
        subject: `Call to ${contacts.find((c) => c.target === callTarget)?.label || callTarget}`,
        call_result: callResult,
      });
    } catch { /* mutation handles errors */ }
    onDone();
  }

  const actionColor = action === "email" ? "#fbbf24" : action === "text" ? "#60a5fa" : "#a78bfa";
  const actionIcon = action === "email" ? "\u2709\uFE0F" : action === "text" ? "\uD83D\uDCAC" : "\uD83D\uDCDE";
  const actionLabel = action === "email" ? "Email" : action === "text" ? "Text" : "Call";

  return (
    <div style={{
      background: "var(--bg-page)", border: `1px solid ${actionColor}40`, borderRadius: 10,
      padding: 16, marginBottom: 16,
    }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: actionColor, margin: "0 0 14px" }}>
        {actionIcon} {actionLabel}
      </p>

      {/* ── Email / Text: recipient picker ── */}
      {(action === "email" || action === "text") && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {contacts.map((c) => {
              const mode = recipients[c.target];
              return (
                <div
                  key={c.target}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", borderRadius: 8,
                    border: mode ? `1px solid ${actionColor}40` : "1px solid var(--border-color)",
                    background: mode ? `${actionColor}08` : "transparent",
                  }}
                >
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.label}</span>
                    {c.email ? (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{c.email}</span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#fb923c", marginLeft: 8 }}>no email on file</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => setRecipients((prev) => ({ ...prev, [c.target]: prev[c.target] === "to" ? null : "to" }))}
                      style={{
                        padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                        border: mode === "to" ? `1px solid ${actionColor}` : "1px solid var(--border-color)",
                        background: mode === "to" ? `${actionColor}25` : "transparent",
                        color: mode === "to" ? actionColor : "var(--text-muted)",
                        cursor: "pointer",
                      }}
                    >
                      To
                    </button>
                    <button
                      onClick={() => setRecipients((prev) => ({ ...prev, [c.target]: prev[c.target] === "cc" ? null : "cc" }))}
                      style={{
                        padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                        border: mode === "cc" ? "1px solid var(--accent)" : "1px solid var(--border-color)",
                        background: mode === "cc" ? "rgba(74,222,128,0.15)" : "transparent",
                        color: mode === "cc" ? "var(--accent)" : "var(--text-muted)",
                        cursor: "pointer",
                      }}
                    >
                      CC
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            style={{ ...btnPrimary, background: actionColor, fontSize: 13, width: "100%" }}
            onClick={handleOpenEmail}
            disabled={!Object.values(recipients).some((v) => v)}
          >
            Open {actionLabel}
          </button>
        </>
      )}

      {/* ── Call: pick who + result ── */}
      {action === "call" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {contacts.filter((c) => c.phone).map((c) => (
              <button
                key={c.target}
                onClick={() => setCallTarget(c.target)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", borderRadius: 8, textAlign: "left",
                  border: callTarget === c.target ? `2px solid ${actionColor}` : "1px solid var(--border-color)",
                  background: callTarget === c.target ? `${actionColor}15` : "transparent",
                  cursor: "pointer", color: "var(--text-primary)",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.phone}</span>
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {CALL_RESULTS.map((cr) => (
              <button
                key={cr.value}
                onClick={() => setCallResult(cr.value)}
                style={{
                  padding: "5px 10px", borderRadius: 4, fontSize: 12, fontWeight: 500,
                  border: callResult === cr.value ? `1px solid ${actionColor}` : "1px solid var(--border-color)",
                  background: callResult === cr.value ? `${actionColor}20` : "transparent",
                  color: callResult === cr.value ? actionColor : "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                {cr.label}
              </button>
            ))}
          </div>

          <button
            style={{ ...btnPrimary, background: actionColor, fontSize: 13, width: "100%" }}
            onClick={handleLogCall}
            disabled={completeMut.isPending}
          >
            {completeMut.isPending ? "Logging..." : "Log Call"}
          </button>
        </>
      )}

      <button
        style={{ ...btnOutline, fontSize: 12, marginTop: 8, width: "100%" }}
        onClick={onDone}
      >
        Cancel
      </button>
    </div>
  );
}
