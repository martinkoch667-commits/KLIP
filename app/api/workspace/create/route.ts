import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getPlanFor } from "@/lib/plans";

// Colonnes optionnelles pas forcément migrées : si l'insert échoue parce que la
// colonne n'existe pas encore (PostgREST PGRST204 / Postgres 42703), on la retire
// et on réessaie — la création de client ne casse jamais faute de migration.
// Le repli tenait une LISTE FERMÉE de colonnes tolérées. Toute colonne absente
// hors de cette liste faisait échouer la création en entier — et surtout, la
// liste ne pouvait pas suivre : elle ne contenait ni `banner_url`, ni
// `brand_icon_url`, ni `brand_fonts`. C'est la même famille de défaut que celle
// qui a fait échouer l'enregistrement de la charte pendant des semaines sans
// que personne puisse le nommer (cf. migration 026).
//
// On lit donc le nom de la colonne DANS le message de PostgREST, quelle qu'elle
// soit, et on la retire. Les colonnes abandonnées sont journalisées : le repli
// ne doit jamais faire oublier qu'une migration manque.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertWorkspace(client: any, payload: Record<string, unknown>) {
  const p = { ...payload };
  const abandonnees: string[] = [];
  for (let i = 0; i < 12; i++) {
    const res = await client.from("workspaces").insert(p).select().single();
    if (!res.error) {
      if (abandonnees.length) {
        console.error(`[workspace/create] colonnes absentes en base, ignorées : ${abandonnees.join(", ")} — migration 026 à appliquer`);
      }
      return res;
    }
    const msg = `${res.error.message ?? ""} ${res.error.details ?? ""}`;
    const missing = msg.match(/'([a-z0-9_]+)' column/i)?.[1];
    // On ne retire jamais une colonne indispensable : sans `name` ni `user_id`,
    // la ligne créée ne vaudrait rien et l'échec doit remonter.
    if (!missing || !(missing in p) || missing === "name" || missing === "user_id") return res;
    abandonnees.push(missing);
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
      "primary_color", "secondary_color", "accent_color", "brand_colors",
      "logo_url", "logo_dark_url", "brand_assets", "brand_icon_url",
      "font_family", "font_primary_url", "font_secondary", "font_secondary_url", "brand_fonts",
      "subtitle_style_id", "subtitle_custom", "subtitle_pos", "subtitle_max_words",
    ] as const;
    for (const field of optionalFields) {
      if (body[field] !== undefined) payload[field] = body[field];
    }

    if (!payload.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // ── 3b. Bridage par offre : limite de clients ───────────────────────────
    // On lit l'OFFRE, pas seulement le type de compte : Starter est un compte
    // solo qui n'a droit qu'à UN client. Compter sur account_type seul lui
    // donnerait les six de Studio.
    // current_plan peut manquer si la migration 027 n'est pas passée : dans ce
    // cas getPlanFor retombe sur account_type, et la limite est celle de Studio.
    let settings: { account_type?: string | null; current_plan?: string | null } | null = null;
    const parOffre = await supabase
      .from("user_settings")
      .select("account_type, current_plan")
      .eq("user_id", userId)
      .maybeSingle();
    if (parOffre.error) {
      console.error("[workspace/create] current_plan illisible, repli sur account_type :", parOffre.error.message);
      const parType = await supabase
        .from("user_settings")
        .select("account_type")
        .eq("user_id", userId)
        .maybeSingle();
      settings = parType.data;
    } else {
      settings = parOffre.data;
    }
    const plan = getPlanFor(settings);
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
