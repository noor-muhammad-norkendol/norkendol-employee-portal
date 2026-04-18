"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import UIComponentGlossary from "./UIComponentGlossary";
import AppearanceTab from "./AppearanceTab";

const TABS = ["AI Configuration", "UI Components", "Appearance"] as const;
type Tab = (typeof TABS)[number];

interface AISettings {
  ai_provider: string | null;
  ai_model: string | null;
  business_context: string | null;
  has_api_key: boolean;
}

const ANTHROPIC_MODELS = [
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (fast, cheap)" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (balanced)" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6 (most capable)" },
];

const OPENAI_MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (fast, cheap)" },
  { value: "gpt-4o", label: "GPT-4o (balanced)" },
  { value: "gpt-4.1", label: "GPT-4.1 (most capable)" },
];

export default function SystemSettingsPage() {
  const [supabase] = useState(() => createClient());
  const [activeTab, setActiveTab] = useState<Tab>("AI Configuration");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // AI settings form
  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [businessContext, setBusinessContext] = useState("");
  const [hasExistingKey, setHasExistingKey] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const res = await fetch("/api/settings/ai", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const data: AISettings = await res.json();
      setProvider(data.ai_provider || "");
      setModel(data.ai_model || "");
      setBusinessContext(data.business_context || "");
      setHasExistingKey(data.has_api_key);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async () => {
    setSaving(true);
    setSaveMsg("");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setSaveMsg("Not authenticated");
      setSaving(false);
      return;
    }

    const payload: Record<string, string> = {
      ai_provider: provider,
      ai_model: model,
      business_context: businessContext,
    };
    if (apiKey) {
      payload.ai_api_key = apiKey;
    }

    const res = await fetch("/api/settings/ai", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setSaveMsg("Settings saved");
      setApiKey("");
      setHasExistingKey(!!payload.ai_api_key || hasExistingKey);
    } else {
      const err = await res.json();
      setSaveMsg(err.error || "Failed to save");
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 3000);
  };

  const modelOptions = provider === "openai" ? OPENAI_MODELS : ANTHROPIC_MODELS;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">System Settings</h1>
      <p style={{ color: "var(--text-secondary)" }} className="mb-6">
        Organization-level configuration for AI, integrations, and platform
        settings.
      </p>

      {/* Tab bar */}
      <div
        className="flex gap-1 mb-6 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 text-sm font-medium transition-colors"
            style={{
              color:
                activeTab === tab
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
              borderBottom:
                activeTab === tab ? "2px solid #22c55e" : "2px solid transparent",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* UI Components tab */}
      {activeTab === "UI Components" && <UIComponentGlossary />}

      {/* Appearance tab */}
      {activeTab === "Appearance" && <AppearanceTab />}

      {/* AI Configuration tab */}
      {activeTab === "AI Configuration" && (
        <div className="max-w-2xl">
          {loading ? (
            <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
          ) : (
            <div className="space-y-6">
              {/* Provider */}
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  AI Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value);
                    setModel("");
                  }}
                  className="w-full px-3 py-2 rounded-md text-sm"
                  style={{
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <option value="">Select a provider...</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai">OpenAI (GPT)</option>
                </select>
              </div>

              {/* API Key */}
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    hasExistingKey
                      ? "Key saved — enter a new one to replace"
                      : "Enter your API key"
                  }
                  className="w-full px-3 py-2 rounded-md text-sm"
                  style={{
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                />
                {hasExistingKey && !apiKey && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "#4ade80" }}
                  >
                    API key is configured and encrypted
                  </p>
                )}
              </div>

              {/* Model */}
              {provider && (
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Default Model
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-sm"
                    style={{
                      background: "var(--bg-secondary)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <option value="">Use default</option>
                    {modelOptions.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {!model && provider === "anthropic" && "Default: Claude Haiku 4.5 (fast and cost-effective for most tasks)"}
                    {!model && provider === "openai" && "Default: GPT-4o Mini"}
                  </p>
                </div>
              )}

              {/* Business Context */}
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  Business Context
                </label>
                <p
                  className="text-xs mb-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Describe your business in plain English. This context is
                  automatically included in every AI feature across the portal —
                  training, compliance, and more.
                </p>
                <textarea
                  value={businessContext}
                  onChange={(e) => setBusinessContext(e.target.value)}
                  rows={5}
                  placeholder="Example: We are a property insurance adjusting company. Our employees are field adjusters who inspect residential and commercial properties for damage claims. Keep language professional but accessible to adjusters with varying experience levels."
                  className="w-full px-3 py-2 rounded-md text-sm"
                  style={{
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Save */}
              <div className="flex items-center gap-3">
                <button
                  onClick={saveSettings}
                  disabled={saving || !provider}
                  className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  style={{
                    background:
                      saving || !provider ? "#1a3a2a" : "#22c55e",
                    color:
                      saving || !provider ? "#4ade80" : "#000",
                    opacity: saving || !provider ? 0.5 : 1,
                    cursor:
                      saving || !provider ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Saving..." : "Save AI Settings"}
                </button>
                {saveMsg && (
                  <span
                    className="text-sm"
                    style={{
                      color: saveMsg === "Settings saved" ? "#4ade80" : "#ef4444",
                    }}
                  >
                    {saveMsg}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
