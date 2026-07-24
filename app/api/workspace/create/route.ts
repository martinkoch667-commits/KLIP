import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getPlan } from "@/lib/plans";

// Colonnes optionnelles pas forcément migrées : si l'insert échoue parce que la
// colonne n'existe pas encore (PostgREST PGRST204 / Postgres 42703), on la retire
// et on réessaie — la création de client ne casse jamais faute de migration.
const SOFT_COLUMNS = ["subtitle_style_id"] as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertWorkspace(client: any, payload: Record<string, unknown>) {
  const p = { ...payload };
  for (let i = 0; i <= SOFT_COLUMNS.length; i++) {
    const res = await client.from("workspaces").insert(p).select().single();
    if (!res.error) return res;
    const msg = res.error.message || "";
    const missing = SOFT_COLUMNS.find((c) => c in p && msg.includes(c));
    if (!missing) return res;
    delete p[missing];
  }
  return await client.from("workspaces").insert(p).select().single();
}

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
      "subtitle_style_id",
    ] as const;
    for (const field of optionalFields) {
      if (body[field] !== undefined) payload[field] = body[field];
    }

    if (!payload.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // ── 3b. Bridage par offre : limite de clients ───────────────────────────
    const { data: settings } = await supabase
      .from("user_settings")
      .select("account_type")
      .eq("user_id", userId)
      .maybeSingle();
    const plan = getPlan(settings?.account_type);
    const { count } = await supabase
      .from("workspaces")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) >= plan.maxClients) {
      return NextResponse.json({
        error: `Limite atteinte : l'offre ${plan.label} autorise ${plan.maxClients} client${plan.maxClients > 1 ? "s" : ""}. Passez à l'offre supérieure pour en ajouter davantage.`,
        code: "PLAN_LIMIT",
      }, { status: 403 });
    }

    // ── 4. Service-role client (bypasses RLS, logs server-side) ─────────────
    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error("[workspace/create] Missing SUPABASE env vars — falling back to user client");
      // Fallback: use user-scoped client (will fail if RLS blocks)
      const { data, error } = await insertWorkspace(supabase, payload);

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

    const { data, error } = await insertWorkspace(admin, payload);

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
