import type { Metadata } from "next";
import QueryProvider from "@/components/QueryProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal",
  description: "Employee Portal",
};

/**
 * Inline FOUC script — runs before React hydrates.
 *
 * Resolves the active theme by walking the priority chain:
 *   1. New keys (portal-theme-style + portal-theme-mode)
 *   2. Legacy key (portal-theme = "dark"|"light") — one-time migration
 *   3. Default { modern, med }
 *
 * Sets data-style + data-mode on documentElement, lazy-loads only the
 * active style's font CSS, and clears legacy localStorage entries.
 *
 * Keep in sync with src/lib/theme.ts (resolveTheme + loadStyleFonts).
 */
const FOUC_SCRIPT = `
(function() {
  try {
    var STYLE_KEY = "portal-theme-style";
    var MODE_KEY = "portal-theme-mode";
    var LEGACY = "portal-theme";
    var LEGACY_COLORS = "portal-custom-colors";
    var FONT_LINKS = {
      modern:    "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
      throwback: "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700;800;900&family=Audiowide&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
    };

    var ls = window.localStorage;
    var s = ls.getItem(STYLE_KEY);
    var m = ls.getItem(MODE_KEY);

    var validStyle = s === "modern" || s === "throwback";
    var validMode = m === "dark" || m === "med" || m === "light";

    if (!validStyle || !validMode) {
      var legacy = ls.getItem(LEGACY);
      if (legacy === "dark" || legacy === "light") {
        s = "modern";
        m = legacy;
        ls.setItem(STYLE_KEY, s);
        ls.setItem(MODE_KEY, m);
      } else {
        s = "modern";
        m = "med";
      }
      ls.removeItem(LEGACY);
      ls.removeItem(LEGACY_COLORS);
    }

    var root = document.documentElement;
    root.setAttribute("data-style", s);
    root.setAttribute("data-mode", m);
    root.removeAttribute("data-theme");

    var href = FONT_LINKS[s];
    if (href && !document.getElementById("portal-fonts-" + s)) {
      var link = document.createElement("link");
      link.id = "portal-fonts-" + s;
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
      </head>
      <body className="h-full">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
