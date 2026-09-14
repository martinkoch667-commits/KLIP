"use client";

/* Écran d'inscription. Même carte que la fenêtre de la landing, en page (voir
 * app/login/page.tsx). `plan` (offre cliquée) et `redirect` sont lus par la
 * carte, comme le faisait l'ancien écran.
 */

import InscriptionOverlay from "@/components/InscriptionOverlay";

export default function RegisterPage() {
  return <InscriptionOverlay page={{ mode: "inscription" }} />;
}
