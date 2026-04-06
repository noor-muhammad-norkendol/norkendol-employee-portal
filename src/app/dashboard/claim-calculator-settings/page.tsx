"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

/* ── styles ─────────────────────────────────────────── */

const cardStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  borderRadius: 10,
  padding: "18px 22px",
  border: "1px solid var(--border-color)",
  marginBottom: 16,
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  width: "100%",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--text-secondary)",
  display: "block",
  marginBottom: 4,
};

const btnPrimary: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnOutline: React.CSSProperties = {
  background: "transparent",
  color: "var(--text-primary)",
  border: "1px solid var(--border-color)",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12,
  cursor: "pointer",
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
  org_id: string;
  name: string;
  opening_statement: string;
  is_default: boolean;
  created_at: string;
}

/* ── page ───────────────────────────────────────────── */

export default function ClaimCalculatorSettingsPage() {
  const supabase = createClient();
  const [orgId, setOrgId] = useState("");
  const [releaseTypes, setReleaseTypes] = useState<ReleaseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Get org
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("users").select("org_id").eq("id", user.id).single()
          .then(({ data }) => { if (data) setOrgId(data.org_id); });
      }
    });
  }, [supabase]);

  // Fetch release types
  const fetchReleaseTypes = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("claim_release_types")
      .select("*")
      .eq("org_id", orgId)
      .order("is_default", { ascending: false })
      .order("name");

    if (error) {
      console.error("Error fetching release types:", error);
      // Table might not exist yet — seed defaults
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        setReleaseTypes([]);
      }
    } else if (data && data.length > 0) {
      setReleaseTypes(data);
    } else {
      // No data — seed defaults
      const defaults = [
        { name: "Proposed Release", opening_statement: "", is_default: true, org_id: orgId },
        { name: "Litigated Release", opening_statement: "", is_default: true, org_id: orgId },
        { name: "Mediation Release", opening_statement: "", is_default: true, org_id: orgId },
        { name: "Appraisal Release", opening_statement: "", is_default: true, org_id: orgId },
        { name: "Standard Release", opening_statement: "", is_default: true, org_id: orgId },
      ];
      const { data: seeded } = await supabase
        .from("claim_release_types")
        .insert(defaults)
        .select();
      if (seeded) setReleaseTypes(seeded);
    }

    setLoading(false);
  }, [orgId, supabase]);

  useEffect(() => {
    fetchReleaseTypes();
  }, [fetchReleaseTypes]);

  // Update a field locally
  const updateField = (id: string, field: "name" | "opening_statement", value: string) => {
    setReleaseTypes((prev) =>
      prev.map((rt) => (rt.id === id ? { ...rt, [field]: value } : rt))
    );
    setDirty(true);
  };

  // Save all changes
  const saveAll = async () => {
    setSaving(true);
    for (const rt of releaseTypes) {
      await supabase
        .from("claim_release_types")
        .update({ name: rt.name, opening_statement: rt.opening_statement })
        .eq("id", rt.id);
    }
    setSaving(false);
    setDirty(false);
  };

  // Add custom release type
  const addCustom = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from("claim_release_types")
      .insert({ name: "Custom Release Type", opening_statement: "", is_default: false, org_id: orgId })
      .select()
      .single();
    if (data) {
      setReleaseTypes((prev) => [...prev, data]);
    }
  };

  // Delete custom release type
  const deleteType = async (id: string) => {
    if (!confirm("Delete this release type?")) return;
    await supabase.from("claim_release_types").delete().eq("id", id);
    setReleaseTypes((prev) => prev.filter((rt) => rt.id !== id));
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
        <div className="flex gap-2">
          <button style={btnOutline} onClick={addCustom}>
            + Add Release Type
          </button>
          <button
            style={{ ...btnPrimary, opacity: dirty ? 1 : 0.5 }}
            onClick={saveAll}
            disabled={saving || !dirty}
          >
            {saving ? "Saving..." : "Save All Changes"}
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      ) : releaseTypes.length === 0 ? (
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
                style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                value={rt.opening_statement}
                onChange={(e) => updateField(rt.id, "opening_statement", e.target.value)}
                placeholder="Enter detailed explanation, expectations, and any relevant information for this release type..."
              />
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                This text appears on page 1 of release documents for {rt.name.toLowerCase()}.
              </p>
            </div>
          </div>
        ))
      )}

      {dirty && (
        <div className="flex justify-center mt-4">
          <button style={btnPrimary} onClick={saveAll} disabled={saving}>
            {saving ? "Saving..." : "Save All Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
