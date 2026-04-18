"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { formatDate } from "@/lib/formatters";

/* ── types ─────────────────────────────────────────────── */

interface Employee {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  position: string | null;
  department: string | null;
  location: string | null;
  primary_phone: string | null;
  work_phone: string | null;
  work_email: string | null;
  employee_id: string | null;
  hire_date: string | null;
  profile_picture_url: string | null;
  bio: string | null;
}

/* ── helpers ───────────────────────────────────────────── */

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}


/* ── icons (inline SVG to avoid deps) ──────────────────── */

function IconGrid({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--accent)" : "var(--text-muted)"} strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconList({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--accent)" : "var(--text-muted)"} strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

/* ── main page ─────────────────────────────────────────── */

export default function DirectoryPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "department" | "position" | "hireDate">("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const ORG_ID = "00000000-0000-0000-0000-000000000001";

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, first_name, last_name, email, position, department, location, primary_phone, work_phone, work_email, employee_id, hire_date, profile_picture_url, bio")
      .eq("org_id", ORG_ID)
      .eq("status", "active")
      .eq("user_type", "internal")
      .order("full_name", { ascending: true });
    if (error) console.error("directory fetch error:", error);
    setEmployees((data as Employee[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  /* ── derived data ──────────────────────────────────────── */

  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => e.department && set.add(e.department));
    return Array.from(set).sort();
  }, [employees]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => e.location && set.add(e.location));
    return Array.from(set).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    let result = employees;

    if (filterDept !== "all") {
      result = result.filter((e) => e.department === filterDept);
    }
    if (filterLocation !== "all") {
      result = result.filter((e) => e.location === filterLocation);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.full_name.toLowerCase().includes(s) ||
          e.email.toLowerCase().includes(s) ||
          (e.position ?? "").toLowerCase().includes(s) ||
          (e.department ?? "").toLowerCase().includes(s) ||
          (e.location ?? "").toLowerCase().includes(s) ||
          (e.employee_id ?? "").toLowerCase().includes(s) ||
          (e.primary_phone ?? "").includes(s)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.full_name.localeCompare(b.full_name);
        case "department":
          return (a.department ?? "").localeCompare(b.department ?? "") || a.full_name.localeCompare(b.full_name);
        case "position":
          return (a.position ?? "").localeCompare(b.position ?? "") || a.full_name.localeCompare(b.full_name);
        case "hireDate":
          return new Date(b.hire_date ?? 0).getTime() - new Date(a.hire_date ?? 0).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [employees, filterDept, filterLocation, search, sortBy]);

  /* ── styles ────────────────────────────────────────────── */

  const inputStyle = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
  };

  /* ── render ────────────────────────────────────────────── */

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Employee Directory</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Find and connect with your colleagues
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: "var(--bg-surface)" }}>
          <button
            onClick={() => setViewMode("grid")}
            className="p-2 rounded-md cursor-pointer transition-colors"
            style={{ background: viewMode === "grid" ? "var(--bg-hover)" : "transparent" }}
          >
            <IconGrid active={viewMode === "grid"} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className="p-2 rounded-md cursor-pointer transition-colors"
            style={{ background: viewMode === "list" ? "var(--bg-hover)" : "transparent" }}
          >
            <IconList active={viewMode === "list"} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-4 mb-6"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <input
              type="text"
              placeholder="Search by name, email, position, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
          </div>

          {/* Department */}
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
            style={inputStyle}
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Location */}
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
            style={inputStyle}
          >
            <option value="all">All Locations</option>
            {locations.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
            style={inputStyle}
          >
            <option value="name">Sort by Name</option>
            <option value="department">Sort by Department</option>
            <option value="position">Sort by Position</option>
            <option value="hireDate">Sort by Hire Date</option>
          </select>
        </div>

        <div className="flex items-center justify-between mt-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          <span>
            Showing {filtered.length} of {employees.length} employees
          </span>
          {(filterDept !== "all" || filterLocation !== "all" || search) && (
            <button
              onClick={() => { setSearch(""); setFilterDept("all"); setFilterLocation("all"); }}
              className="cursor-pointer underline"
              style={{ color: "var(--accent)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading directory...</p>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        >
          <p style={{ color: "var(--text-secondary)" }}>
            {employees.length === 0 ? "No active employees yet." : "No employees match your filters."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* ── Grid View ──────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((e) => (
            <div
              key={e.id}
              className="rounded-xl p-5 transition-colors"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
            >
              {/* Top row: avatar + name */}
              <div className="flex items-center gap-3 mb-4">
                {e.profile_picture_url ? (
                  <img src={e.profile_picture_url} alt={e.full_name} className="w-11 h-11 rounded-full object-cover shrink-0" />
                ) : (
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                    style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}
                  >
                    {initials(e.full_name)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{e.full_name}</div>
                  <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{e.position || "—"}</div>
                  {e.employee_id && (
                    <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>ID: {e.employee_id}</div>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                {e.department && (
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M3 7v14M21 7v14M6 11h.01M6 15h.01M6 19h.01M10 11h.01M10 15h.01M10 19h.01M14 11h.01M14 15h.01M14 19h.01M18 11h.01M18 15h.01M18 19h.01M3 7l9-4 9 4" /></svg>
                    <span className="truncate">{e.department}</span>
                  </div>
                )}
                {e.location && (
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    <span className="truncate">{e.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                  <a href={`mailto:${e.work_email || e.email}`} className="truncate" style={{ color: "var(--accent)" }}>
                    {e.work_email || e.email}
                  </a>
                </div>
                {e.primary_phone && (
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                    <a href={`tel:${e.primary_phone}`} style={{ color: "var(--accent)" }}>{e.primary_phone}</a>
                  </div>
                )}
                {e.hire_date && (
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    <span>Joined {formatDate(e.hire_date)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── List View ──────────────────────────────────── */
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        >
          {filtered.map((e, i) => (
            <div
              key={e.id}
              className="flex items-center justify-between px-5 py-4 transition-colors"
              style={{
                borderTop: i > 0 ? "1px solid var(--border-color)" : undefined,
              }}
            >
              {/* Left: avatar + info */}
              <div className="flex items-center gap-4 min-w-0">
                {e.profile_picture_url ? (
                  <img src={e.profile_picture_url} alt={e.full_name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                    style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}
                  >
                    {initials(e.full_name)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{e.full_name}</div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {e.position || "—"} {e.department ? `· ${e.department}` : ""}
                  </div>
                  {e.employee_id && (
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>ID: {e.employee_id}</div>
                  )}
                </div>
              </div>

              {/* Right: contact info */}
              <div className="flex items-center gap-6 text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>
                {e.location && (
                  <span className="hidden md:flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    {e.location}
                  </span>
                )}
                <a href={`mailto:${e.work_email || e.email}`} className="flex items-center gap-1" style={{ color: "var(--accent)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                  {e.work_email || e.email}
                </a>
                {e.primary_phone && (
                  <a href={`tel:${e.primary_phone}`} className="hidden lg:flex items-center gap-1" style={{ color: "var(--accent)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                    {e.primary_phone}
                  </a>
                )}
                {e.hire_date && (
                  <span className="hidden xl:flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    Joined {formatDate(e.hire_date)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
