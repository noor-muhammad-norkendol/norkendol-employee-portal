"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { timeAgo } from "@/lib/formatters";

/* -- types ------------------------------------------------ */

interface Notification {
  id: string;
  org_id: string;
  recipient_id: string;
  title: string;
  message: string | null;
  type: "info" | "warning" | "error" | "success";
  sender_name: string | null;
  read_at: string | null;
  action_url: string | null;
  action_label: string | null;
  expires_at: string | null;
  created_at: string;
}

type FormData = {
  title: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  sender_name: string;
  action_url: string;
  action_label: string;
  expires_at: string;
};

const EMPTY_FORM: FormData = {
  title: "",
  message: "",
  type: "info",
  sender_name: "",
  action_url: "",
  action_label: "",
  expires_at: "",
};

/* -- helpers ---------------------------------------------- */

const TYPE_META: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  info: { bg: "#1e3a5f", text: "#60a5fa", dot: "#60a5fa", label: "Info" },
  warning: { bg: "#3a3520", text: "#facc15", dot: "#facc15", label: "Warning" },
  error: { bg: "#4a1a1a", text: "#ef4444", dot: "#ef4444", label: "Error" },
  success: { bg: "#1a3a2a", text: "#4ade80", dot: "#4ade80", label: "Success" },
};

function Badge({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
      style={{ background: bg, color: text }}
    >
      {label}
    </span>
  );
}

/* -- filters ---------------------------------------------- */

type FilterStatus = "all" | "unread" | "read";
type FilterType = "all" | "info" | "warning" | "error" | "success";

/* -- panel ------------------------------------------------ */

export default function NotificationsPanel() {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Get user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        setUserName(
          user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? ""
        );
      }
    });
  }, []);

  // Fetch
  const fetchNotifications = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Mark read / unread
  const markRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    fetchNotifications();
  };

  const markUnread = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read_at: null })
      .eq("id", id);
    fetchNotifications();
  };

  const markAllRead = async () => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .is("read_at", null);
    fetchNotifications();
  };

  // Delete
  const handleDelete = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setDeleteConfirm(null);
    fetchNotifications();
  };

  // Create (send notification to self for now)
  const handleSend = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await supabase.from("notifications").insert({
      org_id: "00000000-0000-0000-0000-000000000001",
      recipient_id: userId,
      title: form.title.trim(),
      message: form.message.trim() || null,
      type: form.type,
      sender_name: form.sender_name.trim() || userName || null,
      action_url: form.action_url.trim() || null,
      action_label: form.action_label.trim() || null,
      expires_at: form.expires_at || null,
    });
    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
    fetchNotifications();
  };

  // Filter
  const filtered = notifications.filter((n) => {
    if (filterStatus === "unread" && n.read_at) return false;
    if (filterStatus === "read" && !n.read_at) return false;
    if (filterType !== "all" && n.type !== filterType) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#ef4444", color: "#fff" }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}
            >
              Mark All Read
            </button>
          )}
          <button
            onClick={() => { setForm({ ...EMPTY_FORM, sender_name: userName }); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            style={{ background: "var(--accent)", color: "#000" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
          >
            <span className="text-lg">+</span> Send Notification
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1">
          {(["all", "unread", "read"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer transition-colors"
              style={{
                background: filterStatus === s ? "var(--bg-hover)" : "transparent",
                color: filterStatus === s ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <div
          className="w-px h-5"
          style={{ background: "var(--border-color)" }}
        />
        <div className="flex items-center gap-1">
          {(["all", "info", "warning", "error", "success"] as FilterType[]).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer transition-colors"
              style={{
                background: filterType === t ? "var(--bg-hover)" : "transparent",
                color: filterType === t
                  ? t === "all"
                    ? "var(--text-primary)"
                    : TYPE_META[t].text
                  : "var(--text-muted)",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        >
          <svg className="mx-auto mb-3" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <p style={{ color: "var(--text-secondary)" }}>
            {filterStatus === "all" && filterType === "all"
              ? "No notifications yet."
              : "No notifications match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const meta = TYPE_META[n.type];
            const isRead = !!n.read_at;
            return (
              <div
                key={n.id}
                className="rounded-xl p-4 flex items-start gap-4 transition-colors"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-color)",
                  opacity: isRead ? 0.55 : 1,
                }}
              >
                {/* Dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                  style={{ background: meta.dot }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold">{n.title}</h3>
                    <Badge label={meta.label} bg={meta.bg} text={meta.text} />
                    {isRead && (
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Read</span>
                    )}
                  </div>
                  {n.message && (
                    <p className="text-sm leading-relaxed mb-1" style={{ color: "var(--text-secondary)" }}>
                      {n.message}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {n.sender_name && <span>From: {n.sender_name}</span>}
                    <span>{timeAgo(n.created_at)}</span>
                    {n.expires_at && (
                      <span>
                        Expires {new Date(n.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                  {n.action_url && n.action_label && (
                    <a
                      href={n.action_url}
                      className="inline-block text-xs mt-2 font-medium transition-colors hover:underline"
                      style={{ color: "var(--accent)" }}
                    >
                      {n.action_label} →
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {isRead ? (
                    <button
                      onClick={() => markUnread(n.id)}
                      className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                      title="Mark unread"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="4" fill="var(--text-muted)" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={() => markRead(n.id)}
                      className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                      title="Mark read"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  )}
                  {deleteConfirm === n.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(n.id)}
                        className="px-2 py-1 rounded text-xs font-medium cursor-pointer"
                        style={{ background: "#4a1a1a", color: "#ef4444" }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2 py-1 rounded text-xs cursor-pointer"
                        style={{ color: "var(--text-muted)" }}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(n.id)}
                      className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                      title="Delete"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* -- Send Notification Modal ------------------------- */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="rounded-xl p-6 w-full max-w-lg"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Send Notification</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-lg cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="Notification title..."
                />
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Message
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="Notification body..."
                />
              </div>

              {/* Type + Sender row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as FormData["type"] })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                    <option value="success">Success</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Sender Name
                  </label>
                  <input
                    type="text"
                    value={form.sender_name}
                    onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                    placeholder="e.g. HR Team"
                  />
                </div>
              </div>

              {/* Action URL + Label */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Action URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.action_url}
                    onChange={(e) => setForm({ ...form, action_url: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Action Label
                  </label>
                  <input
                    type="text"
                    value={form.action_label}
                    onChange={(e) => setForm({ ...form, action_label: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                    placeholder="e.g. View Details"
                  />
                </div>
              </div>

              {/* Expires */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Expires On (Optional)
                </label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={saving || !form.title.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#000" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  {saving ? "Sending..." : "Send Notification"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
