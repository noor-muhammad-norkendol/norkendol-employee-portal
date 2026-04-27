"use client";

import { useEffect, useState } from "react";
import { applyTheme, resolveTheme, ThemeStyle, ThemeMode } from "@/lib/theme";

const THROWBACK_TOUCHED_KEY = "portal-throwback-touched";

const STYLE_OPTIONS: { value: ThemeStyle; label: string }[] = [
  { value: "modern", label: "Modern" },
  { value: "throwback", label: "Throwback" },
];

const MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "med", label: "Med" },
  { value: "light", label: "Light" },
];

export default function ThemePicker() {
  const [style, setStyle] = useState<ThemeStyle>("modern");
  const [mode, setMode] = useState<ThemeMode>("med");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = resolveTheme();
    setStyle(t.style);
    setMode(t.mode);
    setMounted(true);
  }, []);

  function handleStyleChange(next: ThemeStyle) {
    if (next === style) return;
    let nextMode = mode;
    // First-time Throwback activation defaults to Med (friendlier entry than full neon Dark)
    if (next === "throwback" && !localStorage.getItem(THROWBACK_TOUCHED_KEY)) {
      localStorage.setItem(THROWBACK_TOUCHED_KEY, "1");
      nextMode = "med";
      setMode("med");
    }
    setStyle(next);
    applyTheme({ style: next, mode: nextMode });
  }

  function handleModeChange(next: ThemeMode) {
    if (next === mode) return;
    setMode(next);
    applyTheme({ style, mode: next });
  }

  if (!mounted) return null;

  return (
    <div style={{ padding: "10px 14px 12px" }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 8,
        }}
      >
        Appearance
      </div>

      <Segment
        label="Style"
        options={STYLE_OPTIONS}
        value={style}
        onChange={(v) => handleStyleChange(v as ThemeStyle)}
      />
      <div style={{ height: 6 }} />
      <Segment
        label="Mode"
        options={MODE_OPTIONS}
        value={mode}
        onChange={(v) => handleModeChange(v as ThemeMode)}
      />
    </div>
  );
}

interface SegmentProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}

function Segment({ label, options, value, onChange }: SegmentProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: "var(--text-secondary)",
          width: 36,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: `repeat(${options.length}, 1fr)`,
          gap: 2,
          padding: 2,
          background: "var(--bg-primary)",
          border: "1px solid var(--border-color)",
          borderRadius: 7,
        }}
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              style={{
                fontSize: 11,
                fontWeight: active ? 600 : 500,
                padding: "5px 6px",
                borderRadius: 5,
                background: active ? "var(--accent)" : "transparent",
                color: active ? "var(--cta-text, #fff)" : "var(--text-secondary)",
                border: "none",
                cursor: active ? "default" : "pointer",
                transition: "background var(--transition-fast, 160ms), color var(--transition-fast, 160ms)",
                whiteSpace: "nowrap",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
