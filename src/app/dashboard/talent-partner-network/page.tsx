"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  availability: "available" | "busy" | "unavailable" | null;
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
  website: string | null;
  city: string | null;
  firm_state: string | null;
  entity_type: string | null;
  rating: number | null;
}

interface FirmFormData {
  name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  states: string;
  status: "active" | "pending" | "inactive";
  services: string;
  website: string;
  city: string;
  firm_state: string;
  entity_type: string;
  rating: number;
}

const EMPTY_FIRM_FORM: FirmFormData = {
  name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  states: "",
  status: "pending",
  services: "",
  website: "",
  city: "",
  firm_state: "",
  entity_type: "",
  rating: 0,
};

/* ── helpers ───────────────────────────────────────────── */

type Tab = "overview" | "team" | "firms" | "analytics";

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

const AVAILABILITY_COLORS: Record<string, { bg: string; text: string }> = {
  available: { bg: "#1a3a2a", text: "#4ade80" },
  busy: { bg: "#3a3520", text: "#facc15" },
  unavailable: { bg: "#2a2a2a", text: "#888888" },
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

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

/* ── main page ─────────────────────────────────────────── */

export default function TalentPartnerNetworkPage() {
  const supabase = createClient();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [search, setSearch] = useState("");

  // Filters
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [showStateDropdown, setShowStateDropdown] = useState(false);

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

    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, position, department, location, profile_picture_url, availability")
      .in("id", userIds)
      .eq("status", "active")
      .order("full_name");

    if (!users) {
      setTeamMembers([]);
      return;
    }

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
        availability: u.availability ?? null,
        licenses: licenseMap.get(u.id) ?? [],
      }))
    );
  }, []);

  const fetchFirms = useCallback(async () => {
    const { data: firmRows } = await supabase
      .from("firms")
      .select("id, name, contact_name, contact_email, contact_phone, states, status, created_at, updated_at, org_id, website, city, state, entity_type, rating")
      .eq("org_id", ORG_ID)
      .order("name");

    if (!firmRows || firmRows.length === 0) {
      setFirms([]);
      return;
    }

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
        id: f.id,
        name: f.name,
        contact_name: f.contact_name,
        contact_email: f.contact_email,
        contact_phone: f.contact_phone,
        states: f.states,
        status: f.status,
        created_at: f.created_at,
        updated_at: f.updated_at,
        website: f.website ?? null,
        city: f.city ?? null,
        firm_state: f.state ?? null,
        entity_type: f.entity_type ?? null,
        rating: f.rating ?? null,
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
      website: firm.website ?? "",
      city: firm.city ?? "",
      firm_state: firm.firm_state ?? "",
      entity_type: firm.entity_type ?? "",
      rating: firm.rating ?? 0,
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
      website: firmForm.website.trim() || null,
      city: firmForm.city.trim() || null,
      state: firmForm.firm_state.trim().toUpperCase() || null,
      entity_type: firmForm.entity_type.trim() || null,
      rating: firmForm.rating > 0 ? firmForm.rating : null,
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

  const availableCounts = useMemo(() => {
    let available = 0, busy = 0, unavailable = 0;
    for (const m of teamMembers) {
      if (m.availability === "available") available++;
      else if (m.availability === "busy") busy++;
      else unavailable++;
    }
    return { available, busy, unavailable };
  }, [teamMembers]);

  const licenseAlerts = useMemo(() => {
    let expiring = 0, expired = 0, active = 0;
    for (const m of teamMembers) {
      const s = licenseSummary(m.licenses);
      expiring += s.expiring;
      expired += s.expired;
      active += s.active;
    }
    return { active, expiring, expired, total: active + expiring + expired };
  }, [teamMembers]);

  // All unique services across firms
  const allServices = useMemo(() => {
    const s = new Set<string>();
    for (const f of firms) {
      for (const svc of f.services) s.add(svc);
    }
    return Array.from(s).sort();
  }, [firms]);

  // All states from team licenses
  const teamLicenseStates = useMemo(() => {
    const s = new Set<string>();
    for (const m of teamMembers) {
      for (const l of m.licenses) {
        if (calcLicenseStatus(l.expiry_date, l.status) === "approved") s.add(l.state);
      }
    }
    return s;
  }, [teamMembers]);

  // All states from firms
  const firmCoverageStates = useMemo(() => {
    const s = new Set<string>();
    for (const f of firms) {
      for (const st of f.states ?? []) s.add(st);
    }
    return s;
  }, [firms]);

  /* ── filter ──────────────────────────────────────────── */

  const searchLower = search.toLowerCase();

  const filteredTeam = useMemo(() => {
    return teamMembers.filter((m) => {
      // Search
      if (searchLower && !(
        m.full_name.toLowerCase().includes(searchLower) ||
        (m.department ?? "").toLowerCase().includes(searchLower) ||
        (m.position ?? "").toLowerCase().includes(searchLower) ||
        (m.location ?? "").toLowerCase().includes(searchLower)
      )) return false;

      // State filter
      if (stateFilter.length > 0) {
        const memberStates = m.licenses
          .filter((l) => calcLicenseStatus(l.expiry_date, l.status) === "approved")
          .map((l) => l.state);
        if (!stateFilter.some((s) => memberStates.includes(s))) return false;
      }

      // Status filter (availability for team)
      if (statusFilter) {
        if ((m.availability ?? "unavailable") !== statusFilter) return false;
      }

      return true;
    });
  }, [teamMembers, searchLower, stateFilter, statusFilter]);

  const filteredFirms = useMemo(() => {
    return firms.filter((f) => {
      // Search
      if (searchLower && !(
        f.name.toLowerCase().includes(searchLower) ||
        (f.contact_name ?? "").toLowerCase().includes(searchLower) ||
        f.services.some((s) => s.toLowerCase().includes(searchLower)) ||
        (f.states ?? []).some((s) => s.toLowerCase().includes(searchLower))
      )) return false;

      // State filter
      if (stateFilter.length > 0) {
        if (!stateFilter.some((s) => (f.states ?? []).includes(s))) return false;
      }

      // Status filter
      if (statusFilter) {
        if (f.status !== statusFilter) return false;
      }

      // Service filter
      if (serviceFilter) {
        if (!f.services.includes(serviceFilter)) return false;
      }

      return true;
    });
  }, [firms, searchLower, stateFilter, statusFilter, serviceFilter]);

  // Reset filters on tab change
  const handleTabChange = (t: Tab) => {
    setTab(t);
    setSearch("");
    setStateFilter([]);
    setStatusFilter("");
    setServiceFilter("");
    setShowStateDropdown(false);
  };

  const toggleStateFilter = (state: string) => {
    setStateFilter((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
    );
  };

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
        {(["overview", "team", "firms", "analytics"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium capitalize cursor-pointer transition-colors"
            style={{
              background: tab === t ? "var(--bg-hover)" : "transparent",
              color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {t === "team" ? "Team Members" : t === "firms" ? "Firms" : t === "analytics" ? "Analytics" : "Overview"}
          </button>
        ))}
      </div>

      {/* Filter bar (team + firms tabs) */}
      {(tab === "team" || tab === "firms") && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "team" ? "Search name, department, position..." : "Search name, service, state..."}
            className="w-full max-w-xs px-3 py-2 rounded-lg text-sm outline-none"
            style={inputStyle}
          />

          {/* State filter */}
          <div className="relative">
            <button
              onClick={() => setShowStateDropdown(!showStateDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer"
              style={{ ...inputStyle, minWidth: 120 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
              </svg>
              {stateFilter.length > 0 ? `${stateFilter.length} state${stateFilter.length > 1 ? "s" : ""}` : "States"}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showStateDropdown && (
              <div
                className="absolute top-full left-0 mt-1 z-40 rounded-lg p-2 max-h-60 overflow-y-auto"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", minWidth: 200 }}
              >
                {stateFilter.length > 0 && (
                  <button
                    onClick={() => setStateFilter([])}
                    className="w-full text-left px-2 py-1 text-xs rounded cursor-pointer mb-1"
                    style={{ color: "var(--accent)" }}
                  >
                    Clear all
                  </button>
                )}
                <div className="grid grid-cols-4 gap-1">
                  {US_STATES.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleStateFilter(s)}
                      className="px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors"
                      style={{
                        background: stateFilter.includes(s) ? "var(--accent)" : "var(--bg-hover)",
                        color: stateFilter.includes(s) ? "#000" : "var(--text-secondary)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
            style={inputStyle}
          >
            <option value="">All Status</option>
            {tab === "team" ? (
              <>
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="unavailable">Unavailable</option>
              </>
            ) : (
              <>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="inactive">Inactive</option>
              </>
            )}
          </select>

          {/* Service filter (firms only) */}
          {tab === "firms" && allServices.length > 0 && (
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
              style={inputStyle}
            >
              <option value="">All Services</option>
              {allServices.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          {/* Active filter count */}
          {(stateFilter.length > 0 || statusFilter || serviceFilter) && (
            <button
              onClick={() => { setStateFilter([]); setStatusFilter(""); setServiceFilter(""); }}
              className="text-xs px-2 py-1 rounded cursor-pointer"
              style={{ color: "var(--accent)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Close state dropdown on outside click */}
      {showStateDropdown && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowStateDropdown(false)}
        />
      )}

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      ) : (
        <>
          {/* ── Overview Tab ───────────────────────────────── */}
          {tab === "overview" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetricCard label="Team Members" value={totalTeam} icon="team" />
              <MetricCard label="Total Firms" value={totalFirms} sub={`${activeFirms} active`} icon="firm" />
              <MetricCard label="States Covered" value={statesCovered.size} icon="state" />
              <MetricCard label="Available Now" value={availableCounts.available} icon="available" />
              <MetricCard label="Pending Approvals" value={pendingFirms} icon="pending" highlight={pendingFirms > 0} />
              <MetricCard label="License Alerts" value={licenseAlerts.expiring + licenseAlerts.expired} sub={licenseAlerts.expiring > 0 ? `${licenseAlerts.expiring} expiring soon` : undefined} icon="alert" highlight={(licenseAlerts.expiring + licenseAlerts.expired) > 0} />
            </div>
          )}

          {/* ── Team Members Tab ───────────────────────────── */}
          {tab === "team" && (
            <>
              {filteredTeam.length === 0 ? (
                <EmptyState message={search || stateFilter.length > 0 || statusFilter ? "No team members match your filters." : "No team members in the network yet."} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredTeam.map((member) => {
                    const summary = licenseSummary(member.licenses);
                    const avail = member.availability ?? "unavailable";
                    const activeStates = member.licenses
                      .filter((l) => calcLicenseStatus(l.expiry_date, l.status) === "approved")
                      .map((l) => l.state);
                    const uniqueStates = Array.from(new Set(activeStates)).sort();

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
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold truncate">{member.full_name}</h3>
                              <Badge label={avail} colors={AVAILABILITY_COLORS[avail] ?? AVAILABILITY_COLORS.unavailable} />
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                              {member.position && <span>{member.position}</span>}
                              {member.department && <span>{member.department}</span>}
                              {member.location && <span>{member.location}</span>}
                            </div>

                            {/* State code badges */}
                            {uniqueStates.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {uniqueStates.map((s) => (
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
                <EmptyState message={search || stateFilter.length > 0 || statusFilter || serviceFilter ? "No firms match your filters." : "No firms in the network yet."} />
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

                          {/* Location + Entity type */}
                          <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {(firm.city || firm.firm_state) && (
                              <span>
                                {[firm.city, firm.firm_state].filter(Boolean).join(", ")}
                              </span>
                            )}
                            {firm.entity_type && (
                              <span style={{ color: "var(--text-muted)" }}>
                                {firm.entity_type}
                              </span>
                            )}
                          </div>

                          {/* Contact info */}
                          {firm.contact_name && (
                            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                              {firm.contact_name}
                              {firm.contact_email && ` · ${firm.contact_email}`}
                              {firm.contact_phone && ` · ${firm.contact_phone}`}
                            </p>
                          )}

                          {/* Website */}
                          {firm.website && (
                            <p className="text-[11px] mt-0.5">
                              <a
                                href={firm.website.startsWith("http") ? firm.website : `https://${firm.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ color: "var(--accent)" }}
                              >
                                {firm.website.replace(/^https?:\/\//, "")}
                              </a>
                            </p>
                          )}

                          {/* Rating */}
                          {firm.rating != null && firm.rating > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                  key={star}
                                  width="12"
                                  height="12"
                                  viewBox="0 0 24 24"
                                  fill={star <= firm.rating! ? "#facc15" : "none"}
                                  stroke={star <= firm.rating! ? "#facc15" : "var(--text-muted)"}
                                  strokeWidth="1.8"
                                >
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              ))}
                            </div>
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

          {/* ── Analytics Tab ──────────────────────────────── */}
          {tab === "analytics" && (
            <div className="space-y-6">
              {/* Row 1: License Breakdown + Availability */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* License Status Breakdown */}
                <div style={cardStyle}>
                  <h3 className="text-sm font-semibold mb-4">License Status Breakdown</h3>
                  <div className="space-y-3">
                    <AnalyticsBar label="Active" count={licenseAlerts.active} total={licenseAlerts.total} color="#4ade80" />
                    <AnalyticsBar label="Expiring (90 days)" count={licenseAlerts.expiring} total={licenseAlerts.total} color="#facc15" />
                    <AnalyticsBar label="Expired" count={licenseAlerts.expired} total={licenseAlerts.total} color="#ef4444" />
                  </div>
                  <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
                    {licenseAlerts.total} total licenses across {totalTeam} team members
                  </p>
                </div>

                {/* Availability Breakdown */}
                <div style={cardStyle}>
                  <h3 className="text-sm font-semibold mb-4">Team Availability</h3>
                  <div className="space-y-3">
                    <AnalyticsBar label="Available" count={availableCounts.available} total={totalTeam} color="#4ade80" />
                    <AnalyticsBar label="Busy" count={availableCounts.busy} total={totalTeam} color="#facc15" />
                    <AnalyticsBar label="Unavailable" count={availableCounts.unavailable} total={totalTeam} color="#888888" />
                  </div>
                  <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
                    {totalTeam} team members total
                  </p>
                </div>
              </div>

              {/* Row 2: Geographic Coverage */}
              <div style={cardStyle}>
                <h3 className="text-sm font-semibold mb-4">Geographic Coverage</h3>
                <div className="flex flex-wrap gap-1.5">
                  {US_STATES.map((s) => {
                    const hasTeam = teamLicenseStates.has(s);
                    const hasFirm = firmCoverageStates.has(s);
                    const hasBoth = hasTeam && hasFirm;

                    let bg = "var(--bg-hover)";
                    let text = "var(--text-muted)";
                    let title = `${s}: No coverage`;

                    if (hasBoth) {
                      bg = "#1a3a2a";
                      text = "#4ade80";
                      title = `${s}: Team + Firm coverage`;
                    } else if (hasTeam) {
                      bg = "#1a2a3a";
                      text = "#60a5fa";
                      title = `${s}: Team licensed`;
                    } else if (hasFirm) {
                      bg = "#2d1b4e";
                      text = "#a78bfa";
                      title = `${s}: Firm coverage`;
                    }

                    return (
                      <span
                        key={s}
                        title={title}
                        className="text-[10px] font-semibold px-2 py-1 rounded cursor-default"
                        style={{ background: bg, color: text, minWidth: 32, textAlign: "center" }}
                      >
                        {s}
                      </span>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded" style={{ background: "#1a3a2a" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Both</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded" style={{ background: "#1a2a3a" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Team only</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded" style={{ background: "#2d1b4e" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Firm only</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded" style={{ background: "var(--bg-hover)" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>No coverage</span>
                  </div>
                </div>
              </div>

              {/* Row 3: Firm summary */}
              <div style={cardStyle}>
                <h3 className="text-sm font-semibold mb-4">Firm Status</h3>
                <div className="space-y-3">
                  <AnalyticsBar label="Active" count={activeFirms} total={totalFirms} color="#4ade80" />
                  <AnalyticsBar label="Pending" count={pendingFirms} total={totalFirms} color="#facc15" />
                  <AnalyticsBar label="Inactive" count={firms.filter((f) => f.status === "inactive").length} total={totalFirms} color="#888888" />
                </div>
                <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
                  {totalFirms} firms across {statesCovered.size} states
                </p>
              </div>
            </div>
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
            className="rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
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

              {/* Website + Entity Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Website
                  </label>
                  <input
                    type="text"
                    value={firmForm.website}
                    onChange={(e) => setFirmForm({ ...firmForm, website: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    placeholder="www.example.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Entity Type
                  </label>
                  <input
                    type="text"
                    value={firmForm.entity_type}
                    onChange={(e) => setFirmForm({ ...firmForm, entity_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    placeholder="LLC, Corp, Sole Prop..."
                  />
                </div>
              </div>

              {/* City + State + Rating */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    City
                  </label>
                  <input
                    type="text"
                    value={firmForm.city}
                    onChange={(e) => setFirmForm({ ...firmForm, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    placeholder="City..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    HQ State
                  </label>
                  <input
                    type="text"
                    value={firmForm.firm_state}
                    onChange={(e) => setFirmForm({ ...firmForm, firm_state: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    placeholder="FL"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Rating (1-5)
                  </label>
                  <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFirmForm({ ...firmForm, rating: firmForm.rating === star ? 0 : star })}
                        className="cursor-pointer"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill={star <= firmForm.rating ? "#facc15" : "none"}
                          stroke={star <= firmForm.rating ? "#facc15" : "var(--text-muted)"}
                          strokeWidth="1.8"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                    ))}
                  </div>
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
    available: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.8">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    alert: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={highlight ? "#ef4444" : "var(--accent)"} strokeWidth="1.8">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
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

function AnalyticsBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="text-xs font-semibold" style={{ color }}>
          {count} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({pct}%)</span>
        </span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ background: "var(--bg-hover)", height: 6 }}
      >
        <div
          className="rounded-full transition-all"
          style={{ width: `${pct}%`, height: "100%", background: color }}
        />
      </div>
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
