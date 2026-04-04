"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

/* ── types ─────────────────────────────────────────────── */

interface InternalUser {
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

interface ExternalContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  specialty: string;
  specialty_other: string | null;
  states: string[] | null;
  company_name: string | null;
  firm_id: string | null;
  firm_name: string | null;
  user_id: string | null;
  status: "active" | "inactive";
}

interface ExternalFormData {
  name: string;
  email: string;
  phone: string;
  specialty: string;
  specialty_other: string;
  states: string[];
  company_name: string;
}

const EMPTY_EXTERNAL_FORM: ExternalFormData = {
  name: "",
  email: "",
  phone: "",
  specialty: "",
  specialty_other: "",
  states: [],
  company_name: "",
};

const SPECIALTIES = [
  "Attorney", "Appraiser", "Engineer", "HVAC", "Plumber",
  "Electrician", "Roofer", "Restoration", "Drywall",
  "General Contractor", "Other",
];

/* ── helpers ───────────────────────────────────────────── */

type Tab = "overview" | "internal" | "external" | "analytics" | "partner-settings" | "approval-rules" | "service-types";

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  internal: "Internal",
  external: "External",
  analytics: "Analytics",
  "partner-settings": "Partner Settings",
  "approval-rules": "Approval Rules",
  "service-types": "Service Types",
};

const AVAILABILITY_COLORS: Record<string, { bg: string; text: string }> = {
  available: { bg: "#1a3a2a", text: "#4ade80" },
  busy: { bg: "#3a3520", text: "#facc15" },
  unavailable: { bg: "#2a2a2a", text: "#888888" },
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
const SOFT_CAP = 200;

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

function StateDropdown({
  selected,
  onToggle,
  onClear,
  onClose,
}: {
  selected: string[];
  onToggle: (s: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute top-full left-0 mt-1 z-40 rounded-lg p-2 max-h-60 overflow-y-auto"
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", minWidth: 280 }}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        {selected.length > 0 && (
          <button onClick={onClear} className="text-xs cursor-pointer" style={{ color: "var(--accent)" }}>
            Clear
          </button>
        )}
        <button onClick={onClose} className="text-xs cursor-pointer ml-auto" style={{ color: "var(--text-muted)" }}>
          Done
        </button>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {US_STATES.map((s) => (
          <button
            key={s}
            onClick={() => onToggle(s)}
            className="px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors"
            style={{
              background: selected.includes(s) ? "var(--accent)" : "var(--bg-hover)",
              color: selected.includes(s) ? "#000" : "var(--text-secondary)",
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── main page ─────────────────────────────────────────── */

export default function TPNAdminPage() {
  const supabase = createClient();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("external");
  const [loading, setLoading] = useState(true);

  // Internal filters
  const [internalSearch, setInternalSearch] = useState("");
  const [internalStateFilter, setInternalStateFilter] = useState<string[]>([]);
  const [internalAvailFilter, setInternalAvailFilter] = useState("");
  const [internalShowStateDrop, setInternalShowStateDrop] = useState(false);
  const [internalShowAll, setInternalShowAll] = useState(false);

  // External filters
  const [externalSearch, setExternalSearch] = useState("");
  const [externalStateFilter, setExternalStateFilter] = useState<string[]>([]);
  const [externalSpecialtyFilter, setExternalSpecialtyFilter] = useState("");
  const [externalFirmFilter, setExternalFirmFilter] = useState("");
  const [externalShowStateDrop, setExternalShowStateDrop] = useState(false);
  const [externalShowAll, setExternalShowAll] = useState(false);

  // Data
  const [internalUsers, setInternalUsers] = useState<InternalUser[]>([]);
  const [externalContacts, setExternalContacts] = useState<ExternalContact[]>([]);

  // External contact modal
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [externalForm, setExternalForm] = useState<ExternalFormData>(EMPTY_EXTERNAL_FORM);
  const [saving, setSaving] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState<string | null>(null);
  const [showFormStateDrop, setShowFormStateDrop] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Promote modal
  const [promoteContact, setPromoteContact] = useState<ExternalContact | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState("");

  /* ── fetch data ──────────────────────────────────────── */

  const fetchInternalUsers = useCallback(async () => {
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, position, department, location, profile_picture_url, availability")
      .eq("org_id", ORG_ID)
      .eq("status", "active")
      .order("full_name");

    if (!users) { setInternalUsers([]); return; }

    const userIds = users.map((u) => u.id);
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

    setInternalUsers(
      users.map((u) => ({
        ...u,
        availability: u.availability ?? null,
        licenses: licenseMap.get(u.id) ?? [],
      }))
    );
  }, []);

  const fetchExternalContacts = useCallback(async () => {
    const { data: contacts } = await supabase
      .from("external_contacts")
      .select("id, name, email, phone, specialty, specialty_other, states, company_name, firm_id, user_id, status")
      .eq("org_id", ORG_ID)
      .eq("status", "active")
      .order("name");

    if (!contacts || contacts.length === 0) { setExternalContacts([]); return; }

    const firmIds = [...new Set(contacts.filter((c) => c.firm_id).map((c) => c.firm_id!))];
    const firmNameMap = new Map<string, string>();
    if (firmIds.length > 0) {
      const { data: firmRows } = await supabase.from("firms").select("id, name").in("id", firmIds);
      for (const f of firmRows ?? []) firmNameMap.set(f.id, f.name);
    }

    setExternalContacts(
      contacts.map((c) => ({
        ...c,
        user_id: c.user_id ?? null,
        firm_name: c.firm_id ? (firmNameMap.get(c.firm_id) ?? c.company_name) : c.company_name,
      }))
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchInternalUsers(), fetchExternalContacts()]).then(() => setLoading(false));
  }, [fetchInternalUsers, fetchExternalContacts]);

  /* ── external contact CRUD ─────────────────────────────── */

  const openAddExternal = () => {
    setEditingContactId(null);
    setExternalForm(EMPTY_EXTERNAL_FORM);
    setShowExternalModal(true);
  };

  const openEditExternal = (c: ExternalContact) => {
    setEditingContactId(c.id);
    setExternalForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      specialty: c.specialty,
      specialty_other: c.specialty_other ?? "",
      states: c.states ?? [],
      company_name: c.company_name ?? "",
    });
    setShowExternalModal(true);
  };

  const handleSaveExternal = async () => {
    if (!externalForm.name.trim() || !externalForm.specialty) return;
    setSaving(true);

    const payload = {
      name: externalForm.name.trim(),
      email: externalForm.email.trim() || null,
      phone: externalForm.phone.trim() || null,
      specialty: externalForm.specialty,
      specialty_other: externalForm.specialty === "Other" ? externalForm.specialty_other.trim() || null : null,
      states: externalForm.states.length > 0 ? externalForm.states : null,
      company_name: externalForm.company_name.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (editingContactId) {
      await supabase.from("external_contacts").update(payload).eq("id", editingContactId);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("external_contacts").insert({
        ...payload,
        org_id: ORG_ID,
        created_by: user?.id ?? null,
      });
    }

    setSaving(false);
    setShowExternalModal(false);
    fetchExternalContacts();
  };

  const handleDeactivateExternal = async (id: string) => {
    await supabase
      .from("external_contacts")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("id", id);
    setDeactivateConfirm(null);
    fetchExternalContacts();
  };

  /* ── promote to portal account ────────────────────────── */

  const handlePromoteToPortal = async () => {
    if (!promoteContact || !promoteContact.email) return;
    setPromoting(true);
    setPromoteError("");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setPromoteError("Not authenticated");
      setPromoting(false);
      return;
    }

    const res = await fetch("/api/invite-external-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        contactId: promoteContact.id,
        name: promoteContact.name,
        email: promoteContact.email,
        orgId: ORG_ID,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      setPromoteError(err.error || "Failed to grant access");
      setPromoting(false);
      return;
    }

    setPromoting(false);
    setPromoteContact(null);
    fetchExternalContacts();
  };

  /* ── computed ────────────────────────────────────────── */

  const statesCovered = useMemo(() => {
    const s = new Set<string>();
    for (const u of internalUsers)
      for (const l of u.licenses)
        if (calcLicenseStatus(l.expiry_date, l.status) === "approved") s.add(l.state);
    for (const c of externalContacts)
      for (const st of c.states ?? []) s.add(st);
    return s;
  }, [internalUsers, externalContacts]);

  const availableCounts = useMemo(() => {
    let available = 0, busy = 0, unavailable = 0;
    for (const u of internalUsers) {
      if (u.availability === "available") available++;
      else if (u.availability === "busy") busy++;
      else unavailable++;
    }
    return { available, busy, unavailable };
  }, [internalUsers]);

  const licenseAlerts = useMemo(() => {
    let expiring = 0, expired = 0, active = 0;
    for (const u of internalUsers) {
      const s = licenseSummary(u.licenses);
      expiring += s.expiring;
      expired += s.expired;
      active += s.active;
    }
    return { active, expiring, expired, total: active + expiring + expired };
  }, [internalUsers]);

  const externalFirmNames = useMemo(() => {
    const s = new Set<string>();
    for (const c of externalContacts) if (c.firm_name) s.add(c.firm_name);
    return Array.from(s).sort();
  }, [externalContacts]);

  const externalSpecialties = useMemo(() => {
    const s = new Set<string>();
    for (const c of externalContacts)
      s.add(c.specialty === "Other" ? (c.specialty_other ?? "Other") : c.specialty);
    return Array.from(s).sort();
  }, [externalContacts]);

  const teamLicenseStates = useMemo(() => {
    const s = new Set<string>();
    for (const u of internalUsers)
      for (const l of u.licenses)
        if (calcLicenseStatus(l.expiry_date, l.status) === "approved") s.add(l.state);
    return s;
  }, [internalUsers]);

  const externalCoverageStates = useMemo(() => {
    const s = new Set<string>();
    for (const c of externalContacts)
      for (const st of c.states ?? []) s.add(st);
    return s;
  }, [externalContacts]);

  /* ── filters ──────────────────────────────────────────── */

  const filteredInternal = useMemo(() => {
    const q = internalSearch.toLowerCase();
    return internalUsers.filter((u) => {
      if (q && !(
        u.full_name.toLowerCase().includes(q) ||
        (u.department ?? "").toLowerCase().includes(q) ||
        (u.position ?? "").toLowerCase().includes(q) ||
        (u.location ?? "").toLowerCase().includes(q)
      )) return false;

      if (internalStateFilter.length > 0) {
        const memberStates = u.licenses
          .filter((l) => calcLicenseStatus(l.expiry_date, l.status) === "approved")
          .map((l) => l.state);
        if (!internalStateFilter.some((s) => memberStates.includes(s))) return false;
      }

      if (internalAvailFilter && (u.availability ?? "unavailable") !== internalAvailFilter) return false;
      return true;
    });
  }, [internalUsers, internalSearch, internalStateFilter, internalAvailFilter]);

  const filteredExternal = useMemo(() => {
    const q = externalSearch.toLowerCase();
    return externalContacts.filter((c) => {
      if (q && !(
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.company_name ?? "").toLowerCase().includes(q) ||
        c.specialty.toLowerCase().includes(q) ||
        (c.specialty_other ?? "").toLowerCase().includes(q)
      )) return false;

      if (externalStateFilter.length > 0) {
        if (!externalStateFilter.some((s) => (c.states ?? []).includes(s))) return false;
      }

      if (externalSpecialtyFilter) {
        const display = c.specialty === "Other" ? (c.specialty_other ?? "Other") : c.specialty;
        if (display !== externalSpecialtyFilter) return false;
      }

      if (externalFirmFilter && c.firm_name !== externalFirmFilter) return false;
      return true;
    });
  }, [externalContacts, externalSearch, externalStateFilter, externalSpecialtyFilter, externalFirmFilter]);

  const visibleInternal = internalShowAll ? filteredInternal : filteredInternal.slice(0, SOFT_CAP);
  const visibleExternal = externalShowAll ? filteredExternal : filteredExternal.slice(0, SOFT_CAP);

  const toggleInternalState = (s: string) =>
    setInternalStateFilter((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  const toggleExternalState = (s: string) =>
    setExternalStateFilter((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  const toggleFormState = (s: string) =>
    setExternalForm((prev) => ({
      ...prev,
      states: prev.states.includes(s) ? prev.states.filter((x) => x !== s) : [...prev.states, s],
    }));

  /* ── render ──────────────────────────────────────────── */

  const networkTabs: Tab[] = ["overview", "internal", "external", "analytics"];
  const adminTabs: Tab[] = ["partner-settings", "approval-rules", "service-types"];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">TPN Admin</h1>
        <div className="flex items-center gap-2">
          {tab === "internal" && (
            <button
              onClick={() => {
                const url = `${window.location.origin}/apply`;
                navigator.clipboard.writeText(url);
                setCopiedLink("internal");
                setTimeout(() => setCopiedLink(null), 2000);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
              style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
            >
              {copiedLink === "internal" ? "Link Copied!" : "Copy Invite Link"}
            </button>
          )}
          {tab === "external" && (
            <>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/apply`;
                  navigator.clipboard.writeText(url);
                  setCopiedLink("external");
                  setTimeout(() => setCopiedLink(null), 2000);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
              >
                {copiedLink === "external" ? "Link Copied!" : "Copy Invite Link"}
              </button>
              <button
                onClick={openAddExternal}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                style={{ background: "var(--accent)", color: "#000" }}
              >
                <span className="text-lg">+</span> Add External User
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Groups */}
      <div className="flex items-center gap-1 mb-5">
        {networkTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            style={{
              background: tab === t ? "var(--bg-hover)" : "transparent",
              color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
        <div className="w-px h-5 mx-2" style={{ background: "var(--border-color)" }} />
        {adminTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            style={{
              background: tab === t ? "var(--bg-hover)" : "transparent",
              color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</p>}

      {/* ── Overview ───────────────────────────────────── */}
      {!loading && tab === "overview" && (
        <div className="grid grid-cols-3 gap-4">
          <div style={cardStyle}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Team Members</p>
            <p className="text-2xl font-bold">{internalUsers.length}</p>
          </div>
          <div style={cardStyle}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>External Contacts</p>
            <p className="text-2xl font-bold">{externalContacts.length}</p>
          </div>
          <div style={cardStyle}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>States Covered</p>
            <p className="text-2xl font-bold">{statesCovered.size}</p>
          </div>
          <div style={cardStyle}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Available</p>
            <p className="text-2xl font-bold" style={{ color: "#4ade80" }}>{availableCounts.available}</p>
          </div>
          <div style={cardStyle}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Active Licenses</p>
            <p className="text-2xl font-bold">{licenseAlerts.active}</p>
          </div>
          <div style={cardStyle}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Portal Accounts</p>
            <p className="text-2xl font-bold">{externalContacts.filter((c) => c.user_id).length}</p>
          </div>
        </div>
      )}

      {/* ── Internal Filter Bar ─────────────────────────── */}
      {!loading && tab === "internal" && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="text"
              value={internalSearch}
              onChange={(e) => setInternalSearch(e.target.value)}
              placeholder="Search name, department, position..."
              className="w-full max-w-xs px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
            <div className="relative">
              <button
                onClick={() => setInternalShowStateDrop(!internalShowStateDrop)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer"
                style={{ ...inputStyle, minWidth: 120 }}
              >
                {internalStateFilter.length > 0 ? `${internalStateFilter.length} state${internalStateFilter.length > 1 ? "s" : ""}` : "States"}
              </button>
              {internalShowStateDrop && (
                <StateDropdown
                  selected={internalStateFilter}
                  onToggle={toggleInternalState}
                  onClear={() => setInternalStateFilter([])}
                  onClose={() => setInternalShowStateDrop(false)}
                />
              )}
            </div>
            <select
              value={internalAvailFilter}
              onChange={(e) => setInternalAvailFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
              style={inputStyle}
            >
              <option value="">All Availability</option>
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="unavailable">Unavailable</option>
            </select>
            {(internalStateFilter.length > 0 || internalAvailFilter) && (
              <button
                onClick={() => { setInternalStateFilter([]); setInternalAvailFilter(""); }}
                className="text-xs px-2 py-1 rounded cursor-pointer"
                style={{ color: "var(--accent)" }}
              >
                Clear filters
              </button>
            )}
          </div>

          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            {filteredInternal.length} member{filteredInternal.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleInternal.map((member) => {
              const avail = member.availability ?? "unavailable";
              const summary = licenseSummary(member.licenses);
              const uniqueStates = [...new Set(
                member.licenses
                  .filter((l) => calcLicenseStatus(l.expiry_date, l.status) === "approved")
                  .map((l) => l.state)
              )].sort();
              return (
                <div
                  key={member.id}
                  className="rounded-xl p-4 cursor-pointer transition-colors"
                  style={cardStyle}
                  onClick={() => router.push(`/dashboard/user-management?user=${member.id}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-color)")}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
                      style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
                    >
                      {member.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
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
                      {uniqueStates.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {uniqueStates.map((s) => (
                            <span key={s} className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>{s}</span>
                          ))}
                        </div>
                      )}
                      {member.licenses.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          {summary.active > 0 && <Badge label={`${summary.active} active`} colors={LICENSE_STATUS_COLORS.approved} />}
                          {summary.expiring > 0 && <Badge label={`${summary.expiring} expiring`} colors={{ bg: "#3a3520", text: "#facc15" }} />}
                          {summary.expired > 0 && <Badge label={`${summary.expired} expired`} colors={LICENSE_STATUS_COLORS.expired} />}
                        </div>
                      )}
                      {member.licenses.length === 0 && (
                        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>No licenses on file</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {!internalShowAll && filteredInternal.length > SOFT_CAP && (
            <div className="text-center mt-4">
              <button onClick={() => setInternalShowAll(true)} className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                Load more ({filteredInternal.length - SOFT_CAP} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {/* ── External Filter Bar + Cards ─────────────────── */}
      {!loading && tab === "external" && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              type="text"
              value={externalSearch}
              onChange={(e) => setExternalSearch(e.target.value)}
              placeholder="Search name, email, company..."
              className="w-full max-w-xs px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
            <select
              value={externalSpecialtyFilter}
              onChange={(e) => setExternalSpecialtyFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
              style={inputStyle}
            >
              <option value="">All Specialties</option>
              {externalSpecialties.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="relative">
              <button
                onClick={() => setExternalShowStateDrop(!externalShowStateDrop)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer"
                style={{ ...inputStyle, minWidth: 120 }}
              >
                {externalStateFilter.length > 0 ? `${externalStateFilter.length} state${externalStateFilter.length > 1 ? "s" : ""}` : "States"}
              </button>
              {externalShowStateDrop && (
                <StateDropdown
                  selected={externalStateFilter}
                  onToggle={toggleExternalState}
                  onClear={() => setExternalStateFilter([])}
                  onClose={() => setExternalShowStateDrop(false)}
                />
              )}
            </div>
            {externalFirmNames.length > 0 && (
              <select
                value={externalFirmFilter}
                onChange={(e) => setExternalFirmFilter(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                style={inputStyle}
              >
                <option value="">All Firms</option>
                {externalFirmNames.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            )}
            {(externalStateFilter.length > 0 || externalSpecialtyFilter || externalFirmFilter) && (
              <button
                onClick={() => { setExternalStateFilter([]); setExternalSpecialtyFilter(""); setExternalFirmFilter(""); }}
                className="text-xs px-2 py-1 rounded cursor-pointer"
                style={{ color: "var(--accent)" }}
              >
                Clear filters
              </button>
            )}
          </div>

          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            {filteredExternal.length} contact{filteredExternal.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleExternal.map((contact) => {
              const displaySpecialty = contact.specialty === "Other" ? (contact.specialty_other ?? "Other") : contact.specialty;
              const contactStates = contact.states ?? [];
              return (
                <div key={contact.id} className="rounded-xl p-4" style={cardStyle}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold truncate">{contact.name}</h3>
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: "#2d1b4e", color: "#a78bfa" }}>
                          {displaySpecialty}
                        </span>
                      </div>
                      {contact.firm_name && (
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{contact.firm_name}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} onClick={(e) => e.stopPropagation()} style={{ color: "var(--accent)" }}>
                            {contact.email}
                          </a>
                        )}
                        {contact.phone && <span>{contact.phone}</span>}
                      </div>
                      {contactStates.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {contactStates.map((s) => (
                            <span key={s} className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Portal access indicator or grant button */}
                      {contact.user_id ? (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full mr-1" style={{ background: "#1a3a2a", color: "#4ade80" }} title="Has portal access">
                          PORTAL
                        </span>
                      ) : (contact.email && (
                        <button
                          onClick={() => setPromoteContact(contact)}
                          className="text-[10px] font-medium px-2 py-1 rounded-lg mr-1 cursor-pointer transition-colors"
                          style={{ background: "#1e3a5f", color: "#60a5fa", border: "1px solid #2d4a6f" }}
                          title="Grant portal access"
                        >
                          Grant Access
                        </button>
                      ))}

                      <button
                        onClick={() => openEditExternal(contact)}
                        className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                        title="Edit"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>

                      {deactivateConfirm === contact.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDeactivateExternal(contact.id)} className="px-2 py-1 rounded text-xs font-medium cursor-pointer" style={{ background: "#4a1a1a", color: "#ef4444" }}>
                            Remove
                          </button>
                          <button onClick={() => setDeactivateConfirm(null)} className="px-2 py-1 rounded text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>
                            No
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeactivateConfirm(contact.id)} className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" title="Remove">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {!externalShowAll && filteredExternal.length > SOFT_CAP && (
            <div className="text-center mt-4">
              <button onClick={() => setExternalShowAll(true)} className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                Load more ({filteredExternal.length - SOFT_CAP} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Analytics ───────────────────────────────────── */}
      {!loading && tab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div style={cardStyle}>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Active Licenses</p>
              <p className="text-2xl font-bold" style={{ color: "#4ade80" }}>{licenseAlerts.active}</p>
            </div>
            <div style={cardStyle}>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Expiring (90 days)</p>
              <p className="text-2xl font-bold" style={{ color: "#facc15" }}>{licenseAlerts.expiring}</p>
            </div>
            <div style={cardStyle}>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Expired</p>
              <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>{licenseAlerts.expired}</p>
            </div>
          </div>
          <div style={cardStyle}>
            <h3 className="text-sm font-semibold mb-3">Geographic Coverage</h3>
            <div className="flex flex-wrap gap-1">
              {US_STATES.map((s) => {
                const hasInternal = teamLicenseStates.has(s);
                const hasExternal = externalCoverageStates.has(s);
                const bg = hasInternal && hasExternal ? "#1a3a2a" : hasInternal ? "#1e3a5f" : hasExternal ? "#2d1b4e" : "var(--bg-hover)";
                const color = hasInternal && hasExternal ? "#4ade80" : hasInternal ? "#60a5fa" : hasExternal ? "#a78bfa" : "var(--text-muted)";
                return (
                  <span key={s} className="text-[10px] font-medium px-2 py-1 rounded" style={{ background: bg, color }}>{s}</span>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "#60a5fa" }} />Internal</span>
              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "#a78bfa" }} />External</span>
              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "#4ade80" }} />Both</span>
            </div>
          </div>
          <div style={cardStyle}>
            <h3 className="text-sm font-semibold mb-3">Specialties</h3>
            <div className="flex flex-wrap gap-2">
              {externalSpecialties.map((s) => {
                const count = externalContacts.filter((c) => (c.specialty === "Other" ? (c.specialty_other ?? "Other") : c.specialty) === s).length;
                return (
                  <span key={s} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "#2d1b4e", color: "#a78bfa" }}>
                    {s} ({count})
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Partner Settings ────────────────────────────── */}
      {tab === "partner-settings" && (
        <div className="space-y-4">
          <div style={cardStyle}>
            <h2 className="text-base font-semibold mb-2">External Partner Defaults</h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Default role, permissions, and onboarding settings for newly promoted external partners.
            </p>
          </div>
          <div style={cardStyle}>
            <h2 className="text-base font-semibold mb-2">Invite Settings</h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Email template and redirect URL configuration for partner invitations.
            </p>
          </div>
        </div>
      )}

      {/* ── Approval Rules ──────────────────────────────── */}
      {tab === "approval-rules" && (
        <div className="space-y-4">
          <div style={cardStyle}>
            <h2 className="text-base font-semibold mb-2">Contact Approval</h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Rules for whether new external contacts require admin approval before appearing in the Rolodex.
            </p>
          </div>
          <div style={cardStyle}>
            <h2 className="text-base font-semibold mb-2">Portal Access Approval</h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Workflow for approving portal account promotions. Currently admin-only — configurable here in Phase 7.
            </p>
          </div>
        </div>
      )}

      {/* ── Service Types ───────────────────────────────── */}
      {tab === "service-types" && (
        <div className="space-y-4">
          <div style={cardStyle}>
            <h2 className="text-base font-semibold mb-2">Specialty Categories</h2>
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
              The specialties available when adding external contacts.
            </p>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map((s) => (
                <span key={s} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>{s}</span>
              ))}
            </div>
          </div>
          <div style={cardStyle}>
            <h2 className="text-base font-semibold mb-2">Firm Service Types</h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Service categories that can be assigned to firms in the firm_services table.
            </p>
          </div>
        </div>
      )}

      {/* ── Grant Portal Access Confirmation Modal ───── */}
      {promoteContact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget && !promoting) { setPromoteContact(null); setPromoteError(""); } }}
        >
          <div
            className="rounded-xl p-6 w-full max-w-md"
            style={{ background: "var(--bg-page)", border: "1px solid var(--border-color)" }}
          >
            <h2 className="text-lg font-semibold mb-4">Grant Portal Access</h2>
            <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Grant portal access to:</p>
            <p className="text-sm font-semibold mb-1">{promoteContact.name}</p>
            <p className="text-sm mb-4" style={{ color: "var(--accent)" }}>{promoteContact.email}</p>
            <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
              They will receive an email invitation to set up their account and log in.
            </p>
            {promoteError && (
              <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#4a1a1a", color: "#ef4444" }}>{promoteError}</p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => { setPromoteContact(null); setPromoteError(""); }} disabled={promoting} className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ color: "var(--text-muted)" }}>Cancel</button>
              <button onClick={handlePromoteToPortal} disabled={promoting} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ background: "var(--accent)", color: "#000", opacity: promoting ? 0.6 : 1 }}>
                {promoting ? "Sending Invite..." : "Grant Access & Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit External Contact Modal ──────────── */}
      {showExternalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowExternalModal(false); }}
        >
          <div
            className="rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">
                {editingContactId ? "Edit External User" : "Add External User"}
              </h2>
              <button onClick={() => setShowExternalModal(false)} className="text-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Name *</label>
                <input type="text" value={externalForm.name} onChange={(e) => setExternalForm({ ...externalForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Full name..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Email</label>
                  <input type="email" value={externalForm.email} onChange={(e) => setExternalForm({ ...externalForm, email: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="email@example.com" />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Phone</label>
                  <input type="text" value={externalForm.phone} onChange={(e) => setExternalForm({ ...externalForm, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="(555) 123-4567" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Specialty *</label>
                <select value={externalForm.specialty} onChange={(e) => setExternalForm({ ...externalForm, specialty: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                  <option value="">Select specialty...</option>
                  {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {externalForm.specialty === "Other" && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Describe specialty</label>
                  <input type="text" value={externalForm.specialty_other} onChange={(e) => setExternalForm({ ...externalForm, specialty_other: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="What do they do?" />
                </div>
              )}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>States They Cover</label>
                <div className="relative">
                  <button onClick={() => setShowFormStateDrop(!showFormStateDrop)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer w-full text-left" style={inputStyle}>
                    {externalForm.states.length > 0 ? externalForm.states.join(", ") : "Select states..."}
                  </button>
                  {showFormStateDrop && (
                    <div className="absolute top-full left-0 mt-1 z-40 rounded-lg p-2 max-h-60 overflow-y-auto w-full" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                      {externalForm.states.length > 0 && (
                        <button onClick={() => setExternalForm({ ...externalForm, states: [] })} className="w-full text-left px-2 py-1 text-xs rounded cursor-pointer mb-1" style={{ color: "var(--accent)" }}>Clear all</button>
                      )}
                      <div className="grid grid-cols-6 gap-1">
                        {US_STATES.map((s) => (
                          <button key={s} onClick={() => toggleFormState(s)} className="px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors" style={{ background: externalForm.states.includes(s) ? "var(--accent)" : "var(--bg-hover)", color: externalForm.states.includes(s) ? "#000" : "var(--text-secondary)" }}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Company Name (optional)</label>
                <input type="text" value={externalForm.company_name} onChange={(e) => setExternalForm({ ...externalForm, company_name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Company or firm name..." />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => setShowExternalModal(false)} className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>Cancel</button>
                <button onClick={handleSaveExternal} disabled={saving || !externalForm.name.trim() || !externalForm.specialty} className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }}>
                  {saving ? "Saving..." : editingContactId ? "Save Changes" : "Add User"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
