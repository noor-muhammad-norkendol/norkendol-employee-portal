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
  border: "1px solid var(--border)",
  borderRadius: 6,
  width: 30,
  height: 30,
  cursor: "pointer",
  color: "var(--text-faint)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "color 0.15s, border-color 0.15s, background 0.15s",
};

const headerCellStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 12px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--text-faint)",
  fontFamily: "var(--font-ui)",
};

const dataCellStyle: React.CSSProperties = {
  padding: "14px 12px",
  fontSize: 13,
  verticalAlign: "middle",
  color: "var(--text)",
};

function pillStyle(token: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    fontFamily: "var(--font-ui)",
    background: `color-mix(in srgb, var(${token}) 12%, transparent)`,
    color: `var(${token})`,
    border: `1px solid color-mix(in srgb, var(${token}) 40%, transparent)`,
  };
}

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
    <div className="themed-card p-5">
      <div className="themed-card-stripe" aria-hidden />
      <div className="flex items-center gap-4 mb-4">
        <h2
          className="page-title text-xl font-bold leading-none flex items-center gap-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="themed-accent">{STATUS_LABELS[statusFilter]}</span>
          <span
            className="themed-accent"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.85em" }}
          >
            ({filteredClients.length})
          </span>
        </h2>
        <span
          aria-hidden
          className="flex-1"
          style={{ height: "1px", background: "var(--border)" }}
        />
        {/* Search input */}
        <div
          className="flex items-center gap-2 px-3"
          style={{
            height: 36,
            background: "var(--pad-input)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-input)",
            minWidth: 240,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-faint)" }}>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search clients..."
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text)" }}
            disabled
          />
        </div>
        {/* Filter + Download */}
        <button
          aria-label="Filter"
          className="flex items-center justify-center cursor-pointer transition-colors"
          style={{
            width: 36, height: 36,
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-input)",
            color: "var(--text-dim)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--accent)";
            e.currentTarget.style.borderColor = "var(--border-active)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-dim)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
        </button>
        <button
          aria-label="Download"
          className="flex items-center justify-center cursor-pointer transition-colors"
          style={{
            width: 36, height: 36,
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-input)",
            color: "var(--text-dim)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--accent)";
            e.currentTarget.style.borderColor = "var(--border-active)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-dim)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      </div>

      {filteredClients.length === 0 ? (
        <p style={{ color: "var(--text-faint)", fontSize: 13, textAlign: "center", padding: 40 }}>
          No clients in {STATUS_LABELS[statusFilter]}. Click Add Client to get started.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={headerCellStyle}>Client</th>
                <th style={headerCellStyle}>Referral</th>
                <th style={headerCellStyle}>State</th>
                <th style={headerCellStyle}>Peril</th>
                <th style={headerCellStyle}>Type</th>
                <th style={headerCellStyle}>Time in Stage</th>
                <th style={headerCellStyle}>Contract</th>
                <th style={{ ...headerCellStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const tis = timeInStage(client);
                const transitions = ALLOWED_TRANSITIONS[client.status] || [];
                const isExpanded = expandedClient === client.id;
                const nextStage = NEXT_STAGE[client.status];
                const initials = client.client_name
                  .split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

                return (
                  <React.Fragment key={client.id}>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={dataCellStyle}>
                        <div
                          className="flex items-center gap-3"
                          style={{ cursor: onOpenPanel ? "pointer" : "default" }}
                          onClick={() => onOpenPanel?.(client, null)}
                        >
                          <span
                            className="shrink-0 inline-flex items-center justify-center text-[12px] font-bold"
                            style={{
                              width: 38, height: 38,
                              borderRadius: 7,
                              background: "color-mix(in srgb, var(--accent) 14%, var(--pad))",
                              border: "1px solid var(--border-active)",
                              color: "var(--accent)",
                              textShadow: "var(--accent-text-shadow)",
                              fontFamily: "var(--font-display)",
                            }}
                          >
                            {initials || "\u2014"}
                          </span>
                          <span
                            className="text-[14px]"
                            style={{ fontWeight: 600, color: "var(--text)" }}
                          >
                            {client.client_name}
                          </span>
                        </div>
                      </td>
                      <td style={dataCellStyle}>
                        <div className="flex flex-col leading-tight">
                          {client.phone && (
                            <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{client.phone}</span>
                          )}
                          {client.referral_source && (
                            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{client.referral_source}</span>
                          )}
                          {!client.phone && !client.referral_source && (
                            <span style={{ color: "var(--text-faint)" }}>\u2014</span>
                          )}
                        </div>
                      </td>
                      <td style={dataCellStyle}>
                        {client.state ? (
                          <span style={pillStyle("--violet")}>{client.state.toUpperCase()}</span>
                        ) : (
                          <span style={{ color: "var(--text-faint)" }}>\u2014</span>
                        )}
                      </td>
                      <td style={dataCellStyle}>
                        {client.peril ? (
                          <span style={pillStyle("--info")}>{client.peril.toUpperCase()}</span>
                        ) : (
                          <span style={{ color: "var(--text-faint)" }}>\u2014</span>
                        )}
                      </td>
                      <td style={dataCellStyle}>
                        <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                          {client.onboard_type || "\u2014"}
                        </span>
                      </td>
                      <td style={dataCellStyle}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontFamily: "var(--font-mono)",
                            color: tis.overdue ? "var(--red)" : "var(--accent)",
                            textShadow: tis.overdue
                              ? "0 0 8px color-mix(in srgb, var(--red) 50%, transparent)"
                              : "var(--accent-text-shadow)",
                          }}
                        >
                          {tis.label}
                        </span>
                        {tis.overdue && (
                          <span style={{ fontSize: 10, marginLeft: 6, color: "var(--red)", fontWeight: 700 }}>OVERDUE</span>
                        )}
                      </td>
                      <td style={dataCellStyle}>
                        <span style={pillStyle(client.contract_status === "signed" ? "--green" : "--amber")}>
                          {(client.contract_status || "not_sent").replace(/_/g, " ").toUpperCase()}
                        </span>
                      </td>
                      <td style={{ ...dataCellStyle, textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {/* Text */}
                          <button
                            title="Send text/message"
                            style={{ ...iconBtnStyle, color: "var(--info)", borderColor: "color-mix(in srgb, var(--info) 40%, transparent)" }}
                            onClick={() => onOpenPanel?.(client, "text")}
                          >
                            <IconText />
                          </button>
                          {/* Email */}
                          <button
                            title="Send email"
                            style={{ ...iconBtnStyle, color: "var(--amber)", borderColor: "color-mix(in srgb, var(--amber) 40%, transparent)" }}
                            onClick={() => onOpenPanel?.(client, "email")}
                          >
                            <IconEmail />
                          </button>
                          {/* Call — opens panel */}
                          <button
                            title="Log a call"
                            style={{ ...iconBtnStyle, color: "var(--violet)", borderColor: "color-mix(in srgb, var(--violet) 40%, transparent)" }}
                            onClick={() => onOpenPanel?.(client, "call")}
                          >
                            <IconPhone />
                          </button>
                          {/* Complete — advance to next stage */}
                          {nextStage && (
                            <button
                              title={`Advance to ${STATUS_LABELS[nextStage]}`}
                              style={{ ...iconBtnStyle, color: "var(--green)", borderColor: "color-mix(in srgb, var(--green) 40%, transparent)" }}
                              onClick={() => onMoveStatus(client, nextStage)}
                            >
                              <IconCheck />
                            </button>
                          )}
                          {/* Notes — opens panel */}
                          <button
                            title="View notes & activity"
                            style={{ ...iconBtnStyle, color: "var(--orange)", borderColor: "color-mix(in srgb, var(--orange) 40%, transparent)" }}
                            onClick={() => onOpenPanel?.(client, "notes")}
                          >
                            <IconNotes />
                          </button>
                          {/* More: Move / Edit */}
                          <button
                            style={{ ...iconBtnStyle, color: "var(--text-dim)" }}
                            onClick={() => onToggleExpand(isExpanded ? null : client.id)}
                            title="More actions"
                          >
                            {isExpanded ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M18 6 6 18M6 6l12 12" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="1.5" />
                                <circle cx="12" cy="12" r="1.5" />
                                <circle cx="12" cy="19" r="1.5" />
                              </svg>
                            )}
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
                                        background: tc.bg, color: tc.text, border: "none",
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
