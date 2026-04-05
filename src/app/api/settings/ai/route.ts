import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { encryptApiKey } from "@/lib/ai";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ── Auth helper ─────────────────────────────────────── */

async function authenticateSuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: row } = await supabaseAdmin
    .from("users")
    .select("role, org_id")
    .eq("id", user.id)
    .single();

  if (!row || !["super_admin", "system_admin"].includes(row.role)) return null;
  return { userId: user.id, orgId: row.org_id as string, role: row.role as string };
}

/* ── GET — fetch org AI settings ─────────────────────── */

export async function GET(req: NextRequest) {
  const caller = await authenticateSuperAdmin(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("org_settings")
    .select("ai_provider, ai_api_key_encrypted, ai_model, business_context")
    .eq("org_id", caller.orgId)
    .single();

  if (error || !data) {
    return NextResponse.json({
      ai_provider: null,
      ai_model: null,
      business_context: null,
      has_api_key: false,
    });
  }

  return NextResponse.json({
    ai_provider: data.ai_provider,
    ai_model: data.ai_model,
    business_context: data.business_context,
    has_api_key: !!data.ai_api_key_encrypted,
  });
}

/* ── PUT — save org AI settings ──────────────────────── */

export async function PUT(req: NextRequest) {
  const caller = await authenticateSuperAdmin(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { ai_provider, ai_api_key, ai_model, business_context } = body;

  if (ai_provider && !["anthropic", "openai"].includes(ai_provider)) {
    return NextResponse.json(
      { error: "Invalid AI provider" },
      { status: 400 }
    );
  }

  // Build update payload — only include api key if a new one was provided
  const updates: Record<string, unknown> = {
    ai_provider: ai_provider || null,
    ai_model: ai_model || null,
    business_context: business_context || null,
    updated_at: new Date().toISOString(),
  };

  if (ai_api_key) {
    updates.ai_api_key_encrypted = encryptApiKey(ai_api_key);
  }

  const { error } = await supabaseAdmin
    .from("org_settings")
    .update(updates)
    .eq("org_id", caller.orgId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
