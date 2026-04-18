"use client";

import { useState, useMemo, useEffect } from "react";
import {
  usePASettlements,
  useArchivedPASettlements,
  useAllPASettlementsForLiquidity,
  useCreatePASettlement,
  useUpdatePASettlement,
  useArchivePASettlement,
  useUnarchivePASettlement,
  useDeletePASettlement,
} from "@/hooks/settlement-tracker";
import { formatDate, truncate, formatCurrency, formatCurrencyDecimal } from "@/lib/formatters";
import { useSTSupabase } from "@/hooks/settlement-tracker";
import { useLitigationFiles } from "@/hooks/settlement-tracker";
import { useClaimLookup, type ClaimLookupMatch, type LookupField } from "@/hooks/useClaimLookup";
import ClaimMatchBanner from "@/components/ClaimMatchBanner";
import {
  PASettlementWithFile,
  CreatePASettlementInput,
  PASettlementPayment,
  PASettlementUpdate,
  PERIL_OPTIONS,
  CLAIM_SEVERITY_OPTIONS,
  ROOF_TYPE_OPTIONS,
  SETTLEMENT_BASIS_OPTIONS,
  SETTLEMENT_TYPE_OPTIONS,
  SETTLEMENT_STATUS_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  PaymentType,
} from "@/types/settlement-tracker/pa-settlement";
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

const readOnlyInputStyle: React.CSSProperties = {
  ...inputStyle,
  background: "var(--bg-hover)",
  opacity: 0.7,
  cursor: "default",
};

/* ── helpers ──────────────────────────────────────────── */

const ADMIN_ROLES = ["admin", "super_admin", "system_admin"];


function StatusBadge({ label, color }: { label: string; color: string }) {
  const bgMap: Record<string, string> = {
    green: "#1a3a2a",
    yellow: "#3a3520",
    red: "#4a1a1a",
    blue: "#1a2a4a",
    gray: "#2a2a2a",
  };
  const textMap: Record<string, string> = {
    green: "#4ade80",
    yellow: "#facc15",
    red: "#ef4444",
    blue: "#60a5fa",
    gray: "#888888",
  };
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{
        background: bgMap[color] || bgMap.gray,
        color: textMap[color] || textMap.gray,
      }}
    >
      {label}
    </span>
  );
}

function getSettlementStatusBadgeColor(status?: string): string {
  switch (status) {
    case "Open":
      return "yellow";
    case "Closed":
      return "green";
    default:
      return "gray";
  }
}

/* ================================================================
   PA SETTLEMENTS TRACK — Main Component
   ================================================================ */

type PATab = "active" | "historical" | "liquidity";

interface PASettlementsTrackProps {
  onBack: () => void;
}

export default function PASettlementsTrack({ onBack }: PASettlementsTrackProps) {
  const { userInfo } = useSTSupabase();
  const isAdmin = userInfo ? ADMIN_ROLES.includes(userInfo.role) : false;

  const [tab, setTab] = useState<PATab>("active");

  const { data: activeSettlements = [], isLoading: activeLoading } =
    usePASettlements();
  const { data: archivedSettlements = [], isLoading: archiveLoading } =
    useArchivedPASettlements();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSettlement, setSelectedSettlement] =
    useState<PASettlementWithFile | null>(null);

  const displayData = tab === "active" ? activeSettlements : archivedSettlements;
  const isLoading = tab === "active" ? activeLoading : archiveLoading;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-sm flex items-center gap-1"
            style={{
              color: "var(--text-secondary)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            &larr; All Tracks
          </button>
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            PA Settlements
          </h1>
        </div>
        <div className="flex gap-2 items-center">
          {isAdmin && (
            <button style={btnPrimary} onClick={() => setShowCreateForm(true)}>
              + New Settlement
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5">
        {(
          [
            {
              key: "active" as PATab,
              label: `Active (${activeSettlements.length})`,
            },
            {
              key: "historical" as PATab,
              label: `Historical (${archivedSettlements.length})`,
            },
            ...(isAdmin
              ? [{ key: "liquidity" as PATab, label: "Liquidity" }]
              : []),
          ] as { key: PATab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            style={{
              background: tab === t.key ? "var(--bg-hover)" : "transparent",
              color:
                tab === t.key ? "var(--text-primary)" : "var(--text-muted)",
              border: "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {(tab === "active" || tab === "historical") && (
        <PADataGrid
          settlements={displayData}
          isLoading={isLoading}
          isAdmin={isAdmin}
          isHistorical={tab === "historical"}
          onSelect={setSelectedSettlement}
        />
      )}

      {tab === "liquidity" && <PALiquidity />}

      {/* Create form modal */}
      {showCreateForm && (
        <PACreateModal onClose={() => setShowCreateForm(false)} />
      )}

      {/* Updates panel modal */}
      {selectedSettlement && (
        <PAUpdatesPanel
          settlement={selectedSettlement}
          isAdmin={isAdmin}
          isHistorical={tab === "historical"}
          onClose={() => setSelectedSettlement(null)}
        />
      )}
    </div>
  );
}

/* ================================================================
   DATA GRID
   ================================================================ */

function PADataGrid({
  settlements,
  isLoading,
  isAdmin,
  isHistorical,
  onSelect,
}: {
  settlements: PASettlementWithFile[];
  isLoading: boolean;
  isAdmin: boolean;
  isHistorical: boolean;
  onSelect: (s: PASettlementWithFile) => void;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
      }}
    >
      <div
        className="px-4 py-2 text-xs"
        style={{ color: "var(--text-secondary)" }}
      >
        {settlements.length} {isHistorical ? "archived" : "active"} records
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="w-full text-sm" style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              <th style={thStyle}>State</th>
              <th style={thStyle}>File #</th>
              <th style={thStyle}>Client</th>
              <th style={thStyle}>Referral Source</th>
              <th style={thStyle}>Carrier</th>
              <th style={thStyle}>Peril</th>
              <th style={thStyle}>Severity</th>
              <th style={thStyle}>Settlement $</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} style={{ ...tdStyle, textAlign: "center" }}>
                  Loading...
                </td>
              </tr>
            ) : settlements.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ ...tdStyle, textAlign: "center" }}>
                  No {isHistorical ? "archived" : "active"} settlements
                </td>
              </tr>
            ) : (
              settlements.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onSelect(s)}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <td style={tdStyle}>
                    <StatusBadge
                      label={s.litigation_file?.state || "—"}
                      color="blue"
                    />
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      color: "var(--accent)",
                      fontWeight: 600,
                    }}
                  >
                    {s.litigation_file?.file_number || "—"}
                  </td>
                  <td style={tdStyle}>
                    {s.litigation_file?.client_name || "—"}
                  </td>
                  <td style={tdStyle}>{s.referral_source || "—"}</td>
                  <td style={tdStyle}>{s.carrier || "—"}</td>
                  <td style={tdStyle}>{s.peril || "—"}</td>
                  <td style={tdStyle}>{s.claim_severity || "—"}</td>
                  <td style={{ ...tdStyle, color: "#4ade80", fontWeight: 600 }}>
                    {formatCurrency(s.settlement_amount)}
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge
                      label={s.settlement_status || "Open"}
                      color={getSettlementStatusBadgeColor(
                        s.settlement_status
                      )}
                    />
                  </td>
                  <td style={tdStyle}>{truncate(s.notes)}</td>
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
   CREATE FORM MODAL
   ================================================================ */

function PACreateModal({ onClose }: { onClose: () => void }) {
  const { supabase, userInfo } = useSTSupabase();
  const createMut = useCreatePASettlement();
  const { data: litFiles = [] } = useLitigationFiles();

  const [form, setForm] = useState<CreatePASettlementInput>({
    litigation_file_id: "",
    was_supplemented: false,
    op_included: false,
    forthcoming_supplement_expected: false,
    coverage_a: false,
    coverage_b: false,
    coverage_c: false,
    coverage_d: false,
    endorsements_settled: false,
    settlement_status: "Open",
  });

  const set = (field: string, value: unknown) =>
    setForm((p) => ({ ...p, [field]: value }));
  const setNum = (field: string, raw: string) => {
    const v = raw === "" ? undefined : parseFloat(raw);
    set(field, v);
  };

  // Shared claim lookup — search by carrier or referral_source
  const [paLookupField, setPaLookupField] = useState<LookupField>('client_name');
  const paLookupTerm = paLookupField === 'client_name' ? (form.carrier || '') : '';
  const { matches: claimMatches, searching: claimSearching, clear: clearLookup } = useClaimLookup({
    supabase, orgId: userInfo?.orgId, searchTerm: form.referral_source || '', searchField: 'client_name',
    enabled: (form.referral_source?.length ?? 0) >= 3,
  });

  function handlePaClaimAccept(match: ClaimLookupMatch) {
    setForm((prev) => ({
      ...prev,
      referral_source: match.referral_source || prev.referral_source || undefined,
      referral_rep: match.referral_representative || prev.referral_rep || undefined,
      carrier: match.carrier || prev.carrier || undefined,
      carrier_adjuster: match.carrier_adjuster || prev.carrier_adjuster || undefined,
      peril: (match.peril as typeof prev.peril) || prev.peril,
      date_of_loss: match.loss_date || prev.date_of_loss || undefined,
    }));
  }

  // Auto-calcs
  const depreciation = useMemo(() => {
    if (form.rcv_amount != null && form.acv_amount != null)
      return form.rcv_amount - form.acv_amount;
    return undefined;
  }, [form.rcv_amount, form.acv_amount]);

  const costPerSquare = useMemo(() => {
    if (
      form.settlement_amount != null &&
      form.number_of_squares != null &&
      form.number_of_squares > 0
    )
      return form.settlement_amount / form.number_of_squares;
    return undefined;
  }, [form.settlement_amount, form.number_of_squares]);

  const paFeeAmountCalc = useMemo(() => {
    if (form.settlement_amount != null && form.pa_fee_percentage != null)
      return (form.settlement_amount * form.pa_fee_percentage) / 100;
    return undefined;
  }, [form.settlement_amount, form.pa_fee_percentage]);

  const netToClient = useMemo(() => {
    const settlement = form.settlement_amount ?? 0;
    const fee = form.pa_fee_amount ?? paFeeAmountCalc ?? 0;
    const ded = form.deductible ?? 0;
    return settlement - fee - ded;
  }, [
    form.settlement_amount,
    form.pa_fee_amount,
    paFeeAmountCalc,
    form.deductible,
  ]);

  const handleSubmit = () => {
    if (!form.litigation_file_id) return;
    createMut.mutate(
      {
        ...form,
        depreciation,
        cost_per_square: costPerSquare,
        pa_fee_amount: form.pa_fee_amount ?? paFeeAmountCalc,
        net_to_client: netToClient,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={{ ...modalStyle, maxWidth: 960 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            New PA Settlement
          </h2>
          <button style={btnOutline} onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4" style={{ flex: 1 }}>
          {/* Section 1 — The Claim */}
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            The Claim
          </h3>
          <div
            className="grid grid-cols-2 gap-3 mb-5"
            style={{ gridTemplateColumns: "1fr 1fr" }}
          >
            <div>
              <label style={labelStyle}>
                Claim File <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                style={selectStyle}
                value={form.litigation_file_id}
                onChange={(e) => set("litigation_file_id", e.target.value)}
              >
                <option value="">Select file...</option>
                {litFiles.map((f: { id: string; file_number: string; client_name: string }) => (
                  <option key={f.id} value={f.id}>
                    {f.file_number} — {f.client_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Peril</label>
              <select
                style={selectStyle}
                value={form.peril || ""}
                onChange={(e) => set("peril", e.target.value || undefined)}
              >
                <option value="">Select...</option>
                {PERIL_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Claim Severity</label>
              <select
                style={selectStyle}
                value={form.claim_severity || ""}
                onChange={(e) =>
                  set("claim_severity", e.target.value || undefined)
                }
              >
                <option value="">Select...</option>
                {CLAIM_SEVERITY_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Date of Loss</label>
              <input
                type="date"
                style={inputStyle}
                value={form.date_of_loss || ""}
                onChange={(e) => set("date_of_loss", e.target.value || null)}
              />
            </div>
            <div>
              <label style={labelStyle}>Date Settled</label>
              <input
                type="date"
                style={inputStyle}
                value={form.date_settled || ""}
                onChange={(e) => set("date_settled", e.target.value || null)}
              />
            </div>
          </div>

          {/* Section 2 — The Parties */}
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            The Parties
          </h3>
          <ClaimMatchBanner matches={claimMatches} searching={claimSearching} onAccept={handlePaClaimAccept} onDismiss={clearLookup} />
          <div
            className="grid grid-cols-2 gap-3 mb-5"
            style={{ gridTemplateColumns: "1fr 1fr" }}
          >
            <div>
              <label style={labelStyle}>Referral Source</label>
              <input
                style={inputStyle}
                value={form.referral_source || ""}
                onChange={(e) => set("referral_source", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Referral Rep</label>
              <input
                style={inputStyle}
                value={form.referral_rep || ""}
                onChange={(e) => set("referral_rep", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Carrier</label>
              <input
                style={inputStyle}
                value={form.carrier || ""}
                onChange={(e) => set("carrier", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Carrier Adjuster</label>
              <input
                style={inputStyle}
                value={form.carrier_adjuster || ""}
                onChange={(e) => set("carrier_adjuster", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Carrier Adjuster Phone</label>
              <input
                style={inputStyle}
                value={form.carrier_adjuster_phone || ""}
                onChange={(e) => set("carrier_adjuster_phone", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Carrier Adjuster Email</label>
              <input
                style={inputStyle}
                value={form.carrier_adjuster_email || ""}
                onChange={(e) => set("carrier_adjuster_email", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Our Adjuster</label>
              <input
                style={inputStyle}
                value={form.assigned_adjuster || ""}
                onChange={(e) => set("assigned_adjuster", e.target.value)}
              />
            </div>
          </div>

          {/* Section 3 — The Roof */}
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            The Roof
          </h3>
          <div
            className="grid grid-cols-3 gap-3 mb-5"
            style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
          >
            <div>
              <label style={labelStyle}>Roof Type</label>
              <select
                style={selectStyle}
                value={form.roof_type || ""}
                onChange={(e) => set("roof_type", e.target.value || undefined)}
              >
                <option value="">Select...</option>
                {ROOF_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Number of Squares</label>
              <input
                type="number"
                style={inputStyle}
                value={form.number_of_squares ?? ""}
                onChange={(e) => setNum("number_of_squares", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Cost Per Square (auto)</label>
              <input
                style={readOnlyInputStyle}
                value={
                  costPerSquare != null
                    ? formatCurrencyDecimal(costPerSquare)
                    : "—"
                }
                readOnly
              />
            </div>
          </div>

          {/* Section 4 — The Money */}
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            The Money
          </h3>
          <div
            className="grid grid-cols-3 gap-3 mb-3"
            style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
          >
            <div>
              <label style={labelStyle}>Settlement Basis</label>
              <select
                style={selectStyle}
                value={form.settlement_basis || ""}
                onChange={(e) =>
                  set("settlement_basis", e.target.value || undefined)
                }
              >
                <option value="">Select...</option>
                {SETTLEMENT_BASIS_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>RCV Amount</label>
              <input
                type="number"
                style={inputStyle}
                value={form.rcv_amount ?? ""}
                onChange={(e) => setNum("rcv_amount", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>ACV Amount</label>
              <input
                type="number"
                style={inputStyle}
                value={form.acv_amount ?? ""}
                onChange={(e) => setNum("acv_amount", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Depreciation (auto)</label>
              <input
                style={readOnlyInputStyle}
                value={
                  depreciation != null ? formatCurrency(depreciation) : "—"
                }
                readOnly
              />
            </div>
            <div>
              <label style={labelStyle}>PA Estimate</label>
              <input
                type="number"
                style={inputStyle}
                value={form.pa_estimate ?? ""}
                onChange={(e) => setNum("pa_estimate", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Carrier Initial Offer</label>
              <input
                type="number"
                style={inputStyle}
                value={form.carrier_initial_offer ?? ""}
                onChange={(e) =>
                  setNum("carrier_initial_offer", e.target.value)
                }
              />
            </div>
            <div>
              <label style={labelStyle}>Settlement Amount</label>
              <input
                type="number"
                style={inputStyle}
                value={form.settlement_amount ?? ""}
                onChange={(e) => setNum("settlement_amount", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Deductible</label>
              <input
                type="number"
                style={inputStyle}
                value={form.deductible ?? ""}
                onChange={(e) => setNum("deductible", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>PA Fee %</label>
              <input
                type="number"
                style={inputStyle}
                value={form.pa_fee_percentage ?? ""}
                onChange={(e) => setNum("pa_fee_percentage", e.target.value)}
              />
            </div>
          </div>

          {/* Checkboxes row */}
          <div className="flex gap-6 mb-3">
            <label
              style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="checkbox"
                checked={form.was_supplemented || false}
                onChange={(e) => set("was_supplemented", e.target.checked)}
              />
              Was Supplemented?
            </label>
            <label
              style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="checkbox"
                checked={form.op_included || false}
                onChange={(e) => set("op_included", e.target.checked)}
              />
              O&P Included?
            </label>
          </div>

          <div
            className="grid grid-cols-3 gap-3 mb-5"
            style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
          >
            {form.was_supplemented && (
              <div>
                <label style={labelStyle}>Supplement Amount</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={form.supplement_amount ?? ""}
                  onChange={(e) => setNum("supplement_amount", e.target.value)}
                />
              </div>
            )}
            {form.op_included && (
              <div>
                <label style={labelStyle}>O&P Amount</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={form.op_amount ?? ""}
                  onChange={(e) => setNum("op_amount", e.target.value)}
                />
              </div>
            )}
            <div>
              <label style={labelStyle}>PA Fee Amount (auto, editable)</label>
              <input
                type="number"
                style={inputStyle}
                value={form.pa_fee_amount ?? paFeeAmountCalc ?? ""}
                onChange={(e) => setNum("pa_fee_amount", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Net to Client (auto)</label>
              <input
                style={readOnlyInputStyle}
                value={formatCurrency(netToClient)}
                readOnly
              />
            </div>
          </div>

          {/* Section 5 — Settlement Details */}
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            Settlement Details
          </h3>
          <div
            className="grid grid-cols-2 gap-3 mb-3"
            style={{ gridTemplateColumns: "1fr 1fr" }}
          >
            <div>
              <label style={labelStyle}>Settlement Type</label>
              <select
                style={selectStyle}
                value={form.settlement_type || ""}
                onChange={(e) =>
                  set("settlement_type", e.target.value || undefined)
                }
              >
                <option value="">Select...</option>
                {SETTLEMENT_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Settlement Status</label>
              <select
                style={selectStyle}
                value={form.settlement_status || "Open"}
                onChange={(e) => set("settlement_status", e.target.value)}
              >
                {SETTLEMENT_STATUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-5 mb-3">
            <label
              style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="checkbox"
                checked={form.forthcoming_supplement_expected || false}
                onChange={(e) =>
                  set("forthcoming_supplement_expected", e.target.checked)
                }
              />
              Forthcoming Supplement Expected?
            </label>
            <label
              style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="checkbox"
                checked={form.coverage_a || false}
                onChange={(e) => set("coverage_a", e.target.checked)}
              />
              Coverage A
            </label>
            <label
              style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="checkbox"
                checked={form.coverage_b || false}
                onChange={(e) => set("coverage_b", e.target.checked)}
              />
              Coverage B
            </label>
            <label
              style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="checkbox"
                checked={form.coverage_c || false}
                onChange={(e) => set("coverage_c", e.target.checked)}
              />
              Coverage C
            </label>
            <label
              style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="checkbox"
                checked={form.coverage_d || false}
                onChange={(e) => set("coverage_d", e.target.checked)}
              />
              Coverage D
            </label>
            <label
              style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="checkbox"
                checked={form.endorsements_settled || false}
                onChange={(e) => set("endorsements_settled", e.target.checked)}
              />
              Endorsements Settled
            </label>
          </div>

          <div className="mb-5">
            <label style={labelStyle}>Coverage Notes</label>
            <textarea
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              value={form.coverage_notes || ""}
              onChange={(e) => set("coverage_notes", e.target.value)}
            />
          </div>

          <div className="mb-5">
            <label style={labelStyle}>Notes</label>
            <textarea
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
              value={form.notes || ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 px-6 py-4"
          style={{ borderTop: "1px solid var(--border-color)" }}
        >
          <button style={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button
            style={{
              ...btnPrimary,
              opacity: !form.litigation_file_id || createMut.isPending ? 0.5 : 1,
            }}
            disabled={!form.litigation_file_id || createMut.isPending}
            onClick={handleSubmit}
          >
            {createMut.isPending ? "Creating..." : "Create Settlement"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   UPDATES PANEL MODAL
   ================================================================ */

function PAUpdatesPanel({
  settlement,
  isAdmin,
  isHistorical,
  onClose,
}: {
  settlement: PASettlementWithFile;
  isAdmin: boolean;
  isHistorical: boolean;
  onClose: () => void;
}) {
  const { supabase, userInfo } = useSTSupabase();
  const archiveMut = useArchivePASettlement();
  const unarchiveMut = useUnarchivePASettlement();
  const updateMut = useUpdatePASettlement();

  // Payment history
  const [payments, setPayments] = useState<PASettlementPayment[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    payment_type: "Initial Payment" as PaymentType,
    amount: "",
    date_received: "",
    description: "",
  });

  // Activity log
  const [updates, setUpdates] = useState<PASettlementUpdate[]>([]);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateNote, setUpdateNote] = useState("");
  const [updateNextDate, setUpdateNextDate] = useState("");

  // Carrier adjuster rating
  const [rating, setRating] = useState(settlement.carrier_adjuster_rating ?? 0);
  const [review, setReview] = useState(settlement.carrier_adjuster_review || "");

  // Archive confirmation
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Fetch payments and updates
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("pa_settlement_payments")
      .select("*")
      .eq("pa_settlement_id", settlement.id)
      .order("date_received", { ascending: false })
      .then(({ data }) => {
        if (data) setPayments(data as PASettlementPayment[]);
      });
    supabase
      .from("pa_settlement_updates")
      .select("*")
      .eq("pa_settlement_id", settlement.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setUpdates(data as PASettlementUpdate[]);
      });
  }, [supabase, settlement.id]);

  const totalReceived = useMemo(
    () => payments.reduce((sum, p) => sum + (p.amount || 0), 0),
    [payments]
  );

  const handleAddPayment = async () => {
    if (!supabase || !userInfo || !paymentForm.amount) return;
    const { data, error } = await supabase
      .from("pa_settlement_payments")
      .insert({
        pa_settlement_id: settlement.id,
        payment_type: paymentForm.payment_type,
        amount: parseFloat(paymentForm.amount),
        date_received: paymentForm.date_received || null,
        description: paymentForm.description || null,
        entered_by: userInfo.fullName,
      })
      .select()
      .single();
    if (data && !error) {
      setPayments((prev) => [data as PASettlementPayment, ...prev]);
      setPaymentForm({
        payment_type: "Initial Payment",
        amount: "",
        date_received: "",
        description: "",
      });
      setShowPaymentForm(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!supabase || !userInfo || !updateNote.trim()) return;
    const { data, error } = await supabase
      .from("pa_settlement_updates")
      .insert({
        pa_settlement_id: settlement.id,
        entered_by: userInfo.fullName,
        description: updateNote.trim(),
        next_action_date: updateNextDate || null,
      })
      .select()
      .single();
    if (data && !error) {
      setUpdates((prev) => [data as PASettlementUpdate, ...prev]);
      setUpdateNote("");
      setUpdateNextDate("");
      setShowUpdateForm(false);
    }
  };

  const handleSaveRating = () => {
    updateMut.mutate({
      id: settlement.id,
      carrier_adjuster_rating: rating || undefined,
      carrier_adjuster_review: review || undefined,
    });
  };

  const handleArchive = () => {
    if (settlement.settlement_status === "Open" && !showArchiveConfirm) {
      setShowArchiveConfirm(true);
      return;
    }
    archiveMut.mutate({ id: settlement.id, archivedBy: userInfo?.fullName || "" }, { onSuccess: onClose });
  };

  const handleUnarchive = () => {
    unarchiveMut.mutate(settlement.id, { onSuccess: onClose });
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={{ ...modalStyle, maxWidth: 960 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Settlement Details
          </h2>
          <button style={btnOutline} onClick={onClose}>
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4" style={{ flex: 1 }}>
          {/* Header card */}
          <div
            style={cardStyle}
            className="grid grid-cols-4 gap-4 mb-6"
          >
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                File #
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--accent)",
                }}
              >
                {settlement.litigation_file?.file_number || "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Client
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {settlement.litigation_file?.client_name || "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Carrier
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {settlement.carrier || "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Peril / Severity
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {settlement.peril || "—"} / {settlement.claim_severity || "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Settlement Amount
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#4ade80" }}>
                {formatCurrency(settlement.settlement_amount)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Total Received
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#4ade80" }}>
                {formatCurrency(totalReceived)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Status
              </div>
              <StatusBadge
                label={settlement.settlement_status || "Open"}
                color={getSettlementStatusBadgeColor(
                  settlement.settlement_status
                )}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Date Settled
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {formatDate(settlement.date_settled)}
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Payment History
              </h3>
              <button
                style={btnOutline}
                onClick={() => setShowPaymentForm(!showPaymentForm)}
              >
                + Add Payment
              </button>
            </div>

            {showPaymentForm && (
              <div
                style={cardStyle}
                className="grid grid-cols-4 gap-3 mb-3"
              >
                <div>
                  <label style={labelStyle}>Type</label>
                  <select
                    style={selectStyle}
                    value={paymentForm.payment_type}
                    onChange={(e) =>
                      setPaymentForm((p) => ({
                        ...p,
                        payment_type: e.target.value as PaymentType,
                      }))
                    }
                  >
                    {PAYMENT_TYPE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Amount</label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm((p) => ({
                        ...p,
                        amount: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label style={labelStyle}>Date Received</label>
                  <input
                    type="date"
                    style={inputStyle}
                    value={paymentForm.date_received}
                    onChange={(e) =>
                      setPaymentForm((p) => ({
                        ...p,
                        date_received: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label style={labelStyle}>Description</label>
                  <input
                    style={inputStyle}
                    value={paymentForm.description}
                    onChange={(e) =>
                      setPaymentForm((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="col-span-4 flex justify-end">
                  <button style={btnPrimary} onClick={handleAddPayment}>
                    Save Payment
                  </button>
                </div>
              </div>
            )}

            <div
              className="rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--border-color)" }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        style={{ ...tdStyle, textAlign: "center" }}
                      >
                        No payments recorded
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id}>
                        <td style={tdStyle}>{formatDate(p.date_received)}</td>
                        <td style={tdStyle}>{p.payment_type}</td>
                        <td
                          style={{
                            ...tdStyle,
                            color: "#4ade80",
                            fontWeight: 600,
                          }}
                        >
                          {formatCurrency(p.amount)}
                        </td>
                        <td style={tdStyle}>{p.description || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div
              className="text-sm font-semibold mt-2 text-right"
              style={{ color: "var(--text-primary)" }}
            >
              Total Received: {formatCurrency(totalReceived)} of{" "}
              {formatCurrency(settlement.settlement_amount)} agreed
            </div>
          </div>

          {/* Activity Log */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Activity Log
              </h3>
              <button
                style={btnOutline}
                onClick={() => setShowUpdateForm(!showUpdateForm)}
              >
                + Add Update
              </button>
            </div>

            {showUpdateForm && (
              <div style={cardStyle} className="mb-3">
                <div className="mb-2">
                  <label style={labelStyle}>
                    Note <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <textarea
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical" }}
                    value={updateNote}
                    onChange={(e) => setUpdateNote(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-3">
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Next Action Date (optional)</label>
                    <input
                      type="date"
                      style={inputStyle}
                      value={updateNextDate}
                      onChange={(e) => setUpdateNextDate(e.target.value)}
                    />
                  </div>
                  <button
                    style={{
                      ...btnPrimary,
                      opacity: !updateNote.trim() ? 0.5 : 1,
                    }}
                    disabled={!updateNote.trim()}
                    onClick={handleAddUpdate}
                  >
                    Save Update
                  </button>
                </div>
              </div>
            )}

            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {updates.length === 0 ? (
                <div
                  className="text-sm text-center py-4"
                  style={{ color: "var(--text-muted)" }}
                >
                  No updates yet
                </div>
              ) : (
                updates.map((u) => (
                  <div
                    key={u.id}
                    className="py-2 px-3 mb-1 rounded"
                    style={{
                      background: "var(--bg-surface)",
                      borderLeft: "3px solid var(--accent)",
                    }}
                  >
                    <div
                      className="text-xs mb-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatDate(u.created_at)}
                      {u.next_action_date &&
                        ` · Next action: ${formatDate(u.next_action_date)}`}
                    </div>
                    <div
                      className="text-sm"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {u.description}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Carrier Adjuster Rating */}
          <div className="mb-6">
            <h3
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--text-primary)" }}
            >
              Carrier Adjuster Rating
            </h3>
            <div style={cardStyle}>
              <div className="flex gap-4 items-end">
                <div>
                  <label style={labelStyle}>Rating (1-5)</label>
                  <select
                    style={{ ...selectStyle, width: 100 }}
                    value={rating}
                    onChange={(e) => setRating(parseInt(e.target.value))}
                  >
                    <option value={0}>—</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Review</label>
                  <textarea
                    rows={2}
                    style={{ ...inputStyle, resize: "vertical" }}
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                  />
                </div>
                <button style={btnPrimary} onClick={handleSaveRating}>
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Archive / Unarchive */}
          {isAdmin && (
            <div className="mb-4">
              {isHistorical ? (
                <button
                  style={{
                    ...btnOutline,
                    borderColor: "#60a5fa",
                    color: "#60a5fa",
                  }}
                  onClick={handleUnarchive}
                  disabled={unarchiveMut.isPending}
                >
                  {unarchiveMut.isPending ? "Unarchiving..." : "Unarchive"}
                </button>
              ) : (
                <>
                  <button
                    style={{
                      ...btnOutline,
                      borderColor: "#ef4444",
                      color: "#ef4444",
                    }}
                    onClick={handleArchive}
                    disabled={archiveMut.isPending}
                  >
                    {archiveMut.isPending
                      ? "Archiving..."
                      : "Close & Archive"}
                  </button>
                  {showArchiveConfirm && (
                    <div
                      className="mt-2 p-3 rounded-lg text-sm"
                      style={{
                        background: "#4a1a1a",
                        color: "#facc15",
                        border: "1px solid #ef4444",
                      }}
                    >
                      This settlement is still Open — more payments may be
                      expected. Are you sure?
                      <div className="flex gap-2 mt-2">
                        <button
                          style={{ ...btnPrimary, background: "#ef4444" }}
                          onClick={() =>
                            archiveMut.mutate({ id: settlement.id, archivedBy: userInfo?.fullName || "" }, {
                              onSuccess: onClose,
                            })
                          }
                        >
                          Yes, Archive
                        </button>
                        <button
                          style={btnOutline}
                          onClick={() => setShowArchiveConfirm(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   LIQUIDITY TAB
   ================================================================ */

function PALiquidity() {
  const { data: allSettlements = [], isLoading } =
    useAllPASettlementsForLiquidity();
  const [search, setSearch] = useState("");

  // Filtered for table
  const filtered = useMemo(() => {
    if (!search.trim()) return allSettlements;
    const q = search.toLowerCase();
    return allSettlements.filter(
      (s) =>
        s.litigation_file?.file_number?.toLowerCase().includes(q) ||
        s.litigation_file?.client_name?.toLowerCase().includes(q) ||
        s.carrier?.toLowerCase().includes(q) ||
        s.referral_source?.toLowerCase().includes(q)
    );
  }, [allSettlements, search]);

  // KPI calculations
  const totalCount = allSettlements.length;
  const totalValue = allSettlements.reduce(
    (sum, s) => sum + (s.settlement_amount || 0),
    0
  );
  const avgSettlement = totalCount > 0 ? totalValue / totalCount : 0;

  const withEstimate = allSettlements.filter(
    (s) => s.pa_estimate && s.pa_estimate > 0
  );
  const recoveryRate =
    withEstimate.length > 0
      ? (withEstimate.reduce(
          (sum, s) => sum + (s.settlement_amount || 0) / (s.pa_estimate || 1),
          0
        ) /
          withEstimate.length) *
        100
      : 0;

  const avgPAEstimate =
    withEstimate.length > 0
      ? withEstimate.reduce((sum, s) => sum + (s.pa_estimate || 0), 0) /
        withEstimate.length
      : 0;

  const withOffer = allSettlements.filter(
    (s) => s.carrier_initial_offer != null
  );
  const avgCarrierOffer =
    withOffer.length > 0
      ? withOffer.reduce(
          (sum, s) => sum + (s.carrier_initial_offer || 0),
          0
        ) / withOffer.length
      : 0;

  const spread = avgSettlement - avgCarrierOffer;

  const withDaysOpen = allSettlements.filter(
    (s) => s.days_open != null && s.days_open > 0
  );
  const avgDaysOpen =
    withDaysOpen.length > 0
      ? withDaysOpen.reduce((sum, s) => sum + (s.days_open || 0), 0) /
        withDaysOpen.length
      : 0;

  const withSquares = allSettlements.filter(
    (s) => s.number_of_squares && s.number_of_squares > 0
  );
  const avgCostPerSquare =
    withSquares.length > 0
      ? withSquares.reduce(
          (sum, s) =>
            sum + (s.settlement_amount || 0) / (s.number_of_squares || 1),
          0
        ) / withSquares.length
      : 0;

  const withDepreciation = allSettlements.filter(
    (s) => s.depreciation != null
  );
  const avgDepreciation =
    withDepreciation.length > 0
      ? withDepreciation.reduce((sum, s) => sum + (s.depreciation || 0), 0) /
        withDepreciation.length
      : 0;

  const opWinRate =
    totalCount > 0
      ? (allSettlements.filter((s) => s.op_included).length / totalCount) * 100
      : 0;

  const supplementRate =
    totalCount > 0
      ? (allSettlements.filter((s) => s.was_supplemented).length /
          totalCount) *
        100
      : 0;

  const globalReleaseRate =
    totalCount > 0
      ? (allSettlements.filter((s) => s.settlement_type === "Global Release")
          .length /
          totalCount) *
        100
      : 0;

  const avgNetToClient =
    totalCount > 0
      ? allSettlements.reduce((sum, s) => sum + (s.net_to_client || 0), 0) /
        totalCount
      : 0;

  const openSettlements = allSettlements.filter(
    (s) => s.settlement_status === "Open"
  );
  const outstandingBalance = openSettlements.reduce(
    (sum, s) =>
      sum + ((s.settlement_amount || 0) - (s.total_payments_received || 0)),
    0
  );

  function rateColor(
    val: number,
    greenThresh: number,
    yellowThresh: number
  ): string {
    if (val >= greenThresh) return "#1a3a2a";
    if (val >= yellowThresh) return "#3a3520";
    return "#4a1a1a";
  }
  function rateTextColor(
    val: number,
    greenThresh: number,
    yellowThresh: number
  ): string {
    if (val >= greenThresh) return "#4ade80";
    if (val >= yellowThresh) return "#facc15";
    return "#ef4444";
  }

  const kpiCards: {
    label: string;
    value: string;
    bg?: string;
    textColor?: string;
  }[] = [
    { label: "Total Settlements", value: totalCount.toString() },
    { label: "Total Settlement Value", value: formatCurrency(totalValue) },
    { label: "Avg Settlement", value: formatCurrency(avgSettlement) },
    {
      label: "Recovery Rate",
      value: recoveryRate.toFixed(1) + "%",
      bg: rateColor(recoveryRate, 90, 75),
      textColor: rateTextColor(recoveryRate, 90, 75),
    },
    { label: "Avg PA Estimate", value: formatCurrency(avgPAEstimate) },
    { label: "Avg Carrier Initial Offer", value: formatCurrency(avgCarrierOffer) },
    {
      label: "Spread",
      value: formatCurrency(spread),
      bg: spread > 0 ? "#1a3a2a" : "#4a1a1a",
      textColor: spread > 0 ? "#4ade80" : "#ef4444",
    },
    { label: "Avg Days Open", value: avgDaysOpen.toFixed(0) },
    {
      label: "Avg Cost Per Square",
      value: formatCurrencyDecimal(avgCostPerSquare),
    },
    { label: "Avg Depreciation", value: formatCurrency(avgDepreciation) },
    {
      label: "O&P Win Rate",
      value: opWinRate.toFixed(1) + "%",
      bg: rateColor(opWinRate, 70, 50),
      textColor: rateTextColor(opWinRate, 70, 50),
    },
    { label: "Supplement Rate", value: supplementRate.toFixed(1) + "%" },
    {
      label: "Global Release Rate",
      value: globalReleaseRate.toFixed(1) + "%",
      bg: rateColor(globalReleaseRate, 80, 60),
      textColor: rateTextColor(globalReleaseRate, 80, 60),
    },
    { label: "Avg Net to Client", value: formatCurrency(avgNetToClient) },
    {
      label: "Outstanding Balance",
      value: formatCurrency(outstandingBalance),
      bg: outstandingBalance > 0 ? "#4a1a1a" : "#1a3a2a",
      textColor: outstandingBalance > 0 ? "#ef4444" : "#4ade80",
    },
  ];

  if (isLoading) {
    return (
      <div className="text-center py-10" style={{ color: "var(--text-muted)" }}>
        Loading liquidity data...
      </div>
    );
  }

  return (
    <div>
      {/* KPI Cards */}
      <div
        className="grid gap-3 mb-6"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        }}
      >
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            style={{
              ...cardStyle,
              background: kpi.bg || "var(--bg-surface)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                marginBottom: 4,
              }}
            >
              {kpi.label}
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: kpi.textColor || "var(--text-primary)",
              }}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          style={{ ...inputStyle, maxWidth: 360 }}
          placeholder="Search by file #, client, carrier, referral source..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Liquidity Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-sm" style={{ minWidth: 1400 }}>
            <thead>
              <tr>
                <th style={thStyle}>File #</th>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Referral Source</th>
                <th style={thStyle}>Carrier</th>
                <th style={thStyle}>Peril</th>
                <th style={thStyle}>PA Estimate</th>
                <th style={thStyle}>Carrier Offer</th>
                <th style={thStyle}>Settlement</th>
                <th style={thStyle}>Received</th>
                <th style={thStyle}>Cost/Sq</th>
                <th style={thStyle}>PA Fee %</th>
                <th style={thStyle}>Net to Client</th>
                <th style={thStyle}>Days Open</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={14} style={{ ...tdStyle, textAlign: "center" }}>
                    No records found
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id}>
                    <td
                      style={{
                        ...tdStyle,
                        color: "var(--accent)",
                        fontWeight: 600,
                      }}
                    >
                      {s.litigation_file?.file_number || "—"}
                    </td>
                    <td style={tdStyle}>
                      {s.litigation_file?.client_name || "—"}
                    </td>
                    <td style={tdStyle}>{s.referral_source || "—"}</td>
                    <td style={tdStyle}>{s.carrier || "—"}</td>
                    <td style={tdStyle}>{s.peril || "—"}</td>
                    <td style={tdStyle}>
                      {formatCurrency(s.pa_estimate)}
                    </td>
                    <td style={tdStyle}>
                      {formatCurrency(s.carrier_initial_offer)}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "#4ade80",
                        fontWeight: 600,
                      }}
                    >
                      {formatCurrency(s.settlement_amount)}
                    </td>
                    <td style={tdStyle}>
                      {formatCurrency(s.total_payments_received)}
                    </td>
                    <td style={tdStyle}>
                      {s.number_of_squares && s.number_of_squares > 0
                        ? formatCurrencyDecimal(
                            (s.settlement_amount || 0) / s.number_of_squares
                          )
                        : "—"}
                    </td>
                    <td style={tdStyle}>
                      {s.pa_fee_percentage != null
                        ? s.pa_fee_percentage + "%"
                        : "—"}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "#4ade80",
                        fontWeight: 600,
                      }}
                    >
                      {formatCurrency(s.net_to_client)}
                    </td>
                    <td style={tdStyle}>{s.days_open ?? "—"}</td>
                    <td style={tdStyle}>
                      <StatusBadge
                        label={s.settlement_status || "Open"}
                        color={getSettlementStatusBadgeColor(
                          s.settlement_status
                        )}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
