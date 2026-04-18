/**
 * Shared theme utilities — used by AppearanceTab and AIDesigner.
 * Single source of truth for applying/clearing custom colors.
 */

export interface CustomColors {
  accent: string;
  sidebarBg: string;
  topbarBg: string;
  pageBg: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
}

export const DARK_DEFAULTS: CustomColors = {
  accent: "#3ecf8e",
  sidebarBg: "#242424",
  topbarBg: "#242424",
  pageBg: "#1c1c1c",
  cardBg: "#2a2a2a",
  textPrimary: "#ededed",
  textSecondary: "#888888",
  borderColor: "#333333",
};

export const LIGHT_DEFAULTS: CustomColors = {
  accent: "#16a34a",
  sidebarBg: "#ffffff",
  topbarBg: "#ffffff",
  pageBg: "#f5f5f5",
  cardBg: "#ffffff",
  textPrimary: "#1a1a1a",
  textSecondary: "#555555",
  borderColor: "#d4d4d4",
};

export function applyCustomColors(colors: CustomColors) {
  const root = document.documentElement;
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--accent-hover", colors.accent);
  root.style.setProperty("--bg-secondary", colors.sidebarBg);
  root.style.setProperty("--bg-primary", colors.pageBg);
  root.style.setProperty("--bg-surface", colors.cardBg);
  root.style.setProperty("--text-primary", colors.textPrimary);
  root.style.setProperty("--text-secondary", colors.textSecondary);
  root.style.setProperty("--border-color", colors.borderColor);
  localStorage.setItem("portal-custom-colors", JSON.stringify(colors));
}

export function clearCustomColors() {
  const root = document.documentElement;
  const props = ["--accent", "--accent-hover", "--bg-secondary", "--bg-primary", "--bg-surface", "--text-primary", "--text-secondary", "--border-color"];
  props.forEach((p) => root.style.removeProperty(p));
  localStorage.removeItem("portal-custom-colors");
}

export type ThemeMode = "dark" | "light";

export function applyThemeMode(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("portal-theme", theme);
}
