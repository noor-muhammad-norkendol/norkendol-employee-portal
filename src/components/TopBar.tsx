"use client";

import { useEffect, useState } from "react";

export default function TopBar() {
  const [dateTime, setDateTime] = useState("");

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

  return (
    <div
      className="flex items-center justify-between px-6 h-[52px] border-b shrink-0"
      style={{ borderColor: "var(--border-color)" }}
    >
      {/* Left: date & time */}
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {dateTime}
      </span>

      {/* Right: user */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}
          >
            FD
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Frank Dalton
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Super Admin
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
