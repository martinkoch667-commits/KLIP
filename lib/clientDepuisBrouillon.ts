/* Écrit le client (workspace) du parcours d'essai à partir du brouillon.
 *
 * Appelé DEUX fois : au clic sur « Générer mes visuels » (fin de la charte,
 * `force`), puis au retour de la caisse Stripe (/checkout-success) par
 * sécurité. N'écrire qu'au retour de Stripe laissait le client VIDE dès que ce
 * retour n'avait pas lieu : compte déjà abonné (la caisse refuse un second
 * abonnement), paiement abandonné, entrée dans l'app par un autre chemin.
 * Martin a retrouvé un client sans aucune de ses informations (14/09/2026).
 *
 * Deux cas :
 *  · le client EXISTE déjà (créé à l'étape Instagram/Facebook, qui en a besoin
 *    pour relier le compte) : on y recopie la charte ;
 *  · sinon on le crée, par la même route que l'écran « Nouveau client »
 *    (`/api/workspace/create`).
 *
 * Le logo du site est recopié dans le stockage de Klip, comme le fait cet
 * écran : une adresse externe casserait l'export (CORS) le jour où le site
 * change. Une seule fois (`charteEcrite`), jamais à partir des valeurs
 * d'exemple.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { lireDraft, ecrireDraft, type OnbDraft } from "@/lib/onboardingDraft";

async function recopierLogo(supabase: SupabaseClient, url: string, userId: string): Promise<string | null> {
  try {
    await fetch("/api/ensure-buckets", { method: "POST" }).catch(() => {});
    // Logo déposé sur l'écran de la charte : une adresse data:, lue directement.
    const res = await fetch(url.startsWith("data:") ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    // Plusieurs mégaoctets : presque toujours une photo prise pour un logo.
    if (!blob.type.startsWith("image/") || blob.size > 3 * 1024 * 1024) return null;
    const ext = blob.type.includes("svg") ? "svg" : blob.type.includes("png") ? "png" : "jpg";
    const chemin = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("brand-assets").upload(chemin, blob, { contentType: blob.type });
    if (error) { console.warn("[client-brouillon] logo non recopié :", error.message); return null; }
    return supabase.storage.from("brand-assets").getPublicUrl(chemin).data.publicUrl;
  } catch (err) {
    console.warn("[client-brouillon] logo non recopié :", err);
    return null;
  }
}

/** Vrai quand le brouillon a une charte à écrire dans un client. */
export function brouillonUtile(): boolean {
  const d = lireDraft();
  return !!(d && !d.demo && d.name?.trim() && !d.charteEcrite);
}

function champsCharte(d: OnbDraft, logo: string | null): Record<string, unknown> {
  const couleurs = (d.colors ?? []).filter(Boolean);
  const handle = d.handle?.replace(/^@/, "").trim();
  return {
    name: d.name!.trim(),
    sector: d.sector || null,
    tone: d.tone || null,
    // La charte édite `headline` (la carte « Description ») : c'est la version relue.
    company_description: d.headline?.trim() || d.description?.trim() || null,
    // Relié à l'étape Instagram, le nom du compte est déjà en base : on ne
    // l'écrase pas par un champ vide.
    ...(handle ? { instagram_username: handle } : {}),
    // Vocabulaire et voix, construits comme dans « Nouveau client ».
    words_to_use: d.wordsToUse?.length ? d.wordsToUse.join(", ") : null,
    words_to_avoid: d.wordsToAvoid?.length ? d.wordsToAvoid.join(", ") : null,
    brand_voice_prompt: [
      d.tone && `Ton : ${d.tone}`,
      d.wordsToUse?.length && `Mots à utiliser : ${d.wordsToUse.join(", ")}`,
      d.wordsToAvoid?.length && `Mots à ne jamais utiliser : ${d.wordsToAvoid.join(", ")}`,
    ].filter(Boolean).join("\n") || null,
    primary_color: couleurs[0] ?? null,
    secondary_color: couleurs[1] ?? null,
    accent_color: couleurs[2] ?? null,
    brand_colors: couleurs,
    font_family: d.fonts?.[0] || null,
    font_secondary: d.fonts?.[1] || null,
    ...(logo ? { logo_url: logo } : {}),
  };
}

/** Mise à jour tolérante : une colonne absente en base (migration en retard)
 *  est retirée et la mise à jour repart, comme dans « Nouveau client ». */
async function mettreAJour(supabase: SupabaseClient, id: string, champs: Record<string, unknown>): Promise<boolean> {
  let aEcrire = { ...champs };
  for (let i = 0; i <= 8; i++) {
    const { error } = await supabase.from("workspaces").update(aEcrire).eq("id", id);
    if (!error) return true;
    const manquante = Object.keys(aEcrire).find(c => c !== "name" && error.message?.includes(c));
    if (!manquante) {
      console.error("[client-brouillon] mise à jour refusée :", error.message);
      return false;
    }
    const { [manquante]: _omise, ...reste } = aEcrire;
    aEcrire = reste;
  }
  return false;
}

export async function creerClientDepuisBrouillon(
  supabase: SupabaseClient,
  { force = false }: { force?: boolean } = {},
): Promise<string | null> {
  const d = lireDraft();
  if (!d || d.demo || !d.name?.trim()) return d?.clientId ?? null;
  // `force` : la fin de la charte réécrit toujours (une correction a pu suivre).
  if (d.charteEcrite && !force) return d.clientId ?? null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const logo = !d.logoUrl ? null
    : d.logoStocke && d.logoSource === d.logoUrl ? d.logoStocke
    : await recopierLogo(supabase, d.logoUrl, session.user.id);
  const champs = champsCharte(d, logo);
  const traces = logo ? { logoStocke: logo, logoSource: d.logoUrl } : {};

  if (d.clientId) {
    const ok = await mettreAJour(supabase, d.clientId, champs);
    ecrireDraft({ ...d, ...traces, charteEcrite: ok });
    return d.clientId;
  }

  try {
    const res = await fetch("/api/workspace/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(champs),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.workspace?.id) {
      console.error("[client-brouillon] création refusée :", json?.error ?? res.status);
      return null;
    }
    ecrireDraft({ ...d, ...traces, clientId: json.workspace.id as string, charteEcrite: true });
    return json.workspace.id as string;
  } catch (err) {
    console.error("[client-brouillon] création impossible :", err);
    return null;
  }
}
