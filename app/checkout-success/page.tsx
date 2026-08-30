"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { trackStartTrial } from "@/components/analytics/MetaPixel";
import { readConsent } from "@/components/analytics/consent";

/* Conversion Meta « StartTrial ». Elle part d'ici et pas du clic sur l'offre :
   ce n'est un essai que si Stripe a vraiment créé l'abonnement, et /api/stripe/sync
   vient de nous le dire (status, offre, montant du prix souscrit).
   Une seule fois par abonnement : la page peut être rechargée, ou remontée deux
   fois en développement (StrictMode), et Meta compterait deux essais. */
function reportStartTrial(sync: {
  status?: string;
  subscriptionId?: string;
  eventId?: string;
  plan?: string | null;
  period?: "monthly" | "yearly" | null;
  value?: number | null;
  currency?: string | null;
} | null) {
  if (!sync || sync.status !== "trialing") return; // renouvellement, pas un essai
  const key = `klip-starttrial:${sync.subscriptionId ?? "unknown"}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
  } catch {
    // navigation privée : tant pis pour le garde-fou, l'essai se compte quand même
  }
  // Le même eventId que celui de la CAPI : Meta reçoit l'essai deux fois et
  // n'en compte qu'un.
  trackStartTrial({
    plan: sync.plan,
    period: sync.period,
    value: sync.value,
    currency: sync.currency,
    eventId: sync.eventId,
  });
}

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

    /* Le paiement a abouti : l'intention de caisse mémorisée avant inscription
       n'a plus lieu d'être. Sans cet effacement, le tableau de bord la trouvait
       encore et rouvrait une SECONDE caisse juste après le paiement — vu en
       test, 41 s après un abonnement réussi. */
    try { localStorage.removeItem("klip_pending_checkout"); } catch { /* ignore */ }

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
    fetch("/api/stripe/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Le serveur n'a aucun moyen de connaître le choix du bandeau : c'est
      // lui qui décide s'il envoie la conversion à la Conversions API.
      body: JSON.stringify({ trackingConsent: readConsent() === "granted" }),
    })
      .then((r) => r.json().catch(() => null))
      .then((sync) => {
        reportStartTrial(sync);
        return fetch("/api/email/welcome", { method: "POST" }).catch(() => {});
      })
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
