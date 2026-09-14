import PlanView from "./plan-view";
import { launchSeatsLeft } from "@/lib/launch-seats";
import { priceId } from "@/lib/stripe";

/* Composant serveur, uniquement pour lire les places de lancement restantes :
   `launch-seats` importe le client Stripe et ne peut pas vivre côté navigateur.
   Même schéma que la page d'accueil. */
export default async function OnboardingPlanPage() {
  const seatsLeft = await launchSeatsLeft();
  // Starter sans prix Stripe : sa carte mènerait à « Offre non configurée ».
  const starterPayable = !!(priceId("starter", "monthly") && priceId("starter", "yearly"));
  return <PlanView seatsLeft={seatsLeft} starterPayable={starterPayable} />;
}
