"use client";

/* « Klip remplace tout ça » : la carte qui accompagne les offres.
 *
 * Martin a choisi l'idée Fusion (six icônes, une seule), puis demandé une
 * facture plus moderne sur une référence précise : un halo coloré en L derrière
 * une fenêtre de navigateur qui se fond vers le bas, des curseurs nommés, un
 * cadre de sélection, un titre en casse normale et une phrase grise dessous.
 * Trois propositions dans ce style, à départager (2026-09-14) :
 *
 *  · Curseurs : les outils deviennent des collaborateurs qui travaillent tous
 *    sur le même document. Halo violet, la couleur de sélection de l'éditeur.
 *  · Orbite   : l'icône Klip au centre, cadre de sélection, les six icônes
 *    autour reliées à elle par des pointillés qui convergent. Halo vert.
 *  · Dossier  : la composition Fusion d'origine dans la fenêtre, et un curseur
 *    « Vous » qui clique sur Klip. Halo vert clair.
 *
 * TOUT EST EN UNITÉS DE CONTENEUR (cqw). La carte fait 380 px en desktop et
 * 335 px en mobile : en pixels fixes, le titre de la fenêtre débordait sur
 * mobile ou flottait sur desktop. En cqw, la composition garde ses proportions.
 *
 * Les logos remplissent leur case (Google favicons en 256 px, `object-fit:
 * cover`) ; Canva est la seule ronde, on l'agrandit sur un fond de son dégradé.
 */

import { useState } from "react";

export type Carte = "curseurs" | "orbite" | "dossier";
export const CARTES: { cle: Carte; nom: string }[] = [
  { cle: "curseurs", nom: "Curseurs" },
  { cle: "orbite", nom: "Orbite" },
  { cle: "dossier", nom: "Dossier" },
];

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

function Icone({ outil, rond }: { outil: Outil; rond?: boolean }) {
  const [rate, setRate] = useState(false);
  return (
    <span className={"fx-ic" + (rond ? " is-rond" : "")} style={{ background: outil.fond }}>
      {rate ? (
        <span className="fx-ic-lettre">{outil.nom.charAt(0)}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://www.google.com/s2/favicons?sz=256&domain=${outil.domaine}`} alt={outil.nom}
          width={64} height={64} loading="lazy" onError={() => setRate(true)}
          style={outil.zoom ? { transform: `scale(${outil.zoom})` } : undefined} />
      )}
    </span>
  );
}

function IconeKlip() {
  return (
    <span className="fx-klip">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/klip-media/klip-app-icon.png" alt="Klip" width={128} height={128} />
    </span>
  );
}

/** Le cadre de sélection de l'éditeur, poignées carrées aux coins. */
function Selection({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={"fx-sel " + (className ?? "")}>
      {children}
      <i className="fx-poignee is-hg" /><i className="fx-poignee is-hd" />
      <i className="fx-poignee is-bg" /><i className="fx-poignee is-bd" />
    </span>
  );
}

/** Un curseur de collaborateur : la flèche, puis l'étiquette à son nom. */
function Curseur({ nom, teinte, style, fleche = "haut-gauche" }: {
  nom: string; teinte: "violet" | "vert" | "ambre"; style: React.CSSProperties; fleche?: "haut-gauche" | "haut-droite";
}) {
  return (
    <span className={`fx-curseur is-${teinte} is-${fleche}`} style={style}>
      <svg className="fx-fleche" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 2.5 21 10l-8.2 2.3L10 21 3 2.5Z" />
      </svg>
      <span className="fx-etiquette">{nom}</span>
    </span>
  );
}

function Fenetre({ children }: { children: React.ReactNode }) {
  return (
    <div className="fx-cadre">
      <div className="fx-fenetre">
        <div className="fx-barre">
          <i style={{ background: "#EE6A5F" }} /><i style={{ background: "#F5BD4F" }} /><i style={{ background: "#61C454" }} />
          <span className="fx-url">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.4" /></svg>
            getklip.fr
          </span>
        </div>
        <div className="fx-scene">{children}</div>
      </div>
    </div>
  );
}

type Props = { prix: number; fmt: (v: number) => string };

function Phrase({ prix, fmt }: Props) {
  return <p className="fx-p">Pour <b>{fmt(prix)} €/mois</b> au lieu de ~{TOTAL} €.</p>;
}

/* ── 1. Curseurs ──────────────────────────────────────────────────────────── */
function Curseurs(props: Props) {
  return (
    <div className="fx is-violet">
      <div className="fx-halo" />
      <Fenetre>
        <span className="fx-pile">
          {OUTILS.map(o => <Icone key={o.nom} outil={o} rond />)}
        </span>
        <span className="fx-titre-doc">
          <span className="fx-l1">Six abonnements</span>
          <Selection className="fx-l2">Un seul outil</Selection>
        </span>
        <span className="fx-lueur" />
      </Fenetre>
      {/* Hors de la fenêtre : les curseurs peuvent déborder sur le halo, comme
          sur la référence, sans être rognés par le fondu du bas. */}
      <Curseur nom="ChatGPT" teinte="vert" style={{ left: "44%", top: "19%", ["--d" as string]: "0s" }} />
      <Curseur nom="Canva" teinte="violet" fleche="haut-droite" style={{ left: "3%", top: "44%", ["--d" as string]: "-1.2s" }} />
      <Curseur nom="CapCut" teinte="ambre" style={{ left: "71%", top: "52%", ["--d" as string]: "-2.1s" }} />
      <div className="fx-texte">
        <p className="fx-h">Tout se fait au même endroit</p>
        <Phrase {...props} />
      </div>
    </div>
  );
}

/* ── 2. Orbite ────────────────────────────────────────────────────────────── */
/** Positions des six icônes autour du centre, en % de la scène. */
const ORBITE = [
  { x: 16, y: 30 }, { x: 40, y: 12 }, { x: 76, y: 20 },
  { x: 84, y: 64 }, { x: 64, y: 88 }, { x: 22, y: 76 },
];
const CENTRE = { x: 48, y: 50 };

function Orbite(props: Props) {
  return (
    <div className="fx is-vert">
      <div className="fx-halo" />
      <Fenetre>
        <svg className="fx-liens" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {ORBITE.map((p, i) => (
            <line key={i} x1={p.x} y1={p.y} x2={CENTRE.x} y2={CENTRE.y} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {OUTILS.map((o, i) => (
          <span key={o.nom} className="fx-satellite"
            style={{ left: `${ORBITE[i].x}%`, top: `${ORBITE[i].y}%`, ["--dx" as string]: `${(CENTRE.x - ORBITE[i].x) / 14}cqw`, ["--dy" as string]: `${(CENTRE.y - ORBITE[i].y) / 22}cqw`, ["--d" as string]: `${-i * 0.45}s` }}>
            <Icone outil={o} />
          </span>
        ))}
        <span className="fx-centre" style={{ left: `${CENTRE.x}%`, top: `${CENTRE.y}%` }}>
          <Selection><IconeKlip /></Selection>
        </span>
        <span className="fx-lueur" />
      </Fenetre>
      <div className="fx-texte">
        <p className="fx-h">Six abonnements, un seul outil</p>
        <Phrase {...props} />
      </div>
    </div>
  );
}

/* ── 3. Dossier ───────────────────────────────────────────────────────────── */
function Dossier(props: Props) {
  return (
    <div className="fx is-lime">
      <div className="fx-halo" />
      <Fenetre>
        <span className="fx-compo">
          <span className="fx-dossier">
            {OUTILS.map(o => <Icone key={o.nom} outil={o} />)}
          </span>
          <svg className="fx-vers" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
          <span className="fx-cible"><IconeKlip /></span>
        </span>
        <span className="fx-lueur" />
      </Fenetre>
      <Curseur nom="Vous" teinte="vert" style={{ left: "72%", top: "47%", ["--d" as string]: "-.8s" }} />
      <div className="fx-texte">
        <p className="fx-h">Six abonnements, un seul outil</p>
        <Phrase {...props} />
      </div>
    </div>
  );
}

export default function CarteOutils({ carte, ...props }: Props & { carte: Carte }) {
  if (carte === "orbite") return <Orbite {...props} />;
  if (carte === "dossier") return <Dossier {...props} />;
  return <Curseurs {...props} />;
}

export const CARTE_CSS = `
  /* ── Le cadre commun ─────────────────────────────────────────────────── */
  .fx{position:relative;container-type:inline-size;overflow:hidden;border-radius:28px;background:#F4F5F1;
    box-shadow:0 0 0 1px rgba(16,19,11,.06),0 40px 80px -36px rgba(16,19,11,.55);}
  /* Le halo en L : fort en haut, il longe le bord gauche puis s'éteint vers le
     bas, pour que le titre se lise sur un fond clair. */
  .fx-halo{position:absolute;inset:0;pointer-events:none;
    -webkit-mask-image:linear-gradient(to bottom,#000 30%,transparent 74%);mask-image:linear-gradient(to bottom,#000 30%,transparent 74%);}
  .fx.is-violet .fx-halo{background:
    radial-gradient(70% 55% at 55% -8%,#2F22A8 0%,#5646D6 38%,transparent 72%),
    linear-gradient(90deg,#8C7DFF 0%,#B7ADFF 14%,transparent 30%),
    linear-gradient(180deg,#9D90FF 0%,#D9D3FF 40%,transparent 70%);}
  .fx.is-vert .fx-halo{background:
    radial-gradient(70% 55% at 55% -8%,#073B28 0%,#138A5E 40%,transparent 72%),
    linear-gradient(90deg,#2FD79B 0%,#8BE8B9 14%,transparent 30%),
    linear-gradient(180deg,#47D69A 0%,#C9F3DC 40%,transparent 70%);}
  .fx.is-lime .fx-halo{background:
    radial-gradient(70% 55% at 55% -8%,#1FA878 0%,#6ED99B 40%,transparent 72%),
    linear-gradient(90deg,#9BE38A 0%,#C9F2B4 14%,transparent 30%),
    linear-gradient(180deg,#A6EC8E 0%,#E3FAD6 40%,transparent 70%);}

  /* La fenêtre, décalée vers la droite et coupée par le bord de la carte, avec
     son liseré de verre sur le haut et la gauche. */
  .fx-cadre{position:relative;margin:10.5cqw 0 0 9cqw;padding:2.4cqw 0 0 2.4cqw;border-radius:6cqw 0 0 0;
    background:rgba(255,255,255,.3);box-shadow:inset 1px 1px 0 rgba(255,255,255,.45);
    -webkit-mask-image:linear-gradient(to bottom,#000 62%,transparent 100%);mask-image:linear-gradient(to bottom,#000 62%,transparent 100%);}
  .fx-fenetre{position:relative;overflow:hidden;border-radius:3.8cqw 0 0 0;background:#F2F4F7;}
  .fx.is-vert .fx-fenetre,.fx.is-lime .fx-fenetre{background:#F3F5F1;}
  .fx-barre{display:flex;align-items:center;gap:1.6cqw;height:8.4cqw;padding:0 3.2cqw;background:rgba(255,255,255,.75);}
  .fx-barre i{width:2.7cqw;height:2.7cqw;border-radius:50%;flex:none;}
  .fx-url{margin-left:auto;margin-right:7cqw;display:inline-flex;align-items:center;gap:1.2cqw;
    font-size:3.5cqw;font-weight:600;color:#7B7F75;}
  .fx-url svg{width:3.2cqw;height:3.2cqw;fill:currentColor;}
  .fx-scene{position:relative;height:56cqw;}
  /* La lueur colorée floue au bas de la fenêtre. */
  .fx-lueur{position:absolute;left:12%;right:0;bottom:-14cqw;height:30cqw;border-radius:50%;filter:blur(8cqw);opacity:.7;pointer-events:none;}
  .fx.is-violet .fx-lueur{background:#9C8CFF;}
  .fx.is-vert .fx-lueur{background:#4FD9A0;}
  .fx.is-lime .fx-lueur{background:#A9EC8C;}

  .fx-texte{position:relative;margin-top:-4cqw;padding:0 7cqw 7.5cqw;text-align:center;}
  .fx-h{margin:0;font-family:var(--sans);font-weight:650;font-size:6cqw;line-height:1.15;letter-spacing:-.02em;color:var(--ink);text-wrap:balance;}
  .fx-p{margin:2.6cqw 0 0;font-size:4cqw;line-height:1.4;color:var(--ink-3);}
  .fx-p b{color:var(--ink);font-weight:800;}

  /* ── Icônes ─────────────────────────────────────────────────────────── */
  .fx-ic{position:relative;flex:none;display:grid;place-items:center;overflow:hidden;width:9cqw;height:9cqw;border-radius:2.5cqw;
    box-shadow:0 1.2cqw 2.6cqw -1.4cqw rgba(16,19,11,.55);}
  .fx-ic img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;}
  .fx-ic::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(16,19,11,.1);}
  .fx-ic.is-rond{border-radius:50%;box-shadow:0 0 0 .7cqw #fff,0 1cqw 2cqw -1cqw rgba(16,19,11,.5);}
  .fx-ic-lettre{font-family:var(--heavy);font-weight:800;font-size:4.4cqw;color:var(--ink);}
  .fx-klip{position:relative;display:block;overflow:hidden;width:19cqw;height:19cqw;border-radius:5cqw;
    box-shadow:0 3cqw 6cqw -3cqw rgba(7,33,23,.7);}
  .fx-klip img{width:100%;height:100%;display:block;}

  /* ── Cadre de sélection ─────────────────────────────────────────────── */
  /* Le cadre est un outline décalé de --o ; les poignées se calent sur ce
     décalage, pas sur le contenu, sinon elles flottent à l'intérieur. */
  .fx-sel{--o:1.4cqw;position:relative;display:inline-block;outline:1.5px solid var(--vio);outline-offset:var(--o);}
  .fx-poignee{position:absolute;width:7px;height:7px;background:#fff;border:1.5px solid var(--vio);box-sizing:border-box;}
  .fx-poignee.is-hg{top:calc(-1 * var(--o) - 3.5px);left:calc(-1 * var(--o) - 3.5px);}
  .fx-poignee.is-hd{top:calc(-1 * var(--o) - 3.5px);right:calc(-1 * var(--o) - 3.5px);}
  .fx-poignee.is-bg{bottom:calc(-1 * var(--o) - 3.5px);left:calc(-1 * var(--o) - 3.5px);}
  .fx-poignee.is-bd{bottom:calc(-1 * var(--o) - 3.5px);right:calc(-1 * var(--o) - 3.5px);}

  /* ── Curseurs nommés ────────────────────────────────────────────────── */
  .fx-curseur{position:absolute;z-index:4;display:flex;flex-direction:column;align-items:flex-start;pointer-events:none;
    animation:fx-flotte 3.4s ease-in-out var(--d,0s) infinite alternate;}
  .fx-curseur.is-haut-droite{align-items:flex-end;}
  .fx-fleche{width:5cqw;height:5cqw;stroke:#fff;stroke-width:1.6;stroke-linejoin:round;filter:drop-shadow(0 1px 2px rgba(0,0,0,.25));}
  .fx-curseur.is-haut-droite .fx-fleche{transform:scaleX(-1);}
  .fx-etiquette{margin:.6cqw 0 0 3.2cqw;padding:1.1cqw 2.8cqw;border-radius:2.6cqw;font-size:4.1cqw;font-weight:650;white-space:nowrap;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 1.6cqw 3.4cqw -1.6cqw rgba(16,19,11,.4);}
  .fx-curseur.is-haut-droite .fx-etiquette{margin:.6cqw 3.2cqw 0 0;}
  .fx-curseur.is-violet .fx-fleche{fill:#8C7DFF;} .fx-curseur.is-violet .fx-etiquette{background:#E6E1FF;color:#4B3BC4;border:1.5px solid #B9AEFF;}
  .fx-curseur.is-vert .fx-fleche{fill:#7ED66A;} .fx-curseur.is-vert .fx-etiquette{background:#DDF8CF;color:#2E6A1D;border:1.5px solid #A6E68A;}
  .fx-curseur.is-ambre .fx-fleche{fill:#EDB65A;} .fx-curseur.is-ambre .fx-etiquette{background:#FBE7C2;color:#8A5A12;border:1.5px solid #F0C77A;}
  @keyframes fx-flotte{from{translate:0 0;}to{translate:1.2cqw -1.6cqw;}}

  /* ── 1. Curseurs ────────────────────────────────────────────────────── */
  .fx-pile{position:absolute;left:4cqw;top:3.4cqw;display:flex;}
  .fx-pile .fx-ic{width:7.6cqw;height:7.6cqw;}
  .fx-pile .fx-ic + .fx-ic{margin-left:-2.2cqw;}
  .fx-titre-doc{position:absolute;left:14cqw;top:17cqw;display:flex;flex-direction:column;align-items:flex-start;gap:3cqw;
    font-family:var(--heavy);font-weight:800;font-size:7.4cqw;line-height:1;letter-spacing:-.03em;color:#23261F;
    text-shadow:0 .6cqw 1.6cqw rgba(16,19,11,.16);white-space:nowrap;}

  /* ── 2. Orbite ──────────────────────────────────────────────────────── */
  .fx-liens{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}
  .fx-liens line{stroke:rgba(16,19,11,.22);stroke-width:1.5;stroke-dasharray:3 5;animation:fx-flux 1.4s linear infinite;}
  @keyframes fx-flux{to{stroke-dashoffset:-16;}}
  .fx-satellite{position:absolute;translate:-50% -50%;animation:fx-attire 2.8s ease-in-out var(--d,0s) infinite alternate;}
  @keyframes fx-attire{to{translate:calc(-50% + var(--dx)) calc(-50% + var(--dy));}}
  .fx-centre{position:absolute;translate:-50% -50%;}
  .fx-centre .fx-sel{--o:1.8cqw;}

  /* ── 3. Dossier ─────────────────────────────────────────────────────── */
  .fx-compo{position:absolute;inset:0 7cqw 0 0;display:flex;align-items:center;justify-content:center;gap:3.4cqw;}
  .fx-dossier{display:grid;grid-template-columns:repeat(3,9cqw);gap:1.8cqw;padding:2.4cqw;border-radius:5.4cqw;
    background:rgba(255,255,255,.7);box-shadow:inset 0 0 0 1px rgba(16,19,11,.06),0 3cqw 6cqw -4cqw rgba(16,19,11,.35);}
  .fx-vers{width:6cqw;height:6cqw;fill:none;stroke:#8A8D7D;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;}
  .fx-cible .fx-klip{width:23cqw;height:23cqw;border-radius:6cqw;box-shadow:0 0 0 1.4cqw rgba(189,242,160,.7),0 4cqw 7cqw -3cqw rgba(30,51,23,.6);}

  @media (prefers-reduced-motion: reduce){
    .fx-curseur,.fx-satellite,.fx-liens line{animation:none;}
  }
`;
