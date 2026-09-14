"use client";

/* Écran d'entrée du parcours d'essai : le site ou le compte Instagram.
 *
 * Reprend mot pour mot la promesse et le déroulé de l'écran « nouveau client »
 * déjà en production (`app/workspace/new/page.tsx`, phases ask / searching /
 * result), mais posé sur le décor du parcours d'essai et accessible sans
 * compte, pour pouvoir juger l'enchaînement complet.
 *
 * L'analyse appelle la VRAIE route `/api/brand/analyze`. Celle-ci exige une
 * session : hors connexion elle répond 401, et on bascule alors sur des
 * valeurs d'exemple clairement annoncées à l'écran plutôt que de faire croire
 * à une lecture qui n'a pas eu lieu.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingShell, { MotChoisi } from "@/components/OnboardingShell";
import { lireDraft, ecrireDraft, nomDepuisUrl, type OnbDraft } from "@/lib/onboardingDraft";
import { rangerSecteur, rangerTon, nettoyerNom } from "@/lib/marqueChoix";
import { paletteDeMarque } from "@/lib/brandPalette";

const ETAPES = [
  "Ouverture de la page",
  "Lecture des feuilles de style",
  "Extraction des couleurs de marque",
  "Repérage des typographies",
  "Lecture du positionnement et du ton",
];

export default function SitePage() {
  const router = useRouter();
  const [site, setSite] = useState("");
  const [phase, setPhase] = useState<"ask" | "searching">("ask");
  const [etape, setEtape] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const lance = useRef(false);

  /* Arrivée depuis le hero de la landing (`?site=`) : l'adresse est déjà
     saisie, on lance l'analyse sans redemander. L'adresse quitte ensuite la
     barre, sinon un rechargement relancerait tout. */
  useEffect(() => {
    if (lance.current) return;
    const depuisLanding = new URLSearchParams(location.search).get("site");
    if (!depuisLanding) return;
    lance.current = true;
    history.replaceState(null, "", location.pathname);
    setSite(depuisLanding);
    void analyser(depuisLanding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Venu de la landing, on n'est pas passé par la connexion Instagram : elle
     vient après l'analyse. Sinon, direction le questionnaire. */
  function suite() {
    return lireDraft()?.igConnected === undefined ? "/onboarding/connexion" : "/onboarding/questionnaire";
  }

  async function analyser(adresse?: string) {
    const url = (adresse ?? site).trim();
    if (!url) return;
    setErreur(null);
    setPhase("searching");
    setEtape(0);
    // Les étapes défilent pendant que la requête est en vol ; la dernière ne se
    // referme qu'à l'arrivée de la réponse.
    const ticker = setInterval(() => setEtape(i => Math.min(i + 1, ETAPES.length - 2)), 900);

    let draft: OnbDraft = { source: "site", url, prefilled: [] };
    try {
      /* Deux routes, dans cet ordre. `analyze` lit AUSSI le secteur et le ton
         avec un modèle, mais exige une session ; `lire-site` ne fait que
         l'extraction (couleurs, polices, logo, nom), ne coûte rien et marche
         sans compte. Sans ce second essai, quelqu'un qui n'a pas encore de
         compte tapait son adresse et recevait des valeurs d'exemple. */
      let res = await fetch("/api/brand/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        res = await fetch("/api/brand/lire-site", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
      }
      if (res.ok) {
        const d = await res.json();
        /* Le modèle écrit un secteur et un ton libres (« Restauration rapide »,
           « Gourmand, décontracté ») : on les range dans les cases du
           questionnaire, sinon rien n'y était coché. Voir lib/marqueChoix. */
        const secteur = rangerSecteur(d.sector);
        const ton = rangerTon(d.tone);
        const nom = nettoyerNom(d.name) || undefined;
        /* Même lecture des couleurs que « Nouveau client » : logos d'abord,
           puis CSS, puis image de partage, puis Instagram s'il est relié. Le
           CSS seul rendait les couleurs par défaut du thème du site. */
        const couleurs = await paletteDeMarque({
          logoCandidates: d.logoCandidates, logoUrl: d.logoUrl, cssColors: d.colors,
          heroImage: d.heroImage, igColors: lireDraft()?.igColors,
        });
        draft = {
          source: "site", url,
          name: nom, sector: secteur.secteur || undefined, sectorAutre: secteur.autre || undefined,
          tone: ton || undefined, description: d.description,
          colors: couleurs, fonts: d.fonts, logoUrl: d.logoUrl, headline: d.description,
          prefilled: [
            nom && "name", secteur.secteur && "sector", ton && "tone", d.description && "description",
            couleurs.length > 0 && "colors", (d.fonts ?? []).length > 0 && "fonts", d.logoUrl && "logo",
          ].filter((k): k is string => typeof k === "string" && k.length > 0),
        };
      } else {
        // Les deux lectures ont échoué (site injoignable, hors ligne) : on
        // continue avec des valeurs d'exemple, annoncées à l'écran suivant.
        draft = exempleDepuis(url);
      }
    } catch {
      draft = exempleDepuis(url);
    }

    clearInterval(ticker);
    setEtape(ETAPES.length);
    const apres = suite();
    const avant = lireDraft();
    ecrireDraft({
      ...draft, igConnected: avant?.igConnected, clientId: avant?.clientId,
      // Instagram relié : son nom et sa bio restent si le site ne dit rien.
      handle: avant?.handle, igColors: avant?.igColors, igLogo: avant?.igLogo,
      logoUrl: draft.logoUrl ?? avant?.igLogo, description: draft.description ?? avant?.description,
      headline: draft.headline ?? avant?.headline,
    });
    setTimeout(() => router.push(apres), 450);
  }

  function aLaMain() {
    const apres = suite();
    const avant = lireDraft();
    ecrireDraft({
      source: "manuel", prefilled: [], sansSite: true, igConnected: avant?.igConnected, clientId: avant?.clientId,
      handle: avant?.handle, igColors: avant?.igColors, igLogo: avant?.igLogo, logoUrl: avant?.igLogo,
      colors: avant?.igColors, description: avant?.description, headline: avant?.headline, name: avant?.name,
    });
    router.push(apres);
  }

  /* Le champ et ses deux lignes de service forment la zone d'action : sur
     mobile elle se colle en bas de l'écran, sous le pouce. Pendant l'analyse
     il n'y a plus rien à faire, donc plus de zone du tout. */
  const zoneBasse = (
    <>
      <div className="ob-champ">
        <input
          className="ob-input" value={site} autoFocus inputMode="url"
          onChange={e => { setSite(e.target.value); setErreur(null); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void analyser(); } }}
          placeholder="smashy-burger.fr"
          aria-label="Adresse de votre site"
        />
        <button type="button" className="ob-btn ob-btn-leaf"
          style={{ width: "auto", minHeight: 56, padding: "0 26px" }}
          onClick={() => void analyser()} disabled={!site.trim()}>
          Analyser
        </button>
      </div>

      {erreur
        ? <p className="ob-fin" style={{ color: "#C4452F", fontWeight: 700 }}>{erreur}</p>
        : <p className="ob-fin">Rien à installer, on lit juste la page publique.</p>}

      <p className="ob-fin">
        <button type="button" className="ob-lien" onClick={aLaMain}>Je n&apos;ai pas de site</button>
      </p>
    </>
  );

  return (
    <OnboardingShell largeur={520} chemin="votre-site"
      intro={phase === "ask" ? (
        <>
          {/* Pas de retour à la ligne forcé : le titre se coupe tout seul selon
              la largeur. Un `<br />` écrit pour un écran en casse un autre, et
              ici il séparait « à partir » de « du site ». */}
          <h1 className="ob-h1">
            On lit votre <MotChoisi>site</MotChoisi>
          </h1>
          <p className="ob-sub">Vos couleurs et vos polices y sont déjà.</p>
        </>
      ) : (
        <>
          <h1 className="ob-h1">
            <MotChoisi>{site.replace(/^https?:\/\//, "").replace(/\/$/, "")}</MotChoisi>
          </h1>
          <p className="ob-sub">Quelques secondes.</p>
        </>
      )}
      bas={phase === "ask" ? zoneBasse : null}>
      {phase === "searching" && (
        <ol className="wsx-steps">
          {ETAPES.map((label, i) => {
            const state = i < etape ? "done" : i === etape ? "now" : "wait";
            return (
              <li key={label} className={`wsx-step is-${state}`}>
                <span className="wsx-step-dot">
                  {state === "done" && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M4 12.5l5 5 11-11" /></svg>
                  )}
                </span>
                {label}
              </li>
            );
          })}
        </ol>
      )}
    </OnboardingShell>
  );
}

/** Valeurs d'exemple quand l'analyse réelle n'a pas pu tourner. */
function exempleDepuis(url: string): OnbDraft {
  return {
    source: "site", url,
    name: nomDepuisUrl(url) || "Votre marque",
    sector: "Restaurant",
    tone: "Punchy",
    description: "Cuisine généreuse et sans chichi, préparée sur place tous les jours.",
    colors: ["#0C2A1D", "#103A28", "#BDF2A0", "#14160F"],
    fonts: ["Archivo", "Hanken Grotesk"],
    headline: "Le goût du fait maison, servi vite et bien.",
    prefilled: ["name", "sector", "tone", "description", "colors", "fonts"],
    demo: true,
  };
}
