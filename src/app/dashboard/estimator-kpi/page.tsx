"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useEstimates, useCreateEstimate, useUpdateEstimate, useDeleteEstimate, useSearchEstimatesByFileNumber } from "@/hooks/estimator-kpi/useEstimates";
import { useEstimatorKPIs, useWriteEstimatorKPISnapshots, calculateEstimatorMetrics, calculateOverallScore } from "@/hooks/estimator-kpi/useEstimatorKPIs";
import { useEKSupabase } from "@/hooks/estimator-kpi/useSupabase";
import { useClaimLookup, type ClaimLookupMatch, type LookupField } from "@/hooks/useClaimLookup";
import ClaimMatchBanner from "@/components/ClaimMatchBanner";
import {
  Estimate, CreateEstimateInput, EstimateStatus,
  STATUS_OPTIONS, PERIL_OPTIONS, SEVERITY_OPTIONS, PROPERTY_TYPE_OPTIONS,
  ALLOWED_TRANSITIONS,
} from "@/types/estimator-kpi";

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

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function hrs(minutes: number): string {
  if (!minutes) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  "assigned": { bg: "rgba(148,163,184,0.15)", color: "#94a3b8" },
  "in-progress": { bg: "rgba(96,165,250,0.15)", color: "#60a5fa" },
  "blocked": { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
  "review": { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
  "sent-to-carrier": { bg: "rgba(167,139,250,0.15)", color: "#a78bfa" },
  "revision-requested": { bg: "rgba(251,146,60,0.15)", color: "#fb923c" },
  "revised": { bg: "rgba(45,212,191,0.15)", color: "#2dd4bf" },
  "settled": { bg: "rgba(74,222,128,0.15)", color: "#4ade80" },
  "closed": { bg: "rgba(148,163,184,0.15)", color: "#94a3b8" },
  "unable-to-start": { bg: "rgba(239,68,68,0.1)", color: "#f87171" },
};

// Statuses where estimate value field becomes visible
const VALUE_STATUSES: EstimateStatus[] = ['sent-to-carrier', 'revision-requested', 'revised', 'settled', 'closed'];

const EMPTY_FORM: CreateEstimateInput = {
  file_number: "", client_name: "", claim_number: null, policy_number: null,
  property_type: null, loss_state: null, loss_date: null,
  referral_source: null, referral_representative: null,
  carrier: null, carrier_adjuster: null,
  contractor_company: null, contractor_rep: null, contractor_rep_email: null, contractor_rep_phone: null,
  peril: null, severity: null, estimate_value: 0,
  active_time_minutes: 0, revision_time_minutes: 0, revisions: 0,
  status: "assigned", notes: null,
};

type StatMetric = "dph" | "dpm" | "totalValue" | "fta" | "avgSeverity" | "count";
const STAT_LABELS: Record<StatMetric, string> = {
  dph: "$/Hour", dpm: "$/Minute", totalValue: "Total Value",
  fta: "First-Time Approval %", avgSeverity: "Avg Severity", count: "Estimates",
};

export default function EstimatorKPIPage() {
  const { supabase, userInfo } = useEKSupabase();
  const { data: estimates = [], isLoading } = useEstimates();
  const createMut = useCreateEstimate();
  const updateMut = useUpdateEstimate();
  const deleteMut = useDeleteEstimate();
  const teamKPIs = useEstimatorKPIs(estimates);
  const writeKPIs = useWriteEstimatorKPISnapshots();

  const [tab, setTab] = useState<"current" | "history" | "add">("current");
  const [form, setForm] = useState<CreateEstimateInput>({ ...EMPTY_FORM });
  const [editId, setEditId] = useState<string | null>(null);
  const [statMetric, setStatMetric] = useState<StatMetric>("dph");
  const [differentReferral, setDifferentReferral] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [linkedParent, setLinkedParent] = useState<Estimate | null>(null);
  const [timeFilter, setTimeFilter] = useState<"day" | "week" | "month">("week");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const { results: fileMatches } = useSearchEstimatesByFileNumber(editId ? "" : form.file_number);

  // Shared claim lookup — fires when NO revision match found
  const [ekLookupField, setEkLookupField] = useState<LookupField>('file_number');
  const ekLookupTerm = ekLookupField === 'file_number' ? form.file_number
    : ekLookupField === 'claim_number' ? (form.claim_number || '')
    : form.client_name;
  const { matches: claimMatches, searching: claimSearching, clear: clearLookup } = useClaimLookup({
    supabase, orgId: userInfo?.orgId, searchTerm: ekLookupTerm, searchField: ekLookupField,
    enabled: !editId && fileMatches.length === 0,
  });

  function handleEkClaimAccept(match: ClaimLookupMatch) {
    setForm((prev) => ({
      ...prev,
      claim_number: match.claim_number || prev.claim_number,
      file_number: match.file_number || prev.file_number,
      policy_number: match.policy_number || prev.policy_number,
      client_name: match.client_name || prev.client_name,
      property_type: (match.property_type as typeof prev.property_type) || prev.property_type,
      loss_state: match.state || prev.loss_state,
      loss_date: match.loss_date || prev.loss_date,
      referral_source: match.referral_source || prev.referral_source,
      referral_representative: match.referral_representative || prev.referral_representative,
      carrier: match.carrier || prev.carrier,
      carrier_adjuster: match.carrier_adjuster || prev.carrier_adjuster,
      contractor_company: match.contractor_company || prev.contractor_company,
      contractor_rep: match.contractor_rep || prev.contractor_rep,
      contractor_rep_email: match.contractor_rep_email || prev.contractor_rep_email,
      contractor_rep_phone: match.contractor_rep_phone || prev.contractor_rep_phone,
      peril: (match.peril as typeof prev.peril) || prev.peril,
    }));
  }

  // Sidebar menu actions
  useEffect(() => {
    function handle(e: Event) {
      const { section, item } = (e as CustomEvent).detail;
      if (section !== "estimator-kpi") return;
      if (item === "Today") { setTab("current"); setTimeFilter("day"); setEditId(null); }
      else if (item === "This Week") { setTab("current"); setTimeFilter("week"); setEditId(null); }
      else if (item === "This Month") { setTab("current"); setTimeFilter("month"); setEditId(null); }
      else if (item === "History") { setTab("history"); setEditId(null); }
      else if (item === "Add Entry") { setTab("add"); setEditId(null); setForm({ ...EMPTY_FORM }); }
      else if (item === "Performance") { setTab("current"); }
    }
    window.addEventListener("sidebar-action", handle);
    return () => window.removeEventListener("sidebar-action", handle);
  }, []);

  // Write KPI snapshots once per page load
  const kpiWritten = useRef(false);
  useEffect(() => {
    if (estimates.length > 0 && !kpiWritten.current && !writeKPIs.isPending) {
      kpiWritten.current = true;
      writeKPIs.mutate(teamKPIs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimates.length]);

  // Auto-detect matching file numbers for revision linking + auto-fill
  useEffect(() => {
    if (fileMatches.length > 0 && !editId) {
      const parent = fileMatches[0];
      setLinkedParent(parent);
      // Auto-fill from parent — everything except time, status, notes, and estimate value
      setForm((prev) => ({
        ...prev,
        claim_number: parent.claim_number || prev.claim_number,
        policy_number: parent.policy_number || prev.policy_number,
        client_name: parent.client_name || prev.client_name,
        property_type: parent.property_type || prev.property_type,
        loss_state: parent.loss_state || prev.loss_state,
        loss_date: parent.loss_date || prev.loss_date,
        referral_source: parent.referral_source || prev.referral_source,
        referral_representative: parent.referral_representative || prev.referral_representative,
        carrier: parent.carrier || prev.carrier,
        carrier_adjuster: parent.carrier_adjuster || prev.carrier_adjuster,
        contractor_company: parent.contractor_company || prev.contractor_company,
        contractor_rep: parent.contractor_rep || prev.contractor_rep,
        contractor_rep_email: parent.contractor_rep_email || prev.contractor_rep_email,
        contractor_rep_phone: parent.contractor_rep_phone || prev.contractor_rep_phone,
        peril: parent.peril || prev.peril,
        severity: parent.severity ?? prev.severity,
      }));
    } else if (fileMatches.length === 0) {
      setLinkedParent(null);
    }
  }, [fileMatches, editId]);

  // Time-based filter for Current tab
  const filterStartMs = useMemo(() => {
    const d = new Date();
    if (timeFilter === "day") {
      d.setHours(0, 0, 0, 0);
    } else if (timeFilter === "week") {
      d.setDate(d.getDate() - d.getDay()); // Sunday
      d.setHours(0, 0, 0, 0);
    } else {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
    }
    return d.getTime();
  }, [timeFilter]);

  const filteredCurrent = useMemo(
    () => estimates.filter((e) => new Date(e.date_received).getTime() >= filterStartMs),
    [estimates, filterStartMs]
  );

  // History date range filter
  const filteredHistory = useMemo(() => {
    if (!historyFrom && !historyTo) return estimates;
    return estimates.filter((e) => {
      const d = e.date_received;
      if (historyFrom && d < historyFrom) return false;
      if (historyTo && d > historyTo) return false;
      return true;
    });
  }, [estimates, historyFrom, historyTo]);

  // Personal metrics
  const myMetrics = useMemo(() => {
    if (!userInfo) return null;
    return calculateEstimatorMetrics(estimates, userInfo.userId, userInfo.fullName);
  }, [estimates, userInfo]);

  const myScore = useMemo(() => myMetrics ? calculateOverallScore(myMetrics) : 0, [myMetrics]);

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit() {
    setFormError(null);
    if (!form.file_number || !form.client_name) {
      setFormError("File Number and Client Name are required.");
      return;
    }
    // Auto-copy contractor → referral if checkbox is unchecked
    const submission = { ...form };
    if (!differentReferral) {
      submission.referral_source = form.contractor_company;
      submission.referral_representative = form.contractor_rep;
    }
    try {
      if (editId) {
        await updateMut.mutateAsync({ id: editId, ...submission });
        setEditId(null);
      } else {
        await createMut.mutateAsync({ ...submission, parentEstimateId: linkedParent?.id || null });
      }
      setForm({ ...EMPTY_FORM });
      setDifferentReferral(false);
      setLinkedParent(null);
      setTab("current");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed. The database table may not exist yet.";
      setFormError(msg);
    }
  }

  function startEdit(e: Estimate) {
    const refDifferent = !!(e.referral_source && e.contractor_company && e.referral_source !== e.contractor_company);
    setDifferentReferral(refDifferent);
    setFormError(null);
    setForm({
      file_number: e.file_number, client_name: e.client_name,
      claim_number: e.claim_number, policy_number: e.policy_number,
      property_type: e.property_type, loss_state: e.loss_state, loss_date: e.loss_date,
      referral_source: e.referral_source, referral_representative: e.referral_representative,
      carrier: e.carrier, carrier_adjuster: e.carrier_adjuster,
      contractor_company: e.contractor_company, contractor_rep: e.contractor_rep,
      contractor_rep_email: e.contractor_rep_email, contractor_rep_phone: e.contractor_rep_phone,
      peril: e.peril, severity: e.severity, estimate_value: e.estimate_value,
      active_time_minutes: e.active_time_minutes, revision_time_minutes: e.revision_time_minutes,
      revisions: e.revisions, status: e.status, notes: e.notes,
    });
    setEditId(e.id);
    setTab("add");
  }

  function getStatValue(): string {
    if (!myMetrics) return "—";
    switch (statMetric) {
      case "dph": return fmt(myMetrics.dollarsPerHour);
      case "dpm": return fmt(myMetrics.dollarsPerMinute);
      case "totalValue": return fmt(myMetrics.totalValue);
      case "fta": return myMetrics.firstTimeApprovalRate.toFixed(1) + "%";
      case "avgSeverity": {
        const sevs = Object.entries(myMetrics.severityBreakdown);
        if (sevs.length === 0) return "—";
        const total = sevs.reduce((s, [sev, count]) => s + Number(sev) * count, 0);
        const cnt = sevs.reduce((s, [, count]) => s + count, 0);
        return (total / cnt).toFixed(1);
      }
      case "count": return String(myMetrics.estimateCount);
    }
  }

  if (isLoading) {
    return <div style={{ padding: 40, color: "var(--text-secondary)" }}>Loading estimates…</div>;
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header + Stats Card */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Estimator KPI</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            {estimates.length} estimate{estimates.length !== 1 ? "s" : ""} total · Score: {myScore}/100
          </p>
        </div>

        {/* Personal Stats Card */}
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 16, padding: "12px 18px" }}>
          <select
            style={{ ...selectStyle, width: "auto", fontSize: 11, padding: "4px 8px" }}
            value={statMetric}
            onChange={(e) => setStatMetric(e.target.value as StatMetric)}
          >
            {(Object.keys(STAT_LABELS) as StatMetric[]).map((k) => (
              <option key={k} value={k}>{STAT_LABELS[k]}</option>
            ))}
          </select>
          <span style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{getStatValue()}</span>
        </div>
      </div>

      {/* History date range filter */}
      {tab === "history" && (
        <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>From</label>
          <input type="date" style={{ ...inputStyle, width: 160 }} value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>To</label>
          <input type="date" style={{ ...inputStyle, width: 160 }} value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
          {(historyFrom || historyTo) && (
            <button style={{ ...btnOutline, fontSize: 11 }} onClick={() => { setHistoryFrom(""); setHistoryTo(""); }}>Clear</button>
          )}
        </div>
      )}

      {/* ═══ ESTIMATES TABLE (Current Week or History) ═══ */}
      {(tab === "current" || tab === "history") && (
        <div style={cardStyle}>
          {(() => {
            const rows = tab === "current" ? filteredCurrent : filteredHistory;
            if (rows.length === 0) {
              return (
                <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 40 }}>
                  {tab === "current"
                    ? "No estimates this week. Click Add Entry to get started."
                    : "No estimates yet."}
                </p>
              );
            }
            return (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>File #</th>
                      <th style={thStyle}>Client</th>
                      <th style={thStyle}>Peril</th>
                      <th style={thStyle}>Sev</th>
                      <th style={thStyle}>Active</th>
                      <th style={thStyle}>Blocked</th>
                      <th style={thStyle}>Rev Time</th>
                      <th style={thStyle}>Value</th>
                      <th style={thStyle}>$/hr</th>
                      <th style={thStyle}>Revisions</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => {
                      const activeHrs = (e.active_time_minutes + e.revision_time_minutes) / 60;
                      const dph = activeHrs > 0 ? e.estimate_value / activeHrs : 0;
                      const sc = STATUS_COLORS[e.status] || STATUS_COLORS["assigned"];
                      return (
                        <tr key={e.id}>
                          <td style={tdStyle}>
                            {e.file_number}
                            {e.revision_number > 0 && (
                              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: "#60a5fa", background: "rgba(96,165,250,0.15)", padding: "1px 5px", borderRadius: 3 }}>
                                Rev {e.revision_number}
                              </span>
                            )}
                          </td>
                          <td style={tdStyle}>{e.client_name}</td>
                          <td style={tdStyle}>{e.peril || "—"}</td>
                          <td style={tdStyle}>{e.severity || "—"}</td>
                          <td style={tdStyle}>{hrs(e.active_time_minutes)}</td>
                          <td style={{ ...tdStyle, color: e.blocked_time_minutes > 0 ? "#ef4444" : "var(--text-primary)" }}>
                            {hrs(e.blocked_time_minutes)}
                          </td>
                          <td style={tdStyle}>{hrs(e.revision_time_minutes)}</td>
                          <td style={tdStyle}>{fmt(e.estimate_value)}</td>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{fmt(dph)}</td>
                          <td style={tdStyle}>{e.revisions}</td>
                          <td style={tdStyle}>
                            <span style={{
                              display: "inline-block", padding: "2px 8px", borderRadius: 4,
                              fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color,
                            }}>
                              {e.status}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button style={{ ...btnOutline, fontSize: 11, padding: "3px 8px" }} onClick={() => startEdit(e)}>Edit</button>
                              <button
                                style={{ ...btnOutline, fontSize: 11, padding: "3px 8px", color: "#ef4444", borderColor: "#ef4444" }}
                                onClick={() => { if (confirm("Delete this estimate?")) deleteMut.mutate(e.id); }}
                              >×</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══ ADD / EDIT TAB ═══ */}
      {tab === "add" && (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              {editId ? "Edit Estimate" : "New Estimate"}
            </h2>
            {userInfo && (
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
                {userInfo.fullName}
              </span>
            )}
          </div>

          {/* Section 1: File Info */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>File Info</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>File Number *</label>
              <input style={inputStyle} value={form.file_number} onChange={(e) => set("file_number", e.target.value)} placeholder="Enter file number" />
            </div>
            <div>
              <label style={labelStyle}>Claim Number</label>
              <input style={inputStyle} value={form.claim_number || ""} onChange={(e) => { set("claim_number", e.target.value || null); if (e.target.value.length >= 3) setEkLookupField('claim_number'); }} />
            </div>
            <div>
              <label style={labelStyle}>Policy Number</label>
              <input style={inputStyle} value={form.policy_number || ""} onChange={(e) => set("policy_number", e.target.value || null)} />
            </div>
          </div>

          {/* Revision link banner */}
          {linkedParent && !editId && (
            <div style={{ background: "rgba(96,165,250,0.1)", border: "1px solid #60a5fa", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#60a5fa", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                This file has a previous estimate from <strong>{linkedParent.date_received}</strong> ({linkedParent.client_name}).
                This entry will be saved as <strong>Revision {linkedParent.revision_number + 1}</strong>.
              </span>
              <button onClick={() => setLinkedParent(null)} style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>Dismiss</button>
            </div>
          )}

          {/* Shared claim lookup banner (only when no revision match) */}
          {!linkedParent && !editId && (
            <ClaimMatchBanner matches={claimMatches} searching={claimSearching} onAccept={handleEkClaimAccept} onDismiss={clearLookup} />
          )}

          {/* Section 2: Client Info */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Client Info</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Client Name *</label>
              <input style={inputStyle} value={form.client_name} onChange={(e) => set("client_name", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Property Type</label>
              <select style={selectStyle} value={form.property_type || ""} onChange={(e) => set("property_type", e.target.value || null)}>
                <option value="">Select…</option>
                {PROPERTY_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Loss State</label>
              <input style={inputStyle} value={form.loss_state || ""} onChange={(e) => set("loss_state", e.target.value || null)} placeholder="FL" />
            </div>
            <div>
              <label style={labelStyle}>Loss Date</label>
              <input type="date" style={inputStyle} value={form.loss_date || ""} onChange={(e) => set("loss_date", e.target.value || null)} />
            </div>
          </div>

          {/* Section 3: Carrier */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Carrier</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Carrier</label>
              <input style={inputStyle} value={form.carrier || ""} onChange={(e) => set("carrier", e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>Carrier Adjuster</label>
              <input style={inputStyle} value={form.carrier_adjuster || ""} onChange={(e) => set("carrier_adjuster", e.target.value || null)} />
            </div>
          </div>

          {/* Section 4: Contractor */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Contractor</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Contractor Company</label>
              <input style={inputStyle} value={form.contractor_company || ""} onChange={(e) => set("contractor_company", e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>Contractor Rep</label>
              <input style={inputStyle} value={form.contractor_rep || ""} onChange={(e) => set("contractor_rep", e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>Rep Email</label>
              <input style={inputStyle} value={form.contractor_rep_email || ""} onChange={(e) => set("contractor_rep_email", e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>Rep Phone</label>
              <input style={inputStyle} value={form.contractor_rep_phone || ""} onChange={(e) => set("contractor_rep_phone", e.target.value || null)} />
            </div>
          </div>
          {/* Referral checkbox */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer", marginBottom: 20 }}>
            <input type="checkbox" checked={differentReferral} onChange={(e) => setDifferentReferral(e.target.checked)} />
            Referral source is different from contractor
          </label>
          {differentReferral && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Referral Source</label>
                <input style={inputStyle} value={form.referral_source || ""} onChange={(e) => set("referral_source", e.target.value || null)} />
              </div>
              <div>
                <label style={labelStyle}>Referral Representative</label>
                <input style={inputStyle} value={form.referral_representative || ""} onChange={(e) => set("referral_representative", e.target.value || null)} />
              </div>
            </div>
          )}

          {/* Section 5: Estimate Details */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Estimate Details</p>
          <div style={{ display: "grid", gridTemplateColumns: VALUE_STATUSES.includes(form.status as EstimateStatus) ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Peril</label>
              <select style={selectStyle} value={form.peril || ""} onChange={(e) => set("peril", e.target.value || null)}>
                <option value="">Select…</option>
                {PERIL_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Severity</label>
              <select style={selectStyle} value={form.severity ?? ""} onChange={(e) => set("severity", e.target.value ? Number(e.target.value) : null)}>
                <option value="">Select…</option>
                {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={selectStyle} value={form.status || "assigned"} onChange={(e) => set("status", e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {VALUE_STATUSES.includes(form.status as EstimateStatus) && (
              <div>
                <label style={labelStyle}>Estimate Value ($)</label>
                <input type="number" style={inputStyle} value={form.estimate_value || ""} onChange={(e) => set("estimate_value", parseFloat(e.target.value) || 0)} />
              </div>
            )}
          </div>

          {/* Section 7: Time Tracking */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Time Tracking (minutes)</p>
          <div style={{ display: "grid", gridTemplateColumns: linkedParent && !editId ? "1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            {!(linkedParent && !editId) && (
              <>
                <div>
                  <label style={labelStyle}>Active Time</label>
                  <input type="number" style={inputStyle} value={form.active_time_minutes || ""} onChange={(e) => set("active_time_minutes", parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label style={labelStyle}>Revisions (#)</label>
                  <input type="number" style={inputStyle} value={form.revisions || ""} onChange={(e) => set("revisions", parseInt(e.target.value) || 0)} />
                </div>
              </>
            )}
            <div>
              <label style={labelStyle}>Revision Time</label>
              <input type="number" style={inputStyle} value={form.revision_time_minutes || ""} onChange={(e) => set("revision_time_minutes", parseInt(e.target.value) || 0)} />
            </div>
          </div>

          {/* Section 8: Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.notes || ""} onChange={(e) => set("notes", e.target.value || null)} placeholder="Any additional notes…" />
          </div>

          {formError && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: "#ef4444", fontSize: 13 }}>
              {formError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnPrimary} onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "Saving…" : "Save Entry"}
            </button>
            {editId && (
              <button style={btnOutline} onClick={() => { setEditId(null); setForm({ ...EMPTY_FORM }); setDifferentReferral(false); setFormError(null); }}>Cancel</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
