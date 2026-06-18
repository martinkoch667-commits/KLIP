import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth check ────────────────────────────────────────────────────────
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    // ── 2. Parse body ────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // ── 3. Build insert payload — only include fields we know ────────────────
    const payload: Record<string, unknown> = {
      user_id: userId,
      name: (body.name as string)?.trim(),
    };

    // Optional extra fields — included only if present in body
    const optionalFields = [
      "sector", "instagram_username", "company_description",
      "tone", "words_to_use", "words_to_avoid", "caption_examples",
      "brand_voice_prompt", "description_style",
      "primary_color", "secondary_color", "accent_color",
      "logo_url", "logo_dark_url", "brand_assets", "brand_icon_url",
      "font_family", "font_primary_url", "font_secondary", "font_secondary_url",
    ] as const;
    for (const field of optionalFields) {
      if (body[field] !== undefined) payload[field] = body[field];
    }

    if (!payload.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // ── 4. Service-role client (bypasses RLS, logs server-side) ─────────────
    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error("[workspace/create] Missing SUPABASE env vars — falling back to user client");
      // Fallback: use user-scoped client (will fail if RLS blocks)
      const { data, error } = await supabase
        .from("workspaces")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("[workspace/create] user-client insert error:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        return NextResponse.json({ error: error.message, code: error.code, hint: error.hint }, { status: 422 });
      }
      return NextResponse.json({ workspace: data });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin
      .from("workspaces")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("[workspace/create] admin insert error:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        payload_keys: Object.keys(payload),
      });
      return NextResponse.json({
        error: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details,
      }, { status: 422 });
    }

    console.log("[workspace/create] created workspace:", data.id, "for user:", userId);
    return NextResponse.json({ workspace: data });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[workspace/create] unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
