"use client";

const sectionMenus: Record<string, { group: string; items: string[] }[]> = {
  dashboard: [
    { group: "OVERVIEW", items: ["Home", "Activity", "Notifications"] },
  ],
  users: [
    { group: "MANAGEMENT", items: ["All Users", "Departments", "Pending Approval"] },
    { group: "EXTERNAL", items: ["Partner Firms", "Invitations"] },
  ],
  apps: [
    { group: "APPLICATIONS", items: ["App Directory", "Installed Apps"] },
    { group: "CONFIGURATION", items: ["App Settings"] },
  ],
  messages: [
    { group: "MESSAGING", items: ["Inbox", "Sent", "Drafts"] },
  ],
  documents: [
    { group: "FILES", items: ["All Documents", "Shared With Me", "Upload"] },
  ],
  settings: [
    { group: "ACCOUNT", items: ["Profile", "Preferences"] },
    { group: "ORGANIZATION", items: ["General", "Roles & Permissions", "Billing"] },
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
      {/* Chevron — middle of right edge, identical to icon sidebar */}
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
            {activeSection}
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
