// Appels texte/vision à Gemini (fournisseur IA par défaut, cf. lib/ai-provider.ts).
// Pour la génération d'images, voir app/api/generate-image/route.ts (modèle -image dédié).

const MODEL = 'gemini-2.5-flash';
// Modèle de jugement, pour les tâches où la QUALITÉ du choix prime sur la vitesse
// (direction artistique). Le modèle rapide reste le défaut partout ailleurs.
const MODEL_QUALITY = 'gemini-2.5-pro';

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
export type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };

export function dataUrlToInlineData(dataUrl: string): { inlineData: { mimeType: string; data: string } } {
  const m = dataUrl.match(/^data:(image\/\w+);base64,([\s\S]+)$/);
  return { inlineData: { mimeType: m?.[1] ?? 'image/png', data: m?.[2] ?? dataUrl } };
}

export async function urlToInlineData(url: string): Promise<{ inlineData: { mimeType: string; data: string } }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Échec du téléchargement de l'image (${res.status})`);
  const buf = await res.arrayBuffer();
  const mimeType = res.headers.get('content-type') || 'image/jpeg';
  return { inlineData: { mimeType, data: Buffer.from(buf).toString('base64') } };
}

export async function callGeminiText(params: {
  systemInstruction?: string;
  contents: GeminiContent[];
  temperature?: number;
  maxOutputTokens?: number;
  /** `high` : modèle de jugement + droit de réfléchir. À réserver aux tâches où
   *  la qualité du choix compte plus que la seconde gagnée. */
  quality?: 'fast' | 'high';
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY manquante');

  const body: Record<string, unknown> = {
    contents: params.contents,
    generationConfig: {
      responseModalities: ['TEXT'],
      // gemini-2.5-flash est un modèle "thinking" : sur un gros system prompt avec
      // un maxOutputTokens modeste, la réflexion consomme tout le budget et le
      // texte revient VIDE ("Réponse IA vide") -> la génération échoue. On coupe
      // le budget de réflexion pour ces tâches JSON structurées (réponse fiable + rapide).
      //
      // Sauf en qualité `high` : juger une composition EST un travail de réflexion,
      // et la couper produisait exactement le reproche fait à l'outil — un choix
      // pris sans regarder vraiment. On laisse alors le modèle réfléchir.
      ...(params.quality === 'high' ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      ...(params.maxOutputTokens !== undefined ? { maxOutputTokens: params.maxOutputTokens } : {}),
    },
  };
  if (params.systemInstruction) {
    body.systemInstruction = { parts: [{ text: params.systemInstruction }] };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${params.quality === 'high' ? MODEL_QUALITY : MODEL}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Erreur IA (Gemini)');
  }

  const parts: { text?: string }[] = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter(p => typeof p.text === 'string').map(p => p.text).join('');
  if (!text) throw new Error('Réponse IA vide (Gemini)');
  return text;
}
