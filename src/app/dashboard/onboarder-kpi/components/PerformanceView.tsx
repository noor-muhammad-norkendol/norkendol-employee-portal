"use client";

import React from "react";
import type { OnboarderMetrics, TeamOnboardingMetrics } from "@/types/onboarder-kpi";
import { cardStyle, thStyle, tdStyle } from "./styles";

interface PerformanceViewProps {
  myMetrics: OnboarderMetrics | null;
  teamKPIs: TeamOnboardingMetrics;
}

export default function PerformanceView({ myMetrics, teamKPIs }: PerformanceViewProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Personal stats */}
      {myMetrics && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>My Performance</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
            {[
              { label: "Completion Rate", value: `${myMetrics.completionRate}%` },
              { label: "Avg Time to Complete", value: `${myMetrics.avgTimeToCompletionHours}h` },
              { label: "Overdue Rate", value: `${myMetrics.overdueRate}%`, warn: myMetrics.overdueRate > 20 },
              { label: "Conversion Rate", value: `${myMetrics.conversionRate}%` },
              { label: "Entries/Day", value: String(myMetrics.entriesPerDay) },
            ].map((stat) => (
              <div key={stat.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: stat.warn ? "#ef4444" : "var(--accent)" }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team rankings */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>Team Rankings</h2>
        {teamKPIs.onboarderRankings.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>No data yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Onboarder</th>
                  <th style={thStyle}>Entries</th>
                  <th style={thStyle}>Completed</th>
                  <th style={thStyle}>Completion %</th>
                  <th style={thStyle}>Avg Time (h)</th>
                  <th style={thStyle}>Overdue %</th>
                  <th style={thStyle}>Conversion %</th>
                </tr>
              </thead>
              <tbody>
                {teamKPIs.onboarderRankings.map((r) => (
                  <tr key={r.onboarderId}>
                    <td style={tdStyle}>{r.rank}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{r.onboarderName}</td>
                    <td style={tdStyle}>{r.totalEntries}</td>
                    <td style={tdStyle}>{r.completed}</td>
                    <td style={tdStyle}>{r.completionRate}%</td>
                    <td style={tdStyle}>{r.avgTimeToCompletionHours}</td>
                    <td style={{ ...tdStyle, color: r.overdueRate > 20 ? "#ef4444" : "var(--text-primary)" }}>{r.overdueRate}%</td>
                    <td style={tdStyle}>{r.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Team summary */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>Team Summary</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            { label: "Avg Completion Rate", value: `${teamKPIs.avgCompletionRate}%` },
            { label: "Avg Time to Complete", value: `${teamKPIs.avgTimeToCompletion}h` },
            { label: "Avg Overdue Rate", value: `${teamKPIs.avgOverdueRate}%` },
            { label: "Avg Conversion Rate", value: `${teamKPIs.avgConversionRate}%` },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
