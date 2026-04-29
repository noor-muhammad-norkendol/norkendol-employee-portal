"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { TEMPLATE_STAGES as STAGES, TEMPLATE_CONTACTS as CONTACTS } from "@/types/onboarder-kpi";
import { cardStyle, inputStyle } from "@/lib/styles";
import KPIDataTab from "./KPIDataTab";
import ClaimCalculatorSettings from "@/app/dashboard/claim-calculator-settings/page";
import TlsTemplatesAdmin from "./TlsTemplatesAdmin";

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
  const [subTab, setSubTab] = useState<AdminSubTab>("data");

  const subTabStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: "none", borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    background: "transparent", color: active ? "var(--accent)" : "var(--text-muted)",
  });

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-color)", marginBottom: 20 }}>
        <button style={subTabStyle(subTab === "data")} onClick={() => setSubTab("data")}>Data</button>
        <button style={subTabStyle(subTab === "templates")} onClick={() => setSubTab("templates")}>Templates</button>
      </div>

      {subTab === "templates" && <TemplatesLanding />}
      {subTab === "data" && <KPIDataTab />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* ── Templates Landing — Settlement-Tracker-style pad grid ── */
/* ════════════════════════════════════════════════════════════ */

type SpokeKey =
  | "onboarder_kpi" | "estimator_kpi" | "claim_health"
  | "claim_calculator" | "team_lead_support" | "settlement_tracker";

type SettlementTrack = "pa_settlements" | "mediation" | "appraisal" | "litigation";

interface SpokePad {
  key: SpokeKey;
  title: string;
  description: string;
  color: string;
  built: boolean; // true = has real templates wired, false = placeholder
}

const SPOKE_PADS: SpokePad[] = [
  { key: "onboarder_kpi",     title: "Onboarder KPI",       description: "Email & text scripts per phase × contact target", color: "#4ade80", built: true },
  { key: "estimator_kpi",     title: "Estimator KPI",       description: "Templates coming soon",                            color: "#60a5fa", built: false },
  { key: "claim_health",      title: "Claim Health",        description: "Templates coming soon",                            color: "#fbbf24", built: false },
  { key: "claim_calculator",  title: "Claim Calculator",    description: "Release type templates & opening statements",      color: "#a78bfa", built: true },
  { key: "team_lead_support", title: "Team Lead Support",   description: "Phase 1 / 2 procedural templates per contractor",  color: "#22d3ee", built: true },
  { key: "settlement_tracker",title: "Settlement Tracker",  description: "Templates per dispute resolution track",           color: "#ef4444", built: false },
];

interface SettlementSubPad {
  key: SettlementTrack;
  title: string;
  description: string;
  color: string;
}

const SETTLEMENT_SUB_PADS: SettlementSubPad[] = [
  { key: "pa_settlements", title: "PA Settlements",       description: "Public adjuster direct settlement templates",  color: "#4ade80" },
  { key: "mediation",      title: "Mediation / Arbitration", description: "ADR proceeding templates",                  color: "#a78bfa" },
  { key: "appraisal",      title: "Appraisal",            description: "Appraisal dispute templates",                  color: "#fbbf24" },
  { key: "litigation",     title: "Litigation",           description: "Attorney-managed legal dispute templates",     color: "#ef4444" },
];

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

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
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
      ← {label}
    </button>
  );
}

function ComingSoonPlaceholder({ title }: { title: string }) {
  return (
    <div style={{ ...cardStyle, padding: "32px 28px", textAlign: "center" }}>
      <h3 style={{ margin: "0 0 8px 0", fontSize: 16, color: "var(--text-primary)" }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Coming soon.</p>
    </div>
  );
}

function TemplatesLanding() {
  const [activeSpoke, setActiveSpoke] = useState<SpokeKey | null>(null);
  const [activeTrack, setActiveTrack] = useState<SettlementTrack | null>(null);

  // ── Inside Onboarder pad: real templates ──
  if (activeSpoke === "onboarder_kpi") {
    return (
      <div>
        <BackButton label="Back to Templates" onClick={() => setActiveSpoke(null)} />
        <OnboardingTemplatesAdmin />
      </div>
    );
  }

  // ── Inside Claim Calculator pad: release type templates ──
  // (Was previously a top-level Super Admin sidebar tab; relocated here so
  // every spoke's settings live under its own Templates pad.)
  if (activeSpoke === "claim_calculator") {
    return (
      <div>
        <BackButton label="Back to Templates" onClick={() => setActiveSpoke(null)} />
        <ClaimCalculatorSettings />
      </div>
    );
  }

  // ── Inside Team Lead Support pad: phase-aware procedural templates ──
  if (activeSpoke === "team_lead_support") {
    return (
      <div>
        <BackButton label="Back to Templates" onClick={() => setActiveSpoke(null)} />
        <TlsTemplatesAdmin />
      </div>
    );
  }

  // ── Inside Settlement Tracker pad: 4 sub-pads ──
  if (activeSpoke === "settlement_tracker") {
    if (activeTrack) {
      const track = SETTLEMENT_SUB_PADS.find((t) => t.key === activeTrack);
      return (
        <div>
          <BackButton label="Back to Settlement Tracker" onClick={() => setActiveTrack(null)} />
          <ComingSoonPlaceholder title={`${track?.title ?? "Track"} Templates`} />
        </div>
      );
    }
    return (
      <div>
        <BackButton label="Back to Templates" onClick={() => setActiveSpoke(null)} />
        <h2 style={{ margin: "0 0 4px 0", fontSize: 18, color: "var(--text-primary)" }}>Settlement Tracker Templates</h2>
        <p style={{ margin: "0 0 20px 0", fontSize: 13, color: "var(--text-muted)" }}>Pick a dispute resolution track.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {SETTLEMENT_SUB_PADS.map((p) => (
            <PadCard
              key={p.key}
              title={p.title}
              description={p.description}
              color={p.color}
              dim
              onClick={() => setActiveTrack(p.key)}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Inside any other (placeholder) spoke pad ──
  if (activeSpoke) {
    const pad = SPOKE_PADS.find((p) => p.key === activeSpoke);
    return (
      <div>
        <BackButton label="Back to Templates" onClick={() => setActiveSpoke(null)} />
        <ComingSoonPlaceholder title={`${pad?.title ?? "Spoke"} Templates`} />
      </div>
    );
  }

  // ── Root pad grid ──
  return (
    <div>
      <h2 style={{ margin: "0 0 4px 0", fontSize: 18, color: "var(--text-primary)" }}>Templates</h2>
      <p style={{ margin: "0 0 20px 0", fontSize: 13, color: "var(--text-muted)" }}>Pick a spoke to manage its templates and settings.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {SPOKE_PADS.map((p) => (
          <PadCard
            key={p.key}
            title={p.title}
            description={p.description}
            color={p.color}
            dim={!p.built}
            onClick={() => { setActiveSpoke(p.key); setActiveTrack(null); }}
          />
        ))}
      </div>
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
