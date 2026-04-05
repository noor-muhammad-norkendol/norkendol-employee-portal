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
  const { data: row } = await supabaseAdmin
    .from("users")
    .select("role, org_id")
    .eq("id", user.id)
    .single();
  if (!row || !["admin", "super_admin", "system_admin"].includes(row.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Recent logs (last 100)
  const { data: logs } = await supabaseAdmin
    .from("ai_usage_log")
    .select("*")
    .eq("org_id", row.org_id)
    .order("created_at", { ascending: false })
    .limit(100);

  // Summary stats
  const { data: allLogs } = await supabaseAdmin
    .from("ai_usage_log")
    .select("feature_key, provider, model, input_tokens, output_tokens, success, created_at")
    .eq("org_id", row.org_id);

  const summary = {
    total_calls: allLogs?.length ?? 0,
    successful: allLogs?.filter((l) => l.success).length ?? 0,
    failed: allLogs?.filter((l) => !l.success).length ?? 0,
    total_input_tokens: allLogs?.reduce((sum, l) => sum + (l.input_tokens ?? 0), 0) ?? 0,
    total_output_tokens: allLogs?.reduce((sum, l) => sum + (l.output_tokens ?? 0), 0) ?? 0,
    by_feature: {} as Record<string, number>,
    by_model: {} as Record<string, number>,
  };

  for (const l of allLogs ?? []) {
    summary.by_feature[l.feature_key] = (summary.by_feature[l.feature_key] ?? 0) + 1;
    summary.by_model[l.model] = (summary.by_model[l.model] ?? 0) + 1;
  }

  return NextResponse.json({ logs: logs ?? [], summary });
}
