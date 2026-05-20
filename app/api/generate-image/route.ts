import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt }
            ]
          }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE']
          }
        })
      }
    );

    const data = await response.json();
    console.log('Gemini response:', JSON.stringify(data).substring(0, 500));

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'Erreur Gemini' }, { status: 500 });
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
