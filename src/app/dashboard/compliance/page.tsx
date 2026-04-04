"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

/* ── types ─────────────────────────────────────────────── */

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department: string | null;
  position: string | null;
}

interface LicenseRow {
  id: string;
  user_id: string;
  org_id: string;
  license_type: string | null;
  state: string;
  license_number: string | null;
  issuer: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  document_url: string | null;
  created_at: string;
}

interface BondRow {
  id: string;
  user_id: string;
  org_id: string;
  bond_type: string | null;
  state: string;
  bond_number: string | null;
  issuer: string | null;
  amount: number | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  document_url: string | null;
  created_at: string;
}

/* ── status calculation (never stored, always derived) ── */

type ComplianceStatus = "active" | "expiring_90" | "expiring_30" | "expired" | "no_date";

function calcStatus(expiryDate: string | null): ComplianceStatus {
  if (!expiryDate) return "no_date";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "expiring_30";
  if (diffDays <= 90) return "expiring_90";
  return "active";
}

function daysUntilExpiry(expiryDate: string | null): string {
  if (!expiryDate) return "";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diff = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  if (diff === 0) return "Expires today";
  return `${diff} days remaining`;
}

const STATUS_CONFIG: Record<ComplianceStatus, { label: string; bg: string; text: string }> = {
  active: { label: "Active", bg: "#1a3a2a", text: "#4ade80" },
  expiring_90: { label: "Expiring in 90 days", bg: "#3a3520", text: "#facc15" },
  expiring_30: { label: "Expiring in 30 days", bg: "#4a2a10", text: "#fb923c" },
  expired: { label: "Expired", bg: "#4a1a1a", text: "#ef4444" },
  no_date: { label: "No expiry set", bg: "#2a2a2a", text: "#888888" },
};

const ADMIN_ROLES = ["admin", "super_admin", "system_admin"];

/* ── shared helpers ───────────────────────────────────── */

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function formatCurrency(amount: number | null) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

/* ── shared styles ────────────────────────────────────── */

const cardStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  borderRadius: 10,
  padding: "18px 22px",
  border: "1px solid var(--border-color)",
};

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  borderBottom: "1px solid var(--border-color)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  color: "var(--text-primary)",
  borderBottom: "1px solid var(--border-color)",
};

/* ================================================================
   MAIN PAGE — routes between My Compliance / Org Overview / State Browser
   ================================================================ */

export default function CompliancePage() {
  const supabase = createClient();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"my" | "org" | "state">("my");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("users")
        .select("id, full_name, email, role, department, position")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) setCurrentUser(data as UserProfile);
          setLoading(false);
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = currentUser ? ADMIN_ROLES.includes(currentUser.role) : false;

  if (loading) {
    return <div className="p-8 text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Compliance</h1>

      {/* ── View toggle ─────────────────────────────────── */}
      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setView("my")}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
          style={{
            background: view === "my" ? "var(--accent)" : "var(--bg-surface)",
            color: view === "my" ? "#fff" : "var(--text-secondary)",
          }}
        >
          My Compliance
        </button>
        {isAdmin && (
          <button
            onClick={() => setView("org")}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              background: view === "org" ? "var(--accent)" : "var(--bg-surface)",
              color: view === "org" ? "#fff" : "var(--text-secondary)",
            }}
          >
            Org Overview
          </button>
        )}
        <button
          onClick={() => setView("state")}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
          style={{
            background: view === "state" ? "var(--accent)" : "var(--bg-surface)",
            color: view === "state" ? "#fff" : "var(--text-secondary)",
          }}
        >
          State Compliance
        </button>
      </div>

      {view === "my" && currentUser && <MyComplianceView user={currentUser} />}
      {view === "org" && isAdmin && <OrgComplianceView />}
      {view === "state" && <StateComplianceView />}
    </div>
  );
}

/* ================================================================
   MY COMPLIANCE — personal view, auth-aware, click-to-expand
   ================================================================ */

function MyComplianceView({ user }: { user: UserProfile }) {
  const supabase = createClient();
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [bonds, setBonds] = useState<BondRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"licenses" | "bonds" | "ce">("licenses");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchMyData = useCallback(async () => {
    setLoading(true);
    const [licRes, bondRes] = await Promise.all([
      supabase.from("licenses").select("*").eq("user_id", user.id).order("expiry_date", { ascending: true }),
      supabase.from("bonds").select("*").eq("user_id", user.id).order("expiry_date", { ascending: true }),
    ]);
    if (licRes.data) setLicenses(licRes.data as LicenseRow[]);
    if (bondRes.data) setBonds(bondRes.data as BondRow[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => { fetchMyData(); }, [fetchMyData]);

  /* ── my summary stats ──────────────────────────────── */

  const stats = useMemo(() => {
    const all = [
      ...licenses.map((l) => l.expiry_date),
      ...bonds.map((b) => b.expiry_date),
    ];
    let expiring = 0, expired = 0;
    for (const d of all) {
      const s = calcStatus(d);
      if (s === "expiring_30" || s === "expiring_90") expiring++;
      else if (s === "expired") expired++;
    }
    return { totalLicenses: licenses.length, totalBonds: bonds.length, expiring, expired };
  }, [licenses, bonds]);

  /* ── document upload ───────────────────────────────── */

  async function handleUpload(type: "licenses" | "bonds", recordId: string, file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${type}/${recordId}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("compliance-docs")
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("compliance-docs").getPublicUrl(path);

    // Save signed path reference (not public URL since bucket is private)
    const table = type === "licenses" ? "licenses" : "bonds";
    await supabase.from(table).update({ document_url: path }).eq("id", recordId);

    // Refresh data
    await fetchMyData();
    setUploading(false);
  }

  /* ── document download ─────────────────────────────── */

  async function handleDownload(docPath: string, filename: string) {
    const { data, error } = await supabase.storage
      .from("compliance-docs")
      .download(docPath);

    if (error || !data) {
      console.error("Download error:", error);
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── expand/collapse toggle ────────────────────────── */

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div>
      {/* ── My summary cards ──────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div style={cardStyle}>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>My Licenses</div>
          <div className="text-3xl font-bold mt-1">{stats.totalLicenses}</div>
        </div>
        <div style={cardStyle}>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>My Bonds</div>
          <div className="text-3xl font-bold mt-1">{stats.totalBonds}</div>
        </div>
        <div style={cardStyle}>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Expiring Soon</div>
          <div className="text-3xl font-bold mt-1" style={{ color: "#fb923c" }}>{stats.expiring}</div>
        </div>
        <div style={cardStyle}>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Expired</div>
          <div className="text-3xl font-bold mt-1" style={{ color: "#ef4444" }}>{stats.expired}</div>
        </div>
      </div>

      {/* ── Sub-tabs: Licenses / Bonds / CE ───────────── */}
      <div className="flex gap-1 mb-4">
        {(["licenses", "bonds", "ce"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setSubTab(tab); setExpandedId(null); }}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              background: subTab === tab ? "var(--accent)" : "var(--bg-surface)",
              color: subTab === tab ? "#fff" : "var(--text-secondary)",
            }}
          >
            {tab === "licenses" ? "Licenses" : tab === "bonds" ? "Bonds" : "CE Credits"}
            {tab === "licenses" && licenses.length > 0 && (
              <span className="ml-1.5 text-[11px] opacity-70">({licenses.length})</span>
            )}
            {tab === "bonds" && bonds.length > 0 && (
              <span className="ml-1.5 text-[11px] opacity-70">({bonds.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* ── CE placeholder ────────────────────────────── */}
      {subTab === "ce" && (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 22px" }}>
          <div className="text-lg font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>CE Credits Tracking</div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Coming soon — continuing education requirements and tracking will appear here.</p>
        </div>
      )}

      {/* ── My Licenses ──────────────────────────────── */}
      {subTab === "licenses" && (
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div>
          ) : licenses.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No licenses on file.</div>
          ) : (
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)" }}>
                  <th style={thStyle}>State</th>
                  <th style={thStyle}>License #</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Expires</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((lic) => {
                  const status = calcStatus(lic.expiry_date);
                  const isExpanded = expandedId === lic.id;
                  return (
                    <LicenseExpandableRow
                      key={lic.id}
                      lic={lic}
                      status={status}
                      isExpanded={isExpanded}
                      onToggle={() => toggle(lic.id)}
                      onUpload={(file) => handleUpload("licenses", lic.id, file)}
                      onDownload={() => lic.document_url && handleDownload(lic.document_url, `license-${lic.state}-${lic.license_number || lic.id}.pdf`)}
                      uploading={uploading}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── My Bonds ─────────────────────────────────── */}
      {subTab === "bonds" && (
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div>
          ) : bonds.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No bonds on file.</div>
          ) : (
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)" }}>
                  <th style={thStyle}>State</th>
                  <th style={thStyle}>Bond #</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Expires</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {bonds.map((bond) => {
                  const status = calcStatus(bond.expiry_date);
                  const isExpanded = expandedId === bond.id;
                  return (
                    <BondExpandableRow
                      key={bond.id}
                      bond={bond}
                      status={status}
                      isExpanded={isExpanded}
                      onToggle={() => toggle(bond.id)}
                      onUpload={(file) => handleUpload("bonds", bond.id, file)}
                      onDownload={() => bond.document_url && handleDownload(bond.document_url, `bond-${bond.state}-${bond.bond_number || bond.id}.pdf`)}
                      uploading={uploading}
                    />
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

/* ── License expandable row ──────────────────────────── */

function LicenseExpandableRow({
  lic, status, isExpanded, onToggle, onUpload, onDownload, uploading,
}: {
  lic: LicenseRow;
  status: ComplianceStatus;
  isExpanded: boolean;
  onToggle: () => void;
  onUpload: (file: File) => void;
  onDownload: () => void;
  uploading: boolean;
}) {
  const rowBg = status === "expired" ? "#1a0a0a" : status === "expiring_30" ? "#1a1508" : undefined;

  return (
    <>
      <tr
        style={{ background: rowBg, cursor: "pointer" }}
        onClick={onToggle}
        className="hover:brightness-110 transition-all"
      >
        <td style={tdStyle}>{lic.state}</td>
        <td style={tdStyle}>{lic.license_number || "—"}</td>
        <td style={tdStyle}>{lic.license_type || "—"}</td>
        <td style={tdStyle}>{formatDate(lic.expiry_date)}</td>
        <td style={tdStyle}><StatusBadge status={status} /></td>
        <td style={tdStyle}>
          <span style={{ color: "var(--text-muted)", fontSize: 14 }}>{isExpanded ? "▲" : "▼"}</span>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} style={{ padding: 0 }}>
            <div style={{ background: "var(--bg-secondary)", padding: "16px 20px", borderBottom: "1px solid var(--border-color)" }}>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <DetailField label="Issuer" value={lic.issuer || "—"} />
                <DetailField label="Issue Date" value={formatDate(lic.issue_date)} />
                <DetailField label="Expiry Date" value={formatDate(lic.expiry_date)} />
                <DetailField label="License Number" value={lic.license_number || "—"} />
                <DetailField label="Type" value={lic.license_type || "—"} />
                <DetailField label="Time Remaining" value={daysUntilExpiry(lic.expiry_date) || "—"} />
              </div>
              <DocumentControls
                documentUrl={lic.document_url}
                onUpload={onUpload}
                onDownload={onDownload}
                uploading={uploading}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Bond expandable row ─────────────────────────────── */

function BondExpandableRow({
  bond, status, isExpanded, onToggle, onUpload, onDownload, uploading,
}: {
  bond: BondRow;
  status: ComplianceStatus;
  isExpanded: boolean;
  onToggle: () => void;
  onUpload: (file: File) => void;
  onDownload: () => void;
  uploading: boolean;
}) {
  const rowBg = status === "expired" ? "#1a0a0a" : status === "expiring_30" ? "#1a1508" : undefined;

  return (
    <>
      <tr
        style={{ background: rowBg, cursor: "pointer" }}
        onClick={onToggle}
        className="hover:brightness-110 transition-all"
      >
        <td style={tdStyle}>{bond.state}</td>
        <td style={tdStyle}>{bond.bond_number || "—"}</td>
        <td style={tdStyle}>{bond.bond_type || "—"}</td>
        <td style={tdStyle}>{formatCurrency(bond.amount)}</td>
        <td style={tdStyle}>{formatDate(bond.expiry_date)}</td>
        <td style={tdStyle}><StatusBadge status={status} /></td>
        <td style={tdStyle}>
          <span style={{ color: "var(--text-muted)", fontSize: 14 }}>{isExpanded ? "▲" : "▼"}</span>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} style={{ padding: 0 }}>
            <div style={{ background: "var(--bg-secondary)", padding: "16px 20px", borderBottom: "1px solid var(--border-color)" }}>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <DetailField label="Issuer" value={bond.issuer || "—"} />
                <DetailField label="Amount" value={formatCurrency(bond.amount)} />
                <DetailField label="Issue Date" value={formatDate(bond.issue_date)} />
                <DetailField label="Expiry Date" value={formatDate(bond.expiry_date)} />
                <DetailField label="Bond Number" value={bond.bond_number || "—"} />
                <DetailField label="Time Remaining" value={daysUntilExpiry(bond.expiry_date) || "—"} />
              </div>
              <DocumentControls
                documentUrl={bond.document_url}
                onUpload={onUpload}
                onDownload={onDownload}
                uploading={uploading}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Detail field ────────────────────────────────────── */

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-sm" style={{ color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

/* ── Document upload/download controls ───────────────── */

function DocumentControls({
  documentUrl, onUpload, onDownload, uploading,
}: {
  documentUrl: string | null;
  onUpload: (file: File) => void;
  onDownload: () => void;
  uploading: boolean;
}) {
  const btnStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: 6,
    border: "1px solid var(--border-color)",
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    cursor: "pointer",
  };

  return (
    <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
      <div className="text-[11px] font-medium mb-2" style={{ color: "var(--text-muted)" }}>Document</div>
      <div className="flex gap-3 items-center">
        {documentUrl ? (
          <>
            <span className="text-xs" style={{ color: "var(--accent)" }}>Document on file</span>
            <button style={btnStyle} onClick={(e) => { e.stopPropagation(); onDownload(); }}>
              Download
            </button>
          </>
        ) : (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>No document uploaded</span>
        )}
        <label style={{ ...btnStyle, display: "inline-flex", alignItems: "center", gap: 4 }}>
          {uploading ? "Uploading..." : documentUrl ? "Replace" : "Upload"}
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
            onClick={(e) => e.stopPropagation()}
            disabled={uploading}
          />
        </label>
      </div>
    </div>
  );
}

/* ================================================================
   ORG OVERVIEW — admin-only, all employees, search/filter
   ================================================================ */

function OrgComplianceView() {
  const supabase = createClient();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [bonds, setBonds] = useState<BondRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"licenses" | "bonds" | "ce">("licenses");
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const ORG_ID = "00000000-0000-0000-0000-000000000001";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [usersRes, licensesRes, bondsRes] = await Promise.all([
      supabase.from("users").select("id, full_name, email, role, department, position").eq("org_id", ORG_ID).eq("status", "active").eq("user_type", "internal"),
      supabase.from("licenses").select("*").eq("org_id", ORG_ID).order("expiry_date", { ascending: true }),
      supabase.from("bonds").select("*").eq("org_id", ORG_ID).order("expiry_date", { ascending: true }),
    ]);
    if (usersRes.data) setUsers(usersRes.data as UserProfile[]);
    if (licensesRes.data) setLicenses(licensesRes.data as LicenseRow[]);
    if (bondsRes.data) setBonds(bondsRes.data as BondRow[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const userMap = useMemo(() => {
    const m: Record<string, UserProfile> = {};
    for (const u of users) m[u.id] = u;
    return m;
  }, [users]);

  const stats = useMemo(() => {
    const all = [...licenses.map((l) => l.expiry_date), ...bonds.map((b) => b.expiry_date)];
    let expiring = 0, expired = 0;
    for (const d of all) {
      const s = calcStatus(d);
      if (s === "expiring_30" || s === "expiring_90") expiring++;
      else if (s === "expired") expired++;
    }
    return { totalLicenses: licenses.length, totalBonds: bonds.length, expiring, expired };
  }, [licenses, bonds]);

  const allStates = useMemo(() => {
    const s = new Set<string>();
    for (const l of licenses) s.add(l.state);
    for (const b of bonds) s.add(b.state);
    return Array.from(s).sort();
  }, [licenses, bonds]);

  function filterItems<T extends { user_id: string; state: string; expiry_date: string | null }>(items: T[]): T[] {
    return items.filter((item) => {
      const u = userMap[item.user_id];
      const name = u?.full_name ?? "";
      if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterState !== "all" && item.state !== filterState) return false;
      if (filterStatus !== "all") {
        const s = calcStatus(item.expiry_date);
        if (filterStatus === "expiring" && s !== "expiring_30" && s !== "expiring_90") return false;
        if (filterStatus === "expired" && s !== "expired") return false;
        if (filterStatus === "active" && s !== "active" && s !== "no_date") return false;
      }
      return true;
    });
  }

  const filteredLicenses = filterItems(licenses);
  const filteredBonds = filterItems(bonds);

  function switchTab(tab: "licenses" | "bonds" | "ce") {
    setActiveTab(tab);
    setSearch("");
    setFilterState("all");
    setFilterStatus("all");
  }

  return (
    <div>
      {/* ── Org summary cards ─────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div style={cardStyle}>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Total Licenses</div>
          <div className="text-3xl font-bold mt-1">{stats.totalLicenses}</div>
        </div>
        <div style={cardStyle}>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Total Bonds</div>
          <div className="text-3xl font-bold mt-1">{stats.totalBonds}</div>
        </div>
        <div style={cardStyle}>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Expiring Soon</div>
          <div className="text-3xl font-bold mt-1" style={{ color: "#fb923c" }}>{stats.expiring}</div>
        </div>
        <div style={cardStyle}>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Expired</div>
          <div className="text-3xl font-bold mt-1" style={{ color: "#ef4444" }}>{stats.expired}</div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────── */}
      <div className="flex gap-1 mb-4">
        {(["licenses", "bonds", "ce"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              background: activeTab === tab ? "var(--accent)" : "var(--bg-surface)",
              color: activeTab === tab ? "#fff" : "var(--text-secondary)",
            }}
          >
            {tab === "licenses" ? "Licenses" : tab === "bonds" ? "Bonds" : "CE Credits"}
            {tab === "licenses" && licenses.length > 0 && <span className="ml-1.5 text-[11px] opacity-70">({licenses.length})</span>}
            {tab === "bonds" && bonds.length > 0 && <span className="ml-1.5 text-[11px] opacity-70">({bonds.length})</span>}
          </button>
        ))}
      </div>

      {activeTab === "ce" && (
        <div style={{ ...cardStyle, textAlign: "center", padding: "60px 22px" }}>
          <div className="text-lg font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>CE Credits Tracking</div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Coming soon.</p>
        </div>
      )}

      {activeTab !== "ce" && (
        <>
          {/* ── Filters ────────────────────────────────── */}
          <div className="flex gap-3 mb-4 items-center flex-wrap">
            <input
              type="text"
              placeholder="Search by employee name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border outline-none"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border-color)", color: "var(--text-primary)", width: 240 }}
            />
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border outline-none"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
            >
              <option value="all">All States</option>
              {allStates.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {["all", "active", "expiring", "expired"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className="text-xs px-3 py-1.5 rounded-full font-medium capitalize transition-colors"
                style={{
                  background: filterStatus === s ? "var(--accent)" : "var(--bg-surface)",
                  color: filterStatus === s ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${filterStatus === s ? "var(--accent)" : "var(--border-color)"}`,
                }}
              >
                {s}
              </button>
            ))}
            {(search || filterState !== "all" || filterStatus !== "all") && (
              <button
                onClick={() => { setSearch(""); setFilterState("all"); setFilterStatus("all"); }}
                className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                Clear filters
              </button>
            )}
          </div>

          {/* ── Licenses table ──────────────────────────── */}
          {activeTab === "licenses" && (
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              {loading ? (
                <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div>
              ) : filteredLicenses.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  {licenses.length === 0 ? "No licenses on file." : "No licenses match your filters."}
                </div>
              ) : (
                <table className="w-full" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)" }}>
                      <th style={thStyle}>Employee</th>
                      <th style={thStyle}>State</th>
                      <th style={thStyle}>License #</th>
                      <th style={thStyle}>Type</th>
                      <th style={thStyle}>Issuer</th>
                      <th style={thStyle}>Issued</th>
                      <th style={thStyle}>Expires</th>
                      <th style={thStyle}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLicenses.map((lic) => {
                      const u = userMap[lic.user_id];
                      const status = calcStatus(lic.expiry_date);
                      return (
                        <tr key={lic.id} style={{ background: status === "expired" ? "#1a0a0a" : status === "expiring_30" ? "#1a1508" : undefined }}>
                          <td style={tdStyle}>
                            <Link href={`/dashboard/user-management?edit=${lic.user_id}&tab=licenses`} className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
                              {u?.full_name ?? "Unknown"}
                            </Link>
                          </td>
                          <td style={tdStyle}>{lic.state}</td>
                          <td style={tdStyle}>{lic.license_number || "—"}</td>
                          <td style={tdStyle}>{lic.license_type || "—"}</td>
                          <td style={tdStyle}>{lic.issuer || "—"}</td>
                          <td style={tdStyle}>{formatDate(lic.issue_date)}</td>
                          <td style={tdStyle}>{formatDate(lic.expiry_date)}</td>
                          <td style={tdStyle}><StatusBadge status={status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Bonds table ─────────────────────────────── */}
          {activeTab === "bonds" && (
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              {loading ? (
                <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div>
              ) : filteredBonds.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  {bonds.length === 0 ? "No bonds on file." : "No bonds match your filters."}
                </div>
              ) : (
                <table className="w-full" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)" }}>
                      <th style={thStyle}>Employee</th>
                      <th style={thStyle}>State</th>
                      <th style={thStyle}>Bond #</th>
                      <th style={thStyle}>Type</th>
                      <th style={thStyle}>Amount</th>
                      <th style={thStyle}>Issuer</th>
                      <th style={thStyle}>Issued</th>
                      <th style={thStyle}>Expires</th>
                      <th style={thStyle}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBonds.map((bond) => {
                      const u = userMap[bond.user_id];
                      const status = calcStatus(bond.expiry_date);
                      return (
                        <tr key={bond.id} style={{ background: status === "expired" ? "#1a0a0a" : status === "expiring_30" ? "#1a1508" : undefined }}>
                          <td style={tdStyle}>
                            <Link href={`/dashboard/user-management?edit=${bond.user_id}&tab=bonds`} className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
                              {u?.full_name ?? "Unknown"}
                            </Link>
                          </td>
                          <td style={tdStyle}>{bond.state}</td>
                          <td style={tdStyle}>{bond.bond_number || "—"}</td>
                          <td style={tdStyle}>{bond.bond_type || "—"}</td>
                          <td style={tdStyle}>{formatCurrency(bond.amount)}</td>
                          <td style={tdStyle}>{bond.issuer || "—"}</td>
                          <td style={tdStyle}>{formatDate(bond.issue_date)}</td>
                          <td style={tdStyle}>{formatDate(bond.expiry_date)}</td>
                          <td style={tdStyle}><StatusBadge status={status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ================================================================
   STATE COMPLIANCE — stoplight grid, all 50 states + 2 territories
   ================================================================ */

type StateStatus = "green" | "yellow" | "red" | "gray";

interface StateEntry {
  code: string;
  name: string;
  status: StateStatus;
  type: "state" | "territory";
}

const ALL_STATES: StateEntry[] = [
  { code: "AL", name: "Alabama", status: "red", type: "state" },
  { code: "AK", name: "Alaska", status: "gray", type: "state" },
  { code: "AZ", name: "Arizona", status: "green", type: "state" },
  { code: "AR", name: "Arkansas", status: "gray", type: "state" },
  { code: "CA", name: "California", status: "green", type: "state" },
  { code: "CO", name: "Colorado", status: "green", type: "state" },
  { code: "CT", name: "Connecticut", status: "green", type: "state" },
  { code: "DE", name: "Delaware", status: "gray", type: "state" },
  { code: "FL", name: "Florida", status: "green", type: "state" },
  { code: "GA", name: "Georgia", status: "green", type: "state" },
  { code: "HI", name: "Hawaii", status: "yellow", type: "state" },
  { code: "ID", name: "Idaho", status: "gray", type: "state" },
  { code: "IL", name: "Illinois", status: "green", type: "state" },
  { code: "IN", name: "Indiana", status: "green", type: "state" },
  { code: "IA", name: "Iowa", status: "green", type: "state" },
  { code: "KS", name: "Kansas", status: "green", type: "state" },
  { code: "KY", name: "Kentucky", status: "green", type: "state" },
  { code: "LA", name: "Louisiana", status: "green", type: "state" },
  { code: "ME", name: "Maine", status: "gray", type: "state" },
  { code: "MD", name: "Maryland", status: "green", type: "state" },
  { code: "MA", name: "Massachusetts", status: "gray", type: "state" },
  { code: "MI", name: "Michigan", status: "green", type: "state" },
  { code: "MN", name: "Minnesota", status: "green", type: "state" },
  { code: "MS", name: "Mississippi", status: "green", type: "state" },
  { code: "MO", name: "Missouri", status: "green", type: "state" },
  { code: "MT", name: "Montana", status: "gray", type: "state" },
  { code: "NE", name: "Nebraska", status: "green", type: "state" },
  { code: "NV", name: "Nevada", status: "gray", type: "state" },
  { code: "NH", name: "New Hampshire", status: "gray", type: "state" },
  { code: "NJ", name: "New Jersey", status: "green", type: "state" },
  { code: "NM", name: "New Mexico", status: "yellow", type: "state" },
  { code: "NY", name: "New York", status: "gray", type: "state" },
  { code: "NC", name: "North Carolina", status: "green", type: "state" },
  { code: "ND", name: "North Dakota", status: "gray", type: "state" },
  { code: "OH", name: "Ohio", status: "green", type: "state" },
  { code: "OK", name: "Oklahoma", status: "green", type: "state" },
  { code: "OR", name: "Oregon", status: "gray", type: "state" },
  { code: "PA", name: "Pennsylvania", status: "green", type: "state" },
  { code: "RI", name: "Rhode Island", status: "yellow", type: "state" },
  { code: "SC", name: "South Carolina", status: "green", type: "state" },
  { code: "SD", name: "South Dakota", status: "gray", type: "state" },
  { code: "TN", name: "Tennessee", status: "green", type: "state" },
  { code: "TX", name: "Texas", status: "green", type: "state" },
  { code: "UT", name: "Utah", status: "yellow", type: "state" },
  { code: "VT", name: "Vermont", status: "gray", type: "state" },
  { code: "VA", name: "Virginia", status: "green", type: "state" },
  { code: "WA", name: "Washington", status: "gray", type: "state" },
  { code: "WV", name: "West Virginia", status: "yellow", type: "state" },
  { code: "WI", name: "Wisconsin", status: "green", type: "state" },
  { code: "WY", name: "Wyoming", status: "gray", type: "state" },
  { code: "VI", name: "U.S. Virgin Islands", status: "gray", type: "territory" },
  { code: "PR", name: "Puerto Rico", status: "gray", type: "territory" },
];

const STOPLIGHT: Record<StateStatus, { dot: string; ring: string; hover: string }> = {
  green:  { dot: "#22c55e", ring: "rgba(34,197,94,0.25)",  hover: "rgba(34,197,94,0.15)" },
  yellow: { dot: "#eab308", ring: "rgba(234,179,8,0.25)",  hover: "rgba(234,179,8,0.15)" },
  red:    { dot: "#ef4444", ring: "rgba(239,68,68,0.25)",  hover: "rgba(239,68,68,0.15)" },
  gray:   { dot: "#6b7280", ring: "rgba(107,114,128,0.2)", hover: "rgba(107,114,128,0.1)" },
};

function StateComplianceView() {
  const [search, setSearch] = useState("");

  const states = ALL_STATES.filter((s) => s.type === "state");
  const territories = ALL_STATES.filter((s) => s.type === "territory");

  const filteredStates = states.filter(
    (s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase())
  );
  const filteredTerritories = territories.filter(
    (s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Search */}
      <div className="mb-5" style={{ maxWidth: 280 }}>
        <input
          type="text"
          placeholder="Search states..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border outline-none w-full"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mb-5" style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {([
          ["green", "Licensed & Active"],
          ["yellow", "Caution — Seek Management"],
          ["red", "PA Prohibited"],
          ["gray", "Not Licensed"],
        ] as [StateStatus, string][]).map(([status, label]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span
              style={{
                width: 10, height: 10, borderRadius: "50%",
                background: STOPLIGHT[status].dot,
                display: "inline-block",
              }}
            />
            {label}
          </span>
        ))}
      </div>

      {/* States grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
          gap: 8,
        }}
      >
        {filteredStates.map((state) => (
          <StateTile key={state.code} state={state} />
        ))}
      </div>

      {filteredStates.length === 0 && (
        <div className="text-center py-8" style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No states match your search.
        </div>
      )}

      {/* Territories section */}
      {filteredTerritories.length > 0 && (
        <>
          <div className="mt-6 mb-3" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            U.S. Territories
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 8,
            }}
          >
            {filteredTerritories.map((state) => (
              <StateTile key={state.code} state={state} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StateTile({ state }: { state: StateEntry }) {
  const sl = STOPLIGHT[state.status];
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/dashboard/compliance/state/${state.code}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 8,
        border: `1px solid ${hovered ? sl.dot : "var(--border-color)"}`,
        background: hovered ? sl.hover : "var(--bg-surface)",
        cursor: "pointer",
        transition: "all 0.15s ease",
        textDecoration: "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Stoplight dot with ring */}
      <span
        style={{
          width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
          background: sl.dot,
          boxShadow: `0 0 0 4px ${sl.ring}`,
        }}
      />
      {/* State name + code */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {state.name}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {state.code}
        </div>
      </div>
    </Link>
  );
}
