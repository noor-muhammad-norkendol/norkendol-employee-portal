"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { cardStyle, inputStyle, labelStyle, btnPrimary, btnOutline } from "@/lib/styles";

type Phase = "phase_1" | "phase_2";
type ReviewStatus = "pending" | "in_review" | "approved" | "kicked_back";
type StatusFilter = ReviewStatus | "all";

type TLSRow = {
  id: string;
  org_id: string;
  claim_id: string | null;
  file_number: string | null;
  claim_number: string | null;
  policy_number: string | null;
  client_name: string | null;
  loss_address: string | null;
  peril: string | null;
  peril_other: string | null;
  severity: number | null;
  status: ReviewStatus;
  phase: Phase;
  reviewer_id: string | null;
  decision_at: string | null;
  decision_notes: string | null;
  kick_back_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type UserLite = { id: string; full_name: string | null; email: string | null };

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "in_review", label: "In Review" },
  { key: "approved", label: "Approved" },
  { key: "kicked_back", label: "Kicked Back" },
  { key: "all", label: "All" },
];

const STATUS_COLORS: Record<ReviewStatus, string> = {
  pending: "#fb923c",
  in_review: "#60a5fa",
  approved: "#22c55e",
  kicked_back: "#ef4444",
};

export default function TeamLeadSupportPage() {
  const supabase = useMemo(() => createClient(), []);
  const [orgId, setOrgId] = useState<string | undefined>();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [phase, setPhase] = useState<Phase>("phase_1");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [rows, setRows] = useState<TLSRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserLite[]>([]);

  // Side panel state
  const [selected, setSelected] = useState<TLSRow | null>(null);
  const [draftReviewerId, setDraftReviewerId] = useState<string>("");
  const [draftDecisionNotes, setDraftDecisionNotes] = useState<string>("");
  const [draftKickBackReason, setDraftKickBackReason] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [panelMsg, setPanelMsg] = useState<string>("");

  // Load current user + org
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      supabase.from("users").select("org_id").eq("id", user.id).single()
        .then(({ data }) => { if (data) setOrgId((data as { org_id: string }).org_id); });
    });
  }, [supabase]);

  // Load active internal users for reviewer picker
  useEffect(() => {
    if (!orgId) return;
    supabase.from("users")
      .select("id, full_name, email")
      .eq("org_id", orgId)
      .eq("user_type", "internal")
      .eq("status", "active")
      .order("full_name", { ascending: true })
      .then(({ data }) => { if (data) setUsers(data as UserLite[]); });
  }, [supabase, orgId]);

  // Load rows for current phase + filter
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    let q = supabase.from("team_lead_reviews")
      .select("*")
      .eq("org_id", orgId)
      .eq("phase", phase)
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    q.then(({ data, error }) => {
      setLoading(false);
      if (error) { console.error(error); return; }
      if (data) setRows(data as TLSRow[]);
    });
  }, [supabase, orgId, phase, statusFilter]);

  const counts = useMemo(() => {
    const total = rows.length;
    return { total };
  }, [rows]);

  function openPanel(row: TLSRow) {
    setSelected(row);
    setDraftReviewerId(row.reviewer_id || currentUserId || "");
    setDraftDecisionNotes(row.decision_notes || "");
    setDraftKickBackReason(row.kick_back_reason || "");
    setPanelMsg("");
  }

  function closePanel() {
    setSelected(null);
    setDraftReviewerId("");
    setDraftDecisionNotes("");
    setDraftKickBackReason("");
    setPanelMsg("");
  }

  async function applyUpdate(patch: Partial<TLSRow>) {
    if (!selected) return null;
    setSaving(true);
    setPanelMsg("");
    const { data, error } = await supabase
      .from("team_lead_reviews")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", selected.id)
      .select()
      .single();
    setSaving(false);
    if (error) { setPanelMsg(`Save failed: ${error.message}`); return null; }
    return data as TLSRow;
  }

  async function saveDraftOnly() {
    const updated = await applyUpdate({
      reviewer_id: draftReviewerId || null,
      decision_notes: draftDecisionNotes || null,
      kick_back_reason: draftKickBackReason || null,
    });
    if (updated) {
      setRows((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      setSelected(updated);
      setPanelMsg("Saved.");
    }
  }

  async function approveRow() {
    const updated = await applyUpdate({
      status: "approved",
      decision_at: new Date().toISOString(),
      reviewer_id: draftReviewerId || null,
      decision_notes: draftDecisionNotes || null,
    });
    if (updated) {
      setRows((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      setSelected(updated);
      setPanelMsg("Approved.");
    }
  }

  async function kickBackRow() {
    if (!draftKickBackReason.trim()) {
      setPanelMsg("Kick Back reason is required.");
      return;
    }
    const updated = await applyUpdate({
      status: "kicked_back",
      decision_at: new Date().toISOString(),
      reviewer_id: draftReviewerId || null,
      decision_notes: draftDecisionNotes || null,
      kick_back_reason: draftKickBackReason,
    });
    if (updated) {
      setRows((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      setSelected(updated);
      setPanelMsg("Kicked back.");
    }
  }

  // Convert reviewer_id to display name
  const reviewerName = (id: string | null) => {
    if (!id) return "—";
    const u = users.find((x) => x.id === id);
    return u ? (u.full_name || u.email || "(unnamed)") : "(unknown)";
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
        Team Lead Support
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
        Phase 1 sits between Onboarding and Scope of Loss · Phase 2 sits between Estimating and Adjuster
      </p>

      {/* Phase tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "1px solid var(--border-color)" }}>
        {([
          { key: "phase_1", label: "Phase 1 — Pre-Estimating" },
          { key: "phase_2", label: "Phase 2 — Post-Estimating" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setPhase(tab.key); setSelected(null); }}
            style={{
              padding: "10px 18px",
              background: "transparent",
              border: "none",
              borderBottom: phase === tab.key ? "2px solid var(--accent)" : "2px solid transparent",
              color: phase === tab.key ? "var(--accent)" : "var(--text-secondary)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Status filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid var(--border-color)",
              background: statusFilter === f.key ? "var(--accent)" : "var(--bg-surface)",
              color: statusFilter === f.key ? "var(--bg-page)" : "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
        <span style={{ marginLeft: "auto", alignSelf: "center", fontSize: 12, color: "var(--text-muted)" }}>
          {loading ? "Loading…" : `${counts.total} row${counts.total === 1 ? "" : "s"}`}
        </span>
      </div>

      {/* Rows table */}
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {loading ? "Loading…" : "No rows match this filter."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-page)", color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600 }}>File #</th>
                <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600 }}>Client</th>
                <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600 }}>Peril</th>
                <th style={{ textAlign: "center", padding: "10px 16px", fontWeight: 600 }}>Sev</th>
                <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600 }}>Created</th>
                <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600 }}>Reviewer</th>
                <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openPanel(r)}
                  style={{
                    cursor: "pointer",
                    borderTop: "1px solid var(--border-color)",
                    background: selected?.id === r.id ? "rgba(96,165,250,0.08)" : "transparent",
                  }}
                >
                  <td style={{ padding: "10px 16px", color: "var(--text-primary)", fontWeight: 600 }}>{r.file_number || "—"}</td>
                  <td style={{ padding: "10px 16px", color: "var(--text-secondary)" }}>{r.client_name || "—"}</td>
                  <td style={{ padding: "10px 16px", color: "var(--text-secondary)" }}>{r.peril || "—"}</td>
                  <td style={{ padding: "10px 16px", textAlign: "center", color: "var(--text-secondary)" }}>{r.severity ?? "—"}</td>
                  <td style={{ padding: "10px 16px", color: "var(--text-muted)" }}>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: "10px 16px", color: "var(--text-secondary)" }}>{reviewerName(r.reviewer_id)}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                      color: STATUS_COLORS[r.status],
                      letterSpacing: 0.5,
                    }}>{r.status.replace("_", " ")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Side panel */}
      {selected && (
        <>
          {/* Backdrop */}
          <div
            onClick={closePanel}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 998 }}
          />
          {/* Panel */}
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0,
            width: "min(560px, 95vw)",
            background: "var(--bg-surface)",
            borderLeft: "1px solid var(--border-color)",
            zIndex: 999,
            overflowY: "auto",
            padding: 24,
            boxShadow: "-12px 0 24px rgba(0,0,0,0.3)",
          }}>
            {/* Panel header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                {selected.file_number || "(no file #)"} — {phase === "phase_1" ? "Phase 1 Review" : "Phase 2 Review"}
              </h2>
              <button onClick={closePanel} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 24, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {/* Status badge */}
            <div style={{ marginBottom: 16 }}>
              <span style={{
                display: "inline-block",
                fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                color: STATUS_COLORS[selected.status],
                background: `${STATUS_COLORS[selected.status]}1a`,
                border: `1px solid ${STATUS_COLORS[selected.status]}`,
                padding: "3px 10px", borderRadius: 6, letterSpacing: 0.5,
              }}>{selected.status.replace("_", " ")}</span>
              {selected.decision_at && (
                <span style={{ marginLeft: 12, fontSize: 12, color: "var(--text-muted)" }}>
                  Decided {new Date(selected.decision_at).toLocaleString()}
                </span>
              )}
            </div>

            {/* Read-only canonical claim info */}
            <div style={{ ...cardStyle, marginBottom: 16, padding: "12px 16px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Claim Info</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 13 }}>
                <div><span style={{ color: "var(--text-muted)" }}>File #:</span> {selected.file_number || "—"}</div>
                <div><span style={{ color: "var(--text-muted)" }}>Claim #:</span> {selected.claim_number || "—"}</div>
                <div><span style={{ color: "var(--text-muted)" }}>Policy #:</span> {selected.policy_number || "—"}</div>
                <div><span style={{ color: "var(--text-muted)" }}>Client:</span> {selected.client_name || "—"}</div>
                <div style={{ gridColumn: "1 / -1" }}><span style={{ color: "var(--text-muted)" }}>Loss Address:</span> {selected.loss_address || "—"}</div>
                <div><span style={{ color: "var(--text-muted)" }}>Peril:</span> {selected.peril || "—"}{selected.peril_other ? ` (${selected.peril_other})` : ""}</div>
                <div><span style={{ color: "var(--text-muted)" }}>Severity:</span> {selected.severity ?? "—"}</div>
              </div>
            </div>

            {/* Editable review fields */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Reviewer</label>
              <select
                style={inputStyle}
                value={draftReviewerId}
                onChange={(e) => setDraftReviewerId(e.target.value)}
              >
                <option value="">— Unassigned —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email || u.id}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Decision Notes</label>
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                value={draftDecisionNotes}
                onChange={(e) => setDraftDecisionNotes(e.target.value)}
                placeholder="Handoff context, what was reviewed, any caveats…"
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Kick Back Reason {selected.status !== "kicked_back" && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(required only when kicking back)</span>}</label>
              <textarea
                style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                value={draftKickBackReason}
                onChange={(e) => setDraftKickBackReason(e.target.value)}
                placeholder='e.g., "Missing carrier adjuster contact info" or "Wrong peril selected"'
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button
                onClick={approveRow}
                disabled={saving}
                style={{
                  ...btnPrimary,
                  background: "#22c55e",
                  borderColor: "#22c55e",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Saving…" : "Approve"}
              </button>
              <button
                onClick={kickBackRow}
                disabled={saving}
                style={{
                  ...btnPrimary,
                  background: "#ef4444",
                  borderColor: "#ef4444",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Saving…" : "Kick Back"}
              </button>
              <button
                onClick={saveDraftOnly}
                disabled={saving}
                style={{ ...btnOutline, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Saving…" : "Save Notes Only"}
              </button>
            </div>

            {panelMsg && (
              <div style={{
                fontSize: 13,
                color: panelMsg.startsWith("Save failed") || panelMsg.startsWith("Kick Back reason") ? "#ef4444" : "var(--text-secondary)",
                padding: "8px 0",
              }}>
                {panelMsg}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
