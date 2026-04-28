"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useAppraisals,
  useArchivedAppraisals,
  useAllAppraisalsForLiquidity,
  useCreateAppraisal,
  useUpdateAppraisal,
  useArchiveAppraisal,
  useUnarchiveAppraisal,
  useDeleteAppraisal,
} from "@/hooks/settlement-tracker";
import { formatDate, truncate, formatCurrency } from "@/lib/formatters";
import { useSTSupabase } from "@/hooks/settlement-tracker";
import {
  AppraisalWithFile,
  AppraisalStatus,
  APPRAISAL_STATUS_OPTIONS,
  UMPIRE_SELECTION_OPTIONS,
  AWARD_AGREED_BY_OPTIONS,
  UmpireSelection,
  AwardAgreedBy,
} from "@/types/settlement-tracker/appraisal";
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
const CLOSED_STATUSES: AppraisalStatus[] = ["Awarded", "Withdrawn"];

function getTrafficLightColor(status: AppraisalStatus, dateInvoked?: string | null): string {
  if (CLOSED_STATUSES.includes(status)) return "#555";
  if (!dateInvoked) return "#555";
  const invoked = new Date(dateInvoked);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((today.getTime() - invoked.getTime()) / 86_400_000);
  if (diffDays > 90) return "#ef4444";
  if (diffDays > 45) return "#facc15";
  return "#4ade80";
}


function StatusBadge({ label, color }: { label: string; color: string }) {
  const bgMap: Record<string, string> = { green: "#1a3a2a", yellow: "#3a3520", red: "#4a1a1a", blue: "#1a2a4a", gray: "#2a2a2a" };
  const textMap: Record<string, string> = { green: "#4ade80", yellow: "#facc15", red: "#ef4444", blue: "#60a5fa", gray: "#888888" };
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: bgMap[color] || bgMap.gray, color: textMap[color] || textMap.gray }}>
      {label}
    </span>
  );
}

function getStatusColor(status: AppraisalStatus): string {
  switch (status) {
    case "Pending": return "blue";
    case "Appraiser Selection": return "yellow";
    case "Umpire Selection": return "yellow";
    case "In Progress": return "green";
    case "Impasse": return "red";
    case "Awarded": return "green";
    case "Withdrawn": return "gray";
    default: return "gray";
  }
}

/* ================================================================
   APPRAISAL TRACK — Main Component
   ================================================================ */

interface AppraisalTrackProps {
  onBack: () => void;
}

type AppTab = "active" | "historical" | "liquidity";

export default function AppraisalTrack({ onBack }: AppraisalTrackProps) {
  const { userInfo } = useSTSupabase();
  const isAdmin = userInfo ? ADMIN_ROLES.includes(userInfo.role) : false;

  const [tab, setTab] = useState<AppTab>("active");

  const { data: activeAppraisals = [], isLoading: activeLoading } = useAppraisals();
  const { data: archivedAppraisals = [], isLoading: archiveLoading } = useArchivedAppraisals();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedAppraisal, setSelectedAppraisal] = useState<AppraisalWithFile | null>(null);

  const displayData = tab === "active" ? activeAppraisals : archivedAppraisals;
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
            Appraisal Track
          </h1>
        </div>
        <div className="flex gap-2 items-center">
          {isAdmin && (
            <button style={btnPrimary} onClick={() => setShowCreateForm(true)}>
              + New Appraisal
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5">
        {([
          { key: "active" as AppTab, label: `Active (${activeAppraisals.length})` },
          { key: "historical" as AppTab, label: `Historical (${archivedAppraisals.length})` },
          ...(isAdmin ? [{ key: "liquidity" as AppTab, label: "Liquidity" }] : []),
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
        <AppraisalDataGrid
          appraisals={displayData}
          isLoading={isLoading}
          isAdmin={isAdmin}
          isHistorical={tab === "historical"}
          onSelect={setSelectedAppraisal}
        />
      )}

      {tab === "liquidity" && <AppraisalLiquidity />}

      {/* Create form modal */}
      {showCreateForm && (
        <AppraisalCreateModal onClose={() => setShowCreateForm(false)} />
      )}

      {/* Updates panel modal */}
      {selectedAppraisal && (
        <AppraisalUpdatesPanel
          appraisal={selectedAppraisal}
          isAdmin={isAdmin}
          isHistorical={tab === "historical"}
          onClose={() => setSelectedAppraisal(null)}
        />
      )}
    </div>
  );
}

/* ================================================================
   DATA GRID
   ================================================================ */

function AppraisalDataGrid({
  appraisals,
  isLoading,
  isAdmin,
  isHistorical,
  onSelect,
}: {
  appraisals: AppraisalWithFile[];
  isLoading: boolean;
  isAdmin: boolean;
  isHistorical: boolean;
  onSelect: (a: AppraisalWithFile) => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
      <div className="px-4 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        {appraisals.length} {isHistorical ? "archived" : "active"} records
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="w-full text-sm" style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              <th style={thStyle}>State</th>
              <th style={thStyle}>File #</th>
              <th style={thStyle}>Client</th>
              <th style={thStyle}>Contractor</th>
              <th style={thStyle}>Our Appraiser</th>
              <th style={thStyle}>Carrier Appraiser</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Award</th>
              <th style={thStyle}>Date Invoked</th>
              <th style={{ ...thStyle, width: 30 }}>TL</th>
              <th style={thStyle}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={11} style={{ ...tdStyle, textAlign: "center", padding: 32 }}>
                <span style={{ color: "var(--text-muted)" }}>Loading...</span>
              </td></tr>
            ) : appraisals.length === 0 ? (
              <tr><td colSpan={11} style={{ ...tdStyle, textAlign: "center", padding: 32 }}>
                <span style={{ color: "var(--text-muted)" }}>No appraisal records found.</span>
              </td></tr>
            ) : (
              appraisals.map((a) => (
                <tr key={a.id} onClick={() => onSelect(a)}
                  style={{ cursor: "pointer", borderBottom: "1px solid var(--border-color)" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <td style={tdStyle}>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded"
                      style={{ background: "var(--bg-hover)" }}>
                      {a.litigation_file?.state || "\u2014"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: "var(--accent)", fontWeight: 600 }}>
                    {a.litigation_file?.file_number || "\u2014"}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{a.litigation_file?.client_name || "\u2014"}</td>
                  <td style={tdStyle}>{a.litigation_file?.referral_source || "\u2014"}</td>
                  <td style={tdStyle}>{a.our_appraiser || "\u2014"}</td>
                  <td style={tdStyle}>{a.carrier_appraiser || "\u2014"}</td>
                  <td style={tdStyle}>
                    <StatusBadge label={a.status} color={getStatusColor(a.status)} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: a.award_amount ? "#4ade80" : "var(--text-primary)" }}>
                    {formatCurrency(a.award_amount)}
                  </td>
                  <td style={tdStyle}>{formatDate(a.date_invoked)}</td>
                  <td style={tdStyle}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: getTrafficLightColor(a.status, a.date_invoked) }} />
                  </td>
                  <td style={tdStyle}>{truncate(a.notes, 25)}</td>
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
   CREATE MODAL — minimal (File Number + Is Litigated checkbox)
   ================================================================ */

function AppraisalCreateModal({ onClose }: { onClose: () => void }) {
  const { data: files = [] } = useLitigationFiles();
  const createAppraisal = useCreateAppraisal();

  const [selectedFileId, setSelectedFileId] = useState("");
  const [isLitigated, setIsLitigated] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFileId) return;
    await createAppraisal.mutateAsync({
      litigation_file_id: selectedFileId,
      is_litigated: isLitigated,
    });
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 pb-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            New Appraisal
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 pt-2">
          <div className="mb-4">
            <label style={labelStyle}>File Number *</label>
            <select style={selectStyle} value={selectedFileId} onChange={(e) => setSelectedFileId(e.target.value)} required>
              <option value="">Select a claim file...</option>
              {files.map((f) => (
                <option key={f.id} value={f.id}>{f.file_number} &mdash; {f.client_name}</option>
              ))}
            </select>
          </div>
          <div className="mb-4 flex items-center gap-2">
            <input type="checkbox" id="is-litigated" checked={isLitigated} onChange={(e) => setIsLitigated(e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }} />
            <label htmlFor="is-litigated" style={{ ...labelStyle, marginBottom: 0, cursor: "pointer" }}>
              Is Litigated?
            </label>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            Status will be set to &quot;Pending&quot;. Add details through updates after creation.
          </p>
          <div className="flex gap-3">
            <button type="submit" style={btnPrimary} disabled={createAppraisal.isPending}>
              {createAppraisal.isPending ? "Creating..." : "Create Appraisal"}
            </button>
            <button type="button" style={btnOutline} onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================================================================
   UPDATES PANEL — header + status-conditional form + TPN picker
   ================================================================ */

function AppraisalUpdatesPanel({
  appraisal,
  isAdmin,
  isHistorical,
  onClose,
}: {
  appraisal: AppraisalWithFile;
  isAdmin: boolean;
  isHistorical: boolean;
  onClose: () => void;
}) {
  const { supabase, userInfo } = useSTSupabase();
  const updateAppraisal = useUpdateAppraisal();
  const archiveAppraisal = useArchiveAppraisal();
  const unarchiveAppraisal = useUnarchiveAppraisal();

  const [showUpdateForm, setShowUpdateForm] = useState(false);

  // Editable fields
  const [updateStatus, setUpdateStatus] = useState<AppraisalStatus>(appraisal.status);

  // Our Appraiser (TPN picker)
  const [ourAppraiser, setOurAppraiser] = useState(appraisal.our_appraiser || "");
  const [ourAppraiserPhone, setOurAppraiserPhone] = useState(appraisal.our_appraiser_phone || "");
  const [ourAppraiserEmail, setOurAppraiserEmail] = useState(appraisal.our_appraiser_email || "");
  const [ourAppraiserContactId, setOurAppraiserContactId] = useState(appraisal.our_appraiser_contact_id || "");

  // Carrier Appraiser (free text)
  const [carrierAppraiser, setCarrierAppraiser] = useState(appraisal.carrier_appraiser || "");
  const [carrierAppraiserPhone, setCarrierAppraiserPhone] = useState(appraisal.carrier_appraiser_phone || "");
  const [carrierAppraiserEmail, setCarrierAppraiserEmail] = useState(appraisal.carrier_appraiser_email || "");

  // Umpire (free text)
  const [umpire, setUmpire] = useState(appraisal.umpire || "");
  const [umpirePhone, setUmpirePhone] = useState(appraisal.umpire_phone || "");
  const [umpireEmail, setUmpireEmail] = useState(appraisal.umpire_email || "");
  const [umpireSelection, setUmpireSelection] = useState<UmpireSelection | "">(appraisal.umpire_selection || "");

  // In Progress fields
  const [ourInspectionDate, setOurInspectionDate] = useState(appraisal.our_inspection_date || "");
  const [ourAppraisalAmount, setOurAppraisalAmount] = useState(String(appraisal.our_appraisal_amount || ""));
  const [carrierAppraisalAmount, setCarrierAppraisalAmount] = useState(String(appraisal.carrier_appraisal_amount || ""));

  // Awarded fields
  const [awardAmount, setAwardAmount] = useState(String(appraisal.award_amount || ""));
  const [awardAgreedBy, setAwardAgreedBy] = useState<AwardAgreedBy | "">(appraisal.award_agreed_by || "");
  const [appraiserFee, setAppraiserFee] = useState(String(appraisal.appraiser_fee || ""));
  const [dateResolved, setDateResolved] = useState(appraisal.date_resolved || "");

  // Ratings
  const [ourAppraiserRating, setOurAppraiserRating] = useState(String(appraisal.our_appraiser_rating || ""));
  const [carrierAppraiserRating, setCarrierAppraiserRating] = useState(String(appraisal.carrier_appraiser_rating || ""));
  const [umpireRating, setUmpireRating] = useState(String(appraisal.umpire_rating || ""));

  // Notes
  const [notes, setNotes] = useState(appraisal.notes || "");

  // TPN data for Our Appraiser picker
  const [appraiserContacts, setAppraiserContacts] = useState<{ id: string; name: string; phone: string | null; email: string | null }[]>([]);
  const [showAddAppraiser, setShowAddAppraiser] = useState(false);
  const [newAppraiserName, setNewAppraiserName] = useState("");

  // Fetch TPN appraiser contacts
  useEffect(() => {
    if (!userInfo) return;
    supabase
      .from("external_contacts")
      .select("id, name, phone, email")
      .eq("org_id", userInfo.orgId)
      .in("specialty", ["Appraiser", "Property Appraiser"])
      .eq("status", "active")
      .order("name")
      .then(({ data }) => {
        if (data) setAppraiserContacts(data);
      });
  }, [supabase, userInfo]);

  const handleAddAppraiser = async () => {
    if (!newAppraiserName.trim() || !userInfo) return;
    const { data } = await supabase
      .from("external_contacts")
      .insert({
        name: newAppraiserName.trim(),
        specialty: "Appraiser",
        org_id: userInfo.orgId,
        status: "active",
      })
      .select("id, name, phone, email")
      .single();
    if (data) {
      setAppraiserContacts((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setOurAppraiser(data.name);
      setOurAppraiserContactId(data.id);
      if (data.phone) setOurAppraiserPhone(data.phone);
      if (data.email) setOurAppraiserEmail(data.email);
    }
    setNewAppraiserName("");
    setShowAddAppraiser(false);
  };

  // Status-based field visibility (cumulative)
  const STATUS_ORDER: AppraisalStatus[] = ["Pending", "Appraiser Selection", "Umpire Selection", "In Progress", "Impasse", "Awarded"];
  const statusIndex = STATUS_ORDER.indexOf(updateStatus);

  const showAppraiserSelection = statusIndex >= 1 || updateStatus === "Withdrawn";
  const showUmpireFields = statusIndex >= 2;
  const showInProgressFields = statusIndex >= 3;
  const showAwardedFields = updateStatus === "Awarded";

  const handleSaveUpdate = async () => {
    const updates: any = { id: appraisal.id, status: updateStatus };

    if (showAppraiserSelection) {
      updates.our_appraiser = ourAppraiser || undefined;
      updates.our_appraiser_phone = ourAppraiserPhone || undefined;
      updates.our_appraiser_email = ourAppraiserEmail || undefined;
      updates.our_appraiser_contact_id = ourAppraiserContactId || undefined;
      updates.carrier_appraiser = carrierAppraiser || undefined;
      updates.carrier_appraiser_phone = carrierAppraiserPhone || undefined;
      updates.carrier_appraiser_email = carrierAppraiserEmail || undefined;
    }

    if (showUmpireFields) {
      updates.umpire = umpire || undefined;
      updates.umpire_phone = umpirePhone || undefined;
      updates.umpire_email = umpireEmail || undefined;
      updates.umpire_selection = umpireSelection || undefined;
    }

    if (showInProgressFields) {
      updates.our_inspection_date = ourInspectionDate || undefined;
      updates.our_appraisal_amount = ourAppraisalAmount ? parseFloat(ourAppraisalAmount) : undefined;
      updates.carrier_appraisal_amount = carrierAppraisalAmount ? parseFloat(carrierAppraisalAmount) : undefined;
    }

    if (showAwardedFields) {
      updates.award_amount = awardAmount ? parseFloat(awardAmount) : undefined;
      updates.award_agreed_by = awardAgreedBy || undefined;
      updates.appraiser_fee = appraiserFee ? parseFloat(appraiserFee) : undefined;
      updates.date_resolved = dateResolved || undefined;
      updates.our_appraiser_rating = ourAppraiserRating ? parseInt(ourAppraiserRating) : undefined;
      updates.carrier_appraiser_rating = carrierAppraiserRating ? parseInt(carrierAppraiserRating) : undefined;
      updates.umpire_rating = umpireRating ? parseInt(umpireRating) : undefined;
    }

    updates.notes = notes || undefined;

    await updateAppraisal.mutateAsync(updates);
    setShowUpdateForm(false);
  };

  const handleArchive = async () => {
    if (!confirm("Archive this record? It will move to the Historical tab.")) return;
    await archiveAppraisal.mutateAsync({ id: appraisal.id, archivedBy: userInfo?.fullName || "Unknown" });
    onClose();
  };

  const handleUnarchive = async () => {
    if (!confirm("Unarchive this record? It will return to the Active tab.")) return;
    await unarchiveAppraisal.mutateAsync(appraisal.id);
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 1000, maxHeight: "95vh" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Appraisal Details
            </h2>
            <button onClick={onClose} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>&times;</button>
          </div>

          {/* Info bar */}
          <div className="rounded-lg p-4 flex flex-wrap gap-6 text-sm"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>File #</span>
              <div className="font-semibold">{appraisal.litigation_file?.file_number || "\u2014"}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Client</span>
              <div>{appraisal.litigation_file?.client_name || "\u2014"}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Contractor</span>
              <div>{appraisal.litigation_file?.referral_source || "\u2014"}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>State</span>
              <div>{appraisal.litigation_file?.state || "\u2014"}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Status</span>
              <div><StatusBadge label={appraisal.status} color={getStatusColor(appraisal.status)} /></div>
            </div>
            {appraisal.award_amount != null && (
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Award Amount</span>
                <div style={{ color: "#4ade80", fontWeight: 600 }}>{formatCurrency(appraisal.award_amount)}</div>
              </div>
            )}
            {appraisal.date_invoked && (
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Date Invoked</span>
                <div>{formatDate(appraisal.date_invoked)}</div>
              </div>
            )}
            {appraisal.date_resolved && (
              <div>
                <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Date Resolved</span>
                <div>{formatDate(appraisal.date_resolved)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* Action button */}
          <div className="flex gap-2 mb-4">
            <button style={btnPrimary} onClick={() => setShowUpdateForm(!showUpdateForm)}>
              {showUpdateForm ? "Cancel Update" : "+ Add Update"}
            </button>
          </div>

          {/* Update form (conditional) */}
          {showUpdateForm && (
            <div className="rounded-lg p-4 mb-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Update Status</h3>

              {/* Status selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Status</label>
                  <select style={selectStyle} value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value as AppraisalStatus)}>
                    {APPRAISAL_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Appraiser Selection fields */}
              {showAppraiserSelection && (
                <>
                  <h4 className="text-xs font-semibold mt-4 mb-2" style={{ color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1 }}>
                    Appraiser Selection
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Our Appraiser — TPN picker */}
                    <div>
                      <label style={labelStyle}>Our Appraiser</label>
                      {showAddAppraiser ? (
                        <div className="flex gap-2">
                          <input style={inputStyle} value={newAppraiserName} onChange={(e) => setNewAppraiserName(e.target.value)} placeholder="Appraiser name..." autoFocus />
                          <button type="button" style={{ ...btnPrimary, padding: "6px 12px", fontSize: 12, whiteSpace: "nowrap" as const }} onClick={handleAddAppraiser}>Add</button>
                          <button type="button" style={{ ...btnOutline, fontSize: 12, whiteSpace: "nowrap" as const }} onClick={() => setShowAddAppraiser(false)}>Cancel</button>
                        </div>
                      ) : (
                        <select style={selectStyle} value={ourAppraiser} onChange={(e) => {
                          if (e.target.value === "__ADD_NEW__") { setShowAddAppraiser(true); return; }
                          setOurAppraiser(e.target.value);
                          const contact = appraiserContacts.find((c) => c.name === e.target.value);
                          if (contact) {
                            setOurAppraiserContactId(contact.id);
                            if (contact.phone) setOurAppraiserPhone(contact.phone);
                            if (contact.email) setOurAppraiserEmail(contact.email);
                          } else {
                            setOurAppraiserContactId("");
                            setOurAppraiserPhone("");
                            setOurAppraiserEmail("");
                          }
                        }}>
                          <option value="">Select appraiser...</option>
                          {appraiserContacts.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                          <option value="__ADD_NEW__">+ Add New Appraiser</option>
                        </select>
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}>Our Appraiser Phone</label>
                      <input style={inputStyle} value={ourAppraiserPhone} onChange={(e) => setOurAppraiserPhone(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Our Appraiser Email</label>
                      <input style={inputStyle} value={ourAppraiserEmail} onChange={(e) => setOurAppraiserEmail(e.target.value)} />
                    </div>
                    <div style={{ borderLeft: "2px solid var(--border-color)", paddingLeft: 12 }}>
                      <label style={labelStyle}>Carrier Appraiser</label>
                      <input style={inputStyle} value={carrierAppraiser} onChange={(e) => setCarrierAppraiser(e.target.value)} placeholder="Name..." />
                    </div>
                    <div>
                      <label style={labelStyle}>Carrier Appraiser Phone</label>
                      <input style={inputStyle} value={carrierAppraiserPhone} onChange={(e) => setCarrierAppraiserPhone(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Carrier Appraiser Email</label>
                      <input style={inputStyle} value={carrierAppraiserEmail} onChange={(e) => setCarrierAppraiserEmail(e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              {/* Umpire Selection / Impasse fields */}
              {showUmpireFields && (
                <>
                  <h4 className="text-xs font-semibold mt-4 mb-2" style={{ color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1 }}>
                    Umpire Selection
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label style={labelStyle}>Umpire Name</label>
                      <input style={inputStyle} value={umpire} onChange={(e) => setUmpire(e.target.value)} placeholder="Name..." />
                    </div>
                    <div>
                      <label style={labelStyle}>Umpire Phone</label>
                      <input style={inputStyle} value={umpirePhone} onChange={(e) => setUmpirePhone(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Umpire Email</label>
                      <input style={inputStyle} value={umpireEmail} onChange={(e) => setUmpireEmail(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Umpire Selection Type</label>
                      <select style={selectStyle} value={umpireSelection} onChange={(e) => setUmpireSelection(e.target.value as UmpireSelection)}>
                        <option value="">\u2014</option>
                        {UMPIRE_SELECTION_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* In Progress fields */}
              {showInProgressFields && (
                <>
                  <h4 className="text-xs font-semibold mt-4 mb-2" style={{ color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1 }}>
                    In Progress
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label style={labelStyle}>Our Inspection Date</label>
                      <input style={inputStyle} type="date" value={ourInspectionDate} onChange={(e) => setOurInspectionDate(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Our Appraisal Amount ($)</label>
                      <input style={inputStyle} type="number" value={ourAppraisalAmount} onChange={(e) => setOurAppraisalAmount(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label style={labelStyle}>Carrier Appraisal Amount ($)</label>
                      <input style={inputStyle} type="number" value={carrierAppraisalAmount} onChange={(e) => setCarrierAppraisalAmount(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                </>
              )}

              {/* Awarded fields */}
              {showAwardedFields && (
                <>
                  <h4 className="text-xs font-semibold mt-4 mb-2" style={{ color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1 }}>
                    Award Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label style={labelStyle}>Award Amount ($)</label>
                      <input style={inputStyle} type="number" value={awardAmount} onChange={(e) => setAwardAmount(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label style={labelStyle}>Award Agreed By</label>
                      <select style={selectStyle} value={awardAgreedBy} onChange={(e) => setAwardAgreedBy(e.target.value as AwardAgreedBy)}>
                        <option value="">\u2014</option>
                        {AWARD_AGREED_BY_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Appraiser Fee ($)</label>
                      <input style={inputStyle} type="number" value={appraiserFee} onChange={(e) => setAppraiserFee(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label style={labelStyle}>Date Resolved</label>
                      <input style={inputStyle} type="date" value={dateResolved} onChange={(e) => setDateResolved(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Our Appraiser Rating (1-5)</label>
                      <select style={selectStyle} value={ourAppraiserRating} onChange={(e) => setOurAppraiserRating(e.target.value)}>
                        <option value="">\u2014</option>
                        {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Carrier Appraiser Rating (1-5)</label>
                      <select style={selectStyle} value={carrierAppraiserRating} onChange={(e) => setCarrierAppraiserRating(e.target.value)}>
                        <option value="">\u2014</option>
                        {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Umpire Rating (1-5)</label>
                      <select style={selectStyle} value={umpireRating} onChange={(e) => setUmpireRating(e.target.value)}>
                        <option value="">\u2014</option>
                        {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              <div className="mt-3">
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }}
                  value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div className="flex gap-2 mt-3">
                <button style={btnPrimary} onClick={handleSaveUpdate} disabled={updateAppraisal.isPending}>
                  {updateAppraisal.isPending ? "Saving..." : "Save Update"}
                </button>
                <button style={btnOutline} onClick={() => setShowUpdateForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Appraiser details display */}
          {(appraisal.our_appraiser || appraisal.carrier_appraiser) && (
            <div className="rounded-lg p-4 mb-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Appraiser Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {appraisal.our_appraiser && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Our Appraiser</span>
                  <div>{appraisal.our_appraiser}</div>
                </div>}
                {appraisal.our_appraiser_phone && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Phone</span>
                  <div>{appraisal.our_appraiser_phone}</div>
                </div>}
                {appraisal.carrier_appraiser && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Carrier Appraiser</span>
                  <div>{appraisal.carrier_appraiser}</div>
                </div>}
                {appraisal.carrier_appraiser_phone && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Phone</span>
                  <div>{appraisal.carrier_appraiser_phone}</div>
                </div>}
              </div>
            </div>
          )}

          {/* Umpire details display */}
          {appraisal.umpire && (
            <div className="rounded-lg p-4 mb-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Umpire Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Umpire</span>
                  <div>{appraisal.umpire}</div>
                </div>
                {appraisal.umpire_phone && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Phone</span>
                  <div>{appraisal.umpire_phone}</div>
                </div>}
                {appraisal.umpire_selection && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Selection Type</span>
                  <div>{appraisal.umpire_selection}</div>
                </div>}
              </div>
            </div>
          )}

          {/* Award details display */}
          {appraisal.status === "Awarded" && appraisal.award_amount != null && (
            <div className="rounded-lg p-4 mb-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}>
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Award Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Award Amount</span>
                  <div style={{ color: "#4ade80", fontWeight: 600 }}>{formatCurrency(appraisal.award_amount)}</div>
                </div>
                {appraisal.award_agreed_by && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Agreed By</span>
                  <div>{appraisal.award_agreed_by}</div>
                </div>}
                {appraisal.our_appraisal_amount != null && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Our Amount</span>
                  <div>{formatCurrency(appraisal.our_appraisal_amount)}</div>
                </div>}
                {appraisal.carrier_appraisal_amount != null && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Carrier Amount</span>
                  <div>{formatCurrency(appraisal.carrier_appraisal_amount)}</div>
                </div>}
                {appraisal.appraiser_fee != null && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Fee</span>
                  <div>{formatCurrency(appraisal.appraiser_fee)}</div>
                </div>}
                {appraisal.date_resolved && <div>
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Date Resolved</span>
                  <div>{formatDate(appraisal.date_resolved)}</div>
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

function AppraisalLiquidity() {
  const { data: allAppraisals = [], isLoading } = useAllAppraisalsForLiquidity();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = allAppraisals;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) =>
        a.litigation_file?.file_number?.toLowerCase().includes(q) ||
        a.litigation_file?.client_name?.toLowerCase().includes(q) ||
        (a.our_appraiser || "").toLowerCase().includes(q) ||
        (a.carrier_appraiser || "").toLowerCase().includes(q) ||
        (a.umpire || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [allAppraisals, search]);

  const awarded = filtered.filter((a) => a.status === "Awarded");
  const impassed = filtered.filter((a) => a.status === "Impasse");

  const awardedRate = filtered.length > 0 ? awarded.length / filtered.length : 0;
  const impasseRate = filtered.length > 0 ? impassed.length / filtered.length : 0;

  const awardAmounts = awarded.map((a) => a.award_amount).filter((v): v is number => v != null);
  const avgAward = awardAmounts.length > 0 ? awardAmounts.reduce((a, b) => a + b, 0) / awardAmounts.length : 0;

  const ourAmounts = filtered.map((a) => a.our_appraisal_amount).filter((v): v is number => v != null);
  const avgOur = ourAmounts.length > 0 ? ourAmounts.reduce((a, b) => a + b, 0) / ourAmounts.length : 0;

  const carrierAmounts = filtered.map((a) => a.carrier_appraisal_amount).filter((v): v is number => v != null);
  const avgCarrier = carrierAmounts.length > 0 ? carrierAmounts.reduce((a, b) => a + b, 0) / carrierAmounts.length : 0;

  const spread = avgAward - avgCarrier;

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Total Records</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{filtered.length}</p>
        </div>
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Awarded Rate</p>
          <p className="text-xl font-bold" style={{ color: "#4ade80" }}>{Math.round(awardedRate * 100)}%</p>
        </div>
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Impasse Rate</p>
          <p className="text-xl font-bold" style={{ color: "#ef4444" }}>{Math.round(impasseRate * 100)}%</p>
        </div>
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Avg Award Amount</p>
          <p className="text-xl font-bold" style={{ color: "#4ade80" }}>{formatCurrency(avgAward || null)}</p>
        </div>
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Avg Our Amount</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{formatCurrency(avgOur || null)}</p>
        </div>
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Avg Carrier Amount</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{formatCurrency(avgCarrier || null)}</p>
        </div>
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Spread (Award - Carrier)</p>
          <p className="text-xl font-bold" style={{ color: spread >= 0 ? "#4ade80" : "#ef4444" }}>
            {formatCurrency(spread || null)}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input style={{ ...inputStyle, maxWidth: 320 }} placeholder="Search by file #, client, or appraiser..."
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
              <th style={thStyle}>Our Appraiser</th>
              <th style={thStyle}>Carrier Appraiser</th>
              <th style={thStyle}>Umpire</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Our Amount</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Carrier Amount</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Award</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Fee</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={10} style={{ ...tdStyle, textAlign: "center", padding: 24 }}>
                <span style={{ color: "var(--text-muted)" }}>Loading...</span>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ ...tdStyle, textAlign: "center", padding: 24 }}>
                <span style={{ color: "var(--text-muted)" }}>No records found.</span>
              </td></tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{a.litigation_file?.file_number || "\u2014"}</td>
                  <td style={tdStyle}>{a.litigation_file?.client_name || "\u2014"}</td>
                  <td style={tdStyle}>{a.our_appraiser || "\u2014"}</td>
                  <td style={tdStyle}>{a.carrier_appraiser || "\u2014"}</td>
                  <td style={tdStyle}>{a.umpire || "\u2014"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(a.our_appraisal_amount)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(a.carrier_appraisal_amount)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#4ade80" }}>{formatCurrency(a.award_amount)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(a.appraiser_fee)}</td>
                  <td style={tdStyle}>
                    <StatusBadge label={a.status} color={getStatusColor(a.status)} />
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
