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

// GET — fetch all feature assignments, optionally filtered by hierarchy_id
export async function GET(req: NextRequest) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const hierarchyId = searchParams.get("hierarchy_id");

  let query = supabaseAdmin
    .from("hierarchy_feature_assignments")
    .select("*, person:org_hierarchy!hierarchy_id(name, title)");

  if (hierarchyId) {
    query = query.eq("hierarchy_id", hierarchyId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const assignments = (data ?? []).map((row) => ({
    ...row,
    person_name: row.person?.name ?? null,
    person_title: row.person?.title ?? null,
    person: undefined,
  }));

  return NextResponse.json({ assignments });
}

// POST — create or update a feature assignment
export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { hierarchy_id, feature_key, is_owner } = body;

  if (!hierarchy_id || !feature_key) {
    return NextResponse.json({ error: "hierarchy_id and feature_key are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("hierarchy_feature_assignments")
    .upsert(
      {
        hierarchy_id,
        feature_key,
        is_owner: is_owner ?? false,
      },
      { onConflict: "hierarchy_id,feature_key" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data });
}

// DELETE — remove a feature assignment
export async function DELETE(req: NextRequest) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("hierarchy_feature_assignments")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
