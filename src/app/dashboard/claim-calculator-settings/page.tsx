"use client";

import { useState, useEffect } from "react";
import { inputStyle, labelStyle, btnPrimary, btnOutline, cardStyle as baseCardStyle } from "@/lib/styles";

/* ── styles ─────────────────────────────────────────── */

const cardStyle: React.CSSProperties = {
  ...baseCardStyle,
  marginBottom: 16,
};

const btnDanger: React.CSSProperties = {
  background: "#4a1a1a",
  color: "#ef4444",
  border: "1px solid #ef444444",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12,
  cursor: "pointer",
};

/* ── types ──────────────────────────────────────────── */

interface ReleaseType {
  id: string;
  name: string;
  opening_statement: string;
  is_default: boolean;
}

const STORAGE_KEY = "claimCalc_releaseTypes";

const DEFAULT_RELEASE_TYPES: ReleaseType[] = [
  { id: "proposed", name: "Proposed Release", opening_statement: "", is_default: true },
  { id: "litigated", name: "Litigated Release", opening_statement: "", is_default: true },
  { id: "mediation", name: "Mediation Release", opening_statement: "", is_default: true },
  { id: "appraisal", name: "Appraisal Release", opening_statement: "", is_default: true },
  { id: "standard", name: "Standard Release", opening_statement: "", is_default: true },
];

/* ── page ───────────────────────────────────────────── */

export default function ClaimCalculatorSettingsPage() {
  const [releaseTypes, setReleaseTypes] = useState<ReleaseType[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setReleaseTypes(JSON.parse(stored));
      } else {
        setReleaseTypes(DEFAULT_RELEASE_TYPES);
      }
    } catch {
      setReleaseTypes(DEFAULT_RELEASE_TYPES);
    }
  }, []);

  // Update a field
  const updateField = (id: string, field: "name" | "opening_statement", value: string) => {
    setReleaseTypes((prev) =>
      prev.map((rt) => (rt.id === id ? { ...rt, [field]: value } : rt))
    );
    setDirty(true);
    setSaved(false);
  };

  // Save all
  const saveAll = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(releaseTypes));
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Add custom
  const addCustom = () => {
    const newType: ReleaseType = {
      id: `custom-${Date.now()}`,
      name: "Custom Release Type",
      opening_statement: "",
      is_default: false,
    };
    setReleaseTypes((prev) => [...prev, newType]);
    setDirty(true);
  };

  // Delete custom
  const deleteType = (id: string) => {
    if (!confirm("Delete this release type?")) return;
    setReleaseTypes((prev) => prev.filter((rt) => rt.id !== id));
    setDirty(true);
  };

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Claim Calculator Settings
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Manage release type templates and opening statements for claim breakdowns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button style={btnOutline} onClick={addCustom}>
            + Add Release Type
          </button>
          <button
            style={{ ...btnPrimary, opacity: dirty ? 1 : 0.5 }}
            onClick={saveAll}
            disabled={!dirty}
          >
            {saved ? "Saved!" : "Save All Changes"}
          </button>
        </div>
      </div>

      {releaseTypes.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
          <p style={{ color: "var(--text-muted)" }}>No release types found. Click "+ Add Release Type" to create one.</p>
        </div>
      ) : (
        releaseTypes.map((rt) => (
          <div key={rt.id} style={cardStyle}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1 mr-4">
                <label style={labelStyle}>Release Type Name</label>
                <input
                  style={inputStyle}
                  value={rt.name}
                  onChange={(e) => updateField(rt.id, "name", e.target.value)}
                />
              </div>
              {!rt.is_default && (
                <button style={btnDanger} onClick={() => deleteType(rt.id)}>
                  Delete
                </button>
              )}
              {rt.is_default && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: "#1e3a5f", color: "#60a5fa" }}
                >
                  Default
                </span>
              )}
            </div>
            <div>
              <label style={labelStyle}>Opening Statement / Expectations</label>
              <textarea
                style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
                value={rt.opening_statement}
                onChange={(e) => updateField(rt.id, "opening_statement", e.target.value)}
                placeholder="Enter the paragraph that appears at the top of the claim breakdown for this release type..."
              />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                This text appears on page 1 of the claim breakdown when an adjuster selects "{rt.name}".
              </p>
            </div>
          </div>
        ))
      )}

      {dirty && (
        <div className="flex justify-center mt-4">
          <button style={btnPrimary} onClick={saveAll}>
            Save All Changes
          </button>
        </div>
      )}
    </div>
  );
}
