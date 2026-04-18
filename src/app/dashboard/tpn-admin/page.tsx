"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
// XLSX imported dynamically in handleFileUpload to avoid 7MB bundle bloat

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
  firm_name: string | null;
  user_id: string | null;
  status: "active" | "inactive";
  hierarchy_level_id: string | null;
  reports_to_id: string | null;
  region: string | null;
  market: string | null;
  reports_to_name?: string | null;
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
  status: "active" | "pending" | "inactive";
  contact_count?: number;
}

interface ActivityEntry {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  performer_name?: string;
  contact_name?: string;
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
  "Attorney", "Appraiser", "Engineer", "HVAC", "Plumber",
  "Electrician", "Roofer", "Restoration", "Drywall",
  "General Contractor", "Other",
];

/* ── helpers ───────────────────────────────────────────── */

type Tab = "overview" | "internal" | "external" | "firms" | "analytics" | "activity-log" | "partner-settings" | "approval-rules" | "service-types";

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  internal: "Internal",
  external: "External",
  firms: "Firms",
  analytics: "Analytics",
  "activity-log": "Activity Log",
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
  const [supabase] = useState(() => createClient());
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
  const [successMessage, setSuccessMessage] = useState("");
  const [deactivateConfirm, setDeactivateConfirm] = useState<string | null>(null);
  const [showFormStateDrop, setShowFormStateDrop] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Promote modal
  const [promoteContact, setPromoteContact] = useState<ExternalContact | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState("");

  // Status filter (admin can see inactive)
  const [externalStatusFilter, setExternalStatusFilter] = useState<"active" | "inactive" | "all">("active");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"" | "assign-firm" | "update-states" | "deactivate">("");
  const [bulkFirmId, setBulkFirmId] = useState("");
  const [bulkStates, setBulkStates] = useState<string[]>([]);
  const [bulkStatesMode, setBulkStatesMode] = useState<"add" | "replace">("add");
  const [showBulkStateDrop, setShowBulkStateDrop] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Firms data
  const [firms, setFirms] = useState<Firm[]>([]);
  const [allHierarchyLevels, setAllHierarchyLevels] = useState<HierarchyLevel[]>([]);

  // Firm management
  const [showFirmModal, setShowFirmModal] = useState(false);
  const [editingFirmId, setEditingFirmId] = useState<string | null>(null);
  const [firmForm, setFirmForm] = useState<FirmFormData>(EMPTY_FIRM_FORM);
  const [savingFirm, setSavingFirm] = useState(false);
  const [showFirmStateDrop, setShowFirmStateDrop] = useState(false);
  const [firmDetailId, setFirmDetailId] = useState<string | null>(null);
  const [deactivateFirmConfirm, setDeactivateFirmConfirm] = useState<string | null>(null);
  const [firmLevelEdits, setFirmLevelEdits] = useState<{ level_number: number; label: string }[]>([]);
  const [showHierarchySection, setShowHierarchySection] = useState(false);
  const [firmStatusFilter, setFirmStatusFilter] = useState<"active" | "pending" | "inactive" | "all">("active");

  // Bulk import
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importColumns, setImportColumns] = useState<string[]>([]);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importPreview, setImportPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Activity log
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  /* ── fetch data ──────────────────────────────────────── */

  const fetchInternalUsers = useCallback(async () => {
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, position, department, location, profile_picture_url, availability")
      .eq("org_id", ORG_ID)
      .eq("status", "active")
      .eq("user_type", "internal")
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
    // Admin can see all statuses
    let query = supabase
      .from("external_contacts")
      .select("id, name, email, phone, specialty, specialty_other, states, company_name, firm_id, user_id, status, hierarchy_level_id, reports_to_id, region, market")
      .eq("org_id", ORG_ID)
      .order("name");

    if (externalStatusFilter !== "all") {
      query = query.eq("status", externalStatusFilter);
    }

    const { data: contacts } = await query;
    if (!contacts || contacts.length === 0) { setExternalContacts([]); return; }

    const firmIds = [...new Set(contacts.filter((c) => c.firm_id).map((c) => c.firm_id!))];
    const firmNameMap = new Map<string, string>();
    if (firmIds.length > 0) {
      const { data: firmRows } = await supabase.from("firms").select("id, name").in("id", firmIds);
      for (const f of firmRows ?? []) firmNameMap.set(f.id, f.name);
    }

    setExternalContacts(
      (() => {
        const contactNameMap = new Map<string, string>();
        for (const c of contacts) contactNameMap.set(c.id, c.name);
        return contacts.map((c) => ({
          ...c,
          user_id: c.user_id ?? null,
          firm_name: c.firm_id ? (firmNameMap.get(c.firm_id) ?? c.company_name) : c.company_name,
          hierarchy_level_id: c.hierarchy_level_id ?? null,
          reports_to_id: c.reports_to_id ?? null,
          region: c.region ?? null,
          market: c.market ?? null,
          reports_to_name: c.reports_to_id ? (contactNameMap.get(c.reports_to_id) ?? null) : null,
        }));
      })()
    );
  }, [externalStatusFilter]);

  const fetchFirms = useCallback(async () => {
    let query = supabase
      .from("firms")
      .select("id, name, contact_name, contact_email, contact_phone, states, website, entity_type, year_established, city, state, rating, status")
      .eq("org_id", ORG_ID)
      .order("name");
    const { data } = await query;
    setFirms(data ?? []);
  }, []);

  const fetchHierarchyLevels = useCallback(async () => {
    const { data } = await supabase
      .from("firm_hierarchy_levels")
      .select("id, firm_id, level_number, label")
      .order("level_number");
    setAllHierarchyLevels(data ?? []);
  }, []);

  /* ── firm CRUD ──────────────────────────────────────── */

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
      const { data: inserted } = await supabase.from("firms").insert({ ...payload, org_id: ORG_ID, status: "active" }).select("id").single();
      firmId = inserted?.id ?? null;
    }
    if (firmId) {
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
    fetchExternalContacts();
  };

  const handleDeactivateFirm = async (id: string) => {
    await supabase.from("external_contacts").update({ firm_id: null, updated_at: new Date().toISOString() }).eq("firm_id", id);
    await supabase.from("firms").update({ status: "inactive", updated_at: new Date().toISOString() }).eq("id", id);
    setDeactivateFirmConfirm(null);
    setFirmDetailId(null);
    fetchFirms();
    fetchExternalContacts();
  };

  const handleReactivateFirm = async (id: string) => {
    await supabase.from("firms").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", id);
    fetchFirms();
  };

  const toggleFirmFormState = (s: string) =>
    setFirmForm((prev) => ({
      ...prev,
      states: prev.states.includes(s) ? prev.states.filter((x) => x !== s) : [...prev.states, s],
    }));

  /* ── bulk import ─────────────────────────────────────── */

  const IMPORT_FIELDS = [
    { key: "name", label: "Name", required: true },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "specialty", label: "Specialty" },
    { key: "company_name", label: "Company" },
    { key: "states", label: "States (comma-separated)" },
    { key: "region", label: "Region" },
    { key: "market", label: "Market" },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const XLSX = await import("xlsx");
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
      if (json.length === 0) return;
      setImportRows(json);
      setImportColumns(Object.keys(json[0]));
      // Auto-map columns by fuzzy name match
      const autoMap: Record<string, string> = {};
      for (const field of IMPORT_FIELDS) {
        const match = Object.keys(json[0]).find(
          (col) => col.toLowerCase().replace(/[^a-z]/g, "").includes(field.key.replace(/_/g, ""))
        );
        if (match) autoMap[field.key] = match;
      }
      setImportMapping(autoMap);
      setImportPreview(false);
      setImportResult(null);
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    setImporting(true);
    let success = 0;
    let errors = 0;
    const { data: { user } } = await supabase.auth.getUser();

    for (const row of importRows) {
      const name = (row[importMapping.name] ?? "").trim();
      if (!name) { errors++; continue; }

      const statesRaw = (row[importMapping.states] ?? "").trim();
      const states = statesRaw ? statesRaw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : null;

      const payload = {
        name,
        email: (row[importMapping.email] ?? "").trim() || null,
        phone: (row[importMapping.phone] ?? "").trim() || null,
        specialty: (row[importMapping.specialty] ?? "").trim() || "Other",
        company_name: (row[importMapping.company_name] ?? "").trim() || null,
        states,
        region: (row[importMapping.region] ?? "").trim() || null,
        market: (row[importMapping.market] ?? "").trim() || null,
        org_id: ORG_ID,
        status: "pending" as const,
        created_by: user?.id ?? null,
      };

      const { error } = await supabase.from("external_contacts").insert(payload);
      if (error) errors++;
      else success++;
    }

    setImporting(false);
    setImportResult({ success, errors });
    if (success > 0) fetchExternalContacts();
  };

  const fetchActivityLog = useCallback(async () => {
    setActivityLoading(true);
    const { data: logs } = await supabase
      .from("tpn_activity_log")
      .select("id, action, details, created_at, performed_by, contact_id")
      .eq("org_id", ORG_ID)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!logs || logs.length === 0) { setActivityLog([]); setActivityLoading(false); return; }

    // Resolve performer names
    const performerIds = [...new Set(logs.map((l) => l.performed_by).filter(Boolean))];
    const nameMap = new Map<string, string>();
    if (performerIds.length > 0) {
      const { data: users } = await supabase.from("users").select("id, full_name").in("id", performerIds);
      for (const u of users ?? []) nameMap.set(u.id, u.full_name);
    }

    setActivityLog(logs.map((l) => ({
      ...l,
      details: (l.details ?? {}) as Record<string, unknown>,
      performer_name: l.performed_by ? nameMap.get(l.performed_by) ?? "Unknown" : "System",
      contact_name: (l.details as Record<string, unknown>)?.contact_name as string | undefined,
    })));
    setActivityLoading(false);
  }, []);

  const logActivity = useCallback(async (action: string, details: Record<string, unknown>, contactId?: string, firmId?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("tpn_activity_log").insert({
      org_id: ORG_ID,
      contact_id: contactId ?? null,
      firm_id: firmId ?? null,
      action,
      details,
      performed_by: user?.id ?? null,
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchInternalUsers(), fetchExternalContacts(), fetchFirms(), fetchHierarchyLevels()]).then(() => setLoading(false));
  }, [fetchInternalUsers, fetchExternalContacts, fetchFirms]);

  // Reload external contacts when status filter changes
  useEffect(() => {
    fetchExternalContacts();
  }, [externalStatusFilter, fetchExternalContacts]);

  // Load activity log when that tab is selected
  useEffect(() => {
    if (tab === "activity-log") fetchActivityLog();
  }, [tab, fetchActivityLog]);

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
      await logActivity("edited", { contact_name: payload.name }, editingContactId);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: inserted } = await supabase.from("external_contacts").insert({
        ...payload,
        org_id: ORG_ID,
        created_by: user?.id ?? null,
        status: "pending",
      }).select("id").single();
      if (inserted) await logActivity("added", { contact_name: payload.name }, inserted.id);
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
    const contact = externalContacts.find((c) => c.id === id);
    await supabase
      .from("external_contacts")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("id", id);
    await logActivity("deactivated", { contact_name: contact?.name ?? "Unknown" }, id);
    setDeactivateConfirm(null);
    fetchExternalContacts();
  };

  const handleReactivateExternal = async (id: string) => {
    const contact = externalContacts.find((c) => c.id === id);
    await supabase
      .from("external_contacts")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", id);
    await logActivity("reactivated", { contact_name: contact?.name ?? "Unknown" }, id);
    fetchExternalContacts();
  };

  /* ── bulk operations ─────────────────────────────────── */

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredExternal.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredExternal.map((c) => c.id)));
    }
  };

  const handleBulkAssignFirm = async () => {
    if (!bulkFirmId || selectedIds.size === 0) return;
    setBulkProcessing(true);
    const firm = firms.find((f) => f.id === bulkFirmId);
    const ids = Array.from(selectedIds);

    await supabase
      .from("external_contacts")
      .update({ firm_id: bulkFirmId, company_name: firm?.name ?? null, updated_at: new Date().toISOString() })
      .in("id", ids);

    const names = externalContacts.filter((c) => selectedIds.has(c.id)).map((c) => c.name);
    await logActivity("bulk_assign_firm", { firm_name: firm?.name, contact_count: ids.length, contact_names: names }, undefined, bulkFirmId);

    setBulkProcessing(false);
    setBulkAction("");
    setBulkFirmId("");
    setSelectedIds(new Set());
    fetchExternalContacts();
  };

  const handleBulkUpdateStates = async () => {
    if (bulkStates.length === 0 || selectedIds.size === 0) return;
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);

    for (const id of ids) {
      const contact = externalContacts.find((c) => c.id === id);
      const currentStates = contact?.states ?? [];
      const newStates = bulkStatesMode === "replace"
        ? bulkStates
        : [...new Set([...currentStates, ...bulkStates])];

      await supabase
        .from("external_contacts")
        .update({ states: newStates, updated_at: new Date().toISOString() })
        .eq("id", id);
    }

    const names = externalContacts.filter((c) => selectedIds.has(c.id)).map((c) => c.name);
    await logActivity("bulk_update_states", { states: bulkStates, mode: bulkStatesMode, contact_count: ids.length, contact_names: names });

    setBulkProcessing(false);
    setBulkAction("");
    setBulkStates([]);
    setSelectedIds(new Set());
    fetchExternalContacts();
  };

  const handleBulkDeactivate = async () => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);

    await supabase
      .from("external_contacts")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .in("id", ids);

    const names = externalContacts.filter((c) => selectedIds.has(c.id)).map((c) => c.name);
    await logActivity("bulk_deactivate", { contact_count: ids.length, contact_names: names });

    setBulkProcessing(false);
    setBulkAction("");
    setSelectedIds(new Set());
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

  const filteredFirms = useMemo(() => {
    if (firmStatusFilter === "all") return firms;
    return firms.filter((f) => f.status === firmStatusFilter);
  }, [firms, firmStatusFilter]);

  const firmDetailContacts = useMemo(() => {
    if (!firmDetailId) return [];
    return externalContacts.filter((c) => c.firm_id === firmDetailId);
  }, [firmDetailId, externalContacts]);

  const firmDetail = useMemo(() => {
    if (!firmDetailId) return null;
    return firms.find((f) => f.id === firmDetailId) ?? null;
  }, [firmDetailId, firms]);

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

  const networkTabs: Tab[] = ["overview", "internal", "external", "firms", "analytics", "activity-log"];
  const adminTabs: Tab[] = ["partner-settings", "approval-rules", "service-types"];

  // Clear selection when switching tabs or filters
  const prevTab = tab;
  const clearBulk = () => { setSelectedIds(new Set()); setBulkAction(""); };

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
                onClick={() => { setShowImportModal(true); setImportRows([]); setImportColumns([]); setImportMapping({}); setImportPreview(false); setImportResult(null); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
              >
                Bulk Import
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
          {tab === "firms" && (
            <button
              onClick={openAddFirm}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              <span className="text-lg">+</span> Add Firm
            </button>
          )}
          {tab === "activity-log" && (
            <button
              onClick={fetchActivityLog}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
              style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
            >
              Refresh
            </button>
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
            {/* Status filter */}
            <select
              value={externalStatusFilter}
              onChange={(e) => { setExternalStatusFilter(e.target.value as "active" | "inactive" | "all"); clearBulk(); }}
              className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
              style={inputStyle}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All Statuses</option>
            </select>
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

          {/* Bulk action bar */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={selectAll}
              className="text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
              style={{ background: selectedIds.size === filteredExternal.length && filteredExternal.length > 0 ? "var(--accent)" : "var(--bg-hover)", color: selectedIds.size === filteredExternal.length && filteredExternal.length > 0 ? "#000" : "var(--text-secondary)" }}
            >
              {selectedIds.size === filteredExternal.length && filteredExternal.length > 0 ? "Deselect All" : "Select All"}
            </button>

            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {selectedIds.size > 0 ? `${selectedIds.size} selected · ` : ""}{filteredExternal.length} contact{filteredExternal.length !== 1 ? "s" : ""}
            </p>

            {selectedIds.size > 0 && (
              <>
                <button onClick={() => setBulkAction("assign-firm")} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: "#1e3a5f", color: "#60a5fa", border: "1px solid #2d4a6f" }}>
                  Assign to Firm
                </button>
                <button onClick={() => setBulkAction("update-states")} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: "#2d1b4e", color: "#a78bfa", border: "1px solid #3d2b5e" }}>
                  Update States
                </button>
                <button onClick={() => setBulkAction("deactivate")} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: "#4a1a1a", color: "#ef4444", border: "1px solid #5a2a2a" }}>
                  Deactivate
                </button>
                <button onClick={clearBulk} className="text-xs px-2 py-1 cursor-pointer" style={{ color: "var(--text-muted)" }}>
                  Cancel
                </button>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleExternal.map((contact) => {
              const displaySpecialty = contact.specialty === "Other" ? (contact.specialty_other ?? "Other") : contact.specialty;
              const contactStates = contact.states ?? [];
              const isSelected = selectedIds.has(contact.id);
              const isInactive = contact.status === "inactive";
              return (
                <div
                  key={contact.id}
                  className="rounded-xl p-4"
                  style={{ ...cardStyle, borderColor: isSelected ? "var(--accent)" : "var(--border-color)", opacity: isInactive ? 0.6 : 1 }}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelect(contact.id)}
                      className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors"
                      style={{ borderColor: isSelected ? "var(--accent)" : "var(--border-color)", background: isSelected ? "var(--accent)" : "transparent" }}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold truncate">{contact.name}</h3>
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: "#2d1b4e", color: "#a78bfa" }}>
                          {displaySpecialty}
                        </span>
                        {isInactive && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "#4a1a1a", color: "#ef4444" }}>INACTIVE</span>
                        )}
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
                      {contact.user_id ? (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full mr-1" style={{ background: "#1a3a2a", color: "#4ade80" }} title="Has portal access">PORTAL</span>
                      ) : (!isInactive && contact.email && (
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

                      {isInactive ? (
                        <button
                          onClick={() => handleReactivateExternal(contact.id)}
                          className="text-[10px] font-medium px-2 py-1 rounded-lg cursor-pointer"
                          style={{ background: "#1a3a2a", color: "#4ade80" }}
                        >
                          Reactivate
                        </button>
                      ) : deactivateConfirm === contact.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDeactivateExternal(contact.id)} className="px-2 py-1 rounded text-xs font-medium cursor-pointer" style={{ background: "#4a1a1a", color: "#ef4444" }}>Remove</button>
                          <button onClick={() => setDeactivateConfirm(null)} className="px-2 py-1 rounded text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>No</button>
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

      {/* ── Firms ───────────────────────────────────────── */}
      {!loading && tab === "firms" && (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-1">
              {(["all", "active", "pending", "inactive"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFirmStatusFilter(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors capitalize"
                  style={{
                    background: firmStatusFilter === s ? "var(--bg-hover)" : "transparent",
                    color: firmStatusFilter === s ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>
            <p className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
              {filteredFirms.length} firm{filteredFirms.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredFirms.map((firm) => {
              const contactCount = externalContacts.filter((c) => c.firm_id === firm.id).length;
              const statusColors: Record<string, { bg: string; color: string }> = {
                active: { bg: "#1a3a2a", color: "#4ade80" },
                pending: { bg: "#3a3520", color: "#facc15" },
                inactive: { bg: "#2a2a2a", color: "#888888" },
              };
              const sc = statusColors[firm.status] ?? statusColors.inactive;
              return (
                <div
                  key={firm.id}
                  className="rounded-xl p-4 cursor-pointer transition-colors"
                  style={{ ...cardStyle, opacity: firm.status === "inactive" ? 0.6 : 1 }}
                  onClick={() => setFirmDetailId(firm.id)}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-color)")}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold truncate">{firm.name}</h3>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                          style={{ background: sc.bg, color: sc.color }}
                        >
                          {firm.status}
                        </span>
                      </div>
                      {firm.entity_type && (
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{firm.entity_type}</p>
                      )}
                      {(firm.city || firm.state) && (
                        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                          {[firm.city, firm.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                      <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                        {contactCount} contact{contactCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditFirm(firm); }}
                      className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                      title="Edit"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {filteredFirms.length === 0 && (
            <div style={cardStyle} className="text-center py-8">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No firms found with status &quot;{firmStatusFilter}&quot;.</p>
            </div>
          )}
        </>
      )}

      {/* ── Analytics ───────────────────────────────────── */}
      {!loading && tab === "analytics" && (
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
                if (hasBoth) { bg = "#1a3a2a"; text = "#4ade80"; title = `${s}: Internal + External`; }
                else if (hasTeam) { bg = "#1a2a3a"; text = "#60a5fa"; title = `${s}: Internal licensed`; }
                else if (hasExternal) { bg = "#2d1b4e"; text = "#a78bfa"; title = `${s}: External coverage`; }
                return (
                  <span key={s} title={title} className="text-[10px] font-semibold px-2 py-1 rounded cursor-default" style={{ background: bg, color: text, minWidth: 32, textAlign: "center" }}>{s}</span>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "#1a3a2a" }} /><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Both</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "#1a2a3a" }} /><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Internal</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "#2d1b4e" }} /><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>External</span></div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "var(--bg-hover)" }} /><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>None</span></div>
            </div>
          </div>

          {/* Row 3: Specialty + Portal Access */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div style={cardStyle}>
              <h3 className="text-sm font-semibold mb-4">External Specialty Breakdown</h3>
              {externalContacts.length === 0 ? (
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No external contacts yet.</p>
              ) : (
                <div className="space-y-3">
                  {SPECIALTIES.map((spec) => {
                    const count = externalContacts.filter((c) => spec === "Other" ? c.specialty === "Other" : c.specialty === spec).length;
                    if (count === 0) return null;
                    return <AnalyticsBar key={spec} label={spec} count={count} total={externalContacts.length} color="#a78bfa" />;
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
                  return <AnalyticsBar key={f.id} label={f.name} count={count} total={externalContacts.length} color="#60a5fa" />;
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

      {/* ── Activity Log ──────────────────────────────────── */}
      {tab === "activity-log" && (
        <div>
          {activityLoading ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading activity...</p>
          ) : activityLog.length === 0 ? (
            <div style={cardStyle}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No activity recorded yet. Actions like adding, editing, deactivating, and bulk operations will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activityLog.map((entry) => {
                const actionLabels: Record<string, { label: string; color: string }> = {
                  added: { label: "Added", color: "#4ade80" },
                  edited: { label: "Edited", color: "#60a5fa" },
                  deactivated: { label: "Deactivated", color: "#ef4444" },
                  reactivated: { label: "Reactivated", color: "#4ade80" },
                  promoted: { label: "Granted Access", color: "#a78bfa" },
                  bulk_assign_firm: { label: "Bulk Assign Firm", color: "#60a5fa" },
                  bulk_update_states: { label: "Bulk Update States", color: "#a78bfa" },
                  bulk_deactivate: { label: "Bulk Deactivate", color: "#ef4444" },
                };
                const info = actionLabels[entry.action] ?? { label: entry.action, color: "var(--text-secondary)" };
                const time = new Date(entry.created_at);
                const timeStr = time.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

                // Build description
                let desc = "";
                const d = entry.details;
                if (d.contact_name) desc = String(d.contact_name);
                if (d.contact_count) desc = `${d.contact_count} contacts`;
                if (d.firm_name) desc += desc ? ` → ${d.firm_name}` : String(d.firm_name);
                if (d.states && Array.isArray(d.states)) desc += desc ? ` (${(d.states as string[]).join(", ")})` : (d.states as string[]).join(", ");

                return (
                  <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${info.color}20`, color: info.color }}>
                      {info.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{desc || "—"}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        by {entry.performer_name} · {timeStr}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Bulk Assign Firm Modal ─────────────────────── */}
      {bulkAction === "assign-firm" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) setBulkAction(""); }}>
          <div className="rounded-xl p-6 w-full max-w-md" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
            <h2 className="text-lg font-semibold mb-4">Assign {selectedIds.size} Contact{selectedIds.size !== 1 ? "s" : ""} to Firm</h2>
            <select value={bulkFirmId} onChange={(e) => setBulkFirmId(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer mb-4" style={inputStyle}>
              <option value="">Select a firm...</option>
              {firms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}{f.city && f.state ? ` — ${f.city}, ${f.state}` : ""}</option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setBulkAction("")} className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ color: "var(--text-muted)" }}>Cancel</button>
              <button onClick={handleBulkAssignFirm} disabled={!bulkFirmId || bulkProcessing} className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }}>
                {bulkProcessing ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Update States Modal ───────────────────── */}
      {bulkAction === "update-states" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) setBulkAction(""); }}>
          <div className="rounded-xl p-6 w-full max-w-md" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
            <h2 className="text-lg font-semibold mb-4">Update States for {selectedIds.size} Contact{selectedIds.size !== 1 ? "s" : ""}</h2>
            <div className="flex items-center gap-3 mb-3">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: bulkStatesMode === "add" ? "var(--accent)" : "var(--text-muted)" }}>
                <input type="radio" checked={bulkStatesMode === "add"} onChange={() => setBulkStatesMode("add")} /> Add to existing
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: bulkStatesMode === "replace" ? "var(--accent)" : "var(--text-muted)" }}>
                <input type="radio" checked={bulkStatesMode === "replace"} onChange={() => setBulkStatesMode("replace")} /> Replace all
              </label>
            </div>
            <div className="relative mb-4">
              <button onClick={() => setShowBulkStateDrop(!showBulkStateDrop)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer w-full text-left" style={inputStyle}>
                {bulkStates.length > 0 ? bulkStates.join(", ") : "Select states..."}
              </button>
              {showBulkStateDrop && (
                <div className="absolute top-full left-0 mt-1 z-40 rounded-lg p-2 max-h-60 overflow-y-auto w-full" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                  {bulkStates.length > 0 && (
                    <button onClick={() => setBulkStates([])} className="w-full text-left px-2 py-1 text-xs rounded cursor-pointer mb-1" style={{ color: "var(--accent)" }}>Clear all</button>
                  )}
                  <div className="grid grid-cols-6 gap-1">
                    {US_STATES.map((s) => (
                      <button key={s} onClick={() => setBulkStates((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])} className="px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors" style={{ background: bulkStates.includes(s) ? "var(--accent)" : "var(--bg-hover)", color: bulkStates.includes(s) ? "#000" : "var(--text-secondary)" }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => { setBulkAction(""); setBulkStates([]); setShowBulkStateDrop(false); }} className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ color: "var(--text-muted)" }}>Cancel</button>
              <button onClick={handleBulkUpdateStates} disabled={bulkStates.length === 0 || bulkProcessing} className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }}>
                {bulkProcessing ? "Updating..." : `${bulkStatesMode === "add" ? "Add" : "Replace"} States`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Deactivate Confirm ────────────────────── */}
      {bulkAction === "deactivate" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) setBulkAction(""); }}>
          <div className="rounded-xl p-6 w-full max-w-md" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
            <h2 className="text-lg font-semibold mb-2">Deactivate {selectedIds.size} Contact{selectedIds.size !== 1 ? "s" : ""}?</h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              These contacts will be marked inactive. You can reactivate them later from the Inactive status filter.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setBulkAction("")} className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ color: "var(--text-muted)" }}>Cancel</button>
              <button onClick={handleBulkDeactivate} disabled={bulkProcessing} className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ background: "#4a1a1a", color: "#ef4444", opacity: bulkProcessing ? 0.6 : 1 }}>
                {bulkProcessing ? "Deactivating..." : "Deactivate All"}
              </button>
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
      {/* ── Firm Detail Modal ────────────────────────── */}
      {firmDetailId && firmDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setFirmDetailId(null); }}
        >
          <div
            className="rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold">{firmDetail.name}</h2>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                  style={{
                    background: firmDetail.status === "active" ? "#1a3a2a" : firmDetail.status === "pending" ? "#3a3520" : "#2a2a2a",
                    color: firmDetail.status === "active" ? "#4ade80" : firmDetail.status === "pending" ? "#facc15" : "#888888",
                  }}
                >
                  {firmDetail.status}
                </span>
              </div>
              <button onClick={() => setFirmDetailId(null)} className="text-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>&#10005;</button>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              {firmDetail.entity_type && (
                <div>
                  <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>Entity Type</p>
                  <p className="text-sm">{firmDetail.entity_type}</p>
                </div>
              )}
              {(firmDetail.city || firmDetail.state) && (
                <div>
                  <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>Location</p>
                  <p className="text-sm">{[firmDetail.city, firmDetail.state].filter(Boolean).join(", ")}</p>
                </div>
              )}
              {firmDetail.contact_name && (
                <div>
                  <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>Contact Name</p>
                  <p className="text-sm">{firmDetail.contact_name}</p>
                </div>
              )}
              {firmDetail.contact_email && (
                <div>
                  <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>Email</p>
                  <a href={`mailto:${firmDetail.contact_email}`} className="text-sm" style={{ color: "var(--accent)" }}>{firmDetail.contact_email}</a>
                </div>
              )}
              {firmDetail.contact_phone && (
                <div>
                  <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>Phone</p>
                  <p className="text-sm">{firmDetail.contact_phone}</p>
                </div>
              )}
              {firmDetail.website && (
                <div>
                  <p className="text-[10px] font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>Website</p>
                  <a href={firmDetail.website.startsWith("http") ? firmDetail.website : `https://${firmDetail.website}`} target="_blank" rel="noopener noreferrer" className="text-sm" style={{ color: "var(--accent)" }}>{firmDetail.website}</a>
                </div>
              )}
            </div>

            {/* States covered */}
            {firmDetail.states && firmDetail.states.length > 0 && (
              <div className="mb-5">
                <p className="text-[10px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>States Covered</p>
                <div className="flex flex-wrap gap-1">
                  {firmDetail.states.map((s) => (
                    <span key={s} className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* People at this firm */}
            <div className="mb-5">
              <p className="text-xs font-semibold mb-2">People at this Firm ({firmDetailContacts.length})</p>
              {firmDetailContacts.length === 0 ? (
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No contacts linked to this firm yet.</p>
              ) : (
                <div className="space-y-2">
                  {firmDetailContacts.map((c) => {
                    const levelLabel = c.hierarchy_level_id ? allHierarchyLevels.find((l) => l.id === c.hierarchy_level_id)?.label : null;
                    return (
                      <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {levelLabel && <span>{levelLabel}</span>}
                            {c.reports_to_name && <span>Reports to: {c.reports_to_name}</span>}
                            {c.region && <span>Region: {c.region}</span>}
                            {c.market && <span>Market: {c.market}</span>}
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={{ background: "#2d1b4e", color: "#a78bfa" }}>
                          {c.specialty === "Other" ? (c.specialty_other ?? "Other") : c.specialty}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
              <button
                onClick={() => { setFirmDetailId(null); openEditFirm(firmDetail); }}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                style={{ background: "var(--accent)", color: "#000" }}
              >
                Edit Firm
              </button>
              {firmDetail.status === "inactive" ? (
                <button
                  onClick={() => handleReactivateFirm(firmDetail.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                  style={{ background: "#1a3a2a", color: "#4ade80" }}
                >
                  Reactivate
                </button>
              ) : deactivateFirmConfirm === firmDetail.id ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDeactivateFirm(firmDetail.id)} className="px-3 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ background: "#4a1a1a", color: "#ef4444" }}>Confirm Deactivate</button>
                  <button onClick={() => setDeactivateFirmConfirm(null)} className="px-3 py-2 rounded-lg text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setDeactivateFirmConfirm(firmDetail.id)}
                  className="px-4 py-2 rounded-lg text-sm cursor-pointer"
                  style={{ color: "#ef4444" }}
                >
                  Deactivate
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create/Edit Firm Modal ────────────────────── */}
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
              <h2 className="text-lg font-semibold">
                {editingFirmId ? "Edit Firm" : "Add Firm"}
              </h2>
              <button onClick={() => setShowFirmModal(false)} className="text-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>&#10005;</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Firm Name *</label>
                <input type="text" value={firmForm.name} onChange={(e) => setFirmForm({ ...firmForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Firm name..." />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Entity Type</label>
                  <select value={firmForm.entity_type} onChange={(e) => setFirmForm({ ...firmForm, entity_type: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    <option value="">Select...</option>
                    {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>City</label>
                  <input type="text" value={firmForm.city} onChange={(e) => setFirmForm({ ...firmForm, city: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="City..." />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>State</label>
                  <select value={firmForm.state} onChange={(e) => setFirmForm({ ...firmForm, state: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    <option value="">Select...</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Contact Name</label>
                  <input type="text" value={firmForm.contact_name} onChange={(e) => setFirmForm({ ...firmForm, contact_name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Primary contact..." />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Contact Email</label>
                  <input type="email" value={firmForm.contact_email} onChange={(e) => setFirmForm({ ...firmForm, contact_email: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="email@firm.com" />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Contact Phone</label>
                  <input type="text" value={firmForm.contact_phone} onChange={(e) => setFirmForm({ ...firmForm, contact_phone: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="(555) 123-4567" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Website</label>
                <input type="text" value={firmForm.website} onChange={(e) => setFirmForm({ ...firmForm, website: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="https://..." />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>States Covered</label>
                <div className="relative">
                  <button onClick={() => setShowFirmStateDrop(!showFirmStateDrop)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer w-full text-left" style={inputStyle}>
                    {firmForm.states.length > 0 ? firmForm.states.join(", ") : "Select states..."}
                  </button>
                  {showFirmStateDrop && (
                    <div className="absolute top-full left-0 mt-1 z-40 rounded-lg p-2 max-h-60 overflow-y-auto w-full" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                      {firmForm.states.length > 0 && (
                        <button onClick={() => setFirmForm({ ...firmForm, states: [] })} className="w-full text-left px-2 py-1 text-xs rounded cursor-pointer mb-1" style={{ color: "var(--accent)" }}>Clear all</button>
                      )}
                      <div className="grid grid-cols-6 gap-1">
                        {US_STATES.map((s) => (
                          <button key={s} onClick={() => toggleFirmFormState(s)} className="px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors" style={{ background: firmForm.states.includes(s) ? "var(--accent)" : "var(--bg-hover)", color: firmForm.states.includes(s) ? "#000" : "var(--text-secondary)" }}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Organization Levels */}
              <div>
                <button
                  onClick={() => {
                    setShowHierarchySection(!showHierarchySection);
                    if (!showHierarchySection && firmLevelEdits.length === 0) {
                      setFirmLevelEdits([{ level_number: 1, label: "" }]);
                    }
                  }}
                  className="text-xs font-medium cursor-pointer flex items-center gap-1"
                  style={{ color: "var(--accent)" }}
                >
                  {showHierarchySection ? "Hide" : "Show"} Organization Levels
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>({firmLevelEdits.filter((l) => l.label.trim()).length} defined)</span>
                </button>
                {showHierarchySection && (
                  <div className="mt-2 space-y-2">
                    {firmLevelEdits.map((level, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono w-5 text-center" style={{ color: "var(--text-muted)" }}>{idx + 1}</span>
                        <input
                          type="text"
                          value={level.label}
                          onChange={(e) => {
                            const updated = [...firmLevelEdits];
                            updated[idx] = { ...updated[idx], label: e.target.value };
                            setFirmLevelEdits(updated);
                          }}
                          className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
                          style={inputStyle}
                          placeholder={`Level ${idx + 1} label (e.g. Partner, Associate...)`}
                        />
                        <button
                          onClick={() => setFirmLevelEdits(firmLevelEdits.filter((_, i) => i !== idx))}
                          className="p-1 cursor-pointer rounded hover:bg-[var(--bg-hover)]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          &#10005;
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setFirmLevelEdits([...firmLevelEdits, { level_number: firmLevelEdits.length + 1, label: "" }])}
                      className="text-xs cursor-pointer px-2 py-1 rounded"
                      style={{ color: "var(--accent)" }}
                    >
                      + Add Level
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => setShowFirmModal(false)} className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ color: "var(--text-secondary)" }}>Cancel</button>
                <button onClick={handleSaveFirm} disabled={savingFirm || !firmForm.name.trim()} className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50" style={{ background: "var(--accent)", color: "#000" }}>
                  {savingFirm ? "Saving..." : editingFirmId ? "Save Changes" : "Add Firm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Firm state dropdown overlay ────────────────── */}
      {showFirmStateDrop && (
        <div className="fixed inset-0 z-30" onClick={() => setShowFirmStateDrop(false)} />
      )}

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
              {firms.length > 0 && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Attach to Firm</label>
                  <select value={externalForm.firm_id} onChange={(e) => setExternalForm({ ...externalForm, firm_id: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    <option value="">No firm (standalone contact)</option>
                    {firms.map((f) => <option key={f.id} value={f.id}>{f.name}{f.city && f.state ? ` — ${f.city}, ${f.state}` : ""}</option>)}
                  </select>
                </div>
              )}
              {!externalForm.firm_id && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Company Name (optional)</label>
                  <input type="text" value={externalForm.company_name} onChange={(e) => setExternalForm({ ...externalForm, company_name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Company or firm name..." />
                </div>
              )}
              {/* Role + Reports To (only when firm has hierarchy levels) */}
              {(() => {
                const firmLevels = externalForm.firm_id
                  ? allHierarchyLevels.filter((l) => l.firm_id === externalForm.firm_id).sort((a, b) => a.level_number - b.level_number)
                  : [];
                if (firmLevels.length === 0) return null;
                const selectedLevel = firmLevels.find((l) => l.id === externalForm.hierarchy_level_id);
                const levelAbove = selectedLevel
                  ? firmLevels.find((l) => l.level_number === selectedLevel.level_number - 1)
                  : null;
                const reportsToOptions = levelAbove
                  ? externalContacts.filter((c) => c.firm_id === externalForm.firm_id && c.hierarchy_level_id === levelAbove.id && c.id !== editingContactId)
                  : [];
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Role</label>
                      <select value={externalForm.hierarchy_level_id} onChange={(e) => setExternalForm({ ...externalForm, hierarchy_level_id: e.target.value, reports_to_id: "" })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                        <option value="">Select role...</option>
                        {firmLevels.map((l) => (<option key={l.id} value={l.id}>{l.label}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Reports To</label>
                      {selectedLevel && selectedLevel.level_number === 1 ? (
                        <div className="px-3 py-2 rounded-lg text-sm" style={{ ...inputStyle, color: "var(--text-muted)" }}>Top level — no one</div>
                      ) : reportsToOptions.length > 0 ? (
                        <select value={externalForm.reports_to_id} onChange={(e) => setExternalForm({ ...externalForm, reports_to_id: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                          <option value="">Select...</option>
                          {reportsToOptions.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                        </select>
                      ) : (
                        <div className="px-3 py-2 rounded-lg text-sm" style={{ ...inputStyle, color: "var(--text-muted)" }}>
                          {!selectedLevel ? "Select a role first" : "No one at the level above yet"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              {/* Region + Market */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Region</label>
                  <input type="text" value={externalForm.region} onChange={(e) => setExternalForm({ ...externalForm, region: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="e.g. Southeast, Region 3..." />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>Market</label>
                  <input type="text" value={externalForm.market} onChange={(e) => setExternalForm({ ...externalForm, market: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="e.g. Florida, DFW, Austin..." />
                </div>
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

      {/* ── Bulk Import Modal ───────────────────────────── */}
      {showImportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowImportModal(false); }}
        >
          <div
            className="rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Bulk Import External Contacts</h2>
              <button onClick={() => setShowImportModal(false)} className="text-lg cursor-pointer" style={{ color: "var(--text-muted)" }}>✕</button>
            </div>

            {/* Step 1: Upload */}
            {importRows.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                  Upload an Excel (.xlsx) or CSV file with contact data.
                </p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 rounded-lg text-sm font-medium cursor-pointer"
                  style={{ background: "var(--accent)", color: "#000" }}
                >
                  Choose File
                </button>
              </div>
            )}

            {/* Step 2: Column mapping */}
            {importRows.length > 0 && !importPreview && !importResult && (
              <div>
                <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                  Found {importRows.length} rows. Map your spreadsheet columns to contact fields:
                </p>
                <div className="space-y-3 mb-5">
                  {IMPORT_FIELDS.map((field) => (
                    <div key={field.key} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-40 shrink-0" style={{ color: "var(--text-secondary)" }}>
                        {field.label} {field.required && <span style={{ color: "#ef4444" }}>*</span>}
                      </span>
                      <select
                        value={importMapping[field.key] ?? ""}
                        onChange={(e) => setImportMapping({ ...importMapping, [field.key]: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                        style={inputStyle}
                      >
                        <option value="">— Skip —</option>
                        {importColumns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { setImportRows([]); setImportColumns([]); }}
                    className="px-4 py-2 rounded-lg text-sm cursor-pointer"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setImportPreview(true)}
                    disabled={!importMapping.name}
                    className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "#000" }}
                  >
                    Preview
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Preview */}
            {importPreview && !importResult && (
              <div>
                <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                  Preview (first 10 of {importRows.length} rows). All will be imported as <strong>pending</strong>.
                </p>
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        {IMPORT_FIELDS.filter((f) => importMapping[f.key]).map((f) => (
                          <th key={f.key} className="text-left px-2 py-1.5 font-semibold" style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-color)" }}>{f.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 10).map((row, i) => (
                        <tr key={i}>
                          {IMPORT_FIELDS.filter((f) => importMapping[f.key]).map((f) => (
                            <td key={f.key} className="px-2 py-1.5" style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                              {String(row[importMapping[f.key]] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setImportPreview(false)}
                    className="px-4 py-2 rounded-lg text-sm cursor-pointer"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Back to Mapping
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "#000" }}
                  >
                    {importing ? `Importing... (${importRows.length} rows)` : `Import ${importRows.length} Contacts`}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Results */}
            {importResult && (
              <div className="text-center py-6">
                <div className="text-3xl mb-3">{importResult.errors === 0 ? "✓" : "⚠"}</div>
                <p className="text-sm font-semibold mb-1">
                  {importResult.success} imported, {importResult.errors} failed
                </p>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                  All imported contacts are set to &quot;pending&quot; and need approval.
                </p>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer"
                  style={{ background: "var(--accent)", color: "#000" }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── sub-components ─────────────────────────────────────── */

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
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
