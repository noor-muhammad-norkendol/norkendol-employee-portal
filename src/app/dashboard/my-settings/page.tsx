"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";

const NOTIFICATION_TYPES = [
  { key: "action_items", label: "Action Items", desc: "When you're assigned an action item or one is updated" },
  { key: "training", label: "Training & University", desc: "Course assignments, completions, and reminders" },
  { key: "compliance", label: "Compliance", desc: "License expirations, renewal reminders, and compliance alerts" },
  { key: "company_updates", label: "Company Updates", desc: "Announcements and news from your organization" },
  { key: "system", label: "System Alerts", desc: "Account changes, security alerts, and system notices" },
];

/* eslint-disable @next/next/no-img-element */
function ProfilePhotoSection({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load from localStorage first (instant)
    const saved = localStorage.getItem("portal-user-photo");
    if (saved) setPhotoUrl(saved);
    // Also try from DB
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("users")
        .select("full_name, profile_picture_url")
        .eq("id", user.id)
        .single();
      if (data) {
        setUserName(data.full_name || "");
        if (data.profile_picture_url && !saved) {
          setPhotoUrl(data.profile_picture_url);
          localStorage.setItem("portal-user-photo", data.profile_picture_url);
        }
      }
    });
  }, [supabase]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      setMsg("Photo must be under 500KB.");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      // Save to localStorage (always works)
      localStorage.setItem("portal-user-photo", dataUrl);
      setPhotoUrl(dataUrl);
      window.dispatchEvent(new Event("portal-photo-changed"));
      // Also try DB save (may fail due to RLS or column size)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("users")
          .update({ profile_picture_url: dataUrl, updated_at: new Date().toISOString() })
          .eq("id", user.id);
      }
      setUploading(false);
      setMsg("Photo saved!");
      setTimeout(() => setMsg(""), 3000);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = async () => {
    localStorage.removeItem("portal-user-photo");
    setPhotoUrl(null);
    window.dispatchEvent(new Event("portal-photo-changed"));
    if (fileRef.current) fileRef.current.value = "";
    // Also clear in DB
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("users")
        .update({ profile_picture_url: null, updated_at: new Date().toISOString() })
        .eq("id", user.id);
    }
    setMsg("Photo removed.");
    setTimeout(() => setMsg(""), 3000);
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
      <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Profile Photo</h2>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        This photo appears in the top bar, directory, and anywhere your name is shown.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Current photo or initials */}
        <div
          style={{
            width: 72, height: 72, borderRadius: "50%", overflow: "hidden",
            border: "2px solid var(--border-color)", display: "flex",
            alignItems: "center", justifyContent: "center",
            background: "var(--bg-hover)", cursor: "pointer",
            flexShrink: 0,
          }}
          onClick={() => fileRef.current?.click()}
        >
          {photoUrl ? (
            <img src={photoUrl} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text-muted)" }}>{initials}</span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleUpload}
          style={{ display: "none" }}
        />
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6,
                padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              {uploading ? "Uploading..." : photoUrl ? "Change Photo" : "Upload Photo"}
            </button>
            {photoUrl && (
              <button
                onClick={handleRemove}
                style={{
                  background: "transparent", color: "var(--text-secondary)",
                  border: "1px solid var(--border-color)", borderRadius: 6,
                  padding: "6px 14px", fontSize: 12, cursor: "pointer",
                }}
              >
                Remove
              </button>
            )}
          </div>
          <p style={{ fontSize: 10, color: "var(--text-muted)" }}>JPG, PNG, or WebP. Max 500KB.</p>
          {msg && (
            <p style={{ fontSize: 11, color: msg.includes("Failed") ? "#ef4444" : "#4ade80", marginTop: 4 }}>{msg}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MySettingsPage() {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Email notification prefs
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailDisabledTypes, setEmailDisabledTypes] = useState<string[]>([]);

  // SMS (future — visible but disabled)
  const [smsEnabled, setSmsEnabled] = useState(false);

  const loadPrefs = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/notification-preferences", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setEmailEnabled(data.email_enabled);
      setEmailDisabledTypes(data.email_disabled_types ?? []);
      setSmsEnabled(data.sms_enabled);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  const savePrefs = async () => {
    setSaving(true);
    setSaveMsg("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/notification-preferences", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_enabled: emailEnabled,
        email_disabled_types: emailDisabledTypes,
        sms_enabled: smsEnabled,
        sms_disabled_types: [],
      }),
    });

    setSaving(false);
    setSaveMsg(res.ok ? "Saved!" : "Failed to save");
    if (res.ok) setTimeout(() => setSaveMsg(""), 2000);
  };

  const toggleType = (key: string) => {
    setEmailDisabledTypes((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--text-muted)" }}>
        <span className="text-sm">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>My Settings</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Manage your profile and notification preferences</p>

      {/* ── Profile Photo ────────────────────── */}
      <ProfilePhotoSection supabase={supabase} />

      {/* ── Email Notifications ────────────────────── */}
      <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Email Notifications</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Choose which emails you receive</p>
          </div>
          <button
            onClick={() => setEmailEnabled(!emailEnabled)}
            className="relative w-11 h-6 rounded-full transition-colors cursor-pointer"
            style={{ background: emailEnabled ? "var(--accent)" : "var(--bg-surface)" }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform"
              style={{
                background: emailEnabled ? "#000" : "var(--text-muted)",
                transform: emailEnabled ? "translateX(20px)" : "translateX(0)",
              }}
            />
          </button>
        </div>

        {emailEnabled && (
          <div className="space-y-3 pt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
            {NOTIFICATION_TYPES.map((nt) => {
              const isOn = !emailDisabledTypes.includes(nt.key);
              return (
                <div key={nt.key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{nt.label}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{nt.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleType(nt.key)}
                    className="relative w-9 h-5 rounded-full transition-colors cursor-pointer shrink-0 ml-4"
                    style={{ background: isOn ? "var(--accent)" : "var(--bg-surface)" }}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform"
                      style={{
                        background: isOn ? "#000" : "var(--text-muted)",
                        transform: isOn ? "translateX(16px)" : "translateX(0)",
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Text Notifications (future) ───────────── */}
      <div className="rounded-xl p-5 mb-6" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", opacity: 0.6 }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Text Notifications</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Coming soon</p>
          </div>
          <button disabled className="relative w-11 h-6 rounded-full cursor-not-allowed" style={{ background: "var(--bg-surface)" }}>
            <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full" style={{ background: "var(--text-muted)" }} />
          </button>
        </div>
      </div>

      {/* ── Save ──────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={savePrefs}
          disabled={saving}
          className="px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#000" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
        {saveMsg && <span className="text-sm" style={{ color: saveMsg === "Saved!" ? "#4ade80" : "#ef4444" }}>{saveMsg}</span>}
      </div>
    </div>
  );
}
