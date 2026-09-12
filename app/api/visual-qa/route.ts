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
/** Ce qui vaut pour les deux métiers : on ne cherche pas un défaut à tout prix,
 *  et on n'en excuse pas un qu'on a vu.
 *
 *  LA BARRE A DEUX CÔTÉS, et la première version n'en avait qu'un. Écrite pour
 *  corriger un juge qui inventait des reproches, elle disait quatre fois de ne
 *  rien signaler et jamais de signaler. Résultat mesuré au banc : témoins
 *  propres gardés 4/4, défauts plantés rejetés 0/2. Le pendule était passé de
 *  l'autre côté, et un juge qui garde tout ne sert à rien. */
const BARRE = [
  '',
  'LA BARRE, et elle compte autant que le reste. Elle a DEUX côtés :',
  '- Un rendu correct est le cas NORMAL. N\'invente jamais un reproche pour',
  '  justifier une réponse : « rien à redire » est une réponse ATTENDUE.',
  '- Un défaut que tu ne saurais pas montrer du doigt n\'est pas un défaut.',
  '- MAIS taire un défaut que tu as vu est la faute SYMÉTRIQUE, et elle coûte',
  '  plus cher : elle envoie à un client un visuel qu\'il ne peut pas publier.',
  '  Si tu peux le localiser, dis-le. L\'indulgence n\'est pas de la prudence.',
  '- Ne cherche pas l\'équilibre entre les deux. Ni quota de défauts, ni quota de',
  '  compliments : tu regardes, et tu rapportes exactement ce qui est là.',
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
      // LE VERDICT N'EST PLUS ÉCRIT PAR LE MODÈLE, IL EST DÉDUIT DE SES CONSTATS.
      //
      // Mesuré au banc : témoins propres gardés 4/4, défauts plantés rejetés
      // 0/2. Le juge gardait TOUT, y compris un texte à 8 px du bord et un
      // second texte posé sur le premier. Un juge qui garde tout est aussi
      // inutile qu'un juge qui rejette tout.
      //
      // La cause n'était pas son oeil, elle était dans le partage du travail.
      // On lui demandait à la fois de CONSTATER et de TRANCHER, et tout le
      // reste de la consigne (la BARRE, la liste de ce qui n'est pas un défaut,
      // « un visuel quelconque se GARDE ») pèse sur le mot final. Un modèle
      // répond bien à « ce texte est-il lisible, oui ou non » et mal à « dois-je
      // rejeter ce travail », où la politesse l'emporte.
      //
      // Il ne rend donc plus que ses CONSTATS, axe par axe. La conséquence se
      // calcule ici, et elle ne peut plus être adoucie.
      const charte = critere(parsed.charte);
      const tenue = critere(parsed.tenue);
      // ADN et FIL disent « ce n'est pas idéal pour cette marque », jamais « ce
      // n'est pas montrable » : ils ne font pas tomber un visuel, sinon un
      // client au compte encore maigre ne verrait jamais rien.
      const rejete = !charte.ok || !tenue.ok || parsed.verdict === 'rejeter';
      return NextResponse.json({
        mode: 'jugement',
        verdict: rejete ? 'rejeter' : 'garder',
        charte,
        adn: critere(parsed.adn),
        fil: critere(parsed.fil),
        tenue,
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
    '   DEUX ERREURS À NE PLUS FAIRE, elles ont fait rejeter des compositions justes :',
    '   · LES POLICES DE GESTE. Une écriture MANUSCRITE, une CONDENSÉE d\'affiche, un',
    '     SERIF de presse : ce sont des gestes de graphiste, pas des polices de charte.',
    '     Une charte de client n\'en fournit presque jamais, et une composition a le',
    '     droit d\'en poser où son dessin le demande. Ne les signale JAMAIS, même quand',
    '     la charte liste d\'autres polices et même sur plusieurs blocs à la fois : une',
    '     composition qui OPPOSE un serif et une grotesque le fait exprès, c\'est son',
    '     sujet. La seule infraction typographique est une police quelconque à la place',
    '     de la police de titre de la marque SUR LE TITRE.',
    '   · LES COULEURS QU\'ON N\'A PAS CHOISIES. Tu ne juges que les couleurs POSÉES par',
    '     la composition : couleur d\'un texte, d\'un aplat, d\'un filet, d\'une pastille.',
    '     Les couleurs d\'une IMAGE ne sont jamais une infraction — ni la photo, ni un',
    '     badge illustré, ni un autocollant, ni un logo, ni une vignette. Elles viennent',
    '     du fichier, personne ne les a choisies dans la charte, et les reprocher revient',
    '     à reprocher au burger d\'être doré.',
    '2. ADN — le visuel ressemble-t-il à ce que la mesure dit de la marque (registre,',
    '   rapport au texte sur photo) ?',
    '3. FIL — pourrait-il être publié à la suite de ce que cette marque publie déjà,',
    '   sans détonner ?',
    '4. TENUE — le visuel tient-il debout : rien de coupé par un bord, rien d\'illisible,',
    '   rien qui se marche dessus par accident, le sujet de la photo pas masqué.',
    '',
    '   LE TEST DE LA TENUE EST LA LECTURE, jamais la géométrie. Deux blocs qui se',
    '   touchent et se lisent tous les deux vont bien ; deux blocs dont une lettre en',
    '   croise une autre au point qu\'on ne sait plus ce qui est écrit, non. Pose-toi la',
    '   question dans cet ordre, à chaque bloc de texte :',
    '',
    '   a) EST-CE QUE JE LIS CE MOT ? Lis-le vraiment, mot à mot. Si une lettre est',
    '      barrée par une autre lettre, un bord ou une forme, et que tu dois deviner :',
    '      c\'est un défaut, et tu dis LEQUEL des mots est touché.',
    '      « COUPÉ » VEUT DIRE TRANCHÉ, pas « proche du bord ». Un mot n\'est coupé que',
    '      si des lettres sont réellement SECTIONNÉES par le bord de l\'image : il en',
    '      manque un morceau, tu vois la moitié d\'un jambage. Un bloc posé bas, un texte',
    '      qui approche le bord à quelques millimètres, une ligne dans le dernier',
    '      dixième de l\'image : ce sont des placements, et les compositions ancrent',
    '      volontiers leur pied de page tout en bas. Si tu lis le mot en entier, il',
    '      n\'est pas coupé. Ne le signale pas.',
    '   b) EST-CE QUE LE MOT DISPARAÎT DANS LE FOND ? Attention, c\'est la question la',
    '      plus facile à poser trop haut, et un juge trop sévère fait autant de dégâts',
    '      qu\'un juge aveugle.',
    '      LE TEST EST BINAIRE : tu viens de lire le mot, ou tu ne le lis pas. Si tu',
    '      l\'as lu, il est lisible, POINT. Un contraste que tu aurais souhaité meilleur',
    '      n\'est pas un défaut de tenue — tu n\'es pas là pour améliorer un visuel, tu es',
    '      là pour dire ce qui est illisible.',
    '      LE BLANC SUR PHOTO EST LA SOLUTION DE LA MAISON, et la bonne : du texte blanc',
    '      posé sur une image est le cas NORMAL de ce produit. Une photo n\'est jamais',
    '      uniformément sombre. Qu\'une zone plus claire passe derrière une lettre ou deux,',
    '      qu\'un reflet ou un éclat traverse le bas d\'un mot, ne rend RIEN illisible et',
    '      ne se signale pas. Les compositions posent d\'ailleurs souvent un halo ou un',
    '      voile sous le texte : c\'est déjà la réponse à cette question.',
    '      LE DÉFAUT, c\'est le mot qui SE CONFOND : ses lettres ont la même valeur que ce',
    '      qu\'il y a derrière sur toute leur hauteur, et il faut deviner ce qui est écrit',
    '      au lieu de le lire. Du texte sombre sur une zone sombre, du blanc sur un ciel',
    '      blanc, une couleur de charte sur un aplat de la même famille. Là, dis-le.',
    '      Et dis aussi ce qui manque : un voile sous le texte, ou un aplat de la charte',
    '      derrière lui. C\'est ce qui permet de réparer au lieu de rejuger le dessin.',
    '   c) EST-CE QUE LE TEXTE EST DANS SON BLOC ? Un texte qui déborde de l\'aplat, de la',
    '      pastille ou du cartouche censé le porter, ou qui flotte à côté au lieu d\'être',
    '      dedans, est un défaut : le fond a été dessiné POUR lui.',
    '',
    '   Quand un contraste manque, dis-le comme un rapport de couleurs : « titre sombre',
    '   sur le bas de photo sombre », « prix blanc sur l\'aplat jaune ». C\'est ce qui',
    '   permet de retrouver la cause dans la palette, au lieu de rejuger le dessin.',
    '',
    'CE QUI N\'EST PAS UN DÉFAUT, et c\'est le point sur lequel on se trompe le plus :',
    '- POSER UN OBJET sur la photo (pastille d\'angle, autocollant, tampon de travers,',
    '  étiquette, badge) est un parti pris de graphiste, même s\'il couvre une partie de',
    '  l\'image. Écrire EN TRAVERS du sujet, ça, c\'est un défaut. La différence est là.',
    '- Un aplat, un cartouche ou une bande de couleur derrière le texte : c\'est du',
    '  vocabulaire de marque. La PRÉSENCE de l\'aplat n\'est jamais le défaut. Ce qui en',
    '  est un, c\'est le texte qui ne se détache pas de CET aplat-là (voir 4b) : le',
    '  cartouche est là pour porter le mot, pas pour l\'avaler.',
    '- Deux calques superposés VOLONTAIREMENT : c\'est le MÊME mot en deux exemplaires',
    '  (un texte-autocollant est fait d\'un calque plein et d\'un calque de contour, ils',
    '  doivent se superposer exactement ; un écho répète le mot en décalé ; un mot',
    '  manuscrit se pose sur un mot barré). Deux textes DIFFÉRENTS qui se croisent ne',
    '  sont jamais un parti pris : c\'est l\'accident que tu dois voir.',
    '- Une composition asymétrique, un mot qui déborde du cadre, un titre très gros :',
    '  ce sont des intentions, pas des accidents.',
    ...BARRE,
    '',
    'TU NE PRONONCES AUCUN VERDICT, et ce n\'est pas une formalité : on ne te demande',
    'pas si ce travail mérite d\'être rejeté, on te demande CE QUE TU VOIS. La suite ne',
    't\'appartient pas. Réponds donc à quatre questions fermées, sans chercher à peser',
    'les conséquences de tes réponses.',
    '',
    'QUAND « ok » VAUT false, précisément :',
    '- charte : une couleur ou une police POSÉE par la composition est étrangère à la',
    '  marque. Les polices de GESTE (manuscrite, condensée, serif) ne comptent pas.',
    '- tenue : au moins un mot est ILLISIBLE au sens strict — coupé, croisé par un autre',
    '  texte, ou confondu avec son fond au point qu\'il faut le deviner. Un seul mot',
    '  suffit, ce n\'est pas une moyenne. Mais un mot que tu as LU n\'est pas illisible,',
    '  même si tu lui aurais souhaité plus de contraste : « perfectible » met ok à TRUE.',
    '- adn / fil : le visuel ne ressemble pas à ce que cette marque publie. Ces deux-là',
    '  disent « pas idéal », jamais « pas montrable » : sois exigeant sans être sévère.',
    '',
    'Un visuel simplement QUELCONQUE a ses quatre « ok » à true : être ordinaire n\'est',
    'pas un défaut. Mais un mot qu\'on ne peut pas lire met « tenue » à false, même si le',
    'reste de l\'image est réussi, et même si tu devines ce qui était écrit.',
    '',
    'Réponds UNIQUEMENT avec ce JSON, rien d\'autre :',
    '{ "charte": { "ok": true|false, "note": "une phrase" },',
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
