import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateAiText } from '@/lib/ai-text';

// Un appel IA avec image dépasse volontiers les 10 s par défaut de Vercel :
// sans cette marge, la requête est coupée en plein travail.
export const maxDuration = 60;

/* POST /api/visual-qa — le juge du rendu. DEUX MÉTIERS, à ne pas confondre.
 *
 * `mode: 'retouche'` (défaut) — celui d'origine, appelé par l'éditeur sur une
 *   composition TEXTE SUR PHOTO. Il corrige : taille, position, largeur, voile.
 *   Jamais la police ni la couleur (charte préservée).
 *
 * `mode: 'jugement'` — nouveau. Appelé sur une composition DESSINÉE (recette de
 *   `designSystem.ts`), il ne déplace RIEN : il dit si le visuel est montrable.
 *   Pourquoi un second métier plutôt qu'un réglage du premier : les règles de la
 *   retouche (« jamais deux textes qui se chevauchent », « pas d'aplat derrière
 *   le texte ») défont précisément ce qui fait un visuel de marque. Le tampon de
 *   travers, l'autocollant à contour épais (deux calques, plein puis contour),
 *   la pastille d'angle sont des PARTIS PRIS, pas des défauts. C'est la raison
 *   pour laquelle l'audit était jusqu'ici sauté sur ces compositions, donc pour
 *   laquelle aucun visuel généré ne passait devant un juge.
 *
 * LE BUG CORRIGÉ DES DEUX CÔTÉS. L'ancienne consigne finissait par « Sinon
 * corrige TOUT ce qui peut être amélioré » : `ok=true` était inatteignable, et
 * un témoin propre récoltait deux défauts inventés, aux deux paliers de qualité
 * (mesuré le 2026-09-03). Un audit qui ne sait jamais dire « c'est bon » n'est
 * pas un audit, c'est un générateur de corrections. Les deux consignes posent
 * maintenant une BARRE explicite et disent qu'un rendu correct est le cas normal.
 */

type Layer = { id: string; role?: string; text?: string; fontSize?: number; x?: number; y?: number; width?: number };

type Charte = {
  name?: string; sector?: string; tone?: string;
  colors?: string[]; fonts?: string[];
};

type Adn = {
  colorwayId?: string; typeIdentityId?: string;
  register?: string; textOnPhoto?: string;
  vibes?: string[]; motifs?: string[];
};

type Recette = { id?: string; name?: string; family?: string; zone?: string };

/** Ce qui vaut pour les deux métiers : on ne cherche pas un défaut à tout prix. */
const BARRE = [
  '',
  'LA BARRE, et elle compte autant que le reste :',
  '- Un rendu correct est le cas NORMAL, pas l\'exception.',
  '- Ne signale QUE ce que tu peux localiser précisément ET qui gêne vraiment.',
  '- Un défaut que tu ne saurais pas montrer du doigt n\'est pas un défaut.',
  '- N\'invente jamais un reproche pour justifier une réponse : répondre « rien à',
  '  redire » est une réponse ATTENDUE, pas un échec de ta part.',
];

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await request.json();
    const { image, layers, stageW, stageH } = body;
    const mode: 'retouche' | 'jugement' = body?.mode === 'jugement' ? 'jugement' : 'retouche';
    if (typeof image !== 'string') return NextResponse.json({ error: 'image requise' }, { status: 400 });

    const prompt = mode === 'jugement'
      ? promptJugement(body.charte as Charte, body.adn as Adn, body.recette as Recette, stageW, stageH)
      : promptRetouche(Array.isArray(layers) ? layers : [], stageW, stageH);

    let raw: string;
    try {
      raw = await generateAiText({
        userId: session.user.id,
        userText: prompt,
        images: [image],
        temperature: 0.2,
        maxTokens: mode === 'jugement' ? 900 : 700,
        // JUGER UN RENDU EST UN TRAVAIL DE JUGEMENT, PAS UNE EXTRACTION.
        // Mesuré le 2026-09-03 : au palier rapide, un titre posé à 8 px du bord
        // gauche passe inaperçu deux fois sur deux ; au palier de jugement il est
        // vu deux fois sur deux, avec la bonne cause.
        quality: 'high',
      });
    } catch (err) {
      console.error('[visual-qa] API error:', err);
      return NextResponse.json({ error: 'Analyse échouée' }, { status: 500 });
    }

    let parsed: Record<string, unknown> = {};
    try {
      const jm = raw.match(/\{[\s\S]*\}/);
      if (jm) parsed = JSON.parse(jm[0]);
    } catch { /* laissé vide : les défauts ci-dessous sont volontairement permissifs */ }

    if (mode === 'jugement') {
      // En cas de réponse illisible on GARDE le visuel : un juge muet ne doit pas
      // faire disparaître une composition correcte. Le doute profite au rendu,
      // l'inverse ferait perdre des visuels sans que personne ne sache pourquoi.
      const verdict = parsed.verdict === 'rejeter' ? 'rejeter' : 'garder';
      return NextResponse.json({
        mode: 'jugement',
        verdict,
        charte: critere(parsed.charte),
        adn: critere(parsed.adn),
        fil: critere(parsed.fil),
        tenue: critere(parsed.tenue),
        defauts: Array.isArray(parsed.defauts) ? parsed.defauts.slice(0, 6) : [],
      });
    }

    return NextResponse.json({
      ok: !!parsed.ok,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      scrim: parsed.scrim ?? null,
    });
  } catch (e) {
    console.error('[visual-qa] error:', e);
    return NextResponse.json({ error: 'Erreur analyse' }, { status: 500 });
  }
}

/** Un critère mal formé vaut « respecté » : voir la note sur le doute ci-dessus. */
function critere(v: unknown): { ok: boolean; note: string } {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return { ok: o.ok !== false, note: typeof o.note === 'string' ? o.note : '' };
  }
  return { ok: true, note: '' };
}

// ─── Mode jugement ────────────────────────────────────────────────────────────

function promptJugement(
  charte: Charte = {}, adn: Adn = {}, recette: Recette = {},
  stageW?: number, stageH?: number,
): string {
  const couleurs = (charte.colors ?? []).filter(Boolean).join(', ') || '(non fournies)';
  const polices = (charte.fonts ?? []).filter(Boolean).join(', ') || '(non fournies)';

  return [
    `Tu es directeur artistique. Voici un visuel de réseau social fini (${stageW ?? '?'}×${stageH ?? '?'} px).`,
    'Il a été composé pour une marque précise. Tu ne le corriges pas : tu dis s\'il est MONTRABLE à cette marque.',
    '',
    'LA MARQUE',
    `- Nom : ${charte.name || '(inconnu)'}`,
    `- Secteur : ${charte.sector || '(inconnu)'} · Ton : ${charte.tone || '(inconnu)'}`,
    `- Couleurs de charte : ${couleurs}`,
    `- Polices de charte : ${polices}`,
    adn.register || adn.textOnPhoto || (adn.motifs ?? []).length
      ? [
        'CE QUE LA MESURE DE SON COMPTE INSTAGRAM A RELEVÉ',
        adn.register ? `- Registre typographique : ${adn.register}` : '',
        adn.textOnPhoto ? `- Rapport au texte sur photo : ${adn.textOnPhoto}` : '',
        (adn.vibes ?? []).length ? `- Personnalité : ${(adn.vibes ?? []).join(', ')}` : '',
        (adn.motifs ?? []).length ? `- Motifs récurrents : ${(adn.motifs ?? []).join(', ')}` : '',
      ].filter(Boolean).join('\n')
      : 'Aucune mesure de compte disponible : ne juge pas les deux critères qui en dépendent, réponds ok=true et note vide.',
    recette.name ? `\nCOMPOSITION EMPLOYÉE : ${recette.name}${recette.family ? ` (famille ${recette.family}` : ''}${recette.zone ? `, écriture ${recette.zone})` : recette.family ? ')' : ''}` : '',
    '',
    'CE QUE TU JUGES, ET RIEN D\'AUTRE',
    '1. CHARTE — les couleurs et les polices POSÉES par la composition sont-elles celles de',
    '   la marque ? Les couleurs de la PHOTO ne comptent pas : elles ne sont pas un choix.',
    '2. ADN — le visuel ressemble-t-il à ce que la mesure dit de la marque (registre,',
    '   rapport au texte sur photo) ?',
    '3. FIL — pourrait-il être publié à la suite de ce que cette marque publie déjà,',
    '   sans détonner ?',
    '4. TENUE — le visuel tient-il debout : rien de coupé par un bord, rien d\'illisible,',
    '   rien qui se marche dessus par accident, le sujet de la photo pas masqué.',
    '',
    'CE QUI N\'EST PAS UN DÉFAUT, et c\'est le point sur lequel on se trompe le plus :',
    '- POSER UN OBJET sur la photo (pastille d\'angle, autocollant, tampon de travers,',
    '  étiquette, badge) est un parti pris de graphiste, même s\'il couvre une partie de',
    '  l\'image. Écrire EN TRAVERS du sujet, ça, c\'est un défaut. La différence est là.',
    '- Un aplat, un cartouche ou une bande de couleur derrière le texte : c\'est du',
    '  vocabulaire de marque, pas un problème de lisibilité.',
    '- Deux calques superposés VOLONTAIREMENT (un texte-autocollant est fait d\'un calque',
    '  plein et d\'un calque de contour ; ils doivent se superposer exactement).',
    '- Une composition asymétrique, un mot qui déborde du cadre, un titre très gros :',
    '  ce sont des intentions, pas des accidents.',
    ...BARRE,
    '',
    'Verdict « rejeter » UNIQUEMENT si un critère est franchement manqué : couleur ou',
    'police étrangère à la charte, texte coupé, texte illisible, sujet masqué. Un visuel',
    'simplement quelconque se GARDE.',
    '',
    'Réponds UNIQUEMENT avec ce JSON, rien d\'autre :',
    '{ "verdict": "garder"|"rejeter",',
    '  "charte": { "ok": true|false, "note": "une phrase" },',
    '  "adn":    { "ok": true|false, "note": "une phrase" },',
    '  "fil":    { "ok": true|false, "note": "une phrase" },',
    '  "tenue":  { "ok": true|false, "note": "une phrase" },',
    '  "defauts": ["défaut localisé", "..."] }',
  ].filter(Boolean).join('\n');
}

// ─── Mode retouche (celui de l'éditeur, contrat inchangé) ─────────────────────

function promptRetouche(layerList: Layer[], stageW?: number, stageH?: number): string {
  const layerLines = layerList.map(l =>
    `- id="${l.id}" rôle=${l.role ?? '—'} taille=${l.fontSize}px pos=(${l.x},${l.y}) largeur=${l.width} texte="${(l.text ?? '').slice(0, 80)}"`
  ).join('\n');

  return [
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
    'INTERDIT : changer la police ou la COULEUR du texte (charte). Le scrim/ombre sont neutres (noir), gérés côté app.',
    '',
    'DÉGRADÉ GLOBAL (très utile quand le texte est sur une zone CLAIRE/chargée, ex. blanc sur blanc) :',
    'tu peux assombrir une bande de l\'image avec un dégradé noir dégressif derrière la zone de texte.',
    'Renvoie alors "scrim": { "position": "bottom"|"top", "opacity": 0-100 }. Mets "none" si inutile.',
    ...BARRE,
    '- Concrètement : si le rendu ne présente aucun des défauts listés plus haut, réponds',
    '  ok=true, issues: [] et scrim "none". C\'est le cas le plus fréquent.',
    '',
    'Réponds UNIQUEMENT avec ce JSON, rien d\'autre :',
    '{ "ok": true|false, "scrim": { "position": "bottom"|"top"|"none", "opacity": number }, "issues": [ { "id": "<id calque>", "problem": "...", "fix": { "fontSize"?: number, "x"?: number, "y"?: number, "width"?: number, "align"?: "left|center|right", "text"?: "...", "scrim"?: true, "scrimOpacity"?: number, "shadow"?: true } } ] }',
  ].join('\n');
}
