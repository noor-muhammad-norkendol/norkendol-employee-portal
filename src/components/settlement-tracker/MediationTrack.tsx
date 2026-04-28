"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useMediations,
  useArchivedMediations,
  useAllMediationsForLiquidity,
  useCreateMediation,
  useUpdateMediation,
  useArchiveMediation,
  useUnarchiveMediation,
  useDeleteMediation,
} from "@/hooks/settlement-tracker";
import { formatDate, truncate, formatCurrency } from "@/lib/formatters";
import { useSTSupabase } from "@/hooks/settlement-tracker";
import {
  MediationWithFile,
  Mediation,
  CreateMediationInput,
  MediationStatus,
  DisputeType,
  MEDIATION_STATUS_OPTIONS,
  DISPUTE_TYPE_OPTIONS,
  getDisputeLabels,
  getStatusDisplayName,
} from "@/types/settlement-tracker/mediation";
import { useLitigationFiles } from "@/hooks/settlement-tracker";
import { cardStyle, inputStyle, labelStyle, selectStyle, btnPrimary, btnOutline, overlayStyle } from "@/lib/styles";

/* ── styles (local overrides) ─────────────────── */

const thStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  borderBottom: "1px solid var(--border-color)",
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  color: "var(--text-primary)",
  borderBottom: "1px solid var(--border-color)",
};

const modalStyle: React.CSSProperties = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-color)",
  borderRadius: 12,
  width: "100%",
  maxWidth: 900,
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
};

/* ── helpers ──────────────────────────────────────────── */

const ADMIN_ROLES = ["admin", "super_admin", "system_admin"];

function getTrafficLightColor(nextActionDate?: string | null): string {
  if (!nextActionDate) return "#555";
  const due = new Date(nextActionDate);
  due.setHours(23, 59, 59, 999);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < -3) return "#ef4444";
  if (diffDays <= 3) return "#facc15";
  return "#4ade80";
}


function StatusBadge({ label, color }: { label: string; color: string }) {
  const bgMap: Record<string, string> = { green: "#1a3a2a", yellow: "#3a3520", red: "#4a1a1a", blue: "#1a2a4a", teal: "#1a3a3a", gray: "#2a2a2a" };
  const textMap: Record<string, string> = { green: "#4ade80", yellow: "#facc15", red: "#ef4444", blue: "#60a5fa", teal: "#5eead4", gray: "#888888" };
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: bgMap[color] || bgMap.gray, color: textMap[color] || textMap.gray }}>
      {label}
    </span>
  );
}

function getStatusColor(status: MediationStatus): string {
  switch (status) {
    case "Requested": return "blue";
    case "Scheduling": return "yellow";
    case "Set": return "green";
    case "Settled Before": return "teal";
    case "Settled": return "green";
    case "Impasse": return "red";
    default: return "gray";
  }
}

/* ================================================================
   MEDIATION TRACK — Main Component
   ================================================================ */

type MedTab = "active" | "historical" | "liquidity";

export default function MediationTrack({ onBack }: { onBack: () => void }) {
  const { userInfo } = useSTSupabase();
  const isAdmin = userInfo ? ADMIN_ROLES.includes(userInfo.role) : false;

  const [tab, setTab] = useState<MedTab>("active");
  const [disputeType, setDisputeType] = useState<DisputeType>("Mediation");
  const labels = getDisputeLabels(disputeType);

  const { data: activeMediations = [], isLoading: activeLoading } = useMediations();
  const { data: archivedMediations = [], isLoading: archiveLoading } = useArchivedMediations();

  // Filter by dispute type
  const activeFiltered = useMemo(() => activeMediations.filter((m) => m.dispute_type === disputeType), [activeMediations, disputeType]);
  const archivedFiltered = useMemo(() => archivedMediations.filter((m) => m.dispute_type === disputeType), [archivedMediations, disputeType]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedMediation, setSelectedMediation] = useState<MediationWithFile | null>(null);

  const displayData = tab === "active" ? activeFiltered : archivedFiltered;
  const isLoading = tab === "active" ? activeLoading : archiveLoading;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack}
            className="text-sm flex items-center gap-1"
            style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}>
            &larr; All Tracks
          </button>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            {labels.trackName} / {disputeType === "Mediation" ? "Arbitration" : "Mediation"}
          </h1>
        </div>
        <div className="flex gap-2 items-center">
          {/* Dispute type toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
            {DISPUTE_TYPE_OPTIONS.map((dt) => (
              <button key={dt} onClick={() => setDisputeType(dt)}
                className="px-3 py-1.5 text-xs font-medium"
                style={{
                  background: disputeType === dt ? "var(--accent)" : "transparent",
                  color: disputeType === dt ? "#fff" : "var(--text-secondary)",
                  border: "none", cursor: "pointer",
                }}>
                {dt}
              </button>
            ))}
          </div>
          {isAdmin && (
            <button style={btnPrimary} onClick={() => setShowCreateForm(true)}>
              + New {labels.fileType}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5">
        {([
          { key: "active" as MedTab, label: `Active (${activeFiltered.length})` },
          { key: "historical" as MedTab, label: `Historical (${archivedFiltered.length})` },
          ...(isAdmin ? [{ key: "liquidity" as MedTab, label: "Liquidity" }] : []),
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            style={{
              background: tab === t.key ? "var(--bg-hover)" : "transparent",
              color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)",
              border: "none",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {(tab === "active" || tab === "historical") && (
        <MediationDataGrid
          mediations={displayData}
          isLoading={isLoading}
          isAdmin={isAdmin}
          isHistorical={tab === "historical"}
          disputeType={disputeType}
          onSelect={setSelectedMediation}
        />
      )}

      {tab === "liquidity" && <MediationLiquidity disputeType={disputeType} />}

      {/* Create form modal */}
      {showCreateForm && (
        <MediationCreateModal
          disputeType={disputeType}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {/* Updates panel modal */}
      {selectedMediation && (
        <MediationUpdatesPanel
          mediation={selectedMediation}
          isAdmin={isAdmin}
          isHistorical={tab === "historical"}
          disputeType={disputeType}
          onClose={() => setSelectedMediation(null)}
        />
      )}
    </div>
  );
}

/* ================================================================
   DATA GRID
   ================================================================ */

function MediationDataGrid({
  mediations,
  isLoading,
  isAdmin,
  isHistorical,
  disputeType,
  onSelect,
}: {
  mediations: MediationWithFile[];
  isLoading: boolean;
  isAdmin: boolean;
  isHistorical: boolean;
  disputeType: DisputeType;
  onSelect: (m: MediationWithFile) => void;
}) {
  const labels = getDisputeLabels(disputeType);

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
      <div className="px-4 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        {mediations.length} {isHistorical ? "archived" : "active"} records
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="w-full text-sm" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th style={thStyle}>State</th>
              <th style={thStyle}>File #</th>
              <th style={thStyle}>Client</th>
              <th style={thStyle}>Contractor</th>
              <th style={thStyle}>{labels.practitioner}</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Attorney</th>
              <th style={{ ...thStyle, width: 30 }}>TL</th>
              <th style={thStyle}>Agreed</th>
              <th style={thStyle}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} style={{ ...tdStyle, textAlign: "center", padding: 32 }}>
                <span style={{ color: "var(--text-muted)" }}>Loading...</span>
              </td></tr>
            ) : mediations.length === 0 ? (
              <tr><td colSpan={10} style={{ ...tdStyle, textAlign: "center", padding: 32 }}>
                <span style={{ color: "var(--text-muted)" }}>No {labels.trackName.toLowerCase()} records found.</span>
              </td></tr>
            ) : (
              mediations.map((m) => (
                <tr key={m.id} onClick={() => onSelect(m)}
                  style={{ cursor: "pointer", borderBottom: "1px solid var(--border-color)" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <td style={tdStyle}>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: "var(--bg-hover)" }}>
                      {m.litigation_file?.state || "—"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: "var(--accent)", fontWeight: 600 }}>
                    {m.litigation_file?.file_number || "—"}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{m.litigation_file?.client_name || "—"}</td>
                  <td style={tdStyle}>{m.litigation_file?.referral_source || "—"}</td>
                  <td style={tdStyle}>{m.mediator || "—"}</td>
                  <td style={tdStyle}>
                    <StatusBadge
                      label={getStatusDisplayName(m.status, disputeType)}
                      color={getStatusColor(m.status)}
                    />
                  </td>
                  <td style={tdStyle}>
                    {m.attorney_name
                      ? `${m.attorney_name} (${m.attorney_engagement_type === "Assisting" ? "CRN" : "Onboarded"})`
                      : "—"}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#555" /* TODO: wire to latest update */ }} />
                  </td>
                  <td style={tdStyle}>{m.agreed_amount ? formatCurrency(m.agreed_amount) : "—"}</td>
                  <td style={tdStyle}>{truncate(m.notes, 25)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================
   CREATE MODAL — minimal form (Dispute Type + File Number)
   ================================================================ */

function MediationCreateModal({
  disputeType,
  onClose,
}: {
  disputeType: DisputeType;
  onClose: () => void;
}) {
  const { data: files = [] } = useLitigationFiles();
  const createMediation = useCreateMediation();
  const [selectedFileId, setSelectedFileId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFileId) return;
    await createMediation.mutateAsync({
      litigation_file_id: selectedFileId,
      dispute_type: disputeType,
      status: "Requested",
    });
    onClose();
  };

  const labels = getDisputeLabels(disputeType);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 pb-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            New {labels.fileType}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 pt-2">
          <div className="mb-4">
            <label style={labelStyle}>File Number *</label>
            <select style={selectStyle} value={selectedFileId} onChange={(e) => setSelectedFileId(e.target.value)} required>
              <option value="">Select a claim file...</option>
              {files.map((f) => (
                <option key={f.id} value={f.id}>{f.file_number} — {f.client_name}</option>
              ))}
            </select>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            Status will be set to &quot;Requested&quot;. Add details through updates after creation.
          </p>
          <div className="flex gap-3">
            <button type="submit" style={btnPrimary} disabled={createMediation.isPending}>
              {createMediation.isPending ? "Creating..." : `Create ${labels.fileType}`}
            </button>
            <button type="button" style={btnOutline} onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================================================================
   UPDATES PANEL — header + update history + status-conditional form
   ================================================================ */

function MediationUpdatesPanel({
  mediation,
  isAdmin,
  isHistorical,
  disputeType,
  onClose,
}: {
  mediation: MediationWithFile;
  isAdmin: boolean;
  isHistorical: boolean;
  disputeType: DisputeType;
  onClose: () => void;
}) {
  const { supabase, userInfo } = useSTSupabase();
  const updateMediation = useUpdateMediation();
  const archiveMediation = useArchiveMediation();
  const unarchiveMediation = useUnarchiveMediation();
  const labels = getDisputeLabels(disputeType);

  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showAttorneyForm, setShowAttorneyForm] = useState(false);

  // Editable fields for status-conditional update
  const [updateStatus, setUpdateStatus] = useState<MediationStatus>(mediation.status);
  const [updateNote, setUpdateNote] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");

  // Mediator details (shown for Scheduling/Set)
  const [mediatorName, setMediatorName] = useState(mediation.mediator || "");
  const [mediatorFirm, setMediatorFirm] = useState(mediation.mediation_firm || "");
  const [mediatorPhone, setMediatorPhone] = useState(mediation.mediator_phone || "");
  const [mediatorEmail, setMediatorEmail] = useState(mediation.mediator_email || "");
  const [mediationDate, setMediationDate] = useState(mediation.mediation_date || "");

  // Settlement fields (Settled / Settled Before / Impasse)
  const [carrierRep, setCarrierRep] = useState(mediation.carrier_rep_name || "");
  const [carrierOffer, setCarrierOffer] = useState(String(mediation.carrier_offer || ""));
  const [ourCounter, setOurCounter] = useState(String(mediation.our_counter || ""));
  const [agreedAmount, setAgreedAmount] = useState(String(mediation.agreed_amount || ""));
  const [mediatorRating, setMediatorRating] = useState(String(mediation.mediator_rating || ""));
  const [carrierRepRating, setCarrierRepRating] = useState(String(mediation.carrier_rep_rating || ""));

  // Attorney fields
  const [attName, setAttName] = useState(mediation.attorney_name || "");
  const [attFirm, setAttFirm] = useState(mediation.attorney_firm || "");
  const [attPhone, setAttPhone] = useState(mediation.attorney_phone || "");
  const [attEmail, setAttEmail] = useState(mediation.attorney_email || "");
  const [attEngagement, setAttEngagement] = useState<"Assisting" | "Fully Onboarded">(mediation.attorney_engagement_type || "Assisting");
  const [attDate, setAttDate] = useState(mediation.attorney_assigned_date || new Date().toISOString().split("T")[0]);

  // TPN data for attorney pickers
  const [firms, setFirms] = useState<{ id: string; name: string }[]>([]);
  const [attorneys, setAttorneys] = useState<{ id: string; name: string; firm_id: string | null; firm_name: string | null; phone: string | null; email: string | null }[]>([]);
  const [showAddFirm, setShowAddFirm] = useState(false);
  const [newFirmName, setNewFirmName] = useState("");
  const [showAddAttorney, setShowAddAttorney] = useState(false);
  const [newAttorneyName, setNewAttorneyName] = useState("");

  // Fetch TPN firms + attorneys
  useEffect(() => {
    if (!userInfo) return;
    supabase.from("firms").select("id, name").eq("org_id", userInfo.orgId).eq("status", "active").order("name")
      .then(({ data }) => { if (data) setFirms(data); });
    supabase.from("external_contacts").select("id, name, firm_id, company_name, phone, email")
      .eq("org_id", userInfo.orgId).eq("specialty", "Attorney").eq("status", "active").order("name")
      .then(({ data }) => {
        if (data) setAttorneys(data.map((c: any) => ({ id: c.id, name: c.name, firm_id: c.firm_id, firm_name: c.company_name, phone: c.phone, email: c.email })));
      });
  }, [supabase, userInfo]);

  // Filter attorneys by selected firm
  const filteredAttorneys = useMemo(() => {
    if (!attFirm) return attorneys;
    const matchedFirm = firms.find((f) => f.name === attFirm);
    if (!matchedFirm) return attorneys;
    return attorneys.filter((a) => a.firm_id === matchedFirm.id);
  }, [attorneys, firms, attFirm]);

  const handleAddFirm = async () => {
    if (!newFirmName.trim() || !userInfo) return;
    const { data } = await supabase.from("firms").insert({ name: newFirmName.trim(), org_id: userInfo.orgId, status: "active" }).select("id, name").single();
    if (data) {
      setFirms((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setAttFirm(data.name);
    }
    setNewFirmName("");
    setShowAddFirm(false);
  };

  const handleAddAttorney = async () => {
    if (!newAttorneyName.trim() || !userInfo) return;
    const matchedFirm = firms.find((f) => f.name === attFirm);
    const { data } = await supabase.from("external_contacts").insert({
      name: newAttorneyName.trim(),
      specialty: "Attorney",
      org_id: userInfo.orgId,
      firm_id: matchedFirm?.id || null,
      company_name: attFirm || null,
      status: "active",
    }).select("id, name, firm_id, company_name, phone, email").single();
    if (data) {
      setAttorneys((prev) => [...prev, { id: data.id, name: data.name, firm_id: data.firm_id, firm_name: data.company_name, phone: data.phone, email: data.email }].sort((a, b) => a.name.localeCompare(b.name)));
      setAttName(data.name);
    }
    setNewAttorneyName("");
    setShowAddAttorney(false);
  };

  const showMediatorFields = ["Scheduling", "Set"].includes(updateStatus);
  const showSettledFields = ["Settled", "Impasse"].includes(updateStatus);
  const showAgreedOnly = updateStatus === "Settled Before";
  const showAgreedAmount = updateStatus === "Settled" || updateStatus === "Settled Before";

  const handleSaveUpdate = async () => {
    const updates: any = { id: mediation.id, status: updateStatus };

    if (showMediatorFields) {
      updates.mediator = mediatorName || undefined;
      updates.mediation_firm = mediatorFirm || undefined;
      updates.mediator_phone = mediatorPhone || undefined;
      updates.mediator_email = mediatorEmail || undefined;
      updates.mediation_date = mediationDate || undefined;
    }

    if (showSettledFields || showAgreedOnly) {
      if (showAgreedAmount) updates.agreed_amount = agreedAmount ? parseFloat(agreedAmount) : undefined;
    }

    if (showSettledFields) {
      updates.carrier_rep_name = carrierRep || undefined;
      updates.carrier_offer = carrierOffer ? parseFloat(carrierOffer) : undefined;
      updates.our_counter = ourCounter ? parseFloat(ourCounter) : undefined;
      updates.mediator_rating = mediatorRating ? parseInt(mediatorRating) : undefined;
      updates.carrier_rep_rating = carrierRepRating ? parseInt(carrierRepRating) : undefined;
    }

    await updateMediation.mutateAsync(updates);
    setShowUpdateForm(false);
  };

  const handleSaveAttorney = async () => {
    await updateMediation.mutateAsync({
      id: mediation.id,
      attorney_name: attName || undefined,
      attorney_firm: attFirm || undefined,
      attorney_phone: attPhone || undefined,
      attorney_email: attEmail || undefined,
      attorney_engagement_type: attEngagement as any,
      attorney_assigned_date: attDate || undefined,
    });
    setShowAttorneyForm(false);
  };

  const handleArchive = async () => {
    if (!confirm("Archive this record? It will move to the Historical tab.")) return;
    await archiveMediation.mutateAsync({ id: mediation.id, archivedBy: userInfo?.fullName || "Unknown" });
    onClose();
  };

  const handleUnarchive = async () => {
    if (!confirm("Unarchive this record? It will return to the Active tab.")) return;
    await unarchiveMediation.mutateAsync(mediation.id);
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 1000, maxHeight: "95vh" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {labels.trackName} Details
            </h2>
            <button onClick={onClose} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>&times;</button>
          </div>

          {/* Info bar */}
          <div className="rounded-lg p-4 flex flex-wrap gap-6 text-sm"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>File #</span>
              <div className="font-semibold">{mediation.litigation_file?.file_number || "—"}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Client</span>
              <div>{mediation.litigation_file?.client_name || "—"}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Contractor</span>
              <div>{mediation.litigation_file?.referral_source || "—"}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{labels.practitioner}</span>
              <div>{mediation.mediator || "—"}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Status</span>
              <div><StatusBadge label={getStatusDisplayName(mediation.status, disputeType)} color={getStatusColor(mediation.status)} /></div>
            </div>
            {mediation.agreed_amount && (
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Agreed Amount</span>
                <div style={{ color: "#4ade80", fontWeight: 600 }}>{formatCurrency(mediation.agreed_amount)}</div>
              </div>
            )}
            {mediation.attorney_name && (
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Attorney</span>
                <div>{mediation.attorney_name} ({mediation.attorney_engagement_type === "Assisting" ? "CRN" : "Onboarded"})</div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* Action buttons */}
          <div className="flex gap-2 mb-4">
            <button style={btnPrimary} onClick={() => setShowUpdateForm(!showUpdateForm)}>
              {showUpdateForm ? "Cancel Update" : "+ Add Update"}
            </button>
            <button style={btnOutline} onClick={() => setShowAttorneyForm(!showAttorneyForm)}>
              {mediation.attorney_name ? "Edit Attorney" : "+ Add Attorney"}
            </button>
          </div>

          {/* Update form (conditional) */}
          {showUpdateForm && (
            <div className="rounded-lg p-4 mb-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Update Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Status</label>
                  <select style={selectStyle} value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value as MediationStatus)}>
                    {MEDIATION_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{getStatusDisplayName(s, disputeType)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Next Action Date</label>
                  <input style={inputStyle} type="date" value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} />
                </div>
              </div>

              {/* Mediator details (Scheduling / Set) */}
              {showMediatorFields && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label style={labelStyle}>{labels.practitioner} Name</label>
                    <input style={inputStyle} value={mediatorName} onChange={(e) => setMediatorName(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>{labels.practitioner} Firm</label>
                    <input style={inputStyle} value={mediatorFirm} onChange={(e) => setMediatorFirm(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input style={inputStyle} value={mediatorPhone} onChange={(e) => setMediatorPhone(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input style={inputStyle} value={mediatorEmail} onChange={(e) => setMediatorEmail(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>{labels.dateLabel}</label>
                    <input style={inputStyle} type="date" value={mediationDate} onChange={(e) => setMediationDate(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Settled Before — just agreed amount */}
              {showAgreedOnly && (
                <div className="mt-3">
                  <label style={labelStyle}>Agreed Amount ($)</label>
                  <input style={{ ...inputStyle, maxWidth: 200 }} type="number" value={agreedAmount}
                    onChange={(e) => setAgreedAmount(e.target.value)} placeholder="0" />
                </div>
              )}

              {/* Settled / Impasse — carrier rep, offer/counter, ratings */}
              {showSettledFields && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label style={labelStyle}>Carrier Rep</label>
                    <input style={inputStyle} value={carrierRep} onChange={(e) => setCarrierRep(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Carrier Offer ($)</label>
                    <input style={inputStyle} type="number" value={carrierOffer} onChange={(e) => setCarrierOffer(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Our Counter ($)</label>
                    <input style={inputStyle} type="number" value={ourCounter} onChange={(e) => setOurCounter(e.target.value)} />
                  </div>
                  {showAgreedAmount && (
                    <div>
                      <label style={labelStyle}>Agreed Amount ($)</label>
                      <input style={inputStyle} type="number" value={agreedAmount} onChange={(e) => setAgreedAmount(e.target.value)} />
                    </div>
                  )}
                  <div>
                    <label style={labelStyle}>{labels.practitioner} Rating (1-5)</label>
                    <select style={selectStyle} value={mediatorRating} onChange={(e) => setMediatorRating(e.target.value)}>
                      <option value="">—</option>
                      {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Carrier Rep Rating (1-5)</label>
                    <select style={selectStyle} value={carrierRepRating} onChange={(e) => setCarrierRepRating(e.target.value)}>
                      <option value="">—</option>
                      {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="mt-3">
                <label style={labelStyle}>Note</label>
                <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }}
                  value={updateNote} onChange={(e) => setUpdateNote(e.target.value)} />
              </div>

              <div className="flex gap-2 mt-3">
                <button style={btnPrimary} onClick={handleSaveUpdate} disabled={updateMediation.isPending}>
                  {updateMediation.isPending ? "Saving..." : "Save Update"}
                </button>
                <button style={btnOutline} onClick={() => setShowUpdateForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Attorney form (conditional) */}
          {showAttorneyForm && (
            <div className="rounded-lg p-4 mb-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Attorney Assignment</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Law Firm</label>
                  {showAddFirm ? (
                    <div className="flex gap-2">
                      <input style={inputStyle} value={newFirmName} onChange={(e) => setNewFirmName(e.target.value)} placeholder="New firm name..." autoFocus />
                      <button type="button" style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12, whiteSpace: "nowrap" as const }} onClick={handleAddFirm}>Add</button>
                      <button type="button" style={{ ...btnOutline, fontSize: 12, whiteSpace: "nowrap" as const }} onClick={() => setShowAddFirm(false)}>Cancel</button>
                    </div>
                  ) : (
                    <select style={selectStyle} value={attFirm} onChange={(e) => {
                      if (e.target.value === "__ADD_NEW__") { setShowAddFirm(true); return; }
                      setAttFirm(e.target.value);
                      setAttName(""); setAttPhone(""); setAttEmail("");
                    }}>
                      <option value="">Select law firm...</option>
                      {firms.filter((f) => f.name).map((f) => (
                        <option key={f.id} value={f.name}>{f.name}</option>
                      ))}
                      <option value="__ADD_NEW__">+ Add New Firm</option>
                    </select>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Attorney Name</label>
                  {showAddAttorney ? (
                    <div className="flex gap-2">
                      <input style={inputStyle} value={newAttorneyName} onChange={(e) => setNewAttorneyName(e.target.value)} placeholder="Attorney name..." autoFocus />
                      <button type="button" style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12, whiteSpace: "nowrap" as const }} onClick={handleAddAttorney}>Add</button>
                      <button type="button" style={{ ...btnOutline, fontSize: 12, whiteSpace: "nowrap" as const }} onClick={() => setShowAddAttorney(false)}>Cancel</button>
                    </div>
                  ) : (
                    <select style={selectStyle} value={attName} onChange={(e) => {
                      if (e.target.value === "__ADD_NEW__") { setShowAddAttorney(true); return; }
                      setAttName(e.target.value);
                      // Auto-fill phone/email from TPN contact
                      const contact = attorneys.find((a) => a.name === e.target.value);
                      if (contact) {
                        if (contact.phone) setAttPhone(contact.phone);
                        if (contact.email) setAttEmail(contact.email);
                      }
                    }}>
                      <option value="">Select attorney...</option>
                      {filteredAttorneys.map((a) => (
                        <option key={a.id} value={a.name}>{a.name}</option>
                      ))}
                      <option value="__ADD_NEW__">+ Add New Attorney</option>
                    </select>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input style={inputStyle} value={attPhone} onChange={(e) => setAttPhone(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input style={inputStyle} value={attEmail} onChange={(e) => setAttEmail(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Engagement Type</label>
                  <select style={selectStyle} value={attEngagement} onChange={(e) => setAttEngagement(e.target.value as "Assisting" | "Fully Onboarded")}>
                    <option value="Assisting">Assisting (CRN Only)</option>
                    <option value="Fully Onboarded">Fully Onboarded</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Date Assigned</label>
                  <input style={inputStyle} type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button style={btnPrimary} onClick={handleSaveAttorney} disabled={updateMediation.isPending}>
                  {updateMediation.isPending ? "Saving..." : "Save Attorney"}
                </button>
                <button style={btnOutline} onClick={() => setShowAttorneyForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Mediation info display */}
          {mediation.mediator && (
            <div className="rounded-lg p-4 mb-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{labels.practitioner} Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Name</span>
                  <div>{mediation.mediator}</div>
                </div>
                {mediation.mediation_firm && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Firm</span>
                  <div>{mediation.mediation_firm}</div>
                </div>}
                {mediation.mediator_phone && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Phone</span>
                  <div>{mediation.mediator_phone}</div>
                </div>}
                {mediation.mediation_date && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{labels.dateLabel}</span>
                  <div>{formatDate(mediation.mediation_date)}</div>
                </div>}
              </div>
            </div>
          )}

          {/* Settlement details if settled */}
          {(mediation.status === "Settled" || mediation.status === "Impasse") && mediation.carrier_rep_name && (
            <div className="rounded-lg p-4 mb-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Settlement Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Carrier Rep</span>
                  <div>{mediation.carrier_rep_name}</div>
                </div>
                {mediation.carrier_offer && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Carrier Offer</span>
                  <div>{formatCurrency(mediation.carrier_offer)}</div>
                </div>}
                {mediation.our_counter && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Our Counter</span>
                  <div>{formatCurrency(mediation.our_counter)}</div>
                </div>}
                {mediation.agreed_amount && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Agreed Amount</span>
                  <div style={{ color: "#4ade80", fontWeight: 600 }}>{formatCurrency(mediation.agreed_amount)}</div>
                </div>}
              </div>
            </div>
          )}

          {/* Archive / Unarchive */}
          {isAdmin && (
            <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
              {isHistorical ? (
                <button style={{ ...btnOutline, color: "var(--text-muted)" }} onClick={handleUnarchive}>
                  Unarchive
                </button>
              ) : (
                <button style={{ ...btnOutline, color: "var(--text-muted)" }} onClick={handleArchive}>
                  Close &amp; Archive
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   LIQUIDITY VIEW
   ================================================================ */

function MediationLiquidity({ disputeType }: { disputeType: DisputeType }) {
  const { data: allMediations = [], isLoading } = useAllMediationsForLiquidity();
  const labels = getDisputeLabels(disputeType);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = allMediations.filter((m) => m.dispute_type === disputeType);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((m) =>
        m.litigation_file?.file_number?.toLowerCase().includes(q) ||
        m.litigation_file?.client_name?.toLowerCase().includes(q) ||
        (m.mediator || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [allMediations, disputeType, search]);

  const settled = filtered.filter((m) => m.status === "Settled" || m.status === "Settled Before");
  const impassed = filtered.filter((m) => m.status === "Impasse");

  const settlementRate = filtered.length > 0 ? settled.length / filtered.length : 0;
  const preSettlementRate = filtered.length > 0
    ? filtered.filter((m) => m.status === "Settled Before").length / filtered.length : 0;
  const impasseRate = filtered.length > 0 ? impassed.length / filtered.length : 0;

  const agreedAmounts = settled.map((m) => m.agreed_amount).filter((v): v is number => v != null);
  const avgAgreed = agreedAmounts.length > 0 ? agreedAmounts.reduce((a, b) => a + b, 0) / agreedAmounts.length : 0;

  const carrierOffers = filtered.map((m) => m.carrier_offer).filter((v): v is number => v != null);
  const avgCarrierOffer = carrierOffers.length > 0 ? carrierOffers.reduce((a, b) => a + b, 0) / carrierOffers.length : 0;

  const spread = avgAgreed - avgCarrierOffer;

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Total Records</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{filtered.length}</p>
        </div>
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Settlement Rate</p>
          <p className="text-xl font-bold" style={{ color: "#4ade80" }}>{Math.round(settlementRate * 100)}%</p>
        </div>
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Pre-Settlement Rate</p>
          <p className="text-xl font-bold" style={{ color: "#5eead4" }}>{Math.round(preSettlementRate * 100)}%</p>
        </div>
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Impasse Rate</p>
          <p className="text-xl font-bold" style={{ color: "#ef4444" }}>{Math.round(impasseRate * 100)}%</p>
        </div>
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Avg Agreed Amount</p>
          <p className="text-xl font-bold" style={{ color: "#4ade80" }}>{formatCurrency(avgAgreed || null)}</p>
        </div>
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Avg Carrier Offer</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{formatCurrency(avgCarrierOffer || null)}</p>
        </div>
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Spread</p>
          <p className="text-xl font-bold" style={{ color: spread >= 0 ? "#4ade80" : "#ef4444" }}>
            {formatCurrency(spread || null)}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input style={{ ...inputStyle, maxWidth: 320 }} placeholder="Search by file #, client, or mediator..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th style={thStyle}>File #</th>
              <th style={thStyle}>Client</th>
              <th style={thStyle}>Contractor</th>
              <th style={thStyle}>{labels.practitioner}</th>
              <th style={thStyle}>Carrier Rep</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Carrier Offer</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Our Counter</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Agreed</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} style={{ ...tdStyle, textAlign: "center", padding: 24 }}>
                <span style={{ color: "var(--text-muted)" }}>Loading...</span>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ ...tdStyle, textAlign: "center", padding: 24 }}>
                <span style={{ color: "var(--text-muted)" }}>No records found.</span>
              </td></tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{m.litigation_file?.file_number || "—"}</td>
                  <td style={tdStyle}>{m.litigation_file?.client_name || "—"}</td>
                  <td style={tdStyle}>{m.litigation_file?.referral_source || "—"}</td>
                  <td style={tdStyle}>{m.mediator || "—"}</td>
                  <td style={tdStyle}>{m.carrier_rep_name || "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(m.carrier_offer)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(m.our_counter)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#4ade80" }}>{formatCurrency(m.agreed_amount)}</td>
                  <td style={tdStyle}>
                    <StatusBadge label={getStatusDisplayName(m.status, disputeType)} color={getStatusColor(m.status)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
