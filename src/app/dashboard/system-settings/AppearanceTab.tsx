"use client";

import React, { useState, useEffect } from "react";
import { cardStyle } from "@/lib/styles";

type ThemeMode = "dark" | "light";

function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("portal-theme", theme);
}

export default function AppearanceTab() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  // Load saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem("portal-theme") as ThemeMode | null;
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      applyTheme(saved);
    }
  }, []);

  const handleThemeChange = (t: ThemeMode) => {
    setTheme(t);
    applyTheme(t);
  };

  return (
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
        Customize your portal&apos;s look and feel. These settings apply to your organization.
      </p>

      {/* Theme Mode */}
      <div style={{ ...cardStyle, maxWidth: 600, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Theme Mode</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          Choose between dark and light mode for the entire portal.
        </p>

        <div style={{ display: "flex", gap: 12 }}>
          {/* Dark mode option */}
          <div
            onClick={() => handleThemeChange("dark")}
            style={{
              flex: 1, cursor: "pointer", borderRadius: 10, padding: 3,
              border: theme === "dark" ? "2px solid var(--accent)" : "2px solid var(--border-color)",
            }}
          >
            {/* Mini dark preview */}
            <div style={{ background: "#1c1c1c", borderRadius: 8, padding: 12, height: 100, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: "#3ecf8e" }} />
                <div style={{ height: 6, width: 60, background: "#333", borderRadius: 3 }} />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ height: 24, flex: 1, background: "#2a2a2a", borderRadius: 4 }} />
                <div style={{ height: 24, flex: 1, background: "#2a2a2a", borderRadius: 4 }} />
                <div style={{ height: 24, flex: 1, background: "#2a2a2a", borderRadius: 4 }} />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ height: 6, width: 40, background: "#333", borderRadius: 3 }} />
                <div style={{ height: 6, width: 30, background: "#333", borderRadius: 3 }} />
              </div>
            </div>
            <div style={{ textAlign: "center", padding: "8px 0 4px", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
              Dark Mode {theme === "dark" && "✓"}
            </div>
          </div>

          {/* Light mode option */}
          <div
            onClick={() => handleThemeChange("light")}
            style={{
              flex: 1, cursor: "pointer", borderRadius: 10, padding: 3,
              border: theme === "light" ? "2px solid var(--accent)" : "2px solid var(--border-color)",
            }}
          >
            {/* Mini light preview */}
            <div style={{ background: "#f5f5f5", borderRadius: 8, padding: 12, height: 100, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: "#16a34a" }} />
                <div style={{ height: 6, width: 60, background: "#d4d4d4", borderRadius: 3 }} />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ height: 24, flex: 1, background: "#ffffff", borderRadius: 4, border: "1px solid #e0e0e0" }} />
                <div style={{ height: 24, flex: 1, background: "#ffffff", borderRadius: 4, border: "1px solid #e0e0e0" }} />
                <div style={{ height: 24, flex: 1, background: "#ffffff", borderRadius: 4, border: "1px solid #e0e0e0" }} />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ height: 6, width: 40, background: "#d4d4d4", borderRadius: 3 }} />
                <div style={{ height: 6, width: 30, background: "#d4d4d4", borderRadius: 3 }} />
              </div>
            </div>
            <div style={{ textAlign: "center", padding: "8px 0 4px", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
              Light Mode {theme === "light" && "✓"}
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder sections for future */}
      <div style={{ ...cardStyle, maxWidth: 600, marginBottom: 20, opacity: 0.5 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Brand Colors</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Custom color pickers for primary, accent, sidebar, and navigation colors. Coming soon.
        </p>
      </div>

      <div style={{ ...cardStyle, maxWidth: 600, opacity: 0.5 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Logo & Branding</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Upload your company logo and set your display name. Coming soon.
        </p>
      </div>
    </div>
  );
}
