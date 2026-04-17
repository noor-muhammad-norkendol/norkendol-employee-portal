"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  useOnboardingClients,
  useCreateOnboardingClient,
  useUpdateOnboardingClient,
  useDeleteOnboardingClient,
} from "@/hooks/onboarder-kpi/useOnboardingClients";
import { useLogActivity } from "@/hooks/onboarder-kpi/useActivityLogs";
import { useLogStatusChange } from "@/hooks/onboarder-kpi/useStatusHistory";
import {
  useOnboarderKPIs,
  useWriteOnboarderKPISnapshots,
  calculateOnboarderMetrics,
} from "@/hooks/onboarder-kpi/useOnboarderKPIs";
import { useOKSupabase } from "@/hooks/onboarder-kpi/useSupabase";
import { useClaimLookup, type ClaimLookupMatch, type LookupField } from "@/hooks/useClaimLookup";
import ClaimMatchBanner from "@/components/ClaimMatchBanner";
import AddFirmModal from "@/components/tpn/AddFirmModal";
import AddExternalUserModal from "@/components/tpn/AddExternalUserModal";
import {
  OnboardingClient,
  CreateClientInput,
  OnboardingStatus,
  STATUS_LABELS,
  PERIL_OPTIONS,
  ONBOARD_TYPE_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  ALLOWED_TRANSITIONS,
  STAGE_TARGET_HOURS,
  ASSIGNMENT_TYPE_OPTIONS,
  STATUS_CLAIM_OPTIONS,
  REFERRAL_SOURCE_OPTIONS,
} from "@/types/onboarder-kpi";

/* ───── style constants (portal pattern) ───── */
const cardStyle: React.CSSProperties = {
  background: "var(--bg-surface)", borderRadius: 10, padding: "18px 22px",
  border: "1px solid var(--border-color)",
};
const inputStyle: React.CSSProperties = {
  background: "var(--bg-surface)", border: "1px solid var(--border-color)",
  color: "var(--text-primary)", borderRadius: 8, padding: "8px 12px",
  fontSize: 13, width: "100%", outline: "none",
};
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "var(--text-secondary)",
  display: "block", marginBottom: 4,
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };
const btnPrimary: React.CSSProperties = {
  background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6,
  padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const btnOutline: React.CSSProperties = {
  background: "transparent", color: "var(--text-primary)",
  border: "1px solid var(--border-color)", borderRadius: 6,
  padding: "6px 12px", fontSize: 12, cursor: "pointer",
};
const thStyle: React.CSSProperties = {
  padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
  textAlign: "left", borderBottom: "1px solid var(--border-color)", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  padding: "8px 12px", fontSize: 13, color: "var(--text-primary)",
  borderBottom: "1px solid var(--border-color)",
};

const HOUR_MS = 3_600_000;

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  new: { bg: "rgba(96,165,250,0.15)", color: "#60a5fa" },
  step_2: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
  step_3: { bg: "rgba(251,146,60,0.15)", color: "#fb923c" },
  final_step: { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
  on_hold: { bg: "rgba(148,163,184,0.15)", color: "#94a3b8" },
  completed: { bg: "rgba(74,222,128,0.15)", color: "#4ade80" },
  erroneous: { bg: "rgba(239,68,68,0.1)", color: "#f87171" },
  revised: { bg: "rgba(45,212,191,0.15)", color: "#2dd4bf" },
  abandoned: { bg: "rgba(148,163,184,0.1)", color: "#64748b" },
};

// Map sidebar items to status filters
const SIDEBAR_TO_STATUS: Record<string, OnboardingStatus | null> = {
  "New Clients": "new",
  "24hr Follow-Up": "step_2",
  "48hr Follow-Up": "step_3",
  "72hr Escalation": "final_step",
  "On Hold": "on_hold",
  "Completed": "completed",
};

function timeInStage(client: OnboardingClient): { hours: number; label: string; overdue: boolean } {
  const hours = (Date.now() - new Date(client.status_entered_at).getTime()) / HOUR_MS;
  const target = STAGE_TARGET_HOURS[client.status as keyof typeof STAGE_TARGET_HOURS];
  const overdue = target ? hours > target : false;
  if (hours < 1) return { hours, label: `${Math.round(hours * 60)}m`, overdue };
  if (hours < 24) return { hours, label: `${Math.round(hours)}h`, overdue };
  return { hours, label: `${(hours / 24).toFixed(1)}d`, overdue };
}

const EMPTY_FORM: CreateClientInput = {
  claim_number: null,
  file_number: null,
  loss_address: null,
  client_name: "",
  client_first_name: null,
  client_last_name: null,
  additional_policyholder_first: null,
  additional_policyholder_last: null,
  additional_policyholder_email: null,
  additional_policyholder_phone: null,
  referral_source: null,
  state: null,
  peril: null,
  onboard_type: null,
  email: null,
  phone: null,
  loss_street: null,
  loss_line2: null,
  loss_city: null,
  loss_state: null,
  loss_zip: null,
  loss_description: null,
  contractor_company: null,
  contractor_name: null,
  contractor_email: null,
  contractor_phone: null,
  source_email: null,
  assigned_user_id: null,
  assigned_user_name: null,
  assigned_pa_name: null,
  assignment_type: null,
  date_of_loss: null,
  insurance_company: null,
  policy_number: null,
  status_claim: null,
  supplement_notes: null,
  initial_hours: 0,
  notes: null,
};

type ViewMode = "pipeline" | "add" | "performance";

export default function OnboarderKPIPage() {
  const { supabase, userInfo } = useOKSupabase();
  const { data: allClients = [], isLoading } = useOnboardingClients();
  const createMut = useCreateOnboardingClient();
  const updateMut = useUpdateOnboardingClient();
  const deleteMut = useDeleteOnboardingClient();
  const logActivity = useLogActivity();
  const logStatusChange = useLogStatusChange();
  const teamKPIs = useOnboarderKPIs(allClients);
  const writeKPIs = useWriteOnboarderKPISnapshots();

  const [view, setView] = useState<ViewMode>("pipeline");
  const [statusFilter, setStatusFilter] = useState<OnboardingStatus>("new");
  const [form, setForm] = useState<CreateClientInput>({ ...EMPTY_FORM });
  const [editId, setEditId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  // Auto-generate file number when state is set (new clients only)
  const fileNumGenRef = useRef<string | null>(null); // tracks which state we already generated for
  useEffect(() => {
    const stateCode = (form.state || form.loss_state || "").toUpperCase().trim();
    if (!stateCode || stateCode.length !== 2 || editId || !supabase || !userInfo) return;
    if (form.file_number && fileNumGenRef.current === stateCode) return; // already generated for this state
    let cancelled = false;
    (async () => {
      try {
        const year = new Date().getFullYear();
        const prefix = `${stateCode}-`;
        const suffix = `-${year}`;
        const { data } = await supabase
          .from("onboarding_clients")
          .select("file_number")
          .eq("org_id", userInfo.orgId)
          .like("file_number", `${prefix}%${suffix}`)
          .order("file_number", { ascending: false })
          .limit(1);
        if (cancelled) return;
        let nextSeq = 1;
        if (data && data.length > 0 && data[0].file_number) {
          const match = data[0].file_number.match(/-(\d+)-/);
          if (match) nextSeq = parseInt(match[1], 10) + 1;
        }
        const fileNum = `${prefix}${String(nextSeq).padStart(5, "0")}${suffix}`;
        fileNumGenRef.current = stateCode;
        setForm((prev) => ({ ...prev, file_number: fileNum }));
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.state, form.loss_state, editId, supabase, userInfo?.orgId]);

  // AI Assist state
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [aiEmailText, setAiEmailText] = useState("");
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Contractor → TPN flow (uses shared Add Firm + Add External User modals)
  interface ContractorData { name: string; company: string; email: string; phone: string; state: string }
  const [pendingContractor, setPendingContractor] = useState<ContractorData | null>(null);
  const [showAddFirmModal, setShowAddFirmModal] = useState(false);
  const [showAddExternalModal, setShowAddExternalModal] = useState(false);
  const [newFirmId, setNewFirmId] = useState<string | null>(null);
  const [newFirmName, setNewFirmName] = useState<string | null>(null);
  const [tpnMessage, setTpnMessage] = useState<string | null>(null);

  function stripPhone(p: string): string {
    return (p || "").replace(/\D/g, "");
  }

  async function checkContractorInTPN(contractorData: ContractorData) {
    if (!supabase || !userInfo) return;
    const { company, email, phone } = contractorData;
    if (!phone && !email && !company) return;

    // 1. Search by phone (most reliable key)
    if (phone) {
      const digits = stripPhone(phone);
      const { data: allContacts } = await supabase
        .from("external_contacts")
        .select("id, name, company_name, email, phone")
        .eq("org_id", userInfo.orgId);
      if (allContacts) {
        const phoneMatch = allContacts.find((c) => stripPhone(c.phone || "") === digits);
        if (phoneMatch) {
          // Person exists — check if missing info to update
          const missingEmail = !phoneMatch.email && email;
          const missingPhone = !phoneMatch.phone && phone;
          if (missingEmail || missingPhone) {
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (missingEmail) updates.email = email;
            if (missingPhone) updates.phone = phone;
            await supabase.from("external_contacts").update(updates).eq("id", phoneMatch.id);
            setTpnMessage(`Updated ${phoneMatch.name}'s contact info in the partner network.`);
            setTimeout(() => setTpnMessage(null), 5000);
          }
          return; // person found, done
        }
      }
    }

    // 2. Search by email
    if (email) {
      const { data: emailMatches } = await supabase
        .from("external_contacts")
        .select("id, name")
        .eq("org_id", userInfo.orgId)
        .ilike("email", email);
      if (emailMatches && emailMatches.length > 0) return; // person found
    }

    // 3. No person found — check if firm/company exists
    setPendingContractor(contractorData);
    if (company) {
      const { data: firmMatches } = await supabase
        .from("firms")
        .select("id, name")
        .eq("org_id", userInfo.orgId)
        .ilike("name", company)
        .limit(1);
      if (firmMatches && firmMatches.length > 0) {
        // Firm exists, just need to add the person
        setNewFirmId(firmMatches[0].id);
        setNewFirmName(firmMatches[0].name);
        setShowAddExternalModal(true);
        return;
      }
    }

    // 4. Nothing found — start with Add Firm, then Add External User
    setShowAddFirmModal(true);
  }

  async function handleAIParse() {
    if (!aiEmailText.trim() || !supabase) return;
    setAiParsing(true);
    setAiError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/onboarder/parse-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ emailText: aiEmailText.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setAiError(json.error || "Failed to parse email");
        return;
      }
      const f = json.fields;
      setForm((prev) => ({
        ...prev,
        client_first_name: f.client_first_name || prev.client_first_name,
        client_last_name: f.client_last_name || prev.client_last_name,
        client_name: [f.client_first_name, f.client_last_name].filter(Boolean).join(" ") || prev.client_name,
        additional_policyholder_first: f.additional_policyholder_first || prev.additional_policyholder_first,
        additional_policyholder_last: f.additional_policyholder_last || prev.additional_policyholder_last,
        email: f.email || prev.email,
        additional_policyholder_email: f.additional_policyholder_email || prev.additional_policyholder_email,
        phone: f.phone || prev.phone,
        additional_policyholder_phone: f.additional_policyholder_phone || prev.additional_policyholder_phone,
        state: f.state || prev.state,
        date_of_loss: f.date_of_loss || prev.date_of_loss,
        loss_street: f.loss_street || prev.loss_street,
        loss_line2: f.loss_line2 || prev.loss_line2,
        loss_city: f.loss_city || prev.loss_city,
        loss_state: f.loss_state || prev.loss_state,
        loss_zip: f.loss_zip || prev.loss_zip,
        loss_description: f.loss_description || prev.loss_description,
        peril: f.peril || prev.peril,
        claim_number: f.claim_number || prev.claim_number,
        insurance_company: f.insurance_company || prev.insurance_company,
        policy_number: f.policy_number || prev.policy_number,
        status_claim: f.status_claim || prev.status_claim,
        onboard_type: f.onboard_type || prev.onboard_type,
        referral_source: f.referral_source || prev.referral_source,
        source_email: f.source_email || prev.source_email,
        contractor_company: f.contractor_company || prev.contractor_company,
        contractor_name: f.contractor_name || prev.contractor_name,
        contractor_email: f.contractor_email || prev.contractor_email,
        contractor_phone: f.contractor_phone || prev.contractor_phone,
        assigned_pa_name: f.assigned_pa_name || prev.assigned_pa_name,
        assignment_type: f.assignment_type || prev.assignment_type,
        supplement_notes: f.supplement_notes || prev.supplement_notes,
        notes: f.notes || prev.notes,
      }));
      setShowAIAssist(false);
      setAiEmailText("");
    } catch {
      setAiError("Network error — could not reach AI service");
    } finally {
      setAiParsing(false);
    }
  }

  // Shared claim lookup — search by whichever field has the most input
  const [lookupField, setLookupField] = useState<LookupField>('client_name');
  const lookupTerm = lookupField === 'claim_number' ? (form.claim_number || '')
    : lookupField === 'file_number' ? (form.file_number || '')
    : lookupField === 'address' ? (form.loss_address || '')
    : form.client_name;
  const { matches: claimMatches, searching: claimSearching, clear: clearLookup } = useClaimLookup({
    supabase, orgId: userInfo?.orgId, searchTerm: lookupTerm, searchField: lookupField, enabled: !editId,
  });

  function handleClaimAccept(match: ClaimLookupMatch) {
    setForm((prev) => ({
      ...prev,
      claim_number: match.claim_number || prev.claim_number,
      file_number: match.file_number || prev.file_number,
      loss_address: match.loss_address || prev.loss_address,
      client_name: match.client_name || prev.client_name,
      state: match.state || prev.state,
      peril: (match.peril as typeof prev.peril) || prev.peril,
      date_of_loss: match.loss_date || prev.date_of_loss,
      referral_source: match.referral_source || prev.referral_source,
      email: match.email || prev.email,
      phone: match.phone || prev.phone,
    }));
  }

  // Sidebar menu actions
  useEffect(() => {
    function handle(e: Event) {
      const { section, item } = (e as CustomEvent).detail;
      if (section !== "onboarder-kpi") return;
      const status = SIDEBAR_TO_STATUS[item];
      if (status) {
        setView("pipeline");
        setStatusFilter(status);
        setEditId(null);
        setExpandedClient(null);
      } else if (item === "Add Client") {
        setView("add");
        setEditId(null);
        setForm({ ...EMPTY_FORM, assigned_user_name: userInfo?.fullName || null });
        setFormError(null);
        fileNumGenRef.current = null;
      } else if (item === "Performance") {
        setView("performance");
      }
    }
    window.addEventListener("sidebar-action", handle);
    return () => window.removeEventListener("sidebar-action", handle);
  }, []);

  // Write KPI snapshots once per page load
  const kpiWritten = useRef(false);
  useEffect(() => {
    if (allClients.length > 0 && !kpiWritten.current && !writeKPIs.isPending) {
      kpiWritten.current = true;
      writeKPIs.mutate(teamKPIs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allClients.length]);

  // Filtered clients for current pipeline view
  const filteredClients = useMemo(
    () => allClients.filter((c) => c.status === statusFilter),
    [allClients, statusFilter]
  );

  // Pipeline counts for header
  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of allClients) counts[c.status] = (counts[c.status] || 0) + 1;
    return counts;
  }, [allClients]);

  // Personal metrics
  const myMetrics = useMemo(() => {
    if (!userInfo) return null;
    return calculateOnboarderMetrics(allClients, userInfo.userId, userInfo.fullName);
  }, [allClients, userInfo]);

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  async function generateFileNumber(stateCode: string): Promise<string> {
    const st = (stateCode || "XX").toUpperCase().slice(0, 2);
    const year = new Date().getFullYear();
    const prefix = `${st}-`;
    const suffix = `-${year}`;
    // Find the highest existing file number for this state+year
    const { data } = await supabase
      .from("onboarding_clients")
      .select("file_number")
      .eq("org_id", userInfo?.orgId || "")
      .like("file_number", `${prefix}%${suffix}`)
      .order("file_number", { ascending: false })
      .limit(1);
    let nextSeq = 1;
    if (data && data.length > 0 && data[0].file_number) {
      const match = data[0].file_number.match(/-(\d+)-/);
      if (match) nextSeq = parseInt(match[1], 10) + 1;
    }
    return `${prefix}${String(nextSeq).padStart(5, "0")}${suffix}`;
  }

  async function handleSubmit() {
    setFormError(null);
    // Auto-compute client_name from first/last
    const computedName = [form.client_first_name, form.client_last_name].filter(Boolean).join(" ").trim();
    if (!computedName) {
      setFormError("Policyholder Name is required.");
      return;
    }
    // Auto-compute loss_address from components
    const computedAddress = [form.loss_street, form.loss_line2, form.loss_city, form.loss_state, form.loss_zip].filter(Boolean).join(", ").trim();
    // Auto-generate file number for new clients
    let fileNumber = form.file_number;
    if (!editId && !fileNumber) {
      try {
        fileNumber = await generateFileNumber(form.state || form.loss_state || "XX");
      } catch {
        setFormError("Could not generate file number. Please try again.");
        return;
      }
    }
    const submitForm = {
      ...form,
      client_name: computedName,
      loss_address: computedAddress || form.loss_address,
      file_number: fileNumber,
    };
    // Capture contractor data before form clears
    const contractorData: ContractorData = {
      name: form.contractor_name || "",
      company: form.contractor_company || "",
      email: form.contractor_email || "",
      phone: form.contractor_phone || "",
      state: form.state || form.loss_state || "",
    };
    const isNewClient = !editId;
    const hasContractorInfo = !!(contractorData.phone || contractorData.email || contractorData.company);

    try {
      if (editId) {
        await updateMut.mutateAsync({ id: editId, ...submitForm });
        setEditId(null);
      } else {
        await createMut.mutateAsync(submitForm);
      }
      setForm({ ...EMPTY_FORM });
      setView("pipeline");
      setStatusFilter("new");
      // After successful save, check if contractor should be added to TPN
      if (isNewClient && hasContractorInfo) {
        checkContractorInTPN(contractorData);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setFormError(msg);
    }
  }

  function startEdit(client: OnboardingClient) {
    setForm({
      client_name: client.client_name,
      referral_source: client.referral_source || null,
      state: client.state || null,
      peril: client.peril || null,
      onboard_type: client.onboard_type || null,
      email: client.email || null,
      phone: client.phone || null,
      assigned_user_id: client.assigned_user_id || null,
      assigned_user_name: client.assigned_user_name || null,
      assigned_pa_name: client.assigned_pa_name || null,
      assignment_type: client.assignment_type || null,
      date_of_loss: client.date_of_loss || null,
      initial_hours: client.initial_hours || 0,
      notes: client.notes || null,
    });
    setEditId(client.id);
    setFormError(null);
    setView("add");
  }

  async function moveStatus(client: OnboardingClient, newStatus: OnboardingStatus) {
    try {
      await updateMut.mutateAsync({
        id: client.id,
        status: newStatus,
        status_entered_at: new Date().toISOString(),
        ...(newStatus === "completed" ? { completed_at: new Date().toISOString() } : {}),
        ...(newStatus === "abandoned" ? { abandoned_at: new Date().toISOString() } : {}),
      });
      await logStatusChange.mutateAsync({
        client_id: client.id,
        from_status: client.status,
        to_status: newStatus,
      });
      // Log activity for the status change
      await logActivity.mutateAsync({
        client_id: client.id,
        activity_type: "status_change",
        subject: `Status changed: ${STATUS_LABELS[client.status]} → ${STATUS_LABELS[newStatus]}`,
      });
    } catch {
      // Mutations handle their own errors via react-query
    }
  }

  if (isLoading) {
    return <div style={{ padding: 40, color: "var(--text-secondary)" }}>Loading onboarding clients...</div>;
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header + Stats */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Onboarder KPI</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            {allClients.length} client{allClients.length !== 1 ? "s" : ""} total
            {myMetrics ? ` · ${myMetrics.completionRate}% completion rate` : ""}
          </p>
        </div>

        {/* Pipeline summary badges */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["new", "step_2", "step_3", "final_step", "on_hold", "completed"] as OnboardingStatus[]).map((s) => {
            const sc = STATUS_COLORS[s];
            const count = pipelineCounts[s] || 0;
            const active = statusFilter === s && view === "pipeline";
            return (
              <button
                key={s}
                onClick={() => { setView("pipeline"); setStatusFilter(s); setExpandedClient(null); }}
                style={{
                  background: active ? sc.color : sc.bg,
                  color: active ? "#fff" : sc.color,
                  border: "none", borderRadius: 6, padding: "4px 10px",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}
              >
                {STATUS_LABELS[s]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ PIPELINE VIEW ═══ */}
      {view === "pipeline" && (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              {STATUS_LABELS[statusFilter]}
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>
                {filteredClients.length} client{filteredClients.length !== 1 ? "s" : ""}
              </span>
            </h2>
          </div>

          {filteredClients.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 40 }}>
              No clients in {STATUS_LABELS[statusFilter]}. Click Add Client to get started.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Client</th>
                    <th style={thStyle}>Referral</th>
                    <th style={thStyle}>State</th>
                    <th style={thStyle}>Peril</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Time in Stage</th>
                    <th style={thStyle}>Contract</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => {
                    const tis = timeInStage(client);
                    const sc = STATUS_COLORS[client.status] || STATUS_COLORS.new;
                    const transitions = ALLOWED_TRANSITIONS[client.status] || [];
                    const isExpanded = expandedClient === client.id;

                    return (
                      <React.Fragment key={client.id}>
                        <tr>
                          <td style={tdStyle}>
                            <div>
                              <span style={{ fontWeight: 600 }}>{client.client_name}</span>
                              {client.phone && (
                                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{client.phone}</span>
                              )}
                            </div>
                          </td>
                          <td style={tdStyle}>{client.referral_source || "—"}</td>
                          <td style={tdStyle}>{client.state || "—"}</td>
                          <td style={tdStyle}>{client.peril || "—"}</td>
                          <td style={tdStyle}>{client.onboard_type || "—"}</td>
                          <td style={{
                            ...tdStyle,
                            fontWeight: 600,
                            color: tis.overdue ? "#ef4444" : "var(--text-primary)",
                          }}>
                            {tis.label}
                            {tis.overdue && (
                              <span style={{ fontSize: 10, marginLeft: 4, color: "#ef4444" }}>OVERDUE</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              display: "inline-block", padding: "2px 8px", borderRadius: 4,
                              fontSize: 11, fontWeight: 600,
                              background: client.contract_status === "signed" ? "rgba(74,222,128,0.15)" : "rgba(148,163,184,0.1)",
                              color: client.contract_status === "signed" ? "#4ade80" : "var(--text-muted)",
                            }}>
                              {client.contract_status || "not_sent"}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button
                                style={{ ...btnOutline, fontSize: 11, padding: "3px 8px" }}
                                onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                              >
                                {isExpanded ? "Close" : "Move"}
                              </button>
                              <button
                                style={{ ...btnOutline, fontSize: 11, padding: "3px 8px" }}
                                onClick={() => startEdit(client)}
                              >
                                Edit
                              </button>
                              <button
                                style={{ ...btnOutline, fontSize: 11, padding: "3px 8px", color: "#ef4444", borderColor: "#ef4444" }}
                                onClick={() => { if (confirm("Delete this client?")) deleteMut.mutate(client.id); }}
                              >
                                x
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Expanded row: status transition buttons */}
                        {isExpanded && transitions.length > 0 && (
                          <tr>
                            <td colSpan={8} style={{ padding: "8px 12px", background: "var(--bg-page)", borderBottom: "1px solid var(--border-color)" }}>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 4 }}>Move to:</span>
                                {transitions.map((t) => {
                                  const tc = STATUS_COLORS[t] || STATUS_COLORS.new;
                                  return (
                                    <button
                                      key={t}
                                      onClick={() => { moveStatus(client, t); setExpandedClient(null); }}
                                      style={{
                                        background: tc.bg, color: tc.color, border: "none",
                                        borderRadius: 4, padding: "4px 10px", fontSize: 11,
                                        fontWeight: 600, cursor: "pointer",
                                      }}
                                    >
                                      {STATUS_LABELS[t]}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ ADD / EDIT CLIENT ═══ */}
      {view === "add" && (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                {editId ? "Edit Client" : "New Client"}
              </h2>
              <button
                style={{ ...btnOutline, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent)", borderColor: "var(--accent)" }}
                onClick={() => setShowAIAssist(true)}
              >
                <span style={{ fontSize: 16 }}>&#x1F916;</span> AI Assist
              </button>
            </div>
            {userInfo && (
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
                {userInfo.fullName}
              </span>
            )}
          </div>

          {/* AI Assist Modal */}
          {showAIAssist && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={(e) => { if (e.target === e.currentTarget) setShowAIAssist(false); }}>
              <div style={{ background: "var(--bg-surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 600, border: "1px solid var(--border-color)", maxHeight: "80vh", overflow: "auto" }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px" }}>AI Assist — Paste Onboarding Email</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
                  Paste the onboarding form submission email below and click Extract. The AI will pull out all the client data and fill the form.
                </p>
                <textarea
                  style={{ ...inputStyle, minHeight: 220, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
                  value={aiEmailText}
                  onChange={(e) => setAiEmailText(e.target.value)}
                  placeholder="Paste the full onboarding email here..."
                  autoFocus
                />
                {aiError && (
                  <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", marginTop: 8, color: "#ef4444", fontSize: 12 }}>
                    {aiError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                  <button style={btnOutline} onClick={() => { setShowAIAssist(false); setAiEmailText(""); setAiError(null); }}>Cancel</button>
                  <button
                    style={{ ...btnPrimary, opacity: !aiEmailText.trim() || aiParsing ? 0.5 : 1 }}
                    onClick={handleAIParse}
                    disabled={!aiEmailText.trim() || aiParsing}
                  >
                    {aiParsing ? "Extracting..." : "Extract & Fill Form"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Section: Policyholder ─── */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Policyholder</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Policyholder Name * — First</label>
              <input style={inputStyle} value={form.client_first_name || ""} onChange={(e) => { set("client_first_name", e.target.value || null); const full = [e.target.value, form.client_last_name].filter(Boolean).join(" "); set("client_name", full); if (full.length >= 3 && !form.claim_number && !form.file_number) setLookupField('client_name'); }} placeholder="First" />
            </div>
            <div>
              <label style={labelStyle}>Last</label>
              <input style={inputStyle} value={form.client_last_name || ""} onChange={(e) => { set("client_last_name", e.target.value || null); const full = [form.client_first_name, e.target.value].filter(Boolean).join(" "); set("client_name", full); }} placeholder="Last" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Additional Policyholder Name — First</label>
              <input style={inputStyle} value={form.additional_policyholder_first || ""} onChange={(e) => set("additional_policyholder_first", e.target.value || null)} placeholder="First" />
            </div>
            <div>
              <label style={labelStyle}>Last</label>
              <input style={inputStyle} value={form.additional_policyholder_last || ""} onChange={(e) => set("additional_policyholder_last", e.target.value || null)} placeholder="Last" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Policyholder Email *</label>
              <input style={inputStyle} value={form.email || ""} onChange={(e) => set("email", e.target.value || null)} placeholder="Enter email" />
            </div>
            <div>
              <label style={labelStyle}>Additional Policyholder Email</label>
              <input style={inputStyle} value={form.additional_policyholder_email || ""} onChange={(e) => set("additional_policyholder_email", e.target.value || null)} placeholder="Enter email" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Policyholder Phone *</label>
              <input style={inputStyle} value={form.phone || ""} onChange={(e) => set("phone", e.target.value || null)} placeholder="Enter phone" />
            </div>
            <div>
              <label style={labelStyle}>Additional Policyholder Phone</label>
              <input style={inputStyle} value={form.additional_policyholder_phone || ""} onChange={(e) => set("additional_policyholder_phone", e.target.value || null)} placeholder="Enter phone" />
            </div>
          </div>

          {/* ─── Section: Loss Info ─── */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Loss Info</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>What State is Loss Located? *</label>
              <input style={inputStyle} value={form.state || ""} onChange={(e) => set("state", e.target.value || null)} placeholder="2-letter state code" maxLength={2} />
            </div>
            <div>
              <label style={labelStyle}>Date of Loss *</label>
              <input type="date" style={inputStyle} value={form.date_of_loss || ""} onChange={(e) => set("date_of_loss", e.target.value || null)} />
            </div>
            <div>
              <label style={labelStyle}>Cause of Loss *</label>
              <select style={selectStyle} value={form.peril || ""} onChange={(e) => set("peril", e.target.value || null)}>
                <option value="">Select cause</option>
                {PERIL_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4, marginTop: 8 }}>Address of Loss *</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginBottom: 4 }}>
            <input style={inputStyle} value={form.loss_street || ""} onChange={(e) => set("loss_street", e.target.value || null)} placeholder="Street" />
            <input style={inputStyle} value={form.loss_line2 || ""} onChange={(e) => set("loss_line2", e.target.value || null)} placeholder="Address Line 2" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input style={inputStyle} value={form.loss_city || ""} onChange={(e) => set("loss_city", e.target.value || null)} placeholder="City" />
            <input style={inputStyle} value={form.loss_state || ""} onChange={(e) => set("loss_state", e.target.value || null)} placeholder="State" maxLength={2} />
            <input style={inputStyle} value={form.loss_zip || ""} onChange={(e) => set("loss_zip", e.target.value || null)} placeholder="ZIP" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Loss/Damage Description *</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={form.loss_description || ""} onChange={(e) => set("loss_description", e.target.value || null)} placeholder="Describe the loss or damage" maxLength={205} />
          </div>

          {/* Claim lookup banner (triggers from claim#, file#, or client name) */}
          <ClaimMatchBanner matches={claimMatches} searching={claimSearching} onAccept={handleClaimAccept} onDismiss={clearLookup} />

          {/* ─── Section: Parties ─── */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Parties</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Contractor Company Name</label>
              <input style={inputStyle} value={form.contractor_company || ""} onChange={(e) => set("contractor_company", e.target.value || null)} placeholder="Enter company name" />
            </div>
            <div>
              <label style={labelStyle}>Contractor Name</label>
              <input style={inputStyle} value={form.contractor_name || ""} onChange={(e) => set("contractor_name", e.target.value || null)} placeholder="Enter contractor name" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Contractor Email</label>
              <input style={inputStyle} value={form.contractor_email || ""} onChange={(e) => set("contractor_email", e.target.value || null)} placeholder="Enter email" />
            </div>
            <div>
              <label style={labelStyle}>Contractor Phone</label>
              <input style={inputStyle} value={form.contractor_phone || ""} onChange={(e) => set("contractor_phone", e.target.value || null)} placeholder="Enter phone" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Referral Source</label>
              <select style={selectStyle} value={REFERRAL_SOURCE_OPTIONS.includes(form.referral_source || "") ? form.referral_source || "" : form.referral_source ? "Other" : ""} onChange={(e) => { if (e.target.value === "Other") { set("referral_source", "Other"); } else { set("referral_source", e.target.value || null); } }}>
                <option value="">Select referral source</option>
                {REFERRAL_SOURCE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {(form.referral_source === "Other" || (form.referral_source && !REFERRAL_SOURCE_OPTIONS.includes(form.referral_source))) && (
              <div>
                <label style={labelStyle}>Specify Referral Source</label>
                <input style={inputStyle} value={form.referral_source === "Other" ? "" : form.referral_source || ""} onChange={(e) => set("referral_source", e.target.value || "Other")} placeholder="Type referral source" autoFocus />
              </div>
            )}
            <div>
              <label style={labelStyle}>Source Email</label>
              <input style={inputStyle} value={form.source_email || ""} onChange={(e) => set("source_email", e.target.value || null)} placeholder="Enter source email" />
            </div>
          </div>

          {/* ─── Section: Claim & Assignment ─── */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Claim & Assignment</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>What type of assignment? *</label>
              <select style={selectStyle} value={form.assignment_type || ""} onChange={(e) => set("assignment_type", e.target.value || null)}>
                <option value="">Select assignment type</option>
                {ASSIGNMENT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Insurance Company *</label>
              <input style={inputStyle} value={form.insurance_company || ""} onChange={(e) => set("insurance_company", e.target.value || null)} placeholder="Enter insurance company" />
            </div>
            <div>
              <label style={labelStyle}>Policy Number *</label>
              <input style={inputStyle} value={form.policy_number || ""} onChange={(e) => set("policy_number", e.target.value || null)} placeholder="Enter policy number" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Status of Claim *</label>
              <select style={selectStyle} value={form.status_claim || ""} onChange={(e) => set("status_claim", e.target.value || null)}>
                <option value="">Select claim status</option>
                {STATUS_CLAIM_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Claim Number</label>
              <input style={inputStyle} value={form.claim_number || ""} onChange={(e) => { set("claim_number", e.target.value || null); if (e.target.value.length >= 3) setLookupField('claim_number'); }} placeholder="Enter claim number" />
            </div>
            <div>
              <label style={labelStyle}>File Number {!editId && <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(auto-generated)</span>}</label>
              <input style={{ ...inputStyle, background: !editId ? "var(--bg-page)" : inputStyle.background, color: form.file_number ? "var(--text-primary)" : "var(--text-muted)" }} value={form.file_number || ""} readOnly={!editId} onChange={editId ? (e) => { set("file_number", e.target.value || null); if (e.target.value.length >= 3) setLookupField('file_number'); } : undefined} placeholder={!editId ? "Fills when state is entered" : "File #"} />
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>If Supplement Dollar Amount Paid/Notes</label>
            <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={form.supplement_notes || ""} onChange={(e) => set("supplement_notes", e.target.value || null)} placeholder="Enter supplement details or notes" />
          </div>

          {/* ─── Section: Assignment ─── */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Assignment</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Assigned User</label>
              <input style={inputStyle} value={form.assigned_user_name || ""} onChange={(e) => set("assigned_user_name", e.target.value || null)} placeholder="User name" />
            </div>
            <div>
              <label style={labelStyle}>Assigned PA</label>
              <input style={inputStyle} value={form.assigned_pa_name || ""} onChange={(e) => set("assigned_pa_name", e.target.value || null)} placeholder="PA name" />
            </div>
            <div>
              <label style={labelStyle}>Onboard Type</label>
              <select style={selectStyle} value={form.onboard_type || ""} onChange={(e) => set("onboard_type", e.target.value || null)}>
                <option value="">Select...</option>
                {ONBOARD_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* ─── Section: Notes ─── */}
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Notes</p>
          <div style={{ marginBottom: 20 }}>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.notes || ""} onChange={(e) => set("notes", e.target.value || null)} placeholder="Enter any additional notes..." />
          </div>

          {formError && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: "#ef4444", fontSize: 13 }}>
              {formError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnPrimary} onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "Saving..." : editId ? "Update Client" : "Save Entry"}
            </button>
            <button style={btnOutline} onClick={() => { setEditId(null); setForm({ ...EMPTY_FORM }); setFormError(null); setView("pipeline"); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ═══ TPN: Add Firm Modal ═══ */}
      {showAddFirmModal && pendingContractor && supabase && userInfo && (
        <AddFirmModal
          supabase={supabase}
          orgId={userInfo.orgId}
          onClose={() => { setShowAddFirmModal(false); setPendingContractor(null); }}
          onSaved={(firmId, firmName) => {
            setShowAddFirmModal(false);
            setNewFirmId(firmId);
            setNewFirmName(firmName);
            setShowAddExternalModal(true);
          }}
          defaultStatus="pending"
          prefill={{
            name: pendingContractor.company,
            contact_name: pendingContractor.name,
            contact_email: pendingContractor.email,
            contact_phone: pendingContractor.phone,
            state: pendingContractor.state?.toUpperCase(),
          }}
        />
      )}

      {/* ═══ TPN: Add External User Modal ═══ */}
      {showAddExternalModal && pendingContractor && supabase && userInfo && (
        <AddExternalUserModal
          supabase={supabase}
          orgId={userInfo.orgId}
          userId={userInfo.userId}
          onClose={() => { setShowAddExternalModal(false); setPendingContractor(null); setNewFirmId(null); setNewFirmName(null); }}
          onSaved={() => {
            setShowAddExternalModal(false);
            setPendingContractor(null);
            setTpnMessage(`${pendingContractor.name || "Contact"} added to partner network — pending admin approval.`);
            setNewFirmId(null);
            setNewFirmName(null);
            setTimeout(() => setTpnMessage(null), 5000);
          }}
          prefill={{
            name: pendingContractor.name,
            email: pendingContractor.email,
            phone: pendingContractor.phone,
            specialty: "General Contractor",
            company_name: pendingContractor.company,
            firm_id: newFirmId || undefined,
            firm_name: newFirmName || undefined,
            states: pendingContractor.state ? [pendingContractor.state.toUpperCase()] : [],
          }}
        />
      )}

      {/* ═══ TPN Success Message ═══ */}
      {tpnMessage && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, background: "rgba(74,222,128,0.15)", border: "1px solid #4ade80", borderRadius: 8, padding: "12px 20px", color: "#4ade80", fontSize: 13, fontWeight: 500, maxWidth: 400 }}>
          {tpnMessage}
        </div>
      )}

      {/* ═══ PERFORMANCE VIEW ═══ */}
      {view === "performance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Personal stats */}
          {myMetrics && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>My Performance</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
                {[
                  { label: "Completion Rate", value: `${myMetrics.completionRate}%` },
                  { label: "Avg Time to Complete", value: `${myMetrics.avgTimeToCompletionHours}h` },
                  { label: "Overdue Rate", value: `${myMetrics.overdueRate}%`, warn: myMetrics.overdueRate > 20 },
                  { label: "Conversion Rate", value: `${myMetrics.conversionRate}%` },
                  { label: "Entries/Day", value: String(myMetrics.entriesPerDay) },
                ].map((stat) => (
                  <div key={stat.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: stat.warn ? "#ef4444" : "var(--accent)" }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team rankings */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>Team Rankings</h2>
            {teamKPIs.onboarderRankings.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>No data yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Onboarder</th>
                      <th style={thStyle}>Entries</th>
                      <th style={thStyle}>Completed</th>
                      <th style={thStyle}>Completion %</th>
                      <th style={thStyle}>Avg Time (h)</th>
                      <th style={thStyle}>Overdue %</th>
                      <th style={thStyle}>Conversion %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamKPIs.onboarderRankings.map((r) => (
                      <tr key={r.onboarderId}>
                        <td style={tdStyle}>{r.rank}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{r.onboarderName}</td>
                        <td style={tdStyle}>{r.totalEntries}</td>
                        <td style={tdStyle}>{r.completed}</td>
                        <td style={tdStyle}>{r.completionRate}%</td>
                        <td style={tdStyle}>{r.avgTimeToCompletionHours}</td>
                        <td style={{ ...tdStyle, color: r.overdueRate > 20 ? "#ef4444" : "var(--text-primary)" }}>{r.overdueRate}%</td>
                        <td style={tdStyle}>{r.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Team summary */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>Team Summary</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { label: "Avg Completion Rate", value: `${teamKPIs.avgCompletionRate}%` },
                { label: "Avg Time to Complete", value: `${teamKPIs.avgTimeToCompletion}h` },
                { label: "Avg Overdue Rate", value: `${teamKPIs.avgOverdueRate}%` },
                { label: "Avg Conversion Rate", value: `${teamKPIs.avgConversionRate}%` },
              ].map((stat) => (
                <div key={stat.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
