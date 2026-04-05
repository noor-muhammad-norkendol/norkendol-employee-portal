import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireSystemAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
  if (error || !user) return null;
  const { data: row } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!row || !["super_admin", "system_admin"].includes(row.role)) return null;
  return user;
}

// GET — list all templates
export async function GET(req: NextRequest) {
  const user = await requireSystemAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("ai_context_templates")
    .select("*")
    .order("feature_key");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data });
}

// POST — create new template
export async function POST(req: NextRequest) {
  const user = await requireSystemAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { feature_key, name, description, system_prompt } = body;

  if (!feature_key || !name || !description || !system_prompt) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("ai_context_templates")
    .insert({ feature_key, name, description, system_prompt, version: 1 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

// PUT — update existing template
export async function PUT(req: NextRequest) {
  const user = await requireSystemAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, name, description, system_prompt } = body;

  if (!id) return NextResponse.json({ error: "Template ID required" }, { status: 400 });

  // Bump version on prompt changes
  const { data: existing } = await supabaseAdmin
    .from("ai_context_templates")
    .select("version, system_prompt")
    .eq("id", id)
    .single();

  const versionBump = existing && system_prompt !== existing.system_prompt ? 1 : 0;

  const { error } = await supabaseAdmin
    .from("ai_context_templates")
    .update({
      name,
      description,
      system_prompt,
      version: (existing?.version ?? 1) + versionBump,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE — remove template
export async function DELETE(req: NextRequest) {
  const user = await requireSystemAdmin(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Template ID required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("ai_context_templates")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
