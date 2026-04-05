import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GeneratedCourse {
  title: string;
  description: string;
  suggested_category: string;
  level: string;
  quiz_questions: { question_text: string; options: { label: string; is_correct: boolean }[] }[];
}

export async function POST(req: NextRequest) {
  // Auth
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
    .select("role, org_id")
    .eq("id", caller.id)
    .single();

  const adminRoles = ["admin", "super_admin", "system_admin"];
  if (!callerRow || !adminRoles.includes(callerRow.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { frames, quiz_count } = body as { frames: string[]; quiz_count?: number };
  const numQuestions = Math.min(15, Math.max(2, quiz_count ?? 5));

  if (!frames?.length || frames.length < 1) {
    return NextResponse.json({ error: "At least one video frame is required" }, { status: 400 });
  }

  if (frames.length > 20) {
    return NextResponse.json({ error: "Maximum 20 frames allowed" }, { status: 400 });
  }

  // First: use vision to describe each frame
  // We'll send all frames to Anthropic vision in one call to get a visual description
  const { data: settings } = await supabaseAdmin
    .from("org_settings")
    .select("ai_provider, ai_api_key_encrypted, ai_model, business_context")
    .eq("org_id", callerRow.org_id)
    .single();

  if (!settings?.ai_provider || !settings.ai_api_key_encrypted) {
    return NextResponse.json({ error: "AI is not configured. Set up AI in System Settings first." }, { status: 422 });
  }

  // Only Anthropic supports vision well for this use case
  if (settings.ai_provider !== "anthropic") {
    return NextResponse.json({ error: "Video analysis requires Anthropic as the AI provider. Update in System Settings." }, { status: 422 });
  }

  const { decryptApiKey } = await import("@/lib/ai");
  const apiKey = decryptApiKey(settings.ai_api_key_encrypted);
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  // Step 1: Describe the video frames
  const frameContent = frames.map((frame, idx) => ([
    { type: "text" as const, text: `Frame ${idx + 1}:` },
    { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: frame.replace(/^data:image\/[^;]+;base64,/, "") } },
  ])).flat();

  let visualDescription: string;
  try {
    const describeMsg = await client.messages.create({
      model: settings.ai_model || "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: "You are analyzing frames from a training video. Describe what you see in detail — the topic being taught, key concepts shown, any text/diagrams visible, and the overall training subject. Be thorough as your description will be used to generate a training course.",
      messages: [{ role: "user", content: [
        { type: "text", text: `These are ${frames.length} frames extracted from a training video at regular intervals. Analyze them and provide a detailed description of what this training video covers. Include:\n1. Main topic/subject\n2. Key concepts and lessons shown\n3. Any text, diagrams, or demonstrations visible\n4. The difficulty level of the content\n5. Who the target audience appears to be` },
        ...frameContent,
      ]}],
    });

    const block = describeMsg.content[0];
    visualDescription = block.type === "text" ? block.text : "";

    // Log the vision call
    supabaseAdmin.from("ai_usage_log").insert({
      org_id: callerRow.org_id, user_id: caller.id, feature_key: "video_frame_analysis",
      provider: "anthropic", model: settings.ai_model || "claude-haiku-4-5-20251001",
      input_tokens: describeMsg.usage?.input_tokens ?? null,
      output_tokens: describeMsg.usage?.output_tokens ?? null,
      success: true,
    }).then(() => {});
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Vision analysis failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  // Step 2: Generate course from the visual description (reuse existing AI pipeline)
  const result = await callAI<GeneratedCourse>({
    featureKey: "training_course_generator",
    orgId: callerRow.org_id,
    userId: caller.id,
    userInput: `Generate exactly ${numQuestions} quiz questions.\n\nThis course is based on a training video. Here is a detailed description of what the video covers (generated from frame analysis):\n\n${visualDescription}`,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 422 });
  }

  return NextResponse.json({ success: true, course: result.data, visual_description: visualDescription });
}
