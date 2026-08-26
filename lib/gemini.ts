// Appels texte/vision à Gemini (fournisseur IA par défaut, cf. lib/ai-provider.ts).
// Pour la génération d'images, voir app/api/generate-image/route.ts (modèle -image dédié).

// MESURES DU 26/08 SUR LA CLÉ DE PRODUCTION, avec un vrai prompt de génération.
// Elles contredisent l'idée qu'il suffit de prendre « le dernier Gemini » :
//
//   gemini-2.5-flash        sans réflexion    1,0 s   ✓
//   gemini-2.5-flash        réflexion 1024    2,6 s   ✓  (329 jetons de pensée)
//   gemini-2.5-pro          —                  —      RETIRÉ aux projets récents
//   gemini-3.1-pro-preview  réflexion 1024   28,0 s   ✓ mais inutilisable
//   gemini-3.1-pro-preview  réflexion auto   57,2 s   ✓ mais inutilisable
//   gemini-3.7-flash        réflexion 1024   60,8 s   REFUSÉ « high demand »
//   gemini-3.7-flash        défaut           75,0 s   expiré
//
// Conclusion : le gain de qualité ne vient pas d'un modèle plus récent, il vient
// de la RÉFLEXION. Le modèle rapide qui réfléchit répond en 2,6 s ; le modèle
// récent qui réfléchit met dix fois plus longtemps pour un résultat comparable,
// quand il n'est pas simplement saturé. Les previews ne sont pas dimensionnées
// pour de la production.
const MODEL = 'gemini-2.5-flash';

// Le palier de jugement, c'est donc le MÊME modèle avec le droit de réfléchir.
// `AI_MODEL_QUALITY` reste là pour épingler un autre modèle sans redéployer, le
// jour où un successeur stable sortira — à condition de mesurer ses temps de
// réponse avant de l'y laisser.
const MODEL_QUALITY = process.env.AI_MODEL_QUALITY?.trim() || MODEL;

// Jetons de réflexion en qualité haute. Mettre 0 désactive complètement le
// palier de jugement, partout, sans redéploiement : c'est le coupe-circuit.
const REFLEXION = Math.max(0, Number(process.env.AI_THINKING_BUDGET ?? 1024));

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

  // Le droit de réfléchir n'est accordé qu'en qualité haute. `gemini-3.1-pro-preview`
  // refuse d'ailleurs un budget nul (« This model only works in thinking mode »),
  // donc épingler un tel modèle sans réflexion serait une panne garantie.
  const reflexion = params.quality === 'high' ? REFLEXION : 0;

  const body: Record<string, unknown> = {
    contents: params.contents,
    generationConfig: {
      responseModalities: ['TEXT'],
      // POURQUOI LA RÉFLEXION EST COUPÉE PAR DÉFAUT.
      //
      // `gemini-2.5-flash` est un modèle qui pense. Sur une tâche JSON courte, la
      // pensée n'apporte rien et coûte du temps ; pire, elle se prélève sur le
      // budget de sortie, donc un budget serré revenait VIDE et la génération
      // échouait. Le défaut est donc zéro : réponse fiable et rapide.
      //
      // La qualité haute lui rend ce droit, parce qu'il y a des tâches où juger
      // EST le travail : choisir une composition, écrire huit slides qui
      // s'enchaînent, diriger un montage. Mesuré à 2,6 s contre 1,0 s — le prix
      // est raisonnable, contrairement aux modèles récents (28 à 75 s).
      thinkingConfig: { thinkingBudget: reflexion },
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      // LA RÉFLEXION SE PRÉLÈVE SUR LE BUDGET DE SORTIE.
      //
      // C'est le piège qui a produit « La génération a échoué » : demander 2048
      // jetons de réflexion sur un budget de 1200 ne laisse rien pour écrire, le
      // modèle renvoie un candidat vide, et l'appel casse. On RELÈVE donc le
      // plafond de la valeur du budget de réflexion, au lieu de rogner la
      // réponse : l'appelant obtient toujours la longueur qu'il a demandée.
      ...(params.maxOutputTokens !== undefined
        ? { maxOutputTokens: params.maxOutputTokens + reflexion }
        : {}),
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
