"use client";

import { useState } from "react";
import IconSidebar from "./IconSidebar";
import TextSidebar from "./TextSidebar";
import TopBar from "./TopBar";

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [iconBarExpanded, setIconBarExpanded] = useState(false);

  return (
    <div className="flex h-full">
      <IconSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
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
