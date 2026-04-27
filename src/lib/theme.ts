/**
 * Theme system — 2 styles × 3 modes = 6 combo cells.
 *
 * Modern (default, brand-facing) and Throwback (opt-in cyberpunk).
 * Each style supports Dark / Med / Light brightness modes.
 *
 * DOM contract: data-style="modern|throwback" + data-mode="dark|med|light"
 *               on documentElement.
 *
 * See DESIGN-RULES.md in the project root for the full spec.
 */

export type ThemeStyle = "modern" | "throwback";
export type ThemeMode = "dark" | "med" | "light";
export interface Theme {
  style: ThemeStyle;
  mode: ThemeMode;
}

const STYLE_KEY = "portal-theme-style";
const MODE_KEY = "portal-theme-mode";
const LEGACY_KEY = "portal-theme";
const LEGACY_COLORS_KEY = "portal-custom-colors";

const DEFAULT_THEME: Theme = { style: "modern", mode: "med" };

const fontsLoaded = new Set<ThemeStyle>();

function isStyle(v: unknown): v is ThemeStyle {
  return v === "modern" || v === "throwback";
}
function isMode(v: unknown): v is ThemeMode {
  return v === "dark" || v === "med" || v === "light";
}

/** Set DOM attributes + persist to localStorage. */
export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  root.setAttribute("data-style", t.style);
  root.setAttribute("data-mode", t.mode);
  root.removeAttribute("data-theme");
  localStorage.setItem(STYLE_KEY, t.style);
  localStorage.setItem(MODE_KEY, t.mode);
  void loadStyleFonts(t.style);
}

/**
 * Resolve the active theme by walking the priority chain:
 *   1. localStorage user override (new keys)
 *   2. Legacy localStorage (one-time migration: portal-theme dark|light → modern dark|light)
 *   3. Hardcoded fallback (Modern Med)
 *
 * Phase 2B (DB-backed org default) is not implemented yet.
 */
export function resolveTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const s = localStorage.getItem(STYLE_KEY);
  const m = localStorage.getItem(MODE_KEY);
  if (isStyle(s) && isMode(m)) return { style: s, mode: m };

  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy === "dark" || legacy === "light") {
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(LEGACY_COLORS_KEY);
    const migrated: Theme = { style: "modern", mode: legacy };
    localStorage.setItem(STYLE_KEY, migrated.style);
    localStorage.setItem(MODE_KEY, migrated.mode);
    return migrated;
  }
  // Clean up any orphan legacy color blob even if no theme key was set
  if (localStorage.getItem(LEGACY_COLORS_KEY)) {
    localStorage.removeItem(LEGACY_COLORS_KEY);
  }
  return DEFAULT_THEME;
}

/**
 * Lazy-load a style's font CSS by injecting a <link> tag.
 * No-op if already loaded this session or during SSR.
 * Never blocks — resolves on load OR error so theme switches stay snappy.
 */
export function loadStyleFonts(style: ThemeStyle): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (fontsLoaded.has(style)) return Promise.resolve();
  fontsLoaded.add(style);

  const id = `portal-fonts-${style}`;
  if (document.getElementById(id)) return Promise.resolve();

  const href =
    style === "modern"
      ? "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
      : "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700;800;900&family=Audiowide&family=JetBrains+Mono:wght@400;500;600;700&display=swap";

  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}
