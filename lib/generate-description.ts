import { createClient } from '@supabase/supabase-js';
import { generateAiText } from '@/lib/ai-text';

// Logique de génération de légende/texte visuel, extraite de
// app/api/generate-description/route.ts pour être réutilisable à la fois par
// cette route (session cookie) et par l'outil MCP generate_caption (token OAuth
// résolu en userId) — une seule source de vérité pour le prompt et le parsing.

const PROMPT_TEMPLATE = `Tu écris les légendes Instagram DE [NOM_CLIENT] ([SECTEUR]), comme un membre de l'équipe qui connaît la marque depuis des années. Tu n'es pas un outil marketing : tu es la plume de ce client.

IDENTITÉ DE MARQUE :
[DESCRIPTION_MARQUE]

TON : [TON] — respecte-le à la lettre.
VOCABULAIRE À PRIVILÉGIER : [MOTS_POSITIFS]
VOCABULAIRE INTERDIT : [MOTS_INTERDITS]
[REFERENCE_CAPTION]
Tout ce qu'il faut savoir sur la voix de la marque est ci-dessus. Ne redemande jamais le style, n'invente pas une autre voix : écris AVEC celle-là.

ÉCRIS COMME UN HUMAIN, PAS COMME UNE IA :
- Mots simples, du quotidien. Aucun jargon marketing, aucun superlatif vide ("incontournable", "exceptionnel", "unique en son genre", "véritable"…).
- Phrases courtes, presque à l'oral. On doit sentir une vraie personne derrière.
- Ne commence JAMAIS par "Découvrez", "Bienvenue", "Plongez", "Profitez", "Envie de", "Et si".
- Première phrase = une image, une sensation ou un fait concret. Pas d'introduction.
- COURT par défaut : 2 à 4 phrases. Si des exemples du client sont fournis, calque leur longueur exacte.
- Max 1 emoji (jamais en début de phrase), max 1 point d'exclamation.
- 3 à 5 hashtags précis à la niche, jamais génériques (#food #lifestyle interdits).
- Suggère plutôt que d'affirmer ; évoque plutôt que de décrire.

RÈGLE PRIORITAIRE : si des exemples de légendes du client existent, ils passent avant tout le reste — imite leur longueur, leur rythme, leur ponctuation et leur niveau de langue. Le but est qu'on ne fasse pas la différence avec ce que le client publie d'habitude.`;

interface WorkspaceData {
  name: string | null;
  sector: string | null;
  tone: string | null;
  words_to_use: string | null;
  words_to_avoid: string | null;
  company_description: string | null;
  caption_examples: string | null;
  brand_voice_prompt: string | null;
  description_style: string | null;
}

function buildSystemPrompt(ws: WorkspaceData): string {
  const refBlock = ws.caption_examples
    ? `\nSTYLE DE RÉFÉRENCE (inspire-toi du style, pas du contenu) :\n"${ws.caption_examples}"\n`
    : '\n';

  return PROMPT_TEMPLATE
    .replace('[NOM_CLIENT]',       ws.name             || 'ce client')
    .replace('[SECTEUR]',          ws.sector           || 'non spécifié')
    .replace('[DESCRIPTION_MARQUE]', ws.company_description || 'Non renseignée')
    .replace('[TON]',              ws.tone             || 'Professionnel')
    .replace('[MOTS_POSITIFS]',    ws.words_to_use     || 'aucune contrainte')
    .replace('[MOTS_INTERDITS]',   ws.words_to_avoid   || 'aucune contrainte')
    .replace('[REFERENCE_CAPTION]', refBlock);
}

export interface GenerateDescriptionParams {
  userId: string;
  brief: string;
  photoUrl?: string;
  frames?: string[]; // images (dataURL) échantillonnées d'une VIDÉO montée — analyse multi-frames
  workspaceId?: string;
  workspaceName?: string;
  sector?: string;
  tone?: string;
  brandTone?: string;
  companyDescription?: string;
  brandDescription?: string;
  wordsToUse?: string;
  wordsToAvoid?: string;
  captionExamples?: string;
  brandVoicePrompt?: string;
  descriptionStyle?: string;
  context?: string;
  imageHasText?: boolean;
  textRoles?: Record<string, string>;
  templateZones?: { id: string; role?: string; width: number; height: number; fontSize: number }[];
  approvedCaptions?: string[];
}

export interface GenerateDescriptionResult {
  texte_visuel: string;
  description: string;
  blocks?: Record<string, string>;
  zoneBlocks?: Record<string, string>;
}

export async function generateDescriptionForUser(params: GenerateDescriptionParams): Promise<GenerateDescriptionResult> {
  const {
    userId, brief, photoUrl, workspaceId,
    workspaceName, sector, tone, brandTone, companyDescription, brandDescription,
    wordsToUse, wordsToAvoid, captionExamples, brandVoicePrompt, descriptionStyle,
    context, imageHasText, textRoles, templateZones, approvedCaptions,
  } = params;

  if (!brief) throw new Error('Brief manquant');

  // ─── 1. Fetch workspace data from Supabase ────────────────────────────────
  let ws: WorkspaceData = {
    name:                workspaceName || null,
    sector:              sector || null,
    tone:                tone || brandTone || null,
    words_to_use:        wordsToUse || null,
    words_to_avoid:      wordsToAvoid || null,
    company_description: brandDescription || companyDescription || null,
    caption_examples:    captionExamples || null,
    brand_voice_prompt:  brandVoicePrompt || null,
    description_style:   descriptionStyle || null,
  };

  if (workspaceId && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      );
      const { data } = await supabase
        .from('workspaces')
        .select('name, sector, tone, words_to_use, words_to_avoid, company_description, caption_examples, brand_voice_prompt, description_style')
        .eq('id', workspaceId)
        .single();
      if (data) ws = data as WorkspaceData;
    } catch (e) {
      console.warn('[generate-description] workspace fetch failed, using body params:', e);
    }
  }

  // ─── 2. Build system prompt from brand data ───────────────────────────────
  const systemPrompt = buildSystemPrompt(ws);

  // ─── 3. Build user message ────────────────────────────────────────────────
  const contextText = [context, brief].filter(Boolean).join('\n').trim();

  const ROLE_LABELS: Record<string, string> = {
    titre: 'Titre principal',
    'sous-titre': 'Sous-titre',
    accroche: 'Accroche / Tag',
    corps: 'Corps de texte',
    cta: 'Call-to-action',
    prix: 'Prix / Offre',
    personnalise: 'Zone personnalisée',
  };
  const zonesArray = Array.isArray(templateZones) ? templateZones : [];
  const activeZones = zonesArray.filter(z => z.role);
  const hasZoneMode = activeZones.length > 0;

  const hasRoles = !hasZoneMode && textRoles && typeof textRoles === 'object' && Object.keys(textRoles).length > 0;
  const roleKeys = hasRoles ? Object.keys(textRoles as Record<string, string>) : [];

  const lines: string[] = [];

  lines.push(`CONTEXTE DU POST : ${contextText || 'Aucun contexte fourni'}`);

  if (imageHasText) {
    lines.push('');
    lines.push('IMPORTANT : la photo contient DÉJÀ son texte/visuel. NE génère AUCUN texte à incruster (texte_visuel vide, pas de zone_blocks). Génère UNIQUEMENT la légende Instagram (description).');
  }

  if (approvedCaptions && Array.isArray(approvedCaptions) && approvedCaptions.length > 0) {
    lines.push('');
    lines.push('── CAPTIONS VALIDÉES PAR L\'AGENCE (MÉMOIRE DE MARQUE) ────────');
    approvedCaptions.forEach((cap: string, i: number) => lines.push(`${i + 1}. ${cap}`));
    lines.push('(Maintiens ce style et ce niveau de langue)');
  }

  if (ws.brand_voice_prompt || ws.description_style) {
    lines.push('');
    if (ws.brand_voice_prompt) lines.push(`Voix de marque : ${ws.brand_voice_prompt}`);
    if (ws.description_style)  lines.push(`Style rédactionnel : ${ws.description_style}`);
  }

  const zoneConstraints = new Map<string, { role: string; roleLabel: string; maxChars: number; maxLines: number }>();
  activeZones.forEach(z => {
    const safeW = Math.max(z.width ?? 200, 1);
    const safeH = Math.max(z.height ?? z.fontSize * 2, 1);
    const safeF = Math.max(z.fontSize ?? 24, 1);
    const charsPerLine = Math.max(3, Math.floor(safeW / (safeF * 0.55)));
    const maxLines     = Math.max(1, Math.round(safeH / (safeF * 1.25)));
    const maxChars     = Math.max(5, charsPerLine * maxLines);
    zoneConstraints.set(z.id, { role: z.role!, roleLabel: ROLE_LABELS[z.role!] ?? z.role!, maxChars, maxLines });
  });

  if (hasZoneMode) {
    lines.push('');
    lines.push('── ZONES DU TEMPLATE (contraintes STRICTES) ──────────────────');
    lines.push('Ce visuel utilise un template. Chaque zone a une limite à NE JAMAIS dépasser :');
    activeZones.forEach(z => {
      const c = zoneConstraints.get(z.id)!;
      const lineHint = c.maxLines === 1 ? '1 ligne' : `${c.maxLines} lignes max`;
      lines.push(`- "${c.roleLabel}" (id: ${z.id}) : ≤ ${c.maxChars} caractères, ${lineHint}.`);
    });
    lines.push('');
    lines.push('Le texte DOIT tenir dans ces limites. Sois concis et percutant. Répartis le contenu de façon cohérente — chaque zone doit avoir du sens isolément ET ensemble.');
  } else if (hasRoles) {
    lines.push('');
    lines.push(`Blocs visuels présents : ${roleKeys.join(', ')}`);
  }

  lines.push('');
  lines.push('── FORMAT DE RÉPONSE (JSON strict) ───────────────────────────');
  lines.push('Réponds UNIQUEMENT avec ce JSON valide, sans rien avant ni après :');

  if (hasZoneMode) {
    const zoneExample = activeZones.map(z => `"${z.id}": "texte pour ${ROLE_LABELS[z.role!] ?? z.role}"`).join(', ');
    lines.push(`{ "texte_visuel": "TITRE VISUEL 3-5 mots", "description": "Caption Instagram.", "zone_blocks": { ${zoneExample} } }`);
  } else if (hasRoles) {
    const blocksExample = roleKeys.map(r => `"${r}": "contenu pour ${r}"`).join(', ');
    lines.push(`{ "texte_visuel": "TITRE VISUEL 3-5 mots", "description": "Caption Instagram.", "blocks": { ${blocksExample} } }`);
  } else {
    lines.push('{ "texte_visuel": "TITRE VISUEL 3-5 mots", "description": "Caption Instagram avec hashtags." }');
  }

  const userPrompt = lines.join('\n');

  // ─── 4. Build message content (with optional image(s)) ───────────────────
  // Frames d'une vidéo montée (dataURL) prioritaires sur photoUrl : analyse multi-frames.
  const frames = Array.isArray(params.frames) ? params.frames.filter((f) => typeof f === 'string' && f.startsWith('data:')) : [];
  const hasHttpPhoto = typeof photoUrl === 'string' && photoUrl.startsWith('http');
  const images = frames.length ? frames : (hasHttpPhoto ? [photoUrl!] : []);
  const hasImage = images.length > 0;
  const isVideo = frames.length > 0;
  const userText = hasImage
    ? `${userPrompt}\n\n${isVideo
        ? "Ces images sont des instants clés de la VIDÉO MONTÉE, dans l'ordre chronologique. Comprends ce qui s'y passe (sujet, ambiance, déroulé) et écris une légende parfaitement adaptée à cette marque et à cette vidéo."
        : 'Analyse ce visuel et génère le contenu parfaitement adapté à cette marque.'}`
    : userPrompt;
  const maxTokens = hasZoneMode ? 800 : hasRoles ? 600 : 400;

  // ─── 5. Call l'IA (Claude si BYOK connecté, sinon Gemini) ─────────────────
  console.log(`[generate-description] workspace="${ws.name}" sector="${ws.sector}" tone="${ws.tone}" hasImage=${hasImage} hasZones=${hasZoneMode}`);

  const rawText: string = await generateAiText({
    userId,
    system: systemPrompt,
    userText,
    images: hasImage ? images : undefined,
    temperature: 0.9,
    maxTokens,
  });

  // ─── 6. Parse JSON response ───────────────────────────────────────────────
  let texte_visuel = '';
  let description = '';
  let blocks: Record<string, string> | null = null;
  let zoneBlocks: Record<string, string> | null = null;

  // Nettoie les éventuelles clôtures markdown (```json … ```) que certains
  // modèles (Gemini surtout) ajoutent autour du JSON, avant extraction.
  const stripFences = (s: string) => s.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  // Garantit une chaîne propre : si le modèle a double-encodé (une valeur qui
  // contient elle-même du JSON), on ne laisse jamais du JSON brut en sortie.
  const coerceStr = (v: unknown): string => {
    if (typeof v !== 'string') return '';
    const t = v.trim();
    return (t.startsWith('{') && t.includes('"texte_visuel"')) ? '' : t;
  };
  const cleaned = stripFences(rawText);

  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      texte_visuel = coerceStr(parsed.texte_visuel);
      description  = coerceStr(parsed.description);
      if (parsed.blocks      && typeof parsed.blocks      === 'object') blocks      = parsed.blocks;
      if (parsed.zone_blocks && typeof parsed.zone_blocks === 'object') zoneBlocks  = parsed.zone_blocks;
    } else {
      // Pas de JSON détecté : on garde le texte nettoyé comme légende, mais
      // jamais du JSON brut (sécurité).
      description = cleaned.startsWith('{') ? '' : cleaned;
    }
  } catch {
    // JSON mal formé : ne JAMAIS stocker le brut (qui apparaîtrait comme titre).
    // On tente une dernière extraction du champ description au regex, sinon vide.
    const dm = cleaned.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    description = dm ? dm[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : '';
    const tm = cleaned.match(/"texte_visuel"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    texte_visuel = tm ? tm[1].replace(/\\"/g, '"') : '';
  }

  // ─── 6bis. Validation des contraintes de slot (Phase 1) ───────────────────
  const cleanTruncate = (s: string, max: number): string => {
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
  };

  if (hasZoneMode && zoneBlocks && zoneConstraints.size > 0) {
    const violations = () => Object.entries(zoneBlocks!)
      .filter(([id, txt]) => { const c = zoneConstraints.get(id); return c && typeof txt === 'string' && txt.length > c.maxChars; })
      .map(([id, txt]) => ({ id, len: (txt as string).length, max: zoneConstraints.get(id)!.maxChars, label: zoneConstraints.get(id)!.roleLabel }));

    let bad = violations();
    if (bad.length > 0) {
      try {
        const fixLines = bad.map(v => `- "${v.label}" (id: ${v.id}) : actuellement ${v.len} caractères, raccourcis à ≤ ${v.max} caractères en gardant le sens.`);
        const fixPrompt = [
          'Les zones suivantes dépassent leur limite de caractères :',
          ...fixLines,
          '',
          'Renvoie UNIQUEMENT ce JSON (rien d\'autre), avec les versions raccourcies :',
          `{ "zone_blocks": { ${bad.map(v => `"${v.id}": "..."`).join(', ')} } }`,
        ].join('\n');
        const fixRaw = await generateAiText({
          userId,
          system: systemPrompt,
          userText: fixPrompt,
          temperature: 0.9,
          maxTokens,
          priorTurns: [
            { role: 'user', text: userText, images: hasImage ? images : undefined },
            { role: 'assistant', text: rawText },
          ],
        });
        const m = fixRaw.match(/\{[\s\S]*\}/);
        if (m) {
          const fixed = JSON.parse(m[0]);
          const fb = fixed.zone_blocks ?? fixed;
          if (fb && typeof fb === 'object') {
            for (const v of bad) if (typeof fb[v.id] === 'string') zoneBlocks[v.id] = fb[v.id].trim();
          }
        }
      } catch (e) {
        console.warn('[generate-description] re-prompt échoué, troncature appliquée:', e);
      }
      bad = violations();
      for (const v of bad) zoneBlocks[v.id] = cleanTruncate(zoneBlocks[v.id] as string, v.max);
      if (bad.length) console.log(`[generate-description] ${bad.length} zone(s) tronquée(s) après re-prompt`);
    }
  }

  if (imageHasText) { texte_visuel = ''; blocks = null; zoneBlocks = null; }

  console.log(`[generate-description] done — texte_visuel="${texte_visuel.slice(0, 40)}" desc_len=${description.length}`);

  return {
    texte_visuel,
    description,
    ...(blocks     ? { blocks }     : {}),
    ...(zoneBlocks ? { zoneBlocks } : {}),
  };
}
