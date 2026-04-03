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
  is_published: boolean;
  pinned: boolean;
  visible_to_all: boolean;
  author_id: string | null;
  author_name: string | null;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

type FormData = {
  title: string;
  content: string;
  type: "news" | "event" | "announcement";
  priority: "low" | "medium" | "high" | "urgent";
  is_published: boolean;
  pinned: boolean;
  visible_to_all: boolean;
  expires_at: string;
};

const EMPTY_FORM: FormData = {
  title: "",
  content: "",
  type: "news",
  priority: "medium",
  is_published: false,
  pinned: false,
  visible_to_all: true,
  expires_at: "",
};

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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

/* ── main page ─────────────────────────────────────────── */

export default function CompanyUpdatesPage() {
  const supabase = createClient();
  const [updates, setUpdates] = useState<CompanyUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Get user + org info
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

  // Fetch updates
  const fetchUpdates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("company_updates")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    setUpdates((data as CompanyUpdate[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchUpdates();
  }, []);

  // Open create modal
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  // Open edit modal
  const openEdit = (u: CompanyUpdate) => {
    setEditingId(u.id);
    setForm({
      title: u.title,
      content: u.content,
      type: u.type,
      priority: u.priority,
      is_published: u.is_published,
      pinned: u.pinned,
      visible_to_all: u.visible_to_all,
      expires_at: u.expires_at ? u.expires_at.split("T")[0] : "",
    });
    setShowModal(true);
  };

  // Save (create or update)
  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      type: form.type,
      priority: form.priority,
      is_published: form.is_published,
      pinned: form.pinned,
      visible_to_all: form.visible_to_all,
      expires_at: form.expires_at || null,
      published_at: form.is_published ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      await supabase.from("company_updates").update(payload).eq("id", editingId);
    } else {
      await supabase.from("company_updates").insert({
        ...payload,
        org_id: "00000000-0000-0000-0000-000000000001",
        author_id: userId || null,
        author_name: userName || null,
      });
    }

    setSaving(false);
    setShowModal(false);
    fetchUpdates();
  };

  // Toggle publish
  const togglePublish = async (u: CompanyUpdate) => {
    const newPublished = !u.is_published;
    await supabase
      .from("company_updates")
      .update({
        is_published: newPublished,
        published_at: newPublished ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", u.id);
    fetchUpdates();
  };

  // Toggle pin
  const togglePin = async (u: CompanyUpdate) => {
    await supabase
      .from("company_updates")
      .update({ pinned: !u.pinned, updated_at: new Date().toISOString() })
      .eq("id", u.id);
    fetchUpdates();
  };

  // Delete
  const handleDelete = async (id: string) => {
    await supabase.from("company_updates").delete().eq("id", id);
    setDeleteConfirm(null);
    fetchUpdates();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Company Updates</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
          style={{ background: "var(--accent)", color: "#000" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
        >
          <span className="text-lg">+</span> Create Update
        </button>
      </div>

      {/* Updates List */}
      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      ) : updates.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        >
          <p style={{ color: "var(--text-secondary)" }}>
            No company updates yet. Create your first one!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map((u) => (
            <div
              key={u.id}
              className="rounded-xl p-5"
              style={{
                background: "var(--bg-secondary)",
                border: `1px solid ${u.pinned ? "var(--accent)" : "var(--border-color)"}`,
                opacity: u.is_published ? 1 : 0.6,
              }}
            >
              {/* Top row: title + badges + actions */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {u.pinned && <span className="text-sm">📌</span>}
                    <h3
                      className="font-semibold text-[15px] cursor-pointer hover:underline"
                      onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
                    >
                      {u.title}
                    </h3>
                    <Badge label={u.type} colors={TYPE_COLORS[u.type]} />
                    <Badge label={u.priority} colors={PRIORITY_COLORS[u.priority]} />
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: u.is_published ? "#1a3a2a" : "#3a2a1a",
                        color: u.is_published ? "#4ade80" : "#f59e0b",
                      }}
                    >
                      {u.is_published ? "Published" : "Draft"}
                    </span>
                  </div>

                  {/* Content preview / expanded */}
                  <p
                    className="text-sm leading-relaxed"
                    style={{
                      color: "var(--text-secondary)",
                      display: "-webkit-box",
                      WebkitLineClamp: expandedId === u.id ? 999 : 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {u.content}
                  </p>

                  {/* Meta row */}
                  <div className="flex items-center gap-4 mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    <span>By {u.author_name ?? "Unknown"}</span>
                    <span>Created {formatDate(u.created_at)}</span>
                    {u.published_at && <span>Published {formatDate(u.published_at)}</span>}
                    {u.expires_at && <span>Expires {formatDate(u.expires_at)}</span>}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => togglePin(u)}
                    className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                    title={u.pinned ? "Unpin" : "Pin to top"}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={u.pinned ? "var(--accent)" : "none"} stroke={u.pinned ? "var(--accent)" : "var(--text-muted)"} strokeWidth="1.8">
                      <path d="M12 17v5M9 2h6l-1 7h4l-6 8-6-8h4L9 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => togglePublish(u)}
                    className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                    title={u.is_published ? "Unpublish" : "Publish"}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={u.is_published ? "#4ade80" : "var(--text-muted)"} strokeWidth="1.8">
                      {u.is_published ? (
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
                      ) : (
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
                      )}
                    </svg>
                  </button>
                  <button
                    onClick={() => openEdit(u)}
                    className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                    title="Edit"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  {deleteConfirm === u.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="px-2 py-1 rounded text-xs font-medium cursor-pointer"
                        style={{ background: "#4a1a1a", color: "#ef4444" }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2 py-1 rounded text-xs cursor-pointer"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(u.id)}
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
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ────────────────────────── */}
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
              <h2 className="text-lg font-semibold">
                {editingId ? "Edit Update" : "Create Company Update"}
              </h2>
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
                  placeholder="Update title..."
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Content
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="Write your update..."
                />
              </div>

              {/* Type + Priority row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Type *
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
                    <option value="news">News</option>
                    <option value="event">Event</option>
                    <option value="announcement">Announcement</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as FormData["priority"] })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Toggles row */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Publish Now?</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.pinned}
                    onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Pin to top</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.visible_to_all}
                    onChange={(e) => setForm({ ...form, visible_to_all: e.target.checked })}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Visible to all</span>
                </label>
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
                  onClick={handleSave}
                  disabled={saving || !form.title.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#000" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Create Update"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
