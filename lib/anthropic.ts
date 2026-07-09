// Appel texte/vision à Claude (utilisé quand l'utilisateur a connecté sa propre
// clé BYOK, cf. lib/ai-provider.ts). Sinon voir lib/gemini.ts (fournisseur par défaut).

export type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'url'; url: string } | { type: 'base64'; media_type: string; data: string } };

export type AnthropicMessage = { role: 'user' | 'assistant'; content: string | AnthropicContentBlock[] };

export async function callAnthropicText(params: {
  apiKey: string;
  system?: string;
  messages: AnthropicMessage[];
  temperature?: number;
  maxTokens: number;
}): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': params.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: params.maxTokens,
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      ...(params.system ? { system: params.system } : {}),
      messages: params.messages,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Erreur IA (Claude)');
  }
  const text = data.content?.[0]?.text ?? '';
  if (!text) throw new Error('Réponse IA vide (Claude)');
  return text;
}
