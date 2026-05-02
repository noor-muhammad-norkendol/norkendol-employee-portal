"use client";

import { useState } from "react";
import CompanyUpdatesPanel from "@/components/dashboard-admin/CompanyUpdatesPanel";
import ActionItemsPanel from "@/components/dashboard-admin/ActionItemsPanel";
import NotificationsPanel from "@/components/dashboard-admin/NotificationsPanel";
import LeaderboardPanel from "@/components/dashboard-admin/LeaderboardPanel";

type TabKey = "updates" | "actions" | "notifications" | "leaderboard";

const TABS: { key: TabKey; label: string; token: string }[] = [
  { key: "updates", label: "Company Updates", token: "--info" },
  { key: "actions", label: "Action Items", token: "--amber" },
  { key: "notifications", label: "Notifications", token: "--violet" },
  { key: "leaderboard", label: "Leaderboard", token: "--green" },
];

export default function DashboardAdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("updates");

  return (
    <div className="space-y-6">
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
        <span
          style={{
            color: "var(--accent)",
            textShadow: "var(--accent-text-shadow)",
            fontWeight: 800,
          }}
        >
          Dashboard
        </span>{" "}
        <span style={{ color: "var(--text)", fontWeight: 500, opacity: 0.92 }}>
          Admin
        </span>
      </h1>

      {/* Segmented tab bar (TLS pattern) */}
      <div className="flex flex-wrap gap-3">
        {TABS.map((tab) => {
          const tokenVar = `var(${tab.token})`;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-7 py-3.5 text-[14px] font-bold uppercase cursor-pointer transition-all"
              style={{
                background: active
                  ? `color-mix(in srgb, ${tokenVar} 14%, var(--bg))`
                  : "var(--bg)",
                color: tokenVar,
                borderWidth: "2px",
                borderStyle: "solid",
                borderColor: tokenVar,
                borderRadius: 8,
                fontFamily: "var(--font-display)",
                letterSpacing: "0.10em",
                textShadow: active
                  ? `0 0 8px color-mix(in srgb, ${tokenVar} 70%, transparent)`
                  : undefined,
                boxShadow: active
                  ? `0 0 16px color-mix(in srgb, ${tokenVar} 40%, transparent)`
                  : "none",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      {activeTab === "updates" && <CompanyUpdatesPanel />}
      {activeTab === "actions" && <ActionItemsPanel />}
      {activeTab === "notifications" && <NotificationsPanel />}
      {activeTab === "leaderboard" && <LeaderboardPanel />}
    </div>
  );
}
