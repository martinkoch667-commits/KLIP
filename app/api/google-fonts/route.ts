import { NextResponse } from "next/server";

// Cache the font list for 24 h at the CDN / ISR level
export const revalidate = 86400;

export interface GFont {
  family: string;
  category: string;
}

// Fallback list served when GOOGLE_FONTS_API_KEY is not set (local dev)
const FALLBACK_FONTS: GFont[] = [
  "Anton","Archivo Black","Barlow Condensed","Bebas Neue","DM Sans",
  "Exo 2","Fjalla One","Inter","Josefin Sans","Lato","Merriweather",
  "Montserrat","Nunito","Oswald","Outfit","Playfair Display",
  "Plus Jakarta Sans","Poppins","Raleway","Roboto Condensed","Rubik",
  "Space Grotesk","Syne","Ubuntu","Work Sans",
].map(f => ({ family: f, category: "sans-serif" }));

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

    const fonts: GFont[] = raw.items.map((f) => ({
      family: f.family,
      category: f.category,
    }));

    return NextResponse.json(fonts);
  } catch (err) {
    console.error("[google-fonts]", err);
    return NextResponse.json(FALLBACK_FONTS);
  }
}
