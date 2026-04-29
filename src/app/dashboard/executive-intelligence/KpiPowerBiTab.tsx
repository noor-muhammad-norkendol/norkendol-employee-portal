"use client";

import React, { useState } from "react";
import { cardStyle, btnOutline } from "@/lib/styles";

/* ── Spoke pad config ──────────────────────────────────── */

type SpokeKey =
  | "onboarder_kpi" | "estimator_kpi" | "claim_health"
  | "claim_calculator" | "team_lead_support" | "settlement_tracker";

interface SpokePad {
  key: SpokeKey;
  title: string;
  description: string;
  color: string;
  built: boolean; // true = source view exists and pad is connectable
}

const SPOKE_PADS: SpokePad[] = [
  { key: "onboarder_kpi",     title: "Onboarder KPI",       description: "Intake activity, time-in-phase, abandonment trends",  color: "#4ade80", built: true },
  { key: "estimator_kpi",     title: "Estimator KPI",       description: "Coming soon",                                          color: "#60a5fa", built: false },
  { key: "claim_health",      title: "Claim Health",        description: "Coming soon",                                          color: "#fbbf24", built: false },
  { key: "claim_calculator",  title: "Claim Calculator",    description: "Coming soon",                                          color: "#a78bfa", built: false },
  { key: "team_lead_support", title: "Team Lead Support",   description: "Coming soon",                                          color: "#22d3ee", built: false },
  { key: "settlement_tracker",title: "Settlement Tracker",  description: "Coming soon",                                          color: "#ef4444", built: false },
];

/* ── Per-spoke embed config ────────────────────────────────────────────
 * When a Power BI report is published for a spoke, drop its embed URL into
 * the matching SpokeKey here. Until then the pad shows "Coming soon."
 *
 * Power BI Desktop connection notes (for me, not the user):
 * - onboarder_kpi → source view: public.vw_onboarder_kpi_events
 * - Supabase project: hkscsovtejeedjebytsv (PostgreSQL connector)
 * ───────────────────────────────────────────────────────────────────── */
const SPOKE_EMBED_URL: Partial<Record<SpokeKey, string>> = {
  onboarder_kpi: "https://app.powerbi.com/reportEmbed?reportId=00bf4c4e-2cf6-46a3-a859-2bae234ab556&autoAuth=true&ctid=fecc843f-6c9e-41a9-8342-58e0b23ee1c9",
};

/* ── Components ────────────────────────────────────────── */

function PadCard({
  title, description, color, onClick, dim = false,
}: { title: string; description: string; color: string; onClick: () => void; dim?: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
        borderTop: `3px solid ${color}`,
        borderRadius: 8,
        padding: "20px 22px",
        cursor: "pointer",
        opacity: dim ? 0.65 : 1,
        transition: "transform 120ms ease, box-shadow 120ms ease",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 16px ${color}33`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
    >
      <h3 style={{ margin: "0 0 6px 0", fontSize: 16, color, fontWeight: 700 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>{description}</p>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "1px solid var(--border-color)",
        color: "var(--text-secondary)",
        padding: "6px 12px",
        borderRadius: 6,
        fontSize: 12,
        cursor: "pointer",
        marginBottom: 16,
      }}
    >
      ← Back to Power BI
    </button>
  );
}

function SpokeView({ spoke }: { spoke: SpokeKey }) {
  const pad = SPOKE_PADS.find((p) => p.key === spoke)!;
  const embedUrl = SPOKE_EMBED_URL[spoke];

  if (embedUrl) {
    return (
      <iframe
        src={embedUrl}
        title={`${pad.title} Power BI`}
        style={{ width: "100%", height: "calc(100vh - 280px)", border: "1px solid var(--border-color)", borderRadius: 8 }}
        allowFullScreen
      />
    );
  }

  return (
    <div style={{ ...cardStyle, padding: "32px 28px", textAlign: "center", borderTop: `3px solid ${pad.color}` }}>
      <h2 style={{ margin: "0 0 8px 0", fontSize: 18, color: pad.color }}>{pad.title}</h2>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Coming soon.</p>
    </div>
  );
}

/* ── Main tab component ────────────────────────────────── */

export default function KpiPowerBiTab() {
  const [activeSpoke, setActiveSpoke] = useState<SpokeKey | null>(null);

  if (activeSpoke) {
    return (
      <div>
        <BackButton onClick={() => setActiveSpoke(null)} />
        <SpokeView spoke={activeSpoke} />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 4px 0", fontSize: 18, color: "var(--text-primary)" }}>Power BI Dashboards</h2>
      <p style={{ margin: "0 0 20px 0", fontSize: 13, color: "var(--text-muted)" }}>
        Pick a spoke to open its analytical layer. Lit pads have a Supabase view ready for Power BI Desktop to connect.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {SPOKE_PADS.map((p) => (
          <PadCard
            key={p.key}
            title={p.title}
            description={p.description}
            color={p.color}
            dim={!p.built}
            onClick={() => setActiveSpoke(p.key)}
          />
        ))}
      </div>
    </div>
  );
}
