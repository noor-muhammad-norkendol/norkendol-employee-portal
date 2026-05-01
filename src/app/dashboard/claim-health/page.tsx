"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useClaimHealthRecords, useCreateClaimHealth, useUpdateClaimHealth, useDeleteClaimHealth } from "@/hooks/claim-health/useClaimHealthRecords";
import { calculateClaimMetrics, useClaimHealthKPIs, useWriteKPISnapshots } from "@/hooks/claim-health/useClaimHealthKPIs";
import { useCHSupabase } from "@/hooks/claim-health/useSupabase";
import { useClaimLookup, type ClaimLookupMatch, type LookupField } from "@/hooks/useClaimLookup";
import ClaimMatchBanner from "@/components/ClaimMatchBanner";
import { CreateClaimHealthInput, ClaimHealthRecord, STATUS_AT_INTAKE_OPTIONS, ROOF_MATERIAL_OPTIONS } from "@/types/claim-health";
import { cardStyle, inputStyle, labelStyle, selectStyle, btnPrimary, btnOutline, thStyle, tdStyle } from "@/lib/styles";

const EMPTY_FORM: CreateClaimHealthInput = {
  file_number: "", client_name: "", referral_source: "", referral_representative: "",
  start_date: new Date().toISOString().slice(0, 10), settlement_date: null,
  starting_value: 0, final_settlement_value: null, status_at_intake: "Denied",
  is_settled: false, total_communications: 0, roof_squares: null,
  roof_material: null, additional_details: null, source: "manual",
};

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toFixed(2) + "%";
}

export default function ClaimHealthPage() {
  const { supabase, userInfo } = useCHSupabase();
  const { data: records = [], isLoading } = useClaimHealthRecords();
  const createMut = useCreateClaimHealth();
  const updateMut = useUpdateClaimHealth();
  const deleteMut = useDeleteClaimHealth();
  const kpis = useClaimHealthKPIs(records);
  const writeKPIs = useWriteKPISnapshots();

  const [tab, setTab] = useState<"claims" | "add">("claims");
  const [form, setForm] = useState<CreateClaimHealthInput>({ ...EMPTY_FORM });
  const [editId, setEditId] = useState<string | null>(null);
  const [printRecord, setPrintRecord] = useState<ClaimHealthRecord | null>(null);

  // Shared claim lookup
  const [chLookupField, setChLookupField] = useState<LookupField>('file_number');
  const chLookupTerm = chLookupField === 'file_number' ? form.file_number : form.client_name;
  const { matches: claimMatches, searching: claimSearching, clear: clearLookup } = useClaimLookup({
    supabase, orgId: userInfo?.orgId, searchTerm: chLookupTerm, searchField: chLookupField, enabled: !editId,
  });

  function handleChClaimAccept(match: ClaimLookupMatch) {
    setForm((prev) => ({
      ...prev,
      file_number: match.file_number || prev.file_number,
      client_name: match.client_name || prev.client_name,
      referral_source: match.referral_source || prev.referral_source,
      referral_representative: match.referral_representative || prev.referral_representative,
    }));
  }

  // Write KPI snapshots when records change (debounced — once per page load / mutation)
  const kpiWritten = useRef(false);
  useEffect(() => {
    if (records.length > 0 && !kpiWritten.current && !writeKPIs.isPending) {
      kpiWritten.current = true;
      writeKPIs.mutate(kpis);
    }
  }, [records, kpis, writeKPIs]);

  // Incomplete records (auto-created, need adjuster input)
  const incomplete = useMemo(() => records.filter((r) => !r.is_complete && r.source === "auto"), [records]);

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit() {
    if (!form.file_number || !form.client_name) return;
    if (editId) {
      await updateMut.mutateAsync({ id: editId, ...form, is_complete: true });
      setEditId(null);
    } else {
      await createMut.mutateAsync(form);
    }
    setForm({ ...EMPTY_FORM });
    setTab("claims");
  }

  function startEdit(r: ClaimHealthRecord) {
    setForm({
      file_number: r.file_number, client_name: r.client_name,
      referral_source: r.referral_source, referral_representative: r.referral_representative,
      start_date: r.start_date, settlement_date: r.settlement_date || null,
      starting_value: r.starting_value, final_settlement_value: r.final_settlement_value ?? null,
      status_at_intake: r.status_at_intake, is_settled: r.is_settled,
      total_communications: r.total_communications, roof_squares: r.roof_squares ?? null,
      roof_material: r.roof_material || null, additional_details: r.additional_details || null,
    });
    setEditId(r.id);
    setTab("add");
  }

  if (isLoading) {
    return <div style={{ padding: 40, color: "var(--text-dim)" }}>Loading claim health records…</div>;
  }

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } }`}</style>

      <div className="no-print" style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h1
            className="page-title"
            style={{
              fontSize: "3rem",
              lineHeight: 1,
              letterSpacing: "-0.01em",
              fontFamily: "var(--font-display)",
              margin: 0,
            }}
          >
            <span
              style={{
                color: "var(--accent)",
                textShadow: "var(--accent-text-shadow)",
                fontWeight: 800,
              }}
            >
              Claim
            </span>{" "}
            <span style={{ color: "var(--text)", fontWeight: 500, opacity: 0.92 }}>
              Health
            </span>
          </h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={tab === "claims" ? btnPrimary : btnOutline} onClick={() => { setTab("claims"); setEditId(null); setForm({ ...EMPTY_FORM }); }}>My Claims</button>
            <button style={tab === "add" ? btnPrimary : btnOutline} onClick={() => { setTab("add"); setEditId(null); setForm({ ...EMPTY_FORM }); }}>
              {editId ? "Edit Claim" : "Add Claim"}
            </button>
          </div>
        </div>

        {/* Incomplete banner */}
        {incomplete.length > 0 && tab === "claims" && (
          <div style={{ background: "color-mix(in srgb, var(--orange) 14%, var(--pad))", border: "1px solid color-mix(in srgb, var(--orange) 40%, transparent)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "var(--orange)", fontSize: 13 }}>
            <strong>{incomplete.length} claim{incomplete.length > 1 ? "s" : ""} need your attention</strong> — auto-created from Settlement Tracker. Click to complete the missing details.
          </div>
        )}

        {/* ═══ CLAIMS TAB ═══ */}
        {tab === "claims" && (
          <div style={cardStyle}>
            {records.length === 0 ? (
              <p style={{ color: "var(--text-faint)", fontSize: 13, textAlign: "center", padding: 40 }}>
                No claim health records yet. Add your first claim or wait for one to auto-populate from the Settlement Tracker.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>File Number</th>
                      <th style={thStyle}>Client</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Start</th>
                      <th style={thStyle}>Starting $</th>
                      <th style={thStyle}>Final $</th>
                      <th style={thStyle}>% Change</th>
                      <th style={thStyle}>Days Open</th>
                      <th style={thStyle}>Comms/Day</th>
                      <th style={thStyle}>Complete</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => {
                      const m = calculateClaimMetrics(r);
                      return (
                        <tr key={r.id} style={!r.is_complete && r.source === "auto" ? { background: "rgba(251,146,60,0.08)" } : {}}>
                          <td style={tdStyle}>{r.file_number}</td>
                          <td style={tdStyle}>{r.client_name}</td>
                          <td style={tdStyle}>
                            <span style={{
                              display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                              background: r.is_settled ? "rgba(74,222,128,0.15)" : "rgba(96,165,250,0.15)",
                              color: r.is_settled ? "var(--green)" : "var(--info)",
                            }}>
                              {r.is_settled ? "Settled" : "Active"}
                            </span>
                          </td>
                          <td style={tdStyle}>{r.start_date}</td>
                          <td style={tdStyle}>{fmt(r.starting_value)}</td>
                          <td style={tdStyle}>{fmt(r.final_settlement_value)}</td>
                          <td style={{ ...tdStyle, color: m.percentageChange != null && m.percentageChange > 0 ? "var(--green)" : m.percentageChange != null && m.percentageChange < 0 ? "var(--red)" : "var(--text-faint)" }}>
                            {pct(m.percentageChange)}
                          </td>
                          <td style={tdStyle}>{m.daysToSettlement ?? m.daysClaimOpen}d</td>
                          <td style={tdStyle}>{m.communicationFrequency}</td>
                          <td style={tdStyle}>
                            {r.is_complete
                              ? <span style={{ color: "var(--green)", fontSize: 11 }}>✓</span>
                              : <span style={{ color: "var(--orange)", fontSize: 11 }}>Incomplete</span>
                            }
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button style={{ ...btnOutline, fontSize: 11, padding: "3px 8px" }} onClick={() => startEdit(r)}>Edit</button>
                              <button style={{ ...btnOutline, fontSize: 11, padding: "3px 8px" }} onClick={() => setPrintRecord(r)}>Print</button>
                              <button style={{ ...btnOutline, fontSize: 11, padding: "3px 8px", color: "var(--red)", borderColor: "var(--red)" }} onClick={() => { if (confirm("Delete this record?")) deleteMut.mutate(r.id); }}>×</button>
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
        )}

        {/* ═══ ADD / EDIT TAB ═══ */}
        {tab === "add" && (
          <div style={cardStyle}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 16 }}>
              {editId ? "Edit Claim Health Record" : "New Claim Health Record"}
            </h2>

            {/* Row 1: ID + Client */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>File Number</label>
                <input style={inputStyle} value={form.file_number} onChange={(e) => { set("file_number", e.target.value); if (e.target.value.length >= 3) setChLookupField('file_number'); }} placeholder="FL-12345-2026" />
              </div>
              <div>
                <label style={labelStyle}>Client Name</label>
                <input style={inputStyle} value={form.client_name} onChange={(e) => { set("client_name", e.target.value); if (e.target.value.length >= 3 && !form.file_number) setChLookupField('client_name'); }} />
              </div>
            </div>

            {/* Claim lookup banner */}
            <ClaimMatchBanner matches={claimMatches} searching={claimSearching} onAccept={handleChClaimAccept} onDismiss={clearLookup} />

            {/* Row 2: Referral */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Referral Source</label>
                <input style={inputStyle} value={form.referral_source} onChange={(e) => set("referral_source", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Referral Representative</label>
                <input style={inputStyle} value={form.referral_representative} onChange={(e) => set("referral_representative", e.target.value)} />
              </div>
            </div>

            {/* Row 3: Dates */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Start Date</label>
                <input type="date" style={inputStyle} value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Settlement Date</label>
                <input type="date" style={inputStyle} value={form.settlement_date || ""} onChange={(e) => set("settlement_date", e.target.value || null)} />
              </div>
            </div>

            {/* Row 4: Financials */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Starting Value ($)</label>
                <input type="number" style={inputStyle} value={form.starting_value} onChange={(e) => set("starting_value", parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label style={labelStyle}>Final Settlement Value ($)</label>
                <input type="number" style={inputStyle} value={form.final_settlement_value ?? ""} onChange={(e) => set("final_settlement_value", e.target.value ? parseFloat(e.target.value) : null)} />
              </div>
            </div>

            {/* Row 5: Status + Comms */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Status at Intake</label>
                <select style={selectStyle} value={form.status_at_intake} onChange={(e) => set("status_at_intake", e.target.value)}>
                  {STATUS_AT_INTAKE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Total Communications</label>
                <input type="number" style={inputStyle} value={form.total_communications} onChange={(e) => set("total_communications", parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label style={labelStyle}>Settled?</label>
                <select style={selectStyle} value={form.is_settled ? "yes" : "no"} onChange={(e) => set("is_settled", e.target.value === "yes")}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>

            {/* Row 6: Roof Details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Roof Squares</label>
                <input type="number" style={inputStyle} value={form.roof_squares ?? ""} onChange={(e) => set("roof_squares", e.target.value ? parseFloat(e.target.value) : null)} placeholder="e.g. 28.5" />
              </div>
              <div>
                <label style={labelStyle}>Roof Material</label>
                <select style={selectStyle} value={form.roof_material || ""} onChange={(e) => set("roof_material", e.target.value || null)}>
                  <option value="">Select material…</option>
                  {ROOF_MATERIAL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Row 7: Additional Details */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Additional Details</label>
              <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.additional_details || ""} onChange={(e) => set("additional_details", e.target.value || null)} placeholder="Any other relevant claim information…" />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button style={btnPrimary} onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
                {createMut.isPending || updateMut.isPending ? "Saving…" : editId ? "Update Record" : "Create Record"}
              </button>
              {editId && (
                <button style={btnOutline} onClick={() => { setEditId(null); setForm({ ...EMPTY_FORM }); }}>Cancel</button>
              )}
            </div>
          </div>
        )}

        {/* ═══ PRINT PREVIEW MODAL ═══ */}
        {printRecord && (() => {
          const r = printRecord;
          const m = calculateClaimMetrics(r);
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "var(--bg-surface)", borderRadius: 12, padding: 24, maxWidth: 600, width: "90%", maxHeight: "90vh", overflow: "auto", color: "var(--text)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Contractor Report Card</h2>
                  <button style={btnOutline} onClick={() => setPrintRecord(null)}>Close</button>
                </div>

                <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                  <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{r.file_number} — {r.client_name}</p>
                  <p style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 16 }}>
                    Referral: {r.referral_source} ({r.referral_representative}) | Status: {r.is_settled ? "Settled" : "Active"}
                  </p>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <tbody>
                      <tr><td style={{ padding: "6px 0", fontWeight: 600 }}>Claim Details</td><td></td></tr>
                      <tr><td style={{ padding: "4px 0", paddingLeft: 12 }}>Status at Intake</td><td style={{ textAlign: "right" }}>{r.status_at_intake}</td></tr>
                      <tr><td style={{ padding: "4px 0", paddingLeft: 12 }}>Start Date</td><td style={{ textAlign: "right" }}>{r.start_date}</td></tr>
                      {r.settlement_date && <tr><td style={{ padding: "4px 0", paddingLeft: 12 }}>Settlement Date</td><td style={{ textAlign: "right" }}>{r.settlement_date}</td></tr>}
                      <tr><td style={{ padding: "4px 0", paddingLeft: 12 }}>Days {r.is_settled ? "to Settlement" : "Open"}</td><td style={{ textAlign: "right" }}>{m.daysToSettlement ?? m.daysClaimOpen} days</td></tr>

                      <tr><td style={{ padding: "6px 0", fontWeight: 600, paddingTop: 12 }}>Financials</td><td></td></tr>
                      <tr><td style={{ padding: "4px 0", paddingLeft: 12 }}>Starting Value</td><td style={{ textAlign: "right" }}>{fmt(r.starting_value)}</td></tr>
                      {r.final_settlement_value != null && <tr><td style={{ padding: "4px 0", paddingLeft: 12 }}>Final Settlement Value</td><td style={{ textAlign: "right" }}>{fmt(r.final_settlement_value)}</td></tr>}
                      {m.percentageChange != null && (
                        <tr><td style={{ padding: "4px 0", paddingLeft: 12 }}>Value Change</td>
                          <td style={{ textAlign: "right", color: m.percentageChange > 0 ? "var(--green)" : "var(--red)" }}>{pct(m.percentageChange)}</td>
                        </tr>
                      )}

                      {(r.roof_squares != null || r.roof_material) && (
                        <>
                          <tr><td style={{ padding: "6px 0", fontWeight: 600, paddingTop: 12 }}>Roof Details</td><td></td></tr>
                          {r.roof_squares != null && <tr><td style={{ padding: "4px 0", paddingLeft: 12 }}>Roof Squares</td><td style={{ textAlign: "right" }}>{r.roof_squares}</td></tr>}
                          {r.roof_material && <tr><td style={{ padding: "4px 0", paddingLeft: 12 }}>Roof Material</td><td style={{ textAlign: "right" }}>{r.roof_material}</td></tr>}
                        </>
                      )}

                      <tr><td style={{ padding: "6px 0", fontWeight: 600, paddingTop: 12 }}>Communication</td><td></td></tr>
                      <tr><td style={{ padding: "4px 0", paddingLeft: 12 }}>Total Communications</td><td style={{ textAlign: "right" }}>{r.total_communications}</td></tr>
                      <tr><td style={{ padding: "4px 0", paddingLeft: 12 }}>Communication Frequency</td><td style={{ textAlign: "right" }}>{m.communicationFrequency}/day</td></tr>

                      {r.additional_details && (
                        <>
                          <tr><td style={{ padding: "6px 0", fontWeight: 600, paddingTop: 12 }}>Additional Details</td><td></td></tr>
                          <tr><td colSpan={2} style={{ padding: "4px 0", paddingLeft: 12, fontSize: 12, color: "var(--text-dim)" }}>{r.additional_details}</td></tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 20, textAlign: "right" }}>
                  <button style={btnPrimary} onClick={() => window.print()}>Print</button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ═══ PRINT-ONLY VIEW ═══ */}
      {printRecord && (() => {
        const r = printRecord;
        const m = calculateClaimMetrics(r);
        return (
          <div className="print-only" style={{ display: "none", padding: 40, color: "#000", fontSize: 13 }}>
            <h1 style={{ fontSize: 20, marginBottom: 4 }}>Claim Health Report Card</h1>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{r.file_number} — {r.client_name}</p>
            <p style={{ fontSize: 11, color: "#666", marginBottom: 20 }}>
              Referral: {r.referral_source} ({r.referral_representative}) | Generated: {new Date().toLocaleDateString()}
            </p>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #ccc" }}><td style={{ padding: "6px 0", fontWeight: 700 }}>Status at Intake</td><td style={{ textAlign: "right" }}>{r.status_at_intake}</td></tr>
                <tr style={{ borderBottom: "1px solid #eee" }}><td style={{ padding: "4px 0" }}>Claim Status</td><td style={{ textAlign: "right" }}>{r.is_settled ? "Settled" : "Active"}</td></tr>
                <tr style={{ borderBottom: "1px solid #eee" }}><td style={{ padding: "4px 0" }}>Start Date</td><td style={{ textAlign: "right" }}>{r.start_date}</td></tr>
                {r.settlement_date && <tr style={{ borderBottom: "1px solid #eee" }}><td style={{ padding: "4px 0" }}>Settlement Date</td><td style={{ textAlign: "right" }}>{r.settlement_date}</td></tr>}
                <tr style={{ borderBottom: "1px solid #eee" }}><td style={{ padding: "4px 0" }}>Days {r.is_settled ? "to Settlement" : "Open"}</td><td style={{ textAlign: "right" }}>{m.daysToSettlement ?? m.daysClaimOpen} days</td></tr>
                <tr style={{ borderBottom: "1px solid #ccc" }}><td style={{ padding: "6px 0", fontWeight: 700 }}>Starting Value</td><td style={{ textAlign: "right" }}>{fmt(r.starting_value)}</td></tr>
                {r.final_settlement_value != null && <tr style={{ borderBottom: "1px solid #eee" }}><td style={{ padding: "4px 0" }}>Final Settlement</td><td style={{ textAlign: "right" }}>{fmt(r.final_settlement_value)}</td></tr>}
                {m.percentageChange != null && <tr style={{ borderBottom: "1px solid #eee" }}><td style={{ padding: "4px 0" }}>Value Change</td><td style={{ textAlign: "right" }}>{pct(m.percentageChange)}</td></tr>}
                {r.roof_squares != null && <tr style={{ borderBottom: "1px solid #eee" }}><td style={{ padding: "4px 0" }}>Roof Squares</td><td style={{ textAlign: "right" }}>{r.roof_squares}</td></tr>}
                {r.roof_material && <tr style={{ borderBottom: "1px solid #eee" }}><td style={{ padding: "4px 0" }}>Roof Material</td><td style={{ textAlign: "right" }}>{r.roof_material}</td></tr>}
                <tr style={{ borderBottom: "1px solid #eee" }}><td style={{ padding: "4px 0" }}>Total Communications</td><td style={{ textAlign: "right" }}>{r.total_communications}</td></tr>
                <tr style={{ borderBottom: "1px solid #eee" }}><td style={{ padding: "4px 0" }}>Comms/Day</td><td style={{ textAlign: "right" }}>{m.communicationFrequency}</td></tr>
                {r.additional_details && <tr><td colSpan={2} style={{ padding: "8px 0", fontSize: 11 }}><strong>Notes:</strong> {r.additional_details}</td></tr>}
              </tbody>
            </table>
          </div>
        );
      })()}
    </>
  );
}
