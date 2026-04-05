"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const supabase = createClient();

interface Template {
  id: string;
  feature_key: string;
  name: string;
  description: string;
  system_prompt: string;
  version: number;
  created_at: string;
  updated_at: string;
}

interface UsageLog {
  id: string;
  feature_key: string;
  provider: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

interface UsageSummary {
  total_calls: number;
  successful: number;
  failed: number;
  total_input_tokens: number;
  total_output_tokens: number;
  by_feature: Record<string, number>;
  by_model: Record<string, number>;
}

const EMPTY_FORM = { feature_key: "", name: "", description: "", system_prompt: "" };

export default function AIAgentsPage() {
  const [tab, setTab] = useState<"active" | "configure" | "logs">("active");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Expanded view
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/ai-templates", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.templates ?? []);
    }
    setLoading(false);
  }, []);

  const fetchLogs = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/ai-logs", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs ?? []);
      setSummary(data.summary ?? null);
    }
  }, []);

  useEffect(() => { fetchTemplates(); fetchLogs(); }, [fetchTemplates, fetchLogs]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (t: Template) => {
    setEditingId(t.id);
    setForm({ feature_key: t.feature_key, name: t.name, description: t.description, system_prompt: t.system_prompt });
    setShowModal(true);
  };

  const saveTemplate = async () => {
    setSaving(true);
    setSaveMsg("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const method = editingId ? "PUT" : "POST";
    const body = editingId ? { id: editingId, ...form } : form;

    const res = await fetch("/api/ai-templates", {
      method,
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (res.ok) {
      setShowModal(false);
      fetchTemplates();
    } else {
      const err = await res.json();
      setSaveMsg(err.error || "Failed to save");
    }
  };

  const deleteTemplate = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`/api/ai-templates?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    fetchTemplates();
  };

  const getTemplateName = (key: string) => templates.find((t) => t.feature_key === key)?.name ?? key;

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading AI agents...</p>;
  }

  const tabs = [
    { key: "active" as const, label: "Active", count: templates.length },
    { key: "configure" as const, label: "Configure" },
    { key: "logs" as const, label: "Logs", count: summary?.total_calls ?? 0 },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">AI Agents</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Each agent has a locked system prompt that defines what it does. Business context is layered on top per-org.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6" style={{ borderBottom: "1px solid var(--border-color)" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors relative"
            style={{ color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)", borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: "-1px" }}
          >
            {t.label} {t.count !== undefined && <span className="ml-1 text-[11px]" style={{ color: "var(--text-muted)" }}>({t.count})</span>}
          </button>
        ))}
      </div>

      {/* ── ACTIVE TAB ──────────────────────────────────── */}
      {tab === "active" && (
        <div>
          {templates.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No AI agents configured yet. Go to Configure to add your first agent.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((t) => {
                const usageCount = summary?.by_feature[t.feature_key] ?? 0;
                return (
                  <div key={t.id} className="rounded-xl p-5" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2d1b4e 100%)" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" /><path d="M12 12v4" /><path d="M8 20h8" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{t.name}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#1a3a2a", color: "#4ade80" }}>Active</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>v{t.version}</span>
                        </div>
                        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{t.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--bg-surface)" }}>{t.feature_key}</span>
                      <span>{usageCount} calls</span>
                      <span>{t.system_prompt.length.toLocaleString()} chars</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CONFIGURE TAB ───────────────────────────────── */}
      {tab === "configure" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Create, edit, and manage AI agent templates. Each template defines the system prompt for a specific feature.</p>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors shrink-0" style={{ background: "var(--accent)", color: "#000" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}>
              + New Template
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="rounded-xl p-12 text-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No templates yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((t) => (
                <div key={t.id} className="rounded-xl overflow-hidden" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                  <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2d1b4e 100%)" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" /><path d="M12 12v4" /><path d="M8 20h8" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{t.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>v{t.version}</span>
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{t.description}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: "#1e3a5f", color: "#60a5fa" }}>{t.feature_key}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)", transform: expandedId === t.id ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </div>

                  {expandedId === t.id && (
                    <div style={{ borderTop: "1px solid var(--border-color)" }}>
                      <div className="p-4">
                        <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--text-muted)" }}>System Prompt</label>
                        <pre className="text-xs p-3 rounded-lg whitespace-pre-wrap max-h-60 overflow-y-auto" style={{ background: "var(--bg-surface)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                          {t.system_prompt}
                        </pre>
                        <div className="flex items-center gap-2 mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          <span>Created: {new Date(t.created_at).toLocaleDateString()}</span>
                          <span>·</span>
                          <span>Updated: {new Date(t.updated_at).toLocaleDateString()}</span>
                          <span>·</span>
                          <span>{t.system_prompt.length.toLocaleString()} chars</span>
                        </div>
                      </div>
                      <div className="px-4 pb-4 flex gap-2">
                        <button onClick={() => openEdit(t)} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors" style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}>
                          Edit
                        </button>
                        <button onClick={() => { if (confirm(`Delete "${t.name}"?`)) deleteTemplate(t.id); }} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors" style={{ background: "#4a1a1a", color: "#ef4444" }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LOGS TAB ────────────────────────────────────── */}
      {tab === "logs" && (
        <div>
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-5 gap-3 mb-6">
              {[
                { label: "Total Calls", value: summary.total_calls, color: "#a78bfa" },
                { label: "Successful", value: summary.successful, color: "#4ade80" },
                { label: "Failed", value: summary.failed, color: "#ef4444" },
                { label: "Input Tokens", value: summary.total_input_tokens.toLocaleString(), color: "#60a5fa" },
                { label: "Output Tokens", value: summary.total_output_tokens.toLocaleString(), color: "#facc15" },
              ].map((m) => (
                <div key={m.label} className="rounded-xl p-3" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                  <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                  <p className="text-lg font-bold" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Usage by agent + model */}
          {summary && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                <h3 className="text-sm font-semibold mb-3">Calls by Agent</h3>
                {Object.entries(summary.by_feature).sort(([, a], [, b]) => b - a).map(([key, count]) => (
                  <div key={key} className="flex items-center justify-between mb-2">
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{getTemplateName(key)}</span>
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{count}</span>
                  </div>
                ))}
                {Object.keys(summary.by_feature).length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>No usage data yet</p>}
              </div>
              <div className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                <h3 className="text-sm font-semibold mb-3">Calls by Model</h3>
                {Object.entries(summary.by_model).sort(([, a], [, b]) => b - a).map(([model, count]) => (
                  <div key={model} className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{model}</span>
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{count}</span>
                  </div>
                ))}
                {Object.keys(summary.by_model).length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>No usage data yet</p>}
              </div>
            </div>
          )}

          {/* Recent log entries */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
            <div className="p-4 border-b" style={{ borderColor: "var(--border-color)" }}>
              <h3 className="text-sm font-semibold">Recent Activity</h3>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Last 100 AI calls</p>
            </div>
            {logs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No AI calls logged yet. Usage will appear here as features use the AI engine.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                {logs.map((log) => (
                  <div key={log.id} className="px-4 py-3 flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: log.success ? "#4ade80" : "#ef4444" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{getTemplateName(log.feature_key)}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>{log.model}</span>
                      </div>
                      {log.error_message && <p className="text-[11px] mt-0.5" style={{ color: "#ef4444" }}>{log.error_message}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {log.input_tokens && (
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {log.input_tokens.toLocaleString()} in / {(log.output_tokens ?? 0).toLocaleString()} out
                        </p>
                      )}
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {new Date(log.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create/Edit Modal ─────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setShowModal(false)}>
          <div className="rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">{editingId ? "Edit Template" : "New AI Agent"}</h2>
              <button onClick={() => setShowModal(false)} className="text-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>✕</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Feature Key</label>
                  <input
                    type="text"
                    value={form.feature_key}
                    onChange={(e) => setForm({ ...form, feature_key: e.target.value })}
                    disabled={!!editingId}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)", opacity: editingId ? 0.5 : 1 }}
                    placeholder="e.g. onboarding_assistant"
                  />
                  {!editingId && <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>snake_case — used in code to reference this agent</p>}
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Name</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Onboarding Assistant" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="What does this AI agent do for users?" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>System Prompt</label>
                <textarea
                  value={form.system_prompt}
                  onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                  rows={12}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y font-mono"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                  placeholder="You are a... (this is the locked system prompt that gets sent with every call)"
                />
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{form.system_prompt.length.toLocaleString()} characters · The org&apos;s business context is automatically appended to this prompt</p>
              </div>
              {saveMsg && <p className="text-xs" style={{ color: "#ef4444" }}>{saveMsg}</p>}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-secondary)" }}>Cancel</button>
                <button
                  onClick={saveTemplate}
                  disabled={saving || !form.feature_key || !form.name || !form.system_prompt}
                  className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#000" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Create Agent"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
