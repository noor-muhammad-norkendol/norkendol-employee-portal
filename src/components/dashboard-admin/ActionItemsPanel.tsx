"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

/* -- types ------------------------------------------------ */

interface ActionItem {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  item_type: "task" | "claim" | "training";
  assigned_to: string;
  assigned_by: string | null;
  assigned_to_name: string | null;
  assigned_by_name: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

type FormData = {
  title: string;
  description: string;
  item_type: "task" | "claim" | "training";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string;
  assigned_to_name: string;
};

const EMPTY_FORM: FormData = {
  title: "",
  description: "",
  item_type: "task",
  priority: "medium",
  due_date: "",
  assigned_to_name: "",
};

/* -- helpers ---------------------------------------------- */

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: "#1a3a2a", text: "#4ade80" },
  medium: { bg: "#3a3520", text: "#facc15" },
  high: { bg: "#3a1a1a", text: "#f87171" },
  urgent: { bg: "#4a1a1a", text: "#ef4444" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#3a3520", text: "#facc15" },
  in_progress: { bg: "#1e3a5f", text: "#60a5fa" },
  completed: { bg: "#1a3a2a", text: "#4ade80" },
  cancelled: { bg: "#2a2a2a", text: "#888888" },
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  task: { bg: "#2d1b4e", text: "#a78bfa" },
  claim: { bg: "#1e3a5f", text: "#60a5fa" },
  training: { bg: "#1a3a2a", text: "#4ade80" },
};

function Badge({ label, colors }: { label: string; colors: { bg: string; text: string } }) {
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
      style={{ background: colors.bg, color: colors.text }}
    >
      {label.replace("_", " ")}
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

/* -- filters ---------------------------------------------- */

type FilterStatus = "all" | "pending" | "in_progress" | "completed" | "cancelled";
type FilterPriority = "all" | "low" | "medium" | "high" | "urgent";

/* -- panel ------------------------------------------------ */

export default function ActionItemsPanel() {
  const supabase = createClient();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterPriority, setFilterPriority] = useState<FilterPriority>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);

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
  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("action_items")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as ActionItem[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // Create
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  // Edit
  const openEdit = (item: ActionItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description ?? "",
      item_type: item.item_type,
      priority: item.priority,
      due_date: item.due_date ? item.due_date.split("T")[0] : "",
      assigned_to_name: item.assigned_to_name ?? "",
    });
    setShowModal(true);
  };

  // Save
  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      item_type: form.item_type,
      priority: form.priority,
      due_date: form.due_date || null,
      assigned_to_name: form.assigned_to_name.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      await supabase.from("action_items").update(payload).eq("id", editingId);
    } else {
      await supabase.from("action_items").insert({
        ...payload,
        org_id: "00000000-0000-0000-0000-000000000001",
        assigned_to: userId,
        assigned_by: userId,
        assigned_by_name: userName || null,
        status: "pending",
      });
    }

    setSaving(false);
    setShowModal(false);
    fetchItems();
  };

  // Update status
  const updateStatus = async (id: string, status: ActionItem["status"]) => {
    const update: Record<string, string | null> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "completed") update.completed_at = new Date().toISOString();
    else update.completed_at = null;

    await supabase.from("action_items").update(update).eq("id", id);
    setStatusDropdown(null);
    fetchItems();
  };

  // Delete
  const handleDelete = async (id: string) => {
    await supabase.from("action_items").delete().eq("id", id);
    setDeleteConfirm(null);
    fetchItems();
  };

  // Filter
  const filtered = items.filter((item) => {
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterPriority !== "all" && item.priority !== filterPriority) return false;
    return true;
  });

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const inProgressCount = items.filter((i) => i.status === "in_progress").length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#3a3520", color: "#facc15" }}
            >
              {pendingCount} pending
            </span>
          )}
          {inProgressCount > 0 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#1e3a5f", color: "#60a5fa" }}
            >
              {inProgressCount} in progress
            </span>
          )}
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
          style={{ background: "var(--accent)", color: "#000" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
        >
          <span className="text-lg">+</span> Create Action Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1">
          {(["all", "pending", "in_progress", "completed", "cancelled"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer transition-colors"
              style={{
                background: filterStatus === s ? "var(--bg-hover)" : "transparent",
                color: filterStatus === s
                  ? s === "all" ? "var(--text-primary)" : STATUS_COLORS[s].text
                  : "var(--text-muted)",
              }}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="w-px h-5" style={{ background: "var(--border-color)" }} />
        <div className="flex items-center gap-1">
          {(["all", "urgent", "high", "medium", "low"] as FilterPriority[]).map((p) => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer transition-colors"
              style={{
                background: filterPriority === p ? "var(--bg-hover)" : "transparent",
                color: filterPriority === p
                  ? p === "all" ? "var(--text-primary)" : PRIORITY_COLORS[p].text
                  : "var(--text-muted)",
              }}
            >
              {p}
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
            <path d="M9 6h11M9 12h11M9 18h11M5 6l-1.5 1.5L5 9M5 12l-1.5 1.5L5 15M5 18l-1.5 1.5L5 21" />
          </svg>
          <p style={{ color: "var(--text-secondary)" }}>
            {filterStatus === "all" && filterPriority === "all"
              ? "No action items yet. Create your first one!"
              : "No action items match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-xl p-4 flex items-start gap-4"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                opacity: item.status === "completed" || item.status === "cancelled" ? 0.5 : 1,
              }}
            >
              {/* Checkbox / status indicator */}
              <button
                onClick={() => {
                  if (item.status === "pending") updateStatus(item.id, "completed");
                  else if (item.status === "in_progress") updateStatus(item.id, "completed");
                  else if (item.status === "completed") updateStatus(item.id, "pending");
                }}
                className="w-5 h-5 rounded border-2 shrink-0 mt-0.5 cursor-pointer transition-all flex items-center justify-center"
                style={{
                  borderColor: item.status === "completed" ? "var(--accent)" : "var(--border-color)",
                  background: item.status === "completed" ? "var(--accent)" : "transparent",
                }}
              >
                {item.status === "completed" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3
                    className="text-sm font-semibold"
                    style={{
                      textDecoration: item.status === "completed" ? "line-through" : "none",
                    }}
                  >
                    {item.title}
                  </h3>
                  <Badge label={item.item_type} colors={TYPE_COLORS[item.item_type]} />
                  <Badge label={item.priority} colors={PRIORITY_COLORS[item.priority]} />
                  <Badge label={item.status} colors={STATUS_COLORS[item.status]} />
                </div>
                {item.description && (
                  <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
                    {item.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {item.assigned_to_name && <span>Assigned to: {item.assigned_to_name}</span>}
                  {item.assigned_by_name && <span>From: {item.assigned_by_name}</span>}
                  {item.due_date && (
                    <span
                      style={{
                        color:
                          new Date(item.due_date) < new Date() && item.status !== "completed"
                            ? "#ef4444"
                            : "var(--text-muted)",
                      }}
                    >
                      Due: {formatDate(item.due_date)}
                      {new Date(item.due_date) < new Date() && item.status !== "completed" && " (Overdue)"}
                    </span>
                  )}
                  <span>Created {formatDate(item.created_at)}</span>
                  {item.completed_at && <span>Completed {formatDate(item.completed_at)}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0 relative">
                {/* Status dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setStatusDropdown(statusDropdown === item.id ? null : item.id)}
                    className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                    title="Change status"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12h8M12 8v8" />
                    </svg>
                  </button>
                  {statusDropdown === item.id && (
                    <div
                      className="absolute right-0 top-full mt-1 rounded-lg py-1 z-50 min-w-[140px]"
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      {(["pending", "in_progress", "completed", "cancelled"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(item.id, s)}
                          className="w-full text-left px-3 py-1.5 text-xs capitalize cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                          style={{
                            color: item.status === s ? STATUS_COLORS[s].text : "var(--text-secondary)",
                            fontWeight: item.status === s ? 600 : 400,
                          }}
                        >
                          {s.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => openEdit(item)}
                  className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                  title="Edit"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.8">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>

                {deleteConfirm === item.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(item.id)}
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
                    onClick={() => setDeleteConfirm(item.id)}
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
          ))}
        </div>
      )}

      {/* -- Create / Edit Modal ----------------------------- */}
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
                {editingId ? "Edit Action Item" : "Create Action Item"}
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
                  placeholder="Action item title..."
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                  Description (Optional)
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="Details..."
                />
              </div>

              {/* Type + Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Type
                  </label>
                  <select
                    value={form.item_type}
                    onChange={(e) => setForm({ ...form, item_type: e.target.value as FormData["item_type"] })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="task">Task</option>
                    <option value="claim">Claim</option>
                    <option value="training">Training</option>
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

              {/* Assigned To + Due Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Assign To (Name)
                  </label>
                  <input
                    type="text"
                    value={form.assigned_to_name}
                    onChange={(e) => setForm({ ...form, assigned_to_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                    placeholder="e.g. Dan Lobos"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--text-secondary)" }}>
                    Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
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
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Create Action Item"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
