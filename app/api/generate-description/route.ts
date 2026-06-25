import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// ─── Brand-aware system prompt template ────────────────────────────────────────
const PROMPT_TEMPLATE = `Tu es un copywriter expert en contenu Instagram pour agences de communication premium.
Tu écris pour [NOM_CLIENT], une marque dans le secteur [SECTEUR].

IDENTITÉ DE MARQUE :
[DESCRIPTION_MARQUE]

TON DE COMMUNICATION : [TON] — applique ce ton rigoureusement.

VOCABULAIRE AUTORISÉ (utilise ces mots naturellement) : [MOTS_POSITIFS]
VOCABULAIRE INTERDIT (n'utilise JAMAIS ces mots) : [MOTS_INTERDITS]
[REFERENCE_CAPTION]
RÈGLES ABSOLUES :
- Ne commence JAMAIS par "Découvrez", "Bienvenue", "Plongez", "Profitez"
- Maximum 1 point d'exclamation par caption
- Maximum 1 emoji, utilisé avec intention et jamais en début de phrase
- 3 à 5 hashtags ultra-spécifiques à la niche, jamais génériques (#food #lifestyle sont interdits)
- La caption doit sonner comme écrite par quelqu'un qui connaît profondément cette marque depuis des années
- Évite absolument tout ce qui ressemble à du contenu généré par IA : superlatifs vides, formules creuses, enthousiasme forcé
- Privilégie la suggestion à l'affirmation, l'évocation à la description
- Entre 60 et 150 mots — ni trop court ni trop long
- La première phrase est cruciale : commence par une image, une sensation ou un fait concret`;

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

export async function POST(request: NextRequest) {
  try {
    // Auth requise : empêche l'abus du quota IA par des appels anonymes.
    const authClient = createRouteHandlerClient({ cookies });
    const { data: { session } } = await authClient.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const body = await request.json();
    const {
      brief,
      photoUrl,
      // New: workspace ID for server-side fetch
      workspaceId,
      // Legacy body params (fallback if workspaceId missing)
      workspaceName,
      sector,
      tone,
      brandTone,
      companyDescription,
      brandDescription,
      wordsToUse,
      wordsToAvoid,
      captionExamples,
      brandVoicePrompt,
      descriptionStyle,
      // Post context (new textarea field)
      context,
      // Template zones
      textRoles,
      templateZones,
      // Brand memory
      approvedCaptions,
    } = body;

    if (!brief) {
      return NextResponse.json({ error: 'Brief manquant' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('[generate-description] ANTHROPIC_API_KEY is not set');
      return NextResponse.json({ error: 'Clé API Anthropic manquante' }, { status: 500 });
    }

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

    // ── Template zones (5A) ──
    type TemplateZone = { id: string; role?: string; width: number; height: number; fontSize: number };
    const ROLE_LABELS: Record<string, string> = {
      titre: 'Titre principal',
      'sous-titre': 'Sous-titre',
      accroche: 'Accroche / Tag',
      corps: 'Corps de texte',
      cta: 'Call-to-action',
      prix: 'Prix / Offre',
      personnalise: 'Zone personnalisée',
    };
    const zonesArray: TemplateZone[] = Array.isArray(templateZones) ? templateZones : [];
    const activeZones = zonesArray.filter(z => z.role);
    const hasZoneMode = activeZones.length > 0;

    // ── Text block roles (4D legacy) ──
    const hasRoles = !hasZoneMode && textRoles && typeof textRoles === 'object' && Object.keys(textRoles).length > 0;
    const roleKeys = hasRoles ? Object.keys(textRoles as Record<string, string>) : [];

    const lines: string[] = [];

    lines.push(`CONTEXTE DU POST : ${contextText || 'Aucun contexte fourni'}`);

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

    if (hasZoneMode) {
      lines.push('');
      lines.push('── ZONES DU TEMPLATE ─────────────────────────────────────────');
      lines.push('Ce visuel utilise un template avec ces zones de texte à remplir :');
      activeZones.forEach(z => {
        const roleLabel = ROLE_LABELS[z.role!] ?? z.role;
        const safeW = Math.max(z.width ?? 200, 1);
        const safeH = Math.max(z.height ?? z.fontSize * 2, 1);
        const safeF = Math.max(z.fontSize ?? 24, 1);
        const maxChars = Math.max(5, Math.floor((safeW / (safeF * 0.55)) * (safeH / (safeF * 1.3))));
        lines.push(`- "${roleLabel}" (id: ${z.id}) : maximum ${maxChars} caractères`);
      });
      lines.push('');
      lines.push('Répartis le contenu de façon cohérente — chaque zone doit avoir du sens isolément ET ensemble.');
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

    // ─── 4. Build message content (with optional image) ──────────────────────
    const hasImage = typeof photoUrl === 'string' && photoUrl.startsWith('http');
    type MessageContent =
      | { type: 'image'; source: { type: 'url'; url: string } }
      | { type: 'text'; text: string };

    const content: MessageContent[] = [];
    if (hasImage) {
      content.push({ type: 'image', source: { type: 'url', url: photoUrl } });
    }
    content.push({
      type: 'text',
      text: hasImage
        ? `${userPrompt}\n\nAnalyse ce visuel et génère le contenu parfaitement adapté à cette marque.`
        : userPrompt,
    });

    // ─── 5. Call Claude ───────────────────────────────────────────────────────
    console.log(`[generate-description] workspace="${ws.name}" sector="${ws.sector}" tone="${ws.tone}" hasImage=${hasImage} hasZones=${hasZoneMode}`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: hasZoneMode ? 800 : hasRoles ? 600 : 400,
        temperature: 0.9,
        system: systemPrompt,
        messages: [{ role: 'user', content }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[generate-description] API error:', data);
      return NextResponse.json({ error: data }, { status: 500 });
    }

    const rawText: string = data.content?.[0]?.text ?? '';

    // ─── 6. Parse JSON response ───────────────────────────────────────────────
    let texte_visuel = '';
    let description = '';
    let blocks: Record<string, string> | null = null;
    let zoneBlocks: Record<string, string> | null = null;

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        texte_visuel = (parsed.texte_visuel ?? '').trim();
        description  = (parsed.description  ?? '').trim();
        if (parsed.blocks      && typeof parsed.blocks      === 'object') blocks      = parsed.blocks;
        if (parsed.zone_blocks && typeof parsed.zone_blocks === 'object') zoneBlocks  = parsed.zone_blocks;
      } else {
        description = rawText;
      }
    } catch {
      description = rawText;
    }

    console.log(`[generate-description] done — texte_visuel="${texte_visuel.slice(0, 40)}" desc_len=${description.length}`);

    return NextResponse.json({
      texte_visuel,
      description,
      ...(blocks     ? { blocks }     : {}),
      ...(zoneBlocks ? { zoneBlocks } : {}),
    });

  } catch (error: unknown) {
    console.error('[generate-description] unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
