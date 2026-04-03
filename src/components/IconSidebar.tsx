"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Role tiers: 1A=User, 1B=ExtPartnerUser, 2A=Admin, 2B=ExtPartnerAdmin, 3=SuperAdmin, 4=SysAdmin
// Internal roles stack: 4 > 3 > 2A > 1A
// External track: 2B > 1B (separate from internal)
type Role = "1A" | "1B" | "2A" | "2B" | "3" | "4";

type NavItem = {
  label: string;
  slug: string;
  icon: string;
  minTier: Role;
};

const internalTierOrder: Role[] = ["1A", "2A", "3", "4"];
const externalTierOrder: Role[] = ["1B", "2B"];

function canAccess(userRole: Role, requiredRole: Role): boolean {
  // External roles only access external-track items
  if (externalTierOrder.includes(userRole)) {
    if (!externalTierOrder.includes(requiredRole)) return false;
    return externalTierOrder.indexOf(userRole) >= externalTierOrder.indexOf(requiredRole);
  }
  // Internal roles access internal-track items
  if (!internalTierOrder.includes(requiredRole)) return false;
  return internalTierOrder.indexOf(userRole) >= internalTierOrder.indexOf(requiredRole);
}

// All nav items with their minimum required tier
const allNavItems: NavItem[] = [
  // Tier 1A — User
  { label: "Dashboard",      slug: "dashboard",      icon: "/", minTier: "1A" },
  { label: "Applications",   slug: "applications",   icon: "#", minTier: "1A" },
  { label: "Teams Chat",     slug: "teams-chat",     icon: ">", minTier: "1A" },
  { label: "Calendar",       slug: "calendar",       icon: "+", minTier: "1A" },
  { label: "University",     slug: "university",     icon: "^", minTier: "1A" },
  { label: "Directory",      slug: "directory",      icon: "@", minTier: "1A" },
  { label: "Documents",      slug: "documents",      icon: "=", minTier: "1A" },
  { label: "AI",             slug: "ai",             icon: "*", minTier: "1A" },
  { label: "Notifications",  slug: "notifications",  icon: "!", minTier: "1A" },
  { label: "Compliance",     slug: "compliance",     icon: "&", minTier: "1A" },

  // Tier 2A — Admin
  { label: "User Management",  slug: "user-management",  icon: "%", minTier: "2A" },
  { label: "Pending Users",    slug: "pending-users",    icon: "?", minTier: "2A" },
  { label: "Action Items",     slug: "action-items",     icon: "~", minTier: "2A" },
  { label: "Training",         slug: "training",         icon: "|", minTier: "2A" },
  { label: "Company Updates",  slug: "company-updates",  icon: ";", minTier: "2A" },
  { label: "Departments",      slug: "departments",      icon: ":", minTier: "2A" },
  { label: "CRM",              slug: "crm",              icon: "$", minTier: "2A" },

  // Tier 3 — Super Admin
  { label: "AI Agents",                slug: "ai-agents",                icon: "{", minTier: "3" },
  { label: "App Management",           slug: "app-management",           icon: "}", minTier: "3" },
  { label: "Compliance Settings",      slug: "compliance-settings",      icon: "[", minTier: "3" },
  { label: "Claim Calculator Settings",slug: "claim-calculator-settings",icon: "]", minTier: "3" },
  { label: "System Settings",          slug: "system-settings",          icon: "<", minTier: "3" },
  { label: "Talent Partner Network",   slug: "talent-partner-network",   icon: "\\", minTier: "3" },

  // Tier 4 — System Administrator
  { label: "Tenant Management", slug: "tenant-management", icon: "_", minTier: "4" },
];

// External partner items (separate track)
const externalNavItems: NavItem[] = [
  { label: "Dashboard",     slug: "dashboard",     icon: "/", minTier: "1B" },
  { label: "Documents",     slug: "documents",     icon: "=", minTier: "1B" },
  { label: "Notifications", slug: "notifications", icon: "!", minTier: "1B" },
  { label: "CRM",           slug: "crm",           icon: "$", minTier: "2B" },
];

export default function IconSidebar({
  expanded,
  onToggleExpand,
  userRole = "4", // TODO: get from auth context — defaulting to SysAdmin for dev
}: {
  expanded: boolean;
  onToggleExpand: () => void;
  userRole?: Role;
}) {
  const pathname = usePathname();

  const isExternal = externalTierOrder.includes(userRole);
  const sourceItems = isExternal ? externalNavItems : allNavItems;
  const visibleItems = sourceItems.filter((item) => canAccess(userRole, item.minTier));

  const isActive = (slug: string) => {
    if (slug === "dashboard") return pathname === "/dashboard";
    return pathname.startsWith(`/dashboard/${slug}`);
  };

  return (
    <div
      className="relative flex flex-col border-r py-4 transition-all duration-200 shrink-0"
      style={{
        width: expanded ? "220px" : "50px",
        overflow: "hidden",
        overflowY: "auto",
        background: "var(--bg-secondary)",
        borderColor: "var(--border-color)",
      }}
    >
      {/* Chevron toggle */}
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

      {/* Nav items — flat list, role-filtered */}
      {visibleItems.map((item) => {
        const active = isActive(item.slug);
        const href = item.slug === "dashboard" ? "/dashboard" : `/dashboard/${item.slug}`;
        return (
          <div key={item.slug} className="relative group" style={{ padding: expanded ? "0 8px" : "0 5px" }}>
            <Link
              href={href}
              className={`rounded-md flex items-center transition-colors cursor-pointer w-full h-8 ${
                expanded ? "px-2 gap-2" : "justify-center"
              }`}
              style={{
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                background: active ? "var(--bg-hover)" : "transparent",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <span className="text-xs font-mono shrink-0 w-5 text-center" style={{ color: "var(--text-muted)" }}>
                {item.icon}
              </span>
              {expanded && <span className="text-sm whitespace-nowrap">{item.label}</span>}
            </Link>

            {/* Tooltip when collapsed */}
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
        );
      })}
    </div>
  );
}
