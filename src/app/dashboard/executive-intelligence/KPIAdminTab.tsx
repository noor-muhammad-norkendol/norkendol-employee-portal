"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { TEMPLATE_STAGES as STAGES, TEMPLATE_CONTACTS as CONTACTS } from "@/types/onboarder-kpi";
import { cardStyle, inputStyle } from "@/lib/styles";
import KPIDataTab from "./KPIDataTab";

/* ── Types ── */
interface Template {
  id?: string;
  stage: string;
  contact_target: string;
  email_subject: string;
  email_body: string;
  text_message: string;
}

/* ── Styles (KPI Admin specific) ── */
const templateLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block",
  marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5,
};
const sectionLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8,
  paddingBottom: 6, borderBottom: "1px solid var(--border-color)",
};

type AdminSubTab = "templates" | "data";

export default function KPIAdminTab() {
  const [subTab, setSubTab] = useState<AdminSubTab>("templates");

  const subTabStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: "none", borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    background: "transparent", color: active ? "var(--accent)" : "var(--text-muted)",
  });

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-color)", marginBottom: 20 }}>
        <button style={subTabStyle(subTab === "templates")} onClick={() => setSubTab("templates")}>Templates</button>
        <button style={subTabStyle(subTab === "data")} onClick={() => setSubTab("data")}>Data</button>
      </div>

      {subTab === "templates" && <OnboardingTemplatesAdmin />}
      {subTab === "data" && <KPIDataTab />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* ── Onboarding Templates Admin                            ── */
/* ════════════════════════════════════════════════════════════ */

function OnboardingTemplatesAdmin() {
  const [supabase] = useState(() => createClient());
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [expandedStage, setExpandedStage] = useState<string | null>("new");

  // Build a key for the templates map
  function tKey(stage: string, target: string) { return `${stage}::${target}`; }

  // Load templates from DB
  const loadTemplates = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { return; }
    const { data: userData } = await supabase.from("users").select("org_id, full_name").eq("id", user.id).single();
    if (!userData) { return; }
    setOrgId(userData.org_id);
    setUserName(userData.full_name || "");


    const { data, error } = await supabase
      .from("onboarding_email_templates")
      .select("*")
      .eq("org_id", userData.org_id);

    if (error) console.error("Template load error:", error);

    const map: Record<string, Template> = {};
    // Initialize all slots with defaults
    for (const stage of STAGES) {
      for (const contact of CONTACTS) {
        const key = tKey(stage.key, contact.key);
        map[key] = {
          stage: stage.key,
          contact_target: contact.key,
          email_subject: "",
          email_body: "",
          text_message: "",
        };
      }
    }
    // Overlay DB data
    if (data && data.length > 0) {
      for (const row of data as Record<string, string>[]) {
        const key = tKey(row.stage, row.contact_target);
        if (map[key]) {
          map[key] = {
            id: row.id,
            stage: row.stage,
            contact_target: row.contact_target,
            email_subject: row.email_subject || "",
            email_body: row.email_body || "",
            text_message: row.text_message || "",
          };
        }
      }
    }
    setTemplates(map);
  }, [supabase]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  function updateTemplate(stage: string, target: string, field: keyof Template, value: string) {
    const key = tKey(stage, target);
    setTemplates((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
    setDirty(true);
    setSaved(false);
  }

  async function handleSave() {
    if (!orgId) return;
    setSaving(true);
    try {
      // Batch all templates into a single upsert
      const rows = Object.values(templates)
        .filter((t) => t.id || t.email_subject || t.email_body || t.text_message)
        .map((t) => ({
          ...(t.id ? { id: t.id } : {}),
          org_id: orgId,
          stage: t.stage,
          contact_target: t.contact_target,
          channel: "email",
          email_subject: t.email_subject,
          email_body: t.email_body,
          text_message: t.text_message,
          updated_by: userName,
          updated_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        const { error: upsertError } = await supabase
          .from("onboarding_email_templates")
          .upsert(rows, { onConflict: "org_id,stage,contact_target,channel" });
        if (upsertError) throw upsertError;
      }
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Reload to get IDs
      await loadTemplates();
    } catch (err) {
      setSaveError("Save failed. Please try again.");
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Onboarding Email & Text Templates</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            Templates auto-populate when onboarders send emails or texts at each stage. Edit them here.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {saved && <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>Saved!</span>}
          {saveError && <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{saveError}</span>}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            style={{
              background: dirty ? "var(--accent)" : "var(--bg-page)",
              color: dirty ? "#fff" : "var(--text-muted)",
              border: "none", borderRadius: 6, padding: "8px 16px",
              fontSize: 13, fontWeight: 600, cursor: dirty ? "pointer" : "default",
              opacity: dirty ? 1 : 0.5,
            }}
          >
            {saving ? "Saving..." : "Save All Changes"}
          </button>
        </div>
      </div>

      {/* Stage cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {STAGES.map((stage) => {
          const isExpanded = expandedStage === stage.key;
          // Count templates with content
          const filledCount = CONTACTS.filter((c) => {
            const t = templates[tKey(stage.key, c.key)];
            return t && (t.email_subject || t.email_body || t.text_message);
          }).length;

          return (
            <div key={stage.key} style={cardStyle}>
              <button
                onClick={() => setExpandedStage(isExpanded ? null : stage.key)}
                style={{
                  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  color: "var(--text-primary)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14 }}>{isExpanded ? "\u25BC" : "\u25B6"}</span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{stage.label}</span>
                  <span style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 4,
                    background: filledCount > 0 ? "rgba(74,222,128,0.12)" : "rgba(148,163,184,0.1)",
                    color: filledCount > 0 ? "#4ade80" : "var(--text-muted)",
                    fontWeight: 600,
                  }}>
                    {filledCount}/3 templates
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div style={{ marginTop: 16 }}>
                  {CONTACTS.map((contact) => {
                    const t = templates[tKey(stage.key, contact.key)];
                    if (!t) return null;
                    return (
                      <div key={contact.key} style={{ marginBottom: 20 }}>
                        <p style={sectionLabel}>{contact.label}</p>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
                          {/* Email section */}
                          <div>
                            <label style={templateLabelStyle}>Email Subject</label>
                            <input
                              style={inputStyle}
                              value={t.email_subject}
                              onChange={(e) => updateTemplate(stage.key, contact.key, "email_subject", e.target.value)}
                              placeholder={`Subject line for ${contact.label.toLowerCase()} at ${stage.label}...`}
                            />
                            <label style={{ ...templateLabelStyle, marginTop: 8 }}>Email Body</label>
                            <textarea
                              style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                              value={t.email_body}
                              onChange={(e) => updateTemplate(stage.key, contact.key, "email_body", e.target.value)}
                              placeholder={`Email template for ${contact.label.toLowerCase()}...\n\nUse {client_name}, {file_number}, {contractor_name}, {pa_name} as placeholders.`}
                            />
                          </div>

                          {/* Text section */}
                          <div>
                            <label style={templateLabelStyle}>Text Message</label>
                            <textarea
                              style={{ ...inputStyle, minHeight: 140, resize: "vertical" }}
                              value={t.text_message}
                              onChange={(e) => updateTemplate(stage.key, contact.key, "text_message", e.target.value)}
                              placeholder={`Text template for ${contact.label.toLowerCase()}...\n\nUse {client_name}, {file_number} as placeholders.`}
                            />
                            <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                              This text auto-populates when an onboarder sends a message to the {contact.label.toLowerCase()} at the {stage.label} stage.
                            </p>
                          </div>
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
    </div>
  );
}
