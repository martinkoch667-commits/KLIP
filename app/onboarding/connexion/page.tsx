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
 * RESTE À BRANCHER. La vraie autorisation (`/api/auth/meta/connect`) exige un
 * `workspaceId` et renvoie sur l'adresse de production : la boucle ne peut se
 * fermer ni sur localhost, ni avant que le compte et le client existent. Les
 * deux boutons enregistrent donc l'état « relié » et passent à la suite.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingShell from "@/components/OnboardingShell";
import { Sticker } from "@/components/Stickers";
import { lireDraft, ecrireDraft } from "@/lib/onboardingDraft";

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

  function relier() {
    const d = lireDraft();
    ecrireDraft({ ...(d ?? { source: "manuel", prefilled: [] }), igConnected: true });
    router.push("/onboarding/site");
  }

  function passer() {
    const d = lireDraft();
    ecrireDraft({ ...(d ?? { source: "manuel", prefilled: [] }), igConnected: false });
    router.push("/onboarding/site");
  }

  return (
    <OnboardingShell bas={
      <>
        <button type="button" className="ob-btn ob-btn-ig" onClick={relier}>
          <IcInstagram /> Continuer avec Instagram
        </button>
        <button type="button" className="ob-btn ob-btn-fb" onClick={relier}>
          <IcFacebook /> Continuer avec Facebook
        </button>
        <p className="ob-fin">
          On ne publie rien sans vous.{" "}
          <button type="button" className="ob-lien" onClick={() => setAvertit(true)}>Passer</button>
        </p>
      </>
    }>
      {/* Le titre dit ce qu'on PRODUIT, le sous-titre dit ce qu'on prend pour
          le produire. La version précédente (« On part de votre compte / On y
          lit vos couleurs, vos habitudes… ») décrivait la lecture sans jamais
          dire à quoi elle sert : on comprenait qu'on nous regardait, pas ce
          qu'on allait recevoir. */}
      <h1 className="ob-h1">
        Vos posts, à&nbsp;votre <span className="acc-hl">image</span>
      </h1>
      <p className="ob-sub">
        Vos couleurs, vos polices, votre mise en page : on les reprend pour composer vos visuels.
      </p>

      {/* Le vide entre le titre et l'action n'existe que sur téléphone : on y
          pose le vocabulaire de la marque plutôt que du blanc. */}
      <div className="ob-visuel" aria-hidden="true">
        <Sticker name="sparkle" size={44} float="spin" />
        <Sticker name="eyes" size={76} float="B" />
        <Sticker name="heart" size={40} float="A" style={{ ["--r" as string]: "-10deg" }} />
      </div>

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
  );
}
