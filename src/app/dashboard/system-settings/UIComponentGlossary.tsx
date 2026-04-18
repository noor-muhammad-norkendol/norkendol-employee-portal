"use client";

import React, { useState } from "react";
import { cardStyle } from "@/lib/styles";

/* ── Category definitions ──────────────────────────────── */

interface ComponentExample {
  name: string;
  synonyms: string;
  description: string;
  render: () => React.ReactNode;
}

interface Category {
  label: string;
  description: string;
  components: ComponentExample[];
}

/* ── Shared demo styles ──────────────────────────────── */

const demoBg: React.CSSProperties = {
  background: "var(--bg-primary)", borderRadius: 8, padding: 16,
  border: "1px solid var(--border-color)",
};

const pill = (bg: string, color: string, label: string) => (
  <span style={{ background: bg, color, padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
    {label}
  </span>
);

/* ── Categories ──────────────────────────────── */

const CATEGORIES: Category[] = [
  {
    label: "Navigation",
    description: "How users move around the app — menus, tabs, breadcrumbs, and page navigation.",
    components: [
      {
        name: "Sidebar",
        synonyms: "side nav, left nav, drawer",
        description: "Vertical navigation panel on the left side of the screen. Can show icons only, icons + labels, or expand/collapse.",
        render: () => (
          <div style={{ display: "flex", gap: 2, height: 120 }}>
            <div style={{ width: 48, background: "var(--bg-secondary)", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: 12 }}>
              {["🏠", "📋", "👥", "📊", "⚙️"].map((icon, i) => (
                <span key={i} style={{ fontSize: 16, opacity: i === 0 ? 1 : 0.4, cursor: "pointer" }}>{icon}</span>
              ))}
            </div>
            <div style={{ flex: 1, background: "var(--bg-primary)", borderRadius: 6, padding: 12 }}>
              <div style={{ width: "60%", height: 8, background: "var(--bg-hover)", borderRadius: 4, marginBottom: 8 }} />
              <div style={{ width: "80%", height: 8, background: "var(--bg-hover)", borderRadius: 4, marginBottom: 8 }} />
              <div style={{ width: "40%", height: 8, background: "var(--bg-hover)", borderRadius: 4 }} />
            </div>
          </div>
        ),
      },
      {
        name: "Top Bar",
        synonyms: "navbar, header bar, app bar",
        description: "Horizontal bar at the top with navigation tabs, search, and user menu.",
        render: () => (
          <div style={{ background: "var(--bg-secondary)", borderRadius: 6, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "var(--accent)" }}>Logo</span>
              {["Dashboard", "Claims", "Reports"].map((t, i) => (
                <span key={t} style={{ fontSize: 11, color: i === 0 ? "var(--text-primary)" : "var(--text-muted)", cursor: "pointer", fontWeight: i === 0 ? 600 : 400 }}>{t}</span>
              ))}
            </div>
            <div style={{ width: 24, height: 24, borderRadius: 12, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>FD</div>
          </div>
        ),
      },
      {
        name: "Tabs",
        synonyms: "tab bar, tab set, segmented control",
        description: "Horizontal tabs that switch between different views or sections on the same page.",
        render: () => {
          const tabs = ["Overview", "Details", "Activity", "History"];
          return (
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-color)" }}>
              {tabs.map((t, i) => (
                <span key={t} style={{
                  padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  color: i === 0 ? "var(--accent)" : "var(--text-muted)",
                  borderBottom: i === 0 ? "2px solid var(--accent)" : "2px solid transparent",
                }}>{t}</span>
              ))}
            </div>
          );
        },
      },
      {
        name: "Breadcrumbs",
        synonyms: "breadcrumb trail, path indicator",
        description: "Shows the user's current location in the app hierarchy. Clickable links to go back up.",
        render: () => (
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
            <span style={{ color: "var(--accent)", cursor: "pointer" }}>Home</span>
            <span style={{ color: "var(--text-muted)" }}>›</span>
            <span style={{ color: "var(--accent)", cursor: "pointer" }}>Claims</span>
            <span style={{ color: "var(--text-muted)" }}>›</span>
            <span style={{ color: "var(--text-primary)" }}>Torres Residence</span>
          </div>
        ),
      },
      {
        name: "Pagination",
        synonyms: "pager, page controls",
        description: "Controls to navigate between pages of results in a table or list.",
        render: () => (
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {["‹", "1", "2", "3", "4", "›"].map((p, i) => (
              <span key={i} style={{
                width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: p === "2" ? "var(--accent)" : "var(--bg-hover)",
                color: p === "2" ? "#fff" : "var(--text-secondary)",
              }}>{p}</span>
            ))}
          </div>
        ),
      },
      {
        name: "Menu Styles",
        synonyms: "hamburger, bento, kebab, meatball",
        description: "Different icon patterns used to trigger dropdown menus. Each industry has favorites.",
        render: () => (
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {[
              { label: "Hamburger", icon: "☰" },
              { label: "Kebab", icon: "⋮" },
              { label: "Meatball", icon: "⋯" },
              { label: "Bento", icon: "⊞" },
            ].map((m) => (
              <div key={m.label} style={{ textAlign: "center" }}>
                <div style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-hover)", borderRadius: 6, fontSize: 18, cursor: "pointer" }}>{m.icon}</div>
                <span style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 4, display: "block" }}>{m.label}</span>
              </div>
            ))}
          </div>
        ),
      },
    ],
  },
  {
    label: "Data Display",
    description: "How numbers, charts, status, and information are shown to users.",
    components: [
      {
        name: "Horizontal Bar",
        synonyms: "progress bar, bar chart",
        description: "Data shown as horizontal filled bars. Good for comparing items or showing progress toward a goal.",
        render: () => (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[{ label: "Active", pct: 76, color: "#4ade80" }, { label: "Pending", pct: 22, color: "#facc15" }, { label: "Closed", pct: 54, color: "#60a5fa" }].map((b) => (
              <div key={b.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{b.label}</span>
                  <span style={{ color: "var(--text-muted)" }}>{b.pct}%</span>
                </div>
                <div style={{ height: 6, background: "var(--bg-hover)", borderRadius: 3 }}>
                  <div style={{ height: 6, width: `${b.pct}%`, background: b.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        name: "Big Number",
        synonyms: "stat card, KPI card, metric",
        description: "Large number with a label underneath. Simple and high-impact for key metrics.",
        render: () => (
          <div style={{ display: "flex", gap: 16 }}>
            {[{ n: "1,243", label: "Open Claims", color: "#60a5fa" }, { n: "89", label: "Due Today", color: "#facc15" }, { n: "$675k", label: "Settlements", color: "#4ade80" }].map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.n}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        ),
      },
      {
        name: "Circle / Donut",
        synonyms: "ring chart, progress ring, pie",
        description: "Circular indicator showing a percentage or count. Often used for pipeline stages.",
        render: () => (
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            {[{ letter: "L", count: 205, color: "#60a5fa" }, { letter: "P", count: 94, color: "#f97316" }, { letter: "A", count: 12, color: "#4ade80" }].map((c) => (
              <div key={c.letter} style={{ textAlign: "center" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center",
                  border: `3px solid ${c.color}`, fontSize: 16, fontWeight: 700, color: c.color,
                }}>{c.letter}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>{c.count}</div>
              </div>
            ))}
          </div>
        ),
      },
      {
        name: "Table",
        synonyms: "data grid, list view",
        description: "Rows and columns of data. The workhorse of any business app.",
        render: () => (
          <div style={{ fontSize: 11 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--border-color)", fontWeight: 600, color: "var(--text-muted)" }}>
              <span>Name</span><span>Status</span><span>Role</span>
            </div>
            {[{ n: "Jane Smith", s: "Active", r: "Admin" }, { n: "Raj Patel", s: "Pending", r: "User" }].map((row) => (
              <div key={row.n} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                <span>{row.n}</span>
                <span>{pill(row.s === "Active" ? "rgba(74,222,128,0.15)" : "rgba(251,191,36,0.15)", row.s === "Active" ? "#4ade80" : "#fbbf24", row.s)}</span>
                <span style={{ color: "var(--text-secondary)" }}>{row.r}</span>
              </div>
            ))}
          </div>
        ),
      },
      {
        name: "Badge / Pill",
        synonyms: "status badge, tag, chip, label",
        description: "Small colored label showing status, category, or count. The most common status indicator.",
        render: () => (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {pill("rgba(74,222,128,0.15)", "#4ade80", "Active")}
            {pill("rgba(251,191,36,0.15)", "#fbbf24", "Pending")}
            {pill("rgba(239,68,68,0.15)", "#ef4444", "Urgent")}
            {pill("rgba(96,165,250,0.15)", "#60a5fa", "In Progress")}
            {pill("rgba(148,163,184,0.15)", "#94a3b8", "Closed")}
          </div>
        ),
      },
      {
        name: "Sparkline",
        synonyms: "mini chart, trend line, inline graph",
        description: "Tiny line chart showing a trend over time. Usually shown inside a card or next to a metric.",
        render: () => {
          const points = [4, 7, 3, 8, 5, 9, 6, 10, 7, 12];
          const max = Math.max(...points);
          const w = 120, h = 32;
          const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * w},${h - (p / max) * h}`).join(" ");
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <svg width={w} height={h} style={{ overflow: "visible" }}>
                <path d={path} fill="none" stroke="#4ade80" strokeWidth="2" />
              </svg>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Last 7 days</span>
            </div>
          );
        },
      },
    ],
  },
  {
    label: "Form Controls",
    description: "Input fields, selectors, and other controls users interact with to enter or change data.",
    components: [
      {
        name: "Text Field",
        synonyms: "input, text input, text box",
        description: "Single-line text input for names, emails, numbers, etc.",
        render: () => (
          <div>
            <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Claim Number</label>
            <input readOnly value="FL-00042-2026" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "6px 10px", fontSize: 13, color: "var(--text-primary)", width: "100%", outline: "none" }} />
          </div>
        ),
      },
      {
        name: "Checkbox",
        synonyms: "check box, tick box",
        description: "Square box that can be checked or unchecked. Used when multiple options can be selected.",
        render: () => (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["Receive email notifications", "Send weekly digest", "Alert on urgent items"].map((label, i) => (
              <label key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-primary)", cursor: "pointer" }}>
                <input type="checkbox" defaultChecked={i === 0} style={{ accentColor: "var(--accent)" }} />
                {label}
              </label>
            ))}
          </div>
        ),
      },
      {
        name: "Switch / Toggle",
        synonyms: "toggle switch, on/off",
        description: "Sliding switch for binary on/off choices. Feels more modern than a checkbox for settings.",
        render: () => {
          const [on, setOn] = useState(true);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div onClick={() => setOn(!on)} style={{
                width: 40, height: 22, borderRadius: 11, cursor: "pointer", padding: 2, transition: "background 0.2s",
                background: on ? "var(--accent)" : "var(--bg-hover)",
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "transform 0.2s",
                  transform: on ? "translateX(18px)" : "translateX(0)",
                }} />
              </div>
              <span style={{ fontSize: 12, color: "var(--text-primary)" }}>Enable notifications</span>
            </div>
          );
        },
      },
      {
        name: "Select / Dropdown",
        synonyms: "dropdown menu, picker, combo box",
        description: "Click to reveal a list of options — pick one. Used when there are too many options for radio buttons.",
        render: () => (
          <div>
            <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Priority</label>
            <select style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "6px 10px", fontSize: 13, color: "var(--text-primary)", width: "100%", cursor: "pointer" }}>
              <option>Low</option><option>Normal</option><option>High</option><option>Urgent</option>
            </select>
          </div>
        ),
      },
      {
        name: "Radio Group",
        synonyms: "radio buttons, single select",
        description: "Circle buttons where only one can be selected at a time. Good for 2-5 mutually exclusive options.",
        render: () => (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["Standard", "Priority", "Rush"].map((opt, i) => (
              <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-primary)", cursor: "pointer" }}>
                <input type="radio" name="glossary-radio-demo" defaultChecked={i === 0} style={{ accentColor: "var(--accent)" }} />
                {opt}
              </label>
            ))}
          </div>
        ),
      },
      {
        name: "Date Picker",
        synonyms: "calendar picker, date selector",
        description: "Input that lets users pick a date, either by typing or from a calendar popup.",
        render: () => (
          <div>
            <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Date of Loss</label>
            <input type="date" defaultValue="2026-04-18" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "6px 10px", fontSize: 13, color: "var(--text-primary)", width: "100%", cursor: "pointer" }} />
          </div>
        ),
      },
    ],
  },
  {
    label: "Feedback & Status",
    description: "Visual indicators that communicate status, progress, loading, and system messages to users.",
    components: [
      {
        name: "Alert / Banner",
        synonyms: "notification banner, system message",
        description: "Full-width colored strip that shows an important message — success, warning, or error.",
        render: () => (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { bg: "rgba(74,222,128,0.1)", border: "#4ade80", color: "#4ade80", text: "Settings saved successfully." },
              { bg: "rgba(251,191,36,0.1)", border: "#facc15", color: "#facc15", text: "License expires in 14 days." },
              { bg: "rgba(239,68,68,0.1)", border: "#ef4444", color: "#ef4444", text: "Failed to load claim data." },
            ].map((a) => (
              <div key={a.text} style={{ background: a.bg, borderLeft: `3px solid ${a.border}`, padding: "6px 12px", borderRadius: 4, fontSize: 12, color: a.color }}>{a.text}</div>
            ))}
          </div>
        ),
      },
      {
        name: "Toast / Snackbar",
        synonyms: "notification popup, flash message",
        description: "Small popup that appears briefly in a corner to confirm an action, then disappears automatically.",
        render: () => (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
              <span style={{ color: "#4ade80", fontSize: 14 }}>✓</span>
              <span style={{ fontSize: 12, color: "var(--text-primary)" }}>Changes saved</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", cursor: "pointer", marginLeft: 8 }}>✕</span>
            </div>
          </div>
        ),
      },
      {
        name: "Progress Bar",
        synonyms: "loading bar, completion bar",
        description: "Horizontal bar that fills up to show how far along a process is.",
        render: () => (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: "var(--text-secondary)" }}>Uploading documents...</span>
              <span style={{ color: "var(--text-muted)" }}>67%</span>
            </div>
            <div style={{ height: 8, background: "var(--bg-hover)", borderRadius: 4 }}>
              <div style={{ height: 8, width: "67%", background: "var(--accent)", borderRadius: 4 }} />
            </div>
          </div>
        ),
      },
      {
        name: "Spinner",
        synonyms: "loading spinner, loader, activity indicator",
        description: "Rotating circle that shows something is loading. No indication of how long it will take.",
        render: () => (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 24, height: 24, border: "3px solid var(--bg-hover)", borderTopColor: "var(--accent)",
              borderRadius: 12, animation: "spin 0.8s linear infinite",
            }} />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Loading claims...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ),
      },
      {
        name: "Skeleton",
        synonyms: "placeholder, loading skeleton, shimmer",
        description: "Gray shapes that mimic the layout of content while it loads. Feels faster than a spinner.",
        render: () => (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ height: 12, width: "70%", background: "var(--bg-hover)", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
            <div style={{ height: 12, width: "90%", background: "var(--bg-hover)", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite", animationDelay: "0.2s" }} />
            <div style={{ height: 12, width: "50%", background: "var(--bg-hover)", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite", animationDelay: "0.4s" }} />
            <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
          </div>
        ),
      },
      {
        name: "Tooltip",
        synonyms: "hover hint, info tip",
        description: "Small text popup that appears when you hover over something. Explains what a button or icon does.",
        render: () => (
          <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
            <span style={{ fontSize: 12, color: "var(--text-primary)", textDecoration: "underline dotted", cursor: "help" }}>Hover me</span>
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "var(--text-primary)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
              This is a tooltip
            </div>
          </div>
        ),
      },
    ],
  },
  {
    label: "Layout",
    description: "How content is organized and arranged on the page — containers, cards, grids, and spacing.",
    components: [
      {
        name: "Card",
        synonyms: "tile, panel, content box",
        description: "A bordered box that groups related content together. The most common layout element.",
        render: () => (
          <div style={{ ...cardStyle, maxWidth: 200 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Claim Summary</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>3 active items</div>
          </div>
        ),
      },
      {
        name: "Grid Layout",
        synonyms: "columns, multi-column, card grid",
        description: "Content arranged in multiple columns side by side. Adapts to screen size.",
        render: () => (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {["Claims", "Tasks", "Reports"].map((label) => (
              <div key={label} style={{ background: "var(--bg-hover)", borderRadius: 6, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>42</div>
                <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{label}</div>
              </div>
            ))}
          </div>
        ),
      },
      {
        name: "Accordion",
        synonyms: "expander, collapsible section, disclosure",
        description: "Sections that expand and collapse when clicked. Good for showing lots of information without overwhelming the user.",
        render: () => {
          const [open, setOpen] = useState(0);
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {["Claim Details", "Contact Info", "Documents"].map((label, i) => (
                <div key={label}>
                  <div onClick={() => setOpen(open === i ? -1 : i)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--bg-hover)", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                    {label}
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{open === i ? "▼" : "▶"}</span>
                  </div>
                  {open === i && (
                    <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--text-secondary)" }}>
                      Content for {label.toLowerCase()} goes here.
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        },
      },
      {
        name: "Modal / Dialog",
        synonyms: "popup, dialog box, overlay",
        description: "A box that appears on top of the page, dimming the background. Used for confirmations, forms, and details.",
        render: () => (
          <div style={{ position: "relative", height: 80, background: "var(--bg-primary)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ padding: 8, opacity: 0.3 }}>
              <div style={{ height: 8, width: "60%", background: "var(--bg-hover)", borderRadius: 4, marginBottom: 6 }} />
              <div style={{ height: 8, width: "80%", background: "var(--bg-hover)", borderRadius: 4 }} />
            </div>
            <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", width: "70%", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "10px 12px", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Confirm Delete</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 8 }}>Are you sure?</div>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, background: "var(--bg-hover)", color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</span>
                <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, background: "#ef4444", color: "#fff", cursor: "pointer" }}>Delete</span>
              </div>
            </div>
          </div>
        ),
      },
    ],
  },
];

/* ── Main Component ──────────────────────────────── */

export default function UIComponentGlossary() {
  const [activeCategory, setActiveCategory] = useState(0);
  const cat = CATEGORIES[activeCategory];

  return (
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
        Visual catalog of every UI component available in the portal. Use this as a reference when customizing your organization&apos;s look and feel.
      </p>

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {CATEGORIES.map((c, i) => (
          <button
            key={c.label}
            onClick={() => setActiveCategory(i)}
            style={{
              padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: "1px solid", borderRadius: 6,
              background: i === activeCategory ? "var(--accent)" : "transparent",
              color: i === activeCategory ? "#fff" : "var(--text-secondary)",
              borderColor: i === activeCategory ? "var(--accent)" : "var(--border-color)",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Category description */}
      <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 16 }}>{cat.description}</p>

      {/* Component cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {cat.components.map((comp) => (
          <div key={comp.name} style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{comp.name}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>Also called: {comp.synonyms}</div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>{comp.description}</div>
            <div style={demoBg}>
              {comp.render()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
