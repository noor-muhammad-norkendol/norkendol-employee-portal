"use client";

import { useState } from "react";
import IconSidebar from "./IconSidebar";
import TextSidebar from "./TextSidebar";
import TopBar from "./TopBar";
import TronTraffic from "./effects/TronTraffic";
import { usePathname } from "next/navigation";

// Pages where the secondary TextSidebar is hidden.
// Per DESIGN-RULES the long-term plan is to kill it on every non-CRM page;
// rolling out one screen at a time.
const HIDE_TEXT_SIDEBAR_ON: Set<string> = new Set([
  "/dashboard",
  "/dashboard/onboarder-kpi",
  "/dashboard/estimator-kpi",
  "/dashboard/university",
  "/dashboard/settlement-tracker",
  "/dashboard/executive-intelligence",
  "/dashboard/team-lead-support",
  "/dashboard/scope-of-loss",
  "/dashboard/adjuster-kpi",
  "/dashboard/claim-calculator",
  "/dashboard/compliance",
  "/dashboard/directory",
  "/dashboard/teams-chat",
  "/dashboard/calendar",
  "/dashboard/documents",
  "/dashboard/ai",
  "/dashboard/talent-partner-network",
  "/dashboard/claim-health",
  "/dashboard/user-management",
]);

// Path prefixes that also hide the secondary sidebar — covers dynamic sub-routes
// like /dashboard/compliance/state/[code].
const HIDE_TEXT_SIDEBAR_PREFIXES: string[] = [
  "/dashboard/compliance/",
];

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [iconBarExpanded, setIconBarExpanded] = useState(false);

  const segments = pathname.split("/").filter(Boolean);
  const activeSection = segments[1] || "dashboard";
  const showTextSidebar =
    !HIDE_TEXT_SIDEBAR_ON.has(pathname) &&
    !HIDE_TEXT_SIDEBAR_PREFIXES.some((p) => pathname.startsWith(p));

  return (
    <div className="flex h-full">
      <IconSidebar
        expanded={iconBarExpanded}
        onToggleExpand={() => setIconBarExpanded(!iconBarExpanded)}
      />
      {showTextSidebar && (
        <TextSidebar
          activeSection={activeSection}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-8 relative">
          {/* Tron bikes ride at the bottom layer (z-index: 0). All page content
              sits in the wrapper below at z-index: 1 so bikes can never bleed
              over a pad regardless of how the page styles its containers. */}
          <TronTraffic />
          <div className="relative" style={{ zIndex: 1 }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
