import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_EMAIL_LENGTH = 20_000;

export interface ParsedEmailFields {
  client_first_name: string | null;
  client_last_name: string | null;
  additional_policyholder_first: string | null;
  additional_policyholder_last: string | null;
  email: string | null;
  additional_policyholder_email: string | null;
  phone: string | null;
  additional_policyholder_phone: string | null;
  state: string | null;
  date_of_loss: string | null;
  loss_street: string | null;
  loss_line2: string | null;
  loss_city: string | null;
  loss_state: string | null;
  loss_zip: string | null;
  loss_description: string | null;
  peril: string | null;
  claim_number: string | null;
  insurance_company: string | null;
  policy_number: string | null;
  status_claim: string | null;
  onboard_type: string | null;
  referral_source: string | null;
  source_email: string | null;
  contractor_company: string | null;
  contractor_name: string | null;
  contractor_email: string | null;
  contractor_phone: string | null;
  assigned_pa_name: string | null;
  assignment_type: string | null;
  supplement_notes: string | null;
  notes: string | null;
}

export async function POST(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const {
    data: { user: caller },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);
  if (authError || !caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's org
  const { data: callerRow } = await supabaseAdmin
    .from("users")
    .select("role, org_id")
    .eq("id", caller.id)
    .single();

  if (!callerRow) {
    return NextResponse.json({ error: "User not found" }, { status: 403 });
  }

  // Parse body
  const body = await req.json();
  const { emailText } = body;

  if (!emailText || typeof emailText !== "string") {
    return NextResponse.json(
      { error: "Email text is required" },
      { status: 400 }
    );
  }

  if (emailText.length > MAX_EMAIL_LENGTH) {
    return NextResponse.json(
      { error: `Email text exceeds ${MAX_EMAIL_LENGTH.toLocaleString()} character limit` },
      { status: 400 }
    );
  }

  // Call AI
  const result = await callAI<ParsedEmailFields>({
    featureKey: "onboarder_email_parser",
    orgId: callerRow.org_id,
    userId: caller.id,
    userInput: emailText,
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 422 }
    );
  }

  return NextResponse.json({ success: true, fields: result.data });
}
