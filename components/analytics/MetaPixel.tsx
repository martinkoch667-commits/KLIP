"use client";

import Script from "next/script";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CONSENT_EVENT, readConsent } from "./consent";

// ID par défaut (public — visible côté navigateur, ce n'est pas un secret).
// La variable d'environnement NEXT_PUBLIC_FB_PIXEL_ID reste prioritaire si définie.
const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "1998010880798347";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

// Déclenche un événement standard « Lead » sur une conversion (ex : inscription
// à la liste d'attente). Silencieux si le pixel n'est pas chargé.
export function trackLead(params?: Record<string, unknown>, eventID?: string) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  // L'eventID (partagé avec la Conversions API serveur) permet à Meta de
  // dédupliquer le Lead reçu deux fois (pixel + CAPI).
  window.fbq("track", "Lead", params, eventID ? { eventID } : undefined);
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
