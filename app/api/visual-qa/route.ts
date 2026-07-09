import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getAnthropicApiKeyForUser } from '@/lib/anthropic-key';

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

    const apiKey = await getAnthropicApiKeyForUser(session.user.id);
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
      `Tu es directeur artistique senior. Voici le RENDU FINAL d'un post (cadre ${stageW}×${stageH} px, origine en haut-gauche).`,
      'Calques texte présents :',
      layerLines || '(aucun)',
      '',
      'Évalue la COMPOSITION comme un graphiste pro et corrige pour un visuel optimal :',
      '- Placement : le texte est-il dans une zone CALME de l\'image (pas sur le visage/sujet/zone chargée) ? Marges respectées (ne pas coller aux bords) ?',
      '- Lisibilité : contraste suffisant avec le fond ? Sinon, ajoute un voile sombre (scrim) OU une ombre derrière le texte.',
      '- Hiérarchie : le titre doit dominer, les éléments alignés entre eux, espacés proprement (pas de chevauchement, pas d\'entassement).',
      '- Équilibre : la zone de texte forme un bloc cohérent, bien ancré (souvent bas ou haut), pas flottant au hasard.',
      '',
      'IMPORTANT : deux textes ne doivent JAMAIS se chevaucher. S\'ils se touchent, espace-les (y) ou réduis la taille.',
      '',
      'RÈGLES DE GRAPHISME (applique-les sévèrement) :',
      '- Marges : aucun texte collé/coupé par les bords (garde ~6% de marge), jamais coupé par les coins arrondis.',
      '- Ombre : une ombre portée ne se met QUE sur du texte CLAIR sur fond clair. Sur du texte FONCÉ, une ombre sombre est MOCHE → retire-la (fix.shadow=false).',
      '- Pas de gros bloc de couleur derrière le texte. Lisibilité = scrim dégradé ou ombre (sur texte clair).',
      '- Hiérarchie nette, alignements cohérents, équilibre (règle des tiers, respiration).',
      '- Contraste : si du texte FONCÉ est sur une zone chargée/sombre (illisible), passe-le en BLANC + ajoute un voile dégradé sombre. Ne laisse JAMAIS du texte illisible.',
      '- Ne place pas le texte sur le visage / le sujet principal.',
      '- Si une zone est laide/bancale, corrige-la (déplace, redimensionne, change la couleur de texte).',
      '',
      'Leviers de correction AUTORISÉS (par calque) :',
      '- fontSize (number) : ajuster la taille',
      '- x, y (number) : repositionner dans une meilleure zone / aligner / respecter les marges / éviter le chevauchement',
      '- width (number) : étirer/réduire la largeur de la zone de texte',
      '- align ("left"|"center"|"right")',
      '- shadow (true/false) : true = ajoute une ombre (texte clair seulement) ; false = RETIRE une ombre moche',
      '- text (string) : raccourcir si trop long (garder le sens)',
      '- scrim (bool) + scrimOpacity (0-100) : voile SOMBRE derrière ce texte pour la lisibilité',
      '- shadow (bool) : ombre portée de lisibilité',
      'INTERDIT : changer la police ou la COULEUR du texte (charte). Le scrim/ombre sont neutres (noir), gérés côté app.',
      '',
      'DÉGRADÉ GLOBAL (très utile quand le texte est sur une zone CLAIRE/chargée, ex. blanc sur blanc) :',
      'tu peux assombrir une bande de l\'image avec un dégradé noir dégressif derrière la zone de texte.',
      'Renvoie alors "scrim": { "position": "bottom"|"top", "opacity": 0-100 }. Mets "none" si inutile.',
      '',
      'Si la composition est déjà excellente, renvoie ok=true sans issues ni scrim. Sinon corrige TOUT ce qui peut être amélioré.',
      'Réponds UNIQUEMENT avec ce JSON, rien d\'autre :',
      '{ "ok": true|false, "scrim": { "position": "bottom"|"top"|"none", "opacity": number }, "issues": [ { "id": "<id calque>", "problem": "...", "fix": { "fontSize"?: number, "x"?: number, "y"?: number, "width"?: number, "align"?: "left|center|right", "text"?: "...", "scrim"?: true, "scrimOpacity"?: number, "shadow"?: true } } ] }',
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
    let result: { ok: boolean; issues: unknown[]; scrim?: unknown } = { ok: true, issues: [] };
    try {
      const jm = raw.match(/\{[\s\S]*\}/);
      if (jm) result = JSON.parse(jm[0]);
    } catch { /* garde le défaut ok=true */ }

    return NextResponse.json({
      ok: !!result.ok,
      issues: Array.isArray(result.issues) ? result.issues : [],
      scrim: result.scrim ?? null,
    });
  } catch (e) {
    console.error('[visual-qa] error:', e);
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 });
  }
}
