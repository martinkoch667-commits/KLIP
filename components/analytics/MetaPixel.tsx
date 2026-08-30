"use client";

import Script from "next/script";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CONSENT_EVENT, readConsent } from "./consent";
import { PLANS, planKeyFromStripePlan, planValueEur } from "@/lib/plans";

import { PIXEL_ID } from "@/lib/meta-pixel";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

// Envoi d'un événement standard au pixel. Silencieux si le pixel n'est jamais
// chargé : sans consentement publicitaire il n'existe pas, et rien de ce qui
// suit ne doit alors se plaindre ni casser le parcours.
// L'eventID (partagé avec la Conversions API serveur) permet à Meta de
// dédupliquer un événement reçu deux fois (pixel + CAPI).
//
// Le script se charge en `afterInteractive` : une conversion déclenchée très
// tôt (le retour de caisse tire son StartTrial dès la réponse de Stripe) peut
// arriver avant lui. On réessaie donc quelques secondes plutôt que de perdre
// l'événement, puis on abandonne — c'est le cas « refus du bandeau ».
const RETRY_MS = 300;
const RETRY_MAX = 10;

function track(event: string, params?: Record<string, unknown>, eventID?: string, attempt = 0) {
  if (typeof window === "undefined") return;
  if (typeof window.fbq !== "function") {
    if (attempt < RETRY_MAX) {
      window.setTimeout(() => track(event, params, eventID, attempt + 1), RETRY_MS);
    }
    return;
  }
  window.fbq("track", event, params, eventID ? { eventID } : undefined);
}

// Déclenche un événement standard « Lead » sur une conversion (ex : inscription
// à la liste d'attente).
export function trackLead(params?: Record<string, unknown>, eventID?: string) {
  track("Lead", params, eventID);
}

/* ── Parcours d'essai ───────────────────────────────────────────────────────
   Deux événements, deux moments distincts, et Meta a besoin des deux pour
   optimiser : « InitiateCheckout » au départ vers la caisse Stripe, et
   « StartTrial » seulement au retour, quand l'abonnement d'essai existe
   vraiment. Compter le second au clic gonflerait les conversions de tous ceux
   qui abandonnent devant le formulaire de carte. */

type TrialPeriod = "monthly" | "yearly";

/** Nom d'offre Stripe ("starter" | "studio" | "agence") → paramètres Meta. */
function offerParams(plan: string | null | undefined, period: TrialPeriod | null | undefined) {
  const key = planKeyFromStripePlan(plan);
  const p = period === "yearly" ? "yearly" : "monthly";
  return {
    content_name: PLANS[key].label,
    content_category: p === "yearly" ? "annuel" : "mensuel",
    content_ids: [`${key}:${p}`],
    num_items: 1,
  };
}

/* Identifiant d'événement partagé avec la Conversions API serveur : Meta
   reçoit la conversion deux fois (navigateur + serveur) et n'en garde qu'une.
   Sans lui, la campagne compterait le double. */
function newEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `klip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Clic sur « Essai gratuit », juste avant le départ vers Stripe Checkout.
    Rend l'`eventId` à passer au serveur pour la CAPI, ou `null` si le
    consentement publicitaire n'a pas été accordé : dans ce cas personne ne
    suit, ni le navigateur ni le serveur. */
export function trackInitiateCheckout(plan: string, period: TrialPeriod): string | null {
  if (readConsent() !== "granted") return null;
  const eventID = newEventId();
  track(
    "InitiateCheckout",
    {
      value: planValueEur(planKeyFromStripePlan(plan), period),
      currency: "EUR",
      ...offerParams(plan, period),
    },
    eventID,
  );
  return eventID;
}

/** Retour de caisse, une fois l'abonnement d'essai créé côté Stripe.
    `value` vient du prix Stripe réellement souscrit ; à défaut on retombe sur
    la grille de lib/plans.ts. */
export function trackStartTrial(input: {
  plan?: string | null;
  period?: TrialPeriod | null;
  value?: number | null;
  currency?: string | null;
  eventId?: string | null;   // celui du serveur, pour dédupliquer avec la CAPI
}) {
  if (readConsent() !== "granted") return;
  const period = input.period === "yearly" ? "yearly" : "monthly";
  const value =
    typeof input.value === "number" && Number.isFinite(input.value)
      ? input.value
      : planValueEur(planKeyFromStripePlan(input.plan), period);
  track(
    "StartTrial",
    {
      value,
      currency: (input.currency || "EUR").toUpperCase(),
      ...offerParams(input.plan, period),
    },
    input.eventId || undefined,
  );
}

// Suit les changements de route côté client (App Router) et renvoie un PageView.
// Le premier PageView est déjà envoyé par le script d'init ci-dessous, on saute
// donc le montage initial pour éviter un double comptage.
function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstLoad = useRef(true);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    if (typeof window === "undefined" || typeof window.fbq !== "function") return;
    window.fbq("track", "PageView");
  }, [pathname, searchParams]);

  return null;
}

export default function MetaPixel() {
  // Consentement RGPD : le Meta Pixel est un traceur publicitaire, il n'est
  // chargé QU'APRÈS acceptation explicite via le bandeau (ConsentBanner).
  // On lit le choix stocké au montage, puis on écoute les changements en direct.
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    setGranted(readConsent() === "granted");
    const onChange = (e: Event) => {
      const value = (e as CustomEvent).detail;
      setGranted(value === "granted");
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  // Silencieux si aucun pixel n'est configuré, ou tant que le consentement
  // n'a pas été explicitement accordé.
  if (!PIXEL_ID || !granted) return null;

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${PIXEL_ID}');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
    </>
  );
}
