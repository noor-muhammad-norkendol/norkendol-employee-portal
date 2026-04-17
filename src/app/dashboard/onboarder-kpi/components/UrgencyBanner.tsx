"use client";

import React, { useState } from "react";
import type { OnboardingClient, OnboardingStatus } from "@/types/onboarder-kpi";
import { STATUS_LABELS, STAGE_TARGET_HOURS } from "@/types/onboarder-kpi";
import { HOUR_MS } from "./styles";

interface Props {
  allClients: OnboardingClient[];
  onClickClient?: (client: OnboardingClient) => void;
}

const ACTIVE_STAGES: OnboardingStatus[] = ["new", "step_2", "step_3", "final_step", "on_hold"];

export default function UrgencyBanner({ allClients, onClickClient }: Props) {
  const [expanded, setExpanded] = useState(true);

  const overdueClients = allClients.filter((c) => {
    if (!ACTIVE_STAGES.includes(c.status)) return false;
    const hours = (Date.now() - new Date(c.status_entered_at).getTime()) / HOUR_MS;
    const target = STAGE_TARGET_HOURS[c.status as keyof typeof STAGE_TARGET_HOURS];
    return target ? hours > target : false;
  });

  if (overdueClients.length === 0) return null;

  return (
    <div style={{
      background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.25)",
      borderRadius: 8,
      marginBottom: 16,
      overflow: "hidden",
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
          color: "#ef4444", fontSize: 13, fontWeight: 600,
        }}
      >
        <span>
          {expanded ? "\u25B2" : "\u25BC"}{" "}
          {overdueClients.length} client{overdueClients.length !== 1 ? "s" : ""} overdue — Action Required
        </span>
        <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>
          {expanded ? "Click to hide" : "Click to show"}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {overdueClients.map((client) => {
              const hours = (Date.now() - new Date(client.status_entered_at).getTime()) / HOUR_MS;
              const label = hours < 24 ? `${Math.round(hours)}h` : `${(hours / 24).toFixed(1)}d`;
              return (
                <div
                  key={client.id}
                  onClick={() => onClickClient?.(client)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "6px 10px", borderRadius: 6,
                    background: "rgba(239,68,68,0.06)", cursor: onClickClient ? "pointer" : "default",
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {client.client_name}
                    <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>
                      {STATUS_LABELS[client.status]}
                    </span>
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: "#ef4444",
                    padding: "1px 6px", borderRadius: 4,
                    background: "rgba(239,68,68,0.12)",
                  }}>
                    {label} in stage
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
