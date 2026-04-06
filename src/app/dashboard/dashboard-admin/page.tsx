"use client";

import { useState } from "react";
import CompanyUpdatesPanel from "@/components/dashboard-admin/CompanyUpdatesPanel";
import ActionItemsPanel from "@/components/dashboard-admin/ActionItemsPanel";
import NotificationsPanel from "@/components/dashboard-admin/NotificationsPanel";
import LeaderboardPanel from "@/components/dashboard-admin/LeaderboardPanel";

type TabKey = "updates" | "actions" | "notifications" | "leaderboard";

const tabs: { key: TabKey; label: string }[] = [
  { key: "updates", label: "Company Updates" },
  { key: "actions", label: "Action Items" },
  { key: "notifications", label: "Notifications" },
  { key: "leaderboard", label: "Leaderboard" },
];

export default function DashboardAdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("updates");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard Admin</h1>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            style={{
              background: activeTab === tab.key ? "var(--bg-hover)" : "transparent",
              color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-muted)",
              border: "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      {activeTab === "updates" && <CompanyUpdatesPanel />}
      {activeTab === "actions" && <ActionItemsPanel />}
      {activeTab === "notifications" && <NotificationsPanel />}
      {activeTab === "leaderboard" && <LeaderboardPanel />}
    </div>
  );
}
