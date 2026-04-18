// Re-export shared styles; keep onboarder-kpi-specific constants here
export { cardStyle, inputStyle, labelStyle, selectStyle, btnPrimary, btnOutline, thStyle, tdStyle } from "@/lib/styles";

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: "rgba(96,165,250,0.15)", text: "#60a5fa" },
  step_2: { bg: "rgba(251,191,36,0.15)", text: "#fbbf24" },
  step_3: { bg: "rgba(251,146,60,0.15)", text: "#fb923c" },
  final_step: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
  on_hold: { bg: "rgba(148,163,184,0.15)", text: "#94a3b8" },
  completed: { bg: "rgba(74,222,128,0.15)", text: "#4ade80" },
  erroneous: { bg: "rgba(239,68,68,0.1)", text: "#f87171" },
  revised: { bg: "rgba(45,212,191,0.15)", text: "#2dd4bf" },
  abandoned: { bg: "rgba(148,163,184,0.1)", text: "#64748b" },
};

export const HOUR_MS = 3_600_000;
