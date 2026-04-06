"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  useOnboardingClients,
  useCreateOnboardingClient,
  useUpdateOnboardingClient,
  useDeleteOnboardingClient,
} from "@/hooks/onboarder-kpi/useOnboardingClients";
import { useLogActivity } from "@/hooks/onboarder-kpi/useActivityLogs";
import { useLogStatusChange } from "@/hooks/onboarder-kpi/useStatusHistory";
import {
  useOnboarderKPIs,
  useWriteOnboarderKPISnapshots,
  calculateOnboarderMetrics,
} from "@/hooks/onboarder-kpi/useOnboarderKPIs";
import { useOKSupabase } from "@/hooks/onboarder-kpi/useSupabase";
import {
  OnboardingClient,
  CreateClientInput,
  OnboardingStatus,
  STATUS_LABELS,
  PERIL_OPTIONS,
  ONBOARD_TYPE_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  ALLOWED_TRANSITIONS,
  STAGE_TARGET_HOURS,
} from "@/types/onboarder-kpi";

/* ───── style constants (portal pattern) ───── */
const cardStyle: React.CSSProperties = {
  background: "var(--bg-surface)", borderRadius: 10, padding: "18px 22px",
  border: "1px solid var(--border-color)",
};
const inputStyle: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border-color)",
  color: "var(--text-primary)", borderRadius: 8, padding: "8px 12px",
  fontSize: 13, width: "100%", outline: "none",
};
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "var(--text-secondary)",
  display: "block", marginBottom: 4,
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };
const btnPrimary: React.CSSProperties = {
  background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6,
  padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const btnOutline: React.CSSProperties = {
  background: "transparent", color: "var(--text-primary)",
  border: "1px solid var(--border-color)", borderRadius: 6,
  padding: "6px 12px", fontSize: 12, cursor: "pointer",
};
const thStyle: React.CSSProperties = {
  padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
  textAlign: "left", borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  padding: "8px 12px", fontSize: 13, color: "var(--text-primary)",
  borderBottom: "1px solid var(--border-color)",
};

const HOUR_MS = 3_600_000;

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  new: { bg: "rgba(96,165,250,0.15)", color: "#60a5fa" },
  step_2: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
  step_3: { bg: "rgba(251,146,60,0.15)", color: "#fb923c" },
  final_step: { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
  on_hold: { bg: "rgba(148,163,184,0.15)", color: "#94a3b8" },
  completed: { bg: "rgba(74,222,128,0.15)", color: "#4ade80" },
  erroneous: { bg: "rgba(239,68,68,0.1)", color: "#f87171" },
  revised: { bg: "rgba(45,212,191,0.15)", color: "#2dd4bf" },
  abandoned: { bg: "rgba(148,163,184,0.1)", color: "#64748b" },
};

// Map sidebar items to status filters
const SIDEBAR_TO_STATUS: Record<string, OnboardingStatus | null> = {
  "New Clients": "new",
  "24hr Follow-Up": "step_2",
  "48hr Follow-Up": "step_3",
  "72hr Escalation": "final_step",
  "On Hold": "on_hold",
  "Completed": "completed",
};

function timeInStage(client: OnboardingClient): { hours: number; label: string; overdue: boolean } {
  const hours = (Date.now() - new Date(client.status_entered_at).getTime()) / HOUR_MS;
  const target = STAGE_TARGET_HOURS[client.status as keyof typeof STAGE_TARGET_HOURS];
  const overdue = target ? hours > target : false;
  if (hours < 1) return { hours, label: `${Math.round(hours * 60)}m`, overdue };
  if (hours < 24) return { hours, label: `${Math.round(hours)}h`, overdue };
  return { hours, label: `${(hours / 24).toFixed(1)}d`, overdue };
}

const EMPTY_FORM: CreateClientInput = {
  client_name: "",
  referral_source: null,
  state: null,
  peril: null,
  onboard_type: null,
  email: null,
  phone: null,
  assigned_user_id: null,
  assigned_user_name: null,
  assigned_pa_name: null,
  assignment_type: null,
  date_of_loss: null,
  initial_hours: 0,
  notes: null,
};

type ViewMode = "pipeline" | "add" | "performance";

export default function OnboarderKPIPage() {
  const { userInfo } = useOKSupabase();
  const { data: allClients = [], isLoading } = useOnboardingClients();
  const createMut = useCreateOnboardingClient();
  const updateMut = useUpdateOnboardingClient();
  const deleteMut = useDeleteOnboardingClient();
  const logActivity = useLogActivity();
  const logStatusChange = useLogStatusChange();
  const teamKPIs = useOnboarderKPIs(allClients);
  const writeKPIs = useWriteOnboarderKPISnapshots();

  const [view, setView] = useState<ViewMode>("pipeline");
  const [statusFilter, setStatusFilter] = useState<OnboardingStatus>("new");
  const [form, setForm] = useState<CreateClientInput>({ ...EMPTY_FORM });
  const [editId, setEditId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  // Sidebar menu actions
  useEffect(() => {
    function handle(e: Event) {
      const { section, item } = (e as CustomEvent).detail;
      if (section !== "onboarder-kpi") return;
      const status = SIDEBAR_TO_STATUS[item];
      if (status) {
        setView("pipeline");
        setStatusFilter(status);
        setEditId(null);
        setExpandedClient(null);
      } else if (item === "Add Client") {
        setView("add");
        setEditId(null);
        setForm({ ...EMPTY_FORM });
        setFormError(null);
      } else if (item === "Performance") {
        setView("performance");
      }
    }
    window.addEventListener("sidebar-action", handle);
    return () => window.removeEventListener("sidebar-action", handle);
  }, []);

  // Write KPI snapshots once per page load
  const kpiWritten = useRef(false);
  useEffect(() => {
    if (allClients.length > 0 && !kpiWritten.current && !writeKPIs.isPending) {
      kpiWritten.current = true;
      writeKPIs.mutate(teamKPIs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allClients.length]);

  // Filtered clients for current pipeline view
  const filteredClients = useMemo(
    () => allClients.filter((c) => c.status === statusFilter),
    [allClients, statusFilter]
  );

  // Pipeline counts for header
  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of allClients) counts[c.status] = (counts[c.status] || 0) + 1;
    return counts;
  }, [allClients]);

  // Personal metrics
  const myMetrics = useMemo(() => {
    if (!userInfo) return null;
    return calculateOnboarderMetrics(allClients, userInfo.userId, userInfo.fullName);
  }, [allClients, userInfo]);

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit() {
    setFormError(null);
    if (!form.client_name) {
      setFormError("Client Name is required.");
      return;
    }
    try {
      if (editId) {
        await updateMut.mutateAsync({ id: editId, ...form });
        setEditId(null);
      } else {
        await createMut.mutateAsync(form);
      }
      setForm({ ...EMPTY_FORM });
      setView("pipeline");
      setStatusFilter("new");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setFormError(msg);
    }
  }

  function startEdit(client: OnboardingClient) {
    setForm({
      client_name: client.client_name,
      referral_source: client.referral_source || null,
      state: client.state || null,
      peril: client.peril || null,
      onboard_type: client.onboard_type || null,
      email: client.email || null,
      phone: client.phone || null,
      assigned_user_id: client.assigned_user_id || null,
      assigned_user_name: client.assigned_user_name || null,
      assigned_pa_name: client.assigned_pa_name || null,
      assignment_type: client.assignment_type || null,
      date_of_loss: client.date_of_loss || null,
      initial_hours: client.initial_hours || 0,
      notes: client.notes || null,
    });
    setEditId(client.id);
    setFormError(null);
    setView("add");
  }

  async function moveStatus(client: OnboardingClient, newStatus: OnboardingStatus) {
    try {
      await updateMut.mutateAsync({
        id: client.id,
        status: newStatus,
        status_entered_at: new Date().toISOString(),
        ...(newStatus === "completed" ? { completed_at: new Date().toISOString() } : {}),
        ...(newStatus === "abandoned" ? { abandoned_at: new Date().toISOString() } : {}),
      });
      await logStatusChange.mutateAsync({
        client_id: client.id,
        from_status: client.status,
        to_status: newStatus,
      });
      // Log activity for the status change
      await logActivity.mutateAsync({
        client_id: client.id,
        activity_type: "status_change",
        subject: `Status changed: ${STATUS_LABELS[client.status]} → ${STATUS_LABELS[newStatus]}`,
      });
    } catch {
      // Mutations handle their own errors via react-query
    }
  }

  if (isLoading) {
    return <div style={{ padding: 40, color: "var(--text-secondary)" }}>Loading onboarding clients...</div>;
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header + Stats */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Onboarder KPI</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            {allClients.length} client{allClients.length !== 1 ? "s" : ""} total
            {myMetrics ? ` · ${myMetrics.completionRate}% completion rate` : ""}
          </p>
        </div>

        {/* Pipeline summary badges */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["new", "step_2", "step_3", "final_step", "on_hold", "completed"] as OnboardingStatus[]).map((s) => {
            const sc = STATUS_COLORS[s];
            const count = pipelineCounts[s] || 0;
            const active = statusFilter === s && view === "pipeline";
            return (
              <button
                key={s}
                onClick={() => { setView("pipeline"); setStatusFilter(s); setExpandedClient(null); }}
                style={{
                  background: active ? sc.color : sc.bg,
                  color: active ? "#fff" : sc.color,
                  border: "none", borderRadius: 6, padding: "4px 10px",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}
              >
                {STATUS_LABELS[s]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ PIPELINE VIEW ═══ */}
      {view === "pipeline" && (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              {STATUS_LABELS[statusFilter]}
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>
                {filteredClients.length} client{filteredClients.length !== 1 ? "s" : ""}
              </span>
            </h2>
          </div>

          {filteredClients.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 40 }}>
              No clients in {STATUS_LABELS[statusFilter]}. Click Add Client to get started.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Client</th>
                    <th style={thStyle}>Referral</th>
                    <th style={thStyle}>State</th>
                    <th style={thStyle}>Peril</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Time in Stage</th>
                    <th style={thStyle}>Contract</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => {
                    const tis = timeInStage(client);
                    const sc = STATUS_COLORS[client.status] || STATUS_COLORS.new;
                    const transitions = ALLOWED_TRANSITIONS[client.status] || [];
                    const isExpanded = expandedClient === client.id;

                    return (
                      <React.Fragment key={client.id}>
                        <tr>
                          <td style={tdStyle}>
                            <div>
                              <span style={{ fontWeight: 600 }}>{client.client_name}</span>
                              {client.phone && (
                                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{client.phone}</span>
                              )}
                            </div>
                          </td>
                          <td style={tdStyle}>{client.referral_source || "—"}</td>
                          <td style={tdStyle}>{client.state || "—"}</td>
                          <td style={tdStyle}>{client.peril || "—"}</td>
                          <td style={tdStyle}>{client.onboard_type || "—"}</td>
                          <td style={{
                            ...tdStyle,
                            fontWeight: 600,
                            color: tis.overdue ? "#ef4444" : "var(--text-primary)",
                          }}>
                            {tis.label}
                            {tis.overdue && (
                              <span style={{ fontSize: 10, marginLeft: 4, color: "#ef4444" }}>OVERDUE</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              display: "inline-block", padding: "2px 8px", borderRadius: 4,
                              fontSize: 11, fontWeight: 600,
                              background: client.contract_status === "signed" ? "rgba(74,222,128,0.15)" : "rgba(148,163,184,0.1)",
                              color: client.contract_status === "signed" ? "#4ade80" : "var(--text-muted)",
                            }}>
                              {client.contract_status || "not_sent"}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button
                                style={{ ...btnOutline, fontSize: 11, padding: "3px 8px" }}
                                onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                              >
                                {isExpanded ? "Close" : "Move"}
                              </button>
                              <button
                                style={{ ...btnOutline, fontSize: 11, padding: "3px 8px" }}
                                onClick={() => startEdit(client)}
                              >
                                Edit
                              </button>
                              <button
                                style={{ ...btnOutline, fontSize: 11, padding: "3px 8px", color: "#ef4444", borderColor: "#ef4444" }}
                                onClick={() => { if (confirm("Delete this client?")) deleteMut.mutate(client.id); }}
                              >
                                x
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Expanded row: status transition buttons */}
                        {isExpanded && transitions.length > 0 && (
                          <tr>
                            <td colSpan={8} style={{ padding: "8px 12px", background: "var(--bg-page)", borderBottom: "1px solid var(--border-color)" }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 4 }}>Move to:</span>
                                {transitions.map((t) => {
                                  const tc = STATUS_COLORS[t] || STATUS_COLORS.new;
                                  return (
                                    <button
                                      key={t}
                                      onClick={() => { moveStatus(client, t); setExpandedClient(null); }}
                                      style={{
                                        background: tc.bg, color: tc.color, border: "none",
                                        borderRadius: 4, padding: "4px 10px", fontSize: 11,
                                        fontWeight: 600, cursor: "pointer",
                                      }}
                                    >
                                      {STATUS_LABELS[t]}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ ADD / EDIT CLIENT ═══ */}
      {view === "add" && (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              {editId ? "Edit Client" : "New Client"}
            </h2>
            {userInfo && (
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
                {userInfo.fullName}
              </span>
            )}
          </div>

          {/* Section: Client Info */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Client Info</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Client Name *</label>
              <input style={inputStyle} value={form.client_name} onChange={(e) => set("client_name", e.target.value)} placeholder="Enter client name" />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} value={form.email || ""} onChange={(e) => set("email", e.target.value || null)} placeholder="email@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={form.phone || ""} onChange={(e) => set("phone", e.target.value || null)} placeholder="(555) 555-5555" />
            </div>
          </div>

          {/* Section: Details */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Details</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>State</label>
              <input style={inputStyle} value={form.state || ""} onChange={(e) => set("state", e.target.value || null)} placeholder="FL" />
            </div>
            <div>
              <label style={labelStyle}>Peril</label>
              <select style={selectStyle} value={form.peril || ""} onChange={(e) => set("peril", e.target.value || null)}>
                <option value="">Select...</option>
                {PERIL_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Onboard Type</label>
              <select style={selectStyle} value={form.onboard_type || ""} onChange={(e) => set("onboard_type", e.target.value || null)}>
                <option value="">Select...</option>
                {ONBOARD_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Date of Loss</label>
              <input type="date" style={inputStyle} value={form.date_of_loss || ""} onChange={(e) => set("date_of_loss", e.target.value || null)} />
            </div>
          </div>

          {/* Section: Referral & Assignment */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Referral & Assignment</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Referral Source</label>
              <input style={inputStyle} value={form.referral_source || ""} onChange={(e) => set("referral_source", e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>Assigned User</label>
              <input style={inputStyle} value={form.assigned_user_name || ""} onChange={(e) => set("assigned_user_name", e.target.value || null)} placeholder="User name" />
            </div>
            <div>
              <label style={labelStyle}>Assigned PA</label>
              <input style={inputStyle} value={form.assigned_pa_name || ""} onChange={(e) => set("assigned_pa_name", e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>Assignment Type</label>
              <input style={inputStyle} value={form.assignment_type || ""} onChange={(e) => set("assignment_type", e.target.value || null)} />
            </div>
          </div>

          {/* Section: Time & Notes */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Time & Notes</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Initial Hours</label>
              <input type="number" style={inputStyle} value={form.initial_hours || ""} onChange={(e) => set("initial_hours", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.notes || ""} onChange={(e) => set("notes", e.target.value || null)} placeholder="Any additional notes..." />
            </div>
          </div>

          {formError && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: "#ef4444", fontSize: 13 }}>
              {formError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnPrimary} onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "Saving..." : editId ? "Update Client" : "Add Client"}
            </button>
            {editId && (
              <button style={btnOutline} onClick={() => { setEditId(null); setForm({ ...EMPTY_FORM }); setFormError(null); setView("pipeline"); }}>Cancel</button>
            )}
          </div>
        </div>
      )}

      {/* ═══ PERFORMANCE VIEW ═══ */}
      {view === "performance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Personal stats */}
          {myMetrics && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>My Performance</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
                {[
                  { label: "Completion Rate", value: `${myMetrics.completionRate}%` },
                  { label: "Avg Time to Complete", value: `${myMetrics.avgTimeToCompletionHours}h` },
                  { label: "Overdue Rate", value: `${myMetrics.overdueRate}%`, warn: myMetrics.overdueRate > 20 },
                  { label: "Conversion Rate", value: `${myMetrics.conversionRate}%` },
                  { label: "Entries/Day", value: String(myMetrics.entriesPerDay) },
                ].map((stat) => (
                  <div key={stat.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: stat.warn ? "#ef4444" : "var(--accent)" }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team rankings */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>Team Rankings</h2>
            {teamKPIs.onboarderRankings.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>No data yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Onboarder</th>
                      <th style={thStyle}>Entries</th>
                      <th style={thStyle}>Completed</th>
                      <th style={thStyle}>Completion %</th>
                      <th style={thStyle}>Avg Time (h)</th>
                      <th style={thStyle}>Overdue %</th>
                      <th style={thStyle}>Conversion %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamKPIs.onboarderRankings.map((r) => (
                      <tr key={r.onboarderId}>
                        <td style={tdStyle}>{r.rank}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{r.onboarderName}</td>
                        <td style={tdStyle}>{r.totalEntries}</td>
                        <td style={tdStyle}>{r.completed}</td>
                        <td style={tdStyle}>{r.completionRate}%</td>
                        <td style={tdStyle}>{r.avgTimeToCompletionHours}</td>
                        <td style={{ ...tdStyle, color: r.overdueRate > 20 ? "#ef4444" : "var(--text-primary)" }}>{r.overdueRate}%</td>
                        <td style={tdStyle}>{r.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Team summary */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>Team Summary</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { label: "Avg Completion Rate", value: `${teamKPIs.avgCompletionRate}%` },
                { label: "Avg Time to Complete", value: `${teamKPIs.avgTimeToCompletion}h` },
                { label: "Avg Overdue Rate", value: `${teamKPIs.avgOverdueRate}%` },
                { label: "Avg Conversion Rate", value: `${teamKPIs.avgConversionRate}%` },
              ].map((stat) => (
                <div key={stat.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
