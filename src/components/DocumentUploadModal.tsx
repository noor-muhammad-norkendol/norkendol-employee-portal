"use client";

import React, { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

type Department = { id: string; name: string };

interface Props {
  open: boolean;
  onClose: () => void;
  orgId: string;
  uploaderId: string;
  departments: Department[];
  onSuccess: () => void;
}

function formatBytes(b: number): string {
  if (b === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function DocumentUploadModal({
  open,
  onClose,
  orgId,
  uploaderId,
  departments,
  onSuccess,
}: Props) {
  const supabase = useRef(createClient()).current;
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]); // dept names
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setFile(null);
    setName("");
    setDescription("");
    setSelectedDepts([]);
    setTags([]);
    setTagInput("");
    setError("");
    setUploading(false);
    setDragOver(false);
  }

  function close() {
    if (uploading) return;
    reset();
    onClose();
  }

  function handleFileSelect(f: File) {
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError("Please upload a PDF, Word, Excel, PNG, or JPG file.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("File size must be less than 10 MB.");
      return;
    }
    setFile(f);
    setName((prev) => prev || f.name.replace(/\.[^/.]+$/, ""));
    setError("");
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, []);

  function toggleDept(name: string) {
    setSelectedDepts((prev) =>
      prev.includes(name) ? prev.filter((d) => d !== name) : [...prev, name]
    );
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (uploading) return;
    if (!file || !name.trim() || selectedDepts.length === 0) {
      setError("Pick a file, name it, and select at least one department.");
      return;
    }
    setUploading(true);
    setError("");

    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      // Upload one storage file per (file × department) to keep RLS path-based.
      // Fast path: single upload, then insert one documents row per dept that
      // points at the same storage_path... but storage_path is UNIQUE, so we
      // upload separately per dept (mirrors live system behavior).

      const insertedIds: string[] = [];
      for (const deptName of selectedDepts) {
        const docId = crypto.randomUUID();
        const path = `${orgId}/${docId}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("portal-documents")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
          });
        if (uploadErr) throw new Error(`Storage upload: ${uploadErr.message}`);

        const { error: insertErr } = await supabase.from("documents").insert({
          id: docId,
          org_id: orgId,
          department: deptName,
          name: name.trim(),
          description: description.trim() || null,
          tags,
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
          storage_path: path,
          uploaded_by: uploaderId,
        });
        if (insertErr) {
          // best-effort cleanup
          await supabase.storage.from("portal-documents").remove([path]);
          throw new Error(`DB insert: ${insertErr.message}`);
        }
        insertedIds.push(docId);
      }

      onSuccess();
      close();
    } catch (err) {
      console.error("upload failed", err);
      setError(err instanceof Error ? err.message : "Upload failed.");
      setUploading(false);
    }
  }

  if (!open) return null;

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
      onClick={close}
    >
      <div
        className="themed-card"
        style={{
          width: "100%",
          maxWidth: 640,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 0,
          zIndex: 999,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="themed-card-stripe" aria-hidden />

        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h2
            className="page-title"
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text)",
              fontFamily: "var(--font-display)",
              margin: 0,
            }}
          >
            <span className="themed-accent">Upload</span>{" "}
            <span style={{ color: "var(--text)" }}>Document</span>
          </h2>
          <button
            onClick={close}
            disabled={uploading}
            style={{
              background: "transparent",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--border)",
              color: "var(--text-dim)",
              width: 32,
              height: 32,
              borderRadius: 6,
              fontSize: 18,
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.5 : 1,
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {/* Drop zone */}
          <FieldLabel>Document File *</FieldLabel>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              borderWidth: "2px",
              borderStyle: "dashed",
              borderColor: dragOver
                ? "var(--accent)"
                : file
                ? "var(--green)"
                : "var(--border)",
              background: dragOver
                ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                : file
                ? "color-mix(in srgb, var(--green) 8%, transparent)"
                : "var(--pad-input)",
              borderRadius: 10,
              padding: "32px 16px",
              textAlign: "center",
              cursor: uploading ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
              marginBottom: 20,
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
                e.target.value = "";
              }}
              disabled={uploading}
            />
            {file ? (
              <>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--text)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {file.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-dim)",
                    marginTop: 4,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {formatBytes(file.size)} · {file.type || "unknown"}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--green)",
                    marginTop: 8,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  ✓ File ready
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text)",
                  }}
                >
                  Drag &amp; drop your file here
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-dim)",
                    marginTop: 4,
                  }}
                >
                  or click to browse
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-faint)",
                    marginTop: 10,
                  }}
                >
                  PDF · DOC · DOCX · XLS · XLSX · PNG · JPG · 10 MB max
                </div>
              </>
            )}
          </div>

          {/* Name */}
          <FieldLabel>Document Name *</FieldLabel>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter document name"
            disabled={uploading}
            required
            style={{ ...inputStyle, marginBottom: 16 }}
          />

          {/* Description */}
          <FieldLabel>Description</FieldLabel>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            disabled={uploading}
            rows={3}
            style={{ ...inputStyle, resize: "vertical", marginBottom: 16 }}
          />

          {/* Departments */}
          <FieldLabel>
            Departments * (one or more)
          </FieldLabel>
          <div
            style={{
              maxHeight: 140,
              overflowY: "auto",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "var(--border)",
              borderRadius: 8,
              padding: 8,
              marginBottom: 6,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
            }}
          >
            {departments.length === 0 && (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-faint)",
                  padding: "6px 8px",
                  gridColumn: "1 / -1",
                }}
              >
                No departments yet — create one from the Documents page first.
              </span>
            )}
            {departments.map((d) => {
              const checked = selectedDepts.includes(d.name);
              return (
                <label
                  key={d.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: 6,
                    cursor: uploading ? "not-allowed" : "pointer",
                    background: checked
                      ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                      : "transparent",
                    fontSize: 13,
                    color: "var(--text)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDept(d.name)}
                    disabled={uploading}
                  />
                  {d.name}
                </label>
              );
            })}
          </div>
          {selectedDepts.length > 1 && (
            <div
              style={{
                fontSize: 11,
                color: "var(--accent)",
                marginBottom: 16,
                fontFamily: "var(--font-mono)",
              }}
            >
              Will create {selectedDepts.length} document records — one per
              department.
            </div>
          )}
          {selectedDepts.length <= 1 && <div style={{ marginBottom: 16 }} />}

          {/* Tags */}
          <FieldLabel>Tags</FieldLabel>
          {tags.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 6,
              }}
            >
              {tags.map((t) => (
                <span
                  key={t}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    background:
                      "color-mix(in srgb, var(--accent) 12%, transparent)",
                    color: "var(--accent)",
                    border:
                      "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
                    fontFamily: "var(--font-ui)",
                    textTransform: "uppercase",
                  }}
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    disabled={uploading}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
            placeholder="Add tags (Enter or comma to add)"
            disabled={uploading}
            style={{ ...inputStyle, marginBottom: 16 }}
          />

          {/* Error */}
          {error && (
            <div
              style={{
                padding: "10px 12px",
                marginBottom: 16,
                borderRadius: 8,
                background: "color-mix(in srgb, var(--red) 10%, var(--pad))",
                border:
                  "1px solid color-mix(in srgb, var(--red) 40%, transparent)",
                color: "var(--red)",
                fontSize: 13,
                fontFamily: "var(--font-ui)",
              }}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div
            className="flex justify-end gap-2"
            style={{
              paddingTop: 16,
              borderTop: "1px solid var(--border)",
            }}
          >
            <button
              type="button"
              onClick={close}
              disabled={uploading}
              style={outlineButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                uploading ||
                !file ||
                !name.trim() ||
                selectedDepts.length === 0
              }
              style={{
                ...primaryButton,
                opacity:
                  uploading ||
                  !file ||
                  !name.trim() ||
                  selectedDepts.length === 0
                    ? 0.5
                    : 1,
                cursor:
                  uploading ||
                  !file ||
                  !name.trim() ||
                  selectedDepts.length === 0
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {uploading ? "Uploading…" : "Upload Document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── shared inline styles ── */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
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
};

const primaryButton: React.CSSProperties = {
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
  boxShadow: "var(--cta-shadow)",
};

const outlineButton: React.CSSProperties = {
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
};
