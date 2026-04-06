"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

/* ── types ─────────────────────────────────────────────── */

interface Firm {
  id: string;
  name: string;
}

interface PendingUser {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  primary_phone: string | null;
  user_type: string;
  status: string;
  created_at: string;
}

interface PendingContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  specialty: string;
  specialty_other: string | null;
  company_name: string | null;
  states: string[] | null;
  status: string;
  created_at: string;
}

interface PendingFirm {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  city: string | null;
  state: string | null;
  entity_type: string | null;
  status: string;
  created_at: string;
}

type StatusFilter = "pending" | "active" | "rejected";
type TypeFilter = "internal" | "external" | "firms";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const STATUS_LABELS: Record<StatusFilter, string> = {
  pending: "Pending",
  active: "Approved",
  rejected: "Denied",
};

const STATUS_COLORS: Record<StatusFilter, { bg: string; text: string }> = {
  pending: { bg: "#3a3520", text: "#facc15" },
  active: { bg: "#1a3a2a", text: "#4ade80" },
  rejected: { bg: "#4a1a1a", text: "#ef4444" },
};

export default function PendingApprovalsPanel() {
  const supabase = createClient();
  const ORG_ID = "00000000-0000-0000-0000-000000000001";

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("internal");

  const [users, setUsers] = useState<PendingUser[]>([]);
  const [contacts, setContacts] = useState<PendingContact[]>([]);
  const [pendingFirms, setPendingFirms] = useState<PendingFirm[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectConfirm, setRejectConfirm] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveConfirm, setApproveConfirm] = useState<string | null>(null);
  const [selectedFirmId, setSelectedFirmId] = useState<string>("");
  const [firms, setFirms] = useState<Firm[]>([]);

  // Counts for badges
  const [counts, setCounts] = useState({ pendingInternal: 0, pendingExternal: 0, pendingFirms: 0, approvedInternal: 0, approvedExternal: 0, approvedFirms: 0, rejectedInternal: 0, rejectedExternal: 0, rejectedFirms: 0 });

  const fetchFirms = useCallback(async () => {
    const { data } = await supabase.from("firms").select("id, name").eq("org_id", ORG_ID).order("name");
    setFirms((data as Firm[]) ?? []);
  }, []);

  const fetchCounts = useCallback(async () => {
    const [pi, pe, pf, ai, ae, af, ri, re, rf] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "pending").eq("user_type", "internal"),
      supabase.from("external_contacts").select("id", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "pending"),
      supabase.from("firms").select("id", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "pending"),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "active").eq("user_type", "internal"),
      supabase.from("external_contacts").select("id", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "active"),
      supabase.from("firms").select("id", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "active"),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "rejected").eq("user_type", "internal"),
      supabase.from("external_contacts").select("id", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "rejected"),
      supabase.from("firms").select("id", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "inactive"),
    ]);
    setCounts({
      pendingInternal: pi.count ?? 0,
      pendingExternal: pe.count ?? 0,
      pendingFirms: pf.count ?? 0,
      approvedInternal: ai.count ?? 0,
      approvedExternal: ae.count ?? 0,
      approvedFirms: af.count ?? 0,
      rejectedInternal: ri.count ?? 0,
      rejectedExternal: re.count ?? 0,
      rejectedFirms: rf.count ?? 0,
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    if (typeFilter === "internal") {
      const { data } = await supabase
        .from("users")
        .select("id, full_name, first_name, last_name, email, primary_phone, user_type, status, created_at")
        .eq("org_id", ORG_ID)
        .eq("status", statusFilter)
        .eq("user_type", "internal")
        .order("created_at", { ascending: false });
      setUsers((data as PendingUser[]) ?? []);
      setContacts([]);
      setPendingFirms([]);
    } else if (typeFilter === "external") {
      const { data } = await supabase
        .from("external_contacts")
        .select("id, name, email, phone, specialty, specialty_other, company_name, states, status, created_at")
        .eq("org_id", ORG_ID)
        .eq("status", statusFilter)
        .order("created_at", { ascending: false });
      setContacts((data as PendingContact[]) ?? []);
      setUsers([]);
      setPendingFirms([]);
    } else {
      // firms: map statusFilter to firms status values
      const firmStatus = statusFilter === "rejected" ? "inactive" : statusFilter;
      const { data } = await supabase
        .from("firms")
        .select("id, name, contact_name, contact_email, city, state, entity_type, status, created_at")
        .eq("org_id", ORG_ID)
        .eq("status", firmStatus)
        .order("created_at", { ascending: false });
      setPendingFirms((data as PendingFirm[]) ?? []);
      setUsers([]);
      setContacts([]);
    }
    setLoading(false);
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchData();
    fetchCounts();
    fetchFirms();
  }, [fetchData, fetchCounts, fetchFirms]);

  /* ── actions — internal users ────────────────────────── */

  const approveUser = async (id: string, firmId: string | null) => {
    setActionLoading(id);
    await supabase.from("users").update({ status: "active", onboarding_status: "approved", firm_id: firmId }).eq("id", id);
    setActionLoading(null);
    setApproveConfirm(null);
    setSelectedFirmId("");
    fetchData();
    fetchCounts();
  };

  const rejectUser = async (id: string) => {
    setActionLoading(id);
    await supabase.from("users").update({ status: "rejected", onboarding_status: "completed", rejection_reason: rejectReason || null }).eq("id", id);
    setActionLoading(null);
    setRejectConfirm(null);
    setRejectReason("");
    fetchData();
    fetchCounts();
  };

  const undoApproveUser = async (id: string) => {
    setActionLoading(id);
    await supabase.from("users").update({ status: "pending", onboarding_status: "signup" }).eq("id", id);
    setActionLoading(null);
    fetchData();
    fetchCounts();
  };

  const undoRejectUser = async (id: string) => {
    setActionLoading(id);
    await supabase.from("users").update({ status: "pending", onboarding_status: "signup", rejection_reason: null }).eq("id", id);
    setActionLoading(null);
    fetchData();
    fetchCounts();
  };

  /* ── actions — external contacts ─────────────────────── */

  const approveContact = async (id: string) => {
    setActionLoading(id);
    await supabase.from("external_contacts").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", id);
    setActionLoading(null);
    fetchData();
    fetchCounts();
  };

  const rejectContact = async (id: string) => {
    setActionLoading(id);
    await supabase.from("external_contacts").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", id);
    setActionLoading(null);
    setRejectConfirm(null);
    setRejectReason("");
    fetchData();
    fetchCounts();
  };

  const undoApproveContact = async (id: string) => {
    setActionLoading(id);
    await supabase.from("external_contacts").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", id);
    setActionLoading(null);
    fetchData();
    fetchCounts();
  };

  const undoRejectContact = async (id: string) => {
    setActionLoading(id);
    await supabase.from("external_contacts").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", id);
    setActionLoading(null);
    fetchData();
    fetchCounts();
  };

  /* ── actions — firms ─────────────────────────────────── */

  const approveFirm = async (id: string) => {
    setActionLoading(id);
    await supabase.from("firms").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", id);
    setActionLoading(null);
    fetchData();
    fetchCounts();
  };

  const rejectFirm = async (id: string) => {
    setActionLoading(id);
    await supabase.from("firms").update({ status: "inactive", updated_at: new Date().toISOString() }).eq("id", id);
    setActionLoading(null);
    setRejectConfirm(null);
    fetchData();
    fetchCounts();
  };

  const undoApproveFirm = async (id: string) => {
    setActionLoading(id);
    await supabase.from("firms").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", id);
    setActionLoading(null);
    fetchData();
    fetchCounts();
  };

  const undoRejectFirm = async (id: string) => {
    setActionLoading(id);
    await supabase.from("firms").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", id);
    setActionLoading(null);
    fetchData();
    fetchCounts();
  };

  /* ── helpers ─────────────────────────────────────────── */

  const inputStyle = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
  };

  const getCountForFilter = (s: StatusFilter, t: TypeFilter) => {
    const typeKey = t === "internal" ? "Internal" : t === "external" ? "External" : "Firms";
    const key = `${s}${typeKey}` as keyof typeof counts;
    return counts[key];
  };

  /* ── render ──────────────────────────────────────────── */

  return (
    <div className="flex gap-6">
      {/* ── Left sidebar ─────────────────────────────── */}
      <div className="w-52 shrink-0 space-y-1">
        {(["pending", "active", "rejected"] as StatusFilter[]).map((s) => {
          const sColor = STATUS_COLORS[s];
          const isActiveStatus = statusFilter === s;
          const totalForStatus = getCountForFilter(s, "internal") + getCountForFilter(s, "external") + getCountForFilter(s, "firms");

          return (
            <div key={s}>
              {/* Status header */}
              <button
                onClick={() => { setStatusFilter(s); setTypeFilter("internal"); setRejectConfirm(null); setRejectReason(""); setApproveConfirm(null); setSelectedFirmId(""); }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                style={{
                  background: isActiveStatus ? "var(--bg-hover)" : "transparent",
                  color: isActiveStatus ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                <span>{STATUS_LABELS[s]}</span>
                {totalForStatus > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: sColor.bg, color: sColor.text }}>
                    {totalForStatus}
                  </span>
                )}
              </button>

              {/* Sub-tabs when this status is active */}
              {isActiveStatus && (
                <div className="ml-3 space-y-0.5 mt-0.5 mb-1">
                  {(["internal", "external", "firms"] as TypeFilter[]).map((t) => {
                    const count = getCountForFilter(s, t);
                    const isActive = typeFilter === t;
                    return (
                      <button
                        key={t}
                        onClick={() => { setTypeFilter(t); setRejectConfirm(null); setRejectReason(""); setApproveConfirm(null); setSelectedFirmId(""); }}
                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs cursor-pointer transition-colors"
                        style={{
                          background: isActive ? "var(--bg-surface)" : "transparent",
                          color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
                        <span>{t === "internal" ? "Internal" : t === "external" ? "External" : "Firms"}</span>
                        {count > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: sColor.bg, color: sColor.text }}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Main content ──────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Section label */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-semibold">{STATUS_LABELS[statusFilter]}</span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            — {typeFilter === "internal" ? "Internal Users" : typeFilter === "external" ? "External Partners" : "Firms"}
          </span>
        </div>

        {loading ? (
          <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
        ) : (typeFilter === "internal" ? users.length : typeFilter === "external" ? contacts.length : pendingFirms.length) === 0 ? (
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: statusFilter === "pending" ? "#3a3520" : statusFilter === "active" ? "#1a3a2a" : "#4a1a1a" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={STATUS_COLORS[statusFilter].text} strokeWidth="2">
                {statusFilter === "pending" ? (
                  <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>
                ) : statusFilter === "active" ? (
                  <polyline points="20 6 9 17 4 12" />
                ) : (
                  <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
                )}
              </svg>
            </div>
            <p className="text-sm font-medium mb-1">
              {statusFilter === "pending" ? "All caught up" : statusFilter === "active" ? "No approved users" : "No denied users"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {(() => {
                const label = typeFilter === "internal" ? "internal users" : typeFilter === "external" ? "external partners" : "firms";
                return statusFilter === "pending"
                  ? `No pending ${label} to review.`
                  : statusFilter === "active"
                    ? `No approved ${label} yet.`
                    : `No denied ${label}.`;
              })()}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* ── Internal user cards ── */}
            {typeFilter === "internal" && users.map((u) => (
              <div
                key={u.id}
                className="rounded-xl p-5"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  ...(statusFilter === "pending" ? { backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(250, 204, 21, 0.03) 10px, rgba(250, 204, 21, 0.03) 20px)` } : {}),
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                      style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}
                    >
                      {initials(u.full_name)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{u.full_name}</div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <a href={`mailto:${u.email}`} style={{ color: "var(--accent)" }} className="hover:underline">{u.email}</a>
                        {u.primary_phone && <span>{u.primary_phone}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#1a2a3a", color: "#60a5fa" }}>
                          Internal
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {statusFilter === "pending" ? "Applied" : statusFilter === "active" ? "Approved" : "Denied"} {timeAgo(u.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {statusFilter === "pending" && (
                      approveConfirm === u.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedFirmId}
                            onChange={(e) => setSelectedFirmId(e.target.value)}
                            className="px-2 py-1.5 rounded-lg text-xs outline-none"
                            style={inputStyle}
                          >
                            <option value="">No Firm</option>
                            {firms.map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                          <button onClick={() => approveUser(u.id, selectedFirmId || null)} disabled={actionLoading === u.id} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: "var(--accent)", color: "#000" }}>
                            {actionLoading === u.id ? "..." : "Confirm Approve"}
                          </button>
                          <button onClick={() => { setApproveConfirm(null); setSelectedFirmId(""); }} className="px-2 py-1.5 rounded-lg text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>
                            Cancel
                          </button>
                        </div>
                      ) : rejectConfirm === u.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Reason (optional)"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="px-2 py-1.5 rounded-lg text-xs outline-none w-40"
                            style={inputStyle}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button onClick={() => rejectUser(u.id)} disabled={actionLoading === u.id} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: "#4a1a1a", color: "#ef4444" }}>
                            Confirm Deny
                          </button>
                          <button onClick={() => { setRejectConfirm(null); setRejectReason(""); setApproveConfirm(null); setSelectedFirmId(""); }} className="px-2 py-1.5 rounded-lg text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => { setApproveConfirm(u.id); setRejectConfirm(null); setSelectedFirmId(""); }} disabled={actionLoading === u.id} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }}>
                            {actionLoading === u.id ? "..." : "Approve"}
                          </button>
                          <button onClick={() => { setRejectConfirm(u.id); setApproveConfirm(null); }} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors" style={{ background: "#4a1a1a", color: "#ef4444" }}>
                            Deny
                          </button>
                        </>
                      )
                    )}
                    {statusFilter === "active" && (
                      <button onClick={() => undoApproveUser(u.id)} disabled={actionLoading === u.id} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "#3a3520", color: "#facc15" }}>
                        {actionLoading === u.id ? "..." : "Move to Pending"}
                      </button>
                    )}
                    {statusFilter === "rejected" && (
                      <button onClick={() => undoRejectUser(u.id)} disabled={actionLoading === u.id} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "#3a3520", color: "#facc15" }}>
                        {actionLoading === u.id ? "..." : "Move to Pending"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* ── Firm cards ── */}
            {typeFilter === "firms" && pendingFirms.map((f) => (
              <div
                key={f.id}
                className="rounded-xl p-5"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  ...(statusFilter === "pending" ? { backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(250, 204, 21, 0.03) 10px, rgba(250, 204, 21, 0.03) 20px)` } : {}),
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                      style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}
                    >
                      {initials(f.name)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{f.name}</div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                        {f.contact_name && <span>{f.contact_name}</span>}
                        {f.contact_email && <a href={`mailto:${f.contact_email}`} style={{ color: "var(--accent)" }} className="hover:underline">{f.contact_email}</a>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#1a2a3a", color: "#60a5fa" }}>
                          Firm
                        </span>
                        {f.entity_type && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#2a1a3a", color: "#c084fc" }}>
                            {f.entity_type}
                          </span>
                        )}
                        {(f.city || f.state) && (
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {[f.city, f.state].filter(Boolean).join(", ")}
                          </span>
                        )}
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {statusFilter === "pending" ? "Submitted" : statusFilter === "active" ? "Approved" : "Denied"} {timeAgo(f.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {statusFilter === "pending" && (
                      rejectConfirm === f.id ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => rejectFirm(f.id)} disabled={actionLoading === f.id} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: "#4a1a1a", color: "#ef4444" }}>
                            Confirm Deny
                          </button>
                          <button onClick={() => setRejectConfirm(null)} className="px-2 py-1.5 rounded-lg text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => approveFirm(f.id)} disabled={actionLoading === f.id} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }}>
                            {actionLoading === f.id ? "..." : "Approve"}
                          </button>
                          <button onClick={() => setRejectConfirm(f.id)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors" style={{ background: "#4a1a1a", color: "#ef4444" }}>
                            Deny
                          </button>
                        </>
                      )
                    )}
                    {statusFilter === "active" && (
                      <button onClick={() => undoApproveFirm(f.id)} disabled={actionLoading === f.id} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "#3a3520", color: "#facc15" }}>
                        {actionLoading === f.id ? "..." : "Move to Pending"}
                      </button>
                    )}
                    {statusFilter === "rejected" && (
                      <button onClick={() => undoRejectFirm(f.id)} disabled={actionLoading === f.id} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "#3a3520", color: "#facc15" }}>
                        {actionLoading === f.id ? "..." : "Move to Pending"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* ── External contact cards ── */}
            {typeFilter === "external" && contacts.map((c) => (
              <div
                key={c.id}
                className="rounded-xl p-5"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  ...(statusFilter === "pending" ? { backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(250, 204, 21, 0.03) 10px, rgba(250, 204, 21, 0.03) 20px)` } : {}),
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                      style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}
                    >
                      {initials(c.name)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{c.name}</div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                        {c.email && <a href={`mailto:${c.email}`} style={{ color: "var(--accent)" }} className="hover:underline">{c.email}</a>}
                        {c.phone && <span>{c.phone}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#2a1a3a", color: "#c084fc" }}>
                          {c.specialty === "Other" ? c.specialty_other ?? "Other" : c.specialty}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#3a3520", color: "#facc15" }}>
                          External Partner
                        </span>
                        {c.company_name && (
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {c.company_name}
                          </span>
                        )}
                        {c.states && c.states.length > 0 && (
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {c.states.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {statusFilter === "pending" && (
                      rejectConfirm === c.id ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => rejectContact(c.id)} disabled={actionLoading === c.id} className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ background: "#4a1a1a", color: "#ef4444" }}>
                            Confirm Deny
                          </button>
                          <button onClick={() => { setRejectConfirm(null); }} className="px-2 py-1.5 rounded-lg text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => approveContact(c.id)} disabled={actionLoading === c.id} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }}>
                            {actionLoading === c.id ? "..." : "Approve"}
                          </button>
                          <button onClick={() => setRejectConfirm(c.id)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors" style={{ background: "#4a1a1a", color: "#ef4444" }}>
                            Deny
                          </button>
                        </>
                      )
                    )}
                    {statusFilter === "active" && (
                      <button onClick={() => undoApproveContact(c.id)} disabled={actionLoading === c.id} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "#3a3520", color: "#facc15" }}>
                        {actionLoading === c.id ? "..." : "Move to Pending"}
                      </button>
                    )}
                    {statusFilter === "rejected" && (
                      <button onClick={() => undoRejectContact(c.id)} disabled={actionLoading === c.id} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50" style={{ background: "#3a3520", color: "#facc15" }}>
                        {actionLoading === c.id ? "..." : "Move to Pending"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
