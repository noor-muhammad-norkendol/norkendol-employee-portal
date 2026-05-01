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

const STOPLIGHT_TOKEN: Record<StateStatus, string> = {
  green:  "--green",
  yellow: "--amber",
  red:    "--red",
  gray:   "--text-faint",
};
function stoplightColors(status: StateStatus) {
  const tokenVar = `var(${STOPLIGHT_TOKEN[status]})`;
  return {
    dot: tokenVar,
    bg: `color-mix(in srgb, ${tokenVar} 14%, var(--pad))`,
    text: tokenVar,
    glow: `color-mix(in srgb, ${tokenVar} 60%, transparent)`,
    ring: `color-mix(in srgb, ${tokenVar} 28%, transparent)`,
  };
}

/* ── Silo definitions ─────────────────────────────────── */

interface Silo {
  key: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  questions: string[];
}

interface SiloDef {
  key: string;
  title: string;
  token: string;
  description: string;
  questions: string[];
  icon: React.ReactNode;
}

/* simple SVG icons (no emoji per spec) */
const ICON = {
  pa_laws: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21h18M5 21V10M19 21V10M3 10l9-6 9 6M9 21v-7M15 21v-7M9 14h6" />
    </svg>
  ),
  insurance: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />
    </svg>
  ),
  construction: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 21h16M5 21V8h14v13M9 8V5a3 3 0 0 1 6 0v3M3 13h18" />
    </svg>
  ),
  legal: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v18M5 21h14M5 8l-2 5a4 4 0 0 0 8 0l-2-5M19 8l-2 5a4 4 0 0 0 8 0l-2-5M5 8l7-3 7 3" />
    </svg>
  ),
};

const SILOS: SiloDef[] = [
  {
    key: "pa_laws",
    title: "Public Adjusting Laws",
    icon: ICON.pa_laws,
    token: "--info",
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
    icon: ICON.insurance,
    token: "--green",
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
    icon: ICON.construction,
    token: "--orange",
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
    icon: ICON.legal,
    token: "--violet",
    description: "Fee shifting opportunities, bad faith elements, attorney fee recovery, and litigation leverage strategies.",
    questions: [
      "Are attorney fees recoverable?",
      "What triggers fee shifting?",
      "How do I prove bad faith?",
      "What litigation leverage exists?",
    ],
  },
];

type Silo = SiloDef;

/* ── Styles (spec tokens) ────────────────────────────────────────────── */

const cardStyle: React.CSSProperties = {
  background: "var(--pad)",
  borderRadius: "var(--radius-card)",
  padding: "20px 22px",
  borderWidth: "1.5px",
  borderStyle: "solid",
  borderColor: "var(--border)",
  boxShadow: "var(--card-shadow)",
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
          <div className="text-lg font-semibold mb-2" style={{ color: "var(--text-dim)" }}>State Not Found</div>
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>No data for state code "{code}".</p>
        </div>
      </div>
    );
  }

  const sl = stoplightColors(state.status);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push("/dashboard/compliance")}
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: "var(--accent)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          fontFamily: "var(--font-display)",
        }}
      >
        ← Back to State Compliance
      </button>

      {/* State header */}
      <div className="flex items-center gap-5">
        <div
          style={{
            width: 64, height: 64, borderRadius: "var(--radius-card)",
            background: sl.bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 800, color: sl.text,
            borderWidth: "1.5px",
            borderStyle: "solid",
            borderColor: sl.ring,
            boxShadow: `0 0 18px ${sl.ring}`,
            fontFamily: "var(--font-display)",
            textShadow: `0 0 12px ${sl.glow}`,
          }}
        >
          {state.code}
        </div>
        <div>
          <h1
            className="page-title"
            style={{
              fontSize: "2.5rem",
              lineHeight: 1,
              fontFamily: "var(--font-display)",
              color: "var(--text)",
              fontWeight: 800,
              margin: 0,
            }}
          >
            <span style={{ color: "var(--accent)", textShadow: "var(--accent-text-shadow)" }}>{state.name}</span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: sl.dot,
                display: "inline-block",
                boxShadow: `0 0 8px ${sl.glow}`,
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: sl.text,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontFamily: "var(--font-ui)",
              }}
            >
              {state.statusLabel}
            </span>
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
        <div className="text-base font-semibold mb-2" style={{ color: "var(--text-dim)" }}>Document Repository</div>
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          State-specific documents, filings, and reference materials will appear here.
        </p>
      </div>
    </div>
  );
}

/* ── Silo Card ─────────────────────────────────────────── */

function SiloCard({ silo, stateName }: { silo: Silo; stateCode: string; stateName: string }) {
  const [hovered, setHovered] = useState(false);
  const tokenVar = `var(${silo.token})`;

  return (
    <div
      className="themed-card"
      style={{
        padding: "20px 22px",
        borderColor: hovered
          ? `color-mix(in srgb, ${tokenVar} 55%, transparent)`
          : "var(--border)",
        boxShadow: hovered
          ? `0 0 24px color-mix(in srgb, ${tokenVar} 22%, transparent), var(--card-shadow)`
          : "var(--card-shadow)",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="themed-card-stripe" aria-hidden />

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 8,
            background: `color-mix(in srgb, ${tokenVar} 14%, var(--pad))`,
            color: tokenVar,
            border: `1px solid color-mix(in srgb, ${tokenVar} 35%, transparent)`,
            filter: `drop-shadow(0 0 6px color-mix(in srgb, ${tokenVar} 50%, transparent))`,
          }}
        >
          {silo.icon}
        </span>
        <div>
          <div
            className="page-title"
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text)",
              fontFamily: "var(--font-display)",
            }}
          >
            {silo.title}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>{stateName}</div>
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 14 }}>
        {silo.description}
      </p>

      {/* Quick questions */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
            marginBottom: 8,
            fontFamily: "var(--font-ui)",
          }}
        >
          Quick Questions
        </div>
        {silo.questions.map((q, i) => (
          <div
            key={i}
            style={{
              fontSize: 12,
              color: tokenVar,
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
          padding: "12px 16px",
          borderRadius: 8,
          borderWidth: "2px",
          borderStyle: "solid",
          borderColor: tokenVar,
          background: hovered
            ? `color-mix(in srgb, ${tokenVar} 18%, var(--bg))`
            : "var(--bg)",
          color: tokenVar,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          cursor: "pointer",
          transition: "all 0.15s",
          fontFamily: "var(--font-display)",
          textShadow: `0 0 8px color-mix(in srgb, ${tokenVar} 60%, transparent)`,
          boxShadow: hovered
            ? `0 0 18px color-mix(in srgb, ${tokenVar} 40%, transparent)`
            : `0 0 12px color-mix(in srgb, ${tokenVar} 22%, transparent)`,
        }}
      >
        Ask {stateName} AI — {silo.title}
      </button>
    </div>
  );
}
