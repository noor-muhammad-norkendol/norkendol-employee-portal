import type React from "react";

/**
 * Shared style constants used across the portal.
 * Consolidates cardStyle, inputStyle, labelStyle, btnPrimary, etc.
 * from 20+ files into one source of truth.
 */

export const cardStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  borderRadius: 10,
  padding: "18px 22px",
  border: "1px solid var(--border-color)",
};

export const inputStyle: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  width: "100%",
  outline: "none",
};

export const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--text-secondary)",
  display: "block",
  marginBottom: 4,
};

export const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

export const btnPrimary: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

export const btnOutline: React.CSSProperties = {
  background: "transparent",
  color: "var(--text-primary)",
  border: "1px solid var(--border-color)",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12,
  cursor: "pointer",
};

export const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  textAlign: "left",
  borderBottom: "1px solid var(--border-color)",
  whiteSpace: "nowrap",
};

export const tdStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 13,
  color: "var(--text-primary)",
  borderBottom: "1px solid var(--border-color)",
};

export const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.6)",
};
