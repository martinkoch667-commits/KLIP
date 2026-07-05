"use client";

import Script from "next/script";
import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

// Déclenche un événement standard « Lead » sur une conversion (ex : inscription
// à la liste d'attente). Silencieux si le pixel n'est pas chargé.
export function trackLead(params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", "Lead", params);
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
  // Silencieux si aucun pixel n'est configuré (variable absente ou vide).
  if (!PIXEL_ID) return null;

  // TODO consentement RGPD : aucun système de consentement (CMP) détecté dans le
  // projet. Le Meta Pixel est un traceur publicitaire — avant la mise en prod,
  // le charger UNIQUEMENT après consentement explicite (bandeau CNIL) et mettre
  // à jour app/cookies/page.tsx en conséquence.
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
