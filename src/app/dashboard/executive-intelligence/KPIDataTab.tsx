"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { cardStyle, inputStyle, labelStyle, selectStyle, btnPrimary, btnOutline } from "@/lib/styles";

interface KPIRow {
  id: string;
  source_module: string;
  metric_key: string;
  metric_value: number;
  metric_unit: string;
  period_start: string;
  period_end: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface UserLite {
  id: string;
  full_name: string | null;
  email: string | null;
}

const FETCH_LIMIT = 1000;

// Pretty-print metric_key for the Submission Type column
const SUBMISSION_LABEL: Record<string, string> = {
  claim_abandoned: "Abandoned",
  claim_erroneous: "Erroneous",
  claim_revised: "Revised",
  phase_completed: "Phase Completed",
  time_in_phase: "Time in Phase",
};

type GroupBy = "none" | "client_name" | "user_name" | "referral_source" | "assigned_user_name";

const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: "none", label: "None (flat)" },
  { key: "client_name", label: "Insured Name" },
  { key: "user_name", label: "Onboarder" },
  { key: "referral_source", label: "Referral Source" },
  { key: "assigned_user_name", label: "Adjuster Assigned" },
];

function fmtDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}

// "4/28/2026, 3:57 PM" — short date + 12hr time, no seconds
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "numeric", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function getMeta<T = string>(r: KPIRow, key: string): T | null {
  const v = r.metadata?.[key];
  return v == null ? null : (v as T);
}

export default function KPIDataTab() {
  const [supabase] = useState(() => createClient());
  const [orgId, setOrgId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [rows, setRows] = useState<KPIRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const today = new Date();
  const defaultStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [dateStart, setDateStart] = useState<string>(defaultStart.toISOString().slice(0, 10));
  const [dateEnd, setDateEnd] = useState<string>(today.toISOString().slice(0, 10));
  const [moduleFilter, setModuleFilter] = useState<string>("onboarding");
  const [metricFilter, setMetricFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  // Expanded group state — keyed by group value
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  // Per-row expanded state (the full claim card detail panel)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleRow = (id: string) => setExpandedRows((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Load org + users
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("users").select("org_id").eq("id", user.id).single();
      if (!profile) return;
      setOrgId((profile as { org_id: string }).org_id);
      const { data: us } = await supabase
        .from("users")
        .select("id, full_name, email")
        .eq("org_id", (profile as { org_id: string }).org_id)
        .eq("status", "active")
        .order("full_name", { ascending: true });
      if (us) setUsers(us as UserLite[]);
    }
    init();
  }, [supabase]);

  const loadRows = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    let q = supabase
      .from("kpi_snapshots")
      .select("*")
      .eq("org_id", orgId)
      .gte("period_start", dateStart)
      .lte("period_end", dateEnd)
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT);
    if (moduleFilter) q = q.eq("source_module", moduleFilter);
    if (metricFilter) q = q.eq("metric_key", metricFilter);
    const { data, error: qErr } = await q;
    setLoading(false);
    if (qErr) { setError(qErr.message); return; }
    let result = (data || []) as KPIRow[];
    if (userFilter) {
      result = result.filter((r) => r.metadata?.user_id === userFilter);
    }
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase().trim();
      result = result.filter((r) => {
        const cn = String(r.metadata?.client_name || "").toLowerCase();
        const la = String(r.metadata?.loss_address || "").toLowerCase();
        const aa = String(r.metadata?.assigned_user_name || "").toLowerCase();
        return cn.includes(t) || la.includes(t) || aa.includes(t);
      });
    }
    setRows(result);
  }, [supabase, orgId, dateStart, dateEnd, moduleFilter, metricFilter, userFilter, searchTerm]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const userName = useCallback((id: string | undefined): string => {
    if (!id) return "—";
    const u = users.find((x) => x.id === id);
    return u ? (u.full_name || u.email || "(no name)") : "(unknown)";
  }, [users]);

  // Available metric_keys from current data — for filter dropdown
  const availableMetrics = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.metric_key));
    return Array.from(s).sort();
  }, [rows]);

  // Summary tiles
  const summary = useMemo(() => {
    const byMetric: Record<string, number> = {};
    let totalTimeSeconds = 0;
    for (const r of rows) {
      byMetric[r.metric_key] = (byMetric[r.metric_key] || 0) + 1;
      if (r.metric_key === "time_in_phase") totalTimeSeconds += Number(r.metric_value) || 0;
    }
    return { total: rows.length, byMetric, totalTimeSeconds };
  }, [rows]);

  // Group rows
  const grouped = useMemo(() => {
    if (groupBy === "none") return null;
    const groups = new Map<string, KPIRow[]>();
    for (const r of rows) {
      const k = (getMeta<string>(r, groupBy) || "(unknown)").trim() || "(unknown)";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [rows, groupBy]);

  function exportCSV() {
    // Headers match the live Onboarding Tracker xlsx, with File # / Claim # prepended
    const header = [
      "File Number", "Claim Number",
      "Start time", "Completion time", "Email", "Name",
      "Insured Name", "Property Address", "Email Address",
      "Contract Created", "Referral Source", "Adjuster assigned",
      "What type of Submission", "Contract Signed Date",
      "Why did the contract need to be corrected?", "Time Tracking",
    ];
    const csvRows = [header.join(",")];
    for (const r of rows) {
      const m = r.metadata || {};
      const submissionLabel = SUBMISSION_LABEL[r.metric_key] || r.metric_key;
      const isTime = r.metric_key === "time_in_phase";
      const onboarderEmail = String(m.user_email || "");
      const onboarderName = String(m.user_name || userName(m.user_id as string | undefined));
      const cells = [
        String(m.file_number || ""),
        String(m.claim_number || ""),
        fmtTime(r.created_at),
        fmtTime(r.created_at),
        onboarderEmail,
        onboarderName,
        String(m.client_name || ""),
        String(m.loss_address || ""),
        String(m.email || ""),
        String(m.onboard_type || ""),
        String(m.referral_source || ""),
        String(m.assigned_user_name || m.assigned_pa_name || ""),
        submissionLabel,
        String(m.contract_signed_date || ""),
        Array.isArray(m.fields_changed) ? (m.fields_changed as string[]).join("; ") : "",
        isTime ? fmtDuration(Number(r.metric_value)) : "",
      ].map((v) => {
        const s = String(v ?? "");
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      });
      csvRows.push(cells.join(","));
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kpi-data-${dateStart}-to-${dateEnd}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Render helpers ──────────────────────────

  function renderEventRow(r: KPIRow, indent: boolean = false) {
    const m = r.metadata || {};
    const onboarderEmail = String(m.user_email || "—");
    const onboarderName = String(m.user_name || userName(m.user_id as string | undefined));
    const submissionLabel = SUBMISSION_LABEL[r.metric_key] || r.metric_key;
    const isTime = r.metric_key === "time_in_phase";
    const timeStr = isTime ? fmtDuration(Number(r.metric_value)) : "—";
    const fieldsChanged = Array.isArray(m.fields_changed) ? (m.fields_changed as string[]).join(", ") : "—";
    const cell: React.CSSProperties = { padding: "6px 10px", color: "var(--text-secondary)", whiteSpace: "nowrap" };
    const isRowOpen = expandedRows.has(r.id);
    return (
      <tr key={r.id} style={{ borderTop: "1px solid var(--border-color)" }}>
        <td style={{ ...cell, color: "var(--accent)", fontWeight: 600, paddingLeft: indent ? 36 : 10 }}>
          <span
            onClick={(e) => { e.stopPropagation(); toggleRow(r.id); }}
            style={{ cursor: "pointer", marginRight: 6, color: "var(--text-muted)", display: "inline-block", width: 14 }}
            title={isRowOpen ? "Hide details" : "Show full claim details"}
          >
            {isRowOpen ? "−" : "+"}
          </span>
          {String(m.file_number || "—")}
        </td>
        <td style={cell}>{String(m.claim_number || "—")}</td>
        <td style={cell}>{fmtTime(r.created_at)}</td>
        <td style={cell}>{fmtTime(r.created_at)}</td>
        <td style={cell}>{onboarderEmail}</td>
        <td style={cell}>{onboarderName}</td>
        <td style={{ ...cell, color: "var(--text-primary)", fontWeight: 600 }}>{String(m.client_name || "—")}</td>
        <td style={{ ...cell, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>{String(m.loss_address || "—")}</td>
        <td style={cell}>{String(m.email || "—")}</td>
        <td style={cell}>{String(m.onboard_type || "—")}</td>
        <td style={cell}>{String(m.referral_source || "—")}</td>
        <td style={cell}>{String(m.assigned_user_name || m.assigned_pa_name || "—")}</td>
        <td style={{ ...cell, color: "var(--text-primary)", fontWeight: 600 }}>{submissionLabel}</td>
        <td style={cell}>{String(m.contract_signed_date || "—")}</td>
        <td style={{ ...cell, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "normal" }}>{fieldsChanged}</td>
        <td style={{ ...cell, textAlign: "right" }}>{isTime ? timeStr : "—"}</td>
      </tr>
    );
  }

  // Detail panel rendered as a colspan'd sub-row when [+] is clicked.
  // Shows every captured field grouped by section.
  function renderDetailPanel(r: KPIRow) {
    const m = r.metadata || {};
    const dim = (v: unknown): string => {
      if (v === undefined || v === null || v === '') return '—';
      return String(v);
    };
    const sections: { title: string; fields: [string, unknown][] }[] = [
      {
        title: "Policyholder",
        fields: [
          ["Insured Name", m.client_name],
          ["Email", m.email],
          ["Phone", m.phone],
          ["Additional First", m.additional_policyholder_first],
          ["Additional Last", m.additional_policyholder_last],
          ["Additional Email", m.additional_policyholder_email],
          ["Additional Phone", m.additional_policyholder_phone],
        ],
      },
      {
        title: "Loss Info",
        fields: [
          ["Date of Loss", m.date_of_loss],
          ["State", m.state],
          ["Cause of Loss (Peril)", m.peril],
          ["Peril Other", m.peril_other],
          ["Severity", m.severity],
          ["Address", m.loss_address],
          ["Street", m.loss_street],
          ["Line 2", m.loss_line2],
          ["City", m.loss_city],
          ["Loss State", m.loss_state],
          ["ZIP", m.loss_zip],
          ["Loss Description", m.loss_description],
        ],
      },
      {
        title: "Carrier",
        fields: [
          ["Insurance Company", m.insurance_company],
          ["Policy Number", m.policy_number],
          ["Status of Claim", m.status_claim],
          ["Claim Number", m.claim_number],
          ["File Number", m.file_number],
          ["Supplement Notes", m.supplement_notes],
        ],
      },
      {
        title: "Parties",
        fields: [
          ["Contractor Company", m.contractor_company],
          ["Contractor Name", m.contractor_name],
          ["Contractor Email", m.contractor_email],
          ["Contractor Phone", m.contractor_phone],
          ["Referral Source", m.referral_source],
          ["Source Email", m.source_email],
        ],
      },
      {
        title: "Assignment",
        fields: [
          ["Assigned User", m.assigned_user_name],
          ["Assigned PA", m.assigned_pa_name],
          ["Onboard Type", m.onboard_type],
          ["Assignment Type", m.assignment_type],
        ],
      },
      {
        title: "Notes",
        fields: [
          ["Notes", m.notes],
          ["Initial Hours", m.initial_hours],
        ],
      },
      {
        title: "Event Meta",
        fields: [
          ["Onboarder", m.user_name],
          ["Onboarder Email", m.user_email],
          ["Submission Type", SUBMISSION_LABEL[r.metric_key] || r.metric_key],
          ["Metric Value", `${r.metric_value} ${r.metric_unit}`],
          ["From Phase", m.from_phase],
          ["To Phase", m.to_phase],
          ["Phase", m.phase],
          ["Session Id", m.session_id],
          ["Ended Reason", m.ended_reason],
          ["Fields Changed", Array.isArray(m.fields_changed) ? (m.fields_changed as string[]).join(", ") : null],
          ["Event Id", r.id],
        ],
      },
    ];
    return (
      <tr key={`detail-${r.id}`} style={{ borderTop: "1px solid var(--border-color)", background: "var(--bg-page)" }}>
        <td colSpan={16} style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {sections.map((sec) => (
              <div key={sec.title}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                  {sec.title}
                </p>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  {sec.fields.map(([label, val]) => (
                    <div key={label} style={{ display: "flex", gap: 8, paddingBottom: 2 }}>
                      <span style={{ color: "var(--text-muted)", minWidth: 130 }}>{label}:</span>
                      <span style={{ color: "var(--text-primary)", wordBreak: "break-word" }}>{dim(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </td>
      </tr>
    );
  }

  function renderGroupHeader(label: string, members: KPIRow[]) {
    const isOpen = !!expanded[label];
    const eventCount = members.length;
    const totalTime = members
      .filter((r) => r.metric_key === "time_in_phase")
      .reduce((s, r) => s + (Number(r.metric_value) || 0), 0);
    // Latest metadata wins for the group's claim context
    const latest = members[0]?.metadata || {};
    return (
      <tr key={`group-${label}`}
          onClick={() => toggleGroup(label)}
          style={{
            borderTop: "1px solid var(--border-color)",
            background: "var(--bg-page)",
            cursor: "pointer",
            fontWeight: 600,
          }}>
        <td colSpan={6} style={{ padding: "10px 12px", color: "var(--accent)" }}>
          {isOpen ? "▼" : "▶"} {label} <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 8 }}>({eventCount} event{eventCount === 1 ? "" : "s"})</span>
        </td>
        <td style={{ padding: "10px 12px", color: "var(--text-primary)" }}>{String(latest.client_name || "—")}</td>
        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>{String(latest.loss_address || "—")}</td>
        <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>{String(latest.email || "—")}</td>
        <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>{String(latest.onboard_type || "—")}</td>
        <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>{String(latest.referral_source || "—")}</td>
        <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>{String(latest.assigned_user_name || latest.assigned_pa_name || "—")}</td>
        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>—</td>
        <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>—</td>
        <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>—</td>
        <td style={{ padding: "10px 12px", color: "var(--text-secondary)", textAlign: "right" }}>{fmtDuration(totalTime)}</td>
      </tr>
    );
  }

  return (
    <div>
      {/* Summary tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
        <div style={{ ...cardStyle, padding: 12, textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Total Events</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{summary.total}</p>
        </div>
        <div style={{ ...cardStyle, padding: 12, textAlign: "center" }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Total Time on Files</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{fmtDuration(summary.totalTimeSeconds)}</p>
        </div>
        {Object.entries(summary.byMetric).map(([k, v]) => (
          <div key={k} style={{ ...cardStyle, padding: 12, textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{SUBMISSION_LABEL[k] || k}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>From</label>
            <input type="date" style={inputStyle} value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>To</label>
            <input type="date" style={inputStyle} value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Module</label>
            <select style={selectStyle} value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              <option value="">All modules</option>
              <option value="onboarding">onboarding</option>
              <option value="claim_health">claim_health</option>
              <option value="onboarder_kpi">onboarder_kpi (legacy)</option>
              <option value="estimator_kpi">estimator_kpi (legacy)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Submission Type</label>
            <select style={selectStyle} value={metricFilter} onChange={(e) => setMetricFilter(e.target.value)}>
              <option value="">All</option>
              {availableMetrics.map((m) => <option key={m} value={m}>{SUBMISSION_LABEL[m] || m}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Onboarder</label>
            <select style={selectStyle} value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
              <option value="">All</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name || u.email || u.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Group By</label>
            <select style={selectStyle} value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
              {GROUP_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Search</label>
            <input
              style={inputStyle}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Insured / address / adjuster"
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnOutline} onClick={loadRows} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button style={btnPrimary} onClick={exportCSV} disabled={loading || rows.length === 0}>
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 12, color: "var(--text-muted)" }}>
        <span><strong style={{ color: "var(--text-primary)" }}>{rows.length}</strong> rows</span>
        {rows.length === FETCH_LIMIT && (
          <>
            <span>·</span>
            <span style={{ color: "#fb923c" }}>Result capped at {FETCH_LIMIT}. Tighten the date range.</span>
          </>
        )}
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, padding: 0, overflow: "auto" }}>
        {error && <div style={{ padding: 16, color: "#ef4444" }}>Error: {error}</div>}
        {!error && rows.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {loading ? "Loading…" : "No rows match these filters."}
          </div>
        )}
        {!error && rows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "var(--bg-page)", color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>File #</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>Claim #</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>Start time</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>Completion time</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>Email</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>Name</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>Insured Name</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>Property Address</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>Email Address</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>Contract Created</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>Referral Source</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>Adjuster assigned</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>What type of Submission</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>Contract Signed Date</th>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 600 }}>Why corrected?</th>
                <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 600 }}>Time Tracking</th>
              </tr>
            </thead>
            <tbody>
              {grouped === null
                ? rows.flatMap((r) => {
                    const out: React.ReactElement[] = [renderEventRow(r, false)];
                    if (expandedRows.has(r.id)) out.push(renderDetailPanel(r));
                    return out;
                  })
                : grouped.flatMap(([label, members]) => {
                    const isOpen = !!expanded[label];
                    const items: React.ReactElement[] = [renderGroupHeader(label, members)];
                    if (isOpen) {
                      for (const r of members) {
                        items.push(renderEventRow(r, true));
                        if (expandedRows.has(r.id)) items.push(renderDetailPanel(r));
                      }
                    }
                    return items;
                  })
              }
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
