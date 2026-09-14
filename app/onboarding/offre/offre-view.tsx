"use client";

/* Page d'offre du parcours d'essai.
 *
 * LE STYLE est celui de la carte « Curseurs », étendu à toute la page à la
 * demande de Martin (2026-09-14) : halo violet, verre dépoli, cadres de
 * sélection à poignées carrées, curseurs nommés, ombres douces teintées de
 * violet, étiquettes aux coins arrondis avec liseré. C'est le vocabulaire de
 * l'éditeur : la page montre l'outil en même temps qu'elle vend l'offre.
 *
 * LA COMPOSITION reste celle du croquis de Martin : l'écran coupé par une
 * diagonale, les offres sur la partie claire, les visuels sur l'autre. La
 * partie sombre est devenue un halo, et la grille inclinée une grille droite de
 * cases en verre. Sous 1100 px la diagonale ne tient plus : on empile.
 *
 * LA CARTE « SIX ABONNEMENTS, UN SEUL OUTIL » (remplace.tsx) est posée sur le
 * halo en desktop. En mobile elle ouvre la page, à cheval sur le bas du
 * bandeau : c'est l'argument qu'on veut lire avant les prix.
 *
 * LE TITRE est posé côte à côte avec le texte et le choix de période (retenu
 * parmi quatre dispositions) : le titre à gauche sur deux lignes, le reste à
 * droite. Le mot final est sélectionné, un curseur « Vous » dessus.
 *
 * LES PRIX SONT CEUX DE LA LANDING : mêmes chiffres, même badge de lancement,
 * même prix barré, mêmes textes tirés de `landing.pricing`. Seuls les contenants
 * prennent le style de la page (coins, ombres, étiquettes).
 *
 * LES LISTES DE FONCTIONNALITÉS NE SONT PAS REPRISES : à ce stade la personne a
 * déjà vu sa charte, la carte n'a plus qu'à laisser choisir.
 *
 * LES VISUELS sont des cases vides en attendant ceux de Martin. Déposer des
 * images dans `public/vitrine/` suffit à les remplacer (voir /api/vitrine).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { LAUNCH_OFFER, launchApplies, launchPrice, formatPrice } from "@/lib/launch-offer";
import { lireDraft } from "@/lib/onboardingDraft";
import CarteCurseurs, { CARTE_CSS } from "./remplace";

/* Quatre colonnes décalées d'une demi-case sur deux, sur assez de rangées pour
   remplir le halo en hauteur. */
const NB_CASES = 28;

/** La flèche de curseur, pointe en haut à gauche. */
function Fleche({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 2.5 21 10l-8.2 2.3L10 21 3 2.5Z" />
    </svg>
  );
}

const CSS = `
  /* Jetons de la landing (.v3) pour les cartes de prix, et ceux de la carte
     Curseurs pour le reste (violets, étiquettes). */
  .pv{
    --fond:#F4F5F1; --card:#FFFFFF; --paper-3:#F1F0E9;
    --forest:#072117; --forest-2:#0C3123;
    --ink:#10130B; --ink-2:#50544A; --ink-3:#8A8D7D;
    --line:rgba(16,19,11,.14); --line-2:rgba(16,19,11,.08);
    --cream:#F1F0E5; --cream-2:rgba(241,240,229,.66); --cream-3:rgba(241,240,229,.36);
    --leaf:#BDF2A0; --leaf-ink:#1E3317;
    --vio:#6656D9; --vio-ombre:rgba(52,36,150,.38);
    --oaks-x:'oaks-expanded', Georgia, serif;
    --heavy:'Archivo', system-ui, sans-serif;
    --sans:'early-sans-variable','Hanken Grotesk', system-ui, sans-serif;
    position:relative;min-height:100vh;min-height:100dvh;overflow:hidden;
    /* Une lueur lavande très légère derrière le titre, écho du halo. */
    background:radial-gradient(38% 34% at 0% 0%,rgba(157,144,255,.16),transparent 70%),var(--fond);
    color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;
  }
  .pv *,.pv *::before,.pv *::after{box-sizing:border-box;}
  .pv button{font-family:inherit;cursor:pointer;border:none;background:none;}

  /* ── Le halo, coupé en diagonale ─────────────────────────────────────── */
  /* Violet profond en haut, qui s'éclaircit vers le bas : même dégradé que le
     halo de la carte, à l'échelle de la page. */
  .pv-halo{position:absolute;inset:0;overflow:hidden;clip-path:polygon(70% 0, 100% 0, 100% 100%, 60% 100%);
    background:
      radial-gradient(55% 45% at 78% -8%,#2F22A8 0%,#5646D6 42%,transparent 78%),
      linear-gradient(180deg,#8C7DFF 0%,#B4A9FF 38%,#DDD8FF 72%,#ECEAFA 100%);}
  /* Grille DROITE de cases en verre, une colonne sur deux décalée d'une demi-
     case : inclinée, elle jurait avec les cadres et fenêtres bien d'aplomb du
     reste de la page. Pas de hauteur fixe sur la grille, sinon les rangées
     s'écrasent sous la hauteur des cases. */
  .pv-mur{position:absolute;top:-60px;left:56%;display:grid;grid-template-columns:repeat(4,150px);gap:18px;}
  .pv-case{position:relative;aspect-ratio:4/5;border-radius:18px;overflow:hidden;
    background:linear-gradient(160deg,rgba(255,255,255,.5),rgba(255,255,255,.22));
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.55),0 24px 44px -26px var(--vio-ombre);}
  .pv-case:nth-child(4n+2),.pv-case:nth-child(4n+4){translate:0 50%;}
  .pv-case img{width:100%;height:100%;object-fit:cover;display:block;}

  /* ── La carte « un seul outil », posée sur le halo ───────────────────── */
  .pv-remplace-large{position:absolute;top:50%;right:clamp(28px,3.2vw,64px);translate:0 -50%;z-index:3;
    width:min(380px,29vw);}
  .pv-remplace-mobile{display:none;}

  /* ── La partie claire ────────────────────────────────────────────────── */
  .pv-marque{position:absolute;top:28px;left:clamp(24px,4vw,56px);z-index:4;line-height:0;}
  .pv-marque img{height:34px;width:34px;border-radius:10px;display:block;box-shadow:0 8px 18px -10px rgba(16,19,11,.5);}
  /* Largeur calée sur le bas de la diagonale (60 %), moins une marge. 128 px en
     haut : le titre respire sous le logo. */
  .pv-clair{position:relative;z-index:2;width:calc(60% - 36px);max-width:900px;min-height:100dvh;
    display:flex;flex-direction:column;justify-content:center;
    padding:128px 0 44px clamp(24px,4vw,56px);}

  /* ── L'en-tête : titre à gauche, texte et période à droite ───────────── */
  .pv-tete{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:clamp(40px,5vw,88px);
    align-items:center;width:100%;}
  /* Casse normale et léger relief, comme le titre du document de la carte. */
  .pv-h1{margin:0;font-family:var(--heavy);font-weight:800;letter-spacing:-.045em;line-height:1;
    font-size:clamp(42px,4.2vw,64px);color:#1D2019;text-shadow:0 3px 12px rgba(16,19,11,.12);}
  .pv-h1 .pv-l{display:block;white-space:nowrap;}
  /* .26em entre les lignes : le cadre du mot sélectionné déborde de 8 px, et à
     .14em il venait toucher la ligne du dessus. */
  .pv-h1 .pv-l + .pv-l{margin-top:.26em;}
  .pv-tete-droite{display:flex;flex-direction:column;align-items:flex-start;}
  .pv-lead{margin:0;color:var(--ink-2);font-size:15.5px;line-height:1.5;max-width:30ch;text-wrap:pretty;}

  /* Le mot sélectionné : cadre violet et poignées carrées de l'éditeur. */
  /* margin-left : le décalage du cadre mangeait l'espace, et il collait au mot
     d'avant. */
  .pv-mot{--o:8px;position:relative;display:inline-block;margin-left:.14em;outline:2px solid var(--vio);outline-offset:var(--o);border-radius:2px;}
  .pv-mot i{position:absolute;width:11px;height:11px;background:#fff;border:2px solid var(--vio);border-radius:2px;}
  .pv-mot i:nth-of-type(1){top:calc(-1 * var(--o) - 5.5px);left:calc(-1 * var(--o) - 5.5px);}
  .pv-mot i:nth-of-type(2){top:calc(-1 * var(--o) - 5.5px);right:calc(-1 * var(--o) - 5.5px);}
  .pv-mot i:nth-of-type(3){bottom:calc(-1 * var(--o) - 5.5px);left:calc(-1 * var(--o) - 5.5px);}
  .pv-mot i:nth-of-type(4){bottom:calc(-1 * var(--o) - 5.5px);right:calc(-1 * var(--o) - 5.5px);}

  /* Curseurs nommés de la page, mêmes couleurs que ceux de la carte. */
  .pv-curseur{position:absolute;z-index:3;display:flex;flex-direction:column;align-items:flex-start;pointer-events:none;
    font-family:var(--sans);letter-spacing:0;text-shadow:none;
    animation:pv-flotte 3.4s ease-in-out var(--d,0s) infinite alternate;}
  .pv-fleche{width:20px;height:20px;stroke:#fff;stroke-width:1.6;stroke-linejoin:round;filter:drop-shadow(0 1px 2px rgba(0,0,0,.25));}
  .pv-etiquette{margin:2px 0 0 13px;padding:4px 11px;border-radius:10px;font-size:14px;font-weight:650;line-height:1.3;white-space:nowrap;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 8px 16px -8px rgba(16,19,11,.35);}
  .pv-curseur.is-vert .pv-fleche{fill:#7ED66A;} .pv-curseur.is-vert .pv-etiquette{background:#DDF8CF;color:#2E6A1D;border:1.5px solid #A6E68A;}
  .pv-curseur.is-violet .pv-fleche{fill:#8C7DFF;} .pv-curseur.is-violet .pv-etiquette{background:#E6E1FF;color:#4B3BC4;border:1.5px solid #B9AEFF;}
  @keyframes pv-flotte{from{translate:0 0;}to{translate:4px -5px;}}
  /* « Vous » au coin bas GAUCHE du mot, flèche vers le haut à droite, dans
     l'espace entre l'en-tête et les cartes. À droite du mot il tombait sur le
     choix de période, au coin bas droit contre l'étiquette de Studio. */
  .pv-mot .pv-curseur{right:calc(100% + 4px);top:calc(100% + 6px);align-items:flex-end;}
  .pv-mot .pv-curseur .pv-fleche{transform:scaleX(-1);}
  .pv-mot .pv-curseur .pv-etiquette{margin:2px 13px 0 0;}

  /* Sélecteur de période : pastille de verre. */
  .pv-periode{display:inline-flex;align-self:flex-start;align-items:center;gap:4px;margin-top:16px;padding:5px;
    border-radius:999px;background:rgba(255,255,255,.8);
    box-shadow:inset 0 0 0 1px rgba(16,19,11,.07),0 16px 32px -22px var(--vio-ombre);}
  .pv-periode button{padding:8px 13px;border-radius:999px;font-weight:800;font-size:14px;color:var(--ink-2);white-space:nowrap;
    display:inline-flex;align-items:center;gap:8px;transition:background .2s,color .2s;}
  .pv-periode button.is-on{background:var(--ink);color:#fff;}
  .pv-deux{font-size:11px;padding:2px 7px;border-radius:7px;white-space:nowrap;
    background:#DDF8CF;color:#2E6A1D;box-shadow:inset 0 0 0 1px #A6E68A;}

  /* ── Les cartes de prix ─────────────────────────────────────────────── */
  /* 72 px sous l'en-tête : place pour le curseur « Vous » et pour l'étiquette
     de la carte Studio, qui remonte. */
  .pv-grille{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:72px;align-items:stretch;}
  .pv-col{position:relative;display:flex;min-width:0;}
  .pv-col.is-pop{transform:translateY(-14px);}
  /* Lueur violette floue sous la carte mise en avant, comme au bas des
     fenêtres de la carte Curseurs. */
  .pv-col.is-pop::before{content:"";position:absolute;left:8%;right:8%;bottom:-18px;height:60%;border-radius:50%;
    background:#9C8CFF;filter:blur(34px);opacity:.55;z-index:0;}
  .pv-carte{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;min-width:0;
    background:var(--card);color:var(--ink);border-radius:24px;padding:26px 20px 22px;
    box-shadow:inset 0 0 0 1px rgba(16,19,11,.06),0 30px 60px -40px var(--vio-ombre);}
  .pv-carte.is-pop{color:var(--cream);
    background:radial-gradient(120% 70% at 50% -12%,#17402E 0%,var(--forest) 62%);
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.06),0 40px 80px -40px rgba(7,33,23,.7);}

  /* Le cadre de sélection de l'offre mise en avant : poignées carrées. */
  .pv-sel{position:relative;display:flex;flex:1;min-width:0;}
  /* Cadre droit autour d'une carte arrondie, poignées sur ses coins : c'est la
     sélection de l'éditeur, qui encadre la boîte et pas la forme. */
  .pv-sel-cadre{position:absolute;inset:-10px;border:2px solid var(--vio);border-radius:4px;pointer-events:none;z-index:2;}
  .pv-sel-h{position:absolute;width:12px;height:12px;background:#fff;border:2px solid var(--vio);border-radius:3px;
    box-shadow:0 2px 6px rgba(16,19,11,.18);}
  .pv-sel-h:nth-child(1){top:-7px;left:-7px;} .pv-sel-h:nth-child(2){top:-7px;right:-7px;}
  .pv-sel-h:nth-child(3){bottom:-7px;left:-7px;} .pv-sel-h:nth-child(4){bottom:-7px;right:-7px;}

  /* « Le plus choisi » : un curseur qui désigne la carte. */
  .pv-flag{position:absolute;top:-30px;right:22px;z-index:3;pointer-events:none;
    animation:pv-flotte 3.4s ease-in-out -1.4s infinite alternate;}
  .pv-flag-txt{display:block;padding:5px 12px;border-radius:10px;font-size:13.5px;font-weight:700;white-space:nowrap;
    background:#E6E1FF;color:#4B3BC4;border:1.5px solid #B9AEFF;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 10px 20px -10px var(--vio-ombre);}
  .pv-flag .pv-fleche{position:absolute;left:-15px;bottom:-15px;fill:#8C7DFF;transform:scaleY(-1);}

  .pv-nom{font-family:var(--oaks-x);font-weight:700;text-transform:uppercase;letter-spacing:.015em;
    line-height:.95;font-size:21px;margin:0;}
  .pv-tag{font-weight:600;font-size:13px;line-height:1.35;color:var(--ink-3);margin-top:6px;}
  .pv-carte.is-pop .pv-tag{color:var(--cream-3);}
  /* Étiquettes aux coins arrondis avec liseré, comme celles des curseurs. */
  .pv-badge{display:inline-flex;align-self:flex-start;align-items:center;margin-top:18px;padding:5px 9px;
    border-radius:9px;background:#DDF8CF;color:#2E6A1D;box-shadow:inset 0 0 0 1.5px #A6E68A;
    font-weight:800;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;}
  .pv-prix{display:flex;align-items:baseline;column-gap:8px;row-gap:2px;flex-wrap:wrap;margin:10px 0 2px;}
  .pv-prix.sans-remise{margin-top:22px;}
  .pv-barre{font-family:var(--heavy);font-weight:800;font-size:clamp(20px,1.7vw,26px);letter-spacing:-.03em;line-height:1;
    color:var(--ink-3);text-decoration:line-through;text-decoration-thickness:2px;white-space:nowrap;}
  .pv-montant{font-family:var(--heavy);font-weight:800;font-size:clamp(36px,3.1vw,50px);letter-spacing:-.04em;line-height:1;white-space:nowrap;}
  .pv-mois{font-weight:700;font-size:13px;color:var(--ink-3);}
  .pv-carte.is-pop .pv-barre{color:var(--cream-3);}
  .pv-carte.is-pop .pv-mois{color:var(--cream-2);}
  .pv-note{font-size:12px;line-height:1.45;color:var(--ink-3);margin:6px 0 16px;min-height:16px;}
  .pv-carte.is-pop .pv-note{color:var(--cream-3);}
  .pv-chip{display:inline-flex;align-self:flex-start;align-items:center;padding:7px 12px;border-radius:10px;
    font-weight:700;font-size:12.5px;white-space:nowrap;background:var(--fond);color:var(--ink-2);
    box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.07);}
  .pv-carte.is-pop .pv-chip{background:rgba(255,255,255,.07);color:var(--cream-2);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.1);}
  .pv-btn{width:100%;display:inline-flex;align-items:center;justify-content:center;
    min-height:52px;padding:14px 16px;border-radius:999px;font-weight:800;font-size:15px;letter-spacing:-.01em;
    transition:box-shadow .2s,background .2s;white-space:nowrap;}
  /* Préfixés par .pv : la remise à zéro « .pv button » (fond transparent) est
     plus spécifique qu'une classe seule. */
  .pv .pv-btn-ghost{color:var(--ink);background:#fff;box-shadow:inset 0 0 0 1.6px var(--line),0 10px 20px -16px var(--vio-ombre);}
  .pv .pv-btn-ghost:hover{box-shadow:inset 0 0 0 2px var(--ink);}
  .pv .pv-btn-leaf{background:var(--leaf);color:var(--leaf-ink);box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 16px 32px -16px rgba(120,190,90,.55);}
  .pv .pv-btn-leaf:hover{background:#C9F5B2;}
  /* L'espace extensible aligne les boutons en bas des trois cartes. */
  .pv-espace{flex:1;min-height:22px;}

  /* Trois cartes dans la moitié de l'écran : le prix barré passe au-dessus du
     prix sur les trois, faute de place à côté sur Studio. */
  @media(min-width:1101px){ .pv-barre{flex-basis:100%;} }

  .pv-rassure{margin:28px 0 0;font-size:13.5px;line-height:1.5;color:var(--ink-3);}
  .pv-rassure b{color:var(--ink-2);}

  @media (prefers-reduced-motion: reduce){ .pv-curseur,.pv-flag{animation:none;} }

  /* ── Sous 1100 px : la diagonale ne tient plus, on empile ────────────── */
  @media(max-width:1100px){
    .pv{min-height:0;}
    .pv-halo{position:relative;inset:auto;height:30vh;min-height:210px;max-height:300px;
      clip-path:polygon(0 0, 100% 0, 100% 82%, 0 100%);
      background:
        radial-gradient(70% 70% at 60% -15%,#2F22A8 0%,#5646D6 45%,transparent 80%),
        linear-gradient(180deg,#8C7DFF 0%,#B4A9FF 60%,#CFC8FF 100%);}
    .pv-mur{top:-34px;left:50%;translate:-50% 0;grid-template-columns:repeat(4,96px);gap:12px;}
    .pv-case{border-radius:14px;}
    .pv-remplace-large{display:none;}
    /* En tête de page, remontée sur le bas du bandeau : Martin la veut avant
       les prix. */
    .pv-remplace-mobile{display:block;position:relative;width:100%;max-width:420px;margin:-84px auto 40px;text-align:left;}
    .pv-marque{top:18px;left:20px;}
    .pv-clair{width:100%;max-width:none;min-height:0;align-items:center;text-align:center;padding:26px 20px 48px;}
    /* Plus la place pour deux colonnes : le bloc s'empile, aligné à gauche
       comme les cartes en dessous. */
    .pv-tete{display:flex;flex-direction:column;align-items:flex-start;text-align:left;max-width:980px;}
    .pv-tete .pv-lead{margin:18px 0 0;font-size:16px;max-width:40ch;}
    .pv-periode{align-self:flex-start;margin-top:20px;}
    .pv-grille{width:100%;max-width:980px;text-align:left;}
    .pv-rassure{max-width:44ch;}
    /* À droite du mot, à sa hauteur : sous le titre, « Vous » tombait sur le
       texte. */
    .pv-mot .pv-curseur{right:auto;left:calc(100% + 12px);top:-6%;align-items:flex-start;}
    .pv-mot .pv-curseur .pv-fleche{transform:none;}
    .pv-mot .pv-curseur .pv-etiquette{margin:2px 0 0 13px;}
  }
  /* Trois cartes côte à côte ne tiennent plus : une colonne, comme la landing. */
  @media(max-width:760px){
    .pv-h1{font-size:clamp(38px,11vw,50px);}
    .pv-mot{--o:6px;}
    .pv-grille{grid-template-columns:1fr;max-width:420px;gap:30px;margin-top:44px;}
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

  // Même règle que la landing : sans compte connu, l'offre reste ouverte.
  const lancement = launchApplies(periode) && (seatsLeft === null || seatsLeft > 0);
  const annuel = periode === "yearly";

  useEffect(() => {
    setNom(lireDraft()?.name ?? "");
    // Les visuels déposés par Martin prennent la place des cases vides.
    fetch("/api/vitrine")
      .then(r => r.json())
      .then(j => { if (Array.isArray(j?.visuels) && j.visuels.length) setVisuels(j.visuels); })
      .catch(() => { /* les cases restent vides */ });
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

  /* Le prix Studio TEL QUE LA CARTE L'AFFICHE, période et remise comprises :
     c'est lui qu'on oppose à la pile d'outils. */
  const studioAffiche = annuel ? PLANS.solo.priceYearly : PLANS.solo.priceMonthly;
  const prixStudio = lancement ? launchPrice(studioAffiche) : studioAffiche;

  /** Le dernier mot du titre, sélectionné, avec le curseur « Vous » dessus. */
  const motChoisi = (texte: string) => (
    <span className="pv-mot">
      {texte}
      <i /><i /><i /><i />
      <span className="pv-curseur is-vert" aria-hidden="true">
        <Fleche className="pv-fleche" />
        <span className="pv-etiquette">Vous</span>
      </span>
    </span>
  );

  const cases = visuels.length
    ? Array.from({ length: NB_CASES }, (_, i) => visuels[(i * 3 + Math.floor(i / 5)) % visuels.length])
    : Array<string>(NB_CASES).fill("");

  return (
    <div className="pv">
      <style dangerouslySetInnerHTML={{ __html: CSS + CARTE_CSS }} />

      <div className="pv-halo" aria-hidden="true">
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
        <CarteCurseurs prix={prixStudio} fmt={fmt} />
      </div>

      <Link href="/" className="pv-marque"><img src="/icon-192.png" alt="Klip" /></Link>

      <div className="pv-clair">
        <div className="pv-remplace-mobile">
          <CarteCurseurs prix={prixStudio} fmt={fmt} />
        </div>

        <div className="pv-tete">
          <h1 className="pv-h1">
            {nom ? (
              <><span className="pv-l">Les visuels de</span><span className="pv-l">{motChoisi(nom)}</span></>
            ) : (
              <><span className="pv-l">Vos visuels</span><span className="pv-l">sont {motChoisi("prêts")}</span></>
            )}
          </h1>
          <div className="pv-tete-droite">
            <p className="pv-lead">Chacun s&apos;ouvre dans l&apos;éditeur, calque par calque. L&apos;essai ouvre tout le reste.</p>
            <div className="pv-periode">
              <button className={periode === "monthly" ? "is-on" : ""} onClick={() => setPeriode("monthly")}>{tp("monthly")}</button>
              <button className={annuel ? "is-on" : ""} onClick={() => setPeriode("yearly")}>
                {tp("yearly")}<span className="pv-deux">{tp("save2mo")}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="pv-grille">
          {offres.map(o => {
            const affiche = annuel ? o.annuel : o.mensuel;
            const carte = (
              <div className={"pv-carte" + (o.pop ? " is-pop" : "")}>
                {o.pop && (
                  <span className="pv-flag">
                    <span className="pv-flag-txt">{tp("popular")}</span>
                    <Fleche className="pv-fleche" />
                  </span>
                )}
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
                      <span className="pv-sel-h" /><span className="pv-sel-h" />
                      <span className="pv-sel-h" /><span className="pv-sel-h" />
                    </span>
                  </div>
                ) : carte}
              </div>
            );
          })}
        </div>

        <p className="pv-rassure">
          <b>0 € aujourd&apos;hui.</b> Premier prélèvement dans {TRIAL_DAYS} jours, annulable en un clic.
        </p>
      </div>
    </div>
  );
}
