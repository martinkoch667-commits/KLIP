import { NextResponse } from "next/server";
import { FONT_CATALOG, CATALOG_FAMILIES } from "@/lib/fontCatalog";

// Cache the font list for 24 h at the CDN / ISR level
export const revalidate = 86400;

export interface GFont {
  family: string;
  category: string;
}

// LE CATALOGUE MAISON D'ABORD.
//
// Cette route renvoyait la liste Google triée par popularité : le sélecteur de
// charte ouvrait donc sur Roboto, Open Sans, Montserrat, Lato — exactement les
// polices qui font qu'un visuel « sent l'IA ». Les familles retenues par KLIP
// (dont les Fontshare, absentes de chez Google) passent devant ; la liste
// Google complète reste dessous, pour la charte qui nomme une police précise.
const CATALOG_LIST: GFont[] = CATALOG_FAMILIES.map(family => ({
  family,
  category: FONT_CATALOG[family].gestures[0] ?? "sans-serif",
}));

const FALLBACK_FONTS: GFont[] = CATALOG_LIST;

export async function GET() {
  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  if (!apiKey) {
    console.warn("[google-fonts] GOOGLE_FONTS_API_KEY not set — returning fallback list");
    return NextResponse.json(FALLBACK_FONTS);
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) {
      console.error(`[google-fonts] Google API returned HTTP ${res.status}`);
      return NextResponse.json(FALLBACK_FONTS);
    }

    const raw = (await res.json()) as {
      items: Array<{ family: string; category: string }>;
    };

    const deja = new Set(CATALOG_FAMILIES.map(f => f.toLowerCase()));
    const google: GFont[] = raw.items
      .filter((f) => !deja.has(f.family.toLowerCase()))
      .map((f) => ({ family: f.family, category: f.category }));

    return NextResponse.json([...CATALOG_LIST, ...google]);
  } catch (err) {
    console.error("[google-fonts]", err);
    return NextResponse.json(FALLBACK_FONTS);
  }
}
