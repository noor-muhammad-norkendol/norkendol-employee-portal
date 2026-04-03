"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

/* ── types ─────────────────────────────────────────────── */

interface LeaderboardConfig {
  id: string;
  org_id: string;
  metric_name: string;
  metric_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface LeaderboardEntry {
  id: string;
  org_id: string;
  config_id: string;
  user_name: string;
  value: number;
  rank: number | null;
  period: string;
  created_at: string;
}

type ConfigForm = {
  metric_name: string;
  metric_key: string;
};

type EntryForm = {
  user_name: string;
  value: string;
};

const EMPTY_CONFIG: ConfigForm = { metric_name: "", metric_key: "" };
const EMPTY_ENTRY: EntryForm = { user_name: "", value: "" };

/* ── helpers ───────────────────────────────────────────── */

const MEDALS = ["🥇", "🥈", "🥉"];

function formatValue(val: number) {
  if (val >= 1000) return "$" + val.toLocaleString();
  return val.toString();
}

/* ── main page ─────────────────────────────────────────── */

export default function LeaderboardPage() {
  const supabase = createClient();
  const [configs, setConfigs] = useState<LeaderboardConfig[]>([]);
  const [entries, setEntries] = useState<Record<string, LeaderboardEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);

  // Config modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState<ConfigForm>(EMPTY_CONFIG);
  const [savingConfig, setSavingConfig] = useState(false);
  const [deleteConfigConfirm, setDeleteConfigConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"active" | "inactive">("active");

  // Entry modal
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState<EntryForm>(EMPTY_ENTRY);
  const [savingEntry, setSavingEntry] = useState(false);
  const [deleteEntryConfirm, setDeleteEntryConfirm] = useState<string | null>(null);

  // Fetch all configs + entries
  const fetchAll = async () => {
    setLoading(true);
    const { data: cfgs } = await supabase
      .from("leaderboard_config")
      .select("*")
      .order("created_at", { ascending: false });
    const configList = (cfgs as LeaderboardConfig[]) ?? [];
    setConfigs(configList);

    if (configList.length > 0) {
      const { data: allEntries } = await supabase
        .from("leaderboard_entries")
        .select("*")
        .order("rank", { ascending: true });
      const grouped: Record<string, LeaderboardEntry[]> = {};
      for (const e of (allEntries as LeaderboardEntry[]) ?? []) {
        if (!grouped[e.config_id]) grouped[e.config_id] = [];
        grouped[e.config_id].push(e);
      }
      setEntries(grouped);

      if (!activeConfigId || !configList.find((c) => c.id === activeConfigId)) {
        setActiveConfigId(configList[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // ── Config CRUD ──

  const openCreateConfig = () => {
    setEditingConfigId(null);
    setConfigForm(EMPTY_CONFIG);
    setShowConfigModal(true);
  };

  const openEditConfig = (c: LeaderboardConfig) => {
    setEditingConfigId(c.id);
    setConfigForm({ metric_name: c.metric_name, metric_key: c.metric_key });
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    if (!configForm.metric_name.trim()) return;
    setSavingConfig(true);
    const key =
      configForm.metric_key.trim() ||
      configForm.metric_name.trim().toLowerCase().replace(/\s+/g, "_");

    if (editingConfigId) {
      await supabase
        .from("leaderboard_config")
        .update({
          metric_name: configForm.metric_name.trim(),
          metric_key: key,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingConfigId);
    } else {
      await supabase.from("leaderboard_config").insert({
        org_id: "00000000-0000-0000-0000-000000000001",
        metric_name: configForm.metric_name.trim(),
        metric_key: key,
      });
    }
    setSavingConfig(false);
    setShowConfigModal(false);
    fetchAll();
  };

  const toggleActiveConfig = async (c: LeaderboardConfig) => {
    await supabase
      .from("leaderboard_config")
      .update({ is_active: !c.is_active, updated_at: new Date().toISOString() })
      .eq("id", c.id);
    fetchAll();
  };

  const handleDeleteConfig = async (id: string) => {
    await supabase.from("leaderboard_entries").delete().eq("config_id", id);
    await supabase.from("leaderboard_config").delete().eq("id", id);
    setDeleteConfigConfirm(null);
    if (activeConfigId === id) setActiveConfigId(null);
    fetchAll();
  };

  // ── Entry CRUD ──

  const openCreateEntry = () => {
    setEditingEntryId(null);
    setEntryForm(EMPTY_ENTRY);
    setShowEntryModal(true);
  };

  const openEditEntry = (e: LeaderboardEntry) => {
    setEditingEntryId(e.id);
    setEntryForm({ user_name: e.user_name, value: String(e.value) });
    setShowEntryModal(true);
  };

  const handleSaveEntry = async () => {
    if (!entryForm.user_name.trim() || !entryForm.value.trim() || !activeConfigId) return;
    setSavingEntry(true);

    if (editingEntryId) {
      await supabase
        .from("leaderboard_entries")
        .update({
          user_name: entryForm.user_name.trim(),
          value: parseFloat(entryForm.value) || 0,
        })
        .eq("id", editingEntryId);
    } else {
      await supabase.from("leaderboard_entries").insert({
        org_id: "00000000-0000-0000-0000-000000000001",
        config_id: activeConfigId,
        user_name: entryForm.user_name.trim(),
        value: parseFloat(entryForm.value) || 0,
        period: "monthly",
      });
    }

    // Re-rank all entries for this config
    const { data: all } = await supabase
      .from("leaderboard_entries")
      .select("*")
      .eq("config_id", activeConfigId)
      .order("value", { ascending: false });

    if (all) {
      for (let i = 0; i < all.length; i++) {
        await supabase
          .from("leaderboard_entries")
          .update({ rank: i + 1 })
          .eq("id", all[i].id);
      }
    }

    setSavingEntry(false);
    setShowEntryModal(false);
    fetchAll();
  };

  const handleDeleteEntry = async (id: string) => {
    if (!activeConfigId) return;
    await supabase.from("leaderboard_entries").delete().eq("id", id);

    // Re-rank remaining
    const { data: all } = await supabase
      .from("leaderboard_entries")
      .select("*")
      .eq("config_id", activeConfigId)
      .order("value", { ascending: false });
    if (all) {
      for (let i = 0; i < all.length; i++) {
        await supabase.from("leaderboard_entries").update({ rank: i + 1 }).eq("id", all[i].id);
      }
    }

    setDeleteEntryConfirm(null);
    fetchAll();
  };

  const visibleConfigs = configs.filter((c) =>
    viewMode === "active" ? c.is_active : !c.is_active
  );
  const activeConfig = configs.find((c) => c.id === activeConfigId);
  const activeEntries = activeConfigId ? entries[activeConfigId] ?? [] : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Leaderboard</h1>
        <button
          onClick={openCreateConfig}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
          style={{ background: "var(--accent)", color: "#000" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
        >
          <span className="text-lg">+</span> New Leaderboard
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      ) : configs.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        >
          <svg className="mx-auto mb-3" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
            <path d="M8 21h8M12 17v4M17 3H7a2 2 0 0 0-2 2v4a7 7 0 0 0 14 0V5a2 2 0 0 0-2-2Z" />
          </svg>
          <p style={{ color: "var(--text-secondary)" }}>
            No leaderboards yet. Create your first one!
          </p>
        </div>
      ) : (
        <>
          {/* Active / Inactive view toggle */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1">
              {(["active", "inactive"] as const).map((mode) => {
                const count = configs.filter((c) => mode === "active" ? c.is_active : !c.is_active).length;
                return (
                  <button
                    key={mode}
                    onClick={() => { setViewMode(mode); setActiveConfigId(null); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer transition-colors"
                    style={{
                      background: viewMode === mode ? "var(--bg-hover)" : "transparent",
                      color: viewMode === mode
                        ? mode === "active" ? "#4ade80" : "#f59e0b"
                        : "var(--text-muted)",
                    }}
                  >
                    {mode} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab bar — switch between leaderboards in current view */}
          {visibleConfigs.length === 0 ? (
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
            >
              <p style={{ color: "var(--text-secondary)" }}>
                {viewMode === "active"
                  ? "No active leaderboards. Create one or reactivate an inactive one."
                  : "No inactive leaderboards."}
              </p>
            </div>
          ) : (
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {visibleConfigs.map((c) => (
              <div key={c.id} className="flex items-center gap-1">
                <button
                  onClick={() => setActiveConfigId(c.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                  style={{
                    background: activeConfigId === c.id ? "var(--bg-hover)" : "transparent",
                    color: activeConfigId === c.id ? "var(--text-primary)" : "var(--text-muted)",
                    border: activeConfigId === c.id ? "1px solid var(--border-color)" : "1px solid transparent",
                  }}
                >
                  {c.metric_name}
                </button>
                {/* Actions when selected */}
                {activeConfigId === c.id && (
                  <>
                    {/* Activate / Deactivate toggle */}
                    <button
                      onClick={() => toggleActiveConfig(c)}
                      className="px-2 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                      style={{
                        background: c.is_active ? "#3a3520" : "#1a3a2a",
                        color: c.is_active ? "#f59e0b" : "#4ade80",
                      }}
                      title={c.is_active ? "Deactivate — keeps data, hides from dashboard" : "Reactivate — shows on dashboard"}
                    >
                      {c.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                    <button
                      onClick={() => openEditConfig(c)}
                      className="p-1.5 rounded cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                      title="Edit leaderboard"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {deleteConfigConfirm === c.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDeleteConfig(c.id)}
                          className="px-2 py-1 rounded text-xs font-medium cursor-pointer"
                          style={{ background: "#4a1a1a", color: "#ef4444" }}
                        >
                          Delete Forever
                        </button>
                        <button
                          onClick={() => setDeleteConfigConfirm(null)}
                          className="px-2 py-1 rounded text-xs cursor-pointer"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfigConfirm(c.id)}
                        className="p-1.5 rounded cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                        title="Delete permanently (entries too)"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          )}

          {/* Active leaderboard entries */}
          {activeConfig && (
            <div
              className="rounded-xl p-6"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold">{activeConfig.metric_name}</h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {activeEntries.length} {activeEntries.length === 1 ? "entry" : "entries"}
                  </p>
                </div>
                <button
                  onClick={openCreateEntry}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                  style={{ background: "var(--accent)", color: "#000" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  <span>+</span> Add Entry
                </button>
              </div>

              {activeEntries.length === 0 ? (
                <div className="text-center py-8">
                  <p style={{ color: "var(--text-secondary)" }}>
                    No entries yet. Add your first competitor!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeEntries.map((entry, i) => (
                    <div
                      key={entry.id}
                      className="rounded-lg px-5 py-3.5 flex items-center justify-between"
                      style={{
                        background: i === 0 ? "rgba(250, 204, 21, 0.08)" : "var(--bg-surface)",
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-lg w-8 text-center">
                          {i < 3 ? MEDALS[i] : (
                            <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                              {entry.rank ?? i + 1}
                            </span>
                          )}
                        </span>
                        <span className="text-sm font-medium">{entry.user_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                          {formatValue(entry.value)}
                        </span>
                        <button
                          onClick={() => openEditEntry(entry)}
                          className="p-1.5 rounded cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                          title="Edit"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        {deleteEntryConfirm === entry.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="px-2 py-1 rounded text-xs font-medium cursor-pointer"
                              style={{ background: "#4a1a1a", color: "#ef4444" }}
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setDeleteEntryConfirm(null)}
                              className="px-2 py-1 rounded text-xs cursor-pointer"
                              style={{ color: "var(--text-muted)" }}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteEntryConfirm(entry.id)}
                            className="p-1.5 rounded cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                            title="Delete"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Leaderboard Config Modal ───────────────────── */}
      {showConfigModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowConfigModal(false)}
        >
          <div
            className="rounded-xl p-6 w-full max-w-md"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">
                {editingConfigId ? "Edit Leaderboard" : "New Leaderboard"}
              </h2>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-lg cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Leaderboard Name
                </label>
                <input
                  type="text"
                  value={configForm.metric_name}
                  onChange={(e) => setConfigForm({ ...configForm, metric_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="e.g. Largest Settlement, Most Cases Closed..."
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Metric Key (Optional — auto-generated from name)
                </label>
                <input
                  type="text"
                  value={configForm.metric_key}
                  onChange={(e) => setConfigForm({ ...configForm, metric_key: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="e.g. largest_settlement"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={savingConfig || !configForm.metric_name.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#000" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  {savingConfig ? "Saving..." : editingConfigId ? "Save Changes" : "Create Leaderboard"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Entry Modal ────────────────────────────────── */}
      {showEntryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowEntryModal(false)}
        >
          <div
            className="rounded-xl p-6 w-full max-w-md"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">
                {editingEntryId ? "Edit Entry" : "Add Entry"}
              </h2>
              <button
                onClick={() => setShowEntryModal(false)}
                className="text-lg cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Name
                </label>
                <input
                  type="text"
                  value={entryForm.user_name}
                  onChange={(e) => setEntryForm({ ...entryForm, user_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="e.g. Frank Dalton"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Value
                </label>
                <input
                  type="number"
                  value={entryForm.value}
                  onChange={(e) => setEntryForm({ ...entryForm, value: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="e.g. 142500"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowEntryModal(false)}
                  className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEntry}
                  disabled={savingEntry || !entryForm.user_name.trim() || !entryForm.value.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#000" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  {savingEntry ? "Saving..." : editingEntryId ? "Save Changes" : "Add Entry"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
