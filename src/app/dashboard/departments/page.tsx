"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

interface Department {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  id: string;
  org_id: string;
  role: string;
}

const ADMIN_ROLES = ["super_admin", "system_admin", "admin"];

export default function DepartmentsPage() {
  const [supabase] = useState(() => createClient());
  const [me, setMe] = useState<UserProfile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Department | "new" | null>(null);

  const isAdmin = me ? ADMIN_ROLES.includes(me.role) : false;

  /* ── load user ─────────────────────────────────────── */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("users")
        .select("id, org_id, role")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) setMe(data as UserProfile);
        });
    });
  }, [supabase]);

  /* ── load departments + member counts ──────────────── */
  const loadAll = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    const [deptRes, usersRes] = await Promise.all([
      supabase
        .from("departments")
        .select("*")
        .eq("org_id", me.org_id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("users")
        .select("department")
        .eq("org_id", me.org_id)
        .eq("status", "active")
        .eq("user_type", "internal"),
    ]);
    setDepartments((deptRes.data as Department[]) ?? []);
    const counts: Record<string, number> = {};
    for (const u of (usersRes.data ?? []) as { department: string | null }[]) {
      if (u.department) counts[u.department] = (counts[u.department] ?? 0) + 1;
    }
    setMemberCounts(counts);
    setLoading(false);
  }, [supabase, me]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ── filter ────────────────────────────────────────── */
  const filtered = useMemo(() => {
    return departments.filter((d) => {
      if (filter === "active" && !d.is_active) return false;
      if (filter === "inactive" && d.is_active) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        if (
          !d.name.toLowerCase().includes(s) &&
          !(d.description ?? "").toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [departments, search, filter]);

  /* ── toggle active ─────────────────────────────────── */
  async function toggleActive(d: Department) {
    const next = !d.is_active;
    const { error } = await supabase
      .from("departments")
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq("id", d.id);
    if (error) {
      alert(error.message);
      return;
    }
    setDepartments((prev) =>
      prev.map((x) => (x.id === d.id ? { ...x, is_active: next } : x))
    );
  }

  /* ── delete ────────────────────────────────────────── */
  async function handleDelete(d: Department) {
    const memberCount = memberCounts[d.name] ?? 0;
    if (memberCount > 0) {
      alert(
        `Cannot delete "${d.name}" — ${memberCount} user(s) still belong to this department. Reassign them first.`
      );
      return;
    }
    if (!confirm(`Delete "${d.name}" permanently? This cannot be undone.`))
      return;
    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", d.id);
    if (error) {
      alert(error.message);
      return;
    }
    setDepartments((prev) => prev.filter((x) => x.id !== d.id));
  }

  if (!me) return null;

  const totalMembers = Object.values(memberCounts).reduce((a, b) => a + b, 0);
  const activeCount = departments.filter((d) => d.is_active).length;
  const inactiveCount = departments.filter((d) => !d.is_active).length;

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
              Departments
            </span>
          </h1>
          <p className="mt-3 text-sm" style={{ color: "var(--text-dim)" }}>
            Canonical list of departments — drives the user dropdown, document
            permissions, and org reporting.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditing("new")}
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
            + Add Department
          </button>
        )}
      </div>

      {/* ── Stat tiles ────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Departments" count={departments.length} token="--accent" />
        <StatTile label="Active" count={activeCount} token="--green" />
        <StatTile label="Inactive" count={inactiveCount} token="--text-faint" />
        <StatTile label="Members" count={totalMembers} token="--info" />
      </div>

      {/* ── Search + filter pills ─────────────────────── */}
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Search by name or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 480,
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
        <div className="flex flex-wrap gap-2">
          {([
            { key: "active", label: "Active", token: "--green" },
            { key: "inactive", label: "Inactive", token: "--text-faint" },
            { key: "all", label: "All", token: "--accent" },
          ] as const).map((f) => (
            <FilterPill
              key={f.key}
              label={f.label}
              active={filter === f.key}
              onClick={() => setFilter(f.key)}
              token={f.token}
            />
          ))}
        </div>
      </div>

      {/* ── List ──────────────────────────────────────── */}
      {loading ? (
        <div
          style={{
            padding: 32,
            textAlign: "center",
            color: "var(--text-dim)",
            fontSize: 13,
          }}
        >
          Loading departments…
        </div>
      ) : filtered.length === 0 ? (
        <div className="themed-card" style={{ padding: 48, textAlign: "center" }}>
          <div className="themed-card-stripe" aria-hidden />
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--text)",
              fontFamily: "var(--font-display)",
              marginBottom: 6,
            }}
          >
            No departments found
          </div>
          <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
            {search || filter !== "all"
              ? "Try clearing your filters."
              : isAdmin
              ? "Click + Add Department to create the first one."
              : "No departments configured yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <DepartmentRow
              key={d.id}
              dept={d}
              memberCount={memberCounts[d.name] ?? 0}
              isAdmin={isAdmin}
              onEdit={() => setEditing(d)}
              onToggle={() => toggleActive(d)}
              onDelete={() => handleDelete(d)}
            />
          ))}
        </div>
      )}

      {/* ── Edit modal ────────────────────────────────── */}
      {editing && me && (
        <DepartmentModal
          orgId={me.org_id}
          dept={editing === "new" ? null : editing}
          existingNames={departments
            .filter((x) => editing === "new" || x.id !== (editing as Department).id)
            .map((x) => x.name.toLowerCase())}
          onClose={() => setEditing(null)}
          onSaved={() => {
            loadAll();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ── stat tile ───────────────────────────────────────── */

function StatTile({
  label,
  count,
  token,
}: {
  label: string;
  count: number;
  token: string;
}) {
  const tokenVar = `var(${token})`;
  return (
    <div
      className="themed-card"
      style={{
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div className="themed-card-stripe" aria-hidden />
      <span
        className="text-3xl font-extrabold"
        style={{
          color: tokenVar,
          fontFamily: "var(--font-display)",
        }}
      >
        {count}
      </span>
      <span
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{
          color: tokenVar,
          opacity: 0.78,
          fontFamily: "var(--font-ui)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── filter pill ────────────────────────────────────── */

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
          ? `0 0 0 1px ${tokenVar} inset, 0 0 18px color-mix(in srgb, ${tokenVar} 50%, transparent)`
          : "none",
      }}
    >
      {label}
    </button>
  );
}

/* ── department row ────────────────────────────────── */

function DepartmentRow({
  dept,
  memberCount,
  isAdmin,
  onEdit,
  onToggle,
  onDelete,
}: {
  dept: Department;
  memberCount: number;
  isAdmin: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="themed-card is-interactive"
      style={{
        padding: "18px 22px",
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        opacity: dept.is_active ? 1 : 0.6,
      }}
    >
      <div className="themed-card-stripe" aria-hidden />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 4 }}>
          <span
            className="page-title"
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "var(--text)",
              fontFamily: "var(--font-display)",
            }}
          >
            {dept.name}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              padding: "2px 8px",
              borderRadius: 6,
              fontFamily: "var(--font-ui)",
              textTransform: "uppercase",
              background: dept.is_active
                ? "color-mix(in srgb, var(--green) 12%, transparent)"
                : "var(--pad-elev)",
              color: dept.is_active ? "var(--green)" : "var(--text-faint)",
              border: dept.is_active
                ? "1px solid color-mix(in srgb, var(--green) 40%, transparent)"
                : "1px solid var(--border)",
            }}
          >
            {dept.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        {dept.description && (
          <p
            style={{
              fontSize: 13,
              color: "var(--text-dim)",
              marginBottom: 8,
              lineHeight: 1.5,
            }}
          >
            {dept.description}
          </p>
        )}
        <div
          className="flex flex-wrap items-center"
          style={{
            fontSize: 11,
            color: "var(--text-faint)",
            gap: 14,
            fontFamily: "var(--font-mono)",
          }}
        >
          <span>· {memberCount} member{memberCount === 1 ? "" : "s"}</span>
          <span>· sort {dept.sort_order}</span>
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center" style={{ gap: 6, flexShrink: 0 }}>
          <button
            onClick={onEdit}
            title="Edit department"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: "color-mix(in srgb, var(--info) 40%, transparent)",
              background: "var(--pad)",
              color: "var(--info)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          <button
            onClick={onToggle}
            title={dept.is_active ? "Deactivate" : "Activate"}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: dept.is_active
                ? "color-mix(in srgb, var(--amber) 40%, transparent)"
                : "color-mix(in srgb, var(--green) 40%, transparent)",
              background: "var(--pad)",
              color: dept.is_active ? "var(--amber)" : "var(--green)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {dept.is_active ? (
                <>
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </>
              ) : (
                <polygon points="5 3 19 12 5 21 5 3" />
              )}
            </svg>
          </button>
          <button
            onClick={onDelete}
            title="Delete department"
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── modal ────────────────────────────────────────── */

function DepartmentModal({
  orgId,
  dept,
  existingNames,
  onClose,
  onSaved,
}: {
  orgId: string;
  dept: Department | null;
  existingNames: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const [name, setName] = useState(dept?.name ?? "");
  const [description, setDescription] = useState(dept?.description ?? "");
  const [sortOrder, setSortOrder] = useState<number>(dept?.sort_order ?? 0);
  const [isActive, setIsActive] = useState<boolean>(dept?.is_active ?? true);
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
      setErr("That department name already exists.");
      return;
    }
    setSaving(true);
    setErr("");
    if (dept) {
      const { error } = await supabase
        .from("departments")
        .update({
          name: trimmed,
          description: description.trim() || null,
          sort_order: sortOrder,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dept.id);
      if (error) {
        setSaving(false);
        setErr(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("departments").insert({
        org_id: orgId,
        name: trimmed,
        description: description.trim() || null,
        sort_order: sortOrder,
        is_active: isActive,
      });
      if (error) {
        setSaving(false);
        setErr(error.message);
        return;
      }
    }
    setSaving(false);
    onSaved();
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
        style={{ width: "100%", maxWidth: 520, padding: 24, zIndex: 999 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="themed-card-stripe" aria-hidden />

        <h2
          className="page-title"
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--text)",
            fontFamily: "var(--font-display)",
            margin: 0,
            marginBottom: 16,
          }}
        >
          <span className="themed-accent">{dept ? "Edit" : "Add"}</span>{" "}
          <span style={{ color: "var(--text)" }}>Department</span>
        </h2>

        <FieldLabel>Name *</FieldLabel>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Claims, Adjusting, Administration"
          required
          style={{ ...fieldInputStyle, marginBottom: 14 }}
        />

        <FieldLabel>Description</FieldLabel>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What this department covers (optional)"
          style={{ ...fieldInputStyle, resize: "vertical", marginBottom: 14 }}
        />

        <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 14 }}>
          <div>
            <FieldLabel>Sort Order</FieldLabel>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              style={fieldInputStyle}
            />
          </div>
          <div>
            <FieldLabel>Status</FieldLabel>
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                borderWidth: "1.5px",
                borderStyle: "solid",
                borderColor: isActive
                  ? "color-mix(in srgb, var(--green) 50%, transparent)"
                  : "var(--border)",
                background: isActive
                  ? "color-mix(in srgb, var(--green) 14%, var(--pad))"
                  : "var(--pad)",
                color: isActive ? "var(--green)" : "var(--text-dim)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                fontFamily: "var(--font-display)",
              }}
            >
              {isActive ? "Active" : "Inactive"}
            </button>
          </div>
        </div>

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
            style={outlineButton}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{ ...primaryButton, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Saving…" : dept ? "Save Changes" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── shared inline styles ──────────────────────────── */

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

const fieldInputStyle: React.CSSProperties = {
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
  cursor: "pointer",
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
