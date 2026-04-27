"use client";

import React, { useState, useEffect } from "react";
import { cardStyle } from "@/lib/styles";

/**
 * Company Logo tab — white-label branding controls (logo + company name).
 *
 * Persists to localStorage:
 *   - portal-logo (base64 data URL)
 *   - portal-company-name (string)
 *
 * Dispatches `portal-branding-changed` so IconSidebar (and any other
 * branding consumers) pick up changes immediately without a page reload.
 */
export default function CompanyLogoTab() {
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
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
        Replace the default logo and name with your own. This appears in the sidebar for all users in your organization.
      </p>

      <div style={{ ...cardStyle, maxWidth: 700 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Logo & Company Name</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          Upload a logo (PNG, JPG, SVG — under 500KB) and set the company name shown in the sidebar.
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
    </div>
  );
}
