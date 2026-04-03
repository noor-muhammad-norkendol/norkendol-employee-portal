"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

interface PendingUser {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  primary_phone: string | null;
  user_type: string;
  created_at: string;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function PendingUsersPage() {
  const supabase = createClient();
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectConfirm, setRejectConfirm] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const ORG_ID = "00000000-0000-0000-0000-000000000001";

  const fetchPending = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, first_name, last_name, email, primary_phone, user_type, created_at")
      .eq("org_id", ORG_ID)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) console.error("fetchPending error:", error);
    setPending((data as PendingUser[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const approveUser = async (id: string) => {
    setActionLoading(id);
    await supabase.from("users").update({
      status: "active",
      onboarding_status: "approved",
    }).eq("id", id);
    setActionLoading(null);
    fetchPending();
  };

  const rejectUser = async (id: string) => {
    setActionLoading(id);
    await supabase.from("users").update({
      status: "rejected",
      onboarding_status: "completed",
      rejection_reason: rejectReason || null,
    }).eq("id", id);
    setActionLoading(null);
    setRejectConfirm(null);
    setRejectReason("");
    fetchPending();
  };

  const inputStyle = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Pending Users</h1>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#3a3520", color: "#facc15" }}>
            {pending.length} pending
          </span>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      ) : pending.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "#1a3a2a" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm font-medium mb-1">All caught up</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No pending applications to review.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((u) => (
            <div
              key={u.id}
              className="rounded-xl p-5"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(250, 204, 21, 0.03) 10px, rgba(250, 204, 21, 0.03) 20px)`,
              }}
            >
              <div className="flex items-center justify-between">
                {/* Left: user info */}
                <div className="flex items-center gap-4">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                    style={{ background: "var(--bg-hover)", color: "var(--text-primary)" }}
                  >
                    {initials(u.full_name)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{u.full_name}</div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <a href={`mailto:${u.email}`} style={{ color: "var(--accent)" }} className="hover:underline">{u.email}</a>
                      {u.primary_phone && <span>{u.primary_phone}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#3a3520", color: "#facc15" }}>
                        {u.user_type === "external" ? "External Partner" : "Internal"}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        Applied {timeAgo(u.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {rejectConfirm === u.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="px-2 py-1.5 rounded-lg text-xs outline-none w-40"
                        style={inputStyle}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={() => rejectUser(u.id)}
                        disabled={actionLoading === u.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                        style={{ background: "#4a1a1a", color: "#ef4444" }}
                      >
                        Confirm Reject
                      </button>
                      <button
                        onClick={() => { setRejectConfirm(null); setRejectReason(""); }}
                        className="px-2 py-1.5 rounded-lg text-xs cursor-pointer"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => approveUser(u.id)}
                        disabled={actionLoading === u.id}
                        className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
                        style={{ background: "var(--accent)", color: "#fff" }}
                      >
                        {actionLoading === u.id ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() => setRejectConfirm(u.id)}
                        className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                        style={{ background: "#4a1a1a", color: "#ef4444" }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
