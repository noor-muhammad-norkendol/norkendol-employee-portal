import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireSuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
  if (error || !user) return null;
  const { data: row } = await supabaseAdmin
    .from("users")
    .select("role, org_id")
    .eq("id", user.id)
    .single();
  if (!row || !["super_admin", "system_admin"].includes(row.role)) return null;
  return { ...user, orgId: row.org_id, role: row.role };
}

// GET — fetch all alert routing rules for the org
export async function GET(req: NextRequest) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("alert_routing_rules")
    .select("*, route_to:org_hierarchy!route_to_hierarchy_id(name, title)")
    .eq("org_id", admin.orgId)
    .order("feature_key");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rules = (data ?? []).map((row) => ({
    ...row,
    route_to_name: row.route_to?.name ?? null,
    route_to_title: row.route_to?.title ?? null,
    route_to: undefined,
  }));

  return NextResponse.json({ rules });
}

// POST — create a new routing rule
export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { feature_key, condition, route_to_hierarchy_id, delivery } = body;

  if (!feature_key || !condition || !route_to_hierarchy_id || !delivery) {
    return NextResponse.json(
      { error: "feature_key, condition, route_to_hierarchy_id, and delivery are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("alert_routing_rules")
    .insert({
      org_id: admin.orgId,
      feature_key,
      condition,
      route_to_hierarchy_id,
      delivery,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}

// PUT — update a routing rule
export async function PUT(req: NextRequest) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const allowed = ["feature_key", "condition", "route_to_hierarchy_id", "delivery", "is_active"];
  const filtered: Record<string, unknown> = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  if (Object.keys(filtered).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("alert_routing_rules")
    .update(filtered)
    .eq("id", id)
    .eq("org_id", admin.orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}

// DELETE — delete a routing rule
export async function DELETE(req: NextRequest) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("alert_routing_rules")
    .delete()
    .eq("id", id)
    .eq("org_id", admin.orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
