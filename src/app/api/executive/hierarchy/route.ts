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

// GET — fetch all org_hierarchy nodes for the user's org
export async function GET(req: NextRequest) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("org_hierarchy")
    .select("*, parent:org_hierarchy!reports_to(name)")
    .eq("org_id", admin.orgId)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const nodes = (data ?? []).map((node) => ({
    ...node,
    reports_to_name: node.parent?.name ?? null,
    parent: undefined,
  }));

  return NextResponse.json({ nodes });
}

// POST — create a new hierarchy node
export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, title, reports_to, user_id } = body;

  if (!name || !title) {
    return NextResponse.json({ error: "name and title are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("org_hierarchy")
    .insert({
      org_id: admin.orgId,
      name,
      title,
      reports_to: reports_to ?? null,
      user_id: user_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ node: data });
}
