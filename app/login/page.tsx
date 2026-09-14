"use client";

/* Écran de connexion. Même carte que la fenêtre de connexion de la landing
 * (components/InscriptionOverlay, carte Curseurs violette, formulaire vert),
 * posée en page : Martin y est retombé depuis un lien de confirmation périmé
 * et trouvait encore l'ancien écran forêt (2026-09-14).
 *
 * Tout passe par la carte : `redirect` (où reprendre), `verif=ok|expire`
 * (posés par /auth/callback), Google, mot de passe oublié, et le renvoi du
 * lien quand l'adresse n'est pas confirmée.
 */

import InscriptionOverlay from "@/components/InscriptionOverlay";

export default function LoginPage() {
  return <InscriptionOverlay page={{ mode: "connexion" }} />;
}
