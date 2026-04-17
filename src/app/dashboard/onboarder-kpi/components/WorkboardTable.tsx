"use client";

import React from "react";
import {
  OnboardingClient,
  OnboardingStatus,
  STATUS_LABELS,
  ALLOWED_TRANSITIONS,
  STAGE_TARGET_HOURS,
} from "@/types/onboarder-kpi";
import { cardStyle, btnOutline, thStyle, tdStyle, STATUS_COLORS, HOUR_MS } from "./styles";
import { buildEmailMailto, buildTextMailto } from "./mailtoHelpers";

function timeInStage(client: OnboardingClient): { hours: number; label: string; overdue: boolean } {
  const hours = (Date.now() - new Date(client.status_entered_at).getTime()) / HOUR_MS;
  const target = STAGE_TARGET_HOURS[client.status as keyof typeof STAGE_TARGET_HOURS];
  const overdue = target ? hours > target : false;
  if (hours < 1) return { hours, label: `${Math.round(hours * 60)}m`, overdue };
  if (hours < 24) return { hours, label: `${Math.round(hours)}h`, overdue };
  return { hours, label: `${(hours / 24).toFixed(1)}d`, overdue };
}

// Next natural stage for "Complete" one-click advance
const NEXT_STAGE: Partial<Record<OnboardingStatus, OnboardingStatus>> = {
  new: "step_2",
  step_2: "step_3",
  step_3: "final_step",
  final_step: "completed",
};

/* ── tiny inline SVG icons ── */
const IconEmail = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="22,7 12,13 2,7" />
  </svg>
);
const IconText = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const IconPhone = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const IconCheck = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const IconNotes = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
  </svg>
);

const iconBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border-color)",
  borderRadius: 4,
  padding: "4px 5px",
  cursor: "pointer",
  color: "var(--text-muted)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "color 0.15s, border-color 0.15s",
};

export type PanelAction = "email" | "text" | "call" | "notes" | null;

interface WorkboardTableProps {
  statusFilter: OnboardingStatus;
  filteredClients: OnboardingClient[];
  expandedClient: string | null;
  onToggleExpand: (id: string | null) => void;
  onEdit: (client: OnboardingClient) => void;
  onDelete: (id: string) => void;
  onMoveStatus: (client: OnboardingClient, newStatus: OnboardingStatus) => void;
  onOpenPanel?: (client: OnboardingClient, action: PanelAction) => void;
}

export default function WorkboardTable({
  statusFilter, filteredClients, expandedClient,
  onToggleExpand, onEdit, onDelete, onMoveStatus, onOpenPanel,
}: WorkboardTableProps) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          {STATUS_LABELS[statusFilter]}
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>
            {filteredClients.length} client{filteredClients.length !== 1 ? "s" : ""}
          </span>
        </h2>
      </div>

      {filteredClients.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 40 }}>
          No clients in {STATUS_LABELS[statusFilter]}. Click Add Client to get started.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Referral</th>
                <th style={thStyle}>State</th>
                <th style={thStyle}>Peril</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Time in Stage</th>
                <th style={thStyle}>Contract</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const tis = timeInStage(client);
                const transitions = ALLOWED_TRANSITIONS[client.status] || [];
                const isExpanded = expandedClient === client.id;
                const nextStage = NEXT_STAGE[client.status];

                return (
                  <React.Fragment key={client.id}>
                    <tr>
                      <td style={tdStyle}>
                        <div
                          style={{ cursor: onOpenPanel ? "pointer" : "default" }}
                          onClick={() => onOpenPanel?.(client, null)}
                        >
                          <span style={{ fontWeight: 600 }}>{client.client_name}</span>
                          {client.phone && (
                            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{client.phone}</span>
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>{client.referral_source || "\u2014"}</td>
                      <td style={tdStyle}>{client.state || "\u2014"}</td>
                      <td style={tdStyle}>{client.peril || "\u2014"}</td>
                      <td style={tdStyle}>{client.onboard_type || "\u2014"}</td>
                      <td style={{
                        ...tdStyle,
                        fontWeight: 600,
                        color: tis.overdue ? "#ef4444" : "var(--text-primary)",
                      }}>
                        {tis.label}
                        {tis.overdue && (
                          <span style={{ fontSize: 10, marginLeft: 4, color: "#ef4444" }}>OVERDUE</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 4,
                          fontSize: 11, fontWeight: 600,
                          background: client.contract_status === "signed" ? "rgba(74,222,128,0.15)" : "rgba(148,163,184,0.1)",
                          color: client.contract_status === "signed" ? "#4ade80" : "var(--text-muted)",
                        }}>
                          {client.contract_status || "not_sent"}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                          {/* Text */}
                          <button
                            title="Send text/message"
                            style={{ ...iconBtnStyle, color: "#60a5fa", borderColor: "rgba(96,165,250,0.3)" }}
                            onClick={() => onOpenPanel?.(client, "text")}
                          >
                            <IconText />
                          </button>
                          {/* Email */}
                          <button
                            title="Send email"
                            style={{ ...iconBtnStyle, color: "#fbbf24", borderColor: "rgba(251,191,36,0.3)" }}
                            onClick={() => onOpenPanel?.(client, "email")}
                          >
                            <IconEmail />
                          </button>
                          {/* Call — opens panel */}
                          <button
                            title="Log a call"
                            style={{ ...iconBtnStyle, color: "#a78bfa", borderColor: "rgba(167,139,250,0.3)" }}
                            onClick={() => onOpenPanel?.(client, "call")}
                          >
                            <IconPhone />
                          </button>
                          {/* Complete — advance to next stage */}
                          {nextStage && (
                            <button
                              title={`Advance to ${STATUS_LABELS[nextStage]}`}
                              style={{ ...iconBtnStyle, color: "#4ade80", borderColor: "rgba(74,222,128,0.3)" }}
                              onClick={() => onMoveStatus(client, nextStage)}
                            >
                              <IconCheck />
                            </button>
                          )}
                          {/* Notes — opens panel */}
                          <button
                            title="View notes & activity"
                            style={{ ...iconBtnStyle, color: "#fb923c", borderColor: "rgba(251,146,60,0.3)" }}
                            onClick={() => onOpenPanel?.(client, "notes")}
                          >
                            <IconNotes />
                          </button>
                          {/* More: Move / Edit */}
                          <button
                            style={{ ...btnOutline, fontSize: 10, padding: "2px 6px" }}
                            onClick={() => onToggleExpand(isExpanded ? null : client.id)}
                            title="More actions"
                          >
                            {isExpanded ? "\u2715" : "\u2026"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded row: Move + Edit + Delete */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} style={{ padding: "8px 12px", background: "var(--bg-page)", borderBottom: "1px solid var(--border-color)" }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            {transitions.length > 0 && (
                              <>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 4 }}>Move to:</span>
                                {transitions.map((t) => {
                                  const tc = STATUS_COLORS[t] || STATUS_COLORS.new;
                                  return (
                                    <button
                                      key={t}
                                      onClick={() => { onMoveStatus(client, t); }}
                                      style={{
                                        background: tc.bg, color: tc.color, border: "none",
                                        borderRadius: 4, padding: "4px 10px", fontSize: 11,
                                        fontWeight: 600, cursor: "pointer",
                                      }}
                                    >
                                      {STATUS_LABELS[t]}
                                    </button>
                                  );
                                })}
                              </>
                            )}
                            <span style={{ flex: 1 }} />
                            <button
                              style={{ ...btnOutline, fontSize: 11, padding: "3px 8px" }}
                              onClick={() => onEdit(client)}
                            >
                              Edit
                            </button>
                            <button
                              style={{ ...btnOutline, fontSize: 11, padding: "3px 8px", color: "#ef4444", borderColor: "#ef4444" }}
                              onClick={() => { if (confirm("Delete this client?")) onDelete(client.id); }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export { timeInStage };
