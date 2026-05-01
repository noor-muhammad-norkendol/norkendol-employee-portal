"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { formatDate } from "@/lib/formatters";
import PendingApprovalsPanel from "@/components/PendingApprovalsPanel";

/* ── types ─────────────────────────────────────────────── */

interface UserRow {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: string;
  position: string | null;
  location: string | null;
  department: string | null;
  employee_id: string | null;
  hire_date: string | null;
  profile_picture_url: string | null;
  bio: string | null;
  time_zone: string | null;
  manager_id: string | null;
  primary_phone: string | null;
  work_phone: string | null;
  work_email: string | null;
  home_address: Record<string, string> | null;
  mailing_address: Record<string, string> | null;
  emergency_contact: Record<string, string> | null;
  social_media: Record<string, string> | null;
  experience: unknown[] | null;
  onboarding_status: string | null;
  rejection_reason: string | null;
  user_type: string;
  created_at: string;
}

interface PermissionRow {
  user_id: string;
  org_id: string;
  talent_network: boolean;
  crm_assignable: boolean;
  crm_office_staff: boolean;
  dashboard: boolean;
  applications: boolean;
  teams_chat: boolean;
  calendar: boolean;
  university: boolean;
  directory: boolean;
  documents: boolean;
  ai: boolean;
  talent_partner_network: boolean;
  compliance: boolean;
  crm: boolean;
  staff_management: boolean;
  pending_users: boolean;
  company_updates_admin: boolean;
  action_items_admin: boolean;
  notifications_admin: boolean;
  training_admin: boolean;
  departments_admin: boolean;
  ai_agents_admin: boolean;
  app_management: boolean;
  compliance_admin: boolean;
  claim_calculator_settings: boolean;
}

interface LicenseRow {
  id: string;
  user_id: string;
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

/* ── constants ─────────────────────────────────────────── */

const ROLES = ["user", "ep_user", "ep_admin", "admin", "super_admin", "system_admin"];
const STATUSES = ["pending", "active", "inactive", "rejected"];
const ONBOARDING = ["signup", "onboarding", "completed", "approved"];

const ROLE_LABELS: Record<string, string> = {
  user: "User",
  ep_user: "External Partner",
  ep_admin: "Partner Admin",
  admin: "Admin",
  super_admin: "Super Admin",
  system_admin: "System Admin",
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  system_admin: { bg: "color-mix(in srgb, var(--red) 14%, var(--pad))", text: "var(--red)" },
  super_admin: { bg: "color-mix(in srgb, var(--violet) 14%, var(--pad))", text: "var(--violet)" },
  admin: { bg: "color-mix(in srgb, var(--info) 18%, var(--pad))", text: "var(--info)" },
  ep_admin: { bg: "color-mix(in srgb, var(--green) 14%, var(--pad))", text: "var(--green)" },
  ep_user: { bg: "color-mix(in srgb, var(--amber) 14%, var(--pad))", text: "var(--amber)" },
  user: { bg: "var(--pad-elev)", text: "var(--text-faint)" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "color-mix(in srgb, var(--green) 14%, var(--pad))", text: "var(--green)" },
  pending: { bg: "color-mix(in srgb, var(--amber) 14%, var(--pad))", text: "var(--amber)" },
  inactive: { bg: "var(--pad-elev)", text: "var(--text-faint)" },
  rejected: { bg: "color-mix(in srgb, var(--red) 14%, var(--pad))", text: "var(--red)" },
};

const FEATURE_TOGGLES: { key: keyof PermissionRow; label: string; description: string }[] = [
  { key: "talent_network", label: "Talent Network", description: "Card shows up in Talent Partner Network listings" },
  { key: "crm_assignable", label: "CRM Assignable", description: "Can be assigned to claims in CRM" },
  { key: "crm_office_staff", label: "CRM Office Staff", description: "Full CRM access (office/admin)" },
];

const USER_SIDEBAR: { key: keyof PermissionRow; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "applications", label: "Applications" },
  { key: "teams_chat", label: "Teams Chat" },
  { key: "calendar", label: "Calendar" },
  { key: "university", label: "University" },
  { key: "directory", label: "Directory" },
  { key: "documents", label: "Documents" },
  { key: "ai", label: "AI" },
  { key: "talent_partner_network", label: "Talent Partner Network" },
  { key: "compliance", label: "Compliance" },
  { key: "crm", label: "CRM" },
];

const MANAGER_SIDEBAR: { key: keyof PermissionRow; label: string }[] = [
  { key: "staff_management", label: "Staff Management" },
  { key: "pending_users", label: "Pending Users" },
  { key: "company_updates_admin", label: "Company Updates" },
  { key: "action_items_admin", label: "Action Items" },
  { key: "notifications_admin", label: "Notifications" },
  { key: "training_admin", label: "Training" },
];

const ADMIN_SIDEBAR: { key: keyof PermissionRow; label: string }[] = [
  { key: "departments_admin", label: "Departments" },
  { key: "ai_agents_admin", label: "AI Agents" },
  { key: "app_management", label: "App Management" },
  { key: "compliance_admin", label: "Compliance Admin" },
  { key: "claim_calculator_settings", label: "Claim Calculator Settings" },
];

/* ── helpers ───────────────────────────────────────────── */

function Badge({ label, colors }: { label: string; colors: { bg: string; text: string } }) {
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize whitespace-nowrap"
      style={{ background: colors.bg, color: colors.text }}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}


function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ── main page ─────────────────────────────────────────── */

export default function UserManagementPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>Loading...</div>}>
      <UserManagementInner />
    </Suspense>
  );
}

function UserManagementInner() {
  const [supabase] = useState(() => createClient());
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"internal" | "external" | "approvals">("internal");

  // Edit modal state
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editPerms, setEditPerms] = useState<PermissionRow | null>(null);
  const [editLicenses, setEditLicenses] = useState<LicenseRow[]>([]);
  const [editBonds, setEditBonds] = useState<BondRow[]>([]);
  const [editStep, setEditStep] = useState<"profile" | "permissions" | "licenses" | "bonds">("profile");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // License/bond add forms
  const [newLicense, setNewLicense] = useState({ license_type: "", state: "", license_number: "", issuer: "", expiry_date: "" });
  const [newBond, setNewBond] = useState({ bond_type: "", state: "", bond_number: "", issuer: "", amount: "", expiry_date: "" });

  const ORG_ID = "00000000-0000-0000-0000-000000000001";

  // Pending approvals count for tab badge
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function fetchPendingCount() {
      const [pu, pc, pf] = await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "pending"),
        supabase.from("external_contacts").select("id", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "pending"),
        supabase.from("firms").select("id", { count: "exact", head: true }).eq("org_id", ORG_ID).eq("status", "pending"),
      ]);
      setPendingCount((pu.count ?? 0) + (pc.count ?? 0) + (pf.count ?? 0));
    }
    fetchPendingCount();
  }, []);

  /* ── fetch ──────────────────────────────────────────── */

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("org_id", ORG_ID)
      .order("created_at", { ascending: false });
    if (error) console.error("fetchUsers error:", error);
    setUsers((data as UserRow[]) ?? []);
    setLoading(false);
  }, []);

  const searchParams = useSearchParams();

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  /* ── deep-link from Compliance (e.g. ?edit=userId&tab=licenses) ── */
  useEffect(() => {
    const editId = searchParams.get("edit");
    const tab = searchParams.get("tab");
    if (editId && users.length > 0 && !editUser) {
      const user = users.find((u) => u.id === editId);
      if (user) {
        openEdit(user).then(() => {
          if (tab === "licenses" || tab === "bonds" || tab === "permissions" || tab === "profile") {
            setEditStep(tab);
          }
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, searchParams]);

  /* ── open edit modal ────────────────────────────────── */

  const openEdit = async (user: UserRow) => {
    setEditUser({ ...user });
    setEditStep("profile");

    const { data: perms } = await supabase
      .from("user_permissions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (perms) {
      setEditPerms(perms as PermissionRow);
    } else {
      const defaultPerms: PermissionRow = {
        user_id: user.id,
        org_id: user.org_id,
        talent_network: false,
        crm_assignable: false,
        crm_office_staff: false,
        dashboard: true,
        applications: true,
        teams_chat: true,
        calendar: true,
        university: true,
        directory: true,
        documents: true,
        ai: true,
        talent_partner_network: true,
        compliance: true,
        crm: true,
        staff_management: false,
        pending_users: false,
        company_updates_admin: false,
        action_items_admin: false,
        notifications_admin: false,
        training_admin: false,
        departments_admin: false,
        ai_agents_admin: false,
        app_management: false,
        compliance_admin: false,
        claim_calculator_settings: false,
      };
      setEditPerms(defaultPerms);
    }

    const { data: lics } = await supabase
      .from("licenses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setEditLicenses((lics as LicenseRow[]) ?? []);

    const { data: bnds } = await supabase
      .from("bonds")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setEditBonds((bnds as BondRow[]) ?? []);
  };

  const closeEdit = () => {
    setEditUser(null);
    setEditPerms(null);
    setEditLicenses([]);
    setEditBonds([]);
    setNewLicense({ license_type: "", state: "", license_number: "", issuer: "", expiry_date: "" });
    setNewBond({ bond_type: "", state: "", bond_number: "", issuer: "", amount: "", expiry_date: "" });
  };

  /* ── auto-generate employee ID ────────────────────── */

  const generateEmployeeId = async (location: string | null): Promise<string | null> => {
    // Extract 2-letter state code from location (e.g., "Tampa, FL" → "FL")
    const stateMatch = location?.match(/\b([A-Z]{2})\b/);
    if (!stateMatch) return null;
    const stateCode = stateMatch[1];

    // Find highest employee number in the system (format: XX-NNN-YY)
    const { data } = await supabase
      .from("users")
      .select("employee_id")
      .not("employee_id", "is", null);

    let maxNum = 0;
    for (const row of data || []) {
      const m = (row.employee_id as string).match(/^[A-Z]{2}-(\d+)-\d{2}$/);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }

    const nextNum = maxNum + 1;
    const year = new Date().getFullYear().toString().slice(-2);
    return `${stateCode}-${nextNum}-${year}`;
  };

  /* ── save profile ───────────────────────────────────── */

  const saveProfile = async () => {
    if (!editUser) return;
    setSaving(true);

    // Auto-generate employee ID if empty and location has a state
    let empId = editUser.employee_id;
    if (!empId || empId.trim() === "") {
      const generated = await generateEmployeeId(editUser.location);
      if (generated) {
        empId = generated;
        setEditUser({ ...editUser, employee_id: generated });
      }
    }

    await supabase
      .from("users")
      .update({
        full_name: editUser.full_name,
        first_name: editUser.first_name,
        last_name: editUser.last_name,
        email: editUser.email,
        role: editUser.role,
        status: editUser.status,
        position: editUser.position,
        location: editUser.location,
        department: editUser.department,
        employee_id: empId,
        hire_date: editUser.hire_date || null,
        bio: editUser.bio,
        time_zone: editUser.time_zone,
        primary_phone: editUser.primary_phone,
        work_phone: editUser.work_phone,
        work_email: editUser.work_email,
        onboarding_status: editUser.onboarding_status,
        rejection_reason: editUser.rejection_reason,
      })
      .eq("id", editUser.id);
    setSaving(false);
    fetchUsers();
  };

  /* ── save permissions ───────────────────────────────── */

  const savePermissions = async () => {
    if (!editPerms) return;
    setSaving(true);
    const { user_id, org_id, ...flags } = editPerms;
    await supabase
      .from("user_permissions")
      .upsert({ user_id, org_id, ...flags });
    setSaving(false);
  };

  /* ── license CRUD ───────────────────────────────────── */

  const addLicense = async () => {
    if (!editUser || !newLicense.state) return;
    await supabase.from("licenses").insert({
      user_id: editUser.id,
      org_id: editUser.org_id,
      license_type: newLicense.license_type || null,
      state: newLicense.state,
      license_number: newLicense.license_number || null,
      issuer: newLicense.issuer || null,
      expiry_date: newLicense.expiry_date || null,
      status: "pending",
    });
    setNewLicense({ license_type: "", state: "", license_number: "", issuer: "", expiry_date: "" });
    const { data } = await supabase.from("licenses").select("*").eq("user_id", editUser.id).order("created_at", { ascending: false });
    setEditLicenses((data as LicenseRow[]) ?? []);
  };

  const updateLicenseStatus = async (id: string, status: string) => {
    if (!editUser) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("licenses").update({
      status,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    const { data } = await supabase.from("licenses").select("*").eq("user_id", editUser.id).order("created_at", { ascending: false });
    setEditLicenses((data as LicenseRow[]) ?? []);
  };

  const deleteLicense = async (id: string) => {
    if (!editUser) return;
    await supabase.from("licenses").delete().eq("id", id);
    const { data } = await supabase.from("licenses").select("*").eq("user_id", editUser.id).order("created_at", { ascending: false });
    setEditLicenses((data as LicenseRow[]) ?? []);
  };

  /* ── bond CRUD ──────────────────────────────────────── */

  const addBond = async () => {
    if (!editUser || !newBond.state) return;
    await supabase.from("bonds").insert({
      user_id: editUser.id,
      org_id: editUser.org_id,
      bond_type: newBond.bond_type || null,
      state: newBond.state,
      bond_number: newBond.bond_number || null,
      issuer: newBond.issuer || null,
      amount: newBond.amount ? parseFloat(newBond.amount) : null,
      expiry_date: newBond.expiry_date || null,
      status: "pending",
    });
    setNewBond({ bond_type: "", state: "", bond_number: "", issuer: "", amount: "", expiry_date: "" });
    const { data } = await supabase.from("bonds").select("*").eq("user_id", editUser.id).order("created_at", { ascending: false });
    setEditBonds((data as BondRow[]) ?? []);
  };

  const updateBondStatus = async (id: string, status: string) => {
    if (!editUser) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("bonds").update({
      status,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    const { data } = await supabase.from("bonds").select("*").eq("user_id", editUser.id).order("created_at", { ascending: false });
    setEditBonds((data as BondRow[]) ?? []);
  };

  const deleteBond = async (id: string) => {
    if (!editUser) return;
    await supabase.from("bonds").delete().eq("id", id);
    const { data } = await supabase.from("bonds").select("*").eq("user_id", editUser.id).order("created_at", { ascending: false });
    setEditBonds((data as BondRow[]) ?? []);
  };

  /* ── delete user ────────────────────────────────────── */

  const deleteUser = async (id: string) => {
    await supabase.from("user_permissions").delete().eq("user_id", id);
    await supabase.from("licenses").delete().eq("user_id", id);
    await supabase.from("bonds").delete().eq("user_id", id);
    await supabase.from("users").delete().eq("id", id);
    setDeleteConfirm(null);
    closeEdit();
    fetchUsers();
  };

  /* ── quick status toggle ───────────────────────────── */

  const toggleStatus = async (e: React.MouseEvent, user: UserRow) => {
    e.stopPropagation();
    const newStatus = user.status === "active" ? "inactive" : "active";
    await supabase.from("users").update({ status: newStatus }).eq("id", user.id);
    fetchUsers();
  };

  /* ── filter ─────────────────────────────────────────── */

  const filtered = users.filter((u) => {
    // Tab filter
    if (activeTab === "internal" && u.user_type !== "internal") return false;
    if (activeTab === "external" && u.user_type !== "external") return false;

    if (filterStatus !== "all" && u.status !== filterStatus) return false;
    if (filterRole !== "all" && u.role !== filterRole) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        u.full_name.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        (u.position ?? "").toLowerCase().includes(s) ||
        (u.department ?? "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  /* ── input helpers ─────────────────────────────────── */

  const inputStyle = {
    background: "var(--pad)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  };

  function Field({ label, value, onChange, type = "text", placeholder = "" }: {
    label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
  }) {
    return (
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-dim)" }}>{label}</label>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={inputStyle}
          placeholder={placeholder}
        />
      </div>
    );
  }

  function SelectField({ label, value, onChange, options }: {
    label: string; value: string; onChange: (v: string) => void; options: string[];
  }) {
    return (
      <div>
        <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-dim)" }}>{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
          style={inputStyle}
        >
          {options.map((o) => (
            <option key={o} value={o}>{ROLE_LABELS[o] || o.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>
    );
  }

  function Toggle({ label, description, checked, onChange }: {
    label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
  }) {
    return (
      <label className="flex items-center justify-between py-2 cursor-pointer group">
        <div>
          <span className="text-sm" style={{ color: "var(--text)" }}>{label}</span>
          {description && (
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className="w-9 h-5 rounded-full transition-colors shrink-0 ml-4 cursor-pointer"
          style={{ background: checked ? "var(--accent)" : "var(--pad-elev)" }}
        >
          <div
            className="w-3.5 h-3.5 rounded-full transition-transform"
            style={{
              background: "var(--cta-text)",
              transform: checked ? "translateX(18px)" : "translateX(3px)",
            }}
          />
        </button>
      </label>
    );
  }

  const APPROVAL_COLORS: Record<string, { bg: string; text: string }> = {
    pending: { bg: "color-mix(in srgb, var(--amber) 14%, var(--pad))", text: "var(--amber)" },
    approved: { bg: "color-mix(in srgb, var(--green) 14%, var(--pad))", text: "var(--green)" },
    rejected: { bg: "color-mix(in srgb, var(--red) 14%, var(--pad))", text: "var(--red)" },
  };

  /* ── render ─────────────────────────────────────────── */

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1
            className="page-title"
            style={{
              fontSize: "3rem",
              lineHeight: 1,
              letterSpacing: "-0.01em",
              fontFamily: "var(--font-display)",
              margin: 0,
            }}
          >
            <span
              style={{
                color: "var(--accent)",
                textShadow: "var(--accent-text-shadow)",
                fontWeight: 800,
              }}
            >
              User
            </span>{" "}
            <span style={{ color: "var(--text)", fontWeight: 500, opacity: 0.92 }}>
              Management
            </span>
          </h1>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--info) 18%, var(--pad))", color: "var(--info)" }}>
            {filtered.length} user{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        {activeTab !== "approvals" && (
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            style={{ background: "var(--accent)", color: "var(--cta-text)" }}
            onClick={() => {
              /* TODO: Add user modal */
              alert("Add user coming soon");
            }}
          >
            + Add Staff Member
          </button>
        )}
      </div>

      {/* Tabs — segmented buttons (TLS Phase pattern) */}
      <div className="flex flex-wrap gap-3 mb-4">
        {([
          { key: "internal", label: "Internal Users", token: "--accent" },
          { key: "external", label: "External Partners", token: "--violet" },
          { key: "approvals", label: "Pending Approvals", token: "--amber" },
        ] as const).map((tab) => {
          const tokenVar = `var(${tab.token})`;
          const count = tab.key === "approvals" ? pendingCount : users.filter((u) => u.user_type === tab.key).length;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-7 py-3.5 text-[14px] font-bold uppercase cursor-pointer transition-all flex items-center gap-2"
              style={{
                background: active
                  ? `color-mix(in srgb, ${tokenVar} 14%, var(--bg))`
                  : "var(--bg)",
                color: tokenVar,
                borderWidth: "2px",
                borderStyle: "solid",
                borderColor: tokenVar,
                borderRadius: 8,
                fontFamily: "var(--font-display)",
                letterSpacing: "0.10em",
                textShadow: active ? `0 0 8px color-mix(in srgb, ${tokenVar} 70%, transparent)` : undefined,
                boxShadow: active
                  ? `0 0 16px color-mix(in srgb, ${tokenVar} 40%, transparent)`
                  : "none",
              }}
            >
              {tab.label}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: `color-mix(in srgb, ${tokenVar} 16%, transparent)`,
                  color: tokenVar,
                  border: `1px solid color-mix(in srgb, ${tokenVar} 40%, transparent)`,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === "approvals" ? (
        <PendingApprovalsPanel />
      ) : (
      <>
      {/* Search + Filters */}
      <div className="flex items-center gap-4 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none w-64"
          style={inputStyle}
          placeholder="Search by name, email, position..."
        />

        <div className="flex flex-wrap gap-2 items-center">
          {([
            { key: "all", label: "All", token: "--accent" },
            { key: "pending", label: "Pending", token: "--amber" },
            { key: "active", label: "Active", token: "--green" },
            { key: "inactive", label: "Inactive", token: "--text-faint" },
            { key: "rejected", label: "Rejected", token: "--red" },
          ] as const).map((f) => {
            const tokenVar = `var(${f.token})`;
            const active = filterStatus === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className="text-[12px] font-bold uppercase cursor-pointer transition-all"
                style={{
                  padding: "10px 18px",
                  borderRadius: 8,
                  letterSpacing: "0.10em",
                  fontFamily: "var(--font-display)",
                  background: active
                    ? `color-mix(in srgb, ${tokenVar} 14%, var(--pad))`
                    : "var(--pad)",
                  color: active ? tokenVar : "var(--text-dim)",
                  borderWidth: "1.5px",
                  borderStyle: "solid",
                  borderColor: active ? tokenVar : "var(--border)",
                  textShadow: active
                    ? `0 0 8px color-mix(in srgb, ${tokenVar} 70%, transparent)`
                    : undefined,
                  boxShadow: active
                    ? `0 0 0 1px ${tokenVar} inset, 0 0 18px color-mix(in srgb, ${tokenVar} 50%, transparent), 0 0 36px color-mix(in srgb, ${tokenVar} 22%, transparent)`
                    : "none",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="w-px h-5" style={{ background: "var(--border)" }} />

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
          style={inputStyle}
        >
          <option value="all">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r] || r.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: "var(--pad-elev)", border: "1px solid var(--border)" }}
        >
          <p style={{ color: "var(--text-dim)" }}>
            {users.length === 0 ? "No users yet." : "No users match your filters."}
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--pad-elev)", border: "1px solid var(--border)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-faint)" }}></th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-faint)" }}>Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-faint)" }}>Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-faint)" }}>Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-faint)" }}>Department</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-faint)" }}>Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: "var(--text-faint)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="transition-colors cursor-pointer"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    opacity: u.status === "inactive" || u.status === "rejected" ? 0.5 : 1,
                    background: u.status === "pending"
                      ? `repeating-linear-gradient(45deg, transparent, transparent 10px, color-mix(in srgb, var(--red) 8%, transparent) 10px, color-mix(in srgb, var(--red) 8%, transparent) 20px)`
                      : undefined,
                  }}
                  onClick={() => openEdit(u)}
                >
                  {/* Avatar */}
                  <td className="px-4 py-3">
                    {u.profile_picture_url ? (
                      <img src={u.profile_picture_url} alt={u.full_name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold"
                        style={{ background: "var(--pad-elev)", color: "var(--text)" }}
                      >
                        {initials(u.full_name)}
                      </div>
                    )}
                  </td>

                  {/* Name */}
                  <td className="px-4 py-3 font-medium">{u.full_name}</td>

                  {/* Email */}
                  <td className="px-4 py-3">
                    <a
                      href={`mailto:${u.email}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: "var(--accent)" }}
                      className="hover:underline"
                    >
                      {u.email}
                    </a>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    <Badge label={ROLE_LABELS[u.role] || u.role} colors={ROLE_COLORS[u.role] ?? { bg: "var(--pad-elev)", text: "var(--text-faint)" }} />
                  </td>

                  {/* Department */}
                  <td className="px-4 py-3" style={{ color: "var(--text-dim)" }}>
                    {u.department || "—"}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => toggleStatus(e, u)}
                      className="cursor-pointer"
                      title={u.status === "active" ? "Click to deactivate" : "Click to activate"}
                    >
                      <Badge label={u.status === "active" ? "Active" : u.status === "inactive" ? "Deactivated" : u.status} colors={STATUS_COLORS[u.status] ?? { bg: "var(--pad-elev)", text: "var(--text-faint)" }} />
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg cursor-pointer transition-colors"
                        style={{ color: "var(--red)" }}
                        title="Edit user"
                        onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--red) 14%, var(--pad))"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      <button
                        onClick={() => {
                          if (deleteConfirm === u.id) {
                            deleteUser(u.id);
                          } else {
                            setDeleteConfirm(u.id);
                            setTimeout(() => setDeleteConfirm(null), 3000);
                          }
                        }}
                        className="p-1.5 rounded-lg cursor-pointer transition-colors"
                        style={{ color: "var(--red)" }}
                        title={deleteConfirm === u.id ? "Click again to confirm" : "Delete user"}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--red) 14%, var(--pad))"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      </>
      )}

      {/* ── Edit Modal ────────────────────────────────── */}
      {editUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={closeEdit}
        >
          <div
            className="rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            style={{ background: "var(--pad-elev)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 pb-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ background: "var(--pad-elev)", color: "var(--text)" }}
                >
                  {initials(editUser.full_name)}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{editUser.full_name}</h2>
                  <p className="text-xs" style={{ color: "var(--text-faint)" }}>{editUser.email}</p>
                </div>
              </div>
              <button onClick={closeEdit} className="text-lg cursor-pointer" style={{ color: "var(--text-faint)" }}>✕</button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-6 pt-4 pb-2">
              {(["profile", "permissions", "licenses", "bonds"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setEditStep(tab)}
                  className="px-4 py-2 rounded-lg text-sm font-medium capitalize cursor-pointer transition-colors"
                  style={{
                    background: editStep === tab ? "var(--pad-elev)" : "transparent",
                    color: editStep === tab ? "var(--text)" : "var(--text-faint)",
                  }}
                >
                  {tab}
                  {tab === "licenses" && editLicenses.length > 0 && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--info) 18%, var(--pad))", color: "var(--info)" }}>
                      {editLicenses.length}
                    </span>
                  )}
                  {tab === "bonds" && editBonds.length > 0 && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--info) 18%, var(--pad))", color: "var(--info)" }}>
                      {editBonds.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6 pt-2">

              {/* ── Profile Tab ──────────────────────────── */}
              {editStep === "profile" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="First Name" value={editUser.first_name ?? ""} onChange={(v) => setEditUser({ ...editUser, first_name: v })} />
                    <Field label="Last Name" value={editUser.last_name ?? ""} onChange={(v) => setEditUser({ ...editUser, last_name: v })} />
                  </div>
                  <Field label="Full Name" value={editUser.full_name} onChange={(v) => setEditUser({ ...editUser, full_name: v })} />
                  <Field label="Email" value={editUser.email} onChange={(v) => setEditUser({ ...editUser, email: v })} type="email" />
                  <div className="grid grid-cols-2 gap-4">
                    <SelectField label="Role" value={editUser.role} onChange={(v) => setEditUser({ ...editUser, role: v })} options={ROLES} />
                    <SelectField label="Status" value={editUser.status} onChange={(v) => setEditUser({ ...editUser, status: v })} options={STATUSES} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Position" value={editUser.position ?? ""} onChange={(v) => setEditUser({ ...editUser, position: v })} placeholder="e.g. Public Adjuster" />
                    <Field label="Department" value={editUser.department ?? ""} onChange={(v) => setEditUser({ ...editUser, department: v })} placeholder="e.g. Claims" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Location" value={editUser.location ?? ""} onChange={(v) => setEditUser({ ...editUser, location: v })} placeholder="e.g. Tampa, FL" />
                    <Field label="Employee ID" value={editUser.employee_id ?? ""} onChange={(v) => setEditUser({ ...editUser, employee_id: v })} placeholder="Auto-generated if blank" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Hire Date" value={editUser.hire_date ?? ""} onChange={(v) => setEditUser({ ...editUser, hire_date: v })} type="date" />
                    <Field label="Time Zone" value={editUser.time_zone ?? "America/New_York"} onChange={(v) => setEditUser({ ...editUser, time_zone: v })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Primary Phone" value={editUser.primary_phone ?? ""} onChange={(v) => setEditUser({ ...editUser, primary_phone: v })} placeholder="(555) 123-4567" />
                    <Field label="Work Phone" value={editUser.work_phone ?? ""} onChange={(v) => setEditUser({ ...editUser, work_phone: v })} />
                  </div>
                  <Field label="Work Email" value={editUser.work_email ?? ""} onChange={(v) => setEditUser({ ...editUser, work_email: v })} type="email" />
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-dim)" }}>Bio</label>
                    <textarea
                      value={editUser.bio ?? ""}
                      onChange={(e) => setEditUser({ ...editUser, bio: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                      style={inputStyle}
                      placeholder="Short bio..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <SelectField label="Onboarding Status" value={editUser.onboarding_status ?? "signup"} onChange={(v) => setEditUser({ ...editUser, onboarding_status: v })} options={ONBOARDING} />
                    <Field label="Rejection Reason" value={editUser.rejection_reason ?? ""} onChange={(v) => setEditUser({ ...editUser, rejection_reason: v })} placeholder="If rejected..." />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={saveProfile}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                      style={{ background: "var(--accent)", color: "var(--cta-text)", opacity: saving ? 0.5 : 1 }}
                    >
                      {saving ? "Saving..." : "Save Profile"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Permissions Tab ──────────────────────── */}
              {editStep === "permissions" && editPerms && (
                <div className="space-y-6">
                  {/* Feature toggles */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>Feature Toggles</h3>
                    <div className="rounded-lg p-3" style={{ background: "var(--pad)", border: "1px solid var(--border)" }}>
                      {FEATURE_TOGGLES.map((f) => (
                        <Toggle
                          key={f.key}
                          label={f.label}
                          description={f.description}
                          checked={!!editPerms[f.key]}
                          onChange={(v) => setEditPerms({ ...editPerms, [f.key]: v })}
                        />
                      ))}
                    </div>
                  </div>
                  {/* User sidebar */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>User Sidebar</h3>
                    <div className="rounded-lg p-3" style={{ background: "var(--pad)", border: "1px solid var(--border)" }}>
                      {USER_SIDEBAR.map((f) => (
                        <Toggle key={f.key} label={f.label} checked={!!editPerms[f.key]} onChange={(v) => setEditPerms({ ...editPerms, [f.key]: v })} />
                      ))}
                    </div>
                  </div>
                  {/* Manager sidebar */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>Manager Sidebar</h3>
                    <div className="rounded-lg p-3" style={{ background: "var(--pad)", border: "1px solid var(--border)" }}>
                      {MANAGER_SIDEBAR.map((f) => (
                        <Toggle key={f.key} label={f.label} checked={!!editPerms[f.key]} onChange={(v) => setEditPerms({ ...editPerms, [f.key]: v })} />
                      ))}
                    </div>
                  </div>
                  {/* Admin sidebar */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>Admin Sidebar</h3>
                    <div className="rounded-lg p-3" style={{ background: "var(--pad)", border: "1px solid var(--border)" }}>
                      {ADMIN_SIDEBAR.map((f) => (
                        <Toggle key={f.key} label={f.label} checked={!!editPerms[f.key]} onChange={(v) => setEditPerms({ ...editPerms, [f.key]: v })} />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={savePermissions}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                    style={{ background: "var(--accent)", color: "var(--cta-text)", opacity: saving ? 0.5 : 1 }}
                  >
                    {saving ? "Saving..." : "Save Permissions"}
                  </button>
                </div>
              )}

              {/* ── Licenses Tab ─────────────────────────── */}
              {editStep === "licenses" && (
                <div className="space-y-4">
                  {editLicenses.length === 0 && (
                    <p className="text-sm" style={{ color: "var(--text-faint)" }}>No licenses on file.</p>
                  )}
                  {editLicenses.map((lic) => (
                    <div key={lic.id} className="rounded-lg p-3 flex items-center justify-between" style={{ background: "var(--pad)", border: "1px solid var(--border)" }}>
                      <div>
                        <div className="text-sm font-medium">{lic.license_type || "License"} — {lic.state}</div>
                        <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                          {lic.license_number && `#${lic.license_number}`} {lic.issuer && `· ${lic.issuer}`} {lic.expiry_date && `· Exp ${formatDate(lic.expiry_date)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge label={lic.status} colors={APPROVAL_COLORS[lic.status] ?? { bg: "var(--pad-elev)", text: "var(--text-faint)" }} />
                        {lic.status === "pending" && (
                          <>
                            <button onClick={() => updateLicenseStatus(lic.id, "approved")} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ background: "color-mix(in srgb, var(--green) 14%, var(--pad))", color: "var(--green)" }}>Approve</button>
                            <button onClick={() => updateLicenseStatus(lic.id, "rejected")} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ background: "color-mix(in srgb, var(--red) 14%, var(--pad))", color: "var(--red)" }}>Reject</button>
                          </>
                        )}
                        <button onClick={() => deleteLicense(lic.id)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ color: "var(--red)" }}>Delete</button>
                      </div>
                    </div>
                  ))}
                  {/* Add form */}
                  <div className="rounded-lg p-3 space-y-3" style={{ background: "var(--pad)", border: "1px solid var(--border)" }}>
                    <h4 className="text-xs font-semibold" style={{ color: "var(--text-faint)" }}>Add License</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Type (e.g. PA License)" value={newLicense.license_type} onChange={(e) => setNewLicense({ ...newLicense, license_type: e.target.value })} className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                      <input placeholder="State *" value={newLicense.state} onChange={(e) => setNewLicense({ ...newLicense, state: e.target.value })} className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                      <input placeholder="License #" value={newLicense.license_number} onChange={(e) => setNewLicense({ ...newLicense, license_number: e.target.value })} className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                      <input placeholder="Issuer" value={newLicense.issuer} onChange={(e) => setNewLicense({ ...newLicense, issuer: e.target.value })} className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                      <input type="date" placeholder="Expiry" value={newLicense.expiry_date} onChange={(e) => setNewLicense({ ...newLicense, expiry_date: e.target.value })} className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                      <button onClick={addLicense} className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ background: "var(--accent)", color: "var(--cta-text)" }}>Add License</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Bonds Tab ────────────────────────────── */}
              {editStep === "bonds" && (
                <div className="space-y-4">
                  {editBonds.length === 0 && (
                    <p className="text-sm" style={{ color: "var(--text-faint)" }}>No bonds on file.</p>
                  )}
                  {editBonds.map((bond) => (
                    <div key={bond.id} className="rounded-lg p-3 flex items-center justify-between" style={{ background: "var(--pad)", border: "1px solid var(--border)" }}>
                      <div>
                        <div className="text-sm font-medium">{bond.bond_type || "Bond"} — {bond.state}</div>
                        <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                          {bond.bond_number && `#${bond.bond_number}`} {bond.issuer && `· ${bond.issuer}`} {bond.amount && `· $${bond.amount.toLocaleString()}`} {bond.expiry_date && `· Exp ${formatDate(bond.expiry_date)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge label={bond.status} colors={APPROVAL_COLORS[bond.status] ?? { bg: "var(--pad-elev)", text: "var(--text-faint)" }} />
                        {bond.status === "pending" && (
                          <>
                            <button onClick={() => updateBondStatus(bond.id, "approved")} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ background: "color-mix(in srgb, var(--green) 14%, var(--pad))", color: "var(--green)" }}>Approve</button>
                            <button onClick={() => updateBondStatus(bond.id, "rejected")} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ background: "color-mix(in srgb, var(--red) 14%, var(--pad))", color: "var(--red)" }}>Reject</button>
                          </>
                        )}
                        <button onClick={() => deleteBond(bond.id)} className="text-[10px] px-2 py-1 rounded cursor-pointer" style={{ color: "var(--red)" }}>Delete</button>
                      </div>
                    </div>
                  ))}
                  {/* Add form */}
                  <div className="rounded-lg p-3 space-y-3" style={{ background: "var(--pad)", border: "1px solid var(--border)" }}>
                    <h4 className="text-xs font-semibold" style={{ color: "var(--text-faint)" }}>Add Bond</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Type (e.g. Surety Bond)" value={newBond.bond_type} onChange={(e) => setNewBond({ ...newBond, bond_type: e.target.value })} className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                      <input placeholder="State *" value={newBond.state} onChange={(e) => setNewBond({ ...newBond, state: e.target.value })} className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                      <input placeholder="Bond #" value={newBond.bond_number} onChange={(e) => setNewBond({ ...newBond, bond_number: e.target.value })} className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                      <input placeholder="Issuer" value={newBond.issuer} onChange={(e) => setNewBond({ ...newBond, issuer: e.target.value })} className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                      <input placeholder="Amount" value={newBond.amount} onChange={(e) => setNewBond({ ...newBond, amount: e.target.value })} className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                      <input type="date" placeholder="Expiry" value={newBond.expiry_date} onChange={(e) => setNewBond({ ...newBond, expiry_date: e.target.value })} className="px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                      <button onClick={addBond} className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer col-span-2" style={{ background: "var(--accent)", color: "var(--cta-text)" }}>Add Bond</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
