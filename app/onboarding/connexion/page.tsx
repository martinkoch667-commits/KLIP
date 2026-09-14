"use client";

/* Premier écran du parcours d'essai : relier le compte Meta.
 *
 * POURQUOI ICI ET PAS APRÈS LE PAIEMENT. La mesure d'ADN visuel
 * (`lib/brandDNA.ts`) ne lit pas Instagram, elle mesure une LISTE D'IMAGES ; la
 * connexion ne sert qu'à obtenir cette liste. Sans elle, le site donne une
 * charte (couleurs, polices, logo) mais aucune HABITUDE : ni l'endroit où la
 * marque écrit sur ses photos, ni ses motifs, ni sa palette réelle relevée sur
 * ses posts.
 *
 * ELLE RESTE SAUTABLE. C'est l'étape la plus fragile du produit (autorisation
 * Meta, compte professionnel obligatoire) : la bloquer, c'est perdre la
 * personne au premier écran. On dit ce qu'elle perd, dans une modale, et on la
 * laisse passer.
 *
 * LA CONNEXION EST RÉELLE (2026-09-14). Elle était simulée tant que le compte
 * n'existait pas à cette étape ; la barre e-mail de la landing le crée
 * maintenant avant le parcours. L'autorisation Meta (`/api/auth/meta/connect`
 * pour Instagram, `/api/auth/facebook/connect` pour Facebook) exige un client :
 * on le crée ici sous un nom provisoire, son id part dans le brouillon, et
 * `/checkout-success` y recopiera la charte après le paiement. Le retour de
 * Meta revient sur cet écran (`from=essai`), qui passe à la suite ou dit ce
 * qui a échoué. Ne marche que sur getklip.fr : Meta ne renvoie que là.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import OnboardingShell, { MotChoisi, CurseurNomme } from "@/components/OnboardingShell";
import InscriptionOverlay, { ouvrirCompte } from "@/components/InscriptionOverlay";
import { lireDraft, ecrireDraft, type OnbDraft } from "@/lib/onboardingDraft";
import { dominantColorsFromImage } from "@/lib/brandPalette";

type Reseau = "instagram" | "facebook";

/** Ce que renvoient les callbacks Meta (`?error=`), dit à la personne. */
const ERREURS: Record<string, string> = {
  cancelled: "La connexion a été annulée. Réessayez, ou passez cette étape.",
  no_pages: "Aucune Page Facebook sur ce compte. Essayez avec Instagram, ou passez cette étape.",
  token: "La connexion n'a pas abouti. Réessayez dans un instant.",
  save_failed: "La connexion n'a pas pu être enregistrée. Réessayez dans un instant.",
  unknown: "La connexion n'a pas abouti. Réessayez dans un instant.",
};

/** L'étape suivante est TOUJOURS le site, qu'on relie un compte ou qu'on passe
 *  (Martin, 2026-09-14). Avant, un site gardé d'un essai précédent dans le même
 *  onglet faisait sauter l'étape : « Passer » menait au questionnaire. Le site
 *  déjà connu est proposé pré-rempli sur l'écran suivant. */
function etapeSuivante(_d: OnbDraft | null) {
  return "/onboarding/site";
}

function IcInstagram() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.4" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IcFacebook() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.9h-2.33V22c4.78-.76 8.45-4.92 8.45-9.94Z" />
    </svg>
  );
}

export default function ConnexionPage() {
  const router = useRouter();
  const [avertit, setAvertit] = useState(false);
  const [enCours, setEnCours] = useState<Reseau | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  /* Retour de Meta : `?ws=…&connected=true` ou `?ws=…&error=…`. L'adresse est
     nettoyée tout de suite, sinon un rechargement rejouerait le retour. */
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const ws = q.get("ws");
    const connecte = q.get("connected") === "true";
    const code = q.get("error");
    if (!ws || (!connecte && !code)) return;
    history.replaceState(null, "", location.pathname);
    const d = lireDraft();
    const base = { ...(d ?? { source: "manuel" as const, prefilled: [] }), clientId: ws };
    if (!connecte) {
      ecrireDraft(base);
      setErreur(ERREURS[code ?? ""] ?? ERREURS.unknown);
      return;
    }
    /* Même lecture que « Nouveau client » au retour d'Instagram : le profil
       (/api/instagram/profile) donne le nom du compte, la bio (souvent la
       meilleure description) et la photo de profil, qui EST le logo et dont
       les couleurs sont celles de la marque. Tout est un bonus : la connexion
       a réussi, un échec ici n'empêche pas d'avancer. */
    void (async () => {
      const suite = { ...base, igConnected: true } as OnbDraft;
      try {
        const res = await fetch(`/api/instagram/profile?workspaceId=${ws}`);
        const p = res.ok ? await res.json() : null;
        if (p?.username) { suite.handle = p.username; if (!suite.name) suite.name = p.username; }
        if (p?.biography && !suite.description) { suite.description = p.biography; suite.headline = p.biography; }
        if (p?.profile_picture_url) {
          suite.igLogo = p.profile_picture_url;
          const cols = await dominantColorsFromImage(p.profile_picture_url, 5);
          if (cols.length) suite.igColors = cols;
        }
      } catch { /* pré-remplissage seulement */ }
      if (!suite.handle) {
        try {
          const { data } = await createClientComponentClient()
            .from("workspaces").select("instagram_username").eq("id", ws).maybeSingle();
          if (data?.instagram_username) suite.handle = data.instagram_username as string;
        } catch { /* le champ restera à remplir */ }
      }
      ecrireDraft(suite);
      router.push(etapeSuivante(d));
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function relier(reseau: Reseau) {
    if (enCours) return;
    setErreur(null);
    setEnCours(reseau);
    const supabase = createClientComponentClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Arrivée ici sans compte : on le crée d'abord, puis retour sur cet écran.
      setEnCours(null);
      ouvrirCompte("inscription", undefined, "/onboarding/connexion");
      return;
    }
    const d = lireDraft();
    let ws = d?.clientId;
    if (!ws) {
      // Nom passé en argument, jamais relu d'un état qu'on viendrait de poser
      // (voir la mémoire « Connexion Instagram muette »).
      try {
        const res = await fetch("/api/workspace/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: d?.name?.trim() || "Nouveau client" }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.workspace?.id) {
          // Le message du serveur tel quel : c'est lui qui explique (limite d'offre…).
          setErreur(json?.error ?? "Impossible de préparer la connexion. Réessayez dans un instant.");
          setEnCours(null);
          return;
        }
        ws = json.workspace.id as string;
        ecrireDraft({ ...(d ?? { source: "manuel", prefilled: [] }), clientId: ws });
      } catch {
        setErreur("Impossible de préparer la connexion. Réessayez dans un instant.");
        setEnCours(null);
        return;
      }
    }
    const route = reseau === "facebook" ? "/api/auth/facebook/connect" : "/api/auth/meta/connect";
    window.location.href = `${route}?workspaceId=${ws}&from=essai`;
  }

  function passer() {
    const d = lireDraft();
    ecrireDraft({ ...(d ?? { source: "manuel", prefilled: [] }), igConnected: false });
    router.push(etapeSuivante(d));
  }

  return (
    <>
    <InscriptionOverlay />
    <OnboardingShell chemin="connexion" intro={
      <>
        {/* Le titre dit ce qu'on PRODUIT, le sous-titre dit ce qu'on prend pour
            le produire. La version précédente (« On part de votre compte / On y
            lit vos couleurs, vos habitudes… ») décrivait la lecture sans jamais
            dire à quoi elle sert : on comprenait qu'on nous regardait, pas ce
            qu'on allait recevoir. */}
        <h1 className="ob-h1">
          Vos posts, à&nbsp;votre <MotChoisi>image</MotChoisi>
        </h1>
        <p className="ob-sub">
          Vos couleurs, vos polices, votre mise en page : on les reprend pour composer vos visuels.
        </p>
      </>
    } bas={
      <>
        {erreur && <p className="ob-fin" role="alert" style={{ color: "#C4452F", fontWeight: 700, margin: "0 0 12px" }}>{erreur}</p>}
        <button type="button" className="ob-btn ob-btn-ig" onClick={() => void relier("instagram")} disabled={!!enCours}>
          <IcInstagram /> {enCours === "instagram" ? "Ouverture d'Instagram…" : "Continuer avec Instagram"}
        </button>
        <button type="button" className="ob-btn ob-btn-fb" onClick={() => void relier("facebook")} disabled={!!enCours}>
          <IcFacebook /> {enCours === "facebook" ? "Ouverture de Facebook…" : "Continuer avec Facebook"}
        </button>
        <p className="ob-fin">
          On ne publie rien sans vous.{" "}
          <button type="button" className="ob-lien" onClick={() => setAvertit(true)}>Passer</button>
        </p>
      </>
    }>
      {/* Ce que Klip reprend, en curseurs nommés : le vocabulaire de l'éditeur
          (page d'offre, carte Curseurs) dès le premier écran. Ils remplacent les
          stickers, qui parlaient une autre langue que le reste du parcours. */}
      <div className="cx-curseurs">
        <CurseurNomme nom="Vos couleurs" teinte="violet" style={{ left: "6%", top: "8%", ["--d" as string]: "0s" }} />
        <CurseurNomme nom="Vos polices" teinte="vert" style={{ left: "52%", top: "0%", ["--d" as string]: "-1.3s" }} />
        <CurseurNomme nom="Votre mise en page" teinte="ambre" style={{ left: "24%", top: "52%", ["--d" as string]: "-2.2s" }} />
      </div>
      <style>{`.cx-curseurs{position:relative;height:118px;max-width:360px;margin:6px auto 0;}
        @media(max-width:639px){.cx-curseurs{height:96px;margin-top:clamp(6px,2vh,20px);}}`}</style>

      {avertit && (
        <div className="ob-mod-bg" onClick={() => setAvertit(false)}>
          {/* Ce qui se perd, dit simplement : sans la connexion, Klip ne peut
              pas lire le compte, donc il travaille sans aucune référence de la
              marque. Écrit pour quelqu'un qui découvre le produit — on ne parle
              ni du site ni des étapes suivantes, dont la personne ignore encore
              l'existence à cet instant. */}
          <div className="ob-mod" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="ob-mod-h">On ne verra pas vos posts</h2>
            <p className="ob-mod-p">
              Klip analyse vos publications pour composer vos visuels. Sans la
              connexion, il n&apos;a aucune référence de votre marque.
            </p>
            <button className="ob-btn ob-btn-leaf" onClick={() => setAvertit(false)}>Connecter mon compte</button>
            <p className="ob-fin">
              <button type="button" className="ob-lien" onClick={passer}>Passer et faire sans</button>
            </p>
          </div>
        </div>
      )}
    </OnboardingShell>
    </>
  );
}
