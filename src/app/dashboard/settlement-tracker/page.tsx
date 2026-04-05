"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { useLitigationFiles, useCreateLitigationFile, useUpdateLitigationFile, useDeleteLitigationFiles } from "@/hooks/settlement-tracker";
import { useLegalActions, useCreateLegalAction, useUpdateLegalAction, useDeleteLegalActions, useBulkUpdateLegalActions, useBulkLitigationFileRollups, useLitigationFileRollups } from "@/hooks/settlement-tracker";
import { useSettlements, useSettlementByFileId, useCreateSettlement, useUpdateSettlement, useDeleteSettlement } from "@/hooks/settlement-tracker";
import { useAttorneyScorecard, computeReferralMetrics } from "@/hooks/settlement-tracker";
import { useStateRequirements } from "@/hooks/settlement-tracker";
import { useSTSupabase } from "@/hooks/settlement-tracker";
import {
  LitigationFile,
  CreateLitigationFileInput,
  calculateDaysSinceOnboarded,
  isCRNExpired61,
  isCRNUnlockReady,
  hasPostCRNStep,
  isOverdue,
  isDueSoon,
  CSV_HEADERS,
} from "@/types/settlement-tracker/litigation";
import {
  LegalAction,
  CreateLegalActionInput,
  LegalActionType,
  LitigationFileRollups,
  ACTION_TYPE_OPTIONS,
  ACTION_STATUS_OPTIONS,
  DEFAULT_TITLES,
  getActionStatusClassName,
  getActionTypeClassName,
  formatScheduledDate,
} from "@/types/settlement-tracker/legalAction";
import {
  Settlement,
  SettlementFormData,
  calculateSettlementValues,
} from "@/types/settlement-tracker/settlement";
import {
  derivePhaseFromSteps,
  deriveStatusFromSteps,
} from "@/hooks/settlement-tracker/usePhaseStatusAutoSync";

/* ── styles ───────────────────────────────────────────── */

const cardStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  borderRadius: 10,
  padding: "18px 22px",
  border: "1px solid var(--border-color)",
};

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

const btnPrimary: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnOutline: React.CSSProperties = {
  background: "transparent",
  color: "var(--text-primary)",
  border: "1px solid var(--border-color)",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  width: "100%",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--text-secondary)",
  display: "block",
  marginBottom: 4,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.6)",
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

const TRACKS = [
  {
    key: "litigation",
    title: "Litigation",
    description: "Attorney-managed legal disputes with state-specific workflows",
    icon: "M12 3L2 8l10 5 10-5-10-5z M4 8v7 M20 8v7 M12 13v5",
  },
  {
    key: "appraisal",
    title: "Appraisal",
    description: "Property damage appraisal disputes and umpire proceedings",
    icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2 M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z M9 14l2 2 4-4",
  },
  {
    key: "mediation",
    title: "Mediation / Arbitration",
    description: "ADR proceedings with mediator tracking and ratings",
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  },
  {
    key: "pa-settlements",
    title: "PA Settlements",
    description: "Public adjuster direct settlement ledger and payment tracking",
    icon: "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  },
];

const CLOSED_STATUSES = ["Settled", "Closed (No Pay)"];

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

function formatDate(dateString?: string | null) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString();
}

function truncate(text?: string | null, max = 40) {
  if (!text) return "—";
  return text.length > max ? text.substring(0, max) + "..." : text;
}

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
      style={{ background: bgMap[color] || bgMap.gray, color: textMap[color] || textMap.gray }}
    >
      {label}
    </span>
  );
}

function TrackIcon({ path, size = 32 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {path.split(" M").map((d, i) => (
        <path key={i} d={i === 0 ? d : "M" + d} />
      ))}
    </svg>
  );
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCurrency(amount: number | null | undefined) {
  if (amount == null) return "—";
  return currencyFormatter.format(amount);
}

function formatPercentage(value: number | null | undefined) {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

type Track = "landing" | "litigation" | "appraisal" | "mediation" | "pa-settlements";
type LitigationTab = "active" | "historical" | "attorneys" | "referrals" | "liquidity";

export default function SettlementTrackerPage() {
  const { userInfo } = useSTSupabase();
  const [track, setTrack] = useState<Track>("landing");
  const [litTab, setLitTab] = useState<LitigationTab>("active");

  const isAdmin = userInfo ? ADMIN_ROLES.includes(userInfo.role) : false;

  /* ── litigation data ── */
  const { data: allFiles = [], isLoading: filesLoading } = useLitigationFiles();
  const activeFiles = useMemo(() => allFiles.filter((f) => !CLOSED_STATUSES.includes(f.status)), [allFiles]);
  const historicalFiles = useMemo(() => allFiles.filter((f) => CLOSED_STATUSES.includes(f.status)), [allFiles]);
  const displayFiles = litTab === "active" ? activeFiles : historicalFiles;

  /* ── state for forms/modals ── */
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingFile, setEditingFile] = useState<LitigationFile | null>(null);
  const [stepsFile, setStepsFile] = useState<LitigationFile | null>(null);

  /* ── sorting ── */
  const [sortField, setSortField] = useState("date_attorney_onboarded");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (field: string) => {
    if (field === sortField) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const sortedFiles = useMemo(() => {
    return [...displayFiles].sort((a, b) => {
      let aVal: any = sortField === "daysSince"
        ? calculateDaysSinceOnboarded(a.date_attorney_onboarded)
        : a[sortField as keyof LitigationFile];
      let bVal: any = sortField === "daysSince"
        ? calculateDaysSinceOnboarded(b.date_attorney_onboarded)
        : b[sortField as keyof LitigationFile];
      if (!aVal) aVal = "";
      if (!bVal) bVal = "";
      return sortDir === "asc" ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
  }, [displayFiles, sortField, sortDir]);

  /* ── rollups ── */
  const fileIds = useMemo(() => displayFiles.map((f) => f.id), [displayFiles]);
  const { data: rollupsMap = {} } = useBulkLitigationFileRollups(fileIds);

  /* ── mutations ── */
  const createFile = useCreateLitigationFile();
  const updateFile = useUpdateLitigationFile();
  const deleteFiles = useDeleteLitigationFiles();

  const handleCreateFile = async (data: CreateLitigationFileInput) => {
    if (!userInfo) return;
    await createFile.mutateAsync({
      ...data,
      created_by_name: userInfo.fullName,
      created_by_email: userInfo.email,
    });
    setShowCreateForm(false);
  };

  const handleUpdateFile = async (data: CreateLitigationFileInput) => {
    if (!editingFile) return;
    await updateFile.mutateAsync({ id: editingFile.id, ...data });
    setEditingFile(null);
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.length === 0) return;
    if (!confirm(`Delete ${selectedFiles.length} file(s)? This cannot be undone.`)) return;
    await deleteFiles.mutateAsync(selectedFiles);
    setSelectedFiles([]);
  };

  const handleExportCSV = () => {
    if (allFiles.length === 0) return;
    const csvRows = [CSV_HEADERS];
    allFiles.forEach((file) => {
      csvRows.push(
        [
          file.file_number,
          file.client_name,
          file.date_attorney_onboarded,
          file.attorney_firm,
          file.attorney_contact || "",
          file.referral_source,
          file.status,
          file.phase,
          file.policy_number || "",
          file.loss_address || "",
          file.date_crn_filed || "",
          (file.notes || "").replace(/"/g, '""'),
        ]
          .map((f) => `"${f}"`)
          .join(",")
      );
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `litigation-files-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  /* ── checkbox helpers ── */
  const allSelected = sortedFiles.length > 0 && selectedFiles.length === sortedFiles.length;

  const toggleSelectAll = () => {
    setSelectedFiles(allSelected ? [] : sortedFiles.map((f) => f.id));
  };

  const toggleSelect = (id: string) => {
    setSelectedFiles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  /* ── RENDER ── */

  // Landing page — track selector
  if (track === "landing") {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Settlement Tracker
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Multi-track dispute resolution management. Select a track to continue.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {TRACKS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTrack(t.key as Track)}
              className="text-left transition-all"
              style={{
                ...cardStyle,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-color)";
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="shrink-0 rounded-lg p-3"
                  style={{ background: "var(--bg-hover)", color: "var(--accent)" }}
                >
                  <TrackIcon path={t.icon} />
                </div>
                <div>
                  <h3 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                    {t.title}
                  </h3>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {t.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Placeholder for non-litigation tracks (Sessions 20-21)
  if (track !== "litigation") {
    return (
      <div className="p-6">
        <button
          onClick={() => setTrack("landing")}
          className="text-sm mb-4 flex items-center gap-1"
          style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
        >
          &larr; All Tracks
        </button>
        <div className="rounded-xl p-12 text-center" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
          <p className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            {TRACKS.find((t) => t.key === track)?.title}
          </p>
          <p style={{ color: "var(--text-secondary)" }}>Coming soon</p>
        </div>
      </div>
    );
  }

  /* ── LITIGATION TRACK ── */
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setTrack("landing")}
            className="text-sm flex items-center gap-1"
            style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
          >
            &larr; All Tracks
          </button>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Litigation
          </h1>
        </div>
        <div className="flex gap-2">
          <button style={btnOutline} onClick={handleExportCSV}>
            Export CSV
          </button>
          {isAdmin && (
            <button style={btnPrimary} onClick={() => setShowCreateForm(true)}>
              + New File
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5">
        {(
          [
            { key: "active", label: `Active (${activeFiles.length})` },
            { key: "historical", label: `Historical (${historicalFiles.length})` },
            ...(isAdmin
              ? [
                  { key: "attorneys", label: "Attorney Scorecards" },
                  { key: "referrals", label: "Referral Analysis" },
                  { key: "liquidity", label: "Liquidity" },
                ]
              : []),
          ] as { key: LitigationTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setLitTab(tab.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            style={{
              background: litTab === tab.key ? "var(--bg-hover)" : "transparent",
              color: litTab === tab.key ? "var(--text-primary)" : "var(--text-muted)",
              border: "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {(litTab === "active" || litTab === "historical") && (
        <LitigationDataGrid
          files={sortedFiles}
          allFiles={displayFiles}
          selectedFiles={selectedFiles}
          rollupsMap={rollupsMap}
          isLoading={filesLoading}
          isAdmin={isAdmin}
          allSelected={allSelected}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelect={toggleSelect}
          onEdit={setEditingFile}
          onViewSteps={setStepsFile}
          onDeleteSelected={handleDeleteSelected}
        />
      )}

      {litTab === "attorneys" && <AttorneyScorecardView />}
      {litTab === "referrals" && <ReferralAnalysisView />}
      {litTab === "liquidity" && <LiquidityView />}

      {/* Create File Modal */}
      {showCreateForm && (
        <LitigationFileModal
          onSubmit={handleCreateFile}
          onClose={() => setShowCreateForm(false)}
          isLoading={createFile.isPending}
        />
      )}

      {/* Edit File Modal */}
      {editingFile && (
        <LitigationFileModal
          initialData={editingFile}
          onSubmit={handleUpdateFile}
          onClose={() => setEditingFile(null)}
          isLoading={updateFile.isPending}
        />
      )}

      {/* Steps Panel Modal */}
      {stepsFile && (
        <StepsPanelModal
          litigationFile={stepsFile}
          onClose={() => setStepsFile(null)}
        />
      )}
    </div>
  );
}

/* ================================================================
   LITIGATION DATA GRID
   ================================================================ */

function LitigationDataGrid({
  files,
  allFiles,
  selectedFiles,
  rollupsMap,
  isLoading,
  isAdmin,
  allSelected,
  sortField,
  sortDir,
  onSort,
  onToggleSelectAll,
  onToggleSelect,
  onEdit,
  onViewSteps,
  onDeleteSelected,
}: {
  files: LitigationFile[];
  allFiles: LitigationFile[];
  selectedFiles: string[];
  rollupsMap: Record<string, LitigationFileRollups>;
  isLoading: boolean;
  isAdmin: boolean;
  allSelected: boolean;
  sortField: string;
  sortDir: "asc" | "desc";
  onSort: (field: string) => void;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onEdit: (file: LitigationFile) => void;
  onViewSteps: (file: LitigationFile) => void;
  onDeleteSelected: () => void;
}) {
  const sortIndicator = (field: string) =>
    sortField === field ? (sortDir === "asc" ? " \u25B2" : " \u25BC") : "";

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {files.length} of {allFiles.length} files &middot; {selectedFiles.length} selected
        </span>
        {isAdmin && selectedFiles.length > 0 && (
          <button
            onClick={onDeleteSelected}
            className="text-xs px-3 py-1 rounded"
            style={{ background: "#4a1a1a", color: "#ef4444", border: "1px solid #ef444444", cursor: "pointer" }}
          >
            Delete Selected ({selectedFiles.length})
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
      >
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-sm" style={{ minWidth: 1200 }}>
            <thead>
              <tr>
                {isAdmin && (
                  <th style={{ ...thStyle, width: 40, cursor: "default" }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onToggleSelectAll}
                      className="accent-[var(--accent)]"
                    />
                  </th>
                )}
                <th style={{ ...thStyle, width: 50 }} onClick={() => onSort("state")}>
                  State{sortIndicator("state")}
                </th>
                <th style={thStyle} onClick={() => onSort("file_number")}>
                  File #{sortIndicator("file_number")}
                </th>
                <th style={thStyle} onClick={() => onSort("client_name")}>
                  Client{sortIndicator("client_name")}
                </th>
                <th style={thStyle} onClick={() => onSort("referral_source")}>
                  Contractor{sortIndicator("referral_source")}
                </th>
                <th style={thStyle} onClick={() => onSort("attorney_firm")}>
                  Law Firm{sortIndicator("attorney_firm")}
                </th>
                <th style={thStyle} onClick={() => onSort("attorney_contact")}>
                  Attorney{sortIndicator("attorney_contact")}
                </th>
                <th style={thStyle} onClick={() => onSort("next_action")}>
                  Next Action{sortIndicator("next_action")}
                </th>
                <th style={thStyle} onClick={() => onSort("next_action_date")}>
                  Due{sortIndicator("next_action_date")}
                </th>
                <th style={{ ...thStyle, width: 30, cursor: "default" }} title="Traffic Light">
                  TL
                </th>
                <th style={thStyle} onClick={() => onSort("date_attorney_onboarded")}>
                  Onboarded{sortIndicator("date_attorney_onboarded")}
                </th>
                <th style={thStyle} onClick={() => onSort("daysSince")}>
                  Days{sortIndicator("daysSince")}
                </th>
                <th style={{ ...thStyle, cursor: "default" }}>Updates</th>
                <th style={{ ...thStyle, cursor: "default" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 14 : 13} style={{ ...tdStyle, textAlign: "center", padding: 32 }}>
                    <span style={{ color: "var(--text-muted)" }}>Loading litigation files...</span>
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 14 : 13} style={{ ...tdStyle, textAlign: "center", padding: 32 }}>
                    <span style={{ color: "var(--text-muted)" }}>No litigation files found.</span>
                  </td>
                </tr>
              ) : (
                files.map((file) => {
                  const days = calculateDaysSinceOnboarded(file.date_attorney_onboarded);
                  const selected = selectedFiles.includes(file.id);
                  const rollups = rollupsMap[file.id];

                  return (
                    <tr
                      key={file.id}
                      onClick={() => onEdit(file)}
                      style={{
                        cursor: "pointer",
                        borderBottom: "1px solid var(--border-color)",
                        background: selected ? "var(--bg-hover)" : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!selected) e.currentTarget.style.background = "var(--bg-hover)";
                      }}
                      onMouseLeave={(e) => {
                        if (!selected) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {isAdmin && (
                        <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => onToggleSelect(file.id)}
                            className="accent-[var(--accent)]"
                          />
                        </td>
                      )}
                      <td style={tdStyle}>
                        <span
                          className="text-[11px] font-mono px-1.5 py-0.5 rounded"
                          style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}
                        >
                          {file.state}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: "var(--accent)", fontWeight: 600 }}>
                        {file.file_number}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{file.client_name}</td>
                      <td style={tdStyle}>{file.referral_source}</td>
                      <td style={tdStyle}>{file.attorney_firm}</td>
                      <td style={tdStyle}>{file.attorney_contact || "—"}</td>
                      <td style={tdStyle}>{truncate(file.next_action, 25)}</td>
                      <td style={tdStyle}>{formatDate(file.next_action_date)}</td>
                      <td style={tdStyle}>
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: getTrafficLightColor(file.next_action_date),
                          }}
                          title={file.next_action_date || "No due date"}
                        />
                      </td>
                      <td style={tdStyle}>{formatDate(file.date_attorney_onboarded)}</td>
                      <td style={tdStyle}>
                        <span
                          className="text-[11px] px-1.5 py-0.5 rounded"
                          style={{ background: "var(--bg-hover)" }}
                        >
                          {days}d
                        </span>
                      </td>
                      <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                        <button
                          style={{ ...btnOutline, fontSize: 11, padding: "2px 8px" }}
                          onClick={() => onViewSteps(file)}
                        >
                          {rollups?.stepCount ?? 0} updates
                        </button>
                      </td>
                      <td style={tdStyle}>{truncate(file.notes, 30)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   LITIGATION FILE FORM MODAL
   ================================================================ */

const SUPPORTED_STATES = [
  { code: "FL", name: "Florida" },
  { code: "TX", name: "Texas" },
  { code: "GA", name: "Georgia" },
  { code: "LA", name: "Louisiana" },
  { code: "SC", name: "South Carolina" },
];

const PERILS = ["Hurricane", "Hail", "Wind", "Water", "Fire", "Flood", "Mold", "Tornado", "Theft", "Lightning", "Vandalism", "Liability", "Other"];

function LitigationFileModal({
  initialData,
  onSubmit,
  onClose,
  isLoading,
}: {
  initialData?: LitigationFile;
  onSubmit: (data: CreateLitigationFileInput) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<CreateLitigationFileInput>({
    file_number: initialData?.file_number || "",
    client_name: initialData?.client_name || "",
    date_attorney_onboarded: initialData?.date_attorney_onboarded || new Date().toISOString().split("T")[0],
    attorney_firm: initialData?.attorney_firm || "",
    attorney_contact: initialData?.attorney_contact || "",
    referral_source: initialData?.referral_source || "",
    status: initialData?.status || "Open",
    phase: initialData?.phase || "Attorney Onboarding",
    next_action: initialData?.next_action || "",
    next_action_date: initialData?.next_action_date || "",
    policy_number: initialData?.policy_number || "",
    loss_address: initialData?.loss_address || "",
    date_crn_filed: initialData?.date_crn_filed || "",
    state: initialData?.state || "FL",
    peril: initialData?.peril || "",
    notes: initialData?.notes || "",
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.file_number.trim() || !form.client_name.trim()) return;
    onSubmit(form);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {initialData ? "Edit Litigation File" : "New Litigation File"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 pt-2">
          {/* State */}
          <div className="mb-4">
            <label style={labelStyle}>State *</label>
            <select
              value={form.state}
              onChange={(e) => update("state", e.target.value)}
              style={{ ...selectStyle, width: 200 }}
            >
              {SUPPORTED_STATES.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>File Number *</label>
              <input style={inputStyle} value={form.file_number} onChange={(e) => update("file_number", e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Client Name *</label>
              <input style={inputStyle} value={form.client_name} onChange={(e) => update("client_name", e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Attorney Onboarded Date *</label>
              <input style={inputStyle} type="date" value={form.date_attorney_onboarded} onChange={(e) => update("date_attorney_onboarded", e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Attorney Firm *</label>
              <input style={inputStyle} value={form.attorney_firm} onChange={(e) => update("attorney_firm", e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Contractor (Referral Source) *</label>
              <input style={inputStyle} value={form.referral_source} onChange={(e) => update("referral_source", e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Attorney Contact</label>
              <input style={inputStyle} value={form.attorney_contact || ""} onChange={(e) => update("attorney_contact", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Next Action</label>
              <input style={inputStyle} value={form.next_action || ""} onChange={(e) => update("next_action", e.target.value)} placeholder="e.g. Deposition of corporate rep" />
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input style={inputStyle} type="date" value={form.next_action_date || ""} onChange={(e) => update("next_action_date", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Peril</label>
              <select style={selectStyle} value={form.peril || ""} onChange={(e) => update("peril", e.target.value)}>
                <option value="">Select peril...</option>
                {PERILS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Policy Number</label>
              <input style={inputStyle} value={form.policy_number || ""} onChange={(e) => update("policy_number", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Loss Address</label>
              <input style={inputStyle} value={form.loss_address || ""} onChange={(e) => update("loss_address", e.target.value)} />
            </div>
          </div>

          <div className="mt-4">
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
              value={form.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Short operational notes..."
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button type="submit" style={btnPrimary} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save"}
            </button>
            <button type="button" style={btnOutline} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================================================================
   STEPS PANEL MODAL (Legal Action Updates)
   ================================================================ */

function StepsPanelModal({
  litigationFile,
  onClose,
}: {
  litigationFile: LitigationFile;
  onClose: () => void;
}) {
  const { userInfo } = useSTSupabase();
  const { data: steps = [], isLoading } = useLegalActions(litigationFile.id);
  const createStep = useCreateLegalAction();
  const updateStep = useUpdateLegalAction();
  const deleteSteps = useDeleteLegalActions();
  const bulkUpdate = useBulkUpdateLegalActions();

  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [showStepForm, setShowStepForm] = useState(false);
  const [editingStep, setEditingStep] = useState<LegalAction | null>(null);

  const handleCreateStep = async (data: CreateLegalActionInput) => {
    if (!userInfo) return;
    await createStep.mutateAsync({
      ...data,
      created_by_name: userInfo.fullName,
      created_by_email: userInfo.email,
    });
    setShowStepForm(false);
  };

  const handleUpdateStep = async (data: CreateLegalActionInput) => {
    if (!editingStep) return;
    await updateStep.mutateAsync({ id: editingStep.id, ...data });
    setEditingStep(null);
  };

  const handleDeleteSelected = async () => {
    if (selectedSteps.length === 0) return;
    if (!confirm(`Delete ${selectedSteps.length} update(s)?`)) return;
    await deleteSteps.mutateAsync(selectedSteps);
    setSelectedSteps([]);
  };

  const handleBulkComplete = async () => {
    if (selectedSteps.length === 0) return;
    await bulkUpdate.mutateAsync({
      ids: selectedSteps,
      updates: { status: "Completed", completed_date: new Date().toISOString().split("T")[0] },
    });
    setSelectedSteps([]);
  };

  const handleQuickComplete = async (stepId: string) => {
    await updateStep.mutateAsync({
      id: stepId,
      status: "Completed",
      completed_date: new Date().toISOString().split("T")[0],
    });
  };

  const openSteps = steps.filter((s) => !["Completed", "Skipped", "Canceled"].includes(s.status)).length;
  const nextDue = steps
    .filter((s) => ["Planned", "Scheduled"].includes(s.status) && s.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0]?.due_date;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={{ ...modalStyle, maxWidth: 1100, maxHeight: "95vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Legal Action Updates
            </h2>
            <button onClick={onClose} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>
              &times;
            </button>
          </div>

          {/* File info bar */}
          <div
            className="rounded-lg p-4 flex flex-wrap gap-6 text-sm"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)" }}
          >
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>File #</span>
              <div className="font-semibold">{litigationFile.file_number}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Client</span>
              <div>{litigationFile.client_name}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Law Firm</span>
              <div>{litigationFile.attorney_firm}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Attorney</span>
              <div>{litigationFile.attorney_contact || "—"}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Contractor</span>
              <div>{litigationFile.referral_source}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Status</span>
              <div>
                <StatusBadge label={litigationFile.status} color="blue" />
              </div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Open Updates</span>
              <div>{openSteps}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>Next Due</span>
              <div>{formatDate(nextDue)}</div>
            </div>
          </div>
        </div>

        {/* Steps content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {/* Action bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              {selectedSteps.length > 0 && (
                <>
                  <button style={{ ...btnOutline, fontSize: 11 }} onClick={handleBulkComplete}>
                    Complete ({selectedSteps.length})
                  </button>
                  <button
                    style={{ ...btnOutline, fontSize: 11, borderColor: "#ef444444", color: "#ef4444" }}
                    onClick={handleDeleteSelected}
                  >
                    Delete ({selectedSteps.length})
                  </button>
                </>
              )}
            </div>
            <button style={btnPrimary} onClick={() => setShowStepForm(true)}>
              + Add Update
            </button>
          </div>

          {/* Steps table */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 40, cursor: "default" }}>
                    <input
                      type="checkbox"
                      checked={steps.length > 0 && selectedSteps.length === steps.length}
                      onChange={() =>
                        setSelectedSteps(
                          selectedSteps.length === steps.length ? [] : steps.map((s) => s.id)
                        )
                      }
                      className="accent-[var(--accent)]"
                    />
                  </th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Due Date</th>
                  <th style={thStyle}>Completed</th>
                  <th style={thStyle}>Result</th>
                  <th style={thStyle}>Notes</th>
                  <th style={{ ...thStyle, width: 60, cursor: "default" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} style={{ ...tdStyle, textAlign: "center", padding: 24 }}>
                      <span style={{ color: "var(--text-muted)" }}>Loading updates...</span>
                    </td>
                  </tr>
                ) : steps.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ ...tdStyle, textAlign: "center", padding: 24 }}>
                      <span style={{ color: "var(--text-muted)" }}>No updates yet.</span>
                    </td>
                  </tr>
                ) : (
                  steps.map((step) => {
                    const isComplete = step.status === "Completed";
                    return (
                      <tr
                        key={step.id}
                        style={{
                          borderBottom: "1px solid var(--border-color)",
                          opacity: isComplete ? 0.6 : 1,
                          cursor: "pointer",
                        }}
                        onClick={() => setEditingStep(step)}
                      >
                        <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedSteps.includes(step.id)}
                            onChange={() =>
                              setSelectedSteps((prev) =>
                                prev.includes(step.id)
                                  ? prev.filter((x) => x !== step.id)
                                  : [...prev, step.id]
                              )
                            }
                            className="accent-[var(--accent)]"
                          />
                        </td>
                        <td style={tdStyle}>
                          <StatusBadge label={step.action_type} color="blue" />
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{step.title}</td>
                        <td style={tdStyle}>
                          <StatusBadge
                            label={step.status}
                            color={
                              step.status === "Completed" ? "green" :
                              step.status === "Scheduled" ? "yellow" :
                              step.status === "Canceled" || step.status === "Skipped" ? "gray" : "blue"
                            }
                          />
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: step.due_date && isOverdue(step.due_date) && !isComplete ? "#ef4444" : undefined }}>
                            {formatDate(step.due_date)}
                          </span>
                        </td>
                        <td style={tdStyle}>{formatDate(step.completed_date)}</td>
                        <td style={tdStyle}>{truncate(step.result, 25)}</td>
                        <td style={tdStyle}>{truncate(step.notes, 25)}</td>
                        <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                          {!isComplete && (
                            <button
                              style={{ ...btnOutline, fontSize: 10, padding: "2px 6px" }}
                              onClick={() => handleQuickComplete(step.id)}
                              title="Mark complete"
                            >
                              &#10003;
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Step form modal */}
        {(showStepForm || editingStep) && (
          <StepFormModal
            litigationFileId={litigationFile.id}
            initialData={editingStep || undefined}
            onSubmit={editingStep ? handleUpdateStep : handleCreateStep}
            onClose={() => { setShowStepForm(false); setEditingStep(null); }}
            isLoading={editingStep ? updateStep.isPending : createStep.isPending}
          />
        )}
      </div>
    </div>
  );
}

/* ================================================================
   STEP FORM MODAL
   ================================================================ */

function StepFormModal({
  litigationFileId,
  initialData,
  onSubmit,
  onClose,
  isLoading,
}: {
  litigationFileId: string;
  initialData?: LegalAction;
  onSubmit: (data: CreateLegalActionInput) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const isEditing = !!initialData;

  const [form, setForm] = useState<CreateLegalActionInput>({
    litigation_file_id: litigationFileId,
    action_type: initialData?.action_type || "CRN",
    status: initialData?.status || "Planned",
    title: initialData?.title || DEFAULT_TITLES["CRN"],
    due_date: initialData?.due_date || "",
    scheduled_date: initialData?.scheduled_date || "",
    completed_date: initialData?.completed_date || "",
    order_index: initialData?.order_index || 0,
    result: initialData?.result || "",
    notes: initialData?.notes || "",
    doc_links: initialData?.doc_links || "",
  });

  const update = (field: string, value: string | number) => setForm((f) => ({ ...f, [field]: value }));

  // Auto-update title on action type change (new steps only)
  const handleTypeChange = (type: string) => {
    update("action_type", type);
    if (!initialData?.title) {
      update("title", DEFAULT_TITLES[type as LegalActionType] || type);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSubmit(form);
  };

  return (
    <div style={{ ...overlayStyle, zIndex: 60 }} onClick={onClose}>
      <div
        style={{ ...modalStyle, maxWidth: 700 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-3">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {isEditing ? "Edit Update" : "New Update"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Action Type *</label>
              <select
                style={selectStyle}
                value={form.action_type}
                onChange={(e) => handleTypeChange(e.target.value)}
              >
                {ACTION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Title *</label>
              <input style={inputStyle} value={form.title} onChange={(e) => update("title", e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Due Date *</label>
              <input style={inputStyle} type="date" value={form.due_date || ""} onChange={(e) => update("due_date", e.target.value)} required />
            </div>
            {isEditing && (
              <>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select style={selectStyle} value={form.status} onChange={(e) => update("status", e.target.value)}>
                    {ACTION_STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                {form.status === "Completed" && (
                  <div>
                    <label style={labelStyle}>Completed Date</label>
                    <input style={inputStyle} type="date" value={form.completed_date || ""} onChange={(e) => update("completed_date", e.target.value)} />
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Result</label>
                  <input style={inputStyle} value={form.result || ""} onChange={(e) => update("result", e.target.value)} placeholder="e.g. Mediated: impasse" />
                </div>
              </>
            )}
          </div>

          <div className="mt-4">
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle, minHeight: 50, resize: "vertical" }}
              value={form.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button type="submit" style={btnPrimary} disabled={isLoading}>
              {isLoading ? "Saving..." : isEditing ? "Save" : "Add Update"}
            </button>
            <button type="button" style={btnOutline} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================================================================
   ATTORNEY SCORECARD VIEW
   ================================================================ */

function AttorneyScorecardView() {
  const metrics = useAttorneyScorecard();
  const [sortBy, setSortBy] = useState<string>("totalFiles");
  const [sortDesc, setSortDesc] = useState(true);

  const handleSort = (field: string) => {
    if (sortBy === field) setSortDesc(!sortDesc);
    else { setSortBy(field); setSortDesc(true); }
  };

  const sorted = [...metrics].sort((a, b) => {
    const aVal = (a as any)[sortBy] ?? 0;
    const bVal = (b as any)[sortBy] ?? 0;
    return sortDesc ? bVal - aVal : aVal - bVal;
  });

  if (metrics.length === 0) {
    return (
      <div className="rounded-xl p-12 text-center" style={{ background: "var(--bg-secondary)" }}>
        <p style={{ color: "var(--text-secondary)" }}>No attorney data available yet.</p>
      </div>
    );
  }

  const avg = (arr: (number | null)[]) => {
    const valid = arr.filter((v): v is number => v != null && !isNaN(v));
    return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  };

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Attorneys", value: String(metrics.length) },
          { label: "Active Files", value: String(metrics.reduce((a, m) => a + m.openFiles, 0)) },
          { label: "Avg Days to CRN", value: String(Math.round(avg(metrics.map((m) => m.avgDaysToCRN))) || "—") },
          { label: "Avg Settlement", value: formatCurrency(avg(metrics.map((m) => m.avgSettlementAmount))) },
          { label: "Avg Fee Rate", value: formatPercentage(avg(metrics.map((m) => m.feeEfficiency))) },
        ].map((card) => (
          <div key={card.label} style={cardStyle}>
            <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{card.label}</p>
            <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th style={thStyle} onClick={() => handleSort("attorneyFirm")}>Attorney Firm</th>
              <th style={{ ...thStyle, textAlign: "center" }} onClick={() => handleSort("totalFiles")}>Total</th>
              <th style={{ ...thStyle, textAlign: "center" }} onClick={() => handleSort("openFiles")}>Open</th>
              <th style={{ ...thStyle, textAlign: "center" }} onClick={() => handleSort("settledFiles")}>Settled</th>
              <th style={{ ...thStyle, textAlign: "center" }} onClick={() => handleSort("avgDaysToCRN")}>Avg Days CRN</th>
              <th style={{ ...thStyle, textAlign: "center" }} onClick={() => handleSort("avgDaysToSettlement")}>Avg Days Settle</th>
              <th style={{ ...thStyle, textAlign: "right" }} onClick={() => handleSort("avgSettlementAmount")}>Avg Settlement</th>
              <th style={{ ...thStyle, textAlign: "center" }} onClick={() => handleSort("feeEfficiency")}>Fee Rate</th>
              <th style={{ ...thStyle, textAlign: "center" }} onClick={() => handleSort("successRate")}>Success</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.attorneyFirm} style={{ borderBottom: "1px solid var(--border-color)" }}>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{m.attorneyFirm}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{m.totalFiles}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{m.openFiles}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{m.settledFiles}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{m.avgDaysToCRN ?? "—"}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{m.avgDaysToSettlement ?? "—"}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(m.avgSettlementAmount)}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{formatPercentage(m.feeEfficiency)}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <StatusBadge label={formatPercentage(m.successRate)} color={m.successRate > 0.7 ? "green" : "gray"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================
   REFERRAL ANALYSIS VIEW
   ================================================================ */

function ReferralAnalysisView() {
  const { data: files = [] } = useLitigationFiles();
  const { data: settlements = [] } = useSettlements();

  const [sortBy, setSortBy] = useState<string>("totalReferrals");
  const [sortDesc, setSortDesc] = useState(true);

  const metrics = useMemo(() => computeReferralMetrics(files, settlements), [files, settlements]);

  const handleSort = (field: string) => {
    if (sortBy === field) setSortDesc(!sortDesc);
    else { setSortBy(field); setSortDesc(true); }
  };

  const sorted = [...metrics].sort((a, b) => {
    const aVal = (a as any)[sortBy] ?? 0;
    const bVal = (b as any)[sortBy] ?? 0;
    return sortDesc ? bVal - aVal : aVal - bVal;
  });

  if (metrics.length === 0) {
    return (
      <div className="rounded-xl p-12 text-center" style={{ background: "var(--bg-secondary)" }}>
        <p style={{ color: "var(--text-secondary)" }}>No referral data available yet.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th style={thStyle} onClick={() => handleSort("referralSource")}>Referral Source</th>
            <th style={{ ...thStyle, textAlign: "center" }} onClick={() => handleSort("totalReferrals")}>Total</th>
            <th style={{ ...thStyle, textAlign: "center" }} onClick={() => handleSort("settledCount")}>Settled</th>
            <th style={{ ...thStyle, textAlign: "center" }} onClick={() => handleSort("successRate")}>Success Rate</th>
            <th style={{ ...thStyle, textAlign: "center" }} onClick={() => handleSort("avgCycleTime")}>Avg Days</th>
            <th style={{ ...thStyle, textAlign: "right" }} onClick={() => handleSort("avgSettlementAmount")}>Avg Settlement</th>
            <th style={thStyle}>Top Firms</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr key={m.referralSource} style={{ borderBottom: "1px solid var(--border-color)" }}>
              <td style={{ ...tdStyle, fontWeight: 500 }}>{m.referralSource}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{m.totalReferrals}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{m.settledCount}</td>
              <td style={{ ...tdStyle, textAlign: "center" }}>
                <StatusBadge label={formatPercentage(m.successRate)} color={m.successRate > 0.7 ? "green" : "gray"} />
              </td>
              <td style={{ ...tdStyle, textAlign: "center" }}>{m.avgCycleTime ?? "—"}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(m.avgSettlementAmount)}</td>
              <td style={tdStyle}>
                {m.topAttorneys.slice(0, 2).map((a) => (
                  <div key={a.firm} className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {a.firm} ({a.count})
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================
   LIQUIDITY VIEW
   ================================================================ */

function LiquidityView() {
  const { data: settlements = [], isLoading } = useSettlements();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return settlements;
    const q = search.toLowerCase();
    return settlements.filter(
      (s) =>
        s.litigation_file?.file_number?.toLowerCase().includes(q) ||
        s.litigation_file?.client_name?.toLowerCase().includes(q)
    );
  }, [settlements, search]);

  const totals = useMemo(() => {
    const total = filtered.reduce((a, s) => a + s.settlement_amount, 0);
    const fees = filtered.reduce((a, s) => a + (s.attorney_fees || 0), 0);
    const costs = filtered.reduce((a, s) => a + s.costs, 0);
    const net = filtered.reduce((a, s) => a + s.net_to_client, 0);
    return { total, fees, costs, net, count: filtered.length };
  }, [filtered]);

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Total Settlements</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{formatCurrency(totals.total)}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{totals.count} settlements</p>
        </div>
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Attorney Fees</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{formatCurrency(totals.fees)}</p>
        </div>
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Total Costs</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{formatCurrency(totals.costs)}</p>
        </div>
        <div style={cardStyle}>
          <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>Net to Clients</p>
          <p className="text-xl font-bold" style={{ color: "#4ade80" }}>{formatCurrency(totals.net)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          style={{ ...inputStyle, maxWidth: 320 }}
          placeholder="Search by file # or client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th style={thStyle}>File #</th>
              <th style={thStyle}>Client</th>
              <th style={thStyle}>Attorney Firm</th>
              <th style={thStyle}>Contractor</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Settlement</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Fees</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Costs</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Net to Client</th>
              <th style={thStyle}>Date Settled</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} style={{ ...tdStyle, textAlign: "center", padding: 24 }}>
                  <span style={{ color: "var(--text-muted)" }}>Loading...</span>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ ...tdStyle, textAlign: "center", padding: 24 }}>
                  <span style={{ color: "var(--text-muted)" }}>No settlements found.</span>
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{s.litigation_file?.file_number}</td>
                  <td style={tdStyle}>{s.litigation_file?.client_name}</td>
                  <td style={tdStyle}>{s.litigation_file?.attorney_firm}</td>
                  <td style={tdStyle}>{s.litigation_file?.referral_source}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{formatCurrency(s.settlement_amount)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(s.attorney_fees)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(s.costs)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#4ade80" }}>{formatCurrency(s.net_to_client)}</td>
                  <td style={tdStyle}>{formatDate(s.date_settled)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
