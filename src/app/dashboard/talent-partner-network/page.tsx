"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

/* ── types ─────────────────────────────────────────────── */

interface TeamMember {
  id: string;
  full_name: string;
  position: string | null;
  department: string | null;
  location: string | null;
  profile_picture_url: string | null;
  licenses: LicenseInfo[];
}

interface LicenseInfo {
  id: string;
  state: string;
  license_type: string | null;
  expiry_date: string | null;
  status: string;
}

interface Firm {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  states: string[] | null;
  status: "active" | "pending" | "inactive";
  created_at: string;
  updated_at: string | null;
  services: string[];
}

interface FirmFormData {
  name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  states: string;
  status: "active" | "pending" | "inactive";
  services: string;
}

const EMPTY_FIRM_FORM: FirmFormData = {
  name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  states: "",
  status: "pending",
  services: "",
};

/* ── helpers ───────────────────────────────────────────── */

type Tab = "overview" | "team" | "firms";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "#1a3a2a", text: "#4ade80" },
  pending: { bg: "#3a3520", text: "#facc15" },
  inactive: { bg: "#2a2a2a", text: "#888888" },
  approved: { bg: "#1a3a2a", text: "#4ade80" },
  expired: { bg: "#4a1a1a", text: "#ef4444" },
};

const LICENSE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  approved: { bg: "#1a3a2a", text: "#4ade80" },
  pending: { bg: "#3a3520", text: "#facc15" },
  rejected: { bg: "#4a1a1a", text: "#ef4444" },
  expired: { bg: "#4a1a1a", text: "#ef4444" },
};

function Badge({ label, colors }: { label: string; colors: { bg: string; text: string } }) {
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
      style={{ background: colors.bg, color: colors.text }}
    >
      {label}
    </span>
  );
}

function calcLicenseStatus(expiryDate: string | null, dbStatus: string): string {
  if (dbStatus === "rejected") return "rejected";
  if (dbStatus === "pending") return "pending";
  if (!expiryDate) return dbStatus;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  if (expiry < now) return "expired";
  return "approved";
}

function licenseSummary(licenses: LicenseInfo[]): { active: number; expiring: number; expired: number } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let active = 0, expiring = 0, expired = 0;
  for (const lic of licenses) {
    const status = calcLicenseStatus(lic.expiry_date, lic.status);
    if (status === "expired") expired++;
    else if (status === "approved") {
      if (lic.expiry_date) {
        const exp = new Date(lic.expiry_date);
        exp.setHours(0, 0, 0, 0);
        const diff = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diff <= 90) expiring++;
        else active++;
      } else {
        active++;
      }
    }
  }
  return { active, expiring, expired };
}

const ORG_ID = "00000000-0000-0000-0000-000000000001";

const ADMIN_ROLES = ["admin", "super_admin", "system_admin"];

const cardStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  borderRadius: 10,
  padding: "20px 22px",
  border: "1px solid var(--border-color)",
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)",
};

/* ── main page ─────────────────────────────────────────── */

export default function TalentPartnerNetworkPage() {
  const supabase = createClient();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [search, setSearch] = useState("");

  // Data
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [firms, setFirms] = useState<Firm[]>([]);

  // Firm modal
  const [showFirmModal, setShowFirmModal] = useState(false);
  const [editingFirmId, setEditingFirmId] = useState<string | null>(null);
  const [firmForm, setFirmForm] = useState<FirmFormData>(EMPTY_FIRM_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const isAdmin = ADMIN_ROLES.includes(userRole);

  /* ── fetch user role ─────────────────────────────────── */

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data) setUserRole(data.role);
          });
      }
    });
  }, []);

  /* ── fetch data ──────────────────────────────────────── */

  const fetchTeamMembers = useCallback(async () => {
    // Get user IDs that have talent_network = true
    const { data: permRows } = await supabase
      .from("user_permissions")
      .select("user_id")
      .eq("talent_network", true)
      .eq("org_id", ORG_ID);

    if (!permRows || permRows.length === 0) {
      setTeamMembers([]);
      return;
    }

    const userIds = permRows.map((r) => r.user_id);

    // Get user profiles
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, position, department, location, profile_picture_url")
      .in("id", userIds)
      .eq("status", "active")
      .order("full_name");

    if (!users) {
      setTeamMembers([]);
      return;
    }

    // Get licenses for those users
    const { data: licenses } = await supabase
      .from("licenses")
      .select("id, user_id, state, license_type, expiry_date, status")
      .in("user_id", userIds);

    const licenseMap = new Map<string, LicenseInfo[]>();
    for (const lic of licenses ?? []) {
      const arr = licenseMap.get(lic.user_id) ?? [];
      arr.push(lic);
      licenseMap.set(lic.user_id, arr);
    }

    setTeamMembers(
      users.map((u) => ({
        ...u,
        licenses: licenseMap.get(u.id) ?? [],
      }))
    );
  }, []);

  const fetchFirms = useCallback(async () => {
    const { data: firmRows } = await supabase
      .from("firms")
      .select("*")
      .eq("org_id", ORG_ID)
      .order("name");

    if (!firmRows || firmRows.length === 0) {
      setFirms([]);
      return;
    }

    // Get services for all firms
    const firmIds = firmRows.map((f) => f.id);
    const { data: serviceRows } = await supabase
      .from("firm_services")
      .select("firm_id, service_name")
      .in("firm_id", firmIds);

    const serviceMap = new Map<string, string[]>();
    for (const s of serviceRows ?? []) {
      const arr = serviceMap.get(s.firm_id) ?? [];
      arr.push(s.service_name);
      serviceMap.set(s.firm_id, arr);
    }

    setFirms(
      firmRows.map((f) => ({
        ...f,
        services: serviceMap.get(f.id) ?? [],
      }))
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTeamMembers(), fetchFirms()]).then(() => setLoading(false));
  }, [fetchTeamMembers, fetchFirms]);

  /* ── firm CRUD ───────────────────────────────────────── */

  const openCreateFirm = () => {
    setEditingFirmId(null);
    setFirmForm(EMPTY_FIRM_FORM);
    setShowFirmModal(true);
  };

  const openEditFirm = (firm: Firm) => {
    setEditingFirmId(firm.id);
    setFirmForm({
      name: firm.name,
      contact_name: firm.contact_name ?? "",
      contact_email: firm.contact_email ?? "",
      contact_phone: firm.contact_phone ?? "",
      states: (firm.states ?? []).join(", "),
      status: firm.status,
      services: firm.services.join(", "),
    });
    setShowFirmModal(true);
  };

  const handleSaveFirm = async () => {
    if (!firmForm.name.trim()) return;
    setSaving(true);

    const statesArray = firmForm.states
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const servicesArray = firmForm.services
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const firmPayload = {
      name: firmForm.name.trim(),
      contact_name: firmForm.contact_name.trim() || null,
      contact_email: firmForm.contact_email.trim() || null,
      contact_phone: firmForm.contact_phone.trim() || null,
      states: statesArray.length > 0 ? statesArray : null,
      status: firmForm.status,
      updated_at: new Date().toISOString(),
    };

    let firmId = editingFirmId;

    if (editingFirmId) {
      await supabase.from("firms").update(firmPayload).eq("id", editingFirmId);
    } else {
      const { data } = await supabase
        .from("firms")
        .insert({ ...firmPayload, org_id: ORG_ID })
        .select("id")
        .single();
      firmId = data?.id ?? null;
    }

    // Sync firm_services
    if (firmId) {
      await supabase.from("firm_services").delete().eq("firm_id", firmId);
      if (servicesArray.length > 0) {
        await supabase.from("firm_services").insert(
          servicesArray.map((s) => ({
            firm_id: firmId,
            service_name: s,
            org_id: ORG_ID,
          }))
        );
      }
    }

    setSaving(false);
    setShowFirmModal(false);
    fetchFirms();
  };

  const handleDeactivateFirm = async (id: string) => {
    await supabase
      .from("firms")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("id", id);
    setDeleteConfirm(null);
    fetchFirms();
  };

  /* ── computed metrics ────────────────────────────────── */

  const totalTeam = teamMembers.length;
  const totalFirms = firms.length;
  const activeFirms = firms.filter((f) => f.status === "active").length;
  const pendingFirms = firms.filter((f) => f.status === "pending").length;

  const statesCovered = new Set<string>();
  for (const f of firms) {
    for (const s of f.states ?? []) statesCovered.add(s);
  }
  for (const m of teamMembers) {
    for (const l of m.licenses) {
      if (calcLicenseStatus(l.expiry_date, l.status) === "approved") {
        statesCovered.add(l.state);
      }
    }
  }

  /* ── filter ──────────────────────────────────────────── */

  const searchLower = search.toLowerCase();

  const filteredTeam = teamMembers.filter(
    (m) =>
      m.full_name.toLowerCase().includes(searchLower) ||
      (m.department ?? "").toLowerCase().includes(searchLower) ||
      (m.position ?? "").toLowerCase().includes(searchLower) ||
      (m.location ?? "").toLowerCase().includes(searchLower)
  );

  const filteredFirms = firms.filter(
    (f) =>
      f.name.toLowerCase().includes(searchLower) ||
      (f.contact_name ?? "").toLowerCase().includes(searchLower) ||
      f.services.some((s) => s.toLowerCase().includes(searchLower)) ||
      (f.states ?? []).some((s) => s.toLowerCase().includes(searchLower))
  );

  /* ── render ──────────────────────────────────────────── */

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Talent Partner Network</h1>
          {pendingFirms > 0 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#3a3520", color: "#facc15" }}
            >
              {pendingFirms} pending
            </span>
          )}
        </div>
        {isAdmin && tab === "firms" && (
          <button
            onClick={openCreateFirm}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            style={{ background: "var(--accent)", color: "#000" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
          >
            <span className="text-lg">+</span> Add Firm
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5">
        {(["overview", "team", "firms"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSearch(""); }}
            className="px-4 py-2 rounded-lg text-sm font-medium capitalize cursor-pointer transition-colors"
            style={{
              background: tab === t ? "var(--bg-hover)" : "transparent",
              color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {t === "team" ? "Team Members" : t === "firms" ? "Firms" : "Overview"}
          </button>
        ))}
      </div>

      {/* Search (team + firms tabs) */}
      {tab !== "overview" && (
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "team" ? "Search by name, department, position, or location..." : "Search by name, service, or state..."}
            className="w-full max-w-md px-3 py-2 rounded-lg text-sm outline-none"
            style={inputStyle}
          />
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      ) : (
        <>
          {/* ── Overview Tab ───────────────────────────────── */}
          {tab === "overview" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Team Members" value={totalTeam} icon="team" />
              <MetricCard label="Total Firms" value={totalFirms} sub={`${activeFirms} active`} icon="firm" />
              <MetricCard label="States Covered" value={statesCovered.size} icon="state" />
              <MetricCard label="Pending Approvals" value={pendingFirms} icon="pending" highlight={pendingFirms > 0} />
            </div>
          )}

          {/* ── Team Members Tab ───────────────────────────── */}
          {tab === "team" && (
            <>
              {filteredTeam.length === 0 ? (
                <EmptyState message={search ? "No team members match your search." : "No team members in the network yet."} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredTeam.map((member) => {
                    const summary = licenseSummary(member.licenses);
                    return (
                      <div
                        key={member.id}
                        className="rounded-xl p-4 cursor-pointer transition-all"
                        style={{
                          ...cardStyle,
                          cursor: "pointer",
                        }}
                        onClick={() => router.push(`/dashboard/user-management?user=${member.id}`)}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-color)")}
                      >
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
                            style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
                          >
                            {member.full_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold truncate">{member.full_name}</h3>
                            <div className="flex items-center gap-3 mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                              {member.position && <span>{member.position}</span>}
                              {member.department && <span>{member.department}</span>}
                              {member.location && <span>{member.location}</span>}
                            </div>

                            {/* License summary */}
                            {member.licenses.length > 0 && (
                              <div className="flex items-center gap-2 mt-2">
                                {summary.active > 0 && (
                                  <Badge label={`${summary.active} active`} colors={LICENSE_STATUS_COLORS.approved} />
                                )}
                                {summary.expiring > 0 && (
                                  <Badge label={`${summary.expiring} expiring`} colors={{ bg: "#3a3520", text: "#facc15" }} />
                                )}
                                {summary.expired > 0 && (
                                  <Badge label={`${summary.expired} expired`} colors={LICENSE_STATUS_COLORS.expired} />
                                )}
                                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                  {member.licenses.length} license{member.licenses.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                            )}
                            {member.licenses.length === 0 && (
                              <span className="text-[11px] mt-1 inline-block" style={{ color: "var(--text-muted)" }}>
                                No licenses on file
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Firms Tab ──────────────────────────────────── */}
          {tab === "firms" && (
            <>
              {filteredFirms.length === 0 ? (
                <EmptyState message={search ? "No firms match your search." : "No firms in the network yet."} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredFirms.map((firm) => (
                    <div
                      key={firm.id}
                      className="rounded-xl p-4"
                      style={cardStyle}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-sm font-semibold truncate">{firm.name}</h3>
                            <Badge label={firm.status} colors={STATUS_COLORS[firm.status] ?? STATUS_COLORS.inactive} />
                          </div>
                          {firm.contact_name && (
                            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                              {firm.contact_name}
                              {firm.contact_email && ` · ${firm.contact_email}`}
                              {firm.contact_phone && ` · ${firm.contact_phone}`}
                            </p>
                          )}
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openEditFirm(firm)}
                              className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                              title="Edit"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>

                            {firm.status !== "inactive" && (
                              <>
                                {deleteConfirm === firm.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleDeactivateFirm(firm.id)}
                                      className="px-2 py-1 rounded text-xs font-medium cursor-pointer"
                                      style={{ background: "#4a1a1a", color: "#ef4444" }}
                                    >
                                      Deactivate
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm(null)}
                                      className="px-2 py-1 rounded text-xs cursor-pointer"
                                      style={{ color: "var(--text-muted)" }}
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirm(firm.id)}
                                    className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                                    title="Deactivate"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8">
                                      <circle cx="12" cy="12" r="10" />
                                      <line x1="15" y1="9" x2="9" y2="15" />
                                      <line x1="9" y1="9" x2="15" y2="15" />
                                    </svg>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Services */}
                      {firm.services.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {firm.services.map((s) => (
                            <span
                              key={s}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ background: "#2d1b4e", color: "#a78bfa" }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* States */}
                      {(firm.states ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(firm.states ?? []).map((s) => (
                            <span
                              key={s}
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                              style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Add/Edit Firm Modal ────────────────────────── */}
      {showFirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowFirmModal(false)}
        >
          <div
            className="rounded-xl p-6 w-full max-w-lg"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">
                {editingFirmId ? "Edit Firm" : "Add Firm"}
              </h2>
              <button
                onClick={() => setShowFirmModal(false)}
                className="text-lg cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Company Name
                </label>
                <input
                  type="text"
                  value={firmForm.name}
                  onChange={(e) => setFirmForm({ ...firmForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                  placeholder="Firm name..."
                />
              </div>

              {/* Contact Name + Email */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={firmForm.contact_name}
                    onChange={(e) => setFirmForm({ ...firmForm, contact_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    placeholder="Primary contact..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={firmForm.contact_email}
                    onChange={(e) => setFirmForm({ ...firmForm, contact_email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    placeholder="email@firm.com"
                  />
                </div>
              </div>

              {/* Phone + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={firmForm.contact_phone}
                    onChange={(e) => setFirmForm({ ...firmForm, contact_phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Status
                  </label>
                  <select
                    value={firmForm.status}
                    onChange={(e) => setFirmForm({ ...firmForm, status: e.target.value as FirmFormData["status"] })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Services */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Services (comma-separated)
                </label>
                <input
                  type="text"
                  value={firmForm.services}
                  onChange={(e) => setFirmForm({ ...firmForm, services: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                  placeholder="Restoration, Roofing, Engineering..."
                />
              </div>

              {/* States */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  States Covered (comma-separated state codes)
                </label>
                <input
                  type="text"
                  value={firmForm.states}
                  onChange={(e) => setFirmForm({ ...firmForm, states: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                  placeholder="FL, TX, PA, NY..."
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowFirmModal(false)}
                  className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFirm}
                  disabled={saving || !firmForm.name.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#000" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  {saving ? "Saving..." : editingFirmId ? "Save Changes" : "Add Firm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── sub-components ─────────────────────────────────────── */

function MetricCard({
  label,
  value,
  sub,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: string;
  highlight?: boolean;
}) {
  const iconPaths: Record<string, React.ReactNode> = {
    team: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    firm: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
    state: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
        <circle cx="12" cy="10" r="3" />
        <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
      </svg>
    ),
    pending: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={highlight ? "#facc15" : "var(--accent)"} strokeWidth="1.8">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  };

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "var(--bg-surface)",
        border: highlight ? "1px solid #3a3520" : "1px solid var(--border-color)",
        borderRadius: 10,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
        {iconPaths[icon]}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && (
        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl p-12 text-center"
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
    >
      <svg className="mx-auto mb-3" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <p style={{ color: "var(--text-secondary)" }}>{message}</p>
    </div>
  );
}
