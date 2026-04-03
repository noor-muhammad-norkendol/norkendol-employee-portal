"use client";

import { useState } from "react";
import IconSidebar from "./IconSidebar";
import TextSidebar from "./TextSidebar";
import TopBar from "./TopBar";
import { usePathname } from "next/navigation";

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [iconBarExpanded, setIconBarExpanded] = useState(false);

  // Derive active section from URL for the TextSidebar
  const segments = pathname.split("/").filter(Boolean);
  const activeSection = segments[1] || "dashboard";

  return (
    <div className="flex h-full">
      <IconSidebar
        expanded={iconBarExpanded}
        onToggleExpand={() => setIconBarExpanded(!iconBarExpanded)}
      />
      <TextSidebar
        activeSection={activeSection}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
