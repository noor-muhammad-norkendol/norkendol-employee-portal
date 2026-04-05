import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Generate a readable certificate number: CERT-YYYYMMDD-XXXX
function generateCertNumber(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CERT-${date}-${rand}`;
}

// Issue certificate on course completion
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!userRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { course_id, final_score, final_grade } = body;

  if (!course_id) {
    return NextResponse.json({ error: "course_id required" }, { status: 400 });
  }

  // Check if already certified
  const { data: existing } = await supabaseAdmin
    .from("training_certificates")
    .select("id, certificate_number")
    .eq("user_id", user.id)
    .eq("course_id", course_id)
    .single();

  if (existing) {
    return NextResponse.json({ certificate: existing });
  }

  // Issue new certificate
  const { data: cert, error: insertErr } = await supabaseAdmin
    .from("training_certificates")
    .insert({
      org_id: userRow.org_id,
      user_id: user.id,
      course_id,
      certificate_number: generateCertNumber(),
      final_score: final_score ?? null,
      final_grade: final_grade ?? null,
      review_status: "auto_approved",
    })
    .select("id, certificate_number, issued_at, final_score, final_grade")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ certificate: cert });
}

// GET — fetch user's certificates
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: certs } = await supabaseAdmin
    .from("training_certificates")
    .select("id, course_id, certificate_number, issued_at, final_score, final_grade, review_status")
    .eq("user_id", user.id)
    .order("issued_at", { ascending: false });

  return NextResponse.json({ certificates: certs ?? [] });
}
