import OffreView from "./offre-view";
import { launchSeatsLeft } from "@/lib/launch-seats";
import { priceId } from "@/lib/stripe";

/* Composant serveur, uniquement pour lire les places de lancement restantes :
   `launch-seats` importe le client Stripe et ne peut pas vivre côté navigateur.
   Même schéma que la landing et que /onboarding/plan : sans ce compte, la page
   annoncerait encore la remise une fois les 25 places prises. */
export default async function OffrePage() {
  const seatsLeft = await launchSeatsLeft();
  /* Une offre sans prix Stripe sur les deux périodes ne s'affiche pas : son
     bouton ne mènerait qu'à « Offre non configurée côté paiement ». Starter est
     la seule concernée à ce jour (voir lib/stripe.ts). */
  const offresPayables = (["starter", "studio", "agence"] as const)
    .filter(plan => priceId(plan, "monthly") && priceId(plan, "yearly"));
  return <OffreView seatsLeft={seatsLeft} offresPayables={[...offresPayables]} />;
}
