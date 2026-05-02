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
import { cardStyle, inputStyle, labelStyle, selectStyle, btnPrimary, btnOutline, thStyle, tdStyle } from "@/lib/styles";

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

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "assigned": { bg: "rgba(148,163,184,0.15)", text: "#94a3b8" },
  "in-progress": { bg: "rgba(96,165,250,0.15)", text: "#60a5fa" },
  "blocked": { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
  "review": { bg: "rgba(251,191,36,0.15)", text: "#fbbf24" },
  "sent-to-carrier": { bg: "rgba(167,139,250,0.15)", text: "#a78bfa" },
  "revision-requested": { bg: "rgba(251,146,60,0.15)", text: "#fb923c" },
  "revised": { bg: "rgba(45,212,191,0.15)", text: "#2dd4bf" },
  "settled": { bg: "rgba(74,222,128,0.15)", text: "#4ade80" },
  "closed": { bg: "rgba(148,163,184,0.15)", text: "#94a3b8" },
  "unable-to-start": { bg: "rgba(239,68,68,0.1)", text: "#f87171" },
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

  // Status pipeline counts (for the stat-tile bar)
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of estimates) counts[e.status] = (counts[e.status] || 0) + 1;
    return counts;
  }, [estimates]);

  // Active status filter for the stat-tile bar
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | null>(null);
  const tileFilteredCurrent = useMemo(
    () => statusFilter ? filteredCurrent.filter((e) => e.status === statusFilter) : filteredCurrent,
    [filteredCurrent, statusFilter]
  );

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
    <div style={{ padding: "24px 32px" }}>
      {/* ── Title row ── */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
        <div>
          <h1
            className="page-title text-5xl leading-none tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span
              style={{
                color: "var(--accent)",
                textShadow: "var(--accent-text-shadow)",
                fontWeight: 800,
              }}
            >
              Estimator
            </span>{" "}
            <span style={{ color: "var(--text)", fontWeight: 500, opacity: 0.92 }}>
              KPI
            </span>
          </h1>
          <p className="mt-3 text-sm flex items-center gap-3" style={{ color: "var(--text-dim)" }}>
            <span>
              <strong style={{ color: "var(--text)" }}>{estimates.length}</strong> estimate{estimates.length !== 1 ? "s" : ""}
            </span>
            <span style={{ color: "var(--text-faint)" }}>·</span>
            <span>
              Score: <strong style={{ color: "var(--green)" }}>{myScore}/100</strong>
            </span>
            <span style={{ color: "var(--text-faint)" }}>·</span>
            <span>
              <select
                value={statMetric}
                onChange={(e) => setStatMetric(e.target.value as StatMetric)}
                style={{
                  background: "transparent",
                  color: "var(--text-dim)",
                  border: "none",
                  fontSize: 13,
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {(Object.keys(STAT_LABELS) as StatMetric[]).map((k) => (
                  <option key={k} value={k} style={{ background: "var(--pad)", color: "var(--text)" }}>
                    {STAT_LABELS[k]}
                  </option>
                ))}
              </select>
              {": "}
              <strong style={{ color: "var(--accent)", textShadow: "var(--accent-text-shadow)" }}>
                {getStatValue()}
              </strong>
            </span>
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setTab("history"); setEditId(null); }}
            className="px-7 py-3.5 text-[15px] font-bold uppercase cursor-pointer transition-all"
            style={{
              background: tab === "history"
                ? "color-mix(in srgb, var(--accent) 14%, var(--bg))"
                : "var(--bg)",
              color: "var(--accent)",
              borderWidth: "2px",
              borderStyle: "solid",
              borderColor: "var(--accent)",
              borderRadius: "8px",
              fontFamily: "var(--font-display)",
              letterSpacing: "0.10em",
              textShadow: "var(--accent-text-shadow)",
              boxShadow: "0 0 16px color-mix(in srgb, var(--accent) 30%, transparent)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 14%, var(--bg))";
              e.currentTarget.style.boxShadow = "0 0 24px color-mix(in srgb, var(--accent) 50%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = tab === "history"
                ? "color-mix(in srgb, var(--accent) 14%, var(--bg))"
                : "var(--bg)";
              e.currentTarget.style.boxShadow = "0 0 16px color-mix(in srgb, var(--accent) 30%, transparent)";
            }}
          >
            History
          </button>
          <button
            onClick={() => { setTab("add"); setEditId(null); setForm({ ...EMPTY_FORM }); }}
            className="px-7 py-3.5 text-[15px] font-extrabold uppercase cursor-pointer transition-all"
            style={{
              background: "var(--cta-bg)",
              color: "var(--cta-text)",
              borderRadius: "8px",
              boxShadow: "0 0 22px color-mix(in srgb, var(--accent) 45%, transparent), 0 0 50px color-mix(in srgb, var(--magenta) 28%, transparent), 0 4px 14px rgba(0,0,0,0.30)",
              border: "none",
              fontFamily: "var(--font-display)",
              letterSpacing: "0.08em",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(1.08)";
              e.currentTarget.style.boxShadow = "0 0 32px color-mix(in srgb, var(--accent) 60%, transparent), 0 0 70px color-mix(in srgb, var(--magenta) 40%, transparent), 0 4px 16px rgba(0,0,0,0.30)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "none";
              e.currentTarget.style.boxShadow = "0 0 22px color-mix(in srgb, var(--accent) 45%, transparent), 0 0 50px color-mix(in srgb, var(--magenta) 28%, transparent), 0 4px 14px rgba(0,0,0,0.30)";
            }}
          >
            + Add Entry
          </button>
        </div>
      </div>

      {/* ── Stat tiles bar ── */}
      {(() => {
        const STAT_TILES: { key: EstimateStatus; label: string; token: string }[] = [
          { key: "assigned", label: "Assigned", token: "--text-dim" },
          { key: "in-progress", label: "In Progress", token: "--info" },
          { key: "blocked", label: "Blocked", token: "--red" },
          { key: "review", label: "Review", token: "--amber" },
          { key: "sent-to-carrier", label: "Sent to Carrier", token: "--violet" },
          { key: "settled", label: "Settled", token: "--green" },
        ];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {STAT_TILES.map((t) => {
              const count = statusCounts[t.key] || 0;
              const active = statusFilter === t.key && tab === "current";
              const tokenVar = `var(${t.token})`;
              const activeShadow = `0 0 0 1px ${tokenVar} inset, 0 0 24px color-mix(in srgb, ${tokenVar} 55%, transparent), 0 0 48px color-mix(in srgb, ${tokenVar} 22%, transparent)`;
              const hoverShadow = `0 0 18px color-mix(in srgb, ${tokenVar} 45%, transparent), 0 0 36px color-mix(in srgb, ${tokenVar} 18%, transparent)`;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab("current");
                    setStatusFilter(active ? null : t.key);
                  }}
                  className="relative overflow-hidden p-4 text-left flex flex-col gap-2 cursor-pointer transition-all"
                  style={{
                    background: active
                      ? `color-mix(in srgb, ${tokenVar} 14%, var(--pad))`
                      : "var(--pad)",
                    borderWidth: "1.5px",
                    borderStyle: "solid",
                    borderColor: active ? tokenVar : "var(--border)",
                    borderRadius: "var(--radius-card)",
                    boxShadow: active ? activeShadow : "var(--card-shadow)",
                    transitionProperty: "background, border-color, box-shadow, transform",
                    transitionDuration: "var(--transition-base)",
                  }}
                  onMouseEnter={(e) => {
                    if (active) return;
                    e.currentTarget.style.borderColor = tokenVar;
                    e.currentTarget.style.boxShadow = hoverShadow;
                    e.currentTarget.style.background = `color-mix(in srgb, ${tokenVar} 6%, var(--pad))`;
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    if (active) return;
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "var(--card-shadow)";
                    e.currentTarget.style.background = "var(--pad)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute left-0 right-0 top-0 h-[2px] pointer-events-none"
                    style={{
                      background: active ? tokenVar : "var(--card-stripe-bg)",
                      boxShadow: active
                        ? `0 0 14px ${tokenVar}, 0 0 32px color-mix(in srgb, ${tokenVar} 55%, transparent)`
                        : "var(--card-stripe-shadow)",
                    }}
                  />
                  <span
                    className="text-3xl font-extrabold leading-none"
                    style={{
                      color: tokenVar,
                      opacity: count > 0 ? 1 : 0.55,
                      textShadow: count > 0 && active
                        ? `0 0 6px ${tokenVar}, 0 0 18px color-mix(in srgb, ${tokenVar} 70%, transparent)`
                        : undefined,
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {count}
                  </span>
                  <span
                    className="text-[11px] font-semibold uppercase tracking-widest"
                    style={{
                      color: tokenVar,
                      opacity: active ? 1 : 0.78,
                      textShadow: active
                        ? `0 0 10px color-mix(in srgb, ${tokenVar} 70%, transparent)`
                        : undefined,
                      fontFamily: "var(--font-ui)",
                    }}
                  >
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })()}

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
      {(tab === "current" || tab === "history") && (() => {
        const rows = tab === "current" ? tileFilteredCurrent : filteredHistory;
        const sectionLabel = tab === "current"
          ? (statusFilter ? (STATUS_OPTIONS.find((s) => s === statusFilter) ?? statusFilter) : `Current ${timeFilter === "day" ? "Day" : timeFilter === "week" ? "Week" : "Month"}`)
          : "History";
        const STATUS_TOKEN_MAP: Record<string, string> = {
          "assigned": "--text-dim",
          "in-progress": "--info",
          "blocked": "--red",
          "review": "--amber",
          "sent-to-carrier": "--violet",
          "revision-requested": "--orange",
          "revised": "--info",
          "settled": "--green",
          "closed": "--text-faint",
          "unable-to-start": "--red",
        };
        const headerCellStyle: React.CSSProperties = {
          textAlign: "left",
          padding: "12px 12px",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          fontFamily: "var(--font-ui)",
        };
        const dataCellStyle: React.CSSProperties = {
          padding: "14px 12px",
          fontSize: 13,
          verticalAlign: "middle",
          color: "var(--text)",
        };
        const pillStyle = (token: string): React.CSSProperties => ({
          display: "inline-block",
          padding: "3px 10px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          fontFamily: "var(--font-ui)",
          background: `color-mix(in srgb, var(${token}) 12%, transparent)`,
          color: `var(${token})`,
          border: `1px solid color-mix(in srgb, var(${token}) 40%, transparent)`,
          textTransform: "uppercase",
        });
        return (
          <div className="themed-card p-5">
            <div className="themed-card-stripe" aria-hidden />
            <div className="flex items-center gap-4 mb-4">
              <h2
                className="page-title text-xl font-bold leading-none flex items-center gap-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <span className="themed-accent">{sectionLabel}</span>
                <span className="themed-accent" style={{ fontFamily: "var(--font-mono)", fontSize: "0.85em" }}>
                  ({rows.length})
                </span>
              </h2>
              <span aria-hidden className="flex-1" style={{ height: 1, background: "var(--border)" }} />
              {statusFilter && (
                <button
                  onClick={() => setStatusFilter(null)}
                  className="text-xs px-3 py-1.5 cursor-pointer transition-colors"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-input)",
                    color: "var(--text-dim)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--accent)";
                    e.currentTarget.style.borderColor = "var(--border-active)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-dim)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  Clear filter
                </button>
              )}
            </div>
            {rows.length === 0 ? (
              <p style={{ color: "var(--text-faint)", fontSize: 13, textAlign: "center", padding: 40 }}>
                {tab === "current"
                  ? (statusFilter ? "No estimates in this status." : "No estimates this week. Click Add Entry to get started.")
                  : "No estimates yet."}
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={headerCellStyle}>Client</th>
                      <th style={headerCellStyle}>File #</th>
                      <th style={headerCellStyle}>Peril</th>
                      <th style={headerCellStyle}>Sev</th>
                      <th style={headerCellStyle}>Active</th>
                      <th style={headerCellStyle}>Blocked</th>
                      <th style={headerCellStyle}>Rev Time</th>
                      <th style={headerCellStyle}>Value</th>
                      <th style={headerCellStyle}>$/hr</th>
                      <th style={headerCellStyle}>Rev</th>
                      <th style={headerCellStyle}>Status</th>
                      <th style={{ ...headerCellStyle, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => {
                      const activeHrs = (e.active_time_minutes + e.revision_time_minutes) / 60;
                      const dph = activeHrs > 0 ? e.estimate_value / activeHrs : 0;
                      const initials = e.client_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
                      const statusToken = STATUS_TOKEN_MAP[e.status] || "--text-dim";
                      return (
                        <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={dataCellStyle}>
                            <div className="flex items-center gap-3">
                              <span
                                className="shrink-0 inline-flex items-center justify-center text-[12px] font-bold"
                                style={{
                                  width: 38, height: 38, borderRadius: 7,
                                  background: "color-mix(in srgb, var(--accent) 14%, var(--pad))",
                                  border: "1px solid var(--border-active)",
                                  color: "var(--accent)",
                                  textShadow: "var(--accent-text-shadow)",
                                  fontFamily: "var(--font-display)",
                                }}
                              >
                                {initials || "—"}
                              </span>
                              <span className="text-[14px]" style={{ fontWeight: 600, color: "var(--text)" }}>
                                {e.client_name}
                              </span>
                            </div>
                          </td>
                          <td style={dataCellStyle}>
                            <div className="flex items-center gap-2">
                              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>{e.file_number}</span>
                              {e.revision_number > 0 && (
                                <span style={pillStyle("--info")}>Rev {e.revision_number}</span>
                              )}
                            </div>
                          </td>
                          <td style={dataCellStyle}>
                            {e.peril ? <span style={pillStyle("--info")}>{e.peril.toUpperCase()}</span> : <span style={{ color: "var(--text-faint)" }}>—</span>}
                          </td>
                          <td style={dataCellStyle}>
                            {e.severity ? <span style={pillStyle("--violet")}>{String(e.severity).toUpperCase()}</span> : <span style={{ color: "var(--text-faint)" }}>—</span>}
                          </td>
                          <td style={dataCellStyle}>
                            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>{hrs(e.active_time_minutes)}</span>
                          </td>
                          <td style={dataCellStyle}>
                            <span style={{
                              fontFamily: "var(--font-mono)",
                              color: e.blocked_time_minutes > 0 ? "var(--red)" : "var(--text-faint)",
                              fontWeight: e.blocked_time_minutes > 0 ? 700 : 400,
                            }}>
                              {hrs(e.blocked_time_minutes)}
                            </span>
                          </td>
                          <td style={dataCellStyle}>
                            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>{hrs(e.revision_time_minutes)}</span>
                          </td>
                          <td style={dataCellStyle}>
                            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{fmt(e.estimate_value)}</span>
                          </td>
                          <td style={dataCellStyle}>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontWeight: 700,
                                color: "var(--accent)",
                                textShadow: "var(--accent-text-shadow)",
                              }}
                            >
                              {fmt(dph)}
                            </span>
                          </td>
                          <td style={dataCellStyle}>
                            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>{e.revisions}</span>
                          </td>
                          <td style={dataCellStyle}>
                            <span style={pillStyle(statusToken)}>{e.status.replace(/-/g, " ")}</span>
                          </td>
                          <td style={{ ...dataCellStyle, textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                              <button
                                onClick={() => startEdit(e)}
                                aria-label="Edit"
                                style={{
                                  width: 30, height: 30, borderRadius: 6,
                                  background: "transparent",
                                  border: "1px solid color-mix(in srgb, var(--info) 40%, transparent)",
                                  color: "var(--info)",
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  cursor: "pointer",
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => { if (confirm("Delete this estimate?")) deleteMut.mutate(e.id); }}
                                aria-label="Delete"
                                style={{
                                  width: 30, height: 30, borderRadius: 6,
                                  background: "transparent",
                                  border: "1px solid color-mix(in srgb, var(--red) 40%, transparent)",
                                  color: "var(--red)",
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  cursor: "pointer",
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

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
