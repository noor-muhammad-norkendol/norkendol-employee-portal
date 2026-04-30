"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import ThemePicker from "@/components/ThemePicker";
import { StartRaceButton } from "@/components/effects/TronTraffic";

function pageLabelFromPath(pathname: string): string {
  // /dashboard               → Dashboard
  // /dashboard/onboarder-kpi → Onboarder KPI
  // /dashboard/user-management → User Management
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return "Dashboard";
  if (segs.length === 1 && segs[0] === "dashboard") return "Dashboard";
  const last = segs[segs.length - 1];
  return last
    .split("-")
    .map((w) => (w === "kpi" || w === "ai" || w === "crm" || w === "tpn"
      ? w.toUpperCase()
      : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

export default function TopBar() {
  const [clock, setClock] = useState("");
  const [companyName, setCompanyName] = useState("Norkendol");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const pathname = usePathname();

  // HH:MM:SS clock — ticks every second
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Company name (from white-label storage)
  useEffect(() => {
    function load() {
      setCompanyName(localStorage.getItem("portal-company-name") || "Norkendol");
    }
    load();
    window.addEventListener("portal-branding-changed", load);
    return () => window.removeEventListener("portal-branding-changed", load);
  }, []);

  useEffect(() => {
    function loadPhoto() {
      setUserPhoto(localStorage.getItem("portal-user-photo"));
    }
    loadPhoto();
    window.addEventListener("portal-photo-changed", loadPhoto);
    return () => window.removeEventListener("portal-photo-changed", loadPhoto);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? "");
        setUserName(
          user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? ""
        );
        const { data: profile } = await supabase
          .from("users")
          .select("full_name, profile_picture_url")
          .eq("id", user.id)
          .single();
        if (profile) {
          if (profile.full_name) setUserName(profile.full_name);
          if (profile.profile_picture_url && !localStorage.getItem("portal-user-photo")) {
            setUserPhoto(profile.profile_picture_url);
            localStorage.setItem("portal-user-photo", profile.profile_picture_url);
          }
        }
      }
    });
  }, [supabase]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : userEmail.slice(0, 2).toUpperCase();

  const firstName = userName.split(" ")[0] || userEmail.split("@")[0];
  const pageLabel = pageLabelFromPath(pathname);

  return (
    <div
      className="relative flex items-center justify-between px-6 h-[80px] shrink-0"
      style={{ background: "var(--bg)" }}
    >
      {/* Gradient bottom divider — continues the line from the sidebar */}
      <span
        aria-hidden
        className="absolute left-0 right-0 bottom-0 pointer-events-none"
        style={{
          height: "1px",
          background:
            "linear-gradient(90deg, var(--accent) 0%, var(--violet) 50%, var(--magenta) 100%)",
          boxShadow:
            "0 0 14px color-mix(in srgb, var(--violet) 30%, transparent), 0 0 28px color-mix(in srgb, var(--magenta) 18%, transparent)",
        }}
      />
      {/* Breadcrumb */}
      <div
        className="flex items-center gap-2 text-sm font-medium"
        style={{ fontFamily: "var(--font-ui)" }}
      >
        <span style={{ color: "var(--text-dim)" }}>{companyName}</span>
        <span style={{ color: "var(--text-faint)" }}>/</span>
        <span
          style={{
            color: "var(--accent)",
            textShadow: "var(--accent-text-shadow)",
          }}
        >
          {pageLabel}
        </span>
      </div>

      {/* Right cluster: start-race + clock + search + bell + avatar */}
      <div className="flex items-center gap-3">
        {/* Start Race — Throwback-only easter egg trigger */}
        <StartRaceButton />

        {/* Digital clock pill */}
        <div
          className="px-3 py-1.5 text-sm font-mono tabular-nums tracking-wider"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--accent)",
            textShadow: "var(--accent-text-shadow)",
            background: "color-mix(in srgb, var(--accent) 6%, transparent)",
            border: "1px solid var(--border-active)",
            borderRadius: "var(--radius-input)",
            minWidth: "92px",
            textAlign: "center",
          }}
        >
          {clock}
        </div>

        {/* Search */}
        <button
          aria-label="Search"
          className="w-9 h-9 rounded-md flex items-center justify-center cursor-pointer transition-colors"
          style={{
            color: "var(--text-dim)",
            background: "transparent",
            border: "1px solid var(--border)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--accent)";
            e.currentTarget.style.borderColor = "var(--border-active)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-dim)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>

        {/* Notification bell */}
        <button
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-md flex items-center justify-center cursor-pointer transition-colors"
          style={{
            color: "var(--text-dim)",
            background: "transparent",
            border: "1px solid var(--border)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--accent)";
            e.currentTarget.style.borderColor = "var(--border-active)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-dim)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {/* Unread indicator dot */}
          <span
            aria-hidden
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{
              background: "var(--red)",
              boxShadow: "0 0 6px var(--red)",
            }}
          />
        </button>

        {/* Avatar + name + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 pl-1.5 pr-2 py-1 rounded-md cursor-pointer transition-colors"
            style={{ background: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--pad-elev)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span
              className="relative w-8 h-8 inline-flex items-center justify-center rounded-full text-xs font-bold shrink-0"
              style={{
                background: "color-mix(in srgb, var(--accent) 18%, var(--bg))",
                color: "var(--accent)",
                border: "1px solid var(--border-active)",
                textShadow: "var(--accent-text-shadow)",
              }}
            >
              {initials}
              {userPhoto && (
                <img
                  src={userPhoto}
                  alt={userName}
                  className="avatar-photo absolute inset-0 w-full h-full rounded-full object-cover"
                  style={{ border: "1px solid var(--border-active)" }}
                />
              )}
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: "var(--text)" }}
            >
              {firstName || "Loading..."}
            </span>
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-64 rounded-lg py-1 z-50"
              style={{
                background: "var(--pad)",
                border: "1px solid var(--border)",
                boxShadow: "var(--card-shadow)",
              }}
            >
              <div className="px-4 pt-3 pb-2">
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {userName || "—"}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {userEmail}
                </p>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", margin: "2px 0" }} />
              <button
                onClick={() => { setMenuOpen(false); router.push("/dashboard/my-settings"); }}
                className="w-full text-left px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2.5"
                style={{ color: "var(--text)", background: "transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--pad-elev)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z" /></svg>
                My Settings
              </button>
              <div style={{ borderTop: "1px solid var(--border)", margin: "2px 0" }} />
              <ThemePicker />
              <div style={{ borderTop: "1px solid var(--border)", margin: "2px 0" }} />
              <form action="/auth/signout" method="POST">
                <button
                  type="submit"
                  className="w-full text-left px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center gap-2.5"
                  style={{ color: "var(--text-dim)", background: "transparent" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--pad-elev)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                  Sign Out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
