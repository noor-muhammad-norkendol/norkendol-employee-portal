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
import { publishKPIEvent, buildClaimContext } from "@/hooks/onboarder-kpi/publishKPIEvent";
import {
  useOnboarderKPIs,
  useWriteOnboarderKPISnapshots,
  calculateOnboarderMetrics,
} from "@/hooks/onboarder-kpi/useOnboarderKPIs";
import { useOKSupabase } from "@/hooks/onboarder-kpi/useSupabase";
import { useClaimLookup, type ClaimLookupMatch, type LookupField } from "@/hooks/useClaimLookup";
import AddFirmModal from "@/components/tpn/AddFirmModal";
import AddExternalUserModal from "@/components/tpn/AddExternalUserModal";
import {
  OnboardingClient,
  CreateClientInput,
  OnboardingStatus,
  STATUS_LABELS,
  STAGE_TARGET_HOURS,
} from "@/types/onboarder-kpi";
import { HOUR_MS } from "./components/styles";

import PipelineHeader from "./components/PipelineHeader";
import WorkboardTable from "./components/WorkboardTable";
import type { PanelAction } from "./components/WorkboardTable";
import AddClientForm from "./components/AddClientForm";
import PerformanceView from "./components/PerformanceView";
import ClientDetailPanel from "./components/ClientDetailPanel";
import UrgencyBanner from "./components/UrgencyBanner";

/* ───── constants ───── */
const SIDEBAR_TO_STATUS: Record<string, OnboardingStatus | null> = {
  "New": "unassigned",
  "Initial Contact": "new",
  "24hr Follow-Up": "step_2",
  "48hr Follow-Up": "step_3",
  "72hr Escalation": "final_step",
  "On Hold": "on_hold",
  "Completed": "completed",
};

const EMPTY_FORM: CreateClientInput = {
  claim_number: null, file_number: null, loss_address: null,
  client_name: "", client_first_name: null, client_last_name: null,
  additional_policyholder_first: null, additional_policyholder_last: null,
  additional_policyholder_email: null, additional_policyholder_phone: null,
  referral_source: null, state: null, peril: null, onboard_type: null,
  email: null, phone: null,
  loss_street: null, loss_line2: null, loss_city: null, loss_state: null, loss_zip: null, loss_description: null,
  contractor_company: null, contractor_name: null, contractor_email: null, contractor_phone: null,
  source_email: null, assigned_user_id: null, assigned_user_name: null, assigned_pa_name: null,
  assignment_type: null, date_of_loss: null,
  insurance_company: null, policy_number: null, status_claim: null, supplement_notes: null,
  initial_hours: 0, notes: null,
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
  const [statusFilter, setStatusFilter] = useState<OnboardingStatus>("unassigned");
  const [form, setForm] = useState<CreateClientInput>({ ...EMPTY_FORM });
  const [editId, setEditId] = useState<string | null>(null);
  // Snapshot of the client at the moment Revise opened — used to diff for
  // the claim_revised KPI event so we know what fields changed.
  const [editOriginal, setEditOriginal] = useState<OnboardingClient | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  // Slide-out detail panel.
  // Stores the open claim's ID rather than a snapshot of the claim object,
  // so the derived `panelClient` below picks up fresh data after every
  // useOnboardingClients refetch. Holding a snapshot caused phase_completed
  // events to always publish from_phase = the status at panel-open, since
  // each Move-To click in the panel re-read the same frozen `client.status`.
  const [panelClientId, setPanelClientId] = useState<string | null>(null);
  const panelClient = panelClientId
    ? allClients.find((c) => c.id === panelClientId) ?? null
    : null;
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelAction, setPanelAction] = useState<PanelAction>(null);

  function openPanel(client: OnboardingClient, action: PanelAction) {
    setPanelClientId(client.id);
    setPanelAction(action);
    setPanelOpen(true);
  }
  function closePanel() {
    setPanelOpen(false);
    setTimeout(() => { setPanelClientId(null); setPanelAction(null); }, 250); // wait for animation
  }

  // Auto-generate file number when state is set (new clients only)
  const fileNumGenRef = useRef<string | null>(null);
  useEffect(() => {
    const stateCode = (form.state || form.loss_state || "").toUpperCase().trim();
    if (!stateCode || stateCode.length !== 2 || editId || !supabase || !userInfo) return;
    if (form.file_number && fileNumGenRef.current === stateCode) return;
    let cancelled = false;
    generateFileNumber(stateCode).then((fileNum) => {
      if (cancelled) return;
      fileNumGenRef.current = stateCode;
      setForm((prev) => ({ ...prev, file_number: fileNum }));
    }).catch(() => { /* silent */ });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.state, form.loss_state, editId, supabase, userInfo?.orgId]);

  // AI Assist state
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [aiEmailText, setAiEmailText] = useState("");
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Contractor → TPN flow
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
    if (phone) {
      const digits = stripPhone(phone);
      const last7 = digits.slice(-7);
      const { data: phoneContacts } = await supabase
        .from("external_contacts")
        .select("id, name, company_name, email, phone")
        .eq("org_id", userInfo.orgId)
        .not("phone", "is", null)
        .ilike("phone", `%${last7}%`);
      if (phoneContacts) {
        const phoneMatch = phoneContacts.find((c) => stripPhone(c.phone || "") === digits);
        if (phoneMatch) {
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
          return;
        }
      }
    }
    if (email) {
      const { data: emailMatches } = await supabase
        .from("external_contacts")
        .select("id, name")
        .eq("org_id", userInfo.orgId)
        .ilike("email", email);
      if (emailMatches && emailMatches.length > 0) return;
    }
    setPendingContractor(contractorData);
    if (company) {
      const { data: firmMatches } = await supabase
        .from("firms")
        .select("id, name")
        .eq("org_id", userInfo.orgId)
        .ilike("name", company)
        .limit(1);
      if (firmMatches && firmMatches.length > 0) {
        setNewFirmId(firmMatches[0].id);
        setNewFirmName(firmMatches[0].name);
        setShowAddExternalModal(true);
        return;
      }
    }
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

  // Shared claim lookup
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

  // Overdue count — clients past their stage target
  const overdueCount = useMemo(() => {
    const ACTIVE: OnboardingStatus[] = ["new", "step_2", "step_3", "final_step", "on_hold"];
    return allClients.filter((c) => {
      if (!ACTIVE.includes(c.status)) return false;
      const hours = (Date.now() - new Date(c.status_entered_at).getTime()) / HOUR_MS;
      const target = STAGE_TARGET_HOURS[c.status as keyof typeof STAGE_TARGET_HOURS];
      return target ? hours > target : false;
    }).length;
  }, [allClients]);

  function openAddClient() {
    setView("add");
    setEditId(null);
    setForm({ ...EMPTY_FORM, assigned_user_name: userInfo?.fullName || null });
    setFormError(null);
    fileNumGenRef.current = null;
  }

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
    const computedName = [form.client_first_name, form.client_last_name].filter(Boolean).join(" ").trim();
    if (!computedName) {
      setFormError("Policyholder Name is required.");
      return;
    }
    const computedAddress = [form.loss_street, form.loss_line2, form.loss_city, form.loss_state, form.loss_zip].filter(Boolean).join(", ").trim();
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

        // KPI event: claim_revised. Diff the submitted fields vs the
        // original client snapshot to know what actually changed. Publish
        // only if at least one field changed (skips no-op saves).
        if (editOriginal && userInfo?.orgId) {
          const fieldsChanged: string[] = [];
          const orig = editOriginal as unknown as Record<string, unknown>;
          const subm = submitForm as unknown as Record<string, unknown>;
          for (const key of Object.keys(subm)) {
            const a = subm[key];
            const b = orig[key];
            const aNorm = a === '' || a === undefined ? null : a;
            const bNorm = b === '' || b === undefined ? null : b;
            if (aNorm !== bNorm) fieldsChanged.push(key);
          }
          if (fieldsChanged.length > 0) {
            publishKPIEvent(supabase, {
              orgId: userInfo.orgId,
              metricKey: 'claim_revised',
              metadata: {
                user_id: userInfo.userId,
                file_number: editOriginal.file_number,
                fields_changed: fieldsChanged,
              },
              claimContext: {
                ...buildClaimContext(submitForm as unknown as Record<string, unknown>),
                user_name: userInfo.fullName,
                user_email: userInfo.email,
              },
            });
          }
        }

        setEditId(null);
        setEditOriginal(null);
      } else {
        await createMut.mutateAsync(submitForm);
      }
      setForm({ ...EMPTY_FORM });
      setView("pipeline");
      setStatusFilter("unassigned");
      if (isNewClient && hasContractorInfo) {
        checkContractorInTPN(contractorData);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setFormError(msg);
    }
  }

  function startEdit(client: OnboardingClient) {
    // Seed the form with EVERY persisted field on the client so Edit doesn't
    // appear to wipe name/address/contractor/etc. Previously only a subset was
    // copied which made the Edit modal look empty.
    setForm({
      ...EMPTY_FORM,
      // Policyholder
      client_first_name: client.client_first_name || null,
      client_last_name: client.client_last_name || null,
      client_name: client.client_name,
      additional_policyholder_first: client.additional_policyholder_first || null,
      additional_policyholder_last: client.additional_policyholder_last || null,
      additional_policyholder_email: client.additional_policyholder_email || null,
      additional_policyholder_phone: client.additional_policyholder_phone || null,
      email: client.email || null,
      phone: client.phone || null,
      // Loss info
      state: client.state || null,
      date_of_loss: client.date_of_loss || null,
      peril: client.peril || null,
      loss_street: client.loss_street || null,
      loss_line2: client.loss_line2 || null,
      loss_city: client.loss_city || null,
      loss_state: client.loss_state || null,
      loss_zip: client.loss_zip || null,
      loss_description: client.loss_description || null,
      loss_address: client.loss_address || null,
      // Parties
      contractor_company: client.contractor_company || null,
      contractor_name: client.contractor_name || null,
      contractor_email: client.contractor_email || null,
      contractor_phone: client.contractor_phone || null,
      referral_source: client.referral_source || null,
      source_email: client.source_email || null,
      // Claim & assignment
      assignment_type: client.assignment_type || null,
      insurance_company: client.insurance_company || null,
      policy_number: client.policy_number || null,
      status_claim: client.status_claim || null,
      claim_number: client.claim_number || null,
      file_number: client.file_number || null,
      supplement_notes: client.supplement_notes || null,
      // Assignment
      assigned_user_id: client.assigned_user_id || null,
      assigned_user_name: client.assigned_user_name || null,
      assigned_pa_name: client.assigned_pa_name || null,
      onboard_type: client.onboard_type || null,
      // Notes / housekeeping
      initial_hours: client.initial_hours || 0,
      notes: client.notes || null,
    });
    setEditId(client.id);
    setEditOriginal(client);
    setFormError(null);
    setView("add");
  }

  async function moveStatus(client: OnboardingClient, newStatus: OnboardingStatus) {
    try {
      const fromStatus = client.status;
      await Promise.all([
        updateMut.mutateAsync({
          id: client.id,
          status: newStatus,
          status_entered_at: new Date().toISOString(),
          ...(newStatus === "completed" ? { completed_at: new Date().toISOString() } : {}),
          ...(newStatus === "abandoned" ? { abandoned_at: new Date().toISOString() } : {}),
        }),
        logStatusChange.mutateAsync({
          client_id: client.id,
          from_status: fromStatus,
          to_status: newStatus,
        }),
        logActivity.mutateAsync({
          client_id: client.id,
          activity_type: "status_change",
          subject: `Status changed: ${STATUS_LABELS[fromStatus]} \u2192 ${STATUS_LABELS[newStatus]}`,
        }),
      ]);

      // KPI event publishing
      if (userInfo?.orgId) {
        const claimCtx = {
          ...buildClaimContext(client as unknown as Record<string, unknown>),
          user_name: userInfo.fullName,
          user_email: userInfo.email,
        };
        const baseMeta = {
          user_id: userInfo.userId,
          file_number: client.file_number,
          from_phase: fromStatus,
        };
        if (newStatus === 'abandoned') {
          publishKPIEvent(supabase, { orgId: userInfo.orgId, metricKey: 'claim_abandoned', metadata: baseMeta, claimContext: claimCtx });
        } else if (newStatus === 'erroneous') {
          publishKPIEvent(supabase, { orgId: userInfo.orgId, metricKey: 'claim_erroneous', metadata: baseMeta, claimContext: claimCtx });
        } else {
          publishKPIEvent(supabase, { orgId: userInfo.orgId, metricKey: 'phase_completed', metadata: { ...baseMeta, to_phase: newStatus }, claimContext: claimCtx });
        }
      }
    } catch {
      // Mutations handle their own errors via react-query
    }
  }

  if (isLoading) {
    return <div style={{ padding: 40, color: "var(--text-secondary)" }}>Loading onboarding clients...</div>;
  }

  // Access guard: only Intake department or super_admin tier can view this page.
  // Locked 2026-04-28 — onboarding is shared work between the two onboarders
  // (Reyneil + Ardee, dept='Intake') with super_admin oversight.
  const isOnboarder = userInfo?.department === 'Intake';
  const isSuperAdmin = userInfo?.role === 'super_admin';
  if (userInfo && !isOnboarder && !isSuperAdmin) {
    return (
      <div style={{ padding: 40, maxWidth: 600, margin: "60px auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
          Onboarder KPI is restricted
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          This page is for the Intake team and super-admin oversight. If you need access, contact a super admin to be added to the Intake department.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 24px" }}>
      {/* Header + Stats */}
      <PipelineHeader
        totalClients={allClients.length}
        completionRate={myMetrics?.completionRate ?? null}
        overdueCount={overdueCount}
        pipelineCounts={pipelineCounts}
        statusFilter={statusFilter}
        view={view}
        onSelectStatus={(s) => { setView("pipeline"); setStatusFilter(s); setExpandedClient(null); }}
        onAddClient={openAddClient}
        onPerformance={() => setView("performance")}
      />

      {/* ═══ PIPELINE VIEW ═══ */}
      {view === "pipeline" && (
        <>
        <UrgencyBanner allClients={allClients} onClickClient={(c) => openPanel(c, null)} />
        <WorkboardTable
          statusFilter={statusFilter}
          filteredClients={filteredClients}
          expandedClient={expandedClient}
          onToggleExpand={setExpandedClient}
          onEdit={startEdit}
          onDelete={(id) => deleteMut.mutate(id)}
          onMoveStatus={(client, status) => { moveStatus(client, status); setExpandedClient(null); }}
          onOpenPanel={openPanel}
        />
        </>
      )}

      {/* ═══ ADD / EDIT CLIENT ═══ */}
      {view === "add" && (
        <AddClientForm
          form={form}
          editId={editId}
          formError={formError}
          saving={createMut.isPending || updateMut.isPending}
          userName={userInfo?.fullName || null}
          showAIAssist={showAIAssist}
          aiEmailText={aiEmailText}
          aiParsing={aiParsing}
          aiError={aiError}
          onSetShowAIAssist={setShowAIAssist}
          onSetAiEmailText={setAiEmailText}
          onAIParse={handleAIParse}
          onSetAiError={setAiError}
          claimMatches={claimMatches}
          claimSearching={claimSearching}
          lookupField={lookupField}
          onSetLookupField={setLookupField}
          onClaimAccept={handleClaimAccept}
          onClearLookup={clearLookup}
          onSet={set}
          onSubmit={handleSubmit}
          onCancel={() => { setEditId(null); setForm({ ...EMPTY_FORM }); setFormError(null); setView("pipeline"); }}
        />
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
        <PerformanceView myMetrics={myMetrics} teamKPIs={teamKPIs} />
      )}

      {/* ═══ CLIENT DETAIL PANEL ═══ */}
      <ClientDetailPanel
        client={panelClient}
        open={panelOpen}
        onClose={closePanel}
        onEdit={(c) => { closePanel(); startEdit(c); }}
        onDelete={(id) => { deleteMut.mutate(id); closePanel(); }}
        initialAction={panelAction}
      />
    </div>
  );
}
