"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import { formatDate } from "@/lib/formatters";
import DocumentUploadModal from "@/components/DocumentUploadModal";

interface DocumentRow {
  id: string;
  org_id: string;
  department: string;
  name: string;
  description: string | null;
  tags: string[];
  original_filename: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  version: number;
  download_count: number;
  uploaded_by: string | null;
  created_at: string;
}

interface DepartmentRow {
  id: string;
  name: string;
}

interface UserProfile {
  id: string;
  org_id: string;
  full_name: string | null;
  role: string;
  department: string | null;
}

const ADMIN_ROLES = ["super_admin", "system_admin", "admin"];
const PAGE_SIZE = 20;

function formatBytes(b: number): string {
  if (b === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function fileFormat(mime: string): { label: string; token: string } {
  if (mime.includes("pdf")) return { label: "PDF", token: "--red" };
  if (mime.includes("word")) return { label: mime.includes("openxml") ? "DOCX" : "DOC", token: "--info" };
  if (mime.includes("excel") || mime.includes("sheet")) return { label: mime.includes("openxml") ? "XLSX" : "XLS", token: "--green" };
  if (mime.startsWith("image/")) return { label: mime.split("/")[1].toUpperCase(), token: "--violet" };
  return { label: "FILE", token: "--text-faint" };
}

export default function DocumentsPage() {
  const [supabase] = useState(() => createClient());
  const [me, setMe] = useState<UserProfile | null>(null);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = me ? ADMIN_ROLES.includes(me.role) : false;

  /* ── load user ─────────────────────────────────────── */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("users")
        .select("id, org_id, full_name, role, department")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) setMe(data as UserProfile);
        });
    });
  }, [supabase]);

  /* ── load departments (visible to user per RLS) ────── */
  const loadDepartments = useCallback(async () => {
    if (!me) return;
    const { data } = await supabase
      .from("departments")
      .select("id, name")
      .eq("org_id", me.org_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (data) setDepartments(data as DepartmentRow[]);
  }, [supabase, me]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  /* ── debounce search ────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  /* ── load docs on filter changes ────────────────────── */
  const loadDocs = useCallback(
    async (reset = true, pageNum = 1) => {
      if (!me) return;
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }
      setError("");

      const from = (pageNum - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from("documents")
        .select("*", { count: "exact" })
        .eq("org_id", me.org_id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filterDept !== "all") q = q.eq("department", filterDept);
      if (searchDebounced.trim()) {
        const s = searchDebounced.trim();
        q = q.or(
          `name.ilike.%${s}%,description.ilike.%${s}%,original_filename.ilike.%${s}%`
        );
      }

      const { data, error: err, count } = await q;
      if (err) {
        setError(err.message);
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      const rows = (data as DocumentRow[]) ?? [];
      if (reset) {
        setDocs(rows);
      } else {
        setDocs((prev) => [...prev, ...rows]);
      }
      const totalSoFar = (reset ? 0 : (pageNum - 1) * PAGE_SIZE) + rows.length;
      setHasMore((count ?? 0) > totalSoFar);
      setLoading(false);
      setLoadingMore(false);
    },
    [supabase, me, filterDept, searchDebounced]
  );

  useEffect(() => {
    if (me) loadDocs(true, 1);
  }, [me, filterDept, searchDebounced, loadDocs]);

  /* ── download ───────────────────────────────────────── */
  async function handleDownload(doc: DocumentRow) {
    setDownloadingId(doc.id);
    try {
      const { data, error: dlErr } = await supabase.storage
        .from("portal-documents")
        .createSignedUrl(doc.storage_path, 60);
      if (dlErr || !data) throw new Error(dlErr?.message ?? "No signed URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      // Optimistic increment + persist
      setDocs((prev) =>
        prev.map((d) =>
          d.id === doc.id ? { ...d, download_count: d.download_count + 1 } : d
        )
      );
      await supabase
        .from("documents")
        .update({ download_count: doc.download_count + 1 })
        .eq("id", doc.id);
    } catch (err) {
      console.error("download failed", err);
      alert(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloadingId(null);
    }
  }

  /* ── delete ─────────────────────────────────────────── */
  async function handleDelete(doc: DocumentRow) {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    const { error: delErr } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id);
    if (delErr) {
      alert(delErr.message);
      return;
    }
    await supabase.storage.from("portal-documents").remove([doc.storage_path]);
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
  }

  /* ── load more ──────────────────────────────────────── */
  function handleLoadMore() {
    const next = page + 1;
    setPage(next);
    loadDocs(false, next);
  }

  /* ── available depts for filter row ─────────────────── */
  const filterDepts = useMemo(() => departments, [departments]);

  if (!me) {
    return null; // brief flash; page will mount once user is loaded
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
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
              Documents
            </span>
          </h1>
          <p className="mt-3 text-sm" style={{ color: "var(--text-dim)" }}>
            {isAdmin
              ? "Manage company documents — upload, organize by department, share with the team."
              : "Access documents shared with your department."}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowUpload(true)}
            style={{
              padding: "12px 22px",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              borderRadius: 8,
              background: "var(--cta-bg)",
              color: "var(--cta-text)",
              border: "none",
              fontFamily: "var(--font-display)",
              cursor: "pointer",
              boxShadow: "var(--cta-shadow)",
            }}
          >
            + Upload Document
          </button>
        )}
      </div>

      {/* ── Search + Filter pills ─────────────────────── */}
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Search by name, description, or filename…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 560,
            background: "var(--pad-input)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--border)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 14,
            color: "var(--text)",
            fontFamily: "var(--font-body)",
            outline: "none",
          }}
        />

        <div className="flex flex-wrap gap-2 items-center">
          <FilterPill
            label="All Departments"
            active={filterDept === "all"}
            onClick={() => setFilterDept("all")}
            token="--accent"
          />
          {filterDepts.map((d) => (
            <FilterPill
              key={d.id}
              label={d.name}
              active={filterDept === d.name}
              onClick={() => setFilterDept(d.name)}
              token="--info"
            />
          ))}
          {isAdmin && (
            <button
              onClick={() => setShowDeptModal(true)}
              title="Add department"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                borderWidth: "1.5px",
                borderStyle: "dashed",
                borderColor: "var(--border)",
                background: "var(--pad)",
                color: "var(--text-dim)",
                cursor: "pointer",
                fontSize: 18,
                fontFamily: "var(--font-display)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
          )}
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────── */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: "color-mix(in srgb, var(--red) 10%, var(--pad))",
            border: "1px solid color-mix(in srgb, var(--red) 40%, transparent)",
            color: "var(--red)",
            fontSize: 13,
            fontFamily: "var(--font-ui)",
          }}
        >
          {error}
        </div>
      )}

      {/* ── Document list ─────────────────────────────── */}
      {loading ? (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            color: "var(--text-dim)",
            fontSize: 13,
          }}
        >
          Loading documents…
        </div>
      ) : docs.length === 0 ? (
        <div
          className="themed-card"
          style={{
            padding: 48,
            textAlign: "center",
          }}
        >
          <div className="themed-card-stripe" aria-hidden />
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 6,
              fontFamily: "var(--font-display)",
            }}
          >
            No documents found
          </div>
          <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
            {searchDebounced || filterDept !== "all"
              ? "Try clearing your filters."
              : isAdmin
              ? "Upload your first document to get started."
              : "Nothing shared with your department yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <DocumentRowCard
              key={doc.id}
              doc={doc}
              isAdmin={isAdmin}
              downloading={downloadingId === doc.id}
              onDownload={() => handleDownload(doc)}
              onDelete={() => handleDelete(doc)}
            />
          ))}
          {hasMore && (
            <div className="flex justify-center" style={{ paddingTop: 16 }}>
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{
                  padding: "10px 24px",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  borderRadius: 8,
                  background: "var(--bg)",
                  color: "var(--accent)",
                  borderWidth: "2px",
                  borderStyle: "solid",
                  borderColor: "var(--accent)",
                  fontFamily: "var(--font-display)",
                  cursor: loadingMore ? "not-allowed" : "pointer",
                  opacity: loadingMore ? 0.6 : 1,
                }}
              >
                {loadingMore ? "Loading…" : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Upload modal ──────────────────────────────── */}
      {showUpload && me && (
        <DocumentUploadModal
          open={showUpload}
          onClose={() => setShowUpload(false)}
          orgId={me.org_id}
          uploaderId={me.id}
          departments={departments}
          onSuccess={() => loadDocs(true, 1)}
        />
      )}

      {/* ── Add department modal ─────────────────────── */}
      {showDeptModal && me && (
        <AddDepartmentModal
          orgId={me.org_id}
          existingNames={departments.map((d) => d.name.toLowerCase())}
          onClose={() => setShowDeptModal(false)}
          onCreated={() => {
            loadDepartments();
            setShowDeptModal(false);
          }}
        />
      )}
    </div>
  );
}

/* ── filter pill ─────────────────────────────────────── */

function FilterPill({
  label,
  active,
  onClick,
  token,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  token: string;
}) {
  const tokenVar = `var(${token})`;
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
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
          ? `0 0 0 1px ${tokenVar} inset, 0 0 16px color-mix(in srgb, ${tokenVar} 40%, transparent)`
          : "none",
        cursor: "pointer",
        fontFamily: "var(--font-display)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

/* ── document row ────────────────────────────────────── */

function DocumentRowCard({
  doc,
  isAdmin,
  downloading,
  onDownload,
  onDelete,
}: {
  doc: DocumentRow;
  isAdmin: boolean;
  downloading: boolean;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const fmt = fileFormat(doc.mime_type);
  const fmtVar = `var(${fmt.token})`;
  return (
    <div
      className="themed-card is-interactive"
      style={{
        padding: "18px 22px",
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
      }}
    >
      <div className="themed-card-stripe" aria-hidden />

      {/* File icon chip */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 48,
          height: 48,
          borderRadius: 10,
          background: `color-mix(in srgb, ${fmtVar} 14%, var(--pad))`,
          color: fmtVar,
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: `color-mix(in srgb, ${fmtVar} 35%, transparent)`,
          flexShrink: 0,
          filter: `drop-shadow(0 0 6px color-mix(in srgb, ${fmtVar} 50%, transparent))`,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + format badge */}
        <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
          <span
            className="page-title"
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text)",
              fontFamily: "var(--font-display)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {doc.name}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              padding: "2px 8px",
              borderRadius: 4,
              background: `color-mix(in srgb, ${fmtVar} 12%, transparent)`,
              color: fmtVar,
              border: `1px solid color-mix(in srgb, ${fmtVar} 40%, transparent)`,
              fontFamily: "var(--font-ui)",
              flexShrink: 0,
            }}
          >
            {fmt.label}
          </span>
        </div>

        {/* Description */}
        {doc.description && (
          <p
            style={{
              fontSize: 13,
              color: "var(--text-dim)",
              marginBottom: 8,
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {doc.description}
          </p>
        )}

        {/* Metadata row */}
        <div
          className="flex flex-wrap items-center"
          style={{
            fontSize: 11,
            color: "var(--text-faint)",
            gap: 14,
            fontFamily: "var(--font-mono)",
          }}
        >
          <span>· {doc.department}</span>
          <span>· {formatDate(doc.created_at)}</span>
          <span>· {formatBytes(doc.file_size)}</span>
          <span>· {doc.download_count} downloads</span>
        </div>

        {/* Tags */}
        {doc.tags && doc.tags.length > 0 && (
          <div
            className="flex flex-wrap"
            style={{ gap: 4, marginTop: 8 }}
          >
            {doc.tags.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "var(--pad-elev)",
                  color: "var(--text-dim)",
                  border: "1px solid var(--border)",
                  letterSpacing: "0.06em",
                  fontFamily: "var(--font-ui)",
                  textTransform: "uppercase",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center" style={{ gap: 6, flexShrink: 0 }}>
        <button
          onClick={onDownload}
          disabled={downloading}
          title="Download"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "color-mix(in srgb, var(--info) 40%, transparent)",
            background: "var(--pad)",
            color: "var(--info)",
            cursor: downloading ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: downloading ? 0.5 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        {isAdmin && (
          <button
            onClick={onDelete}
            title="Delete"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "color-mix(in srgb, var(--red) 40%, transparent)",
              background: "var(--pad)",
              color: "var(--red)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* ── add department modal ───────────────────────────── */

function AddDepartmentModal({
  orgId,
  existingNames,
  onClose,
  onCreated,
}: {
  orgId: string;
  existingNames: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("Department name is required.");
      return;
    }
    if (existingNames.includes(trimmed.toLowerCase())) {
      setErr("That department already exists.");
      return;
    }
    setSaving(true);
    setErr("");
    const { error } = await supabase.from("departments").insert({
      org_id: orgId,
      name: trimmed,
      description: description.trim() || null,
    });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onCreated();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="themed-card"
        style={{
          width: "100%",
          maxWidth: 460,
          padding: 24,
          zIndex: 999,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="themed-card-stripe" aria-hidden />

        <h2
          className="page-title"
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text)",
            fontFamily: "var(--font-display)",
            margin: 0,
            marginBottom: 16,
          }}
        >
          Add <span className="themed-accent">Department</span>
        </h2>

        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-dim)",
            marginBottom: 6,
            fontFamily: "var(--font-ui)",
          }}
        >
          Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Claims, Adjusting, Administration"
          required
          style={{
            width: "100%",
            background: "var(--pad-input)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--border)",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 13,
            color: "var(--text)",
            fontFamily: "var(--font-body)",
            outline: "none",
            marginBottom: 14,
          }}
        />

        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-dim)",
            marginBottom: 6,
            fontFamily: "var(--font-ui)",
          }}
        >
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Brief description (optional)"
          style={{
            width: "100%",
            background: "var(--pad-input)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--border)",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 13,
            color: "var(--text)",
            fontFamily: "var(--font-body)",
            outline: "none",
            marginBottom: 14,
            resize: "vertical",
          }}
        />

        {err && (
          <div
            style={{
              padding: "10px 12px",
              marginBottom: 14,
              borderRadius: 8,
              background: "color-mix(in srgb, var(--red) 10%, var(--pad))",
              border: "1px solid color-mix(in srgb, var(--red) 40%, transparent)",
              color: "var(--red)",
              fontSize: 13,
              fontFamily: "var(--font-ui)",
            }}
          >
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "10px 18px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              borderRadius: 8,
              background: "var(--bg)",
              color: "var(--accent)",
              borderWidth: "2px",
              borderStyle: "solid",
              borderColor: "var(--accent)",
              fontFamily: "var(--font-display)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "10px 22px",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              borderRadius: 8,
              background: "var(--cta-bg)",
              color: "var(--cta-text)",
              border: "none",
              fontFamily: "var(--font-display)",
              cursor: saving ? "not-allowed" : "pointer",
              boxShadow: "var(--cta-shadow)",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
