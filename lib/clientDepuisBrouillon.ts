/* Écrit le client (workspace) du parcours d'essai à partir du brouillon.
 *
 * Appelé au retour de la caisse Stripe (/checkout-success) : l'abonnement vient
 * d'être synchronisé, donc la limite de clients de l'offre est connue. Avant,
 * rien ne lisait le brouillon après le paiement : la personne avait donné son
 * site, relu sa charte, puis retrouvait une application vide.
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

export async function creerClientDepuisBrouillon(supabase: SupabaseClient): Promise<string | null> {
  const d = lireDraft();
  if (!d || d.demo || !d.name?.trim()) return d?.clientId ?? null;
  if (d.charteEcrite) return d.clientId ?? null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const logo = d.logoUrl ? await recopierLogo(supabase, d.logoUrl, session.user.id) : null;
  const champs = champsCharte(d, logo);

  if (d.clientId) {
    const ok = await mettreAJour(supabase, d.clientId, champs);
    if (ok) ecrireDraft({ ...d, charteEcrite: true });
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
    ecrireDraft({ ...d, clientId: json.workspace.id as string, charteEcrite: true });
    return json.workspace.id as string;
  } catch (err) {
    console.error("[client-brouillon] création impossible :", err);
    return null;
  }
}
