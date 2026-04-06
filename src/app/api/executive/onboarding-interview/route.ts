import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai";

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

// POST — trigger AI interview generation
export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { hierarchy_id } = body;

  if (!hierarchy_id) {
    return NextResponse.json({ error: "hierarchy_id is required" }, { status: 400 });
  }

  // Fetch person details
  const { data: person, error: personErr } = await supabaseAdmin
    .from("org_hierarchy")
    .select("name, title")
    .eq("id", hierarchy_id)
    .eq("org_id", admin.orgId)
    .single();

  if (personErr || !person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  // Fetch their feature assignments
  const { data: assignments } = await supabaseAdmin
    .from("hierarchy_feature_assignments")
    .select("feature_key")
    .eq("hierarchy_id", hierarchy_id);

  const featureKeys = (assignments ?? []).map((a) => a.feature_key);

  // Call AI to generate interview questions
  const aiResult = await callAI<{ questions: string[] }>({
    featureKey: "executive_onboarding",
    orgId: admin.orgId,
    userInput: `Generate onboarding interview questions for ${person.name}, ${person.title}. Their assigned platform features are: ${featureKeys.join(", ") || "none yet"}. Generate 3-5 targeted questions.`,
    userId: admin.id,
  });

  if (!aiResult.success || !aiResult.data?.questions) {
    return NextResponse.json(
      { error: aiResult.error ?? "Failed to generate interview questions" },
      { status: 500 }
    );
  }

  const questions = aiResult.data.questions;

  // Create interview record
  const { data: interview, error: insertErr } = await supabaseAdmin
    .from("ai_onboarding_interviews")
    .insert({
      org_id: admin.orgId,
      hierarchy_id,
      questions,
      created_by: admin.id,
    })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ interview_id: interview.id, questions });
}

// PUT — save answers to an interview
export async function PUT(req: NextRequest) {
  const admin = await requireSuperAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { interview_id, answers } = body;

  if (!interview_id || !answers || !Array.isArray(answers)) {
    return NextResponse.json({ error: "interview_id and answers[] are required" }, { status: 400 });
  }

  // Fetch existing interview
  const { data: interview, error: fetchErr } = await supabaseAdmin
    .from("ai_onboarding_interviews")
    .select("*, person:org_hierarchy!hierarchy_id(name, title)")
    .eq("id", interview_id)
    .single();

  if (fetchErr || !interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const questions: string[] = interview.questions;
  const allAnswered = answers.length >= questions.length;

  const updates: Record<string, unknown> = {
    answers,
    ...(allAnswered ? { completed_at: new Date().toISOString() } : {}),
  };

  const { error: updateErr } = await supabaseAdmin
    .from("ai_onboarding_interviews")
    .update(updates)
    .eq("id", interview_id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // If completed, generate alert routing suggestions via AI
  let suggestions: Array<{ feature_key: string; condition: string; delivery: string }> | null = null;

  if (allAnswered) {
    // Fetch feature assignments for this person
    const { data: assignments } = await supabaseAdmin
      .from("hierarchy_feature_assignments")
      .select("feature_key")
      .eq("hierarchy_id", interview.hierarchy_id);

    const featureKeys = (assignments ?? []).map((a) => a.feature_key);
    const personName = interview.person?.name ?? "Unknown";
    const personTitle = interview.person?.title ?? "Unknown";

    // Build Q&A pairs string
    const qaPairs = questions
      .map((q: string, i: number) => `Q: ${q}\nA: ${answers[i] ?? "(no answer)"}`)
      .join("\n\n");

    const aiResult = await callAI<{ suggestions: Array<{ feature_key: string; condition: string; delivery: string }> }>({
      featureKey: "executive_onboarding",
      orgId: admin.orgId,
      userInput: `Based on these interview answers for ${personName} (${personTitle}) who owns [${featureKeys.join(", ")}]:\n\n${qaPairs}\n\nSuggest alert routing rules. Return JSON: { "suggestions": [{ "feature_key": "...", "condition": "...", "delivery": "..." }] }`,
      userId: admin.id,
    });

    if (aiResult.success && aiResult.data?.suggestions) {
      suggestions = aiResult.data.suggestions;
    }
  }

  return NextResponse.json({
    success: true,
    completed: allAnswered,
    ...(suggestions ? { suggestions } : {}),
  });
}
