import PlanView from "./plan-view";
import { launchSeatsLeft } from "@/lib/launch-seats";

/* Composant serveur, uniquement pour lire les places de lancement restantes :
   `launch-seats` importe le client Stripe et ne peut pas vivre côté navigateur.
   Même schéma que la page d'accueil. */
export default async function OnboardingPlanPage() {
  const seatsLeft = await launchSeatsLeft();
  return <PlanView seatsLeft={seatsLeft} />;
}
