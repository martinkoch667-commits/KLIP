import { redirect } from "next/navigation";

/* L'ancien écran d'offre (PricingUI) renvoie sur /onboarding/offre, qui a la
   direction du parcours d'essai et la même logique de caisse (type de compte,
   agence, Stripe). Il reste joignable parce que le middleware y envoie un
   compte sans offre et que les réglages y mènent (« Changer de plan »). */
export default function OnboardingPlanPage() {
  redirect("/onboarding/offre");
}
