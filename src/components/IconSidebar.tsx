"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
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
  vault: ["M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M3 11h18", "M8 15h.01", "M12 15h.01", "M16 15h.01"],
};

function NavIcon({ paths, size = 18 }: { paths: string[]; size?: number }) {
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
      { label: "TLS KPI", slug: "team-lead-support", paths: icons.leaderboard },
      { label: "Scope of Loss", slug: "scope-of-loss", paths: icons.leaderboard },
      { label: "Adjuster KPI", slug: "adjuster-kpi", paths: icons.leaderboard },
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
  zone,
  tier,
  originTier,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
  zone: "tier" | "vault";
  tier?: string;
  originTier?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.slug,
    data: { zone, tier, originTier },
  });
  const href = item.slug === "dashboard" ? "/dashboard" : `/dashboard/${item.slug}`;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, padding: expanded ? "1px 8px" : "1px 6px" }}
      className="relative group"
    >
      <div
        className={`relative rounded-md flex items-center transition-colors w-full h-11 ${
          expanded ? "px-3 gap-1" : "justify-center"
        }`}
        style={{
          color: isActivePage ? "var(--accent)" : "var(--text-dim)",
          background: isActivePage
            ? "color-mix(in srgb, var(--accent) 10%, transparent)"
            : "transparent",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: isActivePage ? "var(--border-active)" : "transparent",
          textShadow: isActivePage ? "var(--accent-text-shadow)" : undefined,
          boxShadow: isActivePage
            ? "0 0 14px color-mix(in srgb, var(--accent) 18%, transparent)"
            : undefined,
        }}
        onMouseEnter={(e) => {
          if (!isActivePage) {
            e.currentTarget.style.background = "var(--pad-elev)";
            e.currentTarget.style.color = "var(--text)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActivePage) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-dim)";
          }
        }}
      >
        {/* Drag handle — visible on hover only */}
        {expanded && (
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex items-center"
            style={{ color: "var(--text-faint)", touchAction: "none" }}
          >
            <DragHandle />
          </span>
        )}
        {/* When collapsed, attach drag listeners to the whole item */}
        <Link
          href={href}
          className="flex items-center gap-3.5 flex-1 h-full"
          style={{ textDecoration: "none", color: "inherit" }}
          {...(!expanded ? { ...attributes, ...listeners } : {})}
        >
          <span
            className="shrink-0 w-5 flex items-center justify-center"
            style={{ color: "inherit" }}
          >
            <NavIcon paths={item.paths} />
          </span>
          {expanded && (
            <span
              className="text-[15px] font-medium whitespace-nowrap"
              style={{ fontFamily: "var(--font-ui)" }}
            >
              {item.label}
            </span>
          )}
        </Link>
      </div>

      {/* Tooltip when collapsed */}
      {!expanded && (
        <div
          className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
          style={{
            background: "var(--pad)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          {item.label}
        </div>
      )}
    </div>
  );
}

// Non-sortable nav item — for items exempt from Vault (Dashboard)
function PlainNavItem({
  item,
  active: isActivePage,
  expanded,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
}) {
  const href = item.slug === "dashboard" ? "/dashboard" : `/dashboard/${item.slug}`;
  return (
    <div style={{ padding: expanded ? "1px 8px" : "1px 6px" }} className="relative group">
      <div
        className={`relative rounded-md flex items-center transition-colors w-full h-11 ${
          expanded ? "px-3 gap-1" : "justify-center"
        }`}
        style={{
          color: isActivePage ? "var(--accent)" : "var(--text-dim)",
          background: isActivePage
            ? "color-mix(in srgb, var(--accent) 10%, transparent)"
            : "transparent",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: isActivePage ? "var(--border-active)" : "transparent",
          textShadow: isActivePage ? "var(--accent-text-shadow)" : undefined,
          boxShadow: isActivePage
            ? "0 0 14px color-mix(in srgb, var(--accent) 18%, transparent)"
            : undefined,
        }}
        onMouseEnter={(e) => {
          if (!isActivePage) {
            e.currentTarget.style.background = "var(--pad-elev)";
            e.currentTarget.style.color = "var(--text)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActivePage) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-dim)";
          }
        }}
      >
        <Link
          href={href}
          className="flex items-center gap-3.5 flex-1 h-full"
          style={{ textDecoration: "none", color: "inherit", paddingLeft: expanded ? "20px" : 0 }}
        >
          <span className="shrink-0 w-5 flex items-center justify-center" style={{ color: "inherit" }}>
            <NavIcon paths={item.paths} />
          </span>
          {expanded && (
            <span className="text-[15px] font-medium whitespace-nowrap" style={{ fontFamily: "var(--font-ui)" }}>
              {item.label}
            </span>
          )}
        </Link>
      </div>
      {!expanded && (
        <div
          className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
          style={{ background: "var(--pad)", color: "var(--text)", border: "1px solid var(--border)" }}
        >
          {item.label}
        </div>
      )}
    </div>
  );
}

// Wrapper that makes its children a droppable target for the Vault.
// Empty/collapsed Vault still accepts drops because the wrapper itself is the drop zone.
function VaultDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "vault-drop", data: { zone: "vault" } });
  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
        borderRadius: "6px",
        transition: "background 120ms",
      }}
    >
      {children}
    </div>
  );
}

// Wrapper that makes a tier section's whole area a drop zone — so you can drop a vaulted item
// anywhere in the tier (not just on a specific existing item) and it will restore.
function TierDropZone({ tier, children }: { tier: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `tier-drop-${tier}`,
    data: { zone: "tier", tier },
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? "color-mix(in srgb, var(--accent) 6%, transparent)" : "transparent",
        borderRadius: "6px",
        transition: "background 120ms",
        minHeight: "8px",
      }}
    >
      {children}
    </div>
  );
}

function SidebarLogo({ expanded }: { expanded: boolean }) {
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    function loadBranding() {
      setCompanyName(localStorage.getItem("portal-company-name"));
    }
    loadBranding();
    window.addEventListener("portal-branding-changed", loadBranding);
    return () => window.removeEventListener("portal-branding-changed", loadBranding);
  }, []);

  const label = companyName || "Norkendol";
  const initial = label.charAt(0).toUpperCase();

  return (
    <div
      className={`relative flex items-center ${expanded ? "pl-5 pr-14" : "justify-center"}`}
      style={{ height: "80px" }}
    >
      {expanded ? (
        <span
          className="nav-brand font-extrabold leading-none whitespace-nowrap overflow-hidden text-ellipsis"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--text)",
            fontSize: label.length > 10 ? "18px" : "22px",
            letterSpacing: "0.02em",
            maxWidth: "100%",
          }}
          title={label}
        >
          <span
            style={{
              color: "var(--accent)",
              textShadow: "var(--accent-text-shadow)",
            }}
          >
            {initial}
          </span>
          {label.slice(1)}
        </span>
      ) : (
        <span
          className="text-[20px] font-extrabold leading-none"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--accent)",
            textShadow: "var(--accent-text-shadow)",
          }}
        >
          {initial}
        </span>
      )}
      {/* Gradient bottom divider — matches the TopBar line */}
      <span
        aria-hidden
        className="absolute left-0 right-0 bottom-0 pointer-events-none"
        style={{
          height: "1px",
          background: "linear-gradient(90deg, var(--accent) 0%, var(--violet) 60%, var(--magenta) 100%)",
          boxShadow: "0 0 12px color-mix(in srgb, var(--violet) 30%, transparent)",
        }}
      />
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
  // Hidden ("vaulted") items per tier — same shape as navOrder. Items here render in the Vault group, not in their tier.
  const [navVault, setNavVault] = useState<Record<string, string[]>>({});
  // Always start false so server and client agree on first paint; rehydrate from localStorage in an effect below.
  const [vaultExpanded, setVaultExpanded] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);

  // After mount, restore the user's saved Vault open/closed state from localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("portal-vault-expanded") === "1") {
      setVaultExpanded(true);
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load saved nav layout from Supabase on mount
  useEffect(() => {
    const loadNavLayout = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from("users")
        .select("nav_order, nav_vault")
        .eq("id", user.id)
        .single();
      if (data?.nav_order && typeof data.nav_order === "object") {
        setNavOrder(data.nav_order as Record<string, string[]>);
      }
      if (data?.nav_vault && typeof data.nav_vault === "object") {
        setNavVault(data.nav_vault as Record<string, string[]>);
      }
    };
    loadNavLayout();
  }, []);

  // Save nav layout (order + vault) to Supabase in a single round-trip
  const saveNavLayout = useCallback(async (
    next: { navOrder: Record<string, string[]>; navVault: Record<string, string[]> },
  ) => {
    if (!userId) return;
    await supabase
      .from("users")
      .update({ nav_order: next.navOrder, nav_vault: next.navVault })
      .eq("id", userId);
  }, [userId]);

  // Persist Vault expand/collapse state across page nav
  const toggleVault = useCallback(() => {
    setVaultExpanded((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("portal-vault-expanded", next ? "1" : "0");
      }
      return next;
    });
  }, []);

  const toggleSection = (tier: string) => {
    setOpenSections((prev) => ({ ...prev, [tier]: !prev[tier] }));
  };

  const isActive = (slug: string) => {
    if (slug === "dashboard") return pathname === "/dashboard";
    // Exact segment match — prevents "claim-calculator" matching "claim-calculator-settings"
    const pagePath = `/dashboard/${slug}`;
    return pathname === pagePath || pathname.startsWith(`${pagePath}/`);
  };

  // Get items for a section, sorted by saved order, with vaulted slugs filtered out
  const getOrderedItems = (section: TierSection): NavItem[] => {
    const savedOrder = navOrder[section.tier];
    const vaultedSet = new Set(navVault[section.tier] ?? []);
    let ordered: NavItem[];
    if (!savedOrder || savedOrder.length === 0) {
      ordered = section.items;
    } else {
      const itemMap = new Map(section.items.map((item) => [item.slug, item]));
      ordered = [];
      for (const slug of savedOrder) {
        const item = itemMap.get(slug);
        if (item) {
          ordered.push(item);
          itemMap.delete(slug);
        }
      }
      for (const item of itemMap.values()) {
        ordered.push(item);
      }
    }
    return ordered.filter((item) => !vaultedSet.has(item.slug));
  };

  // Get vaulted items across all visible sections (for rendering the Vault group)
  const getVaultedItems = (): { item: NavItem; originTier: string }[] => {
    const result: { item: NavItem; originTier: string }[] = [];
    for (const section of visibleSections) {
      const slugs = navVault[section.tier] ?? [];
      const itemMap = new Map(section.items.map((i) => [i.slug, i]));
      for (const slug of slugs) {
        const item = itemMap.get(slug);
        if (item) result.push({ item, originTier: section.tier });
      }
    }
    return result;
  };

  // Single cross-zone drag handler. Items carry zone metadata stamped via useSortable({ data }).
  // Routes: tier→tier (reorder), tier→vault (hide), vault→tier (restore to origin tier).
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as { zone?: "tier" | "vault"; tier?: string; originTier?: string } | undefined;
    const overData = over.data.current as { zone?: "tier" | "vault"; tier?: string; originTier?: string } | undefined;
    const activeZone = activeData?.zone;
    const overZone = overData?.zone ?? (over.id === "vault-drop" ? "vault" : undefined);
    if (!activeZone || !overZone) return;

    // Case 1: tier → tier reorder (only meaningful if same tier)
    if (activeZone === "tier" && overZone === "tier") {
      const tier = activeData?.tier;
      if (!tier || tier !== overData?.tier) return;
      if (active.id === over.id) return;

      const section = visibleSections.find((s) => s.tier === tier);
      if (!section) return;
      const items = getOrderedItems(section);
      const oldIndex = items.findIndex((i) => i.slug === active.id);
      const newIndex = items.findIndex((i) => i.slug === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      const newOrder = { ...navOrder, [tier]: reordered.map((i) => i.slug) };
      setNavOrder(newOrder);
      saveNavLayout({ navOrder: newOrder, navVault });
      return;
    }

    // Case 2: tier → vault (hide the item)
    if (activeZone === "tier" && overZone === "vault") {
      const tier = activeData?.tier;
      if (!tier) return;
      const slug = String(active.id);
      // Don't double-add
      const currentVaulted = navVault[tier] ?? [];
      if (currentVaulted.includes(slug)) return;
      const newVault = { ...navVault, [tier]: [...currentVaulted, slug] };
      // Also strip from navOrder if present (keeps shapes clean)
      const currentOrder = navOrder[tier];
      const newOrder = currentOrder
        ? { ...navOrder, [tier]: currentOrder.filter((s) => s !== slug) }
        : navOrder;
      setNavVault(newVault);
      if (newOrder !== navOrder) setNavOrder(newOrder);
      saveNavLayout({ navOrder: newOrder, navVault: newVault });
      return;
    }

    // Case 3: vault → tier (restore — always to the item's origin tier, regardless of where dropped).
    // Triggered whether the drop landed on a specific tier item or on the tier's empty drop-zone area.
    if (activeZone === "vault" && overZone === "tier") {
      const originTier = activeData?.originTier;
      if (!originTier) return;
      const slug = String(active.id);

      // Remove from vault
      const currentVaulted = navVault[originTier] ?? [];
      const newVaultArr = currentVaulted.filter((s) => s !== slug);
      const newVault = { ...navVault, [originTier]: newVaultArr };

      // Restore to origin tier. If the user dropped on a specific tier item in the SAME tier, splice at that index;
      // if they dropped in empty space (tier drop-zone) or on an item in a different tier, append to the end.
      const section = visibleSections.find((s) => s.tier === originTier);
      if (!section) {
        setNavVault(newVault);
        saveNavLayout({ navOrder, navVault: newVault });
        return;
      }
      const visible = getOrderedItems(section).map((i) => i.slug);
      let insertAt = visible.length;
      const overIsTierItem = !String(over.id).startsWith("tier-drop-");
      if (overIsTierItem && overData?.tier === originTier) {
        const idx = visible.indexOf(String(over.id));
        if (idx !== -1) insertAt = idx;
      }
      const restored = [...visible.slice(0, insertAt), slug, ...visible.slice(insertAt)];
      const newOrder = { ...navOrder, [originTier]: restored };

      setNavVault(newVault);
      setNavOrder(newOrder);
      saveNavLayout({ navOrder: newOrder, navVault: newVault });
      return;
    }

    // Case 4: vault → vault — internal Vault reorder. Skipped for v1 (would need a separate order column).
  };

  return (
    <div
      className="relative flex flex-col border-r pb-5 transition-all duration-200 shrink-0"
      style={{
        width: expanded ? "300px" : "60px",
        overflow: "visible",
        background: "var(--pad)",
        borderColor: "var(--border)",
      }}
    >
      {/* Chevron toggle — sits inside the sidebar, vertically centered in the 80px brand band */}
      <button
        onClick={onToggleExpand}
        aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        className="absolute flex items-center justify-center cursor-pointer z-50 transition-colors"
        style={{
          top: "26px",
          right: expanded ? "14px" : "50%",
          transform: expanded ? "translateX(0)" : "translateX(50%)",
          width: "34px",
          height: "30px",
          background: "transparent",
          color: "var(--text-dim)",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "var(--border)",
          borderRadius: "6px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--accent)";
          e.currentTarget.style.borderColor = "var(--border-active)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-dim)";
          e.currentTarget.style.borderColor = "var(--border)";
        }}
      >
        <svg
          width="12" height="12" viewBox="0 0 16 16" fill="none"
          style={{
            transform: expanded ? "rotate(0deg)" : "rotate(180deg)",
            transition: "transform 200ms",
          }}
        >
          <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Logo — reads custom branding from localStorage */}
      <SidebarLogo expanded={expanded} />

      {/* Scrollable nav area — single DndContext spans all tiers + Vault so items can move between zones */}
      <div style={{ overflowY: "auto", overflowX: "hidden", flex: 1 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {visibleSections.map((section) => {
            const isOpen = !!openSections[section.tier];
            const orderedItems = getOrderedItems(section);
            const dashboardItem = orderedItems.find((i) => i.slug === "dashboard");
            const sortableItems = orderedItems.filter((i) => i.slug !== "dashboard");
            return (
              <div key={section.tier} className="mb-1">
                {/* Section header — text IS the toggle, with a rule line extending to the right */}
                <button
                  onClick={() => toggleSection(section.tier)}
                  className="flex items-center w-full cursor-pointer transition-opacity"
                  title={isOpen ? "Collapse section" : "Expand section"}
                  style={{
                    padding: expanded ? "12px 16px 6px" : "12px 6px 6px",
                    background: "transparent",
                    border: "none",
                    opacity: isOpen ? 1 : 0.85,
                  }}
                >
                  {expanded ? (
                    <>
                      <span
                        className="section-header text-[12px] font-bold whitespace-nowrap"
                        style={{
                          color: "var(--accent)",
                          textShadow: "var(--accent-text-shadow)",
                          letterSpacing: "0.16em",
                          fontFamily: "var(--font-display)",
                        }}
                      >
                        {section.heading.toUpperCase()}
                      </span>
                      <span
                        aria-hidden
                        className="ml-3 flex-1"
                        style={{
                          height: "1px",
                          background: "var(--border)",
                        }}
                      />
                    </>
                  ) : (
                    /* Collapsed: small accent dot to indicate section break + click target */
                    <span
                      aria-hidden
                      className="mx-auto block"
                      style={{
                        width: "20px",
                        height: "1px",
                        background: "var(--accent)",
                        opacity: 0.5,
                        boxShadow: "var(--accent-text-shadow)",
                      }}
                    />
                  )}
                </button>

                {/* Section items — Dashboard renders non-sortable (un-vaultable); rest are sortable within this tier.
                    TierDropZone wraps the tier so vaulted items can be dropped into empty space, not just on an existing item. */}
                {isOpen && (
                  <TierDropZone tier={section.tier}>
                    {dashboardItem && (
                      <PlainNavItem
                        item={dashboardItem}
                        active={isActive(dashboardItem.slug)}
                        expanded={expanded}
                      />
                    )}
                    <SortableContext
                      items={sortableItems.map((i) => i.slug)}
                      strategy={verticalListSortingStrategy}
                    >
                      {sortableItems.map((item) => (
                        <SortableNavItem
                          key={item.slug}
                          item={item}
                          active={isActive(item.slug)}
                          expanded={expanded}
                          zone="tier"
                          tier={section.tier}
                        />
                      ))}
                    </SortableContext>
                  </TierDropZone>
                )}
              </div>
            );
          })}

          {/* Vault — collapsible group at the bottom holding the user's hidden tabs */}
          {(() => {
            const vaulted = getVaultedItems();
            const count = vaulted.length;
            return (
              <div className="mb-1 mt-2">
                <VaultDropZone>
                  <button
                    onClick={toggleVault}
                    className="flex items-center w-full cursor-pointer transition-opacity"
                    title={vaultExpanded ? "Collapse Vault" : "Expand Vault"}
                    style={{
                      padding: expanded ? "12px 16px 6px" : "12px 6px 6px",
                      background: "transparent",
                      border: "none",
                      opacity: vaultExpanded ? 1 : 0.85,
                    }}
                  >
                    {expanded ? (
                      <>
                        <span
                          className="section-header text-[12px] font-bold whitespace-nowrap flex items-center gap-2"
                          style={{
                            color: "var(--accent)",
                            textShadow: "var(--accent-text-shadow)",
                            letterSpacing: "0.16em",
                            fontFamily: "var(--font-display)",
                          }}
                        >
                          <NavIcon paths={icons.vault} size={14} />
                          VAULT
                          {count > 0 && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{
                                background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                                color: "var(--accent)",
                                letterSpacing: "0",
                              }}
                            >
                              {count}
                            </span>
                          )}
                        </span>
                        <span
                          aria-hidden
                          className="ml-3 flex-1"
                          style={{ height: "1px", background: "var(--border)" }}
                        />
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 16 16"
                          fill="none"
                          style={{
                            marginLeft: "8px",
                            transform: vaultExpanded ? "rotate(90deg)" : "rotate(0deg)",
                            transition: "transform 200ms",
                            color: "var(--text-dim)",
                          }}
                        >
                          <path d="M5 3L10 8L5 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </>
                    ) : (
                      <span
                        className="mx-auto flex items-center justify-center relative"
                        style={{ color: "var(--accent)", opacity: 0.7 }}
                        title={`Vault${count > 0 ? ` (${count})` : ""}`}
                      >
                        <NavIcon paths={icons.vault} size={16} />
                        {count > 0 && (
                          <span
                            className="absolute -top-1 -right-2 text-[9px] font-bold rounded-full px-1"
                            style={{
                              background: "var(--accent)",
                              color: "var(--pad)",
                              minWidth: "14px",
                              textAlign: "center",
                              lineHeight: "14px",
                            }}
                          >
                            {count}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                  {vaultExpanded && count > 0 && (
                    <SortableContext
                      items={vaulted.map((v) => v.item.slug)}
                      strategy={verticalListSortingStrategy}
                    >
                      {vaulted.map(({ item, originTier }) => (
                        <SortableNavItem
                          key={`vault-${item.slug}`}
                          item={item}
                          active={isActive(item.slug)}
                          expanded={expanded}
                          zone="vault"
                          originTier={originTier}
                        />
                      ))}
                    </SortableContext>
                  )}
                  {vaultExpanded && count === 0 && expanded && (
                    <div
                      className="text-[12px] italic"
                      style={{
                        padding: "8px 16px 12px",
                        color: "var(--text-faint)",
                        fontFamily: "var(--font-ui)",
                      }}
                    >
                      Drag tabs here to hide them from your sidebar.
                    </div>
                  )}
                </VaultDropZone>
              </div>
            );
          })()}
        </DndContext>
      </div>
    </div>
  );
}
