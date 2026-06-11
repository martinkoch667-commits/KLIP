import { NextResponse } from "next/server";

// Cache the font list for 24 h at the CDN / ISR level
export const revalidate = 86400;

export interface GFont {
  family: string;
  category: string;
}

export async function GET() {
  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  if (!apiKey) {
    console.error("[google-fonts] GOOGLE_FONTS_API_KEY is not set");
    return NextResponse.json({ error: "API key missing" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) throw new Error(`Google API HTTP ${res.status}`);

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
    return NextResponse.json({ error: "Failed to fetch fonts" }, { status: 502 });
  }
}
