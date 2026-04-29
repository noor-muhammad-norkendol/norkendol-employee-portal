"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { cardStyle, inputStyle, labelStyle, selectStyle, btnPrimary, btnOutline } from "@/lib/styles";
import { STATUS_LABELS, type OnboardingStatus } from "@/types/onboarder-kpi";

// Humanize a status code (e.g., "step_3" → "48hr Follow-Up"). Returns the
// raw code as fallback if the map doesn't recognize it.
function phaseLabel(code: unknown): string {
  if (!code) return "";
  const k = String(code).trim();
  return STATUS_LABELS[k as OnboardingStatus] || k;
}

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
  department: string | null;
}

// Module-aware user dropdown: when a module is selected, only show users
// whose department actually does that work. Onboarder spoke = Intake dept;
// other spokes get added here as they come online.
const MODULE_DEPARTMENTS: Record<string, { departments: string[]; userLabel: string }> = {
  onboarder_kpi: { departments: ['Intake'], userLabel: 'Onboarder' },
};

const FETCH_LIMIT = 1000;

// Pretty-print metric_key for the Submission Type column
const SUBMISSION_LABEL: Record<string, string> = {
  claim_abandoned: "Abandoned",
  claim_erroneous: "Erroneous",
  claim_revised: "Revised",
  phase_completed: "Phase Completed",
  time_in_phase: "Time in Phase",
};

type GroupBy = "none" | "file_number" | "client_name" | "user_name" | "referral_source" | "assigned_user_name";

const GROUP_OPTIONS: { key: GroupBy; label: string }[] = [
  { key: "file_number", label: "File Number" },
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

// Resolve the actual referral source for display. When the dropdown enum is
// "Contractor", show the contractor company (or contractor name). When it's
// anything else (named individual, "Other", etc.), show as-is.
function resolveReferralSource(m: Record<string, unknown>): string {
  const raw = String(m.referral_source || "").trim();
  if (raw.toLowerCase() === "contractor") {
    const co = String(m.contractor_company || "").trim();
    const name = String(m.contractor_name || "").trim();
    if (co && name) return `${co} (${name})`;
    if (co) return co;
    if (name) return name;
    return "Contractor";
  }
  return raw || "—";
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
  const [moduleFilter, setModuleFilter] = useState<string>("onboarder_kpi");
  const [metricFilter, setMetricFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [groupBy, setGroupBy] = useState<GroupBy>("file_number");

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
        .select("id, full_name, email, department")
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
    // Hide org-level aggregate rows (avg_*, total_*) — they have no file_number
    // because they're not tied to a specific claim. They live on the Dashboard tab.
    result = result.filter((r) => !!r.metadata?.file_number);
    if (userFilter) {
      result = result.filter((r) => r.metadata?.user_id === userFilter);
    }
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase().trim();
      result = result.filter((r) => {
        const m = r.metadata || {};
        const fields = [
          m.file_number, m.claim_number, m.policy_number,
          m.client_name, m.loss_address, m.insurance_company,
          m.referral_source, m.contractor_company,
          m.assigned_pa_name, m.assigned_user_name,
        ];
        return fields.some((v) => String(v || "").toLowerCase().includes(t));
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

  // Module-aware user dropdown — narrow to the departments that actually
  // do this spoke's work. If the module has no mapping yet, fall through
  // to the full directory.
  const moduleConfig = MODULE_DEPARTMENTS[moduleFilter];
  const eligibleUsers = useMemo(() => {
    if (!moduleConfig) return users;
    return users.filter(
      (u) => u.department && moduleConfig.departments.includes(u.department)
    );
  }, [users, moduleConfig]);

  // If the active module changes and the previously-picked user is no longer
  // in the eligible list, clear the user filter so the UI can't show a
  // hidden-but-active filter that won't match any visible row.
  useEffect(() => {
    if (!userFilter) return;
    const stillEligible = eligibleUsers.some((u) => u.id === userFilter);
    if (!stillEligible) setUserFilter("");
  }, [eligibleUsers, userFilter]);

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

  // Two-sheet xlsx export.
  //
  // Sheet 1 "Activity" — mirrors the screen's parent/child layout using Excel's
  // native row outlining. Each claim is a level-0 parent row; its events are
  // level-1 children below it. Click +/- in Excel's gutter to expand/collapse
  // a claim's events, just like the [▶] on screen.
  //
  // Sheet 2 "Claims Summary" — flat one-row-per-claim with aggregates (total
  // time, current phase, outcome) for sorting/filtering in Excel. This is the
  // sheet for "who took the longest to onboard" questions.
  //
  // xlsx is dynamically imported to keep the EI page bundle slim — same
  // pattern as src/app/dashboard/tpn-admin/page.tsx (READ-side import).
  async function exportExcel() {
    const XLSX = await import("xlsx");

    // Group rows by file_number (rows are already filtered + aggregate-stripped)
    const claimsByFile = new Map<string, KPIRow[]>();
    for (const r of rows) {
      const fn = String(r.metadata?.file_number || "").trim();
      if (!fn) continue;
      if (!claimsByFile.has(fn)) claimsByFile.set(fn, []);
      claimsByFile.get(fn)!.push(r);
    }

    // ── Sheet 1: Activity (outlined parent/child) ────────
    const activityHeader = [
      "File #", "Claim #", "Start time", "Completion time", "Name",
      "Insured Name", "Property Address", "Email Address",
      "Contract Created", "Source", "Adjuster Assigned",
      "Submission Type", "Contract Signed Date", "Why Corrected",
      "Time Tracking",
    ];
    const activityAOA: (string | number)[][] = [activityHeader];
    const rowMeta: { level: number }[] = [{ level: 0 }]; // header

    for (const [fileNum, members] of claimsByFile.entries()) {
      // Sort newest-first within each claim so [0] is the latest event
      const sorted = [...members].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latest = sorted[0]?.metadata || {};

      const totalSeconds = members
        .filter((r) => r.metric_key === "time_in_phase")
        .reduce((s, r) => s + (Number(r.metric_value) || 0), 0);

      // Parent row — only the 7 canonical claim-level fields populated; the
      // 8 per-event columns are left blank to match the screen's parent row
      // (which only shows File# / Insured / Address / Contract Created /
      // Source / Adjuster / Time Tracking).
      activityAOA.push([
        fileNum,
        "",                                                  // Claim # — per-event
        "",                                                  // Start time — per-event
        "",                                                  // Completion time — per-event
        "",                                                  // Name (onboarder) — per-event
        String(latest.client_name || ""),
        String(latest.loss_address || ""),
        "",                                                  // Email Address — per-event
        String(latest.onboard_type || ""),
        resolveReferralSource(latest as Record<string, unknown>),
        String(latest.assigned_user_name || latest.assigned_pa_name || ""),
        "",                                                  // Submission Type — per-event
        "",                                                  // Contract Signed Date — per-event
        "",                                                  // Why Corrected — per-event
        fmtDuration(totalSeconds),
      ]);
      rowMeta.push({ level: 0 });

      // Child rows — one per event, newest-first to match the screen.
      // All 15 columns populated; Submission Type uses the plain event label
      // exactly as the on-screen sub-table renders it.
      for (const r of sorted) {
        const m = r.metadata || {};
        const onboarderName = String(m.user_name || userName(m.user_id as string | undefined));
        const submissionLabel = SUBMISSION_LABEL[r.metric_key] || r.metric_key;
        const isTime = r.metric_key === "time_in_phase";
        activityAOA.push([
          String(m.file_number || ""),
          String(m.claim_number || ""),
          fmtTime(r.created_at),
          fmtTime(r.created_at),
          onboarderName,
          String(m.client_name || ""),
          String(m.loss_address || ""),
          String(m.email || ""),
          String(m.onboard_type || ""),
          resolveReferralSource(m as Record<string, unknown>),
          String(m.assigned_user_name || m.assigned_pa_name || ""),
          submissionLabel,
          String(m.contract_signed_date || ""),
          Array.isArray(m.fields_changed) ? (m.fields_changed as string[]).join("; ") : "",
          isTime ? fmtDuration(Number(r.metric_value)) : "",
        ]);
        rowMeta.push({ level: 1 });
      }
    }

    const activityWs = XLSX.utils.aoa_to_sheet(activityAOA);
    activityWs["!rows"] = rowMeta;
    // Show parent ABOVE its children in Excel's outline (default is below).
    (activityWs as unknown as Record<string, unknown>)["!outline"] = { summaryBelow: false };

    // ── Sheet 2: Claims Summary (flat, with humanized phase) ─────
    const claimsSummary = Array.from(claimsByFile.entries()).map(([fileNum, members]) => {
      const sorted = [...members].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latest = sorted[0]?.metadata || {};
      const earliestRow = sorted[sorted.length - 1];

      const totalSeconds = members
        .filter((r) => r.metric_key === "time_in_phase")
        .reduce((s, r) => s + (Number(r.metric_value) || 0), 0);

      const onboarderNames = Array.from(new Set(
        members.map((r) => String(r.metadata?.user_name || "")).filter(Boolean)
      )).join(", ");

      // Current phase = the phase context of the most recent event.
      // phase_completed → to_phase ; time_in_phase → phase ;
      // claim_abandoned/erroneous/revised → from_phase
      let currentPhaseCode = "";
      const top = sorted[0];
      if (top) {
        const tm = top.metadata || {};
        if (top.metric_key === "phase_completed") currentPhaseCode = String(tm.to_phase || "");
        else if (top.metric_key === "time_in_phase") currentPhaseCode = String(tm.phase || "");
        else currentPhaseCode = String(tm.from_phase || "");
      }

      const hasAbandoned = members.some((r) => r.metric_key === "claim_abandoned");
      const hasErroneous = members.some((r) => r.metric_key === "claim_erroneous");
      const outcome = hasAbandoned ? "Abandoned" : hasErroneous ? "Erroneous" : "Active";

      return {
        "File #": fileNum,
        "Claim #": String(latest.claim_number || ""),
        "Policy #": String(latest.policy_number || ""),
        "Insured Name": String(latest.client_name || ""),
        "Property Address": String(latest.loss_address || ""),
        "Insurance Company": String(latest.insurance_company || ""),
        "Contract Type": String(latest.onboard_type || ""),
        "Source": resolveReferralSource(latest as Record<string, unknown>),
        "Adjuster Assigned": String(latest.assigned_user_name || ""),
        "Public Adjuster": String(latest.assigned_pa_name || ""),
        "Onboarder(s)": onboarderNames,
        "Total Events": members.length,
        "Total Time on File": fmtDuration(totalSeconds),
        "Total Time (seconds)": totalSeconds,
        "Current Phase": phaseLabel(currentPhaseCode),
        "First Touched": fmtTime(earliestRow.created_at),
        "Last Activity": fmtTime(sorted[0].created_at),
        "Outcome": outcome,
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, activityWs, "Activity");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(claimsSummary), "Claims Summary");
    XLSX.writeFile(wb, `onboarder-kpi-${dateStart}-to-${dateEnd}.xlsx`);
  }

  // ── Render helpers ──────────────────────────

  function renderEventRow(r: KPIRow, indent: boolean = false) {
    const m = r.metadata || {};
    const submissionLabel = SUBMISSION_LABEL[r.metric_key] || r.metric_key;
    const isTime = r.metric_key === "time_in_phase";
    const timeStr = isTime ? fmtDuration(Number(r.metric_value)) : "—";
    const cell: React.CSSProperties = { padding: "6px 10px", color: "var(--text-secondary)", whiteSpace: "nowrap" };
    const isRowOpen = expandedRows.has(r.id);
    // When indented under a group, the file # column shows the event label
    // (Phase Completed / Abandoned / etc.) — the file number is on the parent.
    // When flat (no grouping), the file # column shows the file number itself.
    const firstColLabel = indent ? submissionLabel : String(m.file_number || "—");
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
          {firstColLabel}
        </td>
        <td style={{ ...cell, color: "var(--text-primary)", fontWeight: 600 }}>{String(m.client_name || "—")}</td>
        <td style={{ ...cell, maxWidth: 280, whiteSpace: "normal" }}>{String(m.loss_address || "—")}</td>
        <td style={cell}>{String(m.onboard_type || "—")}</td>
        <td style={cell}>{resolveReferralSource(m)}</td>
        <td style={cell}>{String(m.assigned_user_name || m.assigned_pa_name || "—")}</td>
        <td style={{ ...cell, textAlign: "right" }}>{timeStr}</td>
      </tr>
    );
  }

  // Detail panel rendered as a colspan'd sub-row when [+] is clicked.
  // Shows every captured field grouped by section. colSpan adapts to the
  // surrounding table (7 in the main 7-col table, 15 inside the group sub-table).
  function renderDetailPanel(r: KPIRow, colSpan: number = 7) {
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
        <td colSpan={colSpan} style={{ padding: 16 }}>
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

  // 15-column detailed row used inside the group sub-table. Mirrors the
  // original Onboarding Tracker xlsx columns. Each cell renders the per-event
  // value; canonical claim fields will repeat across siblings — that's fine
  // since the parent group header already summarizes them.
  function renderDetailedEventRow(r: KPIRow) {
    const m = r.metadata || {};
    const onboarderName = String(m.user_name || userName(m.user_id as string | undefined));
    const submissionLabel = SUBMISSION_LABEL[r.metric_key] || r.metric_key;
    const isTime = r.metric_key === "time_in_phase";
    const timeStr = isTime ? fmtDuration(Number(r.metric_value)) : "—";
    const fieldsChanged = Array.isArray(m.fields_changed) ? (m.fields_changed as string[]).join(", ") : "—";
    const cell: React.CSSProperties = { padding: "6px 10px", color: "var(--text-secondary)", whiteSpace: "nowrap" };
    const isRowOpen = expandedRows.has(r.id);
    return (
      <tr key={r.id} style={{ borderTop: "1px solid var(--border-color)" }}>
        <td style={{ ...cell, color: "var(--accent)", fontWeight: 600 }}>
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
        <td style={cell}>{onboarderName}</td>
        <td style={{ ...cell, color: "var(--text-primary)", fontWeight: 600 }}>{String(m.client_name || "—")}</td>
        <td style={{ ...cell, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>{String(m.loss_address || "—")}</td>
        <td style={cell}>{String(m.email || "—")}</td>
        <td style={cell}>{String(m.onboard_type || "—")}</td>
        <td style={cell}>{resolveReferralSource(m)}</td>
        <td style={cell}>{String(m.assigned_user_name || m.assigned_pa_name || "—")}</td>
        <td style={{ ...cell, color: "var(--text-primary)", fontWeight: 600 }}>{submissionLabel}</td>
        <td style={cell}>{String(m.contract_signed_date || "—")}</td>
        <td style={{ ...cell, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "normal" }}>{fieldsChanged}</td>
        <td style={{ ...cell, textAlign: "right" }}>{timeStr}</td>
      </tr>
    );
  }

  // Sub-table rendered as a single colspan'd row under an expanded group.
  // Re-introduces the OLD 15-column detailed view (the original Onboarding
  // Tracker layout) so all per-event detail lives here, not on the main bar.
  function renderGroupChildrenTable(label: string, members: KPIRow[]) {
    const subTh: React.CSSProperties = {
      textAlign: "left", padding: "8px 10px", fontWeight: 700,
      borderBottom: "1px solid var(--border-color)",
    };
    return (
      <tr key={`children-${label}`} style={{ background: "var(--bg-surface)" }}>
        <td colSpan={7} style={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "var(--bg-page)", color: "var(--text-primary)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                <th style={subTh}>File #</th>
                <th style={subTh}>Claim #</th>
                <th style={subTh}>Start time</th>
                <th style={subTh}>Completion time</th>
                <th style={subTh}>Name</th>
                <th style={subTh}>Insured Name</th>
                <th style={subTh}>Property Address</th>
                <th style={subTh}>Email Address</th>
                <th style={subTh}>Contract Created</th>
                <th style={subTh}>Source</th>
                <th style={subTh}>Adjuster Assigned</th>
                <th style={subTh}>Submission Type</th>
                <th style={subTh}>Contract Signed</th>
                <th style={subTh}>Why Corrected</th>
                <th style={{ ...subTh, textAlign: "right" }}>Time Tracking</th>
              </tr>
            </thead>
            <tbody>
              {members.flatMap((r) => {
                const out: React.ReactElement[] = [renderDetailedEventRow(r)];
                if (expandedRows.has(r.id)) out.push(renderDetailPanel(r, 15));
                return out;
              })}
            </tbody>
          </table>
        </td>
      </tr>
    );
  }

  function renderGroupHeader(label: string, members: KPIRow[]) {
    const isOpen = !!expanded[label];
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
        <td style={{ padding: "10px 12px", color: "var(--accent)" }}>
          {isOpen ? "▼" : "▶"} {label}
        </td>
        <td style={{ padding: "10px 12px", color: "var(--text-primary)" }}>{String(latest.client_name || "—")}</td>
        <td style={{ padding: "10px 12px", color: "var(--text-primary)", maxWidth: 280, whiteSpace: "normal" }}>{String(latest.loss_address || "—")}</td>
        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{String(latest.onboard_type || "—")}</td>
        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{resolveReferralSource(latest as Record<string, unknown>)}</td>
        <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{String(latest.assigned_user_name || latest.assigned_pa_name || "—")}</td>
        <td style={{ padding: "10px 12px", color: "var(--text-primary)", textAlign: "right" }}>{fmtDuration(totalTime)}</td>
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
              <option value="onboarder_kpi">onboarder_kpi</option>
              <option value="claim_health">claim_health</option>
              <option value="estimator_kpi">estimator_kpi</option>
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
            <label style={labelStyle}>{moduleConfig?.userLabel || "User"}</label>
            <select style={selectStyle} value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
              <option value="">All</option>
              {eligibleUsers.map((u) => (
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
            <button style={btnPrimary} onClick={exportExcel} disabled={loading || rows.length === 0}>
              Export to Excel
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
              <tr style={{ background: "var(--bg-page)", color: "var(--text-primary)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700 }}>File #</th>
                <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700 }}>Insured Name</th>
                <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700 }}>Property Address</th>
                <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700 }}>Contract Created</th>
                <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700 }}>Source</th>
                <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 700 }}>Adjuster Assigned</th>
                <th style={{ textAlign: "right", padding: "10px 12px", fontWeight: 700 }}>Time Tracking</th>
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
                      items.push(renderGroupChildrenTable(label, members));
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
