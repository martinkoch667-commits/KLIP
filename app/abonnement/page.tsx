import AbonnementView from "./abonnement-view";
import { launchSeatsLeft } from "@/lib/launch-seats";

/* Composant serveur : `launch-seats` interroge Stripe et ne peut pas tourner
   dans le navigateur. Il ne fait que passer les places restantes à la vue, pour
   que l'écran annonce exactement ce que la caisse va débiter. */
export default async function AbonnementPage() {
  const seatsLeft = await launchSeatsLeft();
  return <AbonnementView seatsLeft={seatsLeft} />;
}
