/**
 * Shared API route authentication helper.
 * Verifies Bearer token and checks for admin roles.
 */
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export { supabaseAdmin };

export async function authenticateAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: row } = await supabaseAdmin
    .from("users")
    .select("role, org_id")
    .eq("id", user.id)
    .single();
  if (!row || !["super_admin", "system_admin"].includes(row.role)) return null;
  return { userId: user.id, orgId: row.org_id as string, role: row.role as string };
}
