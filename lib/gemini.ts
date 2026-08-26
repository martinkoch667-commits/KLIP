// Appels texte/vision à Gemini (fournisseur IA par défaut, cf. lib/ai-provider.ts).
// Pour la génération d'images, voir app/api/generate-image/route.ts (modèle -image dédié).

// Modèle rapide : c'est LE modèle de secours de toute l'application. Il tourne
// en production depuis des mois, il est le moins cher et le plus disponible.
// Ne jamais le changer sans une raison forte : tout le reste retombe dessus.
const MODEL = 'gemini-2.5-flash';

// Modèle de jugement, pour les tâches où la QUALITÉ du choix prime sur la
// vitesse. `gemini-2.5-pro` a été RETIRÉ aux projets récents en cours de route
// (« no longer available to new users »), et comme rien ne rattrapait cet échec,
// la génération s'arrêtait net : « Génération interrompue », en pleine
// utilisation. Un modèle épinglé peut disparaître sans préavis ; c'est une
// certitude, pas un risque.
//
// EN PANNE OUVERTE, PILOTÉE PAR VARIABLE D'ENVIRONNEMENT.
// `gemini-2.5-pro` a été retiré ; son remplaçant `gemini-3.1-pro-preview` est
// une preview lente, et sans délai maximum sur l'appel une génération pouvait
// tourner indéfiniment — écran bloqué sur « Écriture des textes… », pire qu'une
// erreur franche. Le palier de qualité est donc DÉSACTIVÉ par défaut : tout
// passe par le modèle rapide, celui qui n'est jamais tombé.
//
// Pour le réactiver sans redéployer, poser AI_MODEL_QUALITY dans Vercel
// (ex. `gemini-3.1-pro-preview`) et vérifier les temps de réponse dans les
// journaux avant de le laisser en place.
const MODEL_QUALITY = process.env.AI_MODEL_QUALITY?.trim() || MODEL;

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
      // Budget borné en qualité haute : le droit de réfléchir, pas celui de faire
      // expirer la requête.
      // LA RÉFLEXION SUIT LE MODÈLE, PAS LE PALIER DEMANDÉ.
      //
      // Elle était activée dès qu'une route demandait `high`, même quand le
      // palier de qualité est désactivé et que tout retombe sur le modèle
      // rapide. Or la réflexion se PRÉLÈVE sur `maxOutputTokens` : 2048 jetons
      // de réflexion sur un budget de 1200 ne laissent rien pour la réponse, le
      // modèle renvoie un candidat vide, et l'appel échoue sur « Réponse IA
      // vide » — c'est-à-dire « La génération a échoué » à l'écran, alors que
      // rien n'est cassé côté modèle.
      //
      // On ne réfléchit donc que si un VRAI modèle de qualité est configuré, et
      // le budget est borné au tiers de la sortie pour qu'il reste toujours de
      // la place pour répondre.
      thinkingConfig: {
        thinkingBudget: params.quality === 'high' && MODEL_QUALITY !== MODEL
          ? Math.min(2048, Math.floor((params.maxOutputTokens ?? 2048) / 3))
          : 0,
      },
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      ...(params.maxOutputTokens !== undefined ? { maxOutputTokens: params.maxOutputTokens } : {}),
    },
  };
  if (params.systemInstruction) {
    body.systemInstruction = { parts: [{ text: params.systemInstruction }] };
  }

  // LE MODÈLE DE QUALITÉ NE DOIT JAMAIS POUVOIR COUPER LA GÉNÉRATION.
  //
  // On essaie le modèle demandé, et si le service le refuse — retiré, en preview
  // fermée, quota du palier, indisponible — on retombe IMMÉDIATEMENT sur le
  // modèle rapide, qui tourne depuis des mois. Une réponse un peu moins fine
  // vaut infiniment mieux qu'un « Génération interrompue » devant un client.
  //
  // Le repli est journalisé bruyamment : il ne doit pas devenir un état normal
  // qu'on découvre six mois plus tard sur la facture ou sur la qualité.
  const modeles = params.quality === 'high' ? [MODEL_QUALITY, MODEL] : [MODEL];
  let data: Record<string, unknown> & { error?: { message?: string }; candidates?: unknown[]; usageMetadata?: Record<string, number> } | null = null;
  let modeleUtilise = modeles[0];
  let derniereErreur = '';

  // UN APPEL QUI NE RÉPOND PAS DOIT ÉCHOUER, PAS ATTENDRE.
  //
  // Il n'y avait aucun délai maximum : un modèle lent ou muet laissait la
  // requête ouverte jusqu'à ce que la fonction serverless soit tuée, et
  // l'interface restait bloquée sur « Écriture des textes… » sans jamais rien
  // afficher. Une erreur en vingt-cinq secondes est infiniment plus utile
  // qu'une roue qui tourne : on peut la rattraper, la journaliser, réessayer.
  //
  // 25 s laisse la place au repli dans les 60 s de la fonction.
  for (const modele of modeles) {
    const stop = new AbortController();
    const minuteur = setTimeout(() => stop.abort(), 25_000);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: stop.signal }
      );
      const json = await response.json();
      if (response.ok) { data = json; modeleUtilise = modele; break; }
      derniereErreur = json.error?.message || `HTTP ${response.status}`;
      console.error(`[ia] ${modele} refusé : ${derniereErreur}`);
    } catch (e) {
      derniereErreur = e instanceof Error && e.name === 'AbortError'
        ? `${modele} n'a pas répondu en 25 s`
        : `${modele} injoignable : ${e instanceof Error ? e.message : String(e)}`;
      console.error(`[ia] ${derniereErreur}`);
    } finally {
      clearTimeout(minuteur);
    }
  }

  if (!data) throw new Error(derniereErreur || 'Erreur IA (Gemini)');
  if (modeleUtilise !== modeles[0]) {
    console.error(`[ia] REPLI sur ${modeleUtilise} : ${modeles[0]} indisponible. À corriger, ce n'est pas un état normal.`);
  }

  // CE QUE L'APPEL A COÛTÉ.
  //
  // Gemini renvoie `usageMetadata` à chaque réponse, et on le jetait. Résultat :
  // aucun endroit, ni dans le produit ni dans les journaux, ne disait ce que
  // coûtait une génération. Impossible de répondre à « je dépense combien ? »
  // autrement qu'en allant lire la facture Google, qui ne dit pas QUELLE
  // fonctionnalité consomme.
  //
  // `thoughtsTokenCount` est compté à part exprès : c'est la réflexion, elle est
  // facturée comme de la sortie, et c'est elle qu'on vient d'activer sur six
  // routes. Si la facture monte, on saura précisément de combien et où.
  const u = data.usageMetadata ?? {};
  const modele = modeleUtilise;
  console.log(
    `[ia:coût] ${modele} · entrée=${u.promptTokenCount ?? '?'} · sortie=${u.candidatesTokenCount ?? '?'}` +
    `${u.thoughtsTokenCount ? ` · réflexion=${u.thoughtsTokenCount}` : ''} · total=${u.totalTokenCount ?? '?'}`
  );

  const candidats = (data.candidates ?? []) as { content?: { parts?: { text?: string }[] } }[];
  const parts: { text?: string }[] = candidats[0]?.content?.parts ?? [];
  const text = parts.filter(p => typeof p.text === 'string').map(p => p.text).join('');
  if (!text) throw new Error('Réponse IA vide (Gemini)');
  return text;
}
