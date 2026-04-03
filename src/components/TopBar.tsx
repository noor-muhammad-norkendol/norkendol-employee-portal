"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

export default function TopBar() {
  const [dateTime, setDateTime] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const supabase = createClient();

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
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? "");
        setUserName(
          user.user_metadata?.full_name ??
            user.email?.split("@")[0] ??
            ""
        );
      }
    });
  }, []);

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

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}
          >
            {initials}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {userName || userEmail || "Loading..."}
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {userEmail}
            </p>
          </div>
        </div>
        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="text-xs px-3 py-1 rounded-md border cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
            style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
