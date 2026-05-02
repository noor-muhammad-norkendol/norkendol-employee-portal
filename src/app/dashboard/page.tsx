"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { timeAgo, formatDate } from "@/lib/formatters";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ── types ─────────────────────────────────────────────── */

interface CompanyUpdate {
  id: string;
  title: string;
  content: string;
  type: "news" | "event" | "announcement";
  priority: "low" | "medium" | "high" | "urgent";
  pinned: boolean;
  author_name: string | null;
  published_at: string | null;
  created_at: string;
}

interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  item_type: "task" | "claim" | "training";
  assigned_by_name: string | null;
  status: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
}

interface Notification {
  id: string;
  title: string;
  message: string | null;
  type: "info" | "warning" | "error" | "success";
  sender_name: string | null;
  read_at: string | null;
  action_url: string | null;
  action_label: string | null;
  created_at: string;
}

interface PinnedApp {
  id: string;
  name: string;
  url: string;
  icon_url: string | null;
  category: string | null;
  sort_order: number;
}

interface LeaderboardEntry {
  id: string;
  user_name: string;
  value: number;
  rank: number;
}

interface LeaderboardConfig {
  id: string;
  metric_name: string;
}

/* ── badge tokens (semantic, theme-driven) ─────────────── */

const TYPE_TOKEN: Record<string, string> = {
  news: "--info",
  event: "--green",
  announcement: "--violet",
};

const PRIORITY_TOKEN: Record<string, string> = {
  low: "--green",
  medium: "--amber",
  high: "--red",
  urgent: "--red",
};

const NOTIF_TOKEN: Record<string, string> = {
  info: "--info",
  warning: "--amber",
  error: "--red",
  success: "--green",
};

function Badge({ label, token }: { label: string; token: string }) {
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
      style={{
        background: `color-mix(in srgb, var(${token}) 14%, transparent)`,
        color: `var(${token})`,
        border: `1px solid color-mix(in srgb, var(${token}) 30%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

/* ── medal SVGs (replace emoji per design rules) ───────── */

const MEDAL_COLORS = ["#FACC15", "#CBD5E1", "#D4A057"]; // gold, silver, bronze

function Medal({ rank }: { rank: number }) {
  const color = MEDAL_COLORS[rank];
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h10l-1.5 5.5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 8.5L7 3"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle
        cx="12"
        cy="14.5"
        r="5.5"
        fill={color}
        fillOpacity="0.18"
        stroke={color}
        strokeWidth="1.6"
      />
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontSize="6"
        fontWeight="700"
        fill={color}
      >
        {rank + 1}
      </text>
    </svg>
  );
}

/* ── letter avatar for apps ────────────────────────────── */

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
];

function AppIcon({ name, iconUrl }: { name: string; iconUrl: string | null }) {
  if (iconUrl) {
    return (
      <img src={iconUrl} alt={name} className="w-12 h-12 rounded-xl object-cover" />
    );
  }
  const idx = name.charCodeAt(0) % AVATAR_GRADIENTS.length;
  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
      style={{ background: AVATAR_GRADIENTS[idx] }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/* ── drag handle ──────────────────────────────────────── */

function DragHandle({
  listeners,
  attributes,
}: {
  listeners: Record<string, Function> | undefined;
  attributes: Record<string, unknown>;
}) {
  return (
    <button
      className="cursor-grab active:cursor-grabbing p-1 rounded transition-colors"
      style={{ color: "var(--text-faint)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--pad-elev)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      {...attributes}
      {...listeners}
      title="Drag to reorder"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="5" cy="3" r="1.5" />
        <circle cx="11" cy="3" r="1.5" />
        <circle cx="5" cy="8" r="1.5" />
        <circle cx="11" cy="8" r="1.5" />
        <circle cx="5" cy="13" r="1.5" />
        <circle cx="11" cy="13" r="1.5" />
      </svg>
    </button>
  );
}

/* ── sortable panel wrapper ───────────────────────────── */

function SortablePanel({
  id,
  children,
}: {
  id: string;
  children: (props: {
    listeners: Record<string, Function> | undefined;
    attributes: Record<string, unknown>;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 50 : ("auto" as const),
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ listeners, attributes })}
    </div>
  );
}

/* ── panel order persistence ──────────────────────────── */

const DEFAULT_ORDER = ["company-updates", "quick-access", "bottom-row"];

const STORAGE_KEY = "dashboard-panel-order";

function loadPanelOrder(userId: string): string[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (
        parsed.length === DEFAULT_ORDER.length &&
        DEFAULT_ORDER.every((p) => parsed.includes(p))
      ) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_ORDER;
}

function savePanelOrder(userId: string, order: string[]) {
  try {
    localStorage.setItem(`${STORAGE_KEY}-${userId}`, JSON.stringify(order));
  } catch {}
}

/* ── company logo for welcome header ────────────────────── */

function DashboardLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    function load() {
      setLogoUrl(localStorage.getItem("portal-logo"));
    }
    load();
    window.addEventListener("portal-branding-changed", load);
    return () => window.removeEventListener("portal-branding-changed", load);
  }, []);

  if (!logoUrl) return null;
  return (
    <img
      src={logoUrl}
      alt="Company Logo"
      style={{ maxHeight: 72, maxWidth: 280, objectFit: "contain", opacity: 0.9 }}
    />
  );
}

/* ── reusable card shell with optional accent stripe ───── */

function ThemedCard({
  className = "",
  interactive = false,
  onClick,
  children,
}: {
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`themed-card ${interactive ? "is-interactive cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      <div className="themed-card-stripe" aria-hidden />
      {children}
    </div>
  );
}

/* ── main dashboard ────────────────────────────────────── */

export default function DashboardPage() {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [updates, setUpdates] = useState<CompanyUpdate[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [apps, setApps] = useState<PinnedApp[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardMetric, setLeaderboardMetric] = useState("Leaderboard");
  const [expandedUpdate, setExpandedUpdate] = useState<string | null>(null);
  const [panelOrder, setPanelOrder] = useState<string[]>(DEFAULT_ORDER);
  const [mounted, setMounted] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const uid = user.id;
        setUserId(uid);
        setUserName(
          user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? ""
        );
        setPanelOrder(loadPanelOrder(uid));
      }
    });

    supabase
      .from("company_updates")
      .select("*")
      .eq("is_published", true)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => setUpdates((data as CompanyUpdate[]) ?? []));

    supabase
      .from("action_items")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => setActionItems((data as ActionItem[]) ?? []));

    supabase
      .from("notifications")
      .select("*")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setNotifications((data as Notification[]) ?? []));

    supabase
      .from("user_pinned_apps")
      .select("*")
      .order("sort_order", { ascending: true })
      .limit(6)
      .then(({ data }) => setApps((data as PinnedApp[]) ?? []));

    supabase
      .from("leaderboard_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .then(({ data }) => {
        const config = data?.[0] as LeaderboardConfig | undefined;
        if (config) {
          setLeaderboardMetric(config.metric_name);
          supabase
            .from("leaderboard_entries")
            .select("*")
            .eq("config_id", config.id)
            .order("rank", { ascending: true })
            .limit(5)
            .then(({ data: entries }) =>
              setLeaderboard((entries as LeaderboardEntry[]) ?? [])
            );
        }
      });
  }, [supabase]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setPanelOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        const next = arrayMove(prev, oldIndex, newIndex);
        if (userId) savePanelOrder(userId, next);
        return next;
      });
    },
    [userId]
  );

  const firstName = userName.split(" ")[0] || "there";

  /* ── panel content map ──────────────────────────────── */

  const panels: Record<
    string,
    (dragProps: {
      listeners: Record<string, Function> | undefined;
      attributes: Record<string, unknown>;
    }) => React.ReactNode
  > = {
    "company-updates": ({ listeners, attributes }) => (
      <section>
        <div className="flex items-center gap-2 mb-3">
          <DragHandle listeners={listeners} attributes={attributes} />
          <h2
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Company <span className="themed-accent">Updates</span>
          </h2>
        </div>
        {updates.length === 0 ? (
          <ThemedCard className="p-8 text-center">
            <p style={{ color: "var(--text-dim)" }}>No updates right now.</p>
          </ThemedCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {updates.map((u) => (
              <ThemedCard
                key={u.id}
                interactive
                onClick={() =>
                  setExpandedUpdate(expandedUpdate === u.id ? null : u.id)
                }
                className="p-5 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <Badge label={u.type} token={TYPE_TOKEN[u.type]} />
                  <Badge label={u.priority} token={PRIORITY_TOKEN[u.priority]} />
                </div>
                <h3
                  className="font-semibold text-[15px] leading-snug"
                  style={{ color: "var(--text)" }}
                >
                  {u.title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: "var(--text-dim)",
                    display: "-webkit-box",
                    WebkitLineClamp: expandedUpdate === u.id ? 999 : 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {u.content}
                </p>
                {expandedUpdate !== u.id && u.content.length > 120 && (
                  <span className="text-xs themed-accent">Read More ↓</span>
                )}
                <div
                  className="flex items-center justify-between text-xs mt-auto pt-2"
                  style={{
                    color: "var(--text-faint)",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <span>By {u.author_name ?? "Unknown"}</span>
                  <span>{formatDate(u.published_at ?? u.created_at)}</span>
                </div>
              </ThemedCard>
            ))}
          </div>
        )}
      </section>
    ),

    "quick-access": ({ listeners, attributes }) => (
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DragHandle listeners={listeners} attributes={attributes} />
            <h2
              className="text-lg font-semibold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Quick <span className="themed-accent">Access</span>
            </h2>
          </div>
          <a
            href="/dashboard/applications"
            className="text-sm transition-colors hover:underline themed-accent"
          >
            View All →
          </a>
        </div>
        <ThemedCard className="p-6">
          {apps.length === 0 ? (
            <div className="text-center py-4">
              <p style={{ color: "var(--text-dim)" }}>
                No pinned apps yet.{" "}
                <a href="/dashboard/applications" className="themed-accent">
                  Browse the App Vault →
                </a>
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-10 flex-wrap">
              {apps.map((app) => (
                <a
                  key={app.id}
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="transition-transform group-hover:scale-110">
                    <AppIcon name={app.name} iconUrl={app.icon_url} />
                  </div>
                  <span
                    className="text-xs text-center max-w-[80px] truncate"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {app.name}
                  </span>
                </a>
              ))}
            </div>
          )}
        </ThemedCard>
      </section>
    ),

    "bottom-row": ({ listeners, attributes }) => (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* My Action Items */}
        <ThemedCard className="p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <DragHandle listeners={listeners} attributes={attributes} />
            <h2
              className="text-lg font-semibold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              My Action <span className="themed-accent">Items</span>
            </h2>
          </div>
          {actionItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 gap-2">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-faint)"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-dim)" }}
              >
                No action items
              </p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                You&apos;re all caught up!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg p-3 flex items-start gap-3"
                  style={{ background: "var(--pad-elev)" }}
                >
                  <div
                    className="w-5 h-5 rounded shrink-0 mt-0.5 cursor-pointer transition-colors"
                    style={{
                      borderWidth: "2px",
                      borderStyle: "solid",
                      borderColor: "var(--border)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = "var(--accent)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = "var(--border)")
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--text)" }}
                    >
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        label={item.priority}
                        token={PRIORITY_TOKEN[item.priority]}
                      />
                      {item.due_date && (
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--text-faint)" }}
                        >
                          Due {formatDate(item.due_date)}
                        </span>
                      )}
                    </div>
                    {item.assigned_by_name && (
                      <p
                        className="text-[11px] mt-1"
                        style={{ color: "var(--text-faint)" }}
                      >
                        From: {item.assigned_by_name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ThemedCard>

        {/* Leaderboard */}
        <ThemedCard className="p-5 flex flex-col">
          <h2
            className="text-lg font-semibold mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <span className="themed-accent">Leaderboard</span>
          </h2>
          <p
            className="text-xs mb-4"
            style={{ color: "var(--text-faint)" }}
          >
            {leaderboardMetric}
          </p>
          {leaderboard.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 gap-2">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-faint)"
                strokeWidth="1.5"
              >
                <path d="M8 21h8M12 17v4M17 3H7a2 2 0 0 0-2 2v4a7 7 0 0 0 14 0V5a2 2 0 0 0-2-2Z" />
              </svg>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-dim)" }}
              >
                No rankings yet
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.id}
                  className="rounded-lg px-4 py-3 flex items-center justify-between"
                  style={{
                    background:
                      i === 0
                        ? "color-mix(in srgb, var(--amber) 12%, transparent)"
                        : "var(--pad-elev)",
                    border:
                      i === 0
                        ? "1px solid color-mix(in srgb, var(--amber) 35%, transparent)"
                        : "1px solid transparent",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 flex items-center justify-center">
                      {i < 3 ? (
                        <Medal rank={i} />
                      ) : (
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-faint)" }}
                        >
                          {entry.rank}
                        </span>
                      )}
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--text)" }}
                    >
                      {entry.user_name}
                    </span>
                  </div>
                  <span
                    className="text-sm font-semibold themed-accent"
                  >
                    ${entry.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ThemedCard>

        {/* Recent Notifications */}
        <ThemedCard className="p-5 flex flex-col">
          <h2
            className="text-lg font-semibold mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Recent <span className="themed-accent">Notifications</span>
          </h2>
          {notifications.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 gap-2">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-faint)"
                strokeWidth="1.5"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-dim)" }}
              >
                No new notifications
              </p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                You&apos;re all caught up!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg p-3 flex items-start gap-3"
                  style={{ background: "var(--pad-elev)" }}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                    style={{ background: `var(${NOTIF_TOKEN[n.type]})` }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--text)" }}
                    >
                      {n.title}
                    </p>
                    {n.message && (
                      <p
                        className="text-xs mt-0.5 line-clamp-2"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {n.message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      {n.sender_name && (
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--text-faint)" }}
                        >
                          {n.sender_name}
                        </span>
                      )}
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <a
            href="/dashboard/dashboard-admin"
            className="text-xs mt-4 text-center block transition-colors hover:underline themed-accent"
          >
            View All Notifications →
          </a>
        </ThemedCard>
      </div>
    ),
  };

  return (
    <div className="space-y-6">
      {/* ── Welcome Header (fixed, not draggable) ──────── */}
      <ThemedCard className="p-6 flex justify-between items-center">
        <div>
          <h1
            className="text-4xl font-extrabold tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}
          >
            Welcome back,{" "}
            <span className="themed-accent">{firstName}</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <DashboardLogo />
      </ThemedCard>

      {/* ── Draggable Panels ───────────────────────────── */}
      {mounted ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={panelOrder}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-6">
              {panelOrder.map((panelId) => (
                <SortablePanel key={panelId} id={panelId}>
                  {(dragProps) => panels[panelId](dragProps)}
                </SortablePanel>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-6">
          {panelOrder.map((panelId) => (
            <div key={panelId}>
              {panels[panelId]({ listeners: undefined, attributes: {} })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
