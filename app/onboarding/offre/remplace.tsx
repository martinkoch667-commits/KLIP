"use client";

/* « Klip remplace tout ça », en une image : six icônes, une seule.
 *
 * Martin a choisi cette mise en scène parmi quatre (Calques, Ticket, Fusion,
 * Barres, le 2026-09-14). Elle lit la même pile d'outils que le comparatif de
 * la landing (six outils, ~95 €/mois) et le prix de l'offre Studio TEL QU'IL
 * EST AFFICHÉ sur la carte voisine : période choisie et remise comprises.
 *
 * L'ÉQUILIBRE. Les six icônes sont rangées dans un dossier dont la hauteur est
 * celle de l'icône Klip : de part et d'autre de la flèche, deux masses égales.
 * Posée à nu, la grille paraissait éparpillée à côté d'une icône Klip massive.
 *
 * LES LOGOS REMPLISSENT LEUR CASE, comme des icônes d'app, au lieu d'un favicon
 * dans une pastille. Google les sert en 256 px ; Canva est la seule ronde, on
 * l'agrandit et on peint ses coins de son dégradé.
 */

import { useEffect, useRef, useState } from "react";

type Outil = { nom: string; domaine: string; fond: string; zoom?: number };

/** Mêmes outils et même ordre que STACK_TOOLS sur la landing. */
const OUTILS: Outil[] = [
  { nom: "Canva", domaine: "canva.com", fond: "linear-gradient(135deg,#19C6D1,#7B2FF2)", zoom: 1.34 },
  { nom: "CapCut", domaine: "capcut.com", fond: "#FFFFFF" },
  { nom: "ChatGPT", domaine: "chatgpt.com", fond: "#FFFFFF" },
  { nom: "Metricool", domaine: "metricool.com", fond: "#EAFD75" },
  { nom: "Notion", domaine: "notion.so", fond: "#FFFFFF" },
  { nom: "WeTransfer", domaine: "wetransfer.com", fond: "#17181A" },
];
/** Total mensuel de ces six abonnements, le même que STACK_TOTAL sur la landing. */
const TOTAL = 95;

function IconeOutil({ outil }: { outil: Outil }) {
  const [rate, setRate] = useState(false);
  return (
    <span className="rt-ic" style={{ background: outil.fond }}>
      {rate ? (
        <span className="rt-ic-lettre">{outil.nom.charAt(0)}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://www.google.com/s2/favicons?sz=256&domain=${outil.domaine}`} alt={outil.nom}
          width={34} height={34} loading="lazy" onError={() => setRate(true)}
          style={outil.zoom ? { transform: `scale(${outil.zoom})` } : undefined} />
      )}
    </span>
  );
}

/** Vrai dès que la carte entre à l'écran : sur mobile elle est sous les offres,
 *  et une animation jouée hors de la vue serait perdue. */
function useVu<T extends Element>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [vu, setVu] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setVu(true); return; }
    const io = new IntersectionObserver(ents => {
      if (ents.some(e => e.isIntersecting)) { setVu(true); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(el);
    /* Filet de sécurité : des icônes qui attendent l'observateur restent
       invisibles s'il ne se déclenche jamais (onglet en arrière-plan, aperçu,
       capture). Au bout de six secondes on les montre de toute façon. */
    const secours = setTimeout(() => setVu(true), 6000);
    return () => { io.disconnect(); clearTimeout(secours); };
  }, []);
  return [ref, vu];
}

export default function Fusion({ prix, fmt }: { prix: number; fmt: (v: number) => string }) {
  const [ref, vu] = useVu<HTMLDivElement>();
  return (
    <div ref={ref} className={"rt-fusion" + (vu ? " is-vu" : "")}>
      <div className="rt-fusion-scene">
        <div className="rt-fusion-dossier">
          {OUTILS.map((o, i) => (
            <span key={o.nom} className="rt-fusion-case" style={{ ["--i" as string]: i }}>
              <IconeOutil outil={o} />
            </span>
          ))}
        </div>
        <span className="rt-fusion-fleche" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
        </span>
        <span className="rt-fusion-klip">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/klip-media/klip-app-icon.png" alt="Klip" width={86} height={86} />
        </span>
      </div>
      {/* Deux lignes VOULUES : laissé au retour à la ligne automatique, le
          titre coupait entre « Un » et « seul outil ». */}
      <p className="rt-fusion-h">
        <span className="rt-fusion-h1">Six abonnements.</span>
        <span className="rt-fusion-h2"><span className="acc-hl">Un seul outil.</span></span>
      </p>
      <p className="rt-fusion-p">Pour <b>{fmt(prix)} €/mois</b> au lieu de ~{TOTAL} €.</p>
    </div>
  );
}

export const FUSION_CSS = `
  .rt-fusion{background:var(--card);border-radius:20px;padding:28px 24px 26px;text-align:center;
    box-shadow:0 0 0 1px var(--line-2),0 40px 80px -40px rgba(16,19,11,.45);}
  .rt-fusion-scene{display:flex;align-items:center;justify-content:center;gap:12px;}

  /* Le dossier : 3 × 34 px, deux gouttières de 7 px et 9 px de marge font
     134 × 93 px, la hauteur de l'icône Klip avec son halo. */
  .rt-fusion-dossier{display:grid;grid-template-columns:repeat(3,34px);gap:7px;padding:9px;
    border-radius:22px;background:#F1F0E9;box-shadow:inset 0 0 0 1px var(--line-2);}
  .rt-fusion-case{display:inline-flex;translate:0 6px;scale:.8;opacity:0;
    transition:translate .45s cubic-bezier(.2,1.4,.4,1) calc(var(--i) * 60ms),scale .45s cubic-bezier(.2,1.4,.4,1) calc(var(--i) * 60ms),opacity .25s calc(var(--i) * 60ms);}
  .rt-fusion.is-vu .rt-fusion-case{opacity:1;translate:0 0;scale:1;}

  .rt-ic{position:relative;flex:none;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;overflow:hidden;
    box-shadow:0 4px 10px -6px rgba(16,19,11,.5);}
  .rt-ic img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;}
  /* Filet intérieur : une icône blanche (CapCut, ChatGPT, Notion) n'aurait
     sinon aucun bord sur le fond clair du dossier. */
  .rt-ic::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
    box-shadow:inset 0 0 0 1px rgba(16,19,11,.10);}
  .rt-ic-lettre{font-family:var(--heavy);font-weight:800;font-size:17px;color:var(--ink);}

  .rt-fusion-fleche{display:inline-flex;color:var(--ink-3);opacity:0;translate:-6px 0;
    transition:opacity .3s .4s,translate .4s .4s;}
  .rt-fusion.is-vu .rt-fusion-fleche{opacity:1;translate:0 0;}
  .rt-fusion-klip{position:relative;display:inline-flex;width:86px;height:86px;border-radius:22px;overflow:hidden;flex:none;
    box-shadow:0 0 0 5px rgba(189,242,160,.55),0 22px 34px -16px rgba(30,51,23,.6);
    scale:.6;opacity:0;transition:scale .5s cubic-bezier(.2,1.6,.4,1) .55s,opacity .25s .55s;}
  .rt-fusion-klip img{width:100%;height:100%;display:block;}
  .rt-fusion.is-vu .rt-fusion-klip{scale:1;opacity:1;}

  .rt-fusion-h{margin:24px 0 0;line-height:1;}
  .rt-fusion-h1{display:block;font-family:var(--heavy);font-weight:800;text-transform:uppercase;
    letter-spacing:-.02em;font-size:23px;}
  .rt-fusion-h2{display:block;margin-top:7px;font-size:26px;}
  .rt-fusion-p{margin:14px 0 0;font-size:14.5px;line-height:1.4;color:var(--ink-3);}
  .rt-fusion-p b{color:var(--ink);font-weight:800;}
`;
