"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

/* ── State data (same source as compliance grid) ──────── */

type StateStatus = "green" | "yellow" | "red" | "gray";

interface StateEntry {
  code: string;
  name: string;
  status: StateStatus;
  statusLabel: string;
}

const STATES: Record<string, StateEntry> = {
  AL: { code: "AL", name: "Alabama", status: "red", statusLabel: "PA Prohibited" },
  AK: { code: "AK", name: "Alaska", status: "gray", statusLabel: "Not Licensed" },
  AZ: { code: "AZ", name: "Arizona", status: "green", statusLabel: "Licensed & Active" },
  AR: { code: "AR", name: "Arkansas", status: "gray", statusLabel: "Not Licensed" },
  CA: { code: "CA", name: "California", status: "green", statusLabel: "Licensed & Active" },
  CO: { code: "CO", name: "Colorado", status: "green", statusLabel: "Licensed & Active" },
  CT: { code: "CT", name: "Connecticut", status: "green", statusLabel: "Licensed & Active" },
  DE: { code: "DE", name: "Delaware", status: "gray", statusLabel: "Not Licensed" },
  FL: { code: "FL", name: "Florida", status: "green", statusLabel: "Licensed & Active" },
  GA: { code: "GA", name: "Georgia", status: "green", statusLabel: "Licensed & Active" },
  HI: { code: "HI", name: "Hawaii", status: "yellow", statusLabel: "Caution — Seek Management" },
  ID: { code: "ID", name: "Idaho", status: "gray", statusLabel: "Not Licensed" },
  IL: { code: "IL", name: "Illinois", status: "green", statusLabel: "Licensed & Active" },
  IN: { code: "IN", name: "Indiana", status: "green", statusLabel: "Licensed & Active" },
  IA: { code: "IA", name: "Iowa", status: "green", statusLabel: "Licensed & Active" },
  KS: { code: "KS", name: "Kansas", status: "green", statusLabel: "Licensed & Active" },
  KY: { code: "KY", name: "Kentucky", status: "green", statusLabel: "Licensed & Active" },
  LA: { code: "LA", name: "Louisiana", status: "green", statusLabel: "Licensed & Active" },
  ME: { code: "ME", name: "Maine", status: "gray", statusLabel: "Not Licensed" },
  MD: { code: "MD", name: "Maryland", status: "green", statusLabel: "Licensed & Active" },
  MA: { code: "MA", name: "Massachusetts", status: "gray", statusLabel: "Not Licensed" },
  MI: { code: "MI", name: "Michigan", status: "green", statusLabel: "Licensed & Active" },
  MN: { code: "MN", name: "Minnesota", status: "green", statusLabel: "Licensed & Active" },
  MS: { code: "MS", name: "Mississippi", status: "green", statusLabel: "Licensed & Active" },
  MO: { code: "MO", name: "Missouri", status: "green", statusLabel: "Licensed & Active" },
  MT: { code: "MT", name: "Montana", status: "gray", statusLabel: "Not Licensed" },
  NE: { code: "NE", name: "Nebraska", status: "green", statusLabel: "Licensed & Active" },
  NV: { code: "NV", name: "Nevada", status: "gray", statusLabel: "Not Licensed" },
  NH: { code: "NH", name: "New Hampshire", status: "gray", statusLabel: "Not Licensed" },
  NJ: { code: "NJ", name: "New Jersey", status: "green", statusLabel: "Licensed & Active" },
  NM: { code: "NM", name: "New Mexico", status: "yellow", statusLabel: "Caution — Seek Management" },
  NY: { code: "NY", name: "New York", status: "gray", statusLabel: "Not Licensed" },
  NC: { code: "NC", name: "North Carolina", status: "green", statusLabel: "Licensed & Active" },
  ND: { code: "ND", name: "North Dakota", status: "gray", statusLabel: "Not Licensed" },
  OH: { code: "OH", name: "Ohio", status: "green", statusLabel: "Licensed & Active" },
  OK: { code: "OK", name: "Oklahoma", status: "green", statusLabel: "Licensed & Active" },
  OR: { code: "OR", name: "Oregon", status: "gray", statusLabel: "Not Licensed" },
  PA: { code: "PA", name: "Pennsylvania", status: "green", statusLabel: "Licensed & Active" },
  RI: { code: "RI", name: "Rhode Island", status: "yellow", statusLabel: "Caution — Seek Management" },
  SC: { code: "SC", name: "South Carolina", status: "green", statusLabel: "Licensed & Active" },
  SD: { code: "SD", name: "South Dakota", status: "gray", statusLabel: "Not Licensed" },
  TN: { code: "TN", name: "Tennessee", status: "green", statusLabel: "Licensed & Active" },
  TX: { code: "TX", name: "Texas", status: "green", statusLabel: "Licensed & Active" },
  UT: { code: "UT", name: "Utah", status: "yellow", statusLabel: "Caution — Seek Management" },
  VT: { code: "VT", name: "Vermont", status: "gray", statusLabel: "Not Licensed" },
  VA: { code: "VA", name: "Virginia", status: "green", statusLabel: "Licensed & Active" },
  WA: { code: "WA", name: "Washington", status: "gray", statusLabel: "Not Licensed" },
  WV: { code: "WV", name: "West Virginia", status: "yellow", statusLabel: "Caution — Seek Management" },
  WI: { code: "WI", name: "Wisconsin", status: "green", statusLabel: "Licensed & Active" },
  WY: { code: "WY", name: "Wyoming", status: "gray", statusLabel: "Not Licensed" },
  VI: { code: "VI", name: "U.S. Virgin Islands", status: "gray", statusLabel: "Not Licensed" },
  PR: { code: "PR", name: "Puerto Rico", status: "gray", statusLabel: "Not Licensed" },
};

const STOPLIGHT_COLORS: Record<StateStatus, { dot: string; bg: string; text: string }> = {
  green:  { dot: "#22c55e", bg: "#0a1f12", text: "#4ade80" },
  yellow: { dot: "#eab308", bg: "#1a1508", text: "#facc15" },
  red:    { dot: "#ef4444", bg: "#1a0a0a", text: "#ef4444" },
  gray:   { dot: "#6b7280", bg: "#1a1a1a", text: "#9ca3af" },
};

/* ── Silo definitions ─────────────────────────────────── */

interface Silo {
  key: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  questions: string[];
}

const SILOS: Silo[] = [
  {
    key: "pa_laws",
    title: "Public Adjusting Laws",
    icon: "🏛️",
    color: "#3b82f6",
    description: "License requirements, fee limitations, contract compliance, and solicitation rules for public adjusters.",
    questions: [
      "What are the licensing requirements?",
      "What are the fee limitations?",
      "Are there solicitation restrictions?",
      "What contract requirements exist?",
    ],
  },
  {
    key: "insurance",
    title: "Insurance Laws",
    icon: "🏢",
    color: "#22c55e",
    description: "Payment deadlines, communication requirements, breach detection, and prompt pay rule violations.",
    questions: [
      "What are the payment deadlines?",
      "How do I detect deadline violations?",
      "What communication is required?",
      "How do prompt pay rules work?",
    ],
  },
  {
    key: "construction",
    title: "Construction Laws",
    icon: "🏗️",
    color: "#f97316",
    description: "Material matching requirements, building code compliance, contractor licensing, and construction defect claims.",
    questions: [
      "What are material matching rules?",
      "Are there building code upgrade requirements?",
      "How do contractor licensing laws help?",
      "What construction defect opportunities exist?",
    ],
  },
  {
    key: "legal",
    title: "Legal Leverage",
    icon: "⚖️",
    color: "#a855f7",
    description: "Fee shifting opportunities, bad faith elements, attorney fee recovery, and litigation leverage strategies.",
    questions: [
      "Are attorney fees recoverable?",
      "What triggers fee shifting?",
      "How do I prove bad faith?",
      "What litigation leverage exists?",
    ],
  },
];

/* ── Styles ────────────────────────────────────────────── */

const cardStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  borderRadius: 10,
  padding: "20px 22px",
  border: "1px solid var(--border-color)",
  position: "relative",
  zIndex: 1,
};

/* ── Page ──────────────────────────────────────────────── */

export default function StateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string || "").toUpperCase();
  const state = STATES[code];

  if (!state) {
    return (
      <div>
        <button
          onClick={() => router.push("/dashboard/compliance")}
          style={{ fontSize: 13, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", marginBottom: 16 }}
        >
          ← Back to State Compliance
        </button>
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 22px" }}>
          <div className="text-lg font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>State Not Found</div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No data for state code "{code}".</p>
        </div>
      </div>
    );
  }

  const sl = STOPLIGHT_COLORS[state.status];

  return (
    <div>
      {/* Back link */}
      <button
        onClick={() => router.push("/dashboard/compliance")}
        style={{ fontSize: 13, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", marginBottom: 20, padding: 0 }}
      >
        ← Back to State Compliance
      </button>

      {/* State header */}
      <div className="flex items-center gap-4 mb-6">
        <div
          style={{
            width: 48, height: 48, borderRadius: 10,
            background: sl.bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: sl.text,
            border: `1px solid ${sl.dot}33`,
          }}
        >
          {state.code}
        </div>
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>{state.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: sl.dot, display: "inline-block" }} />
            <span style={{ fontSize: 13, color: sl.text, fontWeight: 500 }}>{state.statusLabel}</span>
          </div>
        </div>
      </div>

      {/* Knowledge Silos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {SILOS.map((silo) => (
          <SiloCard key={silo.key} silo={silo} stateCode={state.code} stateName={state.name} />
        ))}
      </div>

      {/* Documents section */}
      <div style={{ ...cardStyle, textAlign: "center", padding: "48px 22px" }}>
        <div className="text-base font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Document Repository</div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          State-specific documents, filings, and reference materials will appear here.
        </p>
      </div>
    </div>
  );
}

/* ── Silo Card ─────────────────────────────────────────── */

function SiloCard({ silo, stateCode, stateName }: { silo: Silo; stateCode: string; stateName: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        ...cardStyle,
        borderColor: hovered ? `${silo.color}44` : "var(--border-color)",
        transition: "border-color 0.15s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span style={{ fontSize: 24 }}>{silo.icon}</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{silo.title}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{stateName}</div>
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 14 }}>
        {silo.description}
      </p>

      {/* Quick questions */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Quick Questions</div>
        {silo.questions.map((q, i) => (
          <div
            key={i}
            style={{
              fontSize: 12,
              color: "var(--accent)",
              padding: "4px 0",
              cursor: "pointer",
            }}
          >
            • {q}
          </div>
        ))}
      </div>

      {/* Ask AI button */}
      <button
        style={{
          width: "100%",
          padding: "10px 16px",
          borderRadius: 8,
          border: "none",
          background: silo.color,
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          transition: "opacity 0.15s",
          opacity: hovered ? 1 : 0.85,
        }}
      >
        Ask {stateName} AI — {silo.title}
      </button>
    </div>
  );
}
