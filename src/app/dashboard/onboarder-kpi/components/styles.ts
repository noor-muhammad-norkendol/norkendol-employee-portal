import type React from "react";

export const cardStyle: React.CSSProperties = {
  background: "var(--bg-surface)", borderRadius: 10, padding: "18px 22px",
  border: "1px solid var(--border-color)",
};
export const inputStyle: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border-color)",
  color: "var(--text-primary)", borderRadius: 8, padding: "8px 12px",
  fontSize: 13, width: "100%", outline: "none",
};
export const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "var(--text-secondary)",
  display: "block", marginBottom: 4,
};
export const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };
export const btnPrimary: React.CSSProperties = {
  background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6,
  padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
export const btnOutline: React.CSSProperties = {
  background: "transparent", color: "var(--text-primary)",
  border: "1px solid var(--border-color)", borderRadius: 6,
  padding: "6px 12px", fontSize: 12, cursor: "pointer",
};
export const thStyle: React.CSSProperties = {
  padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
  textAlign: "left", borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap",
};
export const tdStyle: React.CSSProperties = {
  padding: "8px 12px", fontSize: 13, color: "var(--text-primary)",
  borderBottom: "1px solid var(--border-color)",
};

export const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  new: { bg: "rgba(96,165,250,0.15)", color: "#60a5fa" },
  step_2: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
  step_3: { bg: "rgba(251,146,60,0.15)", color: "#fb923c" },
  final_step: { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
  on_hold: { bg: "rgba(148,163,184,0.15)", color: "#94a3b8" },
  completed: { bg: "rgba(74,222,128,0.15)", color: "#4ade80" },
  erroneous: { bg: "rgba(239,68,68,0.1)", color: "#f87171" },
  revised: { bg: "rgba(45,212,191,0.15)", color: "#2dd4bf" },
  abandoned: { bg: "rgba(148,163,184,0.1)", color: "#64748b" },
};

export const HOUR_MS = 3_600_000;
