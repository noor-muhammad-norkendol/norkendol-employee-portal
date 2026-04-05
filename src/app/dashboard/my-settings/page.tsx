"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

const supabase = createClient();

const NOTIFICATION_TYPES = [
  { key: "action_items", label: "Action Items", desc: "When you're assigned an action item or one is updated" },
  { key: "training", label: "Training & University", desc: "Course assignments, completions, and reminders" },
  { key: "compliance", label: "Compliance", desc: "License expirations, renewal reminders, and compliance alerts" },
  { key: "company_updates", label: "Company Updates", desc: "Announcements and news from your organization" },
  { key: "system", label: "System Alerts", desc: "Account changes, security alerts, and system notices" },
];

export default function MySettingsPage() {
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
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>Manage your notification preferences</p>

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
