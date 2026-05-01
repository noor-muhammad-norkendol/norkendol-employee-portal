"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

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

const STATUS_TILES: { key: StatusFilter; label: string; token: string }[] = [
  { key: "pending", label: "New", token: "--info" },
  { key: "in_review", label: "In Progress", token: "--violet" },
  { key: "approved", label: "On Hold", token: "--green" },
  { key: "kicked_back", label: "Rejected to PA", token: "--red" },
  { key: "all", label: "Completed", token: "--accent" },
];

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "New",
  in_review: "In Progress",
  approved: "On Hold",
  kicked_back: "Rejected to PA",
};

const STATUS_TOKEN: Record<ReviewStatus, string> = {
  pending: "--info",
  in_review: "--violet",
  approved: "--green",
  kicked_back: "--red",
};

function StatusBadge({ status }: { status: ReviewStatus }) {
  const token = STATUS_TOKEN[status];
  const label = STATUS_LABEL[status];
  return (
    <span
      style={{
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
      }}
    >
      {label}
    </span>
  );
}

function initialsOf(name: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "—";
}

function ClientChip({ name }: { name: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="shrink-0 inline-flex items-center justify-center text-[12px] font-bold"
        style={{
          width: 38,
          height: 38,
          borderRadius: 7,
          background: "color-mix(in srgb, var(--accent) 14%, var(--pad))",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "var(--border-active)",
          color: "var(--accent)",
          textShadow: "var(--accent-text-shadow)",
          fontFamily: "var(--font-display)",
        }}
      >
        {initialsOf(name)}
      </span>
      <span
        className="text-[14px]"
        style={{ fontWeight: 600, color: "var(--text)" }}
      >
        {name || "—"}
      </span>
    </div>
  );
}

export default function TeamLeadSupportPage() {
  const supabase = useMemo(() => createClient(), []);
  const [orgId, setOrgId] = useState<string | undefined>();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [phase, setPhase] = useState<Phase>("phase_1");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [rows, setRows] = useState<TLSRow[]>([]);
  const [allRows, setAllRows] = useState<TLSRow[]>([]);
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
      supabase
        .from("users")
        .select("org_id")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) setOrgId((data as { org_id: string }).org_id);
        });
    });
  }, [supabase]);

  // Load active internal users for reviewer picker
  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("users")
      .select("id, full_name, email")
      .eq("org_id", orgId)
      .eq("user_type", "internal")
      .eq("status", "active")
      .order("full_name", { ascending: true })
      .then(({ data }) => {
        if (data) setUsers(data as UserLite[]);
      });
  }, [supabase, orgId]);

  // Load ALL rows for current phase (for tile counts)
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    supabase
      .from("team_lead_reviews")
      .select("*")
      .eq("org_id", orgId)
      .eq("phase", phase)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          console.error(error);
          return;
        }
        setAllRows((data as TLSRow[]) ?? []);
      });
  }, [supabase, orgId, phase]);

  // Filter rows for table view
  useEffect(() => {
    if (statusFilter === "all") setRows(allRows);
    else setRows(allRows.filter((r) => r.status === statusFilter));
  }, [allRows, statusFilter]);

  const counts = useMemo(() => {
    const out: Record<ReviewStatus, number> = {
      pending: 0,
      in_review: 0,
      approved: 0,
      kicked_back: 0,
    };
    for (const r of allRows) out[r.status]++;
    return out;
  }, [allRows]);

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
    if (error) {
      setPanelMsg(`Save failed: ${error.message}`);
      return null;
    }
    return data as TLSRow;
  }

  async function saveDraftOnly() {
    const updated = await applyUpdate({
      reviewer_id: draftReviewerId || null,
      decision_notes: draftDecisionNotes || null,
      kick_back_reason: draftKickBackReason || null,
    });
    if (updated) {
      setAllRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
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
      setAllRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
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
      setAllRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSelected(updated);
      setPanelMsg("Kicked back.");
    }
  }

  // Convert reviewer_id to display name
  const reviewerName = (id: string | null) => {
    if (!id) return "—";
    const u = users.find((x) => x.id === id);
    return u ? u.full_name || u.email || "(unnamed)" : "(unknown)";
  };

  return (
    <div className="space-y-6">
      {/* ── Page header ────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-6">
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
              TLS
            </span>{" "}
            <span style={{ color: "var(--text)", fontWeight: 500, opacity: 0.92 }}>
              KPI
            </span>
          </h1>
        </div>
      </div>

      {/* ── Phase segmented toggle ─────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {(
          [
            { key: "phase_1", label: "Phase 1 — Pre-Estimating" },
            { key: "phase_2", label: "Phase 2 — Post-Estimating" },
          ] as const
        ).map((tab) => {
          const active = phase === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setPhase(tab.key);
                setSelected(null);
              }}
              className="px-7 py-3.5 text-[14px] font-bold uppercase cursor-pointer transition-all"
              style={{
                background: active
                  ? "color-mix(in srgb, var(--accent) 14%, var(--bg))"
                  : "var(--bg)",
                color: "var(--accent)",
                borderWidth: "2px",
                borderStyle: "solid",
                borderColor: "var(--accent)",
                borderRadius: 8,
                fontFamily: "var(--font-display)",
                letterSpacing: "0.10em",
                textShadow: active ? "var(--accent-text-shadow)" : undefined,
                boxShadow: active
                  ? "0 0 16px color-mix(in srgb, var(--accent) 30%, transparent)"
                  : "none",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Stat tiles (also act as status filter) ─────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {STATUS_TILES.map((tile) => {
          const tokenVar = `var(${tile.token})`;
          const count =
            tile.key === "all"
              ? allRows.length
              : counts[tile.key as ReviewStatus];
          const active = statusFilter === tile.key;
          return (
            <button
              key={tile.key}
              onClick={() => setStatusFilter(tile.key)}
              className="relative overflow-hidden p-4 text-left flex flex-col gap-2 cursor-pointer transition-all"
              style={{
                background: active
                  ? `color-mix(in srgb, ${tokenVar} 14%, var(--pad))`
                  : "var(--pad)",
                borderWidth: "1.5px",
                borderStyle: "solid",
                borderColor: active ? tokenVar : "var(--border)",
                borderRadius: "var(--radius-card)",
                boxShadow: active
                  ? `0 0 0 1px ${tokenVar} inset, 0 0 24px color-mix(in srgb, ${tokenVar} 55%, transparent), 0 0 48px color-mix(in srgb, ${tokenVar} 22%, transparent)`
                  : "var(--card-shadow)",
              }}
            >
              <span
                className="absolute left-0 right-0 top-0 h-[2px]"
                style={{
                  background: active ? tokenVar : "var(--card-stripe-bg)",
                  boxShadow: active
                    ? `0 0 14px ${tokenVar}`
                    : "var(--card-stripe-shadow)",
                }}
              />
              <span
                className="text-3xl font-extrabold"
                style={{
                  color: tokenVar,
                  opacity: count > 0 ? 1 : 0.55,
                  textShadow:
                    count > 0 && active
                      ? `0 0 18px color-mix(in srgb, ${tokenVar} 70%, transparent)`
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
                  fontFamily: "var(--font-ui)",
                }}
              >
                {tile.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Workboard table ───────────────────────────────── */}
      <div className="themed-card p-5">
        <div className="themed-card-stripe" aria-hidden />

        <div className="flex items-center gap-3 mb-4">
          <h2
            className="page-title text-xl font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Reviews <span className="themed-accent">Workboard</span>
          </h2>
          <span
            className="text-[12px]"
            style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}
          >
            {rows.length}
          </span>
          <div
            className="flex-1 h-px"
            style={{ background: "var(--border)" }}
          />
        </div>

        {rows.length === 0 ? (
          <div
            style={{
              padding: "32px 24px",
              textAlign: "center",
              color: "var(--text-dim)",
              fontSize: 13,
            }}
          >
            {loading ? "Loading…" : "No rows match this filter."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {[
                  { label: "File #", align: "left" as const },
                  { label: "Client", align: "left" as const },
                  { label: "Peril", align: "left" as const },
                  { label: "Severity", align: "center" as const },
                  { label: "Created", align: "left" as const },
                  { label: "Reviewer", align: "left" as const },
                  { label: "Status", align: "left" as const },
                ].map((h) => (
                  <th
                    key={h.label}
                    style={{
                      padding: "12px",
                      textAlign: h.align,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--text-faint)",
                      fontFamily: "var(--font-ui)",
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isSelected = selected?.id === r.id;
                return (
                  <tr
                    key={r.id}
                    onClick={() => openPanel(r)}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: isSelected
                        ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                        : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.background = "var(--pad-elev)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td
                      style={{
                        padding: "14px 12px",
                        verticalAlign: "middle",
                        fontSize: 13,
                        color: "var(--text)",
                        fontWeight: 600,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {r.file_number || "—"}
                    </td>
                    <td
                      style={{
                        padding: "14px 12px",
                        verticalAlign: "middle",
                      }}
                    >
                      <ClientChip name={r.client_name} />
                    </td>
                    <td
                      style={{
                        padding: "14px 12px",
                        verticalAlign: "middle",
                        fontSize: 13,
                        color: "var(--text-dim)",
                      }}
                    >
                      {r.peril || "—"}
                      {r.peril_other ? (
                        <span
                          style={{
                            color: "var(--text-faint)",
                            marginLeft: 6,
                          }}
                        >
                          ({r.peril_other})
                        </span>
                      ) : null}
                    </td>
                    <td
                      style={{
                        padding: "14px 12px",
                        verticalAlign: "middle",
                        textAlign: "center",
                        fontSize: 13,
                        color: "var(--text)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {r.severity ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "14px 12px",
                        verticalAlign: "middle",
                        fontSize: 13,
                        color: "var(--text-dim)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td
                      style={{
                        padding: "14px 12px",
                        verticalAlign: "middle",
                        fontSize: 13,
                        color: "var(--text-dim)",
                      }}
                    >
                      {reviewerName(r.reviewer_id)}
                    </td>
                    <td
                      style={{
                        padding: "14px 12px",
                        verticalAlign: "middle",
                      }}
                    >
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Side panel ────────────────────────────────────── */}
      {selected && (
        <>
          <div
            onClick={closePanel}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 998,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(60vw, 95vw)",
              minWidth: 560,
              background: "var(--pad)",
              borderLeft: "1px solid var(--border)",
              zIndex: 999,
              overflowY: "auto",
              padding: 24,
              boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
            }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between mb-4">
              <h2
                className="page-title text-xl font-semibold"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--text)",
                }}
              >
                <span
                  style={{
                    color: "var(--accent)",
                    textShadow: "var(--accent-text-shadow)",
                  }}
                >
                  {selected.file_number || "(no file #)"}
                </span>{" "}
                <span style={{ color: "var(--text)", fontWeight: 500 }}>
                  {phase === "phase_1" ? "Phase 1 Review" : "Phase 2 Review"}
                </span>
              </h2>
              <button
                onClick={closePanel}
                className="cursor-pointer"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text-dim)",
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  fontSize: 18,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Status row */}
            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <StatusBadge status={selected.status} />
              {selected.decision_at && (
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-faint)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Decided {new Date(selected.decision_at).toLocaleString()}
                </span>
              )}
            </div>

            {/* Claim Info card */}
            <div className="themed-card p-4 mb-4">
              <div className="themed-card-stripe" aria-hidden />
              <p
                className="section-header text-[11px] font-semibold mb-3"
                style={{
                  color: "var(--text-faint)",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  fontFamily: "var(--font-ui)",
                }}
              >
                Claim Info
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px 16px",
                  fontSize: 13,
                }}
              >
                <ClaimField label="File #" value={selected.file_number} mono />
                <ClaimField label="Claim #" value={selected.claim_number} mono />
                <ClaimField label="Policy #" value={selected.policy_number} mono />
                <ClaimField label="Client" value={selected.client_name} />
                <div style={{ gridColumn: "1 / -1" }}>
                  <ClaimField
                    label="Loss Address"
                    value={selected.loss_address}
                  />
                </div>
                <ClaimField
                  label="Peril"
                  value={
                    selected.peril
                      ? selected.peril +
                        (selected.peril_other ? ` (${selected.peril_other})` : "")
                      : null
                  }
                />
                <ClaimField
                  label="Severity"
                  value={selected.severity != null ? String(selected.severity) : null}
                  mono
                />
              </div>
            </div>

            {/* Reviewer */}
            <div className="mb-4">
              <FieldLabel>Reviewer</FieldLabel>
              <select
                value={draftReviewerId}
                onChange={(e) => setDraftReviewerId(e.target.value)}
                style={fieldInputStyle}
              >
                <option value="">— Unassigned —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email || u.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Decision Notes */}
            <div className="mb-4">
              <FieldLabel>Decision Notes</FieldLabel>
              <textarea
                value={draftDecisionNotes}
                onChange={(e) => setDraftDecisionNotes(e.target.value)}
                placeholder="Handoff context, what was reviewed, any caveats…"
                style={{ ...fieldInputStyle, minHeight: 80, resize: "vertical" }}
              />
            </div>

            {/* Kick Back Reason */}
            <div className="mb-5">
              <FieldLabel>
                Kick Back Reason{" "}
                {selected.status !== "kicked_back" && (
                  <span
                    style={{
                      color: "var(--text-faint)",
                      fontWeight: 400,
                      textTransform: "none",
                      letterSpacing: "0.02em",
                    }}
                  >
                    (required only when kicking back)
                  </span>
                )}
              </FieldLabel>
              <textarea
                value={draftKickBackReason}
                onChange={(e) => setDraftKickBackReason(e.target.value)}
                placeholder='e.g., "Missing carrier adjuster contact info" or "Wrong peril selected"'
                style={{ ...fieldInputStyle, minHeight: 70, resize: "vertical" }}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap mb-3">
              <button
                onClick={approveRow}
                disabled={saving}
                className="cursor-pointer transition-all"
                style={{
                  padding: "12px 22px",
                  fontSize: 13,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.10em",
                  borderRadius: 8,
                  background: "var(--green)",
                  color: "#FFFFFF",
                  border: "none",
                  fontFamily: "var(--font-display)",
                  opacity: saving ? 0.6 : 1,
                  boxShadow:
                    "0 0 22px color-mix(in srgb, var(--green) 45%, transparent), 0 4px 14px rgba(0,0,0,0.30)",
                }}
              >
                {saving ? "Saving…" : "Approve"}
              </button>

              <button
                onClick={kickBackRow}
                disabled={saving}
                className="cursor-pointer transition-all"
                style={{
                  padding: "12px 22px",
                  fontSize: 13,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.10em",
                  borderRadius: 8,
                  background: "var(--bg)",
                  color: "var(--red)",
                  borderWidth: "2px",
                  borderStyle: "solid",
                  borderColor: "var(--red)",
                  fontFamily: "var(--font-display)",
                  opacity: saving ? 0.6 : 1,
                  boxShadow:
                    "0 0 14px color-mix(in srgb, var(--red) 28%, transparent)",
                }}
              >
                {saving ? "Saving…" : "Kick Back"}
              </button>

              <button
                onClick={saveDraftOnly}
                disabled={saving}
                className="cursor-pointer transition-all"
                style={{
                  padding: "12px 22px",
                  fontSize: 13,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.10em",
                  borderRadius: 8,
                  background: "var(--bg)",
                  color: "var(--accent)",
                  borderWidth: "2px",
                  borderStyle: "solid",
                  borderColor: "var(--accent)",
                  fontFamily: "var(--font-display)",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Saving…" : "Save Notes"}
              </button>
            </div>

            {panelMsg && (
              <div
                style={{
                  fontSize: 13,
                  color:
                    panelMsg.startsWith("Save failed") ||
                    panelMsg.startsWith("Kick Back reason")
                      ? "var(--red)"
                      : "var(--text-dim)",
                  padding: "8px 0",
                  fontFamily: "var(--font-ui)",
                }}
              >
                {panelMsg}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── small panel helpers (kept inline so the page is self-contained) ── */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--text-dim)",
        marginBottom: 6,
        fontFamily: "var(--font-ui)",
      }}
    >
      {children}
    </label>
  );
}

const fieldInputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--pad-input)",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--border)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  color: "var(--text)",
  fontFamily: "var(--font-body)",
  outline: "none",
};

function ClaimField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <span style={{ color: "var(--text-faint)", marginRight: 6 }}>{label}:</span>
      <span
        style={{
          color: "var(--text)",
          fontFamily: mono ? "var(--font-mono)" : undefined,
        }}
      >
        {value || "—"}
      </span>
    </div>
  );
}
