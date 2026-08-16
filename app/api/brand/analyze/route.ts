import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { analyzeBrandSite } from "@/lib/brandFromSite";
import { generateAiText } from "@/lib/ai-text";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/brand/analyze — lit le site d'une marque et propose de quoi
// préremplir sa charte : couleurs, polices, logo, secteur, description et ton.
// Tout est une PROPOSITION : la réponse alimente un formulaire que l'utilisateur
// relit et corrige. Rien n'est écrit en base ici.
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  let url = "";
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Adresse manquante" }, { status: 400 });
  }

  const site = await analyzeBrandSite(url);
  if (!site) {
    return NextResponse.json(
      { error: "Site introuvable ou injoignable. Vérifiez l'adresse." },
      { status: 422 },
    );
  }

  // Le texte de la page sert à déduire ce qu'aucune règle ne donne : le secteur,
  // le ton, une description tenable. On échoue en douceur — les couleurs et les
  // polices, elles, sont déjà là et n'ont pas besoin du modèle.
  let voice: {
    sector?: string;
    description?: string;
    tone?: string;
    wordsToUse?: string[];
    wordsToAvoid?: string[];
  } = {};

  if (site.sampleText && site.sampleText.length > 200) {
    try {
      const raw = await generateAiText({
        userId: session.user.id,
        system:
          "Tu analyses le site d'une marque pour préremplir sa fiche de marque. " +
          "Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, sans balises de code. " +
          'Schéma : {"sector":string,"description":string,"tone":string,"wordsToUse":string[],"wordsToAvoid":string[]}. ' +
          "sector : le secteur d'activité en 1 à 3 mots. " +
          "description : ce que fait la marque et pour qui, 2 phrases maximum, à la troisième personne. " +
          "tone : le ton de communication en 2 à 4 adjectifs séparés par des virgules. " +
          "wordsToUse : jusqu'à 6 mots ou expressions caractéristiques réellement présents sur le site. " +
          "wordsToAvoid : jusqu'à 4 mots qui jureraient avec ce positionnement. " +
          "Écris en français. N'invente rien qui ne soit pas étayé par le texte fourni.",
        userText:
          `Nom supposé : ${site.name ?? "inconnu"}\n` +
          `Description balisée : ${site.description ?? "aucune"}\n\n` +
          `Texte du site :\n${site.sampleText}`,
        temperature: 0.2,
        maxTokens: 700,
      });
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      if (json) {
        const p = JSON.parse(json);
        voice = {
          sector: typeof p.sector === "string" ? p.sector.slice(0, 60) : undefined,
          description: typeof p.description === "string" ? p.description.slice(0, 400) : undefined,
          tone: typeof p.tone === "string" ? p.tone.slice(0, 120) : undefined,
          wordsToUse: Array.isArray(p.wordsToUse) ? p.wordsToUse.filter((w: unknown) => typeof w === "string").slice(0, 6) : undefined,
          wordsToAvoid: Array.isArray(p.wordsToAvoid) ? p.wordsToAvoid.filter((w: unknown) => typeof w === "string").slice(0, 4) : undefined,
        };
      }
    } catch (err) {
      // Le modèle n'est pas indispensable : on rend ce qu'on a extrait du CSS.
      console.error("[brand/analyze] lecture du ton impossible:", err);
    }
  }

  return NextResponse.json({
    url: site.url,
    name: site.name,
    description: voice.description ?? site.description,
    sector: voice.sector,
    tone: voice.tone,
    wordsToUse: voice.wordsToUse,
    wordsToAvoid: voice.wordsToAvoid,
    colors: site.colors,
    fonts: site.fonts,
    logoUrl: site.logoUrl,
    logoCandidates: site.logoCandidates,
    heroImage: site.heroImage,
    iconUrl: site.iconUrl,
  });
}
