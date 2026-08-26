// Point d'entrée unique pour les routes IA texte/vision : choisit le fournisseur
// (Claude si BYOK connecté, Gemini sinon — cf. lib/ai-provider.ts) et retourne le
// texte brut de la réponse, quel que soit le provider. Les routes appelantes
// gardent leur propre logique de parsing (regex + JSON.parse) inchangée.

import { resolveAiProvider } from './ai-provider';
import { callAnthropicText, type AnthropicContentBlock, type AnthropicMessage } from './anthropic';
import { callGeminiText, dataUrlToInlineData, urlToInlineData, type GeminiContent, type GeminiPart } from './gemini';

type Turn = { role: 'user' | 'assistant'; text: string; images?: string[] };

function anthropicImageBlock(image: string): AnthropicContentBlock {
  if (image.startsWith('data:')) {
    const m = image.match(/^data:(image\/\w+);base64,([\s\S]+)$/);
    return { type: 'image', source: { type: 'base64', media_type: m?.[1] ?? 'image/png', data: m?.[2] ?? image } };
  }
  return { type: 'image', source: { type: 'url', url: image } };
}

async function geminiImagePart(image: string): Promise<GeminiPart> {
  return image.startsWith('data:') ? dataUrlToInlineData(image) : await urlToInlineData(image);
}

export async function generateAiText(params: {
  userId: string;
  system?: string;
  userText: string;
  images?: string[];
  temperature?: number;
  maxTokens: number;
  priorTurns?: Turn[];
  /** `high` : modèle de jugement côté Gemini (voir lib/gemini.ts). Sans effet sur
   *  Claude, dont le modèle unique réfléchit déjà. */
  quality?: 'fast' | 'high';
}): Promise<string> {
  const provider = await resolveAiProvider(params.userId);
  const turns: Turn[] = [...(params.priorTurns ?? []), { role: 'user', text: params.userText, images: params.images }];

  // QUI A RÉPONDU, ET AVEC QUEL DROIT DE RÉFLÉCHIR.
  //
  // Le palier de modèle ne se voit nulle part : deux routes sur dix demandent
  // `high`, les huit autres tournent sur le modèle rapide avec la réflexion
  // COUPÉE, et rien ne le dit. « L'IA n'écoute qu'à moitié les consignes » est
  // le symptôme exact de cette configuration, mais impossible à confirmer sans
  // regarder le code. De même, une clé Anthropic illisible bascule sur Gemini en
  // silence : l'utilisateur croit payer un modèle et en reçoit un autre.
  //
  // Une ligne par appel dans les journaux de la fonction, c'est tout ce qu'il
  // faut pour trancher la question en trente secondes.
  console.log(`[ia] ${provider.provider} · qualité=${params.quality ?? 'fast'}${provider.provider === 'gemini' && params.quality !== 'high' ? ' · réflexion coupée' : ''}`);

  if (provider.provider === 'anthropic') {
    const messages: AnthropicMessage[] = turns.map(t => ({
      role: t.role,
      content: [...(t.images ?? []).map(anthropicImageBlock), { type: 'text', text: t.text }],
    }));
    return callAnthropicText({
      apiKey: provider.apiKey,
      system: params.system,
      messages,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });
  }

  const contents: GeminiContent[] = [];
  for (const t of turns) {
    const imageParts = await Promise.all((t.images ?? []).map(geminiImagePart));
    contents.push({ role: t.role === 'assistant' ? 'model' : 'user', parts: [...imageParts, { text: t.text }] });
  }
  return callGeminiText({
    systemInstruction: params.system,
    contents,
    temperature: params.temperature,
    maxOutputTokens: params.maxTokens,
    quality: params.quality,
  });
}
