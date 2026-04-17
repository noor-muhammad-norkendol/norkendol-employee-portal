"use client";

import React, { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

const SPECIALTIES = [
  "Attorney", "Appraiser", "Engineer", "HVAC", "Plumber", "Electrician",
  "Roofer", "Restoration", "Drywall", "General Contractor", "Other",
];
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const inputStyle: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border-color)",
  color: "var(--text-primary)", borderRadius: 8, padding: "8px 12px",
  fontSize: 13, width: "100%", outline: "none",
};

export interface AddExternalUserModalProps {
  supabase: SupabaseClient;
  orgId: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
  prefill?: {
    name?: string;
    email?: string;
    phone?: string;
    specialty?: string;
    company_name?: string;
    firm_id?: string;
    firm_name?: string;
    states?: string[];
  };
}

export default function AddExternalUserModal({ supabase, orgId, userId, onClose, onSaved, prefill }: AddExternalUserModalProps) {
  const [form, setForm] = useState({
    name: prefill?.name || "",
    email: prefill?.email || "",
    phone: prefill?.phone || "",
    specialty: prefill?.specialty || "General Contractor",
    specialty_other: "",
    states: prefill?.states || [],
    company_name: prefill?.company_name || prefill?.firm_name || "",
    firm_id: prefill?.firm_id || "",
    region: "",
    market: "",
  });
  const [saving, setSaving] = useState(false);
  const [showStateDrop, setShowStateDrop] = useState(false);

  const toggleState = (s: string) =>
    setForm((prev) => ({
      ...prev,
      states: prev.states.includes(s) ? prev.states.filter((x) => x !== s) : [...prev.states, s],
    }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.specialty) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      specialty: form.specialty,
      specialty_other: form.specialty === "Other" ? form.specialty_other.trim() || null : null,
      states: form.states.length > 0 ? form.states : null,
      company_name: form.firm_id ? null : (form.company_name.trim() || null),
      firm_id: form.firm_id || null,
      region: form.region.trim() || null,
      market: form.market.trim() || null,
      org_id: orgId,
      created_by: userId,
      status: "pending",
    };
    await supabase.from("external_contacts").insert(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 520, border: "1px solid var(--border-color)", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Add External User</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
        </div>

        {/* Firm link info */}
        {form.firm_id && prefill?.firm_name && (
          <div style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 8, padding: "8px 12px", marginBottom: 16, fontSize: 12, color: "#60a5fa" }}>
            Linking to firm: <strong>{prefill.firm_name}</strong>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Name *</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name..." />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Email</label>
              <input style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Phone</label>
              <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Specialty *</label>
            <select style={{ ...inputStyle, cursor: "pointer" }} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })}>
              <option value="">Select specialty...</option>
              {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {form.specialty === "Other" && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Describe specialty</label>
              <input style={inputStyle} value={form.specialty_other} onChange={(e) => setForm({ ...form, specialty_other: e.target.value })} placeholder="What do they do?" />
            </div>
          )}
          {!form.firm_id && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Company Name</label>
              <input style={inputStyle} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Company or firm name..." />
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>States They Cover</label>
            <button onClick={() => setShowStateDrop(!showStateDrop)} style={{ ...inputStyle, cursor: "pointer", textAlign: "left" }}>
              {form.states.length > 0 ? form.states.join(", ") : "Select states..."}
            </button>
            {showStateDrop && (
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: 8, padding: 8, marginTop: 4, maxHeight: 180, overflow: "auto" }}>
                {form.states.length > 0 && (
                  <button onClick={() => setForm({ ...form, states: [] })} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 11, cursor: "pointer", marginBottom: 4 }}>Clear all</button>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4 }}>
                  {US_STATES.map((s) => (
                    <button key={s} onClick={() => toggleState(s)} style={{
                      background: form.states.includes(s) ? "var(--accent)" : "var(--bg-page)",
                      color: form.states.includes(s) ? "#000" : "var(--text-secondary)",
                      border: "none", borderRadius: 4, padding: "4px", fontSize: 10, fontWeight: 600, cursor: "pointer",
                    }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Region</label>
              <input style={inputStyle} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="e.g. Southeast, Region 3..." />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Market</label>
              <input style={inputStyle} value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value })} placeholder="e.g. Florida, DFW, Austin..." />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "none", padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.specialty} style={{ background: "var(--accent)", color: "#000", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving || !form.name.trim() || !form.specialty ? 0.5 : 1 }}>
              {saving ? "Saving..." : "Add User"}
            </button>
          </div>

          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0", textAlign: "center" }}>
            Submitted for approval — a super admin will review this contact.
          </p>
        </div>
      </div>
    </div>
  );
}
