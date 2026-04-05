/* ── Email Utility ────────────────────────────────────────
 * Sends emails via Resend. Checks notification preferences
 * before sending — if a user turned off that type, we skip.
 * ─────────────────────────────────────────────────────── */

import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// All known notification types — add new ones here and they
// automatically appear in user settings as ON by default
export const NOTIFICATION_TYPES = [
  { key: "action_items", label: "Action Items" },
  { key: "training", label: "Training & University" },
  { key: "compliance", label: "Compliance" },
  { key: "company_updates", label: "Company Updates" },
  { key: "system", label: "System Alerts" },
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]["key"];

const FROM_ADDRESS = process.env.EMAIL_FROM || "notifications@norkendol.com";

interface SendEmailOptions {
  recipientUserId: string;
  type: NotificationType;
  subject: string;
  html: string;
}

export async function sendNotificationEmail(options: SendEmailOptions): Promise<{ sent: boolean; reason?: string }> {
  const { recipientUserId, type, subject, html } = options;

  // 1. Get recipient email
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("email, full_name")
    .eq("id", recipientUserId)
    .single();

  if (!user?.email) {
    return { sent: false, reason: "No email on file" };
  }

  // 2. Check preferences — no row means all defaults (everything ON)
  const { data: prefs } = await supabaseAdmin
    .from("notification_preferences")
    .select("email_enabled, email_disabled_types")
    .eq("user_id", recipientUserId)
    .single();

  if (prefs) {
    if (!prefs.email_enabled) {
      return { sent: false, reason: "User disabled all email notifications" };
    }
    if ((prefs.email_disabled_types as string[])?.includes(type)) {
      return { sent: false, reason: `User disabled ${type} emails` };
    }
  }

  // 3. Send
  const { error } = await getResend().emails.send({
    from: FROM_ADDRESS,
    to: user.email,
    subject,
    html,
  });

  if (error) {
    return { sent: false, reason: error.message };
  }

  return { sent: true };
}
