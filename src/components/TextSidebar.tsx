"use client";

// Contextual sub-items for each page — placeholder data for now
const sectionMenus: Record<string, { group: string; items: string[] }[]> = {
  dashboard: [
    { group: "OVERVIEW", items: ["Home", "Activity", "Recent"] },
  ],
  applications: [
    { group: "APPS", items: ["All Apps", "Installed", "Available"] },
  ],
  "teams-chat": [
    { group: "MESSAGING", items: ["Inbox", "Channels", "Direct Messages"] },
  ],
  calendar: [
    { group: "SCHEDULE", items: ["Day View", "Week View", "Month View"] },
  ],
  university: [
    { group: "LEARNING", items: ["My Assignments", "Browse Courses", "Completed"] },
  ],
  directory: [
    { group: "PEOPLE", items: ["All Staff", "By Department", "Search", "Add New User"] },
  ],
  documents: [
    { group: "FILES", items: ["All Documents", "Shared With Me", "Upload"] },
  ],
  ai: [
    { group: "AI TOOLS", items: ["Chat", "Analysis", "Reports"] },
  ],
  notifications: [
    { group: "ALERTS", items: ["All", "Unread", "Settings"] },
  ],
  compliance: [
    { group: "COMPLIANCE", items: ["Requirements", "My Status", "Training"] },
  ],
  "user-management": [
    { group: "USERS", items: ["All Users", "Roles", "Permissions"] },
  ],
  training: [
    { group: "MANAGE", items: ["Courses", "Categories", "Assignments", "Analytics"] },
  ],
  departments: [
    { group: "DEPARTMENTS", items: ["All", "My Department", "Structure"] },
  ],
  crm: [
    { group: "CRM", items: ["Contacts", "Cases", "Pipeline"] },
  ],
  "my-settings": [
    { group: "PREFERENCES", items: ["Notifications", "Profile"] },
  ],
  "ai-agents": [
    { group: "AGENTS", items: ["Active", "Configure", "Logs"] },
  ],
  "app-management": [
    { group: "MANAGEMENT", items: ["All Apps", "Install", "Permissions"] },
  ],
  "compliance-settings": [
    { group: "COMPLIANCE ADMIN", items: ["Licenses", "Bonds", "Pending Approvals"] },
  ],
  "claim-calculator": [
    { group: "CALCULATOR", items: ["New Breakdown", "Print"] },
  ],
  "claim-health": [
    { group: "CLAIMS", items: ["All Claims", "Add New"] },
    { group: "REPORTS", items: ["Print Report Card"] },
  ],
  "estimator-kpi": [
    { group: "ESTIMATES", items: ["Current Week", "Add Entry"] },
    { group: "MY STATS", items: ["Performance"] },
  ],
  "claim-calculator-settings": [
    { group: "CALCULATOR", items: ["Release Types"] },
  ],
  "system-settings": [
    { group: "SYSTEM", items: ["General", "Security", "Integrations"] },
  ],
  "talent-partner-network": [
    { group: "NETWORK", items: ["Overview", "Internal", "External", "Analytics"] },
  ],
  "tpn-admin": [
    { group: "NETWORK", items: ["Overview", "Internal", "External", "Analytics"] },
    { group: "ADMIN", items: ["Partner Settings", "Approval Rules", "Service Types"] },
  ],
  "tenant-management": [
    { group: "TENANTS", items: ["All Tenants", "Create", "Billing"] },
  ],
};

export default function TextSidebar({
  activeSection,
  collapsed,
  onToggle,
}: {
  activeSection: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const menus = sectionMenus[activeSection] || sectionMenus.dashboard;

  return (
    <div
      className="relative border-r py-4 transition-all duration-200 shrink-0"
      style={{
        width: collapsed ? "16px" : "220px",
        padding: collapsed ? "16px 0" : "16px 12px",
        overflow: "visible",
        background: "var(--bg-primary)",
        borderColor: "var(--border-color)",
      }}
    >
      {/* Chevron — middle of right edge */}
      <button
        onClick={onToggle}
        className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer z-50 transition-colors"
        style={{
          right: "-12px",
          background: "var(--bg-surface)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border-color)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--text-primary)";
          e.currentTarget.style.background = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-secondary)";
          e.currentTarget.style.background = "var(--bg-surface)";
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="none"
          style={{
            transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
            transition: "transform 200ms",
          }}
        >
          <path
            d="M6 3L11 8L6 13"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Menu content — hidden when collapsed */}
      {!collapsed && (
        <>
          <h2
            className="text-sm font-semibold px-2 mb-4 capitalize"
            style={{ color: "var(--text-primary)" }}
          >
            {activeSection.replace(/-/g, " ")}
          </h2>

          {menus.map((group) => (
            <div key={group.group} className="mb-4">
              <p
                className="text-[11px] font-medium tracking-wider px-2 mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                {group.group}
              </p>
              {group.items.map((item) => (
                <button
                  key={item}
                  className="w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-hover)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
