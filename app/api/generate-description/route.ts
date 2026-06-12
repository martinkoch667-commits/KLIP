import { NextRequest, NextResponse } from 'next/server';

// ─── Shared system prompt — injected in every call ────────────────────────────
const SYSTEM_PROMPT = `Tu es un directeur artistique et copywriter senior spécialisé en contenu Instagram pour des marques premium. Tu travailles pour des agences de communication exigeantes.

Ton style :
- Tu écris comme un humain qui connaît profondément la marque, pas comme une IA
- Tu évites absolument : "Découvrez", "Bienvenue", "Plongez dans", "Rejoignez-nous", "N'attendez plus", "Profitez de", "Incontournable", "Authentique", "Passion", "Excellence", "Qualité"
- Tu n'utilises jamais de hashtags génériques (#food #lifestyle #instagood)
- Tu n'exagères jamais : pas de "!", pas de superlatifs vides, pas d'emojis excessifs
- Tu observes ce qui se fait chez les marques premium du même secteur et tu fais mieux
- Chaque texte doit sembler écrit spécifiquement pour cette marque, pas pour n'importe qui
- Tu privilégies la suggestion à l'affirmation, l'évocation à la description`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      brief,
      photoUrl,
      // Brand identity — new field names (+ legacy aliases)
      workspaceName,
      sector,
      tone,
      brandTone,
      companyDescription,
      brandDescription,
      // Voice rules
      wordsToUse,
      wordsToAvoid,
      captionExamples,
      brandVoicePrompt,
      descriptionStyle,
      // 4D — structured text block roles
      textRoles,
      // 5B — post context
      context,
      // 5C — approved captions (brand memory)
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

    // ─── Resolve field values (new names take priority, fall back to legacy) ──
    const clientName   = workspaceName || 'cette marque';
    const clientSector = sector || 'non spécifié';
    const clientTone   = tone || brandTone || 'Professionnel';
    const clientDesc   = brandDescription || companyDescription || '';
    const positiveWords = wordsToUse || '';
    const negativeWords = wordsToAvoid || '';
    const captionRef   = captionExamples || '';
    const contextText  = context || brief;

    // ─── 4D — Text block roles ────────────────────────────────────────────────
    const hasRoles = textRoles && typeof textRoles === 'object' && Object.keys(textRoles).length > 0;
    const roleKeys = hasRoles ? Object.keys(textRoles as Record<string, string>) : [];

    // ─── Build the user prompt ────────────────────────────────────────────────
    const lines: string[] = [];

    // — Titre visuel —
    lines.push(`GÉNÈRE DU CONTENU INSTAGRAM POUR : ${clientName}`);
    lines.push('');
    lines.push('── BRIEF ─────────────────────────────────────────────────────');
    lines.push(`Contexte : ${contextText}`);
    lines.push('');
    lines.push('── IDENTITÉ DE LA MARQUE ─────────────────────────────────────');
    lines.push(`Marque : ${clientName}`);
    lines.push(`Secteur : ${clientSector}`);
    lines.push(`Ton demandé : ${clientTone}`);
    if (clientDesc)       lines.push(`Description : ${clientDesc}`);
    if (brandVoicePrompt) lines.push(`Voix de marque : ${brandVoicePrompt}`);
    if (descriptionStyle) lines.push(`Style rédactionnel : ${descriptionStyle}`);

    if (positiveWords || negativeWords) {
      lines.push('');
      lines.push('── RÈGLES LEXICALES ──────────────────────────────────────────');
      if (positiveWords) lines.push(`Mots à utiliser : ${positiveWords}`);
      if (negativeWords) lines.push(`Mots BANNIS — ne jamais écrire : ${negativeWords}`);
    }

    if (captionRef) {
      lines.push('');
      lines.push('── CAPTION DE RÉFÉRENCE APPROUVÉE PAR CE CLIENT ─────────────');
      lines.push(captionRef.trim());
      lines.push('(Reproduis ce registre et ce niveau de langue — pas le contenu exact)');
    }

    if (approvedCaptions && Array.isArray(approvedCaptions) && approvedCaptions.length > 0) {
      lines.push('');
      lines.push('── CAPTIONS VALIDÉES PAR L\'AGENCE (MÉMOIRE DE MARQUE) ────────');
      approvedCaptions.forEach((cap: string, i: number) => {
        lines.push(`${i + 1}. ${cap}`);
      });
      lines.push('(Maintiens ce style et ce niveau de langue)');
    }

    lines.push('');
    lines.push('── RÈGLES DU TITRE VISUEL (texte_visuel) ─────────────────────');
    lines.push('- Maximum 6 mots — idéalement 3 à 5');
    lines.push('- Pas de ponctuation sauf un point ou un tiret si ça renforce le style');
    lines.push('- Pas de verbe obligatoire — noms et adjectifs percutants suffisent');
    lines.push('- Le texte doit fonctionner visuellement sur une image — avoir du rythme');
    lines.push('- Pas de questions ("Vous cherchez...?") ni d\'injonctions molles ("Venez découvrir")');
    lines.push(`- Pense à ce que ferait Jacquemus, Le Labo, Rimowa ou Aesop dans le secteur "${clientSector}"`);

    lines.push('');
    lines.push('── RÈGLES DE LA CAPTION INSTAGRAM (description) ──────────────');
    lines.push('- Entre 60 et 150 mots maximum');
    lines.push('- La première phrase accroche sans être racoleure — commence par une image, une sensation ou un fait concret. Jamais par "Découvrez"');
    lines.push('- Le corps développe une seule idée, pas trois');
    lines.push('- La dernière ligne peut être un appel à l\'action subtil — jamais "Commandez maintenant"');
    lines.push('- Hashtags : 3 à 5 max, très spécifiques à la niche, après un saut de ligne');
    lines.push('- Maximum 1 emoji, utilisé avec intention — pas pour décorer');
    lines.push('- Le texte doit sonner comme quelqu\'un qui connaît vraiment ce monde');
    lines.push('- Avant d\'écrire : imagine la marque premium de référence de ce secteur. Fais mieux ou au même niveau');

    if (hasRoles) {
      lines.push('');
      lines.push('── BLOCS DE TEXTE VISUELS (rôles) ───────────────────────────');
      lines.push(`Blocs présents sur le visuel : ${roleKeys.join(', ')}`);
      lines.push('Génère du contenu adapté pour CHACUN de ces rôles dans "blocks"');
    }

    lines.push('');
    lines.push('── FORMAT DE RÉPONSE ─────────────────────────────────────────');
    lines.push('Réponds UNIQUEMENT avec ce JSON valide, sans rien avant ni après :');

    if (hasRoles) {
      const blocksExample = roleKeys.map(r => `"${r}": "contenu pour ${r}"`).join(', ');
      lines.push(`{ "texte_visuel": "TITRE VISUEL", "description": "Caption Instagram avec hashtags.", "blocks": { ${blocksExample} } }`);
    } else {
      lines.push('{ "texte_visuel": "TITRE VISUEL", "description": "Caption Instagram avec hashtags." }');
    }

    const userPrompt = lines.join('\n');

    // ─── Build message content (with optional image) ──────────────────────────
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

    // ─── Call Claude ──────────────────────────────────────────────────────────
    console.log(`[generate-description] client="${clientName}" sector="${clientSector}" tone="${clientTone}" hasImage=${hasImage}`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 400,
        temperature: 0.85,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[generate-description] API error:', data);
      return NextResponse.json({ error: data }, { status: 500 });
    }

    const rawText: string = data.content?.[0]?.text ?? '';

    // ─── Parse JSON response ──────────────────────────────────────────────────
    let texte_visuel = '';
    let description = '';
    let blocks: Record<string, string> | null = null;

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        texte_visuel = (parsed.texte_visuel ?? '').trim();
        description  = (parsed.description  ?? '').trim();
        if (parsed.blocks && typeof parsed.blocks === 'object') blocks = parsed.blocks;
      } else {
        description = rawText;
      }
    } catch {
      description = rawText;
    }

    console.log(`[generate-description] done — texte_visuel="${texte_visuel.slice(0, 40)}" desc_len=${description.length}`);

    return NextResponse.json({ texte_visuel, description, ...(blocks ? { blocks } : {}) });

  } catch (error: unknown) {
    console.error('[generate-description] unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
