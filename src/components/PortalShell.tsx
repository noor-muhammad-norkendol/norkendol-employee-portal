"use client";

import { useState } from "react";
import IconSidebar from "./IconSidebar";
import TextSidebar from "./TextSidebar";
import TopBar from "./TopBar";
import { usePathname } from "next/navigation";

// Pages where the secondary TextSidebar is hidden.
// Per DESIGN-RULES the long-term plan is to kill it on every non-CRM page;
// rolling out one screen at a time.
const HIDE_TEXT_SIDEBAR_ON: Set<string> = new Set([
  "/dashboard",
]);

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [iconBarExpanded, setIconBarExpanded] = useState(false);

  const segments = pathname.split("/").filter(Boolean);
  const activeSection = segments[1] || "dashboard";
  const showTextSidebar = !HIDE_TEXT_SIDEBAR_ON.has(pathname);

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
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
