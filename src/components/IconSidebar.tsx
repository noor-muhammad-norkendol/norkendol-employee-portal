"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase";

type Role = "1A" | "1B" | "2A" | "2B" | "3" | "4";

type NavItem = {
  label: string;
  slug: string;
  paths: string[];
};

type TierSection = {
  tier: Role;
  heading: string;
  items: NavItem[];
};

const internalTierOrder: Role[] = ["1A", "2A", "3", "4"];
const externalTierOrder: Role[] = ["1B", "2B"];

function canAccess(userRole: Role, requiredTier: Role): boolean {
  if (externalTierOrder.includes(userRole)) {
    if (!externalTierOrder.includes(requiredTier)) return false;
    return externalTierOrder.indexOf(userRole) >= externalTierOrder.indexOf(requiredTier);
  }
  if (!internalTierOrder.includes(requiredTier)) return false;
  return internalTierOrder.indexOf(userRole) >= internalTierOrder.indexOf(requiredTier);
}

const icons = {
  dashboard: ["M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"],
  applications: ["M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z"],
  teamsChat: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  calendar: ["M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z", "M16 2v4", "M8 2v4", "M3 10h18"],
  university: ["M12 2L2 7l10 5 10-5-10-5z", "M2 7v6", "M6 9.3v5.4c0 1 2.7 2.3 6 2.3s6-1.3 6-2.3V9.3"],
  directory: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  documents: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8"],
  ai: ["M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z", "M4.93 4.93l2.83 2.83", "M19.07 4.93l-2.83 2.83", "M12 12v4", "M8 20h8", "M12 16v4"],
  notifications: ["M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9", "M13.73 21a2 2 0 0 1-3.46 0"],
  compliance: ["M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2", "M9 14l2 2 4-4", "M15 2H9a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"],
  userManagement: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33"],
  pendingUsers: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "M19 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6", "M19 3v2h2"],
  actionItems: ["M9 6h11", "M9 12h11", "M9 18h11", "M5 6l-1.5 1.5L5 9", "M5 12l-1.5 1.5L5 15", "M5 18l-1.5 1.5L5 21"],
  training: ["M2 3h20v14H2z", "M8 21l4-4 4 4", "M12 17v4"],
  companyUpdates: ["M3 11h2l7-7v18l-7-7H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z", "M16 8.5a5 5 0 0 1 0 7"],
  departments: ["M12 2v6", "M6 8h12", "M6 8v4", "M18 8v4", "M12 8v4", "M4 12h4v4H4z", "M10 12h4v4h-4z", "M16 12h4v4h-4z"],
  crm: ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "M23 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  aiAgents: ["M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z", "M9 12h0", "M15 12h0", "M12 2v4", "M8 18v2", "M16 18v2"],
  appManagement: ["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M1 14h6", "M9 8h6", "M17 16h6"],
  complianceSettings: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M12 15v-2"],
  claimCalc: ["M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z", "M4 8h16", "M8 2v20", "M16 12h0", "M16 16h0", "M12 12h0", "M12 16h0"],
  systemSettings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z"],
  talentNetwork: ["M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
  tenantManagement: ["M3 21h18", "M5 21V7l8-4 8 4v14", "M9 21v-4h6v4", "M9 10h0", "M15 10h0", "M9 14h0", "M15 14h0"],
  leaderboard: ["M8 21h8", "M12 17v4", "M17 3H7a2 2 0 0 0-2 2v4a7 7 0 0 0 14 0V5a2 2 0 0 0-2-2Z"],
  settlementTracker: ["M12 3L2 8l10 5 10-5-10-5z", "M20 8v7", "M4 8v7", "M12 13v9", "M8 11v6", "M16 11v6"],
  mySettings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z"],
};

function NavIcon({ paths, size = 16 }: { paths: string[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

// Drag handle — 6 dots (grip pattern)
function DragHandle() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 16" fill="currentColor" className="shrink-0" style={{ opacity: 0.4 }}>
      <circle cx="4" cy="2" r="1.2" />
      <circle cx="8" cy="2" r="1.2" />
      <circle cx="4" cy="6" r="1.2" />
      <circle cx="8" cy="6" r="1.2" />
      <circle cx="4" cy="10" r="1.2" />
      <circle cx="8" cy="10" r="1.2" />
      <circle cx="4" cy="14" r="1.2" />
      <circle cx="8" cy="14" r="1.2" />
    </svg>
  );
}

const internalSections: TierSection[] = [
  {
    tier: "1A", heading: "User", items: [
      { label: "Dashboard", slug: "dashboard", paths: icons.dashboard },
      { label: "Applications", slug: "applications", paths: icons.applications },
      { label: "Teams Chat", slug: "teams-chat", paths: icons.teamsChat },
      { label: "Calendar", slug: "calendar", paths: icons.calendar },
      { label: "University", slug: "university", paths: icons.university },
      { label: "Directory", slug: "directory", paths: icons.directory },
      { label: "Documents", slug: "documents", paths: icons.documents },
      { label: "AI", slug: "ai", paths: icons.ai },
      { label: "Compliance", slug: "compliance", paths: icons.compliance },
      { label: "Talent Partner Network", slug: "talent-partner-network", paths: icons.talentNetwork },
      { label: "Settlement Tracker", slug: "settlement-tracker", paths: icons.settlementTracker },
      { label: "Claim Calculator", slug: "claim-calculator", paths: icons.claimCalc },
      { label: "Claim Health", slug: "claim-health", paths: icons.compliance },
      { label: "Estimator KPI", slug: "estimator-kpi", paths: icons.leaderboard },
      { label: "Onboarder KPI", slug: "onboarder-kpi", paths: icons.leaderboard },
    ],
  },
  {
    tier: "2A", heading: "Admin", items: [
      { label: "User Management", slug: "user-management", paths: icons.userManagement },

      { label: "Dashboard Admin", slug: "dashboard-admin", paths: icons.dashboard },
      { label: "University Admin", slug: "training", paths: icons.training },
      { label: "Departments", slug: "departments", paths: icons.departments },
      { label: "CRM", slug: "crm", paths: icons.crm },
      { label: "TPN Admin", slug: "tpn-admin", paths: icons.talentNetwork },
    ],
  },
  {
    tier: "3", heading: "Super Admin", items: [
      { label: "Executive Intelligence", slug: "executive-intelligence", paths: icons.aiAgents },
      { label: "AI Agents", slug: "ai-agents", paths: icons.aiAgents },
      { label: "App Management", slug: "app-management", paths: icons.appManagement },
      { label: "Compliance Admin", slug: "compliance-settings", paths: icons.complianceSettings },
      { label: "Claim Calculator Settings", slug: "claim-calculator-settings", paths: icons.claimCalc },
      { label: "System Settings", slug: "system-settings", paths: icons.systemSettings },
    ],
  },
  {
    tier: "4", heading: "System Admin", items: [
      { label: "Tenant Management", slug: "tenant-management", paths: icons.tenantManagement },
    ],
  },
];

const externalSections: TierSection[] = [
  {
    tier: "1B", heading: "Partner User", items: [
      { label: "Dashboard", slug: "dashboard", paths: icons.dashboard },
      { label: "Documents", slug: "documents", paths: icons.documents },
      { label: "Notifications", slug: "notifications", paths: icons.notifications },
    ],
  },
  {
    tier: "2B", heading: "Partner Admin", items: [
      { label: "CRM", slug: "crm", paths: icons.crm },
    ],
  },
];

// Sortable nav item component
function SortableNavItem({
  item,
  active: isActivePage,
  expanded,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.slug });
  const href = item.slug === "dashboard" ? "/dashboard" : `/dashboard/${item.slug}`;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, padding: expanded ? "0 8px" : "0 5px" }}
      className="relative group"
    >
      <div
        className={`rounded-md flex items-center transition-colors w-full h-8 ${
          expanded ? "px-1 gap-1 pl-4" : "justify-center"
        }`}
        style={{
          color: isActivePage ? "var(--text-primary)" : "var(--text-secondary)",
          background: isActivePage ? "var(--bg-hover)" : "transparent",
        }}
        onMouseEnter={(e) => {
          if (!isActivePage) e.currentTarget.style.background = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          if (!isActivePage) e.currentTarget.style.background = "transparent";
        }}
      >
        {/* Drag handle — visible on hover only */}
        {expanded && (
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex items-center"
            style={{ color: "var(--text-muted)", touchAction: "none" }}
          >
            <DragHandle />
          </span>
        )}
        {/* When collapsed, attach drag listeners to the whole item */}
        <Link
          href={href}
          className="flex items-center gap-2 flex-1 h-full"
          style={{ textDecoration: "none", color: "inherit" }}
          {...(!expanded ? { ...attributes, ...listeners } : {})}
        >
          <span className="shrink-0 w-5 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
            <NavIcon paths={item.paths} />
          </span>
          {expanded && <span className="text-sm whitespace-nowrap">{item.label}</span>}
        </Link>
      </div>

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
}

function SidebarLogo({ expanded }: { expanded: boolean }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    function loadBranding() {
      setLogoUrl(localStorage.getItem("portal-logo"));
      setCompanyName(localStorage.getItem("portal-company-name"));
    }
    loadBranding();
    window.addEventListener("portal-branding-changed", loadBranding);
    return () => window.removeEventListener("portal-branding-changed", loadBranding);
  }, []);

  const initial = companyName ? companyName.charAt(0).toUpperCase() : "N";
  const label = companyName || "Portal";

  return (
    <div className={`flex items-center mb-4 ${expanded ? "px-3 gap-3" : "justify-center"}`}>
      {logoUrl ? (
        <img
          src={logoUrl} alt={label}
          className="shrink-0 rounded-md"
          style={{ width: expanded ? 36 : 32, height: expanded ? 36 : 32, objectFit: "contain" }}
        />
      ) : (
        <div
          className="rounded-md flex items-center justify-center font-bold shrink-0"
          style={{
            width: expanded ? 36 : 32, height: expanded ? 36 : 32,
            fontSize: expanded ? 16 : 14,
            background: "var(--accent)", color: "#fff",
          }}
        >
          {initial}
        </div>
      )}
      {expanded && (
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{label}</span>
      )}
    </div>
  );
}

export default function IconSidebar({
  expanded,
  onToggleExpand,
  userRole = "4",
}: {
  expanded: boolean;
  onToggleExpand: () => void;
  userRole?: Role;
}) {
  const pathname = usePathname();
  const [supabase] = useState(() => createClient());
  const isExternal = externalTierOrder.includes(userRole);
  const baseSections = isExternal ? externalSections : internalSections;
  const visibleSections = baseSections.filter((s) => canAccess(userRole, s.tier));

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  // Custom order per tier — keys are tier codes, values are slug arrays
  const [navOrder, setNavOrder] = useState<Record<string, string[]>>({});
  const [userId, setUserId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load saved nav order from Supabase on mount
  useEffect(() => {
    const loadNavOrder = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from("users")
        .select("nav_order")
        .eq("id", user.id)
        .single();
      if (data?.nav_order && typeof data.nav_order === "object") {
        setNavOrder(data.nav_order as Record<string, string[]>);
      }
    };
    loadNavOrder();
  }, []);

  // Save nav order to Supabase
  const saveNavOrder = useCallback(async (newOrder: Record<string, string[]>) => {
    if (!userId) return;
    await supabase
      .from("users")
      .update({ nav_order: newOrder })
      .eq("id", userId);
  }, [userId]);

  const toggleSection = (tier: string) => {
    setOpenSections((prev) => ({ ...prev, [tier]: !prev[tier] }));
  };

  const isActive = (slug: string) => {
    if (slug === "dashboard") return pathname === "/dashboard";
    // Exact segment match — prevents "claim-calculator" matching "claim-calculator-settings"
    const pagePath = `/dashboard/${slug}`;
    return pathname === pagePath || pathname.startsWith(`${pagePath}/`);
  };

  // Get items for a section, sorted by saved order
  const getOrderedItems = (section: TierSection): NavItem[] => {
    const savedOrder = navOrder[section.tier];
    if (!savedOrder || savedOrder.length === 0) return section.items;
    const itemMap = new Map(section.items.map((item) => [item.slug, item]));
    const ordered: NavItem[] = [];
    for (const slug of savedOrder) {
      const item = itemMap.get(slug);
      if (item) {
        ordered.push(item);
        itemMap.delete(slug);
      }
    }
    // Append any items not in saved order (new items added after user last sorted)
    for (const item of itemMap.values()) {
      ordered.push(item);
    }
    return ordered;
  };

  const handleDragEnd = (tier: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const section = visibleSections.find((s) => s.tier === tier);
    if (!section) return;

    const items = getOrderedItems(section);
    const oldIndex = items.findIndex((i) => i.slug === active.id);
    const newIndex = items.findIndex((i) => i.slug === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    const newOrder = { ...navOrder, [tier]: reordered.map((i) => i.slug) };
    setNavOrder(newOrder);
    saveNavOrder(newOrder);
  };

  return (
    <div
      className="relative flex flex-col border-r py-4 transition-all duration-200 shrink-0"
      style={{
        width: expanded ? "220px" : "50px",
        overflow: "visible",
        background: "var(--bg-secondary)",
        borderColor: "var(--border-color)",
      }}
    >
      {/* Chevron toggle — right edge */}
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
          width="10" height="10" viewBox="0 0 16 16" fill="none"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 200ms" }}
        >
          <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Logo — reads custom branding from localStorage */}
      <SidebarLogo expanded={expanded} />

      {/* Scrollable nav area */}
      <div style={{ overflowY: "auto", overflowX: "hidden", flex: 1 }}>
        {visibleSections.map((section) => {
          const isOpen = !!openSections[section.tier];
          const orderedItems = getOrderedItems(section);
          return (
            <div key={section.tier} className="mb-1">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.tier)}
                className="flex items-center w-full cursor-pointer transition-colors"
                style={{
                  padding: expanded ? "6px 12px" : "6px 5px",
                  color: "var(--text-secondary)",
                  background: "transparent",
                  border: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                <svg
                  width="10" height="10" viewBox="0 0 16 16" fill="none" className="shrink-0"
                  style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms" }}
                >
                  <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {expanded && (
                  <span className="text-xs font-medium ml-2 whitespace-nowrap">{section.heading}</span>
                )}
              </button>

              {/* Section items — sortable within this section only */}
              {isOpen && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd(section.tier)}
                >
                  <SortableContext
                    items={orderedItems.map((i) => i.slug)}
                    strategy={verticalListSortingStrategy}
                  >
                    {orderedItems.map((item) => (
                      <SortableNavItem
                        key={item.slug}
                        item={item}
                        active={isActive(item.slug)}
                        expanded={expanded}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
