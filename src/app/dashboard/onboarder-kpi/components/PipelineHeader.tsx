"use client";

import React from "react";
import { OnboardingStatus, STATUS_LABELS } from "@/types/onboarder-kpi";
import { STATUS_COLORS } from "./styles";

interface PipelineHeaderProps {
  totalClients: number;
  completionRate: number | null;
  pipelineCounts: Record<string, number>;
  statusFilter: OnboardingStatus;
  view: string;
  onSelectStatus: (status: OnboardingStatus) => void;
}

const PIPELINE_STATUSES: OnboardingStatus[] = [
  "new", "step_2", "step_3", "final_step", "on_hold", "completed",
];

export default function PipelineHeader({
  totalClients, completionRate, pipelineCounts, statusFilter, view, onSelectStatus,
}: PipelineHeaderProps) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Onboarder KPI</h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
          {totalClients} client{totalClients !== 1 ? "s" : ""} total
          {completionRate !== null ? ` \u00b7 ${completionRate}% completion rate` : ""}
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {PIPELINE_STATUSES.map((s) => {
          const sc = STATUS_COLORS[s];
          const count = pipelineCounts[s] || 0;
          const active = statusFilter === s && view === "pipeline";
          return (
            <button
              key={s}
              onClick={() => onSelectStatus(s)}
              style={{
                background: active ? sc.text : sc.bg,
                color: active ? "#fff" : sc.text,
                border: "none", borderRadius: 6, padding: "4px 10px",
                fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >
              {STATUS_LABELS[s]} ({count})
            </button>
          );
        })}
      </div>
    </div>
  );
}
