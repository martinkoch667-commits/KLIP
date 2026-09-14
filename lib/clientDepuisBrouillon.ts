/* Crée le client (workspace) à partir du brouillon du parcours d'essai.
 *
 * Appelé au retour de la caisse Stripe (/checkout-success) : l'abonnement vient
 * d'être synchronisé, donc la limite de clients de l'offre est connue. Avant,
 * rien ne lisait le brouillon après le paiement : la personne avait donné son
 * site, relu sa charte, puis retrouvait une application vide et devait tout
 * ressaisir dans « Nouveau client ».
 *
 * Même route que l'écran « Nouveau client » (`/api/workspace/create`), mêmes
 * colonnes. Le logo du site est recopié dans le stockage de Klip, comme le fait
 * cet écran : une adresse externe casserait l'export (CORS) le jour où le site
 * change.
 *
 * Une seule fois : l'identifiant créé est écrit dans le brouillon, un
 * rechargement de la page ne crée pas de doublon. Les valeurs d'exemple (la
 * lecture du site a échoué) ne deviennent jamais un client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { lireDraft, ecrireDraft } from "@/lib/onboardingDraft";

async function recopierLogo(supabase: SupabaseClient, url: string, userId: string): Promise<string | null> {
  try {
    await fetch("/api/ensure-buckets", { method: "POST" }).catch(() => {});
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
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

/** Vrai quand le brouillon mérite de devenir un client. */
export function brouillonUtile(): boolean {
  const d = lireDraft();
  return !!(d && !d.demo && d.name?.trim() && !d.clientId);
}

export async function creerClientDepuisBrouillon(supabase: SupabaseClient): Promise<string | null> {
  const d = lireDraft();
  if (!d) return null;
  if (d.clientId) return d.clientId;
  if (d.demo || !d.name?.trim()) return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const couleurs = (d.colors ?? []).filter(Boolean);
  const logo = d.logoUrl ? await recopierLogo(supabase, d.logoUrl, session.user.id) : null;

  const corps: Record<string, unknown> = {
    name: d.name.trim(),
    sector: d.sector || null,
    tone: d.tone || null,
    company_description: d.description?.trim() || null,
    instagram_username: d.handle?.replace(/^@/, "").trim() || null,
    primary_color: couleurs[0] ?? null,
    secondary_color: couleurs[1] ?? null,
    accent_color: couleurs[2] ?? null,
    brand_colors: couleurs,
    font_family: d.fonts?.[0] || null,
    font_secondary: d.fonts?.[1] || null,
    ...(logo ? { logo_url: logo } : {}),
  };

  try {
    const res = await fetch("/api/workspace/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.workspace?.id) {
      console.error("[client-brouillon] création refusée :", json?.error ?? res.status);
      return null;
    }
    ecrireDraft({ ...d, clientId: json.workspace.id as string });
    return json.workspace.id as string;
  } catch (err) {
    console.error("[client-brouillon] création impossible :", err);
    return null;
  }
}
