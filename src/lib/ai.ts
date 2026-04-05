/* ── Central AI Utility ──────────────────────────────────
 * Single entry point for all AI calls across the portal.
 * Every call = locked system_prompt + business_context + user input.
 * ─────────────────────────────────────────────────────── */

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ── Encryption helpers (AES-256-GCM) ─────────────────── */

const ALGO = "aes-256-gcm";

export function encryptApiKey(plaintext: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptApiKey(stored: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
  const [ivB64, tagB64, dataB64] = stored.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data, undefined, "utf8") + decipher.final("utf8");
}

/* ── Types ────────────────────────────────────────────── */

export interface AICallOptions {
  featureKey: string;
  orgId: string;
  userInput: string;
  userId?: string;
}

export interface AICallResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  rawResponse?: string;
}

/* ── Main call function ───────────────────────────────── */

export async function callAI<T = unknown>(
  options: AICallOptions
): Promise<AICallResult<T>> {
  const { featureKey, orgId, userInput, userId } = options;

  // 1. Fetch locked system prompt by feature key
  const { data: template, error: tErr } = await supabaseAdmin
    .from("ai_context_templates")
    .select("system_prompt")
    .eq("feature_key", featureKey)
    .single();

  if (tErr || !template) {
    return { success: false, error: "AI template not found for this feature" };
  }

  // 2. Fetch org AI settings
  const { data: settings, error: sErr } = await supabaseAdmin
    .from("org_settings")
    .select("ai_provider, ai_api_key_encrypted, ai_model, business_context")
    .eq("org_id", orgId)
    .single();

  if (sErr || !settings) {
    return {
      success: false,
      error: "AI is not configured for this organization",
    };
  }
  if (!settings.ai_provider || !settings.ai_api_key_encrypted) {
    return {
      success: false,
      error:
        "AI provider and API key must be configured in System Settings before using AI features",
    };
  }

  // 3. Build the full prompt
  const apiKey = decryptApiKey(settings.ai_api_key_encrypted);
  const businessContext = settings.business_context
    ? `\n\nBusiness Context:\n${settings.business_context}`
    : "";
  const fullSystemPrompt = template.system_prompt + businessContext;

  // 4. Call the provider and capture token usage
  let rawResponse: string;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  const model = settings.ai_model || (settings.ai_provider === "anthropic" ? "claude-haiku-4-5-20251001" : "gpt-4o-mini");

  try {
    if (settings.ai_provider === "anthropic") {
      const client = new Anthropic({ apiKey });
      const msg = await client.messages.create({
        model,
        max_tokens: 4096,
        system: fullSystemPrompt,
        messages: [{ role: "user", content: userInput }],
      });
      const block = msg.content[0];
      rawResponse = block.type === "text" ? block.text : "";
      inputTokens = msg.usage?.input_tokens ?? null;
      outputTokens = msg.usage?.output_tokens ?? null;
    } else {
      const client = new OpenAI({ apiKey });
      const res = await client.chat.completions.create({
        model,
        max_tokens: 4096,
        messages: [
          { role: "system", content: fullSystemPrompt },
          { role: "user", content: userInput },
        ],
      });
      rawResponse = res.choices[0]?.message?.content ?? "";
      inputTokens = res.usage?.prompt_tokens ?? null;
      outputTokens = res.usage?.completion_tokens ?? null;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI provider error";
    // Log failed call
    supabaseAdmin.from("ai_usage_log").insert({
      org_id: orgId, user_id: userId || null, feature_key: featureKey,
      provider: settings.ai_provider, model, success: false, error_message: message,
    }).then(() => {});
    return { success: false, error: message };
  }

  // 5. Log successful call
  supabaseAdmin.from("ai_usage_log").insert({
    org_id: orgId, user_id: userId || null, feature_key: featureKey,
    provider: settings.ai_provider, model,
    input_tokens: inputTokens, output_tokens: outputTokens,
    success: true,
  }).then(() => {});

  // 6. Parse JSON response (strip markdown fences if present)
  try {
    const cleaned = rawResponse
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    const parsed = JSON.parse(cleaned) as T;
    return { success: true, data: parsed, rawResponse };
  } catch {
    return {
      success: false,
      error: "AI returned an invalid response. Please try again.",
      rawResponse,
    };
  }
}
