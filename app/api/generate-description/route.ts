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
    } = body;

    if (!brief) {
      return NextResponse.json({ error: 'Brief manquant' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
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
      sections.push('── EXEMPLE DE CAPTION APPROUVÉ ───────────────────────────');
      sections.push(captionExamples.trim());
      sections.push('(Inspire-toi du style et du registre — pas du contenu exact)');
    }

    sections.push('');
    sections.push('── DIRECTIVES DE GÉNÉRATION ──────────────────────────────');
    sections.push(`• Ton demandé pour ce post : ${tone || 'engageant'}`);
    sections.push(`• "texte_visuel" = accroche visuelle, 4-7 mots MAX, style titre court`);
    sections.push(`• "description" = caption Instagram : 2-4 phrases, naturel, engageant, termine par 3-5 hashtags pertinents`);
    sections.push(`• INTERDICTIONS : ne jamais utiliser les mots bannis · pas de guillemets dans texte_visuel`);

    sections.push('');
    sections.push('── FORMAT DE RÉPONSE ──────────────────────────────────────');
    sections.push(`Réponds UNIQUEMENT avec ce JSON valide, rien d'autre avant ni après :`);
    sections.push(`{ "texte_visuel": "ACCROCHE COURTE", "description": "Caption Instagram avec hashtags." }`);

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
    content.push({
      type: 'text',
      text: hasImage
        ? `Brief : ${brief}. Analyse ce visuel et génère le contenu Instagram parfait pour cette marque.`
        : `Brief : ${brief}. Génère le contenu Instagram pour cette marque.`,
    });

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

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        texte_visuel = (parsed.texte_visuel ?? '').trim();
        description  = (parsed.description  ?? '').trim();
      } else {
        description = rawText;
      }
    } catch {
      description = rawText;
    }

    return NextResponse.json({ texte_visuel, description });
  } catch (error: unknown) {
    console.error('Erreur génération:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
