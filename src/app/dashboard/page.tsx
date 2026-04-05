"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

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

/* ── badge helpers ─────────────────────────────────────── */

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  news: { bg: "#1e3a5f", text: "#60a5fa" },
  event: { bg: "#1a3a2a", text: "#4ade80" },
  announcement: { bg: "#2d1b4e", text: "#a78bfa" },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: "#1a3a2a", text: "#4ade80" },
  medium: { bg: "#3a3520", text: "#facc15" },
  high: { bg: "#3a1a1a", text: "#f87171" },
  urgent: { bg: "#4a1a1a", text: "#ef4444" },
};

const NOTIF_COLORS: Record<string, string> = {
  info: "#60a5fa",
  warning: "#facc15",
  error: "#ef4444",
  success: "#4ade80",
};

function Badge({ label, colors }: { label: string; colors: { bg: string; text: string } }) {
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
      style={{ background: colors.bg, color: colors.text }}
    >
      {label}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
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

/* ── main dashboard ────────────────────────────────────── */

export default function DashboardPage() {
  const supabase = createClient();
  const [userName, setUserName] = useState("");
  const [updates, setUpdates] = useState<CompanyUpdate[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [apps, setApps] = useState<PinnedApp[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardMetric, setLeaderboardMetric] = useState("Leaderboard");
  const [expandedUpdate, setExpandedUpdate] = useState<string | null>(null);

  useEffect(() => {
    // Get user name
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserName(
          user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? ""
        );
      }
    });

    // Fetch all dashboard data
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
  }, []);

  const firstName = userName.split(" ")[0] || "there";

  return (
    <div className="space-y-6">
      {/* ── Welcome Header ─────────────────────────────── */}
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
      >
        <h1 className="text-2xl font-semibold">Welcome back, {firstName}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* ── Company Updates ────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Company Updates</h2>
        {updates.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
          >
            <p style={{ color: "var(--text-secondary)" }}>No updates right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {updates.map((u) => (
              <div
                key={u.id}
                className="rounded-xl p-5 flex flex-col gap-3 cursor-pointer transition-colors hover:brightness-110"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                }}
                onClick={() =>
                  setExpandedUpdate(expandedUpdate === u.id ? null : u.id)
                }
              >
                <div className="flex items-center justify-between">
                  <Badge label={u.type} colors={TYPE_COLORS[u.type]} />
                  <Badge label={u.priority} colors={PRIORITY_COLORS[u.priority]} />
                </div>
                <h3 className="font-semibold text-[15px] leading-snug">{u.title}</h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: "var(--text-secondary)",
                    display: "-webkit-box",
                    WebkitLineClamp: expandedUpdate === u.id ? 999 : 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {u.content}
                </p>
                {expandedUpdate !== u.id && u.content.length > 120 && (
                  <span className="text-xs" style={{ color: "var(--accent)" }}>
                    Read More ↓
                  </span>
                )}
                <div
                  className="flex items-center justify-between text-xs mt-auto pt-2"
                  style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-color)" }}
                >
                  <span>By {u.author_name ?? "Unknown"}</span>
                  <span>{formatDate(u.published_at ?? u.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Quick Access ───────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Quick Access</h2>
          <a
            href="/dashboard/applications"
            className="text-sm transition-colors hover:underline"
            style={{ color: "var(--accent)" }}
          >
            View All →
          </a>
        </div>
        <div
          className="rounded-xl p-6"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        >
          {apps.length === 0 ? (
            <div className="text-center py-4">
              <p style={{ color: "var(--text-secondary)" }}>
                No pinned apps yet.{" "}
                <a href="/dashboard/applications" style={{ color: "var(--accent)" }}>
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
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {app.name}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Bottom 3 Columns ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* My Action Items */}
        <div
          className="rounded-xl p-5 flex flex-col"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        >
          <h2 className="text-lg font-semibold mb-4">My Action Items</h2>
          {actionItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                No action items
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                You're all caught up!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg p-3 flex items-start gap-3"
                  style={{ background: "var(--bg-surface)" }}
                >
                  <div
                    className="w-5 h-5 rounded border-2 shrink-0 mt-0.5 cursor-pointer transition-colors hover:border-[var(--accent)]"
                    style={{ borderColor: "var(--border-color)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        label={item.priority}
                        colors={PRIORITY_COLORS[item.priority]}
                      />
                      {item.due_date && (
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          Due {formatDate(item.due_date)}
                        </span>
                      )}
                    </div>
                    {item.assigned_by_name && (
                      <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                        From: {item.assigned_by_name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div
          className="rounded-xl p-5 flex flex-col"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        >
          <h2 className="text-lg font-semibold mb-1">Leaderboard</h2>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            {leaderboardMetric}
          </p>
          {leaderboard.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <path d="M8 21h8M12 17v4M17 3H7a2 2 0 0 0-2 2v4a7 7 0 0 0 14 0V5a2 2 0 0 0-2-2Z" />
              </svg>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                No rankings yet
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => {
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <div
                    key={entry.id}
                    className="rounded-lg px-4 py-3 flex items-center justify-between"
                    style={{
                      background: i === 0 ? "rgba(250, 204, 21, 0.08)" : "var(--bg-surface)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base w-6 text-center">
                        {i < 3 ? medals[i] : <span style={{ color: "var(--text-muted)" }}>{entry.rank}</span>}
                      </span>
                      <span className="text-sm font-medium">{entry.user_name}</span>
                    </div>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "var(--accent)" }}
                    >
                      ${entry.value.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Notifications */}
        <div
          className="rounded-xl p-5 flex flex-col"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        >
          <h2 className="text-lg font-semibold mb-4">Recent Notifications</h2>
          {notifications.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                No new notifications
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                You're all caught up!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg p-3 flex items-start gap-3"
                  style={{ background: "var(--bg-surface)" }}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                    style={{ background: NOTIF_COLORS[n.type] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.message && (
                      <p
                        className="text-xs mt-0.5 line-clamp-2"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {n.message}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      {n.sender_name && (
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {n.sender_name}
                        </span>
                      )}
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <a
            href="/dashboard/notifications"
            className="text-xs mt-4 text-center block transition-colors hover:underline"
            style={{ color: "var(--accent)" }}
          >
            View All Notifications →
          </a>
        </div>
      </div>
    </div>
  );
}
