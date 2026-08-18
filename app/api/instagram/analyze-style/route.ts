import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { generateAiText } from "@/lib/ai-text";
import { openToken } from "@/lib/token-crypto";

export const runtime = "nodejs";

interface IGMedia {
  id: string;
  caption?: string;
  media_type?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  permalink?: string;
}

// POST /api/instagram/analyze-style — analyse le style de communication du compte
// connecté à partir des dernières légendes publiées, et propose des pistes.
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await request.json();
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId requis" }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { data: ws } = await supabase
      .from("workspaces")
      .select("name, sector, instagram_access_token")
      .eq("id", workspaceId)
      .single();

    if (!ws?.instagram_access_token) {
      return NextResponse.json({ error: "Compte Instagram non connecté" }, { status: 400 });
    }
    const token = (openToken(ws.instagram_access_token) ?? "").trim();

    // ── 1. Récupère les dernières publications (avec légendes + stats si dispo) ──
    const fetchMedia = async (fields: string): Promise<{ data?: IGMedia[]; error?: unknown }> => {
      const res = await fetch(`https://graph.instagram.com/me/media?fields=${fields}&limit=18&access_token=${token}`);
      return res.json();
    };
    // Les compteurs like/commentaires ne sont exposés que sur certains comptes (pro).
    let mData = await fetchMedia("id,caption,media_type,timestamp,like_count,comments_count,permalink");
    if (mData.error || !mData.data) {
      mData = await fetchMedia("id,caption,media_type,timestamp,permalink");
    }
    const posts = (mData.data ?? []).filter((m) => (m.caption ?? "").trim().length > 0);

    if (posts.length < 2) {
      return NextResponse.json(
        { error: "Pas assez de publications avec légende pour analyser le style (2 minimum)." },
        { status: 422 },
      );
    }

    // ── 2. Prépare le corpus pour Claude ──────────────────────────────────────
    const corpus = posts
      .slice(0, 15)
      .map((p, i) => {
        const stats = [
          typeof p.like_count === "number" ? `${p.like_count} j'aime` : null,
          typeof p.comments_count === "number" ? `${p.comments_count} commentaires` : null,
        ].filter(Boolean).join(" · ");
        return `POST ${i + 1}${stats ? ` (${stats})` : ""} :\n${(p.caption ?? "").trim()}`;
      })
      .join("\n\n———\n\n");

    const hasStats = posts.some((p) => typeof p.like_count === "number");

    const system = `Tu es consultant senior en stratégie de contenu Instagram pour des marques premium.
Tu analyses la ligne éditoriale RÉELLE d'un compte à partir de ses légendes publiées, avec bienveillance et exigence.
Ton rôle : aider un community manager à progresser — jamais le juger. Sois concret, spécifique, actionnable.
Tu réponds TOUJOURS en français et UNIQUEMENT avec le JSON demandé.`;

    const user = `Marque : ${ws.name || "Non précisé"}${ws.sector ? ` — secteur : ${ws.sector}` : ""}.
Voici ${posts.length} légendes récemment publiées sur ce compte${hasStats ? " (avec quelques statistiques d'engagement)" : ""} :

${corpus}

Analyse la manière dont cette marque communique (ton, structure, longueur, usage des emojis/hashtags, angle, ce qui déclenche le plus d'engagement si les stats sont fournies).

Réponds UNIQUEMENT avec ce JSON valide, sans rien avant ni après :
{
  "summary": "2-3 phrases synthétisant le style de communication actuel",
  "strengths": ["point fort concret 1", "point fort 2", "point fort 3"],
  "improvements": ["axe d'amélioration précis et actionnable 1", "axe 2", "axe 3"],
  "suggestedDescriptionStyle": "Consignes de style prêtes à l'emploi pour guider une IA à écrire de futures légendes dans CETTE voix, tout en intégrant les améliorations (3-6 phrases, à la 2e personne, impératif)",
  "bestCaption": "recopie ici, à l'identique, la meilleure légende existante parmi celles fournies (celle qui incarne le mieux la marque)"
}`;

    let raw: string;
    try {
      raw = await generateAiText({
        userId: session.user.id,
        system,
        userText: user,
        temperature: 0.6,
        maxTokens: 1200,
      });
    } catch (err) {
      console.error("[analyze-style] API error:", err);
      return NextResponse.json({ error: "Analyse impossible pour le moment" }, { status: 500 });
    }

    let parsed: Record<string, unknown> = {};
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch {
      return NextResponse.json({ error: "Réponse IA illisible" }, { status: 500 });
    }

    const asStrArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];

    return NextResponse.json({
      postsAnalyzed: posts.length,
      hasStats,
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      strengths: asStrArr(parsed.strengths),
      improvements: asStrArr(parsed.improvements),
      suggestedDescriptionStyle: typeof parsed.suggestedDescriptionStyle === "string" ? parsed.suggestedDescriptionStyle : "",
      bestCaption: typeof parsed.bestCaption === "string" ? parsed.bestCaption : "",
    });
  } catch (err) {
    console.error("[analyze-style] unexpected:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
