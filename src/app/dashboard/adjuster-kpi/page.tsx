"use client";

import { cardStyle } from "@/lib/styles";

export default function AdjusterKPIPage() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
        Adjuster KPI
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
        Spoke after Team Lead Support (Phase 2)
      </p>

      <div style={{ ...cardStyle, padding: "32px 28px" }}>
        <div style={{
          display: "inline-block",
          fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          color: "#fb923c", background: "rgba(251,146,60,0.1)",
          border: "1px solid rgba(251,146,60,0.3)",
          padding: "4px 10px", borderRadius: 6, marginBottom: 16,
          letterSpacing: 0.5,
        }}>
          Coming Soon — Placeholder
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
          Where this fits in the workflow
        </h2>

        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 20 }}>
          <code style={{ background: "var(--bg-page)", padding: "6px 10px", borderRadius: 4, display: "inline-block", fontSize: 12 }}>
            Onboarding → TLS Phase 1 → Scope of Loss → Estimating → TLS Phase 2 → <strong style={{ color: "var(--text-primary)" }}>Adjuster</strong>
          </code>
        </div>

        <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
          What this spoke will track
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
          After a Team Lead approves a claim out of Phase 2 review, the adjuster
          drives the file to negotiation, settlement, or one of the resolution
          tracks (litigation, mediation, appraisal, PA settlement). Adjuster KPI
          captures performance, queue load, and progression at this stage.
          Additional trackable spokes will follow downstream.
        </p>

        <div style={{ background: "var(--bg-page)", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text-secondary)" }}>Status:</strong> spoke build pending. The backing
          Supabase table, RLS policies, and full landing page will be added in a
          dedicated session after Scope of Loss lands. This placeholder exists so
          the navigation chain is visible end-to-end.
        </div>
      </div>
    </div>
  );
}
