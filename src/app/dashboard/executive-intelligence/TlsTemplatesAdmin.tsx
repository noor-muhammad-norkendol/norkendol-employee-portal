"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { cardStyle, inputStyle, labelStyle, btnPrimary, btnOutline, selectStyle, overlayStyle } from "@/lib/styles";

/* ── Types ─────────────────────────────────────────── */

type Phase = "phase_1" | "phase_2";
type Domain = "contractor" | "insurance" | "coastal" | "complete";

interface TlsTemplate {
  id: string;
  org_id: string;
  phase: Phase;
  domain: Domain;
  firm_id: string | null;
  carrier_name: string | null;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface TlsTemplateStep {
  id: string;
  template_id: string;
  step_order: number;
  description: string;
}

interface FirmLite {
  id: string;
  name: string;
}

const DOMAIN_META: Record<Domain, { label: string; description: string; color: string }> = {
  contractor: { label: "Contractor", description: "Per-firm intake (varies — Linear, Rose, etc.)", color: "#4ade80" },
  insurance:  { label: "Insurance Company", description: "Carrier requests + follow-up rhythm",     color: "#60a5fa" },
  coastal:    { label: "Coastal Requirements", description: "Internal CCS steps (mortgage, etc.)",  color: "#fbbf24" },
  complete:   { label: "Complete", description: "Closing action — email + mark done",                color: "#a78bfa" },
};

/* ── Component ─────────────────────────────────────── */

export default function TlsTemplatesAdmin() {
  const [supabase] = useState(() => createClient());
  const [orgId, setOrgId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("phase_1");
  const [templates, setTemplates] = useState<TlsTemplate[]>([]);
  const [stepsByTemplate, setStepsByTemplate] = useState<Record<string, TlsTemplateStep[]>>({});
  const [firms, setFirms] = useState<FirmLite[]>([]);
  const [loading, setLoading] = useState(false);

  // Editor modal state
  const [editing, setEditing] = useState<TlsTemplate | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDomain, setEditorDomain] = useState<Domain>("contractor");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftFirmId, setDraftFirmId] = useState<string>("");
  const [draftCarrier, setDraftCarrier] = useState<string>("");
  const [draftStepsText, setDraftStepsText] = useState("");
  const [saving, setSaving] = useState(false);

  // Load org + firms once
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("users").select("org_id").eq("id", user.id).single().then(({ data }) => {
        if (data) setOrgId((data as { org_id: string }).org_id);
      });
    });
  }, [supabase]);

  useEffect(() => {
    if (!orgId) return;
    supabase.from("firms")
      .select("id, name")
      .eq("org_id", orgId)
      .order("name", { ascending: true })
      .then(({ data }) => { if (data) setFirms(data as FirmLite[]); });
  }, [supabase, orgId]);

  // Load templates + steps for the active phase
  const loadTemplates = useMemo(() => async () => {
    if (!orgId) return;
    setLoading(true);
    const { data: tpls, error: e1 } = await supabase
      .from("tls_phase_templates")
      .select("*")
      .eq("org_id", orgId)
      .eq("phase", phase)
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });
    if (e1) { console.error("[TLS templates] load failed:", e1); setLoading(false); return; }
    const list = (tpls || []) as TlsTemplate[];
    setTemplates(list);

    if (list.length === 0) { setStepsByTemplate({}); setLoading(false); return; }
    const ids = list.map((t) => t.id);
    const { data: steps, error: e2 } = await supabase
      .from("tls_phase_template_steps")
      .select("*")
      .in("template_id", ids)
      .order("step_order", { ascending: true });
    if (e2) { console.error("[TLS template steps] load failed:", e2); setLoading(false); return; }
    const grouped: Record<string, TlsTemplateStep[]> = {};
    for (const s of (steps || []) as TlsTemplateStep[]) {
      (grouped[s.template_id] = grouped[s.template_id] || []).push(s);
    }
    setStepsByTemplate(grouped);
    setLoading(false);
  }, [supabase, orgId, phase]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // ── Editor open / save / delete ──

  function openNewTemplate(domain: Domain) {
    setEditing(null);
    setEditorDomain(domain);
    setDraftTitle("");
    setDraftFirmId("");
    setDraftCarrier("");
    setDraftStepsText("");
    setEditorOpen(true);
  }

  function openEditTemplate(t: TlsTemplate) {
    setEditing(t);
    setEditorDomain(t.domain);
    setDraftTitle(t.title);
    setDraftFirmId(t.firm_id || "");
    setDraftCarrier(t.carrier_name || "");
    const existingSteps = stepsByTemplate[t.id] || [];
    setDraftStepsText(existingSteps.map((s) => s.description).join("\n"));
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditing(null);
  }

  async function saveTemplate() {
    if (!orgId || !draftTitle.trim()) return;
    setSaving(true);
    try {
      // 1. Upsert the template row
      let templateId = editing?.id;
      if (editing) {
        const { error } = await supabase
          .from("tls_phase_templates")
          .update({
            title: draftTitle.trim(),
            firm_id: editorDomain === "contractor" ? (draftFirmId || null) : null,
            carrier_name: editorDomain === "insurance" ? (draftCarrier.trim() || null) : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("tls_phase_templates")
          .insert({
            org_id: orgId,
            phase,
            domain: editorDomain,
            firm_id: editorDomain === "contractor" ? (draftFirmId || null) : null,
            carrier_name: editorDomain === "insurance" ? (draftCarrier.trim() || null) : null,
            title: draftTitle.trim(),
          })
          .select("id")
          .single();
        if (error) throw error;
        templateId = (data as { id: string }).id;
      }

      // 2. Replace steps wholesale (simpler than diffing for now)
      if (templateId) {
        await supabase.from("tls_phase_template_steps").delete().eq("template_id", templateId);
        const stepLines = draftStepsText.split("\n").map((s) => s.trim()).filter(Boolean);
        if (stepLines.length > 0) {
          const rows = stepLines.map((description, i) => ({
            template_id: templateId,
            step_order: i + 1,
            description,
          }));
          const { error } = await supabase.from("tls_phase_template_steps").insert(rows);
          if (error) throw error;
        }
      }

      closeEditor();
      await loadTemplates();
    } catch (e) {
      console.error("[TLS template save] failed:", e);
      alert("Save failed — check console for details.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template? Its steps will be removed too.")) return;
    const { error } = await supabase.from("tls_phase_templates").delete().eq("id", id);
    if (error) { alert(`Delete failed: ${error.message}`); return; }
    loadTemplates();
  }

  // ── Render ─────────────────────────────────────────

  const byDomain = useMemo(() => {
    const map: Record<Domain, TlsTemplate[]> = { contractor: [], insurance: [], coastal: [], complete: [] };
    for (const t of templates) map[t.domain].push(t);
    return map;
  }, [templates]);

  function firmName(firmId: string | null): string {
    if (!firmId) return "—";
    return firms.find((f) => f.id === firmId)?.name || "(deleted firm)";
  }

  const phaseTabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
    border: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    background: "transparent",
    color: active ? "var(--accent)" : "var(--text-muted)",
  });

  return (
    <div>
      {/* Phase sub-tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-color)", marginBottom: 20 }}>
        <button style={phaseTabStyle(phase === "phase_1")} onClick={() => setPhase("phase_1")}>Phase 1</button>
        <button style={phaseTabStyle(phase === "phase_2")} onClick={() => setPhase("phase_2")}>Phase 2</button>
      </div>

      {loading && <p style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading…</p>}

      {/* Domain sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {(Object.keys(DOMAIN_META) as Domain[]).map((domain) => {
          const meta = DOMAIN_META[domain];
          const list = byDomain[domain];
          return (
            <div key={domain} style={{ ...cardStyle, padding: "18px 20px", borderTop: `3px solid ${meta.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, color: meta.color, fontWeight: 700 }}>{meta.label}</h3>
                  <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "var(--text-muted)" }}>{meta.description}</p>
                </div>
                <button style={btnPrimary} onClick={() => openNewTemplate(domain)}>+ Add Template</button>
              </div>

              {list.length === 0 ? (
                <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                  No templates yet for this section.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {list.map((t) => {
                    const stepCount = (stepsByTemplate[t.id] || []).length;
                    return (
                      <div key={t.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 12px", background: "var(--bg-page)", borderRadius: 6,
                        border: "1px solid var(--border-color)",
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t.title}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            {domain === "contractor" && <>Firm: {firmName(t.firm_id)} · </>}
                            {domain === "insurance" && t.carrier_name && <>Carrier: {t.carrier_name} · </>}
                            {stepCount} step{stepCount === 1 ? "" : "s"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={btnOutline} onClick={() => openEditTemplate(t)}>Edit</button>
                          <button
                            style={{ ...btnOutline, color: "#ef4444", borderColor: "#ef444466" }}
                            onClick={() => deleteTemplate(t.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Editor modal */}
      {editorOpen && (
        <div style={overlayStyle} onClick={closeEditor}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              width: "100%",
              maxWidth: 640,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-color)" }}>
              <h3 style={{ margin: 0, fontSize: 15, color: "var(--text-primary)" }}>
                {editing ? "Edit Template" : "Add Template"} — {DOMAIN_META[editorDomain].label} ({phase === "phase_1" ? "Phase 1" : "Phase 2"})
              </h3>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input
                  style={inputStyle}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder={editorDomain === "contractor" ? "e.g. Linear Roofing Intake" : "e.g. Standard Carrier Request"}
                />
              </div>

              {editorDomain === "contractor" && (
                <div>
                  <label style={labelStyle}>Firm (TPN)</label>
                  <select style={selectStyle} value={draftFirmId} onChange={(e) => setDraftFirmId(e.target.value)}>
                    <option value="">— None / Homeowner Direct —</option>
                    {firms.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                    Pick a contractor firm. Leave blank for the &quot;Homeowner Direct&quot; default opening.
                  </p>
                </div>
              )}

              {editorDomain === "insurance" && (
                <div>
                  <label style={labelStyle}>Carrier (optional)</label>
                  <input
                    style={inputStyle}
                    value={draftCarrier}
                    onChange={(e) => setDraftCarrier(e.target.value)}
                    placeholder="e.g. State Farm — leave blank for universal"
                  />
                </div>
              )}

              <div>
                <label style={labelStyle}>Steps — one per line, in order</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 200, resize: "vertical", fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}
                  value={draftStepsText}
                  onChange={(e) => setDraftStepsText(e.target.value)}
                  placeholder={"Log into AccuLynx using the partner credentials.\nDownload all photos to the claim folder.\nPull the EagleView report.\nNotify the assigned TL via email."}
                />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Each line is one step the TL ticks off during the review. Reordering is just rearranging the lines.
                </p>
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={btnOutline} onClick={closeEditor} disabled={saving}>Cancel</button>
              <button style={btnPrimary} onClick={saveTemplate} disabled={saving || !draftTitle.trim()}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
