import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendNotificationEmail, NotificationType } from "@/lib/email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // Auth — only admins can trigger notification emails
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
  if (authError || !caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: callerRow } = await supabaseAdmin
    .from("users")
    .select("role, full_name")
    .eq("id", caller.id)
    .single();

  const adminRoles = ["admin", "super_admin", "system_admin"];
  if (!callerRow || !adminRoles.includes(callerRow.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { recipient_user_ids, type, subject, html } = body as {
    recipient_user_ids: string[];
    type: NotificationType;
    subject: string;
    html: string;
  };

  if (!recipient_user_ids?.length || !type || !subject || !html) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Send to each recipient (respects their preferences)
  const results = await Promise.all(
    recipient_user_ids.map((id) =>
      sendNotificationEmail({ recipientUserId: id, type, subject, html })
    )
  );

  const sent = results.filter((r) => r.sent).length;
  const skipped = results.filter((r) => !r.sent).length;

  return NextResponse.json({ sent, skipped, details: results });
}
