import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { contactId, name, email, orgId } = body;

  if (!contactId || !name || !email || !orgId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the caller is an admin (check their auth token)
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check caller is admin
  const { data: callerRow } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .single();

  const adminRoles = ["admin", "super_admin", "system_admin", "ep_admin"];
  if (!callerRow || !adminRoles.includes(callerRow.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Check if this contact already has a portal account
  const { data: contact } = await supabaseAdmin
    .from("external_contacts")
    .select("user_id")
    .eq("id", contactId)
    .single();

  if (contact?.user_id) {
    return NextResponse.json({ error: "Contact already has portal access" }, { status: 409 });
  }

  // Split name into first/last
  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") || null;

  // Invite user via Supabase Auth — sends email + sets up password flow
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        full_name: name,
        first_name: firstName,
        last_name: lastName,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? req.nextUrl.origin : ""}/login`,
    }
  );

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  const newUserId = inviteData.user.id;

  // Create users table record
  const { error: userInsertError } = await supabaseAdmin.from("users").insert({
    id: newUserId,
    org_id: orgId,
    email,
    full_name: name,
    first_name: firstName,
    last_name: lastName,
    role: "ep_user",
    status: "pending",
    user_type: "external",
    onboarding_status: "signup",
  });

  if (userInsertError) {
    return NextResponse.json({ error: userInsertError.message }, { status: 500 });
  }

  // Create default permissions (all off)
  await supabaseAdmin.from("user_permissions").insert({
    user_id: newUserId,
    org_id: orgId,
  });

  // Link external_contacts.user_id
  await supabaseAdmin
    .from("external_contacts")
    .update({ user_id: newUserId, updated_at: new Date().toISOString() })
    .eq("id", contactId);

  return NextResponse.json({ userId: newUserId });
}
