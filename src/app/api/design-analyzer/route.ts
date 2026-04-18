import { NextRequest, NextResponse } from "next/server";
import { decryptApiKey } from "@/lib/ai";
import { authenticateAdmin, supabaseAdmin } from "@/lib/api-auth";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are a UI/UX design analyzer. The user will upload a screenshot of a software application (CRM, management system, portal, etc.).

Analyze the screenshot and return a JSON object with these fields:

{
  "colors": {
    "accent": "#hex - the primary action/brand color (buttons, links, highlights)",
    "sidebarBg": "#hex - sidebar/nav background color",
    "topbarBg": "#hex - top bar background color",
    "pageBg": "#hex - main content area background",
    "cardBg": "#hex - card/panel background color",
    "textPrimary": "#hex - main text color",
    "textSecondary": "#hex - secondary/muted text color",
    "borderColor": "#hex - border/divider color"
  },
  "layout": {
    "navStyle": "sidebar | topbar | both",
    "density": "compact | comfortable",
    "themeMode": "dark | light"
  },
  "components": {
    "statusIndicator": "badge | chip | circle | progressBar | iconLabel",
    "dataViz": "horizontalBar | verticalBar | donut | bigNumber | sparkline",
    "menuStyle": "hamburger | bento | kebab | meatball",
    "formControls": "checkbox | switch",
    "loading": "spinner | progressBar | skeleton"
  },
  "summary": "A 1-2 sentence plain English description of the overall look and feel"
}

Be precise with the hex colors — sample them from the actual screenshot. If you can't determine a value, make your best guess based on the overall design language. Return ONLY the JSON object, no markdown fences or extra text.`;

export async function POST(req: NextRequest) {
  const caller = await authenticateAdmin(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the image data from the request
  const body = await req.json();
  const { imageData } = body; // base64 data URL
  if (!imageData) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  // Get AI settings
  const { data: settings } = await supabaseAdmin
    .from("org_settings")
    .select("ai_provider, ai_api_key_encrypted, ai_model")
    .eq("org_id", caller.orgId)
    .single();

  if (!settings?.ai_api_key_encrypted) {
    return NextResponse.json(
      { error: "AI is not configured. Go to System Settings → AI Configuration to set up your API key." },
      { status: 400 }
    );
  }

  const apiKey = decryptApiKey(settings.ai_api_key_encrypted);

  // Extract base64 and media type from data URL
  const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
  }
  const mediaType = match[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  const base64Data = match[2];

  try {
    // Use Anthropic (vision requires a model that supports it)
    const client = new Anthropic({ apiKey });
    const model = settings.ai_model || "claude-haiku-4-5-20251001";

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Data },
            },
            {
              type: "text",
              text: "Analyze this application screenshot and return the design configuration JSON.",
            },
          ],
        },
      ],
      system: SYSTEM_PROMPT,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    // Parse the JSON from the response
    let parsed;
    try {
      // Strip markdown fences if present
      const clean = textBlock.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON", raw: textBlock.text }, { status: 500 });
    }

    return NextResponse.json({ success: true, analysis: parsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI call failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
