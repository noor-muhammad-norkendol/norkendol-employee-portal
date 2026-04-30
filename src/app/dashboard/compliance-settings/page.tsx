"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";

/* ── types ─────────────────────────────────────────────── */

interface UserInfo { id: string; full_name: string; email: string; }

interface LicenseRow {
  id: string; user_id: string; org_id: string;
  license_type: string | null; state: string; license_number: string | null;
  issuer: string | null; issue_date: string | null; expiry_date: string | null;
  status: string; review_notes: string | null; document_url: string | null;
  created_at: string;
}

interface BondRow {
  id: string; user_id: string; org_id: string;
  bond_type: string | null; state: string; bond_number: string | null;
  issuer: string | null; amount: number | null;
  issue_date: string | null; expiry_date: string | null;
  status: string; review_notes: string | null; document_url: string | null;
  created_at: string;
}

type Tab = "licenses" | "bonds" | "pending" | "activity" | "calendar";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","IA","ID","IL","IN","KS","KY","LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ","NM","NV","NY","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA","WI","WV","WY"];

const LICENSE_TYPES = ["Adjuster", "All-Lines (620)", "Canadian (CAN)", "FL Notary"];

/* ── status helpers ────────────────────────────────────── */

type ComplianceStatus = "active" | "expiring_90" | "expiring_30" | "expired" | "no_date";

function calcStatus(expiryDate: string | null): ComplianceStatus {
  if (!expiryDate) return "no_date";
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate); expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "expiring_30";
  if (diffDays <= 90) return "expiring_90";
  return "active";
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  approved: { bg: "#1a3a2a", text: "#4ade80" },
  pending: { bg: "#3a3520", text: "#facc15" },
  rejected: { bg: "#4a1a1a", text: "#ef4444" },
  active: { bg: "#1a3a2a", text: "#4ade80" },
  expiring_90: { bg: "#3a3520", text: "#facc15" },
  expiring_30: { bg: "#4a2a10", text: "#fb923c" },
  expired: { bg: "#4a1a1a", text: "#ef4444" },
  no_date: { bg: "#2a2a2a", text: "#888888" },
};

function Badge({ label, colors }: { label: string; colors: { bg: string; text: string } }) {
  return (
    <span style={{ background: colors.bg, color: colors.text, padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

/* ── main component ────────────────────────────────────── */

export default function ComplianceAdminPage() {
  const [supabase] = useState(() => createClient());

  const [user, setUser] = useState<{ id: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("licenses");

  const [users, setUsers] = useState<UserInfo[]>([]);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [bonds, setBonds] = useState<BondRow[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Edit modal
  const [editItem, setEditItem] = useState<(LicenseRow | BondRow) & { _kind: "license" | "bond" } | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  // Add modal
  const [showAdd, setShowAdd] = useState<"license" | "bond" | null>(null);
  const [addForm, setAddForm] = useState<Record<string, string>>({});

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; kind: "license" | "bond"; name: string } | null>(null);

  // Calendar state
  const [calYear, setCalYear] = useState(2026);
  const [calMonth, setCalMonth] = useState<number | null>(null); // null = year overview, 0-11 = month detail
  const [calDay, setCalDay] = useState<number | null>(null);

  // File upload ref
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ id: string; userId: string; kind: "license" | "bond" } | null>(null);

  /* ── user name map ─────────────────────────────────── */
  const userMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const u of users) m[u.id] = u.full_name;
    return m;
  }, [users]);

  /* ── auth ───────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data } = await supabase.from("users").select("id, role").eq("id", authUser.id).single();
      if (data) setUser(data);
    })();
  }, []);

  /* ── data loading ──────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [uRes, lRes, bRes] = await Promise.all([
      supabase.from("users").select("id, full_name, email").eq("org_id", ORG_ID).eq("user_type", "internal").order("full_name"),
      supabase.from("licenses").select("*").eq("org_id", ORG_ID).order("created_at", { ascending: false }),
      supabase.from("bonds").select("*").eq("org_id", ORG_ID).order("created_at", { ascending: false }),
    ]);
    if (uRes.data) setUsers(uRes.data);
    if (lRes.data) setLicenses(lRes.data);
    if (bRes.data) setBonds(bRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── filtered data ─────────────────────────────────── */
  const filteredLicenses = useMemo(() => {
    return licenses.filter(l => {
      const name = (userMap[l.user_id] || "").toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (stateFilter && l.state !== stateFilter) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (typeFilter !== "all" && l.license_type !== typeFilter) return false;
      return true;
    });
  }, [licenses, search, stateFilter, statusFilter, typeFilter, userMap]);

  const filteredBonds = useMemo(() => {
    return bonds.filter(b => {
      const name = (userMap[b.user_id] || "").toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (stateFilter && b.state !== stateFilter) return false;
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      return true;
    });
  }, [bonds, search, stateFilter, statusFilter, userMap]);

  const pendingItems = useMemo(() => {
    const pLicenses = licenses.filter(l => l.status === "pending").map(l => ({ ...l, _kind: "license" as const }));
    const pBonds = bonds.filter(b => b.status === "pending").map(b => ({ ...b, _kind: "bond" as const }));
    return [...pLicenses, ...pBonds].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [licenses, bonds]);

  /* ── summary stats ─────────────────────────────────── */
  const licenseStats = useMemo(() => {
    const approved = licenses.filter(l => l.status === "approved").length;
    const pending = licenses.filter(l => l.status === "pending").length;
    const expiringSoon = licenses.filter(l => l.status === "approved" && (calcStatus(l.expiry_date) === "expiring_30" || calcStatus(l.expiry_date) === "expiring_90")).length;
    const expired = licenses.filter(l => l.status === "approved" && calcStatus(l.expiry_date) === "expired").length;
    return { total: licenses.length, approved, pending, expiringSoon, expired };
  }, [licenses]);

  const bondStats = useMemo(() => {
    const approved = bonds.filter(b => b.status === "approved").length;
    const pending = bonds.filter(b => b.status === "pending").length;
    return { total: bonds.length, approved, pending };
  }, [bonds]);

  /* ── calendar events ────────────────────────────────── */
  interface CalEvent {
    date: string; // YYYY-MM-DD
    person: string;
    state: string;
    type: "License" | "Bond" | "E&O";
    amount: string;
    notes: string;
    status: string;
    compStatus: ComplianceStatus;
  }

  const calendarEvents = useMemo(() => {
    const evts: CalEvent[] = [];
    for (const l of licenses) {
      if (!l.expiry_date) continue;
      evts.push({
        date: l.expiry_date,
        person: userMap[l.user_id] || "Unknown",
        state: l.state,
        type: "License",
        amount: "",
        notes: l.review_notes || "",
        status: l.status,
        compStatus: calcStatus(l.expiry_date),
      });
    }
    for (const b of bonds) {
      if (!b.expiry_date) continue;
      evts.push({
        date: b.expiry_date,
        person: userMap[b.user_id] || "Unknown",
        state: b.state,
        type: "Bond",
        amount: b.amount ? `$${b.amount.toLocaleString()}` : "",
        notes: b.review_notes || "",
        status: b.status,
        compStatus: calcStatus(b.expiry_date),
      });
    }
    return evts;
  }, [licenses, bonds, userMap]);

  // Group events by YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const e of calendarEvents) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [calendarEvents]);

  // Events for selected year, grouped by month
  const yearEvents = useMemo(() => {
    return calendarEvents.filter(e => e.date.startsWith(`${calYear}-`));
  }, [calendarEvents, calYear]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  function daysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
  }
  function firstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
  }
  function eventsForDay(year: number, month: number, day: number) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return eventsByDate[key] || [];
  }
  function eventsForMonth(year: number, month: number) {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    return calendarEvents.filter(e => e.date.startsWith(prefix));
  }

  /* ── actions ────────────────────────────────────────── */
  const updateStatus = async (id: string, kind: "license" | "bond", status: string) => {
    if (!user) return;
    const table = kind === "license" ? "licenses" : "bonds";
    await supabase.from(table).update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", id);
    await fetchAll();
  };

  const saveEdit = async () => {
    if (!editItem || !user) return;
    const table = editItem._kind === "license" ? "licenses" : "bonds";
    const updates: Record<string, unknown> = {};

    if (editItem._kind === "license") {
      updates.license_type = editForm.license_type || null;
      updates.license_number = editForm.license_number || null;
    } else {
      updates.bond_type = editForm.bond_type || null;
      updates.bond_number = editForm.bond_number || null;
      updates.amount = editForm.amount ? parseFloat(editForm.amount) : null;
    }
    updates.state = editForm.state || editItem.state;
    updates.issuer = editForm.issuer || null;
    updates.issue_date = editForm.issue_date || null;
    updates.expiry_date = editForm.expiry_date || null;
    updates.status = editForm.status || editItem.status;
    updates.review_notes = editForm.review_notes || null;

    if (editForm.status && editForm.status !== editItem.status) {
      updates.reviewed_by = user.id;
      updates.reviewed_at = new Date().toISOString();
    }

    await supabase.from(table).update(updates).eq("id", editItem.id);
    setEditItem(null);
    await fetchAll();
  };

  const addRecord = async () => {
    if (!showAdd || !user || !addForm.user_id || !addForm.state) return;
    const table = showAdd === "license" ? "licenses" : "bonds";
    const record: Record<string, unknown> = {
      user_id: addForm.user_id,
      org_id: ORG_ID,
      state: addForm.state,
      status: addForm.status || "approved",
    };
    if (showAdd === "license") {
      record.license_type = addForm.license_type || "Adjuster";
      record.license_number = addForm.license_number || null;
    } else {
      record.bond_type = addForm.bond_type || null;
      record.bond_number = addForm.bond_number || null;
      record.amount = addForm.amount ? parseFloat(addForm.amount) : null;
    }
    record.issuer = addForm.issuer || null;
    record.issue_date = addForm.issue_date || null;
    record.expiry_date = addForm.expiry_date || null;
    record.review_notes = addForm.review_notes || null;

    await supabase.from(table).insert(record);
    setShowAdd(null);
    setAddForm({});
    await fetchAll();
  };

  const deleteRecord = async () => {
    if (!deleteTarget) return;
    const table = deleteTarget.kind === "license" ? "licenses" : "bonds";
    await supabase.from(table).delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    await fetchAll();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!uploadTarget || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${uploadTarget.userId}/${uploadTarget.kind}s/${uploadTarget.id}.${ext}`;

    await supabase.storage.from("compliance-docs").upload(path, file, { upsert: true });
    const table = uploadTarget.kind === "license" ? "licenses" : "bonds";
    await supabase.from(table).update({ document_url: path }).eq("id", uploadTarget.id);
    setUploadTarget(null);
    if (fileRef.current) fileRef.current.value = "";
    await fetchAll();
  };

  const downloadDoc = async (docPath: string) => {
    const { data } = await supabase.storage.from("compliance-docs").download(docPath);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = docPath.split("/").pop() || "document";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  /* ── permission check ──────────────────────────────── */
  const isAdmin = user && ["admin", "super_admin", "system_admin"].includes(user.role);

  if (!isAdmin && user) {
    return <div style={{ padding: 32 }}><h1 style={{ fontSize: 20, fontWeight: 600 }}>Access Denied</h1><p style={{ color: "var(--text-secondary)", marginTop: 8 }}>Admin access required.</p></div>;
  }

  /* ── styles ─────────────────────────────────────────── */
  const cardStyle: React.CSSProperties = { background: "var(--bg-surface)", borderRadius: 10, padding: 16, border: "1px solid var(--border)", position: "relative", zIndex: 1 };
  const inputStyle: React.CSSProperties = { background: "var(--bg-input, #1a1a1a)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", color: "var(--text-primary)", fontSize: 13, width: "100%" };
  const btnPrimary: React.CSSProperties = { background: "var(--accent, #3b82f6)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" };
  const btnGhost: React.CSSProperties = { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer" };
  const modalOverlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
  const modalBox: React.CSSProperties = { background: "var(--bg-surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", border: "1px solid var(--border)" };

  /* ── tab data ───────────────────────────────────────── */
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "licenses", label: "Licenses", count: licenses.length },
    { key: "bonds", label: "Bonds", count: bonds.length },
    { key: "pending", label: "Pending Approvals", count: pendingItems.length },
    { key: "activity", label: "Activity Log" },
    { key: "calendar", label: "Calendar", count: yearEvents.length },
  ];

  /* ── render row for license or bond ────────────────── */
  const renderRow = (item: LicenseRow | BondRow, kind: "license" | "bond") => {
    const name = userMap[item.user_id] || "Unknown";
    const typeLabel = kind === "license" ? (item as LicenseRow).license_type : (item as BondRow).bond_type;
    const numberLabel = kind === "license" ? (item as LicenseRow).license_number : (item as BondRow).bond_number;
    const compStatus = item.status === "approved" ? calcStatus(item.expiry_date) : null;
    const statusColors = STATUS_COLORS[item.status] || STATUS_COLORS.no_date;

    return (
      <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
        <td style={{ padding: "10px 8px", fontSize: 13, fontWeight: 500 }}>{name}</td>
        <td style={{ padding: "10px 8px", fontSize: 13 }}>{item.state}</td>
        <td style={{ padding: "10px 8px", fontSize: 13 }}>{typeLabel || "—"}</td>
        <td style={{ padding: "10px 8px", fontSize: 13 }}>{numberLabel || "—"}</td>
        <td style={{ padding: "10px 8px", fontSize: 13 }}>{item.issuer || "—"}</td>
        <td style={{ padding: "10px 8px", fontSize: 13 }}>{item.expiry_date || "—"}</td>
        {kind === "bond" && <td style={{ padding: "10px 8px", fontSize: 13 }}>{(item as BondRow).amount ? `$${(item as BondRow).amount!.toLocaleString()}` : "—"}</td>}
        <td style={{ padding: "10px 8px" }}>
          <Badge label={item.status} colors={statusColors} />
          {compStatus && compStatus !== "active" && compStatus !== "no_date" && (
            <Badge label={compStatus.replace("_", " ")} colors={STATUS_COLORS[compStatus]} />
          )}
        </td>
        <td style={{ padding: "10px 8px", fontSize: 13 }}>{item.review_notes || ""}</td>
        <td style={{ padding: "10px 4px", whiteSpace: "nowrap" }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {/* Edit */}
            <button onClick={() => {
              const form: Record<string, string> = {
                state: item.state,
                issuer: item.issuer || "",
                issue_date: item.issue_date || "",
                expiry_date: item.expiry_date || "",
                status: item.status,
                review_notes: item.review_notes || "",
              };
              if (kind === "license") {
                form.license_type = (item as LicenseRow).license_type || "";
                form.license_number = (item as LicenseRow).license_number || "";
              } else {
                form.bond_type = (item as BondRow).bond_type || "";
                form.bond_number = (item as BondRow).bond_number || "";
                form.amount = (item as BondRow).amount?.toString() || "";
              }
              setEditItem({ ...item, _kind: kind });
              setEditForm(form);
            }} style={{ ...btnGhost, padding: "3px 8px", fontSize: 12 }} title="Edit">
              Edit
            </button>
            {/* Approve/Reject for pending */}
            {item.status === "pending" && (
              <>
                <button onClick={() => updateStatus(item.id, kind, "approved")} style={{ ...btnPrimary, padding: "3px 8px", fontSize: 12, background: "#166534" }} title="Approve">Approve</button>
                <button onClick={() => updateStatus(item.id, kind, "rejected")} style={{ ...btnGhost, padding: "3px 8px", fontSize: 12, color: "#ef4444", borderColor: "#ef4444" }} title="Reject">Reject</button>
              </>
            )}
            {/* Document */}
            {item.document_url ? (
              <button onClick={() => downloadDoc(item.document_url!)} style={{ ...btnGhost, padding: "3px 8px", fontSize: 12, color: "#3b82f6" }} title="Download">Doc</button>
            ) : null}
            <button onClick={() => { setUploadTarget({ id: item.id, userId: item.user_id, kind }); fileRef.current?.click(); }} style={{ ...btnGhost, padding: "3px 8px", fontSize: 12 }} title="Upload document">
              {item.document_url ? "Replace" : "Upload"}
            </button>
            {/* Delete */}
            <button onClick={() => setDeleteTarget({ id: item.id, kind, name: `${name} - ${item.state}` })} style={{ ...btnGhost, padding: "3px 8px", fontSize: 12, color: "#ef4444", borderColor: "#ef4444" }} title="Delete">Del</button>
          </div>
        </td>
      </tr>
    );
  };

  /* ── table header ──────────────────────────────────── */
  const tableHeader = (kind: "license" | "bond") => (
    <thead>
      <tr style={{ borderBottom: "2px solid var(--border)" }}>
        <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Person</th>
        <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>State</th>
        <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{kind === "license" ? "License Type" : "Bond Type"}</th>
        <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{kind === "license" ? "License #" : "Bond #"}</th>
        <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Issuer</th>
        <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Expiry</th>
        {kind === "bond" && <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Amount</th>}
        <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Status</th>
        <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Notes</th>
        <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Actions</th>
      </tr>
    </thead>
  );

  /* ── stat card ─────────────────────────────────────── */
  const StatCard = ({ label, value, color }: { label: string; value: number; color?: string }) => (
    <div style={{ ...cardStyle, textAlign: "center", minWidth: 100 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{label}</div>
    </div>
  );

  /* ── render ─────────────────────────────────────────── */
  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Compliance Admin</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>Manage licenses, bonds, and compliance documents across the organization.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setShowAdd("license"); setAddForm({ status: "approved", license_type: "Adjuster" }); }} style={btnPrimary}>+ Add License</button>
          <button onClick={() => { setShowAdd("bond"); setAddForm({ status: "approved" }); }} style={{ ...btnPrimary, background: "#7c3aed" }}>+ Add Bond</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)",
              background: tab === t.key ? "var(--bg-hover)" : "transparent",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--accent, #3b82f6)" : "2px solid transparent",
              cursor: "pointer",
              borderRadius: "6px 6px 0 0",
            }}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "var(--text-secondary)", padding: 20 }}>Loading...</p>}

      {!loading && tab === "licenses" && (
        <>
          {/* Stats */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <StatCard label="Total Licenses" value={licenseStats.total} />
            <StatCard label="Approved" value={licenseStats.approved} color="#4ade80" />
            <StatCard label="Pending" value={licenseStats.pending} color="#facc15" />
            <StatCard label="Expiring Soon" value={licenseStats.expiringSoon} color="#fb923c" />
            <StatCard label="Expired" value={licenseStats.expired} color="#ef4444" />
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, maxWidth: 220 }} />
            <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} style={{ ...inputStyle, maxWidth: 100 }}>
              <option value="">All States</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, maxWidth: 130 }}>
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...inputStyle, maxWidth: 160 }}>
              <option value="all">All Types</option>
              {LICENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {(search || stateFilter || statusFilter !== "all" || typeFilter !== "all") && (
              <button onClick={() => { setSearch(""); setStateFilter(""); setStatusFilter("all"); setTypeFilter("all"); }} style={{ ...btnGhost, fontSize: 12 }}>Clear</button>
            )}
            <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>{filteredLicenses.length} result(s)</span>
          </div>

          {/* Table */}
          <div style={{ ...cardStyle, padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              {tableHeader("license")}
              <tbody>
                {filteredLicenses.map(l => renderRow(l, "license"))}
                {filteredLicenses.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>No licenses found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && tab === "bonds" && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <StatCard label="Total Bonds" value={bondStats.total} />
            <StatCard label="Approved" value={bondStats.approved} color="#4ade80" />
            <StatCard label="Pending" value={bondStats.pending} color="#facc15" />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder="Search by name..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, maxWidth: 220 }} />
            <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} style={{ ...inputStyle, maxWidth: 100 }}>
              <option value="">All States</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, maxWidth: 130 }}>
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>{filteredBonds.length} result(s)</span>
          </div>

          <div style={{ ...cardStyle, padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              {tableHeader("bond")}
              <tbody>
                {filteredBonds.map(b => renderRow(b, "bond"))}
                {filteredBonds.length === 0 && (
                  <tr><td colSpan={11} style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>No bonds found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && tab === "pending" && (
        <>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 12 }}>{pendingItems.length} item(s) awaiting approval</p>
          <div style={{ ...cardStyle, padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Type</th>
                  <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Person</th>
                  <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>State</th>
                  <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Detail</th>
                  <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Notes</th>
                  <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Created</th>
                  <th style={{ padding: "8px", textAlign: "left", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingItems.map(item => (
                  <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 8px", fontSize: 13 }}><Badge label={item._kind === "license" ? "License" : "Bond"} colors={{ bg: item._kind === "license" ? "#1a2a3a" : "#2a1a3a", text: item._kind === "license" ? "#60a5fa" : "#a78bfa" }} /></td>
                    <td style={{ padding: "10px 8px", fontSize: 13, fontWeight: 500 }}>{userMap[item.user_id] || "Unknown"}</td>
                    <td style={{ padding: "10px 8px", fontSize: 13 }}>{item.state}</td>
                    <td style={{ padding: "10px 8px", fontSize: 13 }}>{item._kind === "license" ? (item as LicenseRow).license_type : (item as BondRow).bond_type || "—"}</td>
                    <td style={{ padding: "10px 8px", fontSize: 13, color: "var(--text-secondary)" }}>{item.review_notes || "—"}</td>
                    <td style={{ padding: "10px 8px", fontSize: 13, color: "var(--text-secondary)" }}>{new Date(item.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => updateStatus(item.id, item._kind, "approved")} style={{ ...btnPrimary, padding: "3px 10px", fontSize: 12, background: "#166534" }}>Approve</button>
                        <button onClick={() => updateStatus(item.id, item._kind, "rejected")} style={{ ...btnGhost, padding: "3px 10px", fontSize: 12, color: "#ef4444", borderColor: "#ef4444" }}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingItems.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>No pending items. All caught up.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && tab === "activity" && (
        <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Activity Log coming soon.</p>
          <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>Will track all license/bond approvals, edits, and uploads.</p>
        </div>
      )}

      {!loading && tab === "calendar" && (
        <>
          {/* Year nav + summary */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => { setCalYear(y => y - 1); setCalMonth(null); setCalDay(null); }} style={{ ...btnGhost, padding: "4px 10px" }}>&larr;</button>
              <span style={{ fontSize: 20, fontWeight: 700 }}>{calYear}</span>
              <button onClick={() => { setCalYear(y => y + 1); setCalMonth(null); setCalDay(null); }} style={{ ...btnGhost, padding: "4px 10px" }}>&rarr;</button>
              {calMonth !== null && (
                <button onClick={() => { setCalMonth(null); setCalDay(null); }} style={{ ...btnGhost, fontSize: 12, marginLeft: 8 }}>&larr; Back to Year</button>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", marginRight: 4 }} />Licenses ({yearEvents.filter(e => e.type === "License").length})</span>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#a855f7", marginRight: 4 }} />Bonds ({yearEvents.filter(e => e.type === "Bond").length})</span>
            </div>
          </div>

          {/* Year overview — 12 mini months */}
          {calMonth === null && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {Array.from({ length: 12 }, (_, mi) => {
                const mEvts = eventsForMonth(calYear, mi);
                const days = daysInMonth(calYear, mi);
                const first = firstDayOfMonth(calYear, mi);
                const expiring = mEvts.filter(e => e.compStatus === "expiring_30" || e.compStatus === "expiring_90").length;
                const expired = mEvts.filter(e => e.compStatus === "expired").length;
                return (
                  <div key={mi} style={{ ...cardStyle, cursor: "pointer", padding: 12 }} onClick={() => { setCalMonth(mi); setCalDay(null); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{monthNames[mi]}</span>
                      {mEvts.length > 0 && (
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{mEvts.length} event{mEvts.length !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                    {/* Mini calendar grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, fontSize: 10, textAlign: "center" }}>
                      {dayNames.map(d => <div key={d} style={{ color: "var(--text-muted)", padding: "1px 0", fontWeight: 600 }}>{d}</div>)}
                      {Array.from({ length: first }, (_, i) => <div key={`pad-${i}`} />)}
                      {Array.from({ length: days }, (_, i) => {
                        const day = i + 1;
                        const dayEvts = eventsForDay(calYear, mi, day);
                        const hasLicense = dayEvts.some(e => e.type === "License");
                        const hasBond = dayEvts.some(e => e.type === "Bond");
                        const hasExpired = dayEvts.some(e => e.compStatus === "expired");
                        const hasExpiring = dayEvts.some(e => e.compStatus === "expiring_30");
                        return (
                          <div key={day} style={{
                            padding: "2px 0",
                            color: dayEvts.length > 0 ? "#fff" : "var(--text-muted)",
                            fontWeight: dayEvts.length > 0 ? 600 : 400,
                            background: hasExpired ? "rgba(239,68,68,0.3)" : hasExpiring ? "rgba(251,146,60,0.3)" : dayEvts.length > 0 ? "rgba(59,130,246,0.15)" : "transparent",
                            borderRadius: 3,
                            position: "relative",
                          }}>
                            {day}
                            {dayEvts.length > 0 && (
                              <div style={{ display: "flex", gap: 1, justifyContent: "center", position: "absolute", bottom: -2, left: 0, right: 0 }}>
                                {hasLicense && <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#3b82f6" }} />}
                                {hasBond && <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#a855f7" }} />}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Month summary badges */}
                    {(expiring > 0 || expired > 0) && (
                      <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                        {expired > 0 && <Badge label={`${expired} expired`} colors={STATUS_COLORS.expired} />}
                        {expiring > 0 && <Badge label={`${expiring} expiring`} colors={STATUS_COLORS.expiring_30} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Month detail view */}
          {calMonth !== null && (() => {
            const days = daysInMonth(calYear, calMonth);
            const first = firstDayOfMonth(calYear, calMonth);
            const mEvts = eventsForMonth(calYear, calMonth).sort((a, b) => a.date.localeCompare(b.date));
            const selectedDayEvts = calDay ? eventsForDay(calYear, calMonth, calDay) : [];

            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Left — calendar grid */}
                <div style={cardStyle}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{monthNames[calMonth]} {calYear}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
                    {dayNames.map(d => <div key={d} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", padding: "4px 0" }}>{d}</div>)}
                    {Array.from({ length: first }, (_, i) => <div key={`pad-${i}`} />)}
                    {Array.from({ length: days }, (_, i) => {
                      const day = i + 1;
                      const dayEvts = eventsForDay(calYear, calMonth, day);
                      const isSelected = calDay === day;
                      const hasExpired = dayEvts.some(e => e.compStatus === "expired");
                      const hasExpiring = dayEvts.some(e => e.compStatus === "expiring_30");
                      const isToday = (() => {
                        const now = new Date();
                        return now.getFullYear() === calYear && now.getMonth() === calMonth && now.getDate() === day;
                      })();
                      return (
                        <div
                          key={day}
                          onClick={() => setCalDay(dayEvts.length > 0 ? day : null)}
                          style={{
                            padding: "6px 2px",
                            fontSize: 13,
                            fontWeight: dayEvts.length > 0 ? 600 : 400,
                            borderRadius: 6,
                            cursor: dayEvts.length > 0 ? "pointer" : "default",
                            color: dayEvts.length > 0 ? "#fff" : "var(--text-secondary)",
                            background: isSelected ? "var(--accent, #3b82f6)" : hasExpired ? "rgba(239,68,68,0.35)" : hasExpiring ? "rgba(251,146,60,0.35)" : dayEvts.length > 0 ? "rgba(59,130,246,0.2)" : "transparent",
                            border: isToday ? "1px solid var(--accent, #3b82f6)" : "1px solid transparent",
                            position: "relative",
                          }}
                        >
                          {day}
                          {dayEvts.length > 1 && (
                            <span style={{ position: "absolute", top: 1, right: 3, fontSize: 8, color: "var(--text-muted)" }}>{dayEvts.length}</span>
                          )}
                          {dayEvts.length > 0 && (
                            <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 2 }}>
                              {dayEvts.some(e => e.type === "License") && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#3b82f6" }} />}
                              {dayEvts.some(e => e.type === "Bond") && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#a855f7" }} />}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right — event list */}
                <div style={cardStyle}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                    {calDay ? `${monthNames[calMonth]} ${calDay}, ${calYear}` : `All events in ${monthNames[calMonth]}`}
                    {calDay && <button onClick={() => setCalDay(null)} style={{ ...btnGhost, fontSize: 11, marginLeft: 8, padding: "2px 8px" }}>Show all</button>}
                  </h3>
                  <div style={{ maxHeight: 500, overflowY: "auto" }}>
                    {(calDay ? selectedDayEvts : mEvts).length === 0 ? (
                      <p style={{ color: "var(--text-secondary)", fontSize: 13, padding: 16, textAlign: "center" }}>
                        {calDay ? "No events on this day." : "No events this month."}
                      </p>
                    ) : (
                      (calDay ? selectedDayEvts : mEvts).map((evt, idx) => (
                        <div key={idx} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>
                              {!calDay && <span style={{ color: "var(--text-muted)", marginRight: 6 }}>{evt.date.slice(8)}</span>}
                              {evt.person}
                              <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>{evt.state}</span>
                            </div>
                            <div style={{ display: "flex", gap: 4, marginTop: 3 }}>
                              <Badge
                                label={evt.type}
                                colors={evt.type === "License" ? { bg: "#1a2a3a", text: "#60a5fa" } : { bg: "#2a1a3a", text: "#a78bfa" }}
                              />
                              {evt.amount && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{evt.amount}</span>}
                              {evt.compStatus !== "active" && evt.compStatus !== "no_date" && (
                                <Badge label={evt.compStatus.replace("_", " ")} colors={STATUS_COLORS[evt.compStatus]} />
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: "none" }} onChange={handleFileUpload} />

      {/* Edit Modal */}
      {editItem && (
        <div style={modalOverlay} onClick={() => setEditItem(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Edit {editItem._kind === "license" ? "License" : "Bond"}</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>{userMap[editItem.user_id]} — {editItem.state}</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {editItem._kind === "license" ? (
                <>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>License Type</label>
                    <select value={editForm.license_type || ""} onChange={e => setEditForm(f => ({ ...f, license_type: e.target.value }))} style={inputStyle}>
                      <option value="">—</option>
                      {LICENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>License #</label>
                    <input value={editForm.license_number || ""} onChange={e => setEditForm(f => ({ ...f, license_number: e.target.value }))} style={inputStyle} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Bond Type</label>
                    <input value={editForm.bond_type || ""} onChange={e => setEditForm(f => ({ ...f, bond_type: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Bond #</label>
                    <input value={editForm.bond_number || ""} onChange={e => setEditForm(f => ({ ...f, bond_number: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Amount ($)</label>
                    <input type="number" value={editForm.amount || ""} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} />
                  </div>
                </>
              )}

              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>State</label>
                <select value={editForm.state || ""} onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))} style={inputStyle}>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Issuer</label>
                <input value={editForm.issuer || ""} onChange={e => setEditForm(f => ({ ...f, issuer: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Issue Date</label>
                <input type="date" value={editForm.issue_date || ""} onChange={e => setEditForm(f => ({ ...f, issue_date: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Expiry Date</label>
                <input type="date" value={editForm.expiry_date || ""} onChange={e => setEditForm(f => ({ ...f, expiry_date: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Status</label>
                <select value={editForm.status || ""} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Notes</label>
              <input value={editForm.review_notes || ""} onChange={e => setEditForm(f => ({ ...f, review_notes: e.target.value }))} style={inputStyle} placeholder="Admin notes..." />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => setEditItem(null)} style={btnGhost}>Cancel</button>
              <button onClick={saveEdit} style={btnPrimary}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div style={modalOverlay} onClick={() => setShowAdd(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Add {showAdd === "license" ? "License" : "Bond"}</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Person *</label>
                <select value={addForm.user_id || ""} onChange={e => setAddForm(f => ({ ...f, user_id: e.target.value }))} style={inputStyle}>
                  <option value="">Select a person...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>State *</label>
                <select value={addForm.state || ""} onChange={e => setAddForm(f => ({ ...f, state: e.target.value }))} style={inputStyle}>
                  <option value="">Select state...</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {showAdd === "license" ? (
                <>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>License Type</label>
                    <select value={addForm.license_type || "Adjuster"} onChange={e => setAddForm(f => ({ ...f, license_type: e.target.value }))} style={inputStyle}>
                      {LICENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>License #</label>
                    <input value={addForm.license_number || ""} onChange={e => setAddForm(f => ({ ...f, license_number: e.target.value }))} style={inputStyle} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Bond Type</label>
                    <input value={addForm.bond_type || ""} onChange={e => setAddForm(f => ({ ...f, bond_type: e.target.value }))} style={inputStyle} placeholder="e.g., Surety Bond" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Bond #</label>
                    <input value={addForm.bond_number || ""} onChange={e => setAddForm(f => ({ ...f, bond_number: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Amount ($)</label>
                    <input type="number" value={addForm.amount || ""} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} style={inputStyle} />
                  </div>
                </>
              )}

              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Issuer</label>
                <input value={addForm.issuer || ""} onChange={e => setAddForm(f => ({ ...f, issuer: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Issue Date</label>
                <input type="date" value={addForm.issue_date || ""} onChange={e => setAddForm(f => ({ ...f, issue_date: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Expiry Date</label>
                <input type="date" value={addForm.expiry_date || ""} onChange={e => setAddForm(f => ({ ...f, expiry_date: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Status</label>
                <select value={addForm.status || "approved"} onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Notes</label>
              <input value={addForm.review_notes || ""} onChange={e => setAddForm(f => ({ ...f, review_notes: e.target.value }))} style={inputStyle} placeholder="Optional notes..." />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button onClick={() => { setShowAdd(null); setAddForm({}); }} style={btnGhost}>Cancel</button>
              <button onClick={addRecord} style={btnPrimary} disabled={!addForm.user_id || !addForm.state}>Add {showAdd === "license" ? "License" : "Bond"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div style={modalOverlay} onClick={() => setDeleteTarget(null)}>
          <div style={{ ...modalBox, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Delete {deleteTarget.kind}?</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>Are you sure you want to delete the {deleteTarget.kind} for <strong>{deleteTarget.name}</strong>? This cannot be undone.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteTarget(null)} style={btnGhost}>Cancel</button>
              <button onClick={deleteRecord} style={{ ...btnPrimary, background: "#dc2626" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
