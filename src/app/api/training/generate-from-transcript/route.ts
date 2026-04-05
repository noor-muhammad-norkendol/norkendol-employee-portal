import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";
import { GeneratedCourse, validateGeneratedCourse } from "@/lib/ai-types";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_TRANSCRIPT_LENGTH = 50_000;

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

  // Role + org check
  const { data: callerRow } = await supabaseAdmin
    .from("users")
    .select("role, org_id")
    .eq("id", caller.id)
    .single();

  const adminRoles = ["admin", "super_admin", "system_admin"];
  if (!callerRow || !adminRoles.includes(callerRow.role)) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  // Parse body
  const body = await req.json();
  const { transcript, quiz_count } = body;
  const numQuestions = Math.min(15, Math.max(2, parseInt(quiz_count) || 5));

  if (!transcript || typeof transcript !== "string") {
    return NextResponse.json(
      { error: "Transcript is required" },
      { status: 400 }
    );
  }

  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return NextResponse.json(
      { error: `Transcript exceeds ${MAX_TRANSCRIPT_LENGTH.toLocaleString()} character limit` },
      { status: 400 }
    );
  }

  // Call AI
  const result = await callAI<GeneratedCourse>({
    featureKey: "training_course_generator",
    orgId: callerRow.org_id,
    userId: caller.id,
    userInput: `Generate exactly ${numQuestions} quiz questions.\n\nHere is the training transcript to analyze:\n\n${transcript}`,
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 422 }
    );
  }

  // Validate response shape
  if (!validateGeneratedCourse(result.data)) {
    return NextResponse.json(
      {
        success: false,
        error: "AI generated an unexpected response format. Please try again.",
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ success: true, course: result.data });
}
