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
}: {
  activeSection: string;
  onSectionChange: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-col items-center w-[50px] border-r py-4 gap-1"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)" }}
    >
      {/* Logo */}
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold mb-4"
        style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
      >
        N
      </div>

      {/* Nav icons with tooltips */}
      {navItems.map((item) => (
        <div key={item.id} className="relative group">
          <button
            onClick={() => onSectionChange(item.id)}
            className="w-9 h-9 rounded-md flex items-center justify-center text-base transition-colors cursor-pointer"
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
            {item.icon}
          </button>

          {/* Tooltip */}
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
        </div>
      ))}
    </div>
  );
}
