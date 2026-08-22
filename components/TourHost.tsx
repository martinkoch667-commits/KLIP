"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import GuidedTour from "@/components/GuidedTour";
import { TOURS } from "@/lib/tours";

/* Monte la visite guidée qui correspond à l'écran courant.

   Un seul point de montage plutôt qu'un composant glissé dans chacune des
   pages : l'éditeur fait huit mille lignes, le montage quatre mille, et il n'y
   a aucune raison d'y toucher pour ça. On lit le chemin, on rend la visite qui
   va avec, et l'écran n'a rien à savoir de tout ça. */

function tourIdFor(pathname: string): string | null {
  if (pathname === "/dashboard") return "dashboard";
  if (/^\/workspace\/[^/]+\/editor(\/|$)/.test(pathname)) return "editor";
  if (/^\/workspace\/[^/]+\/montage(\/|$)/.test(pathname)) return "montage";
  if (/^\/workspace\/[^/]+\/planning(\/|$)/.test(pathname)) return "planning";
  if (/^\/workspace\/[^/]+\/templates(\/|$)/.test(pathname)) return "templates";
  if (pathname === "/templates") return "templates";
  if (pathname === "/calendar") return "planning";
  if (pathname === "/feed" || /^\/workspace\/[^/]+\/results(\/|$)/.test(pathname)) return "feed";
  /* L'espace d'un client, et lui seul : le test vient APRÈS ceux des
     sous-pages, sinon il les avalerait toutes. */
  if (/^\/workspace\/[^/]+$/.test(pathname)) return "client";
  return null;
}

export default function TourHost() {
  const pathname = usePathname() ?? "";

  /* `?tour=editor` rejoue une visite précise, même déjà vue. Lu depuis
     `window` et non via useSearchParams : ce composant vit dans le layout
     racine, et useSearchParams y ferait basculer toutes les pages en rendu
     client. */
  const [forced, setForced] = useState<string | null>(null);
  useEffect(() => {
    try {
      const v = new URLSearchParams(window.location.search).get("tour");
      setForced(v && TOURS[v] ? v : null);
    } catch { setForced(null); }
  }, [pathname]);

  const id = forced ?? tourIdFor(pathname);
  if (!id || !TOURS[id]) return null;

  /* L'éditeur et le montage se peignent en plusieurs temps (canvas, rushs,
     panneaux) : on leur laisse un peu plus de temps avant de mesurer les
     cibles, sinon les étapes disparaîtraient faute d'élément à désigner. */
  const delay = id === "editor" || id === "montage" ? 1600 : 800;
  // Composer un visuel par IA peut prendre bien plus longtemps que le délai
  // ci-dessus : la première étape de la visite (sans cible propre) s'affichait
  // en plein sur l'écran « génération en cours ». `.klipgen` est cet écran ;
  // on attend qu'il ait disparu avant même de commencer à compter `delay`.
  const waitForAbsent = id === "editor" ? ".klipgen" : undefined;

  /* La checklist de prise en main attend la fin de la visite d'accueil, à
     l'ancienne clé et à l'ancien événement. On les honore plutôt que de la
     réécrire : elle marche, et elle n'a rien demandé. */
  const onFinish = id === "dashboard"
    ? () => {
        try { localStorage.setItem("klip-onboarding-done", "1"); } catch { /* ignore */ }
        try { window.dispatchEvent(new Event("klip-onboarding-tour-done")); } catch { /* ignore */ }
      }
    : undefined;

  return <GuidedTour key={id} id={id} steps={TOURS[id]} delayMs={delay} onFinish={onFinish} force={forced === id} waitForAbsent={waitForAbsent} />;
}
