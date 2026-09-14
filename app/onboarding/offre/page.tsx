import OffreView from "./offre-view";
import { launchSeatsLeft } from "@/lib/launch-seats";

/* Composant serveur, uniquement pour lire les places de lancement restantes :
   `launch-seats` importe le client Stripe et ne peut pas vivre côté navigateur.
   Même schéma que la landing et que /onboarding/plan : sans ce compte, la page
   annoncerait encore la remise une fois les 25 places prises. */
export default async function OffrePage() {
  const seatsLeft = await launchSeatsLeft();
  return <OffreView seatsLeft={seatsLeft} />;
}
