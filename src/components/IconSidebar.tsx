"use client";

const navItems = [
  { id: "dashboard", icon: "⊞", label: "Dashboard" },
  { id: "users", icon: "⊕", label: "Users" },
  { id: "apps", icon: "⊡", label: "Apps" },
  { id: "messages", icon: "⊙", label: "Messages" },
  { id: "documents", icon: "⊟", label: "Documents" },
  { id: "settings", icon: "⊘", label: "Settings" },
];

export default function IconSidebar({
  activeSection,
  onSectionChange,
  expanded,
  onToggleExpand,
}: {
  activeSection: string;
  onSectionChange: (id: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <div
      className="relative flex flex-col border-r py-4 gap-1 transition-all duration-200 shrink-0"
      style={{
        width: expanded ? "160px" : "50px",
        overflow: "visible",
        background: "var(--bg-secondary)",
        borderColor: "var(--border-color)",
      }}
    >
      {/* Chevron — middle of right edge, same style as text sidebar */}
      <button
        onClick={onToggleExpand}
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
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
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

      {/* Logo */}
      <div className={`flex items-center mb-4 ${expanded ? "px-3 gap-2" : "justify-center"}`}>
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
        >
          N
        </div>
        {expanded && (
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Portal
          </span>
        )}
      </div>

      {/* Nav items */}
      {navItems.map((item) => (
        <div key={item.id} className="relative group" style={{ padding: expanded ? "0 8px" : "0 5px" }}>
          <button
            onClick={() => onSectionChange(item.id)}
            className={`rounded-md flex items-center transition-colors cursor-pointer w-full h-9 ${
              expanded ? "px-2 gap-2" : "justify-center"
            }`}
            style={{
              color: activeSection === item.id ? "var(--text-primary)" : "var(--text-secondary)",
              background: activeSection === item.id ? "var(--bg-hover)" : "transparent",
            }}
            onMouseEnter={(e) => {
              if (activeSection !== item.id) e.currentTarget.style.background = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              if (activeSection !== item.id) e.currentTarget.style.background = "transparent";
            }}
          >
            <span className="text-base shrink-0">{item.icon}</span>
            {expanded && <span className="text-sm whitespace-nowrap">{item.label}</span>}
          </button>

          {/* Tooltip — only when collapsed */}
          {!expanded && (
            <div
              className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-color)",
              }}
            >
              {item.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
