import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// POST /api/visual-qa
// Boucle d'auto-correction (Option A) : reçoit le RENDU du post + la liste des calques texte,
// demande à Claude (vision) de repérer les défauts visuels et renvoie des corrections bornées.
// Corrections autorisées UNIQUEMENT : fontSize (réduction), position (x/y), texte raccourci.
// JAMAIS la police ni la couleur (charte préservée).

type Layer = { id: string; role?: string; text?: string; fontSize?: number; x?: number; y?: number; width?: number };

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Clé API manquante' }, { status: 500 });

    const { image, layers, stageW, stageH } = await request.json();
    if (typeof image !== 'string') return NextResponse.json({ error: 'image requise' }, { status: 400 });

    const m = image.match(/^data:(image\/\w+);base64,([\s\S]+)$/);
    const mediaType = m?.[1] ?? 'image/png';
    const b64 = m?.[2] ?? image;

    const layerList: Layer[] = Array.isArray(layers) ? layers : [];
    const layerLines = layerList.map(l =>
      `- id="${l.id}" rôle=${l.role ?? '—'} taille=${l.fontSize}px pos=(${l.x},${l.y}) largeur=${l.width} texte="${(l.text ?? '').slice(0, 80)}"`
    ).join('\n');

    const prompt = [
      `Tu es un directeur artistique. Voici le RENDU FINAL d'un post (cadre ${stageW}×${stageH} px).`,
      'Calques texte présents :',
      layerLines || '(aucun)',
      '',
      'Analyse l\'IMAGE et repère UNIQUEMENT les défauts objectifs :',
      '- texte coupé / qui déborde du cadre',
      '- texte qui en chevauche un autre',
      '- texte trop petit/illisible ou écrasé',
      '- texte qui sort de sa zone visible',
      '',
      'Pour CHAQUE défaut, propose une correction MINIMALE parmi : réduire fontSize, déplacer (x/y), ou raccourcir le texte (garde le sens).',
      'Ne change JAMAIS la police ni la couleur. Si tout est bon, renvoie ok=true sans issues.',
      '',
      'Réponds UNIQUEMENT avec ce JSON, rien d\'autre :',
      '{ "ok": true|false, "issues": [ { "id": "<id calque>", "problem": "...", "fix": { "fontSize"?: number, "x"?: number, "y"?: number, "text"?: "..." } } ] }',
    ].join('\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 700,
        temperature: 0.2,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
          { type: 'text', text: prompt },
        ] }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[visual-qa] API error:', data);
      return NextResponse.json({ error: 'Analyse échouée' }, { status: 500 });
    }

    const raw: string = data.content?.[0]?.text ?? '';
    let result: { ok: boolean; issues: unknown[] } = { ok: true, issues: [] };
    try {
      const jm = raw.match(/\{[\s\S]*\}/);
      if (jm) result = JSON.parse(jm[0]);
    } catch { /* garde le défaut ok=true */ }

    return NextResponse.json({ ok: !!result.ok, issues: Array.isArray(result.issues) ? result.issues : [] });
  } catch (e) {
    console.error('[visual-qa] error:', e);
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 });
  }
}
