"use client";

import React, { useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { cardStyle } from "@/lib/styles";

interface AnalysisColors {
  accent: string;
  sidebarBg: string;
  topbarBg: string;
  pageBg: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
}

interface AnalysisResult {
  colors: AnalysisColors;
  layout: {
    navStyle: string;
    density: string;
    themeMode: string;
  };
  components: {
    statusIndicator: string;
    dataViz: string;
    menuStyle: string;
    formControls: string;
    loading: string;
  };
  summary: string;
}

type Step = "upload" | "analyzing" | "results" | "walkthrough" | "done";

/* ── Walkthrough steps ───────────────────────────── */

interface WalkthroughItem {
  label: string;
  description: string;
  key: string;
  options: { value: string; label: string; render: () => React.ReactNode }[];
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return <span style={{ background: `${color}22`, color, padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{label}</span>;
}

function CircleLetter({ letter, color }: { letter: string; color: string }) {
  return <div style={{ width: 36, height: 36, borderRadius: 18, border: `3px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color }}>{letter}</div>;
}

const WALKTHROUGH: WalkthroughItem[] = [
  {
    label: "Status Indicators",
    description: "How should statuses like Active, Pending, and Urgent be displayed?",
    key: "statusIndicator",
    options: [
      {
        value: "badge", label: "Colored Badge",
        render: () => <div style={{ display: "flex", gap: 8 }}><StatusBadge label="Active" color="#4ade80" /><StatusBadge label="Pending" color="#facc15" /><StatusBadge label="Urgent" color="#ef4444" /></div>,
      },
      {
        value: "circle", label: "Circle Letter",
        render: () => <div style={{ display: "flex", gap: 10 }}><CircleLetter letter="A" color="#4ade80" /><CircleLetter letter="P" color="#facc15" /><CircleLetter letter="U" color="#ef4444" /></div>,
      },
      {
        value: "progressBar", label: "Progress Bar",
        render: () => (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 180 }}>
            {[{ l: "Active", p: 76, c: "#4ade80" }, { l: "Pending", p: 22, c: "#facc15" }].map((b) => (
              <div key={b.l}><span style={{ fontSize: 10, color: "var(--text-muted)" }}>{b.l}</span><div style={{ height: 6, background: "var(--bg-hover)", borderRadius: 3, marginTop: 2 }}><div style={{ height: 6, width: `${b.p}%`, background: b.c, borderRadius: 3 }} /></div></div>
            ))}
          </div>
        ),
      },
    ],
  },
  {
    label: "Data Visualization",
    description: "How should numbers and metrics be displayed on dashboards?",
    key: "dataViz",
    options: [
      {
        value: "bigNumber", label: "Big Numbers",
        render: () => (
          <div style={{ display: "flex", gap: 16 }}>
            {[{ n: "142", l: "Open", c: "#60a5fa" }, { n: "$67k", l: "Value", c: "#4ade80" }].map((s) => (
              <div key={s.l} style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 700, color: s.c }}>{s.n}</div><div style={{ fontSize: 9, color: "var(--text-muted)" }}>{s.l}</div></div>
            ))}
          </div>
        ),
      },
      {
        value: "horizontalBar", label: "Horizontal Bars",
        render: () => (
          <div style={{ width: 180, display: "flex", flexDirection: "column", gap: 6 }}>
            {[{ l: "Claims", p: 76, c: "#60a5fa" }, { l: "Tasks", p: 45, c: "#facc15" }].map((b) => (
              <div key={b.l}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}><span style={{ color: "var(--text-muted)" }}>{b.l}</span><span style={{ color: "var(--text-muted)" }}>{b.p}</span></div><div style={{ height: 6, background: "var(--bg-hover)", borderRadius: 3, marginTop: 2 }}><div style={{ height: 6, width: `${b.p}%`, background: b.c, borderRadius: 3 }} /></div></div>
            ))}
          </div>
        ),
      },
      {
        value: "donut", label: "Circle / Donut",
        render: () => (
          <div style={{ display: "flex", gap: 12 }}>
            {[{ l: "L", n: 205, c: "#60a5fa" }, { l: "P", n: 94, c: "#f97316" }, { l: "A", n: 12, c: "#4ade80" }].map((c) => (
              <div key={c.l} style={{ textAlign: "center" }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, border: `3px solid ${c.c}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: c.c }}>{c.l}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>{c.n}</div>
              </div>
            ))}
          </div>
        ),
      },
    ],
  },
  {
    label: "Menu Style",
    description: "What kind of menu icon do your users expect to see?",
    key: "menuStyle",
    options: [
      { value: "hamburger", label: "Hamburger (☰)", render: () => <span style={{ fontSize: 28 }}>☰</span> },
      { value: "kebab", label: "Kebab (⋮)", render: () => <span style={{ fontSize: 28 }}>⋮</span> },
      { value: "meatball", label: "Meatball (⋯)", render: () => <span style={{ fontSize: 28 }}>⋯</span> },
      { value: "bento", label: "Bento Grid (⊞)", render: () => <span style={{ fontSize: 28 }}>⊞</span> },
    ],
  },
  {
    label: "Form Controls",
    description: "Do your users prefer checkboxes or toggle switches for on/off options?",
    key: "formControls",
    options: [
      {
        value: "checkbox", label: "Checkboxes",
        render: () => (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {["Email alerts", "SMS alerts"].map((l, i) => (
              <label key={l} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--text-primary)" }}>
                <input type="checkbox" defaultChecked={i === 0} style={{ accentColor: "var(--accent)" }} />{l}
              </label>
            ))}
          </div>
        ),
      },
      {
        value: "switch", label: "Toggle Switches",
        render: () => (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[true, false].map((on, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 34, height: 18, borderRadius: 9, background: on ? "var(--accent)" : "var(--bg-hover)", padding: 2 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff", transform: on ? "translateX(16px)" : "translateX(0)" }} />
                </div>
                <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{["Email alerts", "SMS alerts"][i]}</span>
              </div>
            ))}
          </div>
        ),
      },
    ],
  },
  {
    label: "Loading Indicator",
    description: "What should users see while content is loading?",
    key: "loading",
    options: [
      {
        value: "spinner", label: "Spinner",
        render: () => (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 20, height: 20, border: "3px solid var(--bg-hover)", borderTopColor: "var(--accent)", borderRadius: 10, animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Loading...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ),
      },
      {
        value: "skeleton", label: "Skeleton Placeholder",
        render: () => (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[70, 90, 50].map((w, i) => (
              <div key={i} style={{ height: 10, width: `${w}%`, background: "var(--bg-hover)", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
            ))}
            <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
          </div>
        ),
      },
      {
        value: "progressBar", label: "Progress Bar",
        render: () => (
          <div style={{ width: 160 }}>
            <div style={{ height: 6, background: "var(--bg-hover)", borderRadius: 3 }}>
              <div style={{ height: 6, width: "67%", background: "var(--accent)", borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Loading... 67%</span>
          </div>
        ),
      },
    ],
  },
];

/* ── Main Component ───────────────────────────── */

export default function AIDesigner() {
  const [supabase] = useState(() => createClient());
  const [step, setStep] = useState<Step>("upload");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walkthroughIndex, setWalkthroughIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [savedState, setSavedState] = useState<{ theme: string | null; colors: string | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Snapshot current state before making changes
  const snapshotCurrentState = () => {
    setSavedState({
      theme: localStorage.getItem("portal-theme"),
      colors: localStorage.getItem("portal-custom-colors"),
    });
  };

  const handleRevert = () => {
    // Restore saved state
    const root = document.documentElement;
    const props = ["--accent", "--accent-hover", "--bg-secondary", "--bg-primary", "--bg-surface", "--text-primary", "--text-secondary", "--border-color"];
    props.forEach((p) => root.style.removeProperty(p));

    if (savedState) {
      if (savedState.theme) {
        localStorage.setItem("portal-theme", savedState.theme);
        root.setAttribute("data-theme", savedState.theme);
      } else {
        localStorage.removeItem("portal-theme");
        root.removeAttribute("data-theme");
      }
      if (savedState.colors) {
        localStorage.setItem("portal-custom-colors", savedState.colors);
        const colors = JSON.parse(savedState.colors);
        root.style.setProperty("--accent", colors.accent);
        root.style.setProperty("--accent-hover", colors.accent);
        root.style.setProperty("--bg-secondary", colors.sidebarBg);
        root.style.setProperty("--bg-primary", colors.pageBg);
        root.style.setProperty("--bg-surface", colors.cardBg);
        root.style.setProperty("--text-primary", colors.textPrimary);
        root.style.setProperty("--text-secondary", colors.textSecondary);
        root.style.setProperty("--border-color", colors.borderColor);
      } else {
        localStorage.removeItem("portal-custom-colors");
      }
    } else {
      localStorage.removeItem("portal-custom-colors");
      localStorage.removeItem("portal-theme");
      root.setAttribute("data-theme", "dark");
    }

    handleStartOver();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imagePreview) return;
    snapshotCurrentState();
    setStep("analyzing");
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Not authenticated");
      setStep("upload");
      return;
    }

    try {
      const res = await fetch("/api/design-analyzer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageData: imagePreview }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Analysis failed");
        setStep("upload");
        return;
      }

      setAnalysis(data.analysis);
      // Pre-fill walkthrough selections from AI analysis
      if (data.analysis.components) {
        setSelections(data.analysis.components);
      }
      setStep("results");
    } catch {
      setError("Failed to connect to AI service");
      setStep("upload");
    }
  };

  const applyColors = () => {
    if (!analysis?.colors) return;
    const c = analysis.colors;
    // Save to localStorage (same format as AppearanceTab)
    localStorage.setItem("portal-custom-colors", JSON.stringify(c));
    // Apply to CSS variables
    const root = document.documentElement;
    root.style.setProperty("--accent", c.accent);
    root.style.setProperty("--accent-hover", c.accent);
    root.style.setProperty("--bg-secondary", c.sidebarBg);
    root.style.setProperty("--bg-primary", c.pageBg);
    root.style.setProperty("--bg-surface", c.cardBg);
    root.style.setProperty("--text-primary", c.textPrimary);
    root.style.setProperty("--text-secondary", c.textSecondary);
    root.style.setProperty("--border-color", c.borderColor);
    // Set theme mode
    if (analysis.layout?.themeMode) {
      const mode = analysis.layout.themeMode === "light" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", mode);
      localStorage.setItem("portal-theme", mode);
    }
  };

  const handleApplyAndContinue = () => {
    applyColors();
    setWalkthroughIndex(0);
    setStep("walkthrough");
  };

  const handleWalkthroughSelect = (key: string, value: string) => {
    setSelections((prev) => ({ ...prev, [key]: value }));
  };

  const handleWalkthroughNext = () => {
    if (walkthroughIndex < WALKTHROUGH.length - 1) {
      setWalkthroughIndex(walkthroughIndex + 1);
    } else {
      // Save all selections
      localStorage.setItem("portal-component-prefs", JSON.stringify(selections));
      setStep("done");
    }
  };

  const handleStartOver = () => {
    setStep("upload");
    setImagePreview(null);
    setAnalysis(null);
    setError(null);
    setSelections({});
    setWalkthroughIndex(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
        Upload a screenshot of your current system and our AI will analyze it to match your portal&apos;s look and feel.
      </p>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div style={{ ...cardStyle, maxWidth: 700 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Upload a Screenshot</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            Take a screenshot of your current system&apos;s dashboard or main page. The AI will analyze the colors, layout, and component styles.
          </p>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", borderLeft: "3px solid #ef4444", padding: "8px 12px", borderRadius: 4, fontSize: 12, color: "#ef4444", marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: "2px dashed var(--border-color)", borderRadius: 10, padding: imagePreview ? 0 : 40,
              textAlign: "center", cursor: "pointer", overflow: "hidden",
              background: "var(--bg-primary)", minHeight: 200,
              display: imagePreview ? "block" : "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Screenshot" style={{ width: "100%", borderRadius: 8 }} />
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📸</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                  Click to upload a screenshot
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  PNG, JPG, or WebP — any size
                </div>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageSelect} style={{ display: "none" }} />

          {imagePreview && (
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleAnalyze} style={{
                background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8,
                padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>
                Analyze with AI
              </button>
              <button onClick={handleStartOver} style={{
                background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-color)",
                borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer",
              }}>
                Choose Different Image
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Analyzing */}
      {step === "analyzing" && (
        <div style={{ ...cardStyle, maxWidth: 700, textAlign: "center", padding: 40 }}>
          <div style={{ width: 40, height: 40, border: "4px solid var(--bg-hover)", borderTopColor: "var(--accent)", borderRadius: 20, animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Analyzing your screenshot...</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>The AI is identifying colors, layout patterns, and component styles.</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Step 3: Results */}
      {step === "results" && analysis && (
        <div style={{ maxWidth: 700 }}>
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>AI Analysis Complete</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
              {analysis.summary}
            </p>

            {/* Color palette preview */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>DETECTED COLORS</h4>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(analysis.colors).map(([key, hex]) => (
                  <div key={key} style={{ textAlign: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: hex, border: "1px solid var(--border-color)" }} />
                    <div style={{ fontSize: 8, color: "var(--text-muted)", marginTop: 2 }}>{key}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Layout info */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                {analysis.layout.navStyle} nav
              </span>
              <span style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                {analysis.layout.density} density
              </span>
              <span style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                {analysis.layout.themeMode} mode
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleApplyAndContinue} style={{
              background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8,
              padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>
              Apply Colors & Customize Components →
            </button>
            <button onClick={handleRevert} style={{
              background: "transparent", color: "#ef4444", border: "1px solid #ef4444",
              borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer",
            }}>
              Cancel & Revert
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Walkthrough */}
      {step === "walkthrough" && (
        <div style={{ maxWidth: 700 }}>
          {/* Progress */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            {WALKTHROUGH.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= walkthroughIndex ? "var(--accent)" : "var(--bg-hover)" }} />
            ))}
          </div>

          {(() => {
            const item = WALKTHROUGH[walkthroughIndex];
            const selected = selections[item.key] || "";
            return (
              <div style={cardStyle}>
                <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, marginBottom: 4 }}>
                  STEP {walkthroughIndex + 1} OF {WALKTHROUGH.length}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{item.label}</h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>{item.description}</p>

                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(item.options.length, 3)}, 1fr)`, gap: 12 }}>
                  {item.options.map((opt) => (
                    <div
                      key={opt.value}
                      onClick={() => handleWalkthroughSelect(item.key, opt.value)}
                      style={{
                        cursor: "pointer", borderRadius: 10, padding: 16,
                        border: selected === opt.value ? "2px solid var(--accent)" : "2px solid var(--border-color)",
                        background: selected === opt.value ? "var(--accent)" + "0a" : "var(--bg-primary)",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ minHeight: 50, display: "flex", alignItems: "center" }}>
                        {opt.render()}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: selected === opt.value ? "var(--accent)" : "var(--text-primary)" }}>
                        {opt.label} {selected === opt.value && "✓"}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => walkthroughIndex > 0 && setWalkthroughIndex(walkthroughIndex - 1)}
                      disabled={walkthroughIndex === 0}
                      style={{
                        background: "transparent", color: walkthroughIndex === 0 ? "var(--text-muted)" : "var(--text-secondary)",
                        border: "1px solid var(--border-color)", borderRadius: 8,
                        padding: "8px 20px", fontSize: 13, cursor: walkthroughIndex === 0 ? "default" : "pointer",
                        opacity: walkthroughIndex === 0 ? 0.4 : 1,
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleRevert}
                      style={{
                        background: "transparent", color: "#ef4444", border: "1px solid #ef4444",
                        borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer",
                      }}
                    >
                      Cancel & Revert
                    </button>
                  </div>
                  <button
                    onClick={handleWalkthroughNext}
                    style={{
                      background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8,
                      padding: "8px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {walkthroughIndex === WALKTHROUGH.length - 1 ? "Finish Setup" : "Next →"}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Step 5: Done */}
      {step === "done" && (
        <div style={{ ...cardStyle, maxWidth: 700, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Design Setup Complete!</h3>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, maxWidth: 400, margin: "0 auto 20px" }}>
            Your portal colors have been applied and your component preferences have been saved. You can fine-tune colors anytime on the Appearance tab.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={handleStartOver} style={{
              background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-color)",
              borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer",
            }}>
              Try a Different Screenshot
            </button>
            <button onClick={handleRevert} style={{
              background: "transparent", color: "#ef4444", border: "1px solid #ef4444",
              borderRadius: 8, padding: "10px 20px", fontSize: 13, cursor: "pointer",
            }}>
              Undo Everything — Revert to Previous Look
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
