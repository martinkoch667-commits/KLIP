import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Auth requise : empêche l'abus du quota Gemini par des appels anonymes.
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const { prompt, referenceImage } = await request.json();

    // Build parts: optional reference image + text prompt
    type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
    const parts: Part[] = [];
    if (typeof referenceImage === 'string' && referenceImage.startsWith('data:')) {
      const [header, data] = referenceImage.split(',');
      const mimeType = header.replace('data:', '').replace(';base64', '');
      parts.push({ inlineData: { mimeType, data } });
    }
    parts.push({ text: prompt });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE']
          }
        })
      }
    );

    const data = await response.json();
    console.log('IA response:', JSON.stringify(data).substring(0, 500));

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'Erreur IA' }, { status: 500 });
    }

    const images: string[] = (data.candidates?.[0]?.content?.parts ?? [])
      .filter((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData)
      .map((p: { inlineData: { mimeType: string; data: string } }) =>
        `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`
      );

    return NextResponse.json({ images });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('Generate image error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
