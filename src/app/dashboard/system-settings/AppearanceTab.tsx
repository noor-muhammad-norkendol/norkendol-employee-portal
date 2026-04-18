"use client";

import React, { useState, useEffect } from "react";
import { cardStyle } from "@/lib/styles";

type ThemeMode = "dark" | "light";

/* ── Logo & Company Name Section ───────────────────── */

function LogoBrandingSection() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedLogo = localStorage.getItem("portal-logo");
    const savedName = localStorage.getItem("portal-company-name");
    if (savedLogo) setLogoUrl(savedLogo);
    if (savedName) setCompanyName(savedName);
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      alert("Logo must be under 500KB. Try a smaller image or a PNG/SVG.");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLogoUrl(dataUrl);
      localStorage.setItem("portal-logo", dataUrl);
      // Dispatch event so IconSidebar picks it up immediately
      window.dispatchEvent(new Event("portal-branding-changed"));
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    localStorage.removeItem("portal-logo");
    window.dispatchEvent(new Event("portal-branding-changed"));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleNameChange = (name: string) => {
    setCompanyName(name);
    if (name.trim()) {
      localStorage.setItem("portal-company-name", name.trim());
    } else {
      localStorage.removeItem("portal-company-name");
    }
    window.dispatchEvent(new Event("portal-branding-changed"));
  };

  return (
    <div style={{ ...cardStyle, maxWidth: 700 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Logo & Company Name</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
        Replace the default logo and name with your own. This appears in the sidebar for all users in your organization.
      </p>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* Logo upload */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: 10, overflow: "hidden",
              border: "2px dashed var(--border-color)", display: "flex",
              alignItems: "center", justifyContent: "center", cursor: "pointer",
              background: "var(--bg-primary)",
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: 24, color: "var(--text-muted)" }}>+</span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={handleLogoUpload}
            style={{ display: "none" }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6,
                padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}
            >
              {uploading ? "..." : logoUrl ? "Change" : "Upload"}
            </button>
            {logoUrl && (
              <button
                onClick={handleRemoveLogo}
                style={{
                  background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-color)",
                  borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer",
                }}
              >
                Remove
              </button>
            )}
          </div>
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>PNG, JPG, SVG — max 500KB</span>
        </div>

        {/* Company name + preview */}
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
            Company Name
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Your Company Name"
            style={{
              background: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: 6,
              padding: "8px 12px", fontSize: 13, color: "var(--text-primary)", width: "100%", outline: "none",
              marginBottom: 16,
            }}
          />

          {/* Sidebar preview */}
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
            Sidebar Preview
          </label>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px",
            background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-color)",
          }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "contain" }} />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: 6, background: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 700, color: "#fff",
              }}>
                {companyName ? companyName.charAt(0).toUpperCase() : "N"}
              </div>
            )}
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              {companyName || "Portal"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CustomColors {
  accent: string;
  sidebarBg: string;
  topbarBg: string;
  pageBg: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
}

const DARK_DEFAULTS: CustomColors = {
  accent: "#3ecf8e",
  sidebarBg: "#242424",
  topbarBg: "#242424",
  pageBg: "#1c1c1c",
  cardBg: "#2a2a2a",
  textPrimary: "#ededed",
  textSecondary: "#888888",
  borderColor: "#333333",
};

const LIGHT_DEFAULTS: CustomColors = {
  accent: "#16a34a",
  sidebarBg: "#ffffff",
  topbarBg: "#ffffff",
  pageBg: "#f5f5f5",
  cardBg: "#ffffff",
  textPrimary: "#1a1a1a",
  textSecondary: "#555555",
  borderColor: "#d4d4d4",
};

const COLOR_FIELDS: { key: keyof CustomColors; label: string; description: string }[] = [
  { key: "accent", label: "Accent Color", description: "Buttons, active tabs, highlights, and the logo badge" },
  { key: "sidebarBg", label: "Sidebar", description: "Background of the left icon sidebar" },
  { key: "topbarBg", label: "Top Bar", description: "Background of the top navigation bar" },
  { key: "pageBg", label: "Page Background", description: "Main content area background" },
  { key: "cardBg", label: "Cards & Panels", description: "Background of cards, modals, and surface elements" },
  { key: "textPrimary", label: "Primary Text", description: "Headings and main content text" },
  { key: "textSecondary", label: "Secondary Text", description: "Descriptions, labels, and muted text" },
  { key: "borderColor", label: "Borders", description: "Card borders, dividers, and input outlines" },
];

function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("portal-theme", theme);
}

function applyCustomColors(colors: CustomColors) {
  const root = document.documentElement;
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--accent-hover", colors.accent);
  root.style.setProperty("--bg-secondary", colors.sidebarBg);
  root.style.setProperty("--bg-primary", colors.pageBg);
  root.style.setProperty("--bg-surface", colors.cardBg);
  root.style.setProperty("--text-primary", colors.textPrimary);
  root.style.setProperty("--text-secondary", colors.textSecondary);
  root.style.setProperty("--border-color", colors.borderColor);
  // Top bar uses --bg-secondary, sidebar uses --bg-secondary — both covered
  localStorage.setItem("portal-custom-colors", JSON.stringify(colors));
}

function clearCustomColors() {
  const root = document.documentElement;
  const props = ["--accent", "--accent-hover", "--bg-secondary", "--bg-primary", "--bg-surface", "--text-primary", "--text-secondary", "--border-color"];
  props.forEach((p) => root.style.removeProperty(p));
  localStorage.removeItem("portal-custom-colors");
}

export default function AppearanceTab() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [colors, setColors] = useState<CustomColors>(DARK_DEFAULTS);
  const [hasCustomColors, setHasCustomColors] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("portal-theme") as ThemeMode | null;
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      setColors(savedTheme === "light" ? LIGHT_DEFAULTS : DARK_DEFAULTS);
    }
    const savedColors = localStorage.getItem("portal-custom-colors");
    if (savedColors) {
      try {
        const parsed = JSON.parse(savedColors) as CustomColors;
        setColors(parsed);
        setHasCustomColors(true);
        applyCustomColors(parsed);
      } catch { /* ignore */ }
    }
  }, []);

  const handleThemeChange = (t: ThemeMode) => {
    setTheme(t);
    applyTheme(t);
    clearCustomColors();
    const defaults = t === "light" ? LIGHT_DEFAULTS : DARK_DEFAULTS;
    setColors(defaults);
    setHasCustomColors(false);
  };

  const handleColorChange = (key: keyof CustomColors, value: string) => {
    const updated = { ...colors, [key]: value };
    setColors(updated);
    setHasCustomColors(true);
    applyCustomColors(updated);
  };

  const handleReset = () => {
    clearCustomColors();
    const defaults = theme === "light" ? LIGHT_DEFAULTS : DARK_DEFAULTS;
    setColors(defaults);
    setHasCustomColors(false);
    applyTheme(theme);
  };

  return (
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
        Customize your portal&apos;s look and feel. These settings apply to your organization.
      </p>

      {/* Theme Mode */}
      <div style={{ ...cardStyle, maxWidth: 700, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Theme Mode</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          Choose between dark and light mode. Custom colors below will override the defaults.
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
            <div style={{ background: "#1c1c1c", borderRadius: 8, padding: 12, height: 80, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: "#3ecf8e" }} />
                <div style={{ height: 5, width: 50, background: "#333", borderRadius: 3 }} />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ height: 18, flex: 1, background: "#2a2a2a", borderRadius: 4 }} />
                <div style={{ height: 18, flex: 1, background: "#2a2a2a", borderRadius: 4 }} />
              </div>
            </div>
            <div style={{ textAlign: "center", padding: "6px 0 2px", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
              Dark {theme === "dark" && "✓"}
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
            <div style={{ background: "#f5f5f5", borderRadius: 8, padding: 12, height: 80, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: "#16a34a" }} />
                <div style={{ height: 5, width: 50, background: "#d4d4d4", borderRadius: 3 }} />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ height: 18, flex: 1, background: "#fff", borderRadius: 4, border: "1px solid #e0e0e0" }} />
                <div style={{ height: 18, flex: 1, background: "#fff", borderRadius: 4, border: "1px solid #e0e0e0" }} />
              </div>
            </div>
            <div style={{ textAlign: "center", padding: "6px 0 2px", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
              Light {theme === "light" && "✓"}
            </div>
          </div>
        </div>
      </div>

      {/* Brand Colors */}
      <div style={{ ...cardStyle, maxWidth: 700, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Brand Colors</h3>
          {hasCustomColors && (
            <button onClick={handleReset} style={{
              background: "transparent", border: "1px solid var(--border-color)", borderRadius: 6,
              padding: "4px 12px", fontSize: 11, color: "var(--text-secondary)", cursor: "pointer",
            }}>
              Reset to Defaults
            </button>
          )}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          Pick colors and watch the portal update in real time. Changes are saved automatically.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {COLOR_FIELDS.map((field) => (
            <div key={field.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg-primary)", borderRadius: 8, border: "1px solid var(--border-color)" }}>
              <input
                type="color"
                value={colors[field.key]}
                onChange={(e) => handleColorChange(field.key, e.target.value)}
                style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", background: "transparent", padding: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{field.label}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{field.description}</div>
              </div>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)", flexShrink: 0 }}>
                {colors[field.key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div style={{ ...cardStyle, maxWidth: 700, marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Live Preview</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          This is how your portal looks with the current colors.
        </p>

        <div style={{ border: "1px solid var(--border-color)", borderRadius: 10, overflow: "hidden", height: 220 }}>
          {/* Mini portal preview */}
          <div style={{ display: "flex", height: "100%" }}>
            {/* Sidebar */}
            <div style={{ width: 44, background: colors.sidebarBg, borderRight: `1px solid ${colors.borderColor}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0", gap: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: colors.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700 }}>N</div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ width: 18, height: 18, borderRadius: 4, background: i === 1 ? colors.accent + "33" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: i === 1 ? colors.accent : colors.textSecondary + "44" }} />
                </div>
              ))}
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {/* Top bar */}
              <div style={{ height: 36, background: colors.topbarBg, borderBottom: `1px solid ${colors.borderColor}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ height: 4, width: 30, background: colors.textPrimary, borderRadius: 2, opacity: 0.6 }} />
                  <div style={{ height: 4, width: 20, background: colors.textSecondary, borderRadius: 2, opacity: 0.4 }} />
                </div>
                <div style={{ width: 18, height: 18, borderRadius: 9, background: colors.accent, opacity: 0.7 }} />
              </div>

              {/* Content area */}
              <div style={{ flex: 1, background: colors.pageBg, padding: 12 }}>
                <div style={{ height: 6, width: 80, background: colors.textPrimary, borderRadius: 3, marginBottom: 10, opacity: 0.7 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                  {["#60a5fa", "#facc15", "#4ade80"].map((c, i) => (
                    <div key={i} style={{ background: colors.cardBg, borderRadius: 6, padding: 8, border: `1px solid ${colors.borderColor}` }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: c, marginBottom: 2 }}>{[142, 8, "$67k"][i]}</div>
                      <div style={{ height: 3, width: 30, background: colors.textSecondary, borderRadius: 2, opacity: 0.3 }} />
                    </div>
                  ))}
                </div>
                <div style={{ background: colors.cardBg, borderRadius: 6, padding: 8, border: `1px solid ${colors.borderColor}` }}>
                  {[0.7, 0.5, 0.3].map((w, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: i < 2 ? 6 : 0 }}>
                      <div style={{ height: 3, width: `${w * 100}%`, background: colors.accent, borderRadius: 2, opacity: 0.6 }} />
                      <div style={{ height: 3, width: 16, background: colors.textSecondary, borderRadius: 2, opacity: 0.3 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logo & Company Name */}
      <LogoBrandingSection />
    </div>
  );
}
