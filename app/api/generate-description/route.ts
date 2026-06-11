import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      brief, photoUrl,
      // Brand identity
      workspaceName, sector, tone, brandTone,
      companyDescription,
      // Voice rules
      brandVoicePrompt, wordsToUse, wordsToAvoid,
      captionExamples, descriptionStyle,
      // 4D — structured text blocks
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
    console.log('[generate-description] API key present:', !!apiKey);
    console.log('[generate-description] API key first4:', apiKey?.substring(0, 4));
    if (!apiKey) {
      console.error('[generate-description] ANTHROPIC_API_KEY is not set in environment');
      return NextResponse.json({ error: 'Clé API Anthropic manquante' }, { status: 500 });
    }

    // ─── Build structured brand context ────────────────────────────────────
    const brandLines: string[] = [];
    if (workspaceName)       brandLines.push(`Nom de la marque : ${workspaceName}`);
    if (sector)              brandLines.push(`Secteur : ${sector}`);
    if (companyDescription)  brandLines.push(`Description : ${companyDescription}`);
    if (brandTone)           brandLines.push(`Personnalité de la marque : ${brandTone}`);
    if (brandVoicePrompt)    brandLines.push(`Voix de marque : ${brandVoicePrompt}`);
    if (descriptionStyle)    brandLines.push(`Style de rédaction : ${descriptionStyle}`);

    const voiceLines: string[] = [];
    if (wordsToUse)   voiceLines.push(`Mots à utiliser souvent : ${wordsToUse}`);
    if (wordsToAvoid) voiceLines.push(`Mots BANNIS — ne jamais utiliser : ${wordsToAvoid}`);

    const sections: string[] = [
      `Tu es le copywriter social media d'une agence française créative.`,
      `Tu rédiges du contenu Instagram en français, toujours calé sur la voix et les codes de la marque.`,
    ];

    if (brandLines.length > 0) {
      sections.push('');
      sections.push('── IDENTITÉ DE LA MARQUE ─────────────────────────────────');
      sections.push(...brandLines);
    }

    if (voiceLines.length > 0) {
      sections.push('');
      sections.push('── RÈGLES DE VOIX ────────────────────────────────────────');
      sections.push(...voiceLines);
    }

    if (captionExamples) {
      sections.push('');
      sections.push('── EXEMPLE DE CAPTION DE RÉFÉRENCE ───────────────────────');
      sections.push(captionExamples.trim());
      sections.push('(Inspire-toi du registre et du style — pas du contenu exact)');
    }

    // 5C — Brand memory: inject approved captions
    if (approvedCaptions && Array.isArray(approvedCaptions) && approvedCaptions.length > 0) {
      sections.push('');
      sections.push('── CAPTIONS APPROUVÉES PAR LA MARQUE (MÉMOIRE) ──────────');
      sections.push("Ces captions ont été validées et retouchées par l'agence :");
      approvedCaptions.forEach((cap: string, i: number) => {
        sections.push(`${i + 1}. ${cap}`);
      });
      sections.push('(Respecte ce style, ce registre et ce niveau de langue)');
    }

    // 4D — Structured text block roles
    const hasRoles = textRoles && typeof textRoles === 'object' && Object.keys(textRoles).length > 0;
    const roleKeys = hasRoles ? Object.keys(textRoles as Record<string, string>) : [];

    sections.push('');
    sections.push('── DIRECTIVES DE GÉNÉRATION ──────────────────────────────');
    sections.push(`• Ton demandé pour ce post : ${tone || 'engageant'}`);

    if (context) {
      sections.push(`• Contexte spécifique de ce post : ${context}`);
    }

    if (hasRoles) {
      sections.push(`• Des blocs de texte visuels sont présents avec les rôles : ${roleKeys.join(', ')}`);
      sections.push(`• Génère du contenu adapté pour CHACUN de ces rôles`);
      sections.push(`• "texte_visuel" = accroche principale du visuel (4-6 mots MAX, en MAJUSCULES)`);
    } else {
      sections.push(`• "texte_visuel" = accroche visuelle, 4-7 mots MAX, style titre court percutant`);
    }

    sections.push(`• "description" = caption Instagram : 2-4 phrases, naturel, engageant, termine par 3-5 hashtags pertinents`);
    sections.push(`• INTERDICTIONS : ne jamais utiliser les mots bannis · pas de guillemets dans texte_visuel`);

    sections.push('');
    sections.push('── FORMAT DE RÉPONSE ──────────────────────────────────────');
    sections.push(`Réponds UNIQUEMENT avec ce JSON valide, sans rien d'autre avant ni après :`);

    if (hasRoles) {
      const blocksExample = roleKeys.map(r => `"${r}": "contenu pour ${r}"`).join(', ');
      sections.push(`{ "texte_visuel": "ACCROCHE", "description": "Caption avec hashtags.", "blocks": { ${blocksExample} } }`);
    } else {
      sections.push(`{ "texte_visuel": "ACCROCHE COURTE", "description": "Caption Instagram avec hashtags." }`);
    }

    const systemPrompt = sections.join('\n');

    // ─── Build message content ──────────────────────────────────────────────
    const hasImage = typeof photoUrl === 'string' && photoUrl.startsWith('http');

    type MessageContent =
      | { type: 'image'; source: { type: 'url'; url: string } }
      | { type: 'text'; text: string };

    const content: MessageContent[] = [];
    if (hasImage) {
      content.push({ type: 'image', source: { type: 'url', url: photoUrl } });
    }

    let userText = `Brief : ${brief}.`;
    if (context) userText += ` Contexte : ${context}.`;
    if (hasImage) userText += ` Analyse ce visuel et génère le contenu Instagram parfait pour cette marque.`;
    else userText += ` Génère le contenu Instagram pour cette marque.`;
    content.push({ type: 'text', text: userText });

    // ─── Call Claude ────────────────────────────────────────────────────────
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data }, { status: 500 });
    }

    const rawText: string = data.content[0].text ?? '';

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

    return NextResponse.json({ texte_visuel, description, ...(blocks ? { blocks } : {}) });
  } catch (error: unknown) {
    console.error('Erreur génération:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
