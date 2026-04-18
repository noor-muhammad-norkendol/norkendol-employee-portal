"use client";

import React, { useState, useRef, useEffect } from "react";
import { useOKSupabase } from "@/hooks/onboarder-kpi/useSupabase";
import { useQuery } from "@tanstack/react-query";
import { inputStyle } from "./styles";

interface UserResult {
  id: string;
  full_name: string;
  email: string | null;
  position: string | null;
}

interface Props {
  value: string;
  onSelect: (userId: string, fullName: string) => void;
  onChange: (text: string) => void;
  placeholder?: string;
  /** If set, only show users with an approved, non-expired license in this state */
  requireLicenseInState?: string | null;
}

export default function UserAutocomplete({ value, onSelect, onChange, placeholder, requireLicenseInState }: Props) {
  const { supabase, userInfo } = useOKSupabase();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value || "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => { setSearch(value || ""); }, [value]);

  // Debounce search to avoid firing a query on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const stateFilter = requireLicenseInState?.toUpperCase().trim() || null;

  const { data: results = [] } = useQuery({
    queryKey: ["user-autocomplete", debouncedSearch, stateFilter],
    queryFn: async (): Promise<UserResult[]> => {
      if (!userInfo || debouncedSearch.length < 2) return [];

      if (stateFilter) {
        // Join users → licenses: only show users licensed in this state
        const { data } = await supabase
          .from("licenses")
          .select("user_id, users!inner(id, full_name, email, position)")
          .eq("org_id", userInfo.orgId)
          .eq("state", stateFilter)
          .eq("status", "approved")
          .or(`expiry_date.is.null,expiry_date.gt.${new Date().toISOString().split("T")[0]}`)
          .ilike("users.full_name", `%${debouncedSearch}%`)
          .limit(10);

        if (!data) return [];
        // Dedupe by user id
        const seen = new Set<string>();
        const results: UserResult[] = [];
        for (const row of data) {
          const u = row.users as unknown as UserResult;
          if (u && !seen.has(u.id)) {
            seen.add(u.id);
            results.push({ id: u.id, full_name: u.full_name, email: u.email, position: u.position });
          }
        }
        return results;
      }

      // No state filter — just search all active users
      const { data } = await supabase
        .from("users")
        .select("id, full_name, email, position")
        .eq("org_id", userInfo.orgId)
        .eq("status", "active")
        .ilike("full_name", `%${debouncedSearch}%`)
        .order("full_name")
        .limit(8);
      return (data || []) as UserResult[];
    },
    enabled: !!userInfo && debouncedSearch.length >= 2,
    staleTime: 30_000,
  });

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        style={inputStyle}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => { if (search.length >= 2) setOpen(true); }}
        placeholder={placeholder || "Start typing a name..."}
      />
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
          background: "var(--bg-surface)", border: "1px solid var(--border-color)",
          borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: "auto",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}>
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => {
                onSelect(user.id, user.full_name);
                setSearch(user.full_name);
                setOpen(false);
              }}
              style={{
                width: "100%", textAlign: "left", padding: "8px 12px",
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--text-primary)", fontSize: 13,
                borderBottom: "1px solid var(--border-color)",
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "var(--bg-page)"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
            >
              <div style={{ fontWeight: 600 }}>{user.full_name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {[user.position, user.email].filter(Boolean).join(" \u00b7 ")}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && search.length >= 2 && results.length === 0 && stateFilter && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
          background: "var(--bg-surface)", border: "1px solid var(--border-color)",
          borderRadius: 8, marginTop: 4, padding: "10px 12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}>
          <p style={{ fontSize: 12, color: "#fb923c", margin: 0 }}>
            No licensed adjusters found for "{search}" in {stateFilter}
          </p>
        </div>
      )}
    </div>
  );
}
