import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: prefs } = await supabaseAdmin
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // No row = all defaults (everything ON)
  return NextResponse.json({
    email_enabled: prefs?.email_enabled ?? true,
    email_disabled_types: prefs?.email_disabled_types ?? [],
    sms_enabled: prefs?.sms_enabled ?? false,
    sms_disabled_types: prefs?.sms_disabled_types ?? [],
  });
}

export async function PUT(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const payload = {
    user_id: user.id,
    email_enabled: body.email_enabled ?? true,
    email_disabled_types: body.email_disabled_types ?? [],
    sms_enabled: body.sms_enabled ?? false,
    sms_disabled_types: body.sms_disabled_types ?? [],
    updated_at: new Date().toISOString(),
  };

  // Upsert — create if first time, update if exists
  const { error: upsertErr } = await supabaseAdmin
    .from("notification_preferences")
    .upsert(payload, { onConflict: "user_id" });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
