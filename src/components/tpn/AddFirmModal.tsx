"use client";

import React, { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

const ENTITY_TYPES = ["Law Firm", "Corporation", "LLC", "Partnership", "Sole Proprietorship", "Other"];
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

export interface AddFirmModalProps {
  supabase: SupabaseClient;
  orgId: string;
  onClose: () => void;
  onSaved: (firmId: string, firmName: string) => void;
  prefill?: {
    name?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    state?: string;
    states?: string[];
  };
  /** Override the default status. TPN admin uses "active", onboarder flow uses "pending". */
  defaultStatus?: "active" | "pending";
}

export default function AddFirmModal({ supabase, orgId, onClose, onSaved, prefill, defaultStatus = "active" }: AddFirmModalProps) {
  const [form, setForm] = useState({
    name: prefill?.name || "",
    contact_name: prefill?.contact_name || "",
    contact_email: prefill?.contact_email || "",
    contact_phone: prefill?.contact_phone || "",
    states: prefill?.states || (prefill?.state ? [prefill.state.toUpperCase()] : []),
    website: "",
    entity_type: "",
    city: "",
    state: prefill?.state || "",
  });
  const [saving, setSaving] = useState(false);
  const [showStateDrop, setShowStateDrop] = useState(false);

  const toggleState = (s: string) =>
    setForm((prev) => ({
      ...prev,
      states: prev.states.includes(s) ? prev.states.filter((x) => x !== s) : [...prev.states, s],
    }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      states: form.states.length > 0 ? form.states : null,
      website: form.website.trim() || null,
      entity_type: form.entity_type || null,
      city: form.city.trim() || null,
      state: form.state || null,
      org_id: orgId,
      status: defaultStatus,
    };
    const { data: inserted } = await supabase.from("firms").insert(payload).select("id").single();
    setSaving(false);
    if (inserted) {
      onSaved(inserted.id, form.name.trim());
    } else {
      onClose();
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 520, border: "1px solid var(--border-color)", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Add Firm</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Firm Name *</label>
            <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Firm name..." />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Entity Type</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.entity_type} onChange={(e) => setForm({ ...form, entity_type: e.target.value })}>
                <option value="">Select...</option>
                {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>City</label>
              <input style={inputStyle} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City..." />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>State</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                <option value="">Select...</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Contact Name</label>
              <input style={inputStyle} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Primary contact..." />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Contact Email</label>
              <input style={inputStyle} value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="email@firm.com" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Contact Phone</label>
              <input style={inputStyle} value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="(555) 123-4567" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Website</label>
            <input style={inputStyle} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>States Covered</label>
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

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "none", padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} style={{ background: "var(--accent)", color: "#000", border: "none", borderRadius: 6, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving || !form.name.trim() ? 0.5 : 1 }}>
              {saving ? "Saving..." : "Add Firm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
