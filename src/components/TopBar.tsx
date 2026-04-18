"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function TopBar() {
  const [dateTime, setDateTime] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [supabase] = useState(() => createClient());
  const router = useRouter();

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setDateTime(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }) +
          "  ·  " +
          now.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })
      );
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? "");
        setUserName(
          user.user_metadata?.full_name ??
            user.email?.split("@")[0] ??
            ""
        );
        // Fetch profile picture from users table
        const { data: profile } = await supabase
          .from("users")
          .select("full_name, profile_picture_url")
          .eq("id", user.id)
          .single();
        if (profile) {
          if (profile.full_name) setUserName(profile.full_name);
          if (profile.profile_picture_url) setUserPhoto(profile.profile_picture_url);
        }
      }
    });
  }, []);

  // Close menu on click outside
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
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : userEmail.slice(0, 2).toUpperCase();

  return (
    <div
      className="flex items-center justify-between px-6 h-[52px] border-b shrink-0"
      style={{ borderColor: "var(--border-color)" }}
    >
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {dateTime}
      </span>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
        >
          {userPhoto ? (
            <img src={userPhoto} alt={userName} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}
            >
              {initials}
            </div>
          )}
          <div className="leading-tight text-left">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {userName || userEmail || "Loading..."}
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {userEmail}
            </p>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)" }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-1 w-48 rounded-lg py-1 shadow-lg z-50"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
          >
            <button
              onClick={() => { setMenuOpen(false); router.push("/dashboard/my-settings"); }}
              className="w-full text-left px-4 py-2.5 text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)] flex items-center gap-2.5"
              style={{ color: "var(--text-primary)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z" /></svg>
              My Settings
            </button>
            <div style={{ borderTop: "1px solid var(--border-color)", margin: "2px 0" }} />
            <form action="/auth/signout" method="POST">
              <button
                type="submit"
                className="w-full text-left px-4 py-2.5 text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)] flex items-center gap-2.5"
                style={{ color: "var(--text-secondary)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                Sign Out
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
