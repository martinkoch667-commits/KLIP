"use client";

/* Page d'offre du parcours d'essai.
 *
 * LA COMPOSITION reste celle du croquis de Martin : l'écran coupé par une
 * diagonale, les offres sur la partie claire, une grille de posts inclinée sur
 * la partie sombre. Sous 1100 px la diagonale ne tient plus : on empile.
 *
 * « KLIP REMPLACE TOUT ÇA » a quatre mises en scène à l'essai (voir remplace.tsx),
 * posées sur la zone sombre en desktop et sous les cartes en mobile. Un
 * sélecteur, visible partout sauf sur getklip.fr, passe de l'une à l'autre.
 *
 * LES PRIX SONT CEUX DE LA LANDING, au pixel près. Même carte, mêmes jetons de
 * couleur (ceux de `.v3`, pas ceux de l'app, dont le forest n'est pas le même),
 * même badge de lancement, même prix barré, mêmes textes tirés de
 * `landing.pricing`. La personne a vu cette grille sur la landing deux minutes
 * plus tôt : elle doit la reconnaître, pas la redécouvrir. Seules les tailles
 * descendent, parce que trois cartes tiennent ici dans la moitié de l'écran.
 *
 * LES LISTES DE FONCTIONNALITÉS NE SONT PAS REPRISES. À ce stade la personne a
 * déjà vu sa charte et ses visuels : la carte n'a plus à convaincre, seulement
 * à laisser choisir. Huit lignes par offre la rendaient trois écrans plus
 * longue sur mobile.
 *
 * LES VISUELS sont des cases grises en attendant ceux de Martin. Déposer des
 * images dans `public/vitrine/` suffit à les remplacer (voir /api/vitrine).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { LAUNCH_OFFER, launchApplies, launchPrice, formatPrice } from "@/lib/launch-offer";
import { lireDraft } from "@/lib/onboardingDraft";
import Remplace, { REMPLACE_CSS, VARIANTES, type Variante } from "./remplace";

/* Assez de cases pour REMPLIR la grille inclinée, qui déborde de l'écran : à
   150 px sur une zone d'environ 1100 × 1400 px, il en faut une cinquantaine. */
const NB_CASES = 56;

const CSS = `
  /* Jetons de la landing (.v3), redéclarés ici : ceux de globals.css ont un
     autre forest et une autre encre, et la carte ne serait plus la même. */
  .pv{
    --paper:#FFFFFF; --paper-3:#F1F0E9; --card:#FFFFFF;
    --forest:#072117; --forest-2:#0C3123;
    --ink:#10130B; --ink-2:#50544A; --ink-3:#8A8D7D;
    --line:rgba(16,19,11,.14); --line-2:rgba(16,19,11,.08);
    --cream:#F1F0E5; --cream-2:rgba(241,240,229,.66); --cream-3:rgba(241,240,229,.36);
    --leaf:#BDF2A0; --leaf-soft:#D9F8C7; --leaf-ink:#1E3317; --mint-2:#1FA878;
    --vio:#6656D9;
    --oaks-x:'oaks-expanded', Georgia, serif;
    --heavy:'Archivo', system-ui, sans-serif;
    --sans:'early-sans-variable','Hanken Grotesk', system-ui, sans-serif;
    --r:18px;
    position:relative;min-height:100vh;min-height:100dvh;overflow:hidden;
    background:var(--paper);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;
  }
  .pv *,.pv *::before,.pv *::after{box-sizing:border-box;}
  .pv button{font-family:inherit;cursor:pointer;border:none;background:none;}

  /* ── La zone sombre, coupée en diagonale ─────────────────────────────── */
  .pv-sombre{position:absolute;inset:0;background:var(--forest);
    clip-path:polygon(70% 0, 100% 0, 100% 100%, 60% 100%);}
  /* Gouttières sombres et cases grises : sur des gouttières claires, la zone
     entière virait au gris clair et on ne voyait plus la diagonale.
     PAS DE HAUTEUR sur la grille : avec une hauteur fixe, la grille répartit
     cette hauteur entre les rangées (29 px chacune) au lieu de suivre les cases
     (100 px), qui se chevauchaient alors sans gouttière horizontale. La grille
     prend sa hauteur naturelle, et c'est la découpe de la zone sombre qui la
     rogne. Cases à TAILLE FIXE partout : en fractions de la largeur, elles
     faisaient 210 px sur tablette.
     Pivot EN HAUT : une grille de 56 cases mesure 2 000 px de haut, et pivotée
     autour de son centre, son haut (la seule partie visible sur mobile) partait
     de 170 px vers la gauche et laissait le bandeau à moitié vide. */
  .pv-mur{position:absolute;top:-24%;left:40%;width:90%;transform:rotate(-10deg);transform-origin:50% 0;
    display:grid;grid-template-columns:repeat(auto-fill,140px);justify-content:center;
    gap:14px;align-content:start;}
  .pv-case{width:100%;aspect-ratio:4/5;border-radius:6px;overflow:hidden;background:#D5D7D2;}
  .pv-case img{width:100%;height:100%;object-fit:cover;display:block;}

  /* ── « Klip remplace tout ça », posé sur la zone sombre ────────────── */
  /* Centré verticalement, calé à droite : à mi-hauteur la diagonale passe à
     65 % de la largeur, le bloc commence toujours après. */
  .pv-remplace-large{position:absolute;top:50%;right:clamp(28px,3.2vw,64px);translate:0 -50%;z-index:3;
    width:min(380px,29vw);}
  .pv-remplace-mobile{display:none;}

  /* ── La partie claire ────────────────────────────────────────────────── */
  .pv-marque{position:absolute;top:28px;left:clamp(24px,4vw,56px);z-index:4;line-height:0;}
  .pv-marque img{height:34px;width:34px;border-radius:10px;display:block;}
  /* Largeur calée sur le bas de la diagonale (60 %), moins une marge : c'est là
     que la zone sombre avance le plus vers la gauche. */
  .pv-clair{position:relative;z-index:2;width:calc(60% - 36px);max-width:900px;min-height:100dvh;
    display:flex;flex-direction:column;justify-content:center;
    padding:96px 0 44px clamp(24px,4vw,56px);}

  .pv-h1{font-family:var(--heavy);font-weight:800;text-transform:uppercase;letter-spacing:-.03em;
    line-height:.98;text-wrap:balance;font-size:clamp(34px,3.4vw,52px);margin:0;}
  .pv-lead{color:var(--ink-2);font-size:17px;line-height:1.55;margin:14px 0 0;max-width:46ch;text-wrap:pretty;}

  /* Sélecteur de période : celui de la landing. */
  .pv-periode{display:inline-flex;align-self:flex-start;align-items:center;gap:4px;margin-top:22px;padding:5px;
    border-radius:999px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line);}
  .pv-periode button{padding:9px 18px;border-radius:999px;font-weight:800;font-size:14px;color:var(--ink-2);
    display:inline-flex;align-items:center;gap:8px;transition:background .2s,color .2s;}
  .pv-periode button.is-on{background:var(--ink);color:var(--paper);}
  .pv-deux{font-size:11px;padding:2px 7px;border-radius:999px;background:var(--leaf);color:var(--leaf-ink);}

  /* ── Les cartes : la section Tarifs de la landing ───────────────────── */
  .pv-grille{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:44px;align-items:stretch;}
  .pv-col{display:flex;min-width:0;}
  .pv-col.is-pop{transform:translateY(-14px);}
  .pv-carte{position:relative;flex:1;display:flex;flex-direction:column;min-width:0;
    background:var(--card);color:var(--ink);border-radius:var(--r);padding:26px 20px 22px;
    border:1px solid var(--line);box-shadow:0 20px 44px -30px rgba(16,19,11,.2);}
  .pv-carte.is-pop{background:var(--forest);color:var(--cream);border:none;
    box-shadow:0 40px 80px -40px rgba(7,33,23,.7);}

  /* Le cadre de sélection violet de l'éditeur, posé sur l'offre mise en avant. */
  .pv-sel{position:relative;display:flex;flex:1;min-width:0;}
  .pv-sel-cadre{position:absolute;inset:-10px;border:2px solid var(--vio);border-radius:4px;pointer-events:none;z-index:2;}
  .pv-sel-h{position:absolute;width:13px;height:13px;background:#fff;border:2px solid var(--vio);border-radius:50%;
    box-shadow:0 2px 6px rgba(16,19,11,.18);}
  .pv-sel-p{position:absolute;background:#fff;border:2px solid var(--vio);border-radius:999px;
    box-shadow:0 2px 6px rgba(16,19,11,.18);}

  .pv-flag{position:absolute;top:-16px;right:18px;rotate:3deg;z-index:3;display:inline-flex;align-items:center;
    background:var(--leaf);color:var(--leaf-ink);border-radius:14px;padding:8px 13px;
    font-weight:800;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;
    box-shadow:0 18px 36px -16px rgba(120,190,90,.5);}
  .pv-nom{font-family:var(--oaks-x);font-weight:700;text-transform:uppercase;letter-spacing:.015em;
    line-height:.95;font-size:21px;margin:0;}
  .pv-tag{font-weight:600;font-size:13px;line-height:1.35;color:var(--ink-3);margin-top:6px;}
  .pv-carte.is-pop .pv-tag{color:var(--cream-3);}
  .pv-badge{display:inline-flex;align-self:flex-start;align-items:center;margin-top:18px;padding:6px 10px;
    border-radius:999px;background:var(--leaf-soft);color:var(--leaf-ink);
    font-weight:800;font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;white-space:nowrap;}
  .pv-carte.is-pop .pv-badge{background:var(--leaf);}
  .pv-prix{display:flex;align-items:baseline;column-gap:8px;row-gap:2px;flex-wrap:wrap;margin:10px 0 2px;}
  .pv-prix.sans-remise{margin-top:22px;}
  .pv-barre{font-family:var(--heavy);font-weight:800;font-size:clamp(20px,1.7vw,26px);letter-spacing:-.03em;line-height:1;
    color:var(--ink-3);text-decoration:line-through;text-decoration-thickness:2px;white-space:nowrap;}
  .pv-montant{font-family:var(--heavy);font-weight:800;font-size:clamp(36px,3.1vw,50px);letter-spacing:-.04em;line-height:1;
    white-space:nowrap;}
  .pv-mois{font-weight:700;font-size:13px;color:var(--ink-3);}
  .pv-carte.is-pop .pv-barre{color:var(--cream-3);}
  .pv-carte.is-pop .pv-mois{color:var(--cream-2);}
  .pv-note{font-size:12px;line-height:1.45;color:var(--ink-3);margin:6px 0 16px;min-height:16px;}
  .pv-carte.is-pop .pv-note{color:var(--cream-3);}
  .pv-chip{display:inline-flex;align-self:flex-start;align-items:center;padding:8px 14px;border-radius:999px;
    font-weight:700;font-size:12.5px;letter-spacing:.02em;white-space:nowrap;
    background:var(--paper-3);color:var(--ink-2);box-shadow:inset 0 0 0 1px var(--line);}
  .pv-carte.is-pop .pv-chip{background:var(--forest-2);color:var(--cream-2);}
  .pv-btn{width:100%;display:inline-flex;align-items:center;justify-content:center;
    min-height:52px;padding:14px 16px;border-radius:999px;font-weight:800;font-size:15px;letter-spacing:-.01em;
    transition:box-shadow .2s,background .2s;white-space:nowrap;}
  /* Préfixés par .pv : la remise à zéro « .pv button » (fond transparent) est
     plus spécifique qu'une classe seule, et le bouton leaf sortait sans fond,
     invisible sur la carte sombre. */
  .pv .pv-btn-ghost{color:var(--ink);box-shadow:inset 0 0 0 1.6px var(--line);}
  .pv .pv-btn-ghost:hover{box-shadow:inset 0 0 0 2px var(--ink);}
  .pv .pv-btn-leaf{background:var(--leaf);color:var(--leaf-ink);box-shadow:0 16px 32px -16px rgba(120,190,90,.55);}
  .pv .pv-btn-leaf:hover{background:#C9F5B2;}
  /* L'espace extensible aligne les boutons en bas des trois cartes, même quand
     la note de lancement prend une ligne de plus sur l'une d'elles. */
  .pv-espace{flex:1;min-height:22px;}

  /* Trois cartes dans la moitié de l'écran : le prix barré ne tient pas à côté
     du prix sur Studio (« 32,50€ 22,75€ »), et passait à la ligne sur cette
     carte seulement. Au-dessus du prix sur les trois, la grille reste égale. */
  @media(min-width:1101px){ .pv-barre{flex-basis:100%;} }

  .pv-rassure{margin:26px 0 0;font-size:13.5px;line-height:1.5;color:var(--ink-3);}
  .pv-rassure b{color:var(--ink-2);}

  /* ── Sous 1100 px : la diagonale ne tient plus, on empile ────────────── */
  @media(max-width:1100px){
    .pv{min-height:0;}
    .pv-sombre{position:relative;inset:auto;height:30vh;min-height:210px;max-height:300px;
      clip-path:polygon(0 0, 100% 0, 100% 82%, 0 100%);}
    .pv-mur{top:-40%;left:-20%;width:140%;grid-template-columns:repeat(auto-fill,108px);gap:10px;}
    .pv-remplace-large{display:none;}
    .pv-remplace-mobile{display:block;width:100%;max-width:420px;margin:48px auto 24px;text-align:left;}
    .pv.a-choix .pv-clair{padding-bottom:104px;}
    .pv-marque{top:18px;left:20px;}
    .pv-marque img{box-shadow:0 4px 14px rgba(0,0,0,.35);}
    .pv-clair{width:100%;max-width:none;min-height:0;align-items:center;text-align:center;
      padding:26px 20px 48px;}
    .pv-lead{margin-left:auto;margin-right:auto;}
    .pv-periode{align-self:center;}
    .pv-grille{width:100%;max-width:980px;text-align:left;}
    .pv-rassure{max-width:44ch;}
  }
  /* Trois cartes côte à côte ne tiennent plus : une colonne, comme la landing. */
  @media(max-width:760px){
    .pv-h1{font-size:clamp(30px,8.4vw,40px);}
    .pv-lead{font-size:16px;}
    .pv-grille{grid-template-columns:1fr;max-width:420px;gap:26px;margin-top:38px;}
    .pv-col.is-pop{transform:none;}
    .pv-sel-cadre{inset:-7px;}
    .pv-carte{padding:28px 24px 24px;}
    .pv-nom{font-size:24px;}
    .pv-barre{font-size:28px;}
    .pv-montant{font-size:54px;}
  }
`;

type Offre = {
  cle: "starter" | "studio" | "agence";
  nom: string; mensuel: number; annuel: number;
  tag: string; clients: string; pop: boolean;
};

export default function OffreView({ seatsLeft }: { seatsLeft: number | null }) {
  const tp = useTranslations("landing.pricing");
  const locale = useLocale();
  const fmt = (v: number) => formatPrice(v, locale);

  /* Annuel d'entrée, comme la landing : c'est le tarif le plus bas. */
  const [periode, setPeriode] = useState<"monthly" | "yearly">("yearly");
  const [nom, setNom] = useState("");
  const [visuels, setVisuels] = useState<string[]>([]);
  const [variante, setVariante] = useState<Variante>("calques");
  /* Le sélecteur sert à départager les variantes : il n'a rien à faire devant
     un vrai visiteur. Décidé après montage, `location` n'existant pas au rendu
     serveur. */
  const [apercu, setApercu] = useState(false);

  // Même règle que la landing : sans compte connu, l'offre reste ouverte.
  const lancement = launchApplies(periode) && (seatsLeft === null || seatsLeft > 0);
  const annuel = periode === "yearly";

  useEffect(() => {
    setApercu(!/(^|\.)getklip\.fr$/.test(location.hostname));
    const v = new URLSearchParams(location.search).get("v");
    if (VARIANTES.some(x => x.cle === v)) setVariante(v as Variante);
    setNom(lireDraft()?.name ?? "");
    // Les visuels déposés par Martin prennent la place des cases grises.
    fetch("/api/vitrine")
      .then(r => r.json())
      .then(j => { if (Array.isArray(j?.visuels) && j.visuels.length) setVisuels(j.visuels); })
      .catch(() => { /* les cases grises restent */ });
  }, []);

  const offres: Offre[] = [
    { cle: "starter", nom: PLANS.starter.label, mensuel: PLANS.starter.priceMonthly, annuel: PLANS.starter.priceYearly, tag: tp("starterTag"), clients: tp("starterClients"), pop: false },
    { cle: "studio", nom: PLANS.solo.label, mensuel: PLANS.solo.priceMonthly, annuel: PLANS.solo.priceYearly, tag: tp("studioTag"), clients: tp("studioClients"), pop: true },
    { cle: "agence", nom: PLANS.agency.label, mensuel: PLANS.agency.priceMonthly, annuel: PLANS.agency.priceYearly, tag: tp("agencyTag"), clients: tp("agencyClients"), pop: false },
  ];

  /* Mêmes phrases que sous les prix de la landing. L'annuel se règle en une
     fois : on annonce la somme réellement débitée, puis le tarif ensuite. */
  function note(o: Offre, affiche: number) {
    if (lancement) {
      return annuel
        ? tp("launchNoteYear", { seats: LAUNCH_OFFER.seats, firstYear: fmt(launchPrice(o.annuel * 12)), full: fmt(o.annuel * 12) })
        : tp("launchNote", { seats: LAUNCH_OFFER.seats, price: fmt(affiche) });
    }
    return annuel ? tp("billedYear", { total: fmt(o.annuel * 12) }) : tp("billedMonth");
  }

  function choisir(v: Variante) {
    setVariante(v);
    // Dans l'adresse, pour pouvoir envoyer une variante précise en lien.
    const url = new URL(location.href);
    url.searchParams.set("v", v);
    history.replaceState(null, "", url);
  }

  /* Le prix Studio TEL QUE LA CARTE L'AFFICHE, période et remise comprises :
     c'est lui qu'on oppose à la pile d'outils. */
  const studioAffiche = annuel ? PLANS.solo.priceYearly : PLANS.solo.priceMonthly;
  const prixStudio = lancement ? launchPrice(studioAffiche) : studioAffiche;

  const cases = visuels.length
    ? Array.from({ length: NB_CASES }, (_, i) => visuels[(i * 3 + Math.floor(i / 7)) % visuels.length])
    : Array<string>(NB_CASES).fill("");

  return (
    <div className={"pv" + (apercu ? " a-choix" : "")}>
      <style dangerouslySetInnerHTML={{ __html: CSS + REMPLACE_CSS }} />

      <div className="pv-sombre" aria-hidden="true">
        <div className="pv-mur">
          {cases.map((v, i) => (
            <div className="pv-case" key={i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {v && <img src={v} alt="" />}
            </div>
          ))}
        </div>
      </div>

      <div className="pv-remplace-large">
        <Remplace variante={variante} prix={prixStudio} fmt={fmt} />
      </div>

      <Link href="/" className="pv-marque"><img src="/icon-192.png" alt="Klip" /></Link>

      <div className="pv-clair">
        <h1 className="pv-h1">
          {nom ? <>Les visuels de <span className="acc-hl">{nom}</span></> : <>Vos visuels sont <span className="acc-hl">prêts</span></>}
        </h1>
        <p className="pv-lead">Chacun s&apos;ouvre dans l&apos;éditeur, calque par calque. L&apos;essai ouvre tout le reste.</p>

        <div className="pv-periode">
          <button className={periode === "monthly" ? "is-on" : ""} onClick={() => setPeriode("monthly")}>{tp("monthly")}</button>
          <button className={annuel ? "is-on" : ""} onClick={() => setPeriode("yearly")}>
            {tp("yearly")}<span className="pv-deux">{tp("save2mo")}</span>
          </button>
        </div>

        <div className="pv-grille">
          {offres.map(o => {
            const affiche = annuel ? o.annuel : o.mensuel;
            const carte = (
              <div className={"pv-carte" + (o.pop ? " is-pop" : "")}>
                {o.pop && <span className="pv-flag">{tp("popular")}</span>}
                <h3 className="pv-nom">{o.nom}</h3>
                <div className="pv-tag">{o.tag}</div>
                {lancement && <div className="pv-badge">{tp("launchBadge", { percent: LAUNCH_OFFER.percent })}</div>}
                <div className={"pv-prix" + (lancement ? "" : " sans-remise")}>
                  {lancement && <span className="pv-barre">{fmt(affiche)}€</span>}
                  <span className="pv-montant">{fmt(lancement ? launchPrice(affiche) : affiche)}€</span>
                  <span className="pv-mois">{tp("perMonth")}</span>
                </div>
                <div className="pv-note">{note(o, affiche)}</div>
                <div className="pv-chip">{o.clients}</div>
                <div className="pv-espace" />
                {/* Pas encore branché : l'inscription puis la caisse viendront ici. */}
                <button type="button" className={"pv-btn " + (o.pop ? "pv-btn-leaf" : "pv-btn-ghost")}>
                  {tp("ctaTrial")}
                </button>
              </div>
            );
            return (
              <div key={o.cle} className={"pv-col" + (o.pop ? " is-pop" : "")}>
                {o.pop ? (
                  <div className="pv-sel">
                    {carte}
                    <span className="pv-sel-cadre" aria-hidden="true">
                      <span className="pv-sel-h" style={{ top: -7, left: -7 }} />
                      <span className="pv-sel-h" style={{ top: -7, right: -7 }} />
                      <span className="pv-sel-h" style={{ bottom: -7, left: -7 }} />
                      <span className="pv-sel-h" style={{ bottom: -7, right: -7 }} />
                      <span className="pv-sel-p" style={{ top: -5, left: "50%", transform: "translateX(-50%)", width: 22, height: 9 }} />
                      <span className="pv-sel-p" style={{ bottom: -5, left: "50%", transform: "translateX(-50%)", width: 22, height: 9 }} />
                      <span className="pv-sel-p" style={{ left: -5, top: "50%", transform: "translateY(-50%)", width: 9, height: 22 }} />
                      <span className="pv-sel-p" style={{ right: -5, top: "50%", transform: "translateY(-50%)", width: 9, height: 22 }} />
                    </span>
                  </div>
                ) : carte}
              </div>
            );
          })}
        </div>

        <div className="pv-remplace-mobile">
          <Remplace variante={variante} prix={prixStudio} fmt={fmt} />
        </div>

        <p className="pv-rassure">
          <b>0 € aujourd&apos;hui.</b> Premier prélèvement dans {TRIAL_DAYS} jours, annulable en un clic.
        </p>
      </div>

      {apercu && (
        <div className="rt-choix" role="group" aria-label="Variante">
          <span className="rt-choix-lib">Variante</span>
          {VARIANTES.map(x => (
            <button key={x.cle} type="button" className={variante === x.cle ? "is-on" : ""} onClick={() => choisir(x.cle)}>
              {x.nom}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
