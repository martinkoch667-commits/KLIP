"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* Retour de la caisse Stripe. C'est ICI que l'essai commence vraiment, donc
   c'est ici que part le mail de bienvenue et qu'on présente le questionnaire.
   Avant, les deux tombaient au choix de l'offre : on souhaitait la bienvenue à
   quelqu'un qui n'avait encore rien payé, et on lui faisait choisir son offre
   une seconde fois sur /abonnement juste après. */

export default function CheckoutSuccessPage() {
  const t = useTranslations('checkoutSuccess');
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    let done = false;

    async function go() {
      if (done) return;
      done = true;
      // Le questionnaire n'est proposé qu'une fois, et seulement à qui ne l'a
      // pas déjà rempli : on ne le repose pas à un renouvellement.
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && !user.user_metadata?.onboarding_survey) {
          router.replace("/onboarding/survey");
          return;
        }
      } catch {
        // Sans réponse de Supabase, on n'insiste pas : l'app d'abord.
      }
      router.replace("/dashboard?welcome=true");
    }

    // Synchronise l'abonnement Stripe vers la base avant d'entrer dans l'app,
    // sinon le middleware renverrait vers /abonnement alors que c'est payé.
    fetch("/api/stripe/sync", { method: "POST" })
      .then(() => fetch("/api/email/welcome", { method: "POST" }).catch(() => {}))
      .then(() => go())
      .catch(() => go());

    // Garde-fou : on continue même si la synchronisation traîne.
    const timer = setTimeout(go, 4000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--canvas)", fontFamily: "var(--sans)" }}>
      <div style={{ textAlign: "center", color: "var(--ink-2)" }}>
        <div style={{ width: 40, height: 40, margin: "0 auto 16px", borderRadius: "50%", border: "3px solid rgba(189,242,160,.35)", borderTopColor: "var(--leaf)", animation: "lp-spin .8s linear infinite" }} />
        <p style={{ fontWeight: 700 }}>{t('activating')}</p>
        <style>{`@keyframes lp-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </main>
  );
}
