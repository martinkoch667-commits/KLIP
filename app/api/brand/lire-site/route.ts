import { NextRequest, NextResponse } from "next/server";
import { analyzeBrandSite } from "@/lib/brandFromSite";

/* POST /api/brand/lire-site — lecture d'un site SANS session.
 *
 * POURQUOI UNE SECONDE ROUTE. `/api/brand/analyze` exige une session, et c'est
 * juste : elle appelle un modèle pour déduire le secteur, le ton et une
 * description, donc chaque requête coûte. Or le parcours d'essai demande
 * l'adresse du site AVANT qu'un compte existe : la personne tapait son adresse
 * et recevait des valeurs d'exemple, ce qui est exactement la promesse non
 * tenue qu'on cherche à éviter au premier écran.
 *
 * CE QU'ELLE FAIT, ET RIEN DE PLUS. `analyzeBrandSite` ne fait AUCUN appel
 * d'IA : elle ouvre la page publique, lit les feuilles de style et en extrait
 * les couleurs, les polices, le logo et le nom. C'est gratuit et rapide, donc
 * ouvrable sans compte. La lecture du ton et du secteur, elle, reste derrière
 * `/api/brand/analyze` et sa session.
 *
 * GARDE-FOU. Compteur en mémoire par adresse IP, même principe que
 * `lib/ai-guard` : ça n'arrête pas un attaquant déterminé, ça arrête une
 * boucle partie en vrille et l'usage automatisé le plus grossier. La route ne
 * coûte rien en IA, le risque est donc la bande passante, pas la facture.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const FENETRE_MS = 60_000;
const MAX_PAR_MINUTE = 10;
const compteurs = new Map<string, { n: number; finFenetre: number }>();

function tropDeRequetes(ip: string): boolean {
  const maintenant = Date.now();
  const seau = compteurs.get(ip);
  if (!seau || maintenant > seau.finFenetre) {
    compteurs.set(ip, { n: 1, finFenetre: maintenant + FENETRE_MS });
    return false;
  }
  seau.n += 1;
  return seau.n > MAX_PAR_MINUTE;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnue";
  if (tropDeRequetes(ip)) {
    return NextResponse.json(
      { error: "Trop de lectures d'affilée. Réessayez dans une minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

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

  return NextResponse.json({
    url: site.url,
    name: site.name,
    description: site.description,
    colors: site.colors,
    fonts: site.fonts,
    logoUrl: site.logoUrl,
    iconUrl: site.iconUrl,
  });
}
