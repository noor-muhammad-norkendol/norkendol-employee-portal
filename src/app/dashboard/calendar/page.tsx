"use client";

import { useEffect, useState } from "react";

type ProviderKey = "outlook" | "google-calendar";

type Provider = {
  key: ProviderKey;
  label: string;
  description: string;
  href: string;
  token: string;
  icon: React.ReactNode;
};

const PROVIDERS: Provider[] = [
  {
    key: "outlook",
    label: "Outlook Calendar",
    description: "Microsoft 365 calendar — meetings & events",
    href: "https://outlook.office.com/calendar",
    token: "--info",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    key: "google-calendar",
    label: "Google Calendar",
    description: "Google Workspace calendar",
    href: "https://calendar.google.com",
    token: "--green",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <circle cx="12" cy="16" r="2" />
      </svg>
    ),
  },
];

const STORAGE_KEY = "portal-calendar-provider";
const PAGE_TITLE_PRIMARY = "Calendar";

export default function CalendarPage() {
  const [pref, setPref] = useState<ProviderKey | "" | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY) as ProviderKey | null;
      setPref(v ?? "");
    } catch {
      setPref("");
    }
  }, []);

  useEffect(() => {
    if (!pref) return;
    const provider = PROVIDERS.find((p) => p.key === pref);
    if (!provider) return;
    const t = setTimeout(() => {
      window.open(provider.href, "_blank", "noopener,noreferrer");
    }, 500);
    return () => clearTimeout(t);
  }, [pref]);

  function pickProvider(key: ProviderKey) {
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {}
    const provider = PROVIDERS.find((p) => p.key === key);
    if (provider) window.open(provider.href, "_blank", "noopener,noreferrer");
    setPref(key);
  }

  function clearPreference() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setPref("");
  }

  if (pref === null) {
    return <div style={{ minHeight: 200 }} />;
  }

  if (pref) {
    const provider = PROVIDERS.find((p) => p.key === pref) ?? PROVIDERS[0];
    return <LaunchingCard provider={provider} onSwitch={clearPreference} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="page-title"
          style={{
            fontSize: "3rem",
            lineHeight: 1,
            letterSpacing: "-0.01em",
            fontFamily: "var(--font-display)",
            margin: 0,
          }}
        >
          <span style={{ color: "var(--accent)", textShadow: "var(--accent-text-shadow)", fontWeight: 800 }}>
            {PAGE_TITLE_PRIMARY}
          </span>
        </h1>
        <p className="mt-3 text-sm" style={{ color: "var(--text-dim)" }}>
          Pick your calendar. Your choice is saved — next time you open this page it&rsquo;ll launch automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
        {PROVIDERS.map((p) => (
          <ProviderCard key={p.key} provider={p} onPick={() => pickProvider(p.key)} />
        ))}
      </div>
    </div>
  );
}

/* ── chooser card ── */

function ProviderCard({ provider, onPick }: { provider: Provider; onPick: () => void }) {
  const tokenVar = `var(${provider.token})`;
  return (
    <button
      onClick={onPick}
      className="themed-card is-interactive"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "22px 24px",
        textAlign: "left",
        background: "var(--pad)",
        cursor: "pointer",
        width: "100%",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 56,
          height: 56,
          borderRadius: 12,
          background: `color-mix(in srgb, ${tokenVar} 14%, var(--pad))`,
          color: tokenVar,
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: `color-mix(in srgb, ${tokenVar} 35%, transparent)`,
          filter: `drop-shadow(0 0 8px color-mix(in srgb, ${tokenVar} 50%, transparent))`,
          flexShrink: 0,
        }}
      >
        {provider.icon}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          className="page-title"
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "var(--text)",
            fontFamily: "var(--font-display)",
          }}
        >
          {provider.label}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{provider.description}</div>
      </div>
      <span
        style={{
          color: tokenVar,
          fontFamily: "var(--font-display)",
          fontSize: 16,
          fontWeight: 700,
          textShadow: `0 0 8px color-mix(in srgb, ${tokenVar} 60%, transparent)`,
        }}
        aria-hidden
      >
        ↗
      </span>
    </button>
  );
}

/* ── auto-launch landing ── */

function LaunchingCard({ provider, onSwitch }: { provider: Provider; onSwitch: () => void }) {
  const tokenVar = `var(${provider.token})`;
  return (
    <div className="flex justify-center" style={{ paddingTop: 24 }}>
      <div className="themed-card" style={{ maxWidth: 640, width: "100%", padding: "40px 32px", textAlign: "center" }}>
        <div className="themed-card-stripe" aria-hidden />

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, position: "relative" }}>
          <span
            aria-hidden
            style={{
              position: "absolute",
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: `color-mix(in srgb, ${tokenVar} 35%, transparent)`,
              filter: "blur(28px)",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "relative",
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: `color-mix(in srgb, ${tokenVar} 18%, var(--pad))`,
              borderWidth: "1.5px",
              borderStyle: "solid",
              borderColor: `color-mix(in srgb, ${tokenVar} 50%, transparent)`,
              color: tokenVar,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 28px color-mix(in srgb, ${tokenVar} 45%, transparent)`,
            }}
          >
            <span style={{ transform: "scale(1.4)" }}>{provider.icon}</span>
          </div>
        </div>

        <h1
          className="page-title"
          style={{
            fontSize: "2.25rem",
            lineHeight: 1.1,
            fontFamily: "var(--font-display)",
            margin: 0,
            marginBottom: 12,
          }}
        >
          <span style={{ color: "var(--accent)", textShadow: "var(--accent-text-shadow)", fontWeight: 800 }}>
            Opening
          </span>{" "}
          <span style={{ color: "var(--text)", fontWeight: 500 }}>{provider.label}…</span>
        </h1>

        <p style={{ color: "var(--text-dim)", fontSize: 15, marginBottom: 28 }}>
          {provider.label} should open in a new window automatically.
        </p>

        <a
          href={provider.href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 24px",
            borderRadius: 8,
            background: "var(--cta-bg)",
            color: "var(--cta-text)",
            border: "none",
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            fontFamily: "var(--font-display)",
            cursor: "pointer",
            boxShadow: "var(--cta-shadow)",
            textDecoration: "none",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Open {provider.label}
        </a>

        <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 14 }}>
          Click the button above if {provider.label} didn&rsquo;t open automatically.
        </p>

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
          <button
            onClick={onSwitch}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "var(--font-display)",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            Use a different service
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
