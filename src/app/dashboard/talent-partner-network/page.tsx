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

interface HierarchyLevel {
  id: string;
  firm_id: string;
  level_number: number;
  label: string;
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
  firm_name: string | null; // resolved from firms table or company_name
  user_id: string | null; // non-null = has portal account
  status: "active" | "inactive";
  hierarchy_level_id: string | null;
  reports_to_id: string | null;
  region: string | null;
  market: string | null;
  hierarchy_label?: string | null; // resolved from firm_hierarchy_levels
  reports_to_name?: string | null; // resolved from self-join
}

interface Firm {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  states: string[] | null;
  website: string | null;
  entity_type: string | null;
  year_established: number | null;
  city: string | null;
  state: string | null;
  rating: number | null;
  status: "active" | "inactive";
  contact_count?: number;
}

interface FirmFormData {
  name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  states: string[];
  website: string;
  entity_type: string;
  city: string;
  state: string;
}

interface ExternalFormData {
  name: string;
  email: string;
  phone: string;
  specialty: string;
  specialty_other: string;
  states: string[];
  company_name: string;
  firm_id: string;
  hierarchy_level_id: string;
  reports_to_id: string;
  region: string;
  market: string;
}

const EMPTY_EXTERNAL_FORM: ExternalFormData = {
  name: "",
  email: "",
  phone: "",
  specialty: "",
  specialty_other: "",
  states: [],
  company_name: "",
  firm_id: "",
  hierarchy_level_id: "",
  reports_to_id: "",
  region: "",
  market: "",
};

const EMPTY_FIRM_FORM: FirmFormData = {
  name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  states: [],
  website: "",
  entity_type: "",
  city: "",
  state: "",
};

const ENTITY_TYPES = ["Law Firm", "Corporation", "LLC", "Partnership", "Sole Proprietorship", "Other"];

const SPECIALTIES = [
  "Attorney",
  "Appraiser",
  "Engineer",
  "HVAC",
  "Plumber",
  "Electrician",
  "Roofer",
  "Restoration",
  "Drywall",
  "General Contractor",
  "Other",
];

/* ── helpers ───────────────────────────────────────────── */

type Tab = "overview" | "internal" | "external" | "analytics";

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  internal: "Internal",
  external: "External",
  analytics: "Analytics",
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
const ADMIN_ROLES = ["admin", "super_admin", "system_admin", "ep_admin"];
const SUPER_ADMIN_ROLES = ["super_admin", "system_admin"];
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

/* ── main page ─────────────────────────────────────────── */

export default function TalentPartnerNetworkPage() {
  const supabase = createClient();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  // Per-tab filter state
  const [internalSearch, setInternalSearch] = useState("");
  const [internalStateFilter, setInternalStateFilter] = useState<string[]>([]);
  const [internalAvailFilter, setInternalAvailFilter] = useState("");
  const [internalShowStateDrop, setInternalShowStateDrop] = useState(false);
  const [internalShowAll, setInternalShowAll] = useState(false);

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
  const [successMessage, setSuccessMessage] = useState("");
  const [deactivateConfirm, setDeactivateConfirm] = useState<string | null>(null);
  const [showFormStateDrop, setShowFormStateDrop] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [promoteContact, setPromoteContact] = useState<ExternalContact | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState("");

  // Firm management state
  const [firms, setFirms] = useState<Firm[]>([]);
  const [showFirmModal, setShowFirmModal] = useState(false);
  const [editingFirmId, setEditingFirmId] = useState<string | null>(null);
  const [firmForm, setFirmForm] = useState<FirmFormData>(EMPTY_FIRM_FORM);
  const [savingFirm, setSavingFirm] = useState(false);
  const [showFirmStateDrop, setShowFirmStateDrop] = useState(false);
  const [firmDetailId, setFirmDetailId] = useState<string | null>(null);
  const [deactivateFirmConfirm, setDeactivateFirmConfirm] = useState<string | null>(null);

  // Hierarchy levels state
  const [allHierarchyLevels, setAllHierarchyLevels] = useState<HierarchyLevel[]>([]);
  const [firmLevelEdits, setFirmLevelEdits] = useState<{ level_number: number; label: string }[]>([]);
  const [showHierarchySection, setShowHierarchySection] = useState(false);

  const isAdmin = ADMIN_ROLES.includes(userRole);
  const isSuperAdmin = SUPER_ADMIN_ROLES.includes(userRole);

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

  const fetchInternalUsers = useCallback(async () => {
    // Load ALL internal directory users — exclude external partners
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, position, department, location, profile_picture_url, availability")
      .eq("org_id", ORG_ID)
      .eq("status", "active")
      .eq("user_type", "internal")
      .order("full_name");

    if (!users) {
      setInternalUsers([]);
      return;
    }

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
    // Load external contacts with optional firm name resolution
    const { data: contacts } = await supabase
      .from("external_contacts")
      .select("id, name, email, phone, specialty, specialty_other, states, company_name, firm_id, user_id, status, hierarchy_level_id, reports_to_id, region, market")
      .eq("org_id", ORG_ID)
      .eq("status", "active")
      .order("name");

    if (!contacts || contacts.length === 0) {
      setExternalContacts([]);
      return;
    }

    // Resolve firm names for contacts that have firm_id
    const firmIds = [...new Set(contacts.filter((c) => c.firm_id).map((c) => c.firm_id!))];
    const firmNameMap = new Map<string, string>();

    if (firmIds.length > 0) {
      const { data: firmRows } = await supabase
        .from("firms")
        .select("id, name")
        .in("id", firmIds);
      for (const f of firmRows ?? []) {
        firmNameMap.set(f.id, f.name);
      }
    }

    // Build a name lookup for reports_to resolution
    const contactNameMap = new Map<string, string>();
    for (const c of contacts) contactNameMap.set(c.id, c.name);

    setExternalContacts(
      contacts.map((c) => ({
        ...c,
        user_id: c.user_id ?? null,
        firm_name: c.firm_id ? (firmNameMap.get(c.firm_id) ?? c.company_name) : c.company_name,
        hierarchy_level_id: c.hierarchy_level_id ?? null,
        reports_to_id: c.reports_to_id ?? null,
        region: c.region ?? null,
        market: c.market ?? null,
        reports_to_name: c.reports_to_id ? (contactNameMap.get(c.reports_to_id) ?? null) : null,
      }))
    );
  }, []);

  const fetchFirms = useCallback(async () => {
    const { data: firmRows } = await supabase
      .from("firms")
      .select("id, name, contact_name, contact_email, contact_phone, states, website, entity_type, year_established, city, state, rating, status")
      .eq("org_id", ORG_ID)
      .eq("status", "active")
      .order("name");
    setFirms(firmRows ?? []);
  }, []);

  const fetchHierarchyLevels = useCallback(async () => {
    const { data } = await supabase
      .from("firm_hierarchy_levels")
      .select("id, firm_id, level_number, label")
      .order("level_number");
    setAllHierarchyLevels(data ?? []);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchInternalUsers(), fetchExternalContacts(), fetchFirms(), fetchHierarchyLevels()]).then(() => setLoading(false));
  }, [fetchInternalUsers, fetchExternalContacts, fetchFirms, fetchHierarchyLevels]);

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
      firm_id: c.firm_id ?? "",
      hierarchy_level_id: c.hierarchy_level_id ?? "",
      reports_to_id: c.reports_to_id ?? "",
      region: c.region ?? "",
      market: c.market ?? "",
    });
    setShowExternalModal(true);
  };

  const handleSaveExternal = async () => {
    if (!externalForm.name.trim() || !externalForm.specialty) return;
    setSaving(true);

    // If a firm is selected, auto-fill company_name from the firm
    const selectedFirm = externalForm.firm_id ? firms.find((f) => f.id === externalForm.firm_id) : null;
    const companyName = selectedFirm ? selectedFirm.name : (externalForm.company_name.trim() || null);

    const payload = {
      name: externalForm.name.trim(),
      email: externalForm.email.trim() || null,
      phone: externalForm.phone.trim() || null,
      specialty: externalForm.specialty,
      specialty_other: externalForm.specialty === "Other" ? externalForm.specialty_other.trim() || null : null,
      states: externalForm.states.length > 0 ? externalForm.states : null,
      company_name: companyName,
      firm_id: externalForm.firm_id || null,
      hierarchy_level_id: externalForm.hierarchy_level_id || null,
      reports_to_id: externalForm.reports_to_id || null,
      region: externalForm.region.trim() || null,
      market: externalForm.market.trim() || null,
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
        status: "pending",
      });
      setSaving(false);
      setShowExternalModal(false);
      setSuccessMessage("Submitted for approval — a super admin will review this contact.");
      setTimeout(() => setSuccessMessage(""), 5000);
      return;
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
    router.push("/dashboard/user-management?tab=external");
  };

  /* ── firm CRUD ────────────────────────────────────────── */

  const openAddFirm = () => {
    setEditingFirmId(null);
    setFirmForm(EMPTY_FIRM_FORM);
    setFirmLevelEdits([]);
    setShowHierarchySection(false);
    setShowFirmModal(true);
  };

  const openEditFirm = (f: Firm) => {
    setEditingFirmId(f.id);
    setFirmForm({
      name: f.name,
      contact_name: f.contact_name ?? "",
      contact_email: f.contact_email ?? "",
      contact_phone: f.contact_phone ?? "",
      states: f.states ?? [],
      website: f.website ?? "",
      entity_type: f.entity_type ?? "",
      city: f.city ?? "",
      state: f.state ?? "",
    });
    // Load existing hierarchy levels for this firm
    const existingLevels = allHierarchyLevels
      .filter((l) => l.firm_id === f.id)
      .sort((a, b) => a.level_number - b.level_number)
      .map((l) => ({ level_number: l.level_number, label: l.label }));
    setFirmLevelEdits(existingLevels);
    setShowHierarchySection(existingLevels.length > 0);
    setShowFirmModal(true);
  };

  const handleSaveFirm = async () => {
    if (!firmForm.name.trim()) return;
    setSavingFirm(true);

    const payload = {
      name: firmForm.name.trim(),
      contact_name: firmForm.contact_name.trim() || null,
      contact_email: firmForm.contact_email.trim() || null,
      contact_phone: firmForm.contact_phone.trim() || null,
      states: firmForm.states.length > 0 ? firmForm.states : null,
      website: firmForm.website.trim() || null,
      entity_type: firmForm.entity_type || null,
      city: firmForm.city.trim() || null,
      state: firmForm.state || null,
      updated_at: new Date().toISOString(),
    };

    let firmId = editingFirmId;
    if (editingFirmId) {
      await supabase.from("firms").update(payload).eq("id", editingFirmId);
    } else {
      const { data: inserted } = await supabase.from("firms").insert({ ...payload, org_id: ORG_ID, status: isSuperAdmin ? "active" : "pending" }).select("id").single();
      firmId = inserted?.id ?? null;
      if (!isSuperAdmin) {
        setSavingFirm(false);
        setShowFirmModal(false);
        setSuccessMessage("Firm submitted for approval — a super admin will review it.");
        setTimeout(() => setSuccessMessage(""), 5000);
        return;
      }
    }

    // Save hierarchy levels if firm was saved successfully
    if (firmId) {
      // Delete existing levels for this firm and re-insert
      await supabase.from("firm_hierarchy_levels").delete().eq("firm_id", firmId);
      const validLevels = firmLevelEdits.filter((l) => l.label.trim());
      if (validLevels.length > 0) {
        await supabase.from("firm_hierarchy_levels").insert(
          validLevels.map((l, i) => ({
            firm_id: firmId!,
            level_number: i + 1,
            label: l.label.trim(),
          }))
        );
      }
    }

    setSavingFirm(false);
    setShowFirmModal(false);
    fetchFirms();
    fetchHierarchyLevels();
    fetchExternalContacts(); // firm name resolution may change
  };

  const handleDeactivateFirm = async (id: string) => {
    // Unlink contacts from this firm first
    await supabase.from("external_contacts").update({ firm_id: null, updated_at: new Date().toISOString() }).eq("firm_id", id);
    await supabase.from("firms").update({ status: "inactive", updated_at: new Date().toISOString() }).eq("id", id);
    setDeactivateFirmConfirm(null);
    setFirmDetailId(null);
    fetchFirms();
    fetchExternalContacts();
  };

  // Contacts for the firm detail view
  const firmDetailContacts = useMemo(() => {
    if (!firmDetailId) return [];
    return externalContacts.filter((c) => c.firm_id === firmDetailId);
  }, [firmDetailId, externalContacts]);

  const firmDetail = useMemo(() => {
    if (!firmDetailId) return null;
    return firms.find((f) => f.id === firmDetailId) ?? null;
  }, [firmDetailId, firms]);

  /* ── computed metrics ────────────────────────────────── */

  const statesCovered = useMemo(() => {
    const s = new Set<string>();
    for (const u of internalUsers) {
      for (const l of u.licenses) {
        if (calcLicenseStatus(l.expiry_date, l.status) === "approved") s.add(l.state);
      }
    }
    for (const c of externalContacts) {
      for (const st of c.states ?? []) s.add(st);
    }
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

  // Unique firm names from external contacts for the firm filter chip
  const externalFirmNames = useMemo(() => {
    const s = new Set<string>();
    for (const c of externalContacts) {
      if (c.firm_name) s.add(c.firm_name);
    }
    return Array.from(s).sort();
  }, [externalContacts]);

  // Unique specialties present in external contacts
  const externalSpecialties = useMemo(() => {
    const s = new Set<string>();
    for (const c of externalContacts) {
      s.add(c.specialty === "Other" ? (c.specialty_other ?? "Other") : c.specialty);
    }
    return Array.from(s).sort();
  }, [externalContacts]);

  // Internal license states (for analytics)
  const teamLicenseStates = useMemo(() => {
    const s = new Set<string>();
    for (const u of internalUsers) {
      for (const l of u.licenses) {
        if (calcLicenseStatus(l.expiry_date, l.status) === "approved") s.add(l.state);
      }
    }
    return s;
  }, [internalUsers]);

  // External coverage states (for analytics)
  const externalCoverageStates = useMemo(() => {
    const s = new Set<string>();
    for (const c of externalContacts) {
      for (const st of c.states ?? []) s.add(st);
    }
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

      if (internalAvailFilter) {
        if ((u.availability ?? "unavailable") !== internalAvailFilter) return false;
      }

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

      if (externalFirmFilter) {
        if (c.firm_name !== externalFirmFilter) return false;
      }

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

  return (
    <div>
      {/* Success toast */}
      {successMessage && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm font-medium" style={{ background: "#1a3a2a", color: "#4ade80", border: "1px solid #2a5a3a" }}>
          {successMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Talent Partner Network</h1>
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
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-color)")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              {copiedLink === "internal" ? "Link Copied!" : "Copy Invite Link"}
            </button>
          )}
          {tab === "external" && isAdmin && (
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
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-color)")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                {copiedLink === "external" ? "Link Copied!" : "Copy Invite Link"}
              </button>
              <button
                onClick={openAddFirm}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-color)")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                </svg>
                + New Firm
              </button>
              <button
                onClick={openAddExternal}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                style={{ background: "var(--accent)", color: "#000" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
              >
                <span className="text-lg">+</span> Add External User
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5">
        {(["overview", "internal", "external", "analytics"] as Tab[]).map((t) => (
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

      {/* ── Internal Filter Bar ─────────────────────────── */}
      {tab === "internal" && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            value={internalSearch}
            onChange={(e) => setInternalSearch(e.target.value)}
            placeholder="Search name, department, position..."
            className="w-full max-w-xs px-3 py-2 rounded-lg text-sm outline-none"
            style={inputStyle}
          />

          {/* State filter */}
          <div className="relative">
            <button
              onClick={() => setInternalShowStateDrop(!internalShowStateDrop)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer"
              style={{ ...inputStyle, minWidth: 120 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
              </svg>
              {internalStateFilter.length > 0 ? `${internalStateFilter.length} state${internalStateFilter.length > 1 ? "s" : ""}` : "States"}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
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

          {/* Availability filter */}
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
      )}

      {/* ── External Filter Bar ─────────────────────────── */}
      {tab === "external" && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            value={externalSearch}
            onChange={(e) => setExternalSearch(e.target.value)}
            placeholder="Search name, email, company..."
            className="w-full max-w-xs px-3 py-2 rounded-lg text-sm outline-none"
            style={inputStyle}
          />

          {/* Specialty filter */}
          <select
            value={externalSpecialtyFilter}
            onChange={(e) => setExternalSpecialtyFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
            style={inputStyle}
          >
            <option value="">All Specialties</option>
            {externalSpecialties.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* State filter */}
          <div className="relative">
            <button
              onClick={() => setExternalShowStateDrop(!externalShowStateDrop)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer"
              style={{ ...inputStyle, minWidth: 120 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
              </svg>
              {externalStateFilter.length > 0 ? `${externalStateFilter.length} state${externalStateFilter.length > 1 ? "s" : ""}` : "States"}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
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

          {/* Firm sub-filter */}
          {(firms.length > 0 || externalFirmNames.length > 0) && (
            <select
              value={externalFirmFilter}
              onChange={(e) => setExternalFirmFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
              style={inputStyle}
            >
              <option value="">All Firms</option>
              {firms.map((f) => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
              {/* Also show company_name values not linked to a firm */}
              {externalFirmNames.filter((n) => !firms.some((f) => f.name === n)).map((n) => (
                <option key={n} value={n}>{n} (unlinked)</option>
              ))}
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
      )}

      {/* Close state dropdowns on outside click */}
      {(internalShowStateDrop || externalShowStateDrop) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => { setInternalShowStateDrop(false); setExternalShowStateDrop(false); }}
        />
      )}

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      ) : (
        <>
          {/* ── Overview Tab ───────────────────────────────── */}
          {tab === "overview" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetricCard label="Internal Team" value={internalUsers.length} icon="team" />
              <MetricCard label="External Contacts" value={externalContacts.length} icon="external" />
              <MetricCard label="States Covered" value={statesCovered.size} icon="state" />
              <MetricCard label="Available Now" value={availableCounts.available} icon="available" />
              <MetricCard
                label="License Alerts"
                value={licenseAlerts.expiring + licenseAlerts.expired}
                sub={licenseAlerts.expiring > 0 ? `${licenseAlerts.expiring} expiring soon` : undefined}
                icon="alert"
                highlight={(licenseAlerts.expiring + licenseAlerts.expired) > 0}
              />
              <MetricCard
                label="Specialties"
                value={externalSpecialties.length}
                sub={externalContacts.length > 0 ? "across external contacts" : undefined}
                icon="specialty"
              />
            </div>
          )}

          {/* ── Internal Tab ───────────────────────────────── */}
          {tab === "internal" && (
            <>
              {filteredInternal.length === 0 ? (
                <EmptyState message={internalSearch || internalStateFilter.length > 0 || internalAvailFilter ? "No team members match your filters." : "No team members in the directory yet."} />
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {visibleInternal.map((member) => {
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

                  {!internalShowAll && filteredInternal.length > SOFT_CAP && (
                    <div className="text-center mt-4">
                      <button
                        onClick={() => setInternalShowAll(true)}
                        className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors"
                        style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
                      >
                        Load more ({filteredInternal.length - SOFT_CAP} remaining)
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── External Tab ──────────────────────────────── */}
          {tab === "external" && (
            <>
              {filteredExternal.length === 0 ? (
                <EmptyState message={externalSearch || externalStateFilter.length > 0 || externalSpecialtyFilter || externalFirmFilter ? "No external contacts match your filters." : "No external contacts yet."} />
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {visibleExternal.map((contact) => {
                      const displaySpecialty = contact.specialty === "Other" ? (contact.specialty_other ?? "Other") : contact.specialty;
                      const contactStates = (contact.states ?? []).sort();

                      return (
                        <div
                          key={contact.id}
                          className="rounded-xl p-4"
                          style={cardStyle}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-semibold truncate">{contact.name}</h3>
                                <span
                                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                                  style={{ background: "#2d1b4e", color: "#a78bfa" }}
                                >
                                  {displaySpecialty}
                                </span>
                              </div>

                              {contact.firm_name && (
                                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                                  {contact.firm_id ? (
                                    <button
                                      onClick={() => setFirmDetailId(contact.firm_id)}
                                      className="cursor-pointer underline"
                                      style={{ color: "var(--accent)" }}
                                    >
                                      {contact.firm_name}
                                    </button>
                                  ) : (
                                    contact.firm_name
                                  )}
                                </p>
                              )}

                              {/* Hierarchy role + reports to */}
                              {(contact.hierarchy_level_id || contact.region || contact.market) && (
                                <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                                  {contact.hierarchy_level_id && (() => {
                                    const level = allHierarchyLevels.find((l) => l.id === contact.hierarchy_level_id);
                                    return level ? (
                                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{level.label}</span>
                                    ) : null;
                                  })()}
                                  {contact.reports_to_name && (
                                    <span style={{ color: "var(--text-muted)" }}>↳ {contact.reports_to_name}</span>
                                  )}
                                  {contact.region && (
                                    <span style={{ color: "var(--text-muted)" }}>{contact.region}</span>
                                  )}
                                  {contact.market && (
                                    <span style={{ color: "var(--text-muted)" }}>{contact.market}</span>
                                  )}
                                </div>
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

                            <div className="flex items-center gap-1 shrink-0">
                              {/* Portal access indicator or grant button */}
                              {contact.user_id ? (
                                <span
                                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full mr-1"
                                  style={{ background: "#1a3a2a", color: "#4ade80" }}
                                  title="Has portal access"
                                >
                                  PORTAL
                                </span>
                              ) : (isAdmin && contact.email && (
                                <button
                                  onClick={() => setPromoteContact(contact)}
                                  className="text-[10px] font-medium px-2 py-1 rounded-lg mr-1 cursor-pointer transition-colors"
                                  style={{ background: "#1e3a5f", color: "#60a5fa", border: "1px solid #2d4a6f" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#264a73")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "#1e3a5f")}
                                  title="Grant portal access"
                                >
                                  Grant Access
                                </button>
                              ))}

                              {isSuperAdmin && (
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
                              )}

                              {isSuperAdmin && (deactivateConfirm === contact.id ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleDeactivateExternal(contact.id)}
                                      className="px-2 py-1 rounded text-xs font-medium cursor-pointer"
                                      style={{ background: "#4a1a1a", color: "#ef4444" }}
                                    >
                                      Remove
                                    </button>
                                    <button
                                      onClick={() => setDeactivateConfirm(null)}
                                      className="px-2 py-1 rounded text-xs cursor-pointer"
                                      style={{ color: "var(--text-muted)" }}
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeactivateConfirm(contact.id)}
                                    className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                                    title="Remove"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8">
                                      <circle cx="12" cy="12" r="10" />
                                      <line x1="15" y1="9" x2="9" y2="15" />
                                      <line x1="9" y1="9" x2="15" y2="15" />
                                    </svg>
                                  </button>
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!externalShowAll && filteredExternal.length > SOFT_CAP && (
                    <div className="text-center mt-4">
                      <button
                        onClick={() => setExternalShowAll(true)}
                        className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors"
                        style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
                      >
                        Load more ({filteredExternal.length - SOFT_CAP} remaining)
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Analytics Tab ──────────────────────────────── */}
          {tab === "analytics" && (
            <div className="space-y-6">
              {/* Row 1: License Breakdown + Availability */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div style={cardStyle}>
                  <h3 className="text-sm font-semibold mb-4">License Status Breakdown</h3>
                  <div className="space-y-3">
                    <AnalyticsBar label="Active" count={licenseAlerts.active} total={licenseAlerts.total} color="#4ade80" />
                    <AnalyticsBar label="Expiring (90 days)" count={licenseAlerts.expiring} total={licenseAlerts.total} color="#facc15" />
                    <AnalyticsBar label="Expired" count={licenseAlerts.expired} total={licenseAlerts.total} color="#ef4444" />
                  </div>
                  <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
                    {licenseAlerts.total} total licenses across {internalUsers.length} team members
                  </p>
                </div>

                <div style={cardStyle}>
                  <h3 className="text-sm font-semibold mb-4">Team Availability</h3>
                  <div className="space-y-3">
                    <AnalyticsBar label="Available" count={availableCounts.available} total={internalUsers.length} color="#4ade80" />
                    <AnalyticsBar label="Busy" count={availableCounts.busy} total={internalUsers.length} color="#facc15" />
                    <AnalyticsBar label="Unavailable" count={availableCounts.unavailable} total={internalUsers.length} color="#888888" />
                  </div>
                  <p className="text-[11px] mt-3" style={{ color: "var(--text-muted)" }}>
                    {internalUsers.length} team members total
                  </p>
                </div>
              </div>

              {/* Row 2: Geographic Coverage */}
              <div style={cardStyle}>
                <h3 className="text-sm font-semibold mb-4">Geographic Coverage</h3>
                <div className="flex flex-wrap gap-1.5">
                  {US_STATES.map((s) => {
                    const hasTeam = teamLicenseStates.has(s);
                    const hasExternal = externalCoverageStates.has(s);
                    const hasBoth = hasTeam && hasExternal;

                    let bg = "var(--bg-hover)";
                    let text = "var(--text-muted)";
                    let title = `${s}: No coverage`;

                    if (hasBoth) {
                      bg = "#1a3a2a";
                      text = "#4ade80";
                      title = `${s}: Internal + External coverage`;
                    } else if (hasTeam) {
                      bg = "#1a2a3a";
                      text = "#60a5fa";
                      title = `${s}: Internal licensed`;
                    } else if (hasExternal) {
                      bg = "#2d1b4e";
                      text = "#a78bfa";
                      title = `${s}: External coverage`;
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
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Internal only</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded" style={{ background: "#2d1b4e" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>External only</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded" style={{ background: "var(--bg-hover)" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>No coverage</span>
                  </div>
                </div>
              </div>

              {/* Row 3: Specialty Breakdown + Portal Access */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div style={cardStyle}>
                  <h3 className="text-sm font-semibold mb-4">External Specialty Breakdown</h3>
                  {externalContacts.length === 0 ? (
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No external contacts yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {SPECIALTIES.map((spec) => {
                        const count = externalContacts.filter((c) =>
                          spec === "Other" ? c.specialty === "Other" : c.specialty === spec
                        ).length;
                        if (count === 0) return null;
                        return (
                          <AnalyticsBar key={spec} label={spec} count={count} total={externalContacts.length} color="#a78bfa" />
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={cardStyle}>
                  <h3 className="text-sm font-semibold mb-4">External Partner Status</h3>
                  {(() => {
                    const withPortal = externalContacts.filter((c) => c.user_id).length;
                    const withEmail = externalContacts.filter((c) => c.email && !c.user_id).length;
                    const noEmail = externalContacts.filter((c) => !c.email && !c.user_id).length;
                    const withFirm = externalContacts.filter((c) => c.firm_id).length;
                    const noFirm = externalContacts.filter((c) => !c.firm_id).length;
                    return (
                      <div className="space-y-3">
                        <AnalyticsBar label="Portal Access" count={withPortal} total={externalContacts.length} color="#4ade80" />
                        <AnalyticsBar label="Has Email (no portal)" count={withEmail} total={externalContacts.length} color="#60a5fa" />
                        <AnalyticsBar label="No Email" count={noEmail} total={externalContacts.length} color="#888888" />
                        <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                          <AnalyticsBar label="Linked to Firm" count={withFirm} total={externalContacts.length} color="#a78bfa" />
                          <div className="mt-3">
                            <AnalyticsBar label="Standalone" count={noFirm} total={externalContacts.length} color="#888888" />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Row 4: Firms Breakdown */}
              {firms.length > 0 && (
                <div style={cardStyle}>
                  <h3 className="text-sm font-semibold mb-4">Contacts by Firm</h3>
                  <div className="space-y-3">
                    {firms.map((f) => {
                      const count = externalContacts.filter((c) => c.firm_id === f.id).length;
                      if (count === 0) return null;
                      return (
                        <AnalyticsBar key={f.id} label={f.name} count={count} total={externalContacts.length} color="#60a5fa" />
                      );
                    })}
                    {(() => {
                      const unlinked = externalContacts.filter((c) => !c.firm_id).length;
                      if (unlinked === 0) return null;
                      return <AnalyticsBar label="No Firm" count={unlinked} total={externalContacts.length} color="#888888" />;
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Grant Portal Access Confirmation Modal ───── */}
      {promoteContact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => { if (!promoting) { setPromoteContact(null); setPromoteError(""); } }}
        >
          <div
            className="rounded-xl p-6 w-full max-w-md"
            style={{ background: "var(--bg-page)", border: "1px solid var(--border-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">Grant Portal Access</h2>
            <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
              Grant portal access to:
            </p>
            <p className="text-sm font-semibold mb-1">{promoteContact.name}</p>
            <p className="text-sm mb-4" style={{ color: "var(--accent)" }}>{promoteContact.email}</p>
            <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
              They will receive an email invitation to set up their account and log in.
            </p>

            {promoteError && (
              <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#4a1a1a", color: "#ef4444" }}>
                {promoteError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setPromoteContact(null); setPromoteError(""); }}
                disabled={promoting}
                className="px-4 py-2 rounded-lg text-sm cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                Cancel
              </button>
              <button
                onClick={handlePromoteToPortal}
                disabled={promoting}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                style={{ background: "var(--accent)", color: "#000", opacity: promoting ? 0.6 : 1 }}
              >
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
              <button
                onClick={() => setShowExternalModal(false)}
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
                  Name *
                </label>
                <input
                  type="text"
                  value={externalForm.name}
                  onChange={(e) => setExternalForm({ ...externalForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                  placeholder="Full name..."
                />
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={externalForm.email}
                    onChange={(e) => setExternalForm({ ...externalForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Phone
                  </label>
                  <input
                    type="text"
                    value={externalForm.phone}
                    onChange={(e) => setExternalForm({ ...externalForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              {/* Specialty */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Specialty *
                </label>
                <select
                  value={externalForm.specialty}
                  onChange={(e) => setExternalForm({ ...externalForm, specialty: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                  style={inputStyle}
                >
                  <option value="">Select specialty...</option>
                  {SPECIALTIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Other specialty free text */}
              {externalForm.specialty === "Other" && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Describe specialty
                  </label>
                  <input
                    type="text"
                    value={externalForm.specialty_other}
                    onChange={(e) => setExternalForm({ ...externalForm, specialty_other: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    placeholder="What do they do?"
                  />
                </div>
              )}

              {/* States they cover */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  States They Cover
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowFormStateDrop(!showFormStateDrop)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer w-full text-left"
                    style={inputStyle}
                  >
                    {externalForm.states.length > 0
                      ? externalForm.states.join(", ")
                      : "Select states..."}
                  </button>
                  {showFormStateDrop && (
                    <div
                      className="absolute top-full left-0 mt-1 z-40 rounded-lg p-2 max-h-60 overflow-y-auto w-full"
                      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
                    >
                      {externalForm.states.length > 0 && (
                        <button
                          onClick={() => setExternalForm({ ...externalForm, states: [] })}
                          className="w-full text-left px-2 py-1 text-xs rounded cursor-pointer mb-1"
                          style={{ color: "var(--accent)" }}
                        >
                          Clear all
                        </button>
                      )}
                      <div className="grid grid-cols-6 gap-1">
                        {US_STATES.map((s) => (
                          <button
                            key={s}
                            onClick={() => toggleFormState(s)}
                            className="px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors"
                            style={{
                              background: externalForm.states.includes(s) ? "var(--accent)" : "var(--bg-hover)",
                              color: externalForm.states.includes(s) ? "#000" : "var(--text-secondary)",
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Firm (linked) */}
              {firms.length > 0 && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Attach to Firm
                  </label>
                  <select
                    value={externalForm.firm_id}
                    onChange={(e) => setExternalForm({ ...externalForm, firm_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    <option value="">No firm (standalone contact)</option>
                    {firms.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}{f.city && f.state ? ` — ${f.city}, ${f.state}` : ""}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Company Name — only show if not attached to a firm */}
              {!externalForm.firm_id && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Company Name (optional)
                  </label>
                  <input
                    type="text"
                    value={externalForm.company_name}
                    onChange={(e) => setExternalForm({ ...externalForm, company_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    placeholder="Company or firm name..."
                  />
                </div>
              )}

              {/* Role + Reports To — only if the selected firm has hierarchy levels */}
              {(() => {
                const firmLevels = externalForm.firm_id
                  ? allHierarchyLevels.filter((l) => l.firm_id === externalForm.firm_id).sort((a, b) => a.level_number - b.level_number)
                  : [];
                if (firmLevels.length === 0) return null;

                const selectedLevel = firmLevels.find((l) => l.id === externalForm.hierarchy_level_id);
                const levelAbove = selectedLevel
                  ? firmLevels.find((l) => l.level_number === selectedLevel.level_number - 1)
                  : null;
                // Contacts at the level above in the same firm for "Reports To"
                const reportsToOptions = levelAbove
                  ? externalContacts.filter((c) => c.firm_id === externalForm.firm_id && c.hierarchy_level_id === levelAbove.id && c.id !== editingContactId)
                  : [];

                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Role</label>
                        <select
                          value={externalForm.hierarchy_level_id}
                          onChange={(e) => setExternalForm({ ...externalForm, hierarchy_level_id: e.target.value, reports_to_id: "" })}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                          style={inputStyle}
                        >
                          <option value="">Select role...</option>
                          {firmLevels.map((l) => (
                            <option key={l.id} value={l.id}>{l.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Reports To</label>
                        {selectedLevel && selectedLevel.level_number === 1 ? (
                          <div className="px-3 py-2 rounded-lg text-sm" style={{ ...inputStyle, color: "var(--text-muted)" }}>Top level — no one</div>
                        ) : reportsToOptions.length > 0 ? (
                          <select
                            value={externalForm.reports_to_id}
                            onChange={(e) => setExternalForm({ ...externalForm, reports_to_id: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                            style={inputStyle}
                          >
                            <option value="">Select...</option>
                            {reportsToOptions.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="px-3 py-2 rounded-lg text-sm" style={{ ...inputStyle, color: "var(--text-muted)" }}>
                            {!selectedLevel ? "Select a role first" : "No one at the level above yet"}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Region + Market — always available */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Region</label>
                  <input
                    type="text"
                    value={externalForm.region}
                    onChange={(e) => setExternalForm({ ...externalForm, region: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    placeholder="e.g. Southeast, Region 3..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Market</label>
                  <input
                    type="text"
                    value={externalForm.market}
                    onChange={(e) => setExternalForm({ ...externalForm, market: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={inputStyle}
                    placeholder="e.g. Florida, DFW, Austin..."
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowExternalModal(false)}
                  className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveExternal}
                  disabled={saving || !externalForm.name.trim() || !externalForm.specialty}
                  className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#000" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  {saving ? "Saving..." : editingContactId ? "Save Changes" : "Add User"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Firm Detail Modal ─────────────────────────── */}
      {firmDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setFirmDetailId(null); }}
        >
          <div
            className="rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{firmDetail.name}</h2>
              <div className="flex items-center gap-2">
                {isSuperAdmin && (
                  <button
                    onClick={() => { setFirmDetailId(null); openEditFirm(firmDetail); }}
                    className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                    title="Edit Firm"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => setFirmDetailId(null)}
                  className="text-lg cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Firm info grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {firmDetail.entity_type && (
                <div>
                  <span className="text-[10px] font-medium block" style={{ color: "var(--text-muted)" }}>Type</span>
                  <span className="text-sm">{firmDetail.entity_type}</span>
                </div>
              )}
              {(firmDetail.city || firmDetail.state) && (
                <div>
                  <span className="text-[10px] font-medium block" style={{ color: "var(--text-muted)" }}>Location</span>
                  <span className="text-sm">{[firmDetail.city, firmDetail.state].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {firmDetail.contact_name && (
                <div>
                  <span className="text-[10px] font-medium block" style={{ color: "var(--text-muted)" }}>Primary Contact</span>
                  <span className="text-sm">{firmDetail.contact_name}</span>
                </div>
              )}
              {firmDetail.contact_email && (
                <div>
                  <span className="text-[10px] font-medium block" style={{ color: "var(--text-muted)" }}>Email</span>
                  <a href={`mailto:${firmDetail.contact_email}`} className="text-sm" style={{ color: "var(--accent)" }}>{firmDetail.contact_email}</a>
                </div>
              )}
              {firmDetail.contact_phone && (
                <div>
                  <span className="text-[10px] font-medium block" style={{ color: "var(--text-muted)" }}>Phone</span>
                  <span className="text-sm">{firmDetail.contact_phone}</span>
                </div>
              )}
              {firmDetail.website && (
                <div>
                  <span className="text-[10px] font-medium block" style={{ color: "var(--text-muted)" }}>Website</span>
                  <span className="text-sm" style={{ color: "var(--accent)" }}>{firmDetail.website}</span>
                </div>
              )}
            </div>

            {/* States */}
            {firmDetail.states && firmDetail.states.length > 0 && (
              <div className="mb-5">
                <span className="text-[10px] font-medium block mb-1.5" style={{ color: "var(--text-muted)" }}>States Covered</span>
                <div className="flex flex-wrap gap-1">
                  {firmDetail.states.sort().map((s: string) => (
                    <span key={s} className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Attached contacts — org tree if hierarchy exists, flat list otherwise */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  People at this firm ({firmDetailContacts.length})
                </span>
              </div>
              {firmDetailContacts.length === 0 ? (
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No contacts attached to this firm yet.</p>
              ) : (() => {
                const firmLevels = allHierarchyLevels
                  .filter((l) => l.firm_id === firmDetailId)
                  .sort((a, b) => a.level_number - b.level_number);

                if (firmLevels.length === 0) {
                  // Flat list — no hierarchy
                  return (
                    <div className="space-y-2">
                      {firmDetailContacts.map((c) => {
                        const displaySpec = c.specialty === "Other" ? (c.specialty_other ?? "Other") : c.specialty;
                        return (
                          <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
                            <div>
                              <span className="text-sm font-medium">{c.name}</span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2" style={{ background: "#2d1b4e", color: "#a78bfa" }}>{displaySpec}</span>
                              {c.email && <p className="text-[11px] mt-0.5" style={{ color: "var(--accent)" }}>{c.email}</p>}
                              {(c.region || c.market) && (
                                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{[c.region, c.market].filter(Boolean).join(" · ")}</p>
                              )}
                            </div>
                            {c.user_id && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "#1a3a2a", color: "#4ade80" }}>PORTAL</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // Org tree — group contacts by hierarchy level
                const unassigned = firmDetailContacts.filter((c) => !c.hierarchy_level_id);
                return (
                  <div className="space-y-3">
                    {firmLevels.map((level) => {
                      const levelContacts = firmDetailContacts.filter((c) => c.hierarchy_level_id === level.id);
                      if (levelContacts.length === 0) return null;
                      return (
                        <div key={level.id}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                              {level.label}
                            </span>
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>({levelContacts.length})</span>
                          </div>
                          <div className="space-y-1.5" style={{ marginLeft: `${(level.level_number - 1) * 16}px` }}>
                            {levelContacts.map((c) => {
                              const displaySpec = c.specialty === "Other" ? (c.specialty_other ?? "Other") : c.specialty;
                              return (
                                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{c.name}</span>
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#2d1b4e", color: "#a78bfa" }}>{displaySpec}</span>
                                      {c.user_id && (
                                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "#1a3a2a", color: "#4ade80" }}>PORTAL</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                                      {c.reports_to_name && <span>↳ {c.reports_to_name}</span>}
                                      {c.region && <span>{c.region}</span>}
                                      {c.market && <span>{c.market}</span>}
                                    </div>
                                    {c.email && <p className="text-[11px] mt-0.5" style={{ color: "var(--accent)" }}>{c.email}</p>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {unassigned.length > 0 && (
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                          Unassigned ({unassigned.length})
                        </span>
                        <div className="space-y-1.5 mt-1.5">
                          {unassigned.map((c) => {
                            const displaySpec = c.specialty === "Other" ? (c.specialty_other ?? "Other") : c.specialty;
                            return (
                              <div key={c.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
                                <div>
                                  <span className="text-sm font-medium">{c.name}</span>
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2" style={{ background: "#2d1b4e", color: "#a78bfa" }}>{displaySpec}</span>
                                  {c.email && <p className="text-[11px] mt-0.5" style={{ color: "var(--accent)" }}>{c.email}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Deactivate firm */}
            {isSuperAdmin && (
              <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                {deactivateFirmConfirm === firmDetail.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "#ef4444" }}>Remove this firm and unlink all contacts?</span>
                    <button onClick={() => handleDeactivateFirm(firmDetail.id)} className="px-3 py-1.5 rounded text-xs font-medium cursor-pointer" style={{ background: "#4a1a1a", color: "#ef4444" }}>Yes, Remove</button>
                    <button onClick={() => setDeactivateFirmConfirm(null)} className="px-3 py-1.5 rounded text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeactivateFirmConfirm(firmDetail.id)}
                    className="text-xs cursor-pointer"
                    style={{ color: "#ef4444" }}
                  >
                    Remove Firm
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create/Edit Firm Modal ─────────────────────── */}
      {showFirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowFirmModal(false); }}
        >
          <div
            className="rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">{editingFirmId ? "Edit Firm" : "New Firm"}</h2>
              <button onClick={() => setShowFirmModal(false)} className="text-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>✕</button>
            </div>

            <div className="space-y-4">
              {/* Firm Name */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Firm Name *</label>
                <input
                  type="text"
                  value={firmForm.name}
                  onChange={(e) => setFirmForm({ ...firmForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                  placeholder="e.g. Smith & Associates P.L."
                />
              </div>

              {/* Entity Type + Location */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Type</label>
                  <select
                    value={firmForm.entity_type}
                    onChange={(e) => setFirmForm({ ...firmForm, entity_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    <option value="">Select...</option>
                    {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>City</label>
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
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>State</label>
                  <select
                    value={firmForm.state}
                    onChange={(e) => setFirmForm({ ...firmForm, state: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={inputStyle}
                  >
                    <option value="">Select...</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Primary Contact */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Contact Name</label>
                  <input type="text" value={firmForm.contact_name} onChange={(e) => setFirmForm({ ...firmForm, contact_name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Name..." />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Contact Email</label>
                  <input type="email" value={firmForm.contact_email} onChange={(e) => setFirmForm({ ...firmForm, contact_email: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="email@..." />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Contact Phone</label>
                  <input type="text" value={firmForm.contact_phone} onChange={(e) => setFirmForm({ ...firmForm, contact_phone: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="(555)..." />
                </div>
              </div>

              {/* Website */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Website</label>
                <input type="text" value={firmForm.website} onChange={(e) => setFirmForm({ ...firmForm, website: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="www.example.com" />
              </div>

              {/* States Covered */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>States Covered</label>
                <div className="relative">
                  <button
                    onClick={() => setShowFirmStateDrop(!showFirmStateDrop)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer w-full text-left"
                    style={inputStyle}
                  >
                    {firmForm.states.length > 0 ? firmForm.states.join(", ") : "Select states..."}
                  </button>
                  {showFirmStateDrop && (
                    <div className="absolute top-full left-0 mt-1 z-40 rounded-lg p-2 max-h-60 overflow-y-auto w-full" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                      {firmForm.states.length > 0 && (
                        <button onClick={() => setFirmForm({ ...firmForm, states: [] })} className="w-full text-left px-2 py-1 text-xs rounded cursor-pointer mb-1" style={{ color: "var(--accent)" }}>Clear all</button>
                      )}
                      <div className="grid grid-cols-6 gap-1">
                        {US_STATES.map((s) => (
                          <button
                            key={s}
                            onClick={() => setFirmForm((prev) => ({ ...prev, states: prev.states.includes(s) ? prev.states.filter((x) => x !== s) : [...prev.states, s] }))}
                            className="px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors"
                            style={{ background: firmForm.states.includes(s) ? "var(--accent)" : "var(--bg-hover)", color: firmForm.states.includes(s) ? "#000" : "var(--text-secondary)" }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Organization Levels (optional) — super admins only */}
              {isSuperAdmin && <div>
                <button
                  onClick={() => setShowHierarchySection(!showHierarchySection)}
                  className="flex items-center gap-2 text-xs font-medium cursor-pointer"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showHierarchySection ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  Organization Levels
                  {firmLevelEdits.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-hover)", color: "var(--text-muted)" }}>
                      {firmLevelEdits.length}
                    </span>
                  )}
                </button>

                {showHierarchySection && (
                  <div className="mt-2 space-y-2 pl-4" style={{ borderLeft: "2px solid var(--border-color)" }}>
                    {firmLevelEdits.length === 0 && (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        No hierarchy defined — contacts will be stored as a flat list.
                      </p>
                    )}
                    {firmLevelEdits.map((level, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold w-5 text-center shrink-0" style={{ color: "var(--text-muted)" }}>{idx + 1}</span>
                        <input
                          type="text"
                          value={level.label}
                          onChange={(e) => {
                            const updated = [...firmLevelEdits];
                            updated[idx] = { ...updated[idx], label: e.target.value };
                            setFirmLevelEdits(updated);
                          }}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
                          style={inputStyle}
                          placeholder={`Level ${idx + 1} title (e.g. ${idx === 0 ? "Regional VP" : idx === 1 ? "Team Lead" : "Project Manager"})...`}
                        />
                        {idx > 0 && (
                          <button
                            onClick={() => {
                              const updated = [...firmLevelEdits];
                              [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
                              setFirmLevelEdits(updated);
                            }}
                            className="text-[10px] px-1.5 py-1 rounded cursor-pointer"
                            style={{ color: "var(--text-muted)" }}
                            title="Move up"
                          >▲</button>
                        )}
                        {idx < firmLevelEdits.length - 1 && (
                          <button
                            onClick={() => {
                              const updated = [...firmLevelEdits];
                              [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
                              setFirmLevelEdits(updated);
                            }}
                            className="text-[10px] px-1.5 py-1 rounded cursor-pointer"
                            style={{ color: "var(--text-muted)" }}
                            title="Move down"
                          >▼</button>
                        )}
                        <button
                          onClick={() => setFirmLevelEdits(firmLevelEdits.filter((_, i) => i !== idx))}
                          className="text-[10px] px-1.5 py-1 rounded cursor-pointer"
                          style={{ color: "#ef4444" }}
                          title="Remove level"
                        >✕</button>
                      </div>
                    ))}
                    <button
                      onClick={() => setFirmLevelEdits([...firmLevelEdits, { level_number: firmLevelEdits.length + 1, label: "" }])}
                      className="flex items-center gap-1 text-xs font-medium cursor-pointer px-2 py-1 rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
                      style={{ color: "var(--accent)" }}
                    >
                      <span>+</span> Add Level
                    </button>
                  </div>
                )}
              </div>}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => setShowFirmModal(false)} className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-secondary)" }}>Cancel</button>
                <button
                  onClick={handleSaveFirm}
                  disabled={savingFirm || !firmForm.name.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#000" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  {savingFirm ? "Saving..." : editingFirmId ? "Save Changes" : "Create Firm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close firm state dropdown on outside click */}
      {showFirmStateDrop && (
        <div className="fixed inset-0 z-30" onClick={() => setShowFirmStateDrop(false)} />
      )}

      {/* Close form state dropdown on outside click */}
      {showFormStateDrop && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowFormStateDrop(false)}
        />
      )}
    </div>
  );
}

/* ── sub-components ─────────────────────────────────────── */

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
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", minWidth: 200 }}
    >
      {selected.length > 0 && (
        <button
          onClick={onClear}
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
    external: (
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
    specialty: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
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
