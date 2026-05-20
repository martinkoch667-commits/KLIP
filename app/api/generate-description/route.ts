import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brief, photoUrl, brandVoicePrompt, companyDescription, descriptionStyle, captionExamples } = body;

    if (!brief) {
      return NextResponse.json({ error: 'Brief manquant' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Clé API Anthropic manquante' }, { status: 500 });
    }

    const systemPrompt = `Tu es un expert social media pour agences françaises.

CONTEXTE DE LA MARQUE :
${companyDescription ? `Entreprise : ${companyDescription}` : ''}
${brandVoicePrompt ? `Voix et ton : ${brandVoicePrompt}` : ''}
${descriptionStyle ? `Style de description : ${descriptionStyle}` : ''}
${captionExamples ? `Consignes à respecter : ${captionExamples}` : ''}

RÈGLES ABSOLUES :
- Réponds UNIQUEMENT en JSON valide, rien d'autre
- Format : { "texte_visuel": "TEXTE MAX 8 MOTS EN MAJUSCULES", "description": "description Instagram avec hashtags" }
- Respecte scrupuleusement les consignes de style de la marque`;

    // Build message content — include image if we have a public URL
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
      text: `Brief : ${brief}. ${hasImage ? "Analyse l'image et génère le contenu Instagram parfait pour cette marque." : "Génère la description Instagram."}`,
    });

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
        description = (parsed.description ?? '').trim();
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
