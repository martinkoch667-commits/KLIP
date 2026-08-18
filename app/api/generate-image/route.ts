import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { chargeImage } from '@/lib/ai-budget';

// Modèle de génération d'images, réglable sans toucher au code (AI_IMAGE_MODEL).
//
// Par défaut Nano Banana 2 Lite : génération suivante, et MOINS cher que le
// 2.5-flash-image qu'il remplace (~0,0336 $ contre 0,039 $ l'image en 1K).
// Ce dernier ferme le 2 octobre 2026, il ne fallait pas rester dessus.
//
// Pour comparer la qualité, il suffit de changer la variable :
//   gemini-3.1-flash-lite-image  ~0,0336 $  — défaut, le meilleur rapport
//   gemini-3.1-flash-image       ~0,045 $   — un cran au-dessus
//   gemini-3-pro-image           ~0,134 $   — nettement plus cher
const IMAGE_MODEL = process.env.AI_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-lite-image';

export async function POST(request: NextRequest) {
  try {
    // Auth requise : empêche l'abus du quota Gemini par des appels anonymes.
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    // Quotas du jour : celui du compte, puis le plafond global. Le garde-fou à
    // la minute, lui, vit dans le middleware.
    const budget = await chargeImage(session.user.id);
    if (!budget.allowed) {
      if (budget.reason === 'user') {
        console.warn(`[ai-budget] quota compte atteint : ${budget.userUsed}/${budget.userCap} pour ${session.user.id}.`);
        return NextResponse.json(
          {
            error: `Vous avez atteint votre limite de ${budget.userCap} images pour aujourd'hui. Elle repart à zéro demain.`,
            code: 'AI_USER_DAILY_CAP',
          },
          { status: 429 }
        );
      }
      console.error(`[ai-budget] plafond global atteint : ${budget.globalUsed}/${budget.globalCap} images aujourd'hui.`);
      return NextResponse.json(
        { error: "La génération d'images est momentanément indisponible. Réessayez demain.", code: 'AI_DAILY_CAP' },
        { status: 503 }
      );
    }

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
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
