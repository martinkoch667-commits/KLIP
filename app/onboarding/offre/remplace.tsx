"use client";

/* « Klip remplace tout ça » — quatre façons de le dire, à départager par Martin.
 *
 * Toutes lisent la même pile d'outils que le comparatif de la landing (six
 * outils, ~95 €/mois) et le prix de l'offre Studio TEL QU'IL EST AFFICHÉ sur la
 * carte voisine : période choisie et remise de lancement comprises. Annoncer
 * 39 € à côté d'une carte qui dit 22,75 € ferait douter des deux chiffres.
 *
 * LES LOGOS REMPLISSENT LEUR CASE. La version précédente posait un favicon au
 * milieu d'une pastille verte : on voyait la pastille avant l'outil. Ici l'icône
 * EST la case, comme une icône d'app. Google sert ces icônes en 256 px ; Canva
 * est la seule ronde, on l'agrandit et on peint ses coins de son dégradé.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export type Variante = "calques" | "ticket" | "fusion" | "barres";
export const VARIANTES: { cle: Variante; nom: string }[] = [
  { cle: "calques", nom: "Calques" },
  { cle: "ticket", nom: "Ticket" },
  { cle: "fusion", nom: "Fusion" },
  { cle: "barres", nom: "Barres" },
];

type Outil = { nom: string; cout: number; domaine: string; usage: string; fond: string; zoom?: number };

/** Mêmes outils, mêmes tarifs et même ordre que STACK_TOOLS sur la landing. */
const OUTILS: Omit<Outil, "usage">[] = [
  { nom: "Canva", cout: 12, domaine: "canva.com", fond: "linear-gradient(135deg,#19C6D1,#7B2FF2)", zoom: 1.34 },
  { nom: "CapCut", cout: 15, domaine: "capcut.com", fond: "#FFFFFF" },
  { nom: "ChatGPT", cout: 23, domaine: "chatgpt.com", fond: "#FFFFFF" },
  { nom: "Metricool", cout: 25, domaine: "metricool.com", fond: "#EAFD75" },
  { nom: "Notion", cout: 10, domaine: "notion.so", fond: "#FFFFFF" },
  { nom: "WeTransfer", cout: 10, domaine: "wetransfer.com", fond: "#17181A" },
];
const TOTAL = OUTILS.reduce((s, o) => s + o.cout, 0);

function useOutils(): Outil[] {
  const t = useTranslations("landing.comparison");
  const usages: Record<string, string> = {
    Canva: t("useCanva"), CapCut: t("useCapcut"), ChatGPT: t("useChatgpt"),
    Metricool: t("useMetricool"), Notion: t("useNotion"), WeTransfer: t("useWetransfer"),
  };
  return OUTILS.map(o => ({ ...o, usage: usages[o.nom] }));
}

/** L'icône d'un outil, qui remplit toute sa case. */
export function IconeOutil({ outil, taille }: { outil: Pick<Outil, "nom" | "domaine" | "fond" | "zoom">; taille: number }) {
  const [rate, setRate] = useState(false);
  return (
    <span className="rt-ic" style={{ width: taille, height: taille, borderRadius: Math.round(taille * 0.26), background: outil.fond }}>
      {rate ? (
        <span className="rt-ic-lettre" style={{ fontSize: taille * 0.5 }}>{outil.nom.charAt(0)}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://www.google.com/s2/favicons?sz=256&domain=${outil.domaine}`} alt={outil.nom}
          width={taille} height={taille} loading="lazy" onError={() => setRate(true)}
          style={outil.zoom ? { transform: `scale(${outil.zoom})` } : undefined} />
      )}
    </span>
  );
}

function IconeKlip({ taille }: { taille: number }) {
  return (
    <span className="rt-ic rt-ic-klip" style={{ width: taille, height: taille, borderRadius: Math.round(taille * 0.26) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/klip-media/klip-app-icon.png" alt="Klip" width={taille} height={taille} />
    </span>
  );
}

/** Vrai dès que le bloc entre à l'écran : sur mobile il est sous les cartes, et
 *  une animation jouée hors de la vue serait perdue. */
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
    return () => io.disconnect();
  }, []);
  return [ref, vu];
}

function Oeil({ ferme }: { ferme: boolean }) {
  const p = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return ferme
    ? <svg {...p}><path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.5 17.5 0 0 1-2.4 3.3M6.4 6.5A16.9 16.9 0 0 0 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3.5 3.5l17 17"/></svg>
    : <svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
}

type Props = { prix: number; fmt: (v: number) => string };

/* ── 1. Calques : le panneau de la landing ───────────────────────────────── */
function Calques({ prix, fmt }: Props) {
  const outils = useOutils();
  const t = useTranslations("landing.comparison");
  const [ref, vu] = useVu<HTMLDivElement>();
  const [eteints, setEteints] = useState(0);
  useEffect(() => {
    if (!vu) return;
    const ids = outils.map((_, i) => setTimeout(() => setEteints(c => Math.max(c, i + 1)), 350 + i * 320));
    return () => ids.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vu]);
  const tout = eteints >= outils.length;

  return (
    <div ref={ref} className="rt-lp">
      <div className="rt-lp-tete">
        <span className="rt-lp-titre">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5Z"/><path d="M3 13l9 5 9-5"/></svg>
          Calques
        </span>
        <span className="rt-lp-fichier">votre-stack.klip</span>
      </div>
      <div className="rt-lp-ligne is-klip">
        <span className="rt-lp-oeil"><Oeil ferme={false} /></span>
        <IconeKlip taille={42} />
        <div className="rt-lp-txt">
          <div className="rt-lp-nom">KLIP</div>
          <div className="rt-lp-usage">Tout ça réuni, pour {fmt(prix)}€{t("perMonth")}</div>
        </div>
        <span className="rt-lp-cout is-klip">{fmt(prix)}€</span>
      </div>
      {outils.map((o, i) => (
        <div key={o.nom} className={"rt-lp-ligne" + (i < eteints ? " is-off" : "")}>
          <span className="rt-lp-oeil"><Oeil ferme={i < eteints} /></span>
          <IconeOutil outil={o} taille={42} />
          <div className="rt-lp-txt">
            <div className="rt-lp-nom rt-barre">{o.nom}</div>
            <div className="rt-lp-usage">{o.usage}</div>
          </div>
          <span className="rt-lp-cout rt-barre">~{o.cout}€</span>
        </div>
      ))}
      <div className={"rt-lp-pied" + (tout ? " is-off" : "")}>
        <span>{t("yourStack")}</span>
        <span className="rt-barre">~{TOTAL}€{t("perMonth")}</span>
      </div>
    </div>
  );
}

/* ── 2. Ticket : la note mensuelle de la stack, tamponnée ───────────────── */
function Ticket({ prix, fmt }: Props) {
  const outils = useOutils();
  const [ref, vu] = useVu<HTMLDivElement>();
  return (
    <div ref={ref} className={"rt-ticket" + (vu ? " is-vu" : "")}>
      <div className="rt-ticket-tete">
        <span className="rt-ticket-marque">Votre stack</span>
        <span className="rt-ticket-sous">Note mensuelle · 6 abonnements</span>
      </div>
      <div className="rt-ticket-sep" />
      {outils.map(o => (
        <div key={o.nom} className="rt-ticket-ligne">
          <IconeOutil outil={o} taille={26} />
          <span className="rt-ticket-nom">{o.nom}</span>
          <span className="rt-ticket-points" />
          <span className="rt-ticket-prix">{fmt(o.cout)} €</span>
        </div>
      ))}
      <div className="rt-ticket-sep" />
      <div className="rt-ticket-total">
        <span>Total</span>
        <span>~{fmt(TOTAL)} €/mois</span>
      </div>
      <div className="rt-ticket-klip">
        <IconeKlip taille={26} />
        <span className="rt-ticket-nom">Avec Klip</span>
        <span className="rt-ticket-points" />
        <span className="rt-ticket-prix is-klip">{fmt(prix)} €/mois</span>
      </div>
      <div className="rt-tampon" aria-hidden="true">
        <span>Remplacé</span>
        <span className="rt-tampon-sous">par Klip</span>
      </div>
    </div>
  );
}

/* ── 3. Fusion : six icônes, une seule ───────────────────────────────────── */
function Fusion({ prix, fmt }: Props) {
  const outils = useOutils();
  const [ref, vu] = useVu<HTMLDivElement>();
  return (
    <div ref={ref} className={"rt-fusion" + (vu ? " is-vu" : "")}>
      <div className="rt-fusion-scene">
        <div className="rt-fusion-pile">
          {outils.map((o, i) => (
            <span key={o.nom} className="rt-fusion-case" style={{ ["--i" as string]: i, zIndex: outils.length - i }}>
              <IconeOutil outil={o} taille={50} />
            </span>
          ))}
        </div>
        <span className="rt-fusion-fleche" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
        </span>
        <span className="rt-fusion-klip"><IconeKlip taille={72} /></span>
      </div>
      <p className="rt-fusion-h">Six abonnements. <span className="acc-hl">Un seul outil.</span></p>
      <p className="rt-fusion-p">
        Canva, CapCut, ChatGPT, Metricool, Notion et WeTransfer réunis dans Klip.{" "}
        <b>~{TOTAL} €/mois</b> d&apos;outils, remplacés par <b>{fmt(prix)} €/mois</b>.
      </p>
    </div>
  );
}

/* ── 4. Barres : ce qu'on paie aujourd'hui, ce qu'on paiera ─────────────── */
function Barres({ prix, fmt }: Props) {
  const outils = useOutils();
  const [ref, vu] = useVu<HTMLDivElement>();
  const economie = Math.max(0, Math.round(TOTAL - prix));
  // Du plus foncé au plus clair : la barre se lit comme un seul bloc, les logos
  // au-dessus disent qui est qui. Six couleurs de marque criaient trop fort.
  const teintes = ["#072117", "#0C3123", "#124732", "#2C5E47", "#557C69", "#86A393"];
  return (
    <div ref={ref} className={"rt-barres" + (vu ? " is-vu" : "")}>
      <div className="rt-barres-ligne">
        <span className="rt-barres-lib">Aujourd&apos;hui, 6 abonnements</span>
        <span className="rt-barres-val">~{TOTAL} €/mois</span>
      </div>
      <div className="rt-barres-logos">
        {outils.map(o => (
          <span key={o.nom} style={{ flex: o.cout }}><IconeOutil outil={o} taille={24} /></span>
        ))}
      </div>
      <div className="rt-barres-piste">
        {outils.map((o, i) => (
          <span key={o.nom} className="rt-barres-seg" style={{ flex: o.cout, background: teintes[i] }} />
        ))}
      </div>

      <div className="rt-barres-ligne is-klip">
        <span className="rt-barres-lib">Avec Klip, tout compris</span>
        <span className="rt-barres-val">{fmt(prix)} €/mois</span>
      </div>
      <div className="rt-barres-piste is-klip">
        <span className="rt-barres-seg is-klip" style={{ width: `${Math.max(8, (prix / TOTAL) * 100)}%` }}>
          <IconeKlip taille={24} />
        </span>
      </div>

      <div className="rt-barres-eco">
        <span className="rt-barres-eco-n">−{economie} €</span>
        <span className="rt-barres-eco-t">de moins chaque mois</span>
      </div>
    </div>
  );
}

export default function Remplace({ variante, prix, fmt }: Props & { variante: Variante }) {
  if (variante === "ticket") return <Ticket prix={prix} fmt={fmt} />;
  if (variante === "fusion") return <Fusion prix={prix} fmt={fmt} />;
  if (variante === "barres") return <Barres prix={prix} fmt={fmt} />;
  return <Calques prix={prix} fmt={fmt} />;
}

export const REMPLACE_CSS = `
  /* ── Icônes d'outils ─────────────────────────────────────────────────── */
  .rt-ic{position:relative;flex:none;display:grid;place-items:center;overflow:hidden;}
  .rt-ic img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;}
  /* Filet intérieur : une icône blanche (CapCut, ChatGPT, Notion) posée sur une
     carte blanche n'aurait sinon aucun bord. */
  .rt-ic::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
    box-shadow:inset 0 0 0 1px rgba(16,19,11,.10);}
  .rt-ic-klip::after{box-shadow:none;}
  .rt-ic-lettre{font-family:var(--heavy);font-weight:800;color:var(--ink);}

  .rt-barre{position:relative;display:inline-block;}
  .rt-barre::after{content:"";position:absolute;left:-3px;right:-3px;top:52%;height:2.5px;border-radius:2px;
    background:var(--vio);transform:rotate(-3deg) scaleX(0);transform-origin:left center;
    transition:transform .35s cubic-bezier(.3,1,.4,1) .1s;}
  .is-off .rt-barre::after{transform:rotate(-3deg) scaleX(1);}

  /* ── 1. Calques ─────────────────────────────────────────────────────── */
  .rt-lp{background:var(--card);border-radius:16px;overflow:hidden;
    box-shadow:0 0 0 1px var(--line-2),0 40px 80px -40px rgba(16,19,11,.45);}
  .rt-lp-tete{display:flex;align-items:center;justify-content:space-between;padding:13px 18px;
    border-bottom:1px solid var(--line-2);}
  .rt-lp-titre{display:inline-flex;align-items:center;gap:8px;font-weight:800;font-size:13px;letter-spacing:.05em;
    text-transform:uppercase;color:var(--ink-2);}
  .rt-lp-fichier{font-weight:800;font-size:11px;color:var(--ink-3);}
  .rt-lp-ligne{display:flex;align-items:center;gap:13px;padding:10px 18px;border-bottom:1px solid var(--line-2);
    transition:opacity .5s;}
  .rt-lp-ligne.is-off{opacity:.42;}
  .rt-lp-ligne.is-klip{background:linear-gradient(90deg,rgba(189,242,160,.5),rgba(189,242,160,.14));}
  .rt-lp-oeil{display:inline-flex;flex:none;color:var(--ink-2);}
  .rt-lp-txt{min-width:0;}
  .rt-lp-nom{font-weight:800;font-size:15px;line-height:1.25;}
  .rt-lp-usage{font-size:12.5px;line-height:1.3;color:var(--ink-3);}
  .rt-lp-cout{margin-left:auto;font-weight:800;font-size:14px;color:var(--ink-2);font-variant-numeric:tabular-nums;}
  .rt-lp-cout.is-klip{color:var(--mint-2);}
  .rt-lp-pied{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;
    background:#FAF9F4;font-weight:800;font-size:13px;color:var(--ink-3);}
  .rt-lp-pied .rt-barre{color:var(--ink);transition:color .3s;}
  .rt-lp-pied.is-off .rt-barre{color:var(--ink-3);}

  /* ── 2. Ticket ──────────────────────────────────────────────────────── */
  .rt-ticket{position:relative;background:#FFFEF7;border-radius:6px 6px 0 0;padding:22px 22px 26px;
    filter:drop-shadow(0 26px 34px rgba(0,0,0,.28));}
  /* Le bas dentelé : une rangée de demi-cercles creusés dans une bande de la
     couleur du ticket, qui laisse voir ce qu'il y a dessous. */
  .rt-ticket::after{content:"";position:absolute;left:0;right:0;bottom:-9px;height:10px;
    background:radial-gradient(circle at 9px 10px,transparent 6px,#FFFEF7 6.5px) 0 0/18px 10px repeat-x;}
  .rt-ticket-tete{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;}
  .rt-ticket-marque{font-family:var(--oaks-x);font-weight:700;text-transform:uppercase;font-size:19px;letter-spacing:.02em;}
  .rt-ticket-sous{font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);}
  .rt-ticket-sep{border-top:1.5px dashed rgba(16,19,11,.22);margin:15px 0;}
  .rt-ticket-ligne,.rt-ticket-klip{display:flex;align-items:center;gap:10px;padding:5px 0;}
  .rt-ticket-nom{font-weight:700;font-size:14.5px;}
  .rt-ticket-points{flex:1;border-bottom:2px dotted rgba(16,19,11,.2);transform:translateY(4px);}
  .rt-ticket-prix{font-weight:800;font-size:14.5px;font-variant-numeric:tabular-nums;}
  .rt-ticket-total{display:flex;justify-content:space-between;font-weight:800;font-size:16px;
    text-transform:uppercase;letter-spacing:.03em;text-decoration:line-through;text-decoration-color:var(--vio);
    text-decoration-thickness:2.5px;}
  .rt-ticket-klip{margin-top:12px;padding:10px 12px;border-radius:12px;background:var(--leaf);color:var(--leaf-ink);}
  .rt-ticket-klip .rt-ticket-points{border-color:rgba(30,51,23,.25);}
  .rt-ticket-prix.is-klip{font-size:15.5px;}
  .rt-tampon{position:absolute;right:18px;top:92px;display:flex;flex-direction:column;align-items:center;
    padding:9px 16px 10px;border:3px solid var(--vio);border-radius:12px;color:var(--vio);
    background:rgba(255,254,247,.72);rotate:-12deg;scale:1.6;opacity:0;
    transition:scale .45s cubic-bezier(.2,1.6,.4,1) .5s,opacity .2s .5s;}
  .rt-ticket.is-vu .rt-tampon{scale:1;opacity:1;}
  .rt-tampon span{font-family:var(--heavy);font-weight:800;text-transform:uppercase;font-size:21px;letter-spacing:.02em;line-height:1;}
  .rt-tampon .rt-tampon-sous{font-size:12px;letter-spacing:.14em;margin-top:3px;}

  /* ── 3. Fusion ──────────────────────────────────────────────────────── */
  .rt-fusion{background:var(--card);border-radius:18px;padding:26px 24px 24px;
    box-shadow:0 0 0 1px var(--line-2),0 40px 80px -40px rgba(16,19,11,.45);}
  .rt-fusion-scene{display:flex;align-items:center;justify-content:center;gap:12px;}
  .rt-fusion-pile{display:flex;align-items:center;padding-left:30px;}
  /* Les icônes arrivent en éventail puis se resserrent en pile. */
  .rt-fusion-case{display:inline-flex;margin-left:-30px;border-radius:15px;box-shadow:0 0 0 3px var(--card),0 8px 16px -8px rgba(16,19,11,.4);
    rotate:calc((var(--i) - 2.5) * 5deg);translate:calc((var(--i) - 2.5) * 12px) 0;opacity:0;
    transition:translate .6s cubic-bezier(.2,.9,.3,1) calc(var(--i) * 70ms),opacity .3s calc(var(--i) * 70ms),rotate .6s calc(var(--i) * 70ms);}
  .rt-fusion.is-vu .rt-fusion-case{opacity:1;translate:0 0;}
  .rt-fusion-fleche{display:inline-flex;color:var(--ink-3);}
  .rt-fusion-klip{display:inline-flex;border-radius:20px;box-shadow:0 0 0 6px rgba(189,242,160,.55),0 22px 34px -16px rgba(30,51,23,.6);
    scale:.6;opacity:0;transition:scale .5s cubic-bezier(.2,1.6,.4,1) .55s,opacity .25s .55s;}
  .rt-fusion.is-vu .rt-fusion-klip{scale:1;opacity:1;}
  .rt-fusion-h{font-family:var(--heavy);font-weight:800;text-transform:uppercase;letter-spacing:-.02em;
    line-height:1.05;font-size:24px;margin:22px 0 0;text-align:center;text-wrap:balance;}
  .rt-fusion-p{font-size:14px;line-height:1.5;color:var(--ink-2);margin:10px 0 0;text-align:center;text-wrap:pretty;}
  .rt-fusion-p b{color:var(--ink);}

  /* ── 4. Barres ──────────────────────────────────────────────────────── */
  .rt-barres{position:relative;background:var(--card);border-radius:18px;padding:22px 22px 24px;
    box-shadow:0 0 0 1px var(--line-2),0 40px 80px -40px rgba(16,19,11,.45);}
  .rt-barres-ligne{display:flex;align-items:baseline;justify-content:space-between;gap:10px;}
  .rt-barres-ligne.is-klip{margin-top:22px;}
  .rt-barres-lib{font-weight:700;font-size:13.5px;color:var(--ink-2);}
  .rt-barres-val{font-family:var(--heavy);font-weight:800;font-size:19px;letter-spacing:-.02em;white-space:nowrap;}
  .rt-barres-logos{display:flex;gap:3px;margin-top:12px;}
  .rt-barres-logos>span{display:flex;justify-content:center;min-width:0;}
  .rt-barres-piste{display:flex;gap:3px;height:16px;margin-top:6px;border-radius:999px;overflow:hidden;}
  .rt-barres-seg{display:block;transform-origin:left center;transform:scaleX(0);transition:transform .7s cubic-bezier(.2,.9,.3,1);}
  .rt-barres.is-vu .rt-barres-seg{transform:scaleX(1);}
  .rt-barres-piste.is-klip{height:40px;margin-top:10px;background:#F1F0E9;border-radius:12px;}
  .rt-barres-seg.is-klip{display:flex;align-items:center;justify-content:flex-end;padding:0 8px;border-radius:12px;
    background:var(--leaf);transition-delay:.35s;}
  .rt-barres-eco{position:absolute;right:16px;bottom:-20px;display:flex;flex-direction:column;align-items:flex-start;
    padding:9px 14px 10px;border-radius:14px;background:var(--forest);color:var(--cream);rotate:-3deg;
    box-shadow:0 18px 30px -14px rgba(7,33,23,.6);}
  .rt-barres-eco-n{font-family:var(--heavy);font-weight:800;font-size:24px;letter-spacing:-.03em;line-height:1;color:var(--leaf);}
  .rt-barres-eco-t{font-size:11.5px;font-weight:700;margin-top:3px;color:var(--cream-2);}

  /* ── Sélecteur de variante (aperçu seulement) ───────────────────────── */
  .rt-choix{position:fixed;left:50%;bottom:max(14px,env(safe-area-inset-bottom));translate:-50% 0;z-index:50;
    display:flex;align-items:center;gap:3px;padding:4px;border-radius:999px;background:var(--ink);
    box-shadow:0 18px 40px -12px rgba(0,0,0,.5);max-width:calc(100vw - 24px);}
  .rt-choix-lib{padding:0 8px 0 10px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.5);}
  .rt-choix button{padding:8px 12px;border-radius:999px;font-weight:800;font-size:13px;color:rgba(255,255,255,.8);white-space:nowrap;}
  .rt-choix button.is-on{background:var(--leaf);color:var(--leaf-ink);}
  @media(max-width:420px){ .rt-choix-lib{display:none;} .rt-choix button{padding:8px 10px;font-size:12.5px;} }
`;
