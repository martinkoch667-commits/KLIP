"use client";

/* Socle des écrans du parcours d'essai : connexion, site, questionnaire, charte.
 *
 * LA DIRECTION ARTISTIQUE est celle de la page d'offre et de sa carte
 * « Curseurs », étendue au parcours entier à la demande de Martin (2026-09-14) :
 * fond clair sous un halo violet, titres en casse normale au léger relief, mot
 * clé SÉLECTIONNÉ comme dans l'éditeur (cadre violet, poignées carrées),
 * étiquettes aux coins arrondis avec liseré, cartes blanches à ombre violette,
 * curseurs nommés. Le vert leaf reste la couleur de l'action.
 *
 * CE QUI A ÉTÉ RETIRÉ, et pourquoi. La première version empilait un fond
 * dégradé sombre, un fil d'étapes, un sur-titre et un paragraphe d'explication
 * sous chaque titre : chacun annonce un gabarit plutôt qu'un produit.
 *
 * LE CENTRAGE, qui a demandé deux essais. Le logo est sorti du flux (absolu, en
 * haut), la page est une grille centrée sur toute sa hauteur, et un padding
 * haut réserve la place du logo pour que rien ne passe dessous.
 *
 * MOBILE D'ABORD. C'est là que les gens arriveront depuis la campagne :
 * `100dvh`, une colonne, des cibles d'au moins 54 px, le contenu en haut et
 * l'action collée en bas, sous le pouce.
 */

import Link from "next/link";

/** Le mot clé d'un titre, sélectionné comme un calque dans l'éditeur. */
export function MotChoisi({ children }: { children: React.ReactNode }) {
  return <span className="ob-mot">{children}</span>;
}

/** Un curseur nommé : la flèche, puis l'étiquette. */
export function CurseurNomme({ nom, teinte, className, style }: {
  nom: string; teinte: "violet" | "vert" | "ambre"; className?: string; style?: React.CSSProperties;
}) {
  return (
    <span className={`ob-curseur is-${teinte} ${className ?? ""}`} style={style} aria-hidden="true">
      <svg className="ob-fleche" viewBox="0 0 24 24"><path d="M3 2.5 21 10l-8.2 2.3L10 21 3 2.5Z" /></svg>
      <span className="ob-etiquette">{nom}</span>
    </span>
  );
}

/* Les poignées carrées d'une sélection, dessinées en fond sur un pseudo-élément
   pour ne pas ajouter quatre éléments à chaque mot ou carte sélectionnés.
   Calques blancs d'abord (ils passent devant), carrés violets ensuite. */
const POIGNEES = `
    background:
      linear-gradient(#fff,#fff) 2px 2px/7px 7px no-repeat,
      linear-gradient(#fff,#fff) calc(100% - 2px) 2px/7px 7px no-repeat,
      linear-gradient(#fff,#fff) 2px calc(100% - 2px)/7px 7px no-repeat,
      linear-gradient(#fff,#fff) calc(100% - 2px) calc(100% - 2px)/7px 7px no-repeat,
      linear-gradient(var(--vio),var(--vio)) 0 0/11px 11px no-repeat,
      linear-gradient(var(--vio),var(--vio)) 100% 0/11px 11px no-repeat,
      linear-gradient(var(--vio),var(--vio)) 0 100%/11px 11px no-repeat,
      linear-gradient(var(--vio),var(--vio)) 100% 100%/11px 11px no-repeat;`;

export const ONB_CSS = `
  .ob{
    --fond:#F4F5F1; --carte:#FFFFFF; --creux:#EFF0EB;
    --ink:#10130B; --ink-2:#50544A; --ink-3:#8A8D7D;
    --vio:#6656D9; --vio-ombre:rgba(52,36,150,.3);
    --leaf:#BDF2A0; --leaf-ink:#1E3317;
    --heavy:'Archivo', system-ui, sans-serif;
    /* Anciens noms, encore lus par les écrans (charte, étapes d'analyse). */
    --sunk:var(--creux); --btn-soft:#E7E8E2; --btn-soft-2:#E2E3DC;
    position:relative;min-height:100vh;min-height:100dvh;overflow:hidden;background:var(--fond);color:var(--ink);
    /* align-content (et non place-items) : c'est lui qui centre l'ENSEMBLE des
       lignes. Avec place-items, deux enfants se partagent la hauteur. */
    display:grid;align-content:center;justify-items:center;gap:clamp(18px,3vh,26px);
    padding:clamp(80px,13vh,112px) clamp(18px,5vw,28px) clamp(40px,8vh,72px);}
  /* Le halo violet en haut de page, qui s'éteint avant le titre : violet
     profond sous le logo, lavande ensuite, puis le fond. Même dégradé que la
     carte Curseurs, à l'échelle de l'écran. */
  .ob::before{content:"";position:absolute;left:0;right:0;top:0;height:clamp(240px,40vh,420px);z-index:0;pointer-events:none;
    background:
      radial-gradient(60% 70% at 50% -22%,#2F22A8 0%,#5646D6 34%,transparent 72%),
      linear-gradient(180deg,#9D90FF 0%,#C9C1FF 38%,rgba(228,224,255,.6) 66%,transparent 100%);}
  .ob > *{position:relative;z-index:1;}

  /* C'est le LIEN qui sort du flux, pas seulement l'image : sinon il restait un
     élément de grille et le contenu se centrait dans la moitié basse. */
  .ob > .ob-marque{position:absolute;top:clamp(20px,3.4vh,36px);left:50%;transform:translateX(-50%);z-index:2;line-height:0;}
  .ob-marque img{height:clamp(32px,4.2vh,38px);width:clamp(32px,4.2vh,38px);border-radius:11px;display:block;
    box-shadow:0 0 0 3px rgba(255,255,255,.35),0 10px 22px -10px rgba(20,10,80,.6);}
  /* ob-corps est le conteneur, ob-in le champ : les deux noms ne doivent plus
     jamais se croiser (ils se cumulaient quand le conteneur s'appelait ob-in). */
  .ob-corps{width:100%;max-width:var(--ob-w,440px);text-align:center;}
  .ob-bas{width:100%;max-width:var(--ob-w,440px);text-align:center;}
  .ob-visuel{display:none;}

  /* ── Titres ─────────────────────────────────────────────────────────── */
  /* Casse normale et léger relief, comme le titre du document de la carte. */
  .ob-h1{font-family:var(--heavy);font-weight:800;text-transform:none;letter-spacing:-.04em;line-height:1.08;
    color:#1D2019;text-shadow:0 3px 12px rgba(16,19,11,.12);
    font-size:clamp(32px,7.4vw,44px);margin:0 0 16px;text-wrap:balance;}
  /* Le mot sélectionné. Marges latérales : le cadre est décalé de 6 px et
     mangerait l'espace avec les mots voisins. */
  .ob-mot{position:relative;display:inline-block;margin:0 .16em;outline:2px solid var(--vio);outline-offset:6px;border-radius:2px;}
  .ob-mot::after{content:"";position:absolute;inset:-13.5px;pointer-events:none;${POIGNEES}}
  .ob-sub{font-family:var(--sans);font-size:clamp(14.5px,3.9vw,16.5px);line-height:1.5;
    color:var(--ink-2);margin:0 auto clamp(22px,4vh,34px);max-width:34ch;text-wrap:pretty;}

  /* ── Curseurs nommés ────────────────────────────────────────────────── */
  .ob-curseur{position:absolute;z-index:3;display:flex;flex-direction:column;align-items:flex-start;pointer-events:none;
    animation:ob-flotte 3.4s ease-in-out var(--d,0s) infinite alternate;}
  .ob-fleche{width:19px;height:19px;stroke:#fff;stroke-width:1.6;stroke-linejoin:round;filter:drop-shadow(0 1px 2px rgba(0,0,0,.25));}
  .ob-etiquette{margin:2px 0 0 12px;padding:4px 11px;border-radius:10px;font-family:var(--sans);font-size:14px;font-weight:650;
    line-height:1.3;white-space:nowrap;box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 8px 16px -8px rgba(16,19,11,.35);}
  .ob-curseur.is-vert .ob-fleche{fill:#7ED66A;} .ob-curseur.is-vert .ob-etiquette{background:#DDF8CF;color:#2E6A1D;border:1.5px solid #A6E68A;}
  .ob-curseur.is-violet .ob-fleche{fill:#8C7DFF;} .ob-curseur.is-violet .ob-etiquette{background:#E6E1FF;color:#4B3BC4;border:1.5px solid #B9AEFF;}
  .ob-curseur.is-ambre .ob-fleche{fill:#EDB65A;} .ob-curseur.is-ambre .ob-etiquette{background:#FBE7C2;color:#8A5A12;border:1.5px solid #F0C77A;}
  @keyframes ob-flotte{from{translate:0 0;}to{translate:4px -5px;}}

  /* ── Boutons ────────────────────────────────────────────────────────── */
  .ob-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;
    min-height:56px;padding:15px 20px;border:none;border-radius:999px;cursor:pointer;
    font-family:var(--sans);font-weight:800;font-size:clamp(15px,4vw,16px);letter-spacing:-.01em;
    transition:transform .14s cubic-bezier(.2,.7,.3,1),filter .16s,background .16s;}
  .ob-btn + .ob-btn{margin-top:10px;}
  .ob-btn:active{transform:scale(.985);}
  .ob-btn svg{flex-shrink:0;}
  .ob-btn:disabled{opacity:.4;cursor:not-allowed;}
  /* Chaque réseau garde SA couleur : c'est ce qui rend le bouton reconnaissable
     avant d'être lu. */
  .ob-btn-ig{background:linear-gradient(78deg,#F9CE34 2%,#EE2A7B 46%,#6228D7 96%);color:#fff;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 16px 30px -18px rgba(98,40,215,.7);}
  .ob-btn-fb{background:#1877F2;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 16px 30px -18px rgba(24,119,242,.7);}
  .ob-btn-ig:hover:not(:disabled),.ob-btn-fb:hover:not(:disabled){filter:brightness(1.07);}
  .ob-btn-leaf{background:var(--leaf);color:var(--leaf-ink);box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 16px 30px -18px rgba(120,190,90,.65);}
  .ob-btn-leaf:hover:not(:disabled){background:#C9F5B2;}
  .ob-btn-soft{background:var(--carte);color:var(--ink);box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.1);}
  .ob-btn-soft:hover:not(:disabled){box-shadow:inset 0 0 0 2px var(--ink);}

  .ob-fin{font-family:var(--sans);font-size:13.5px;line-height:1.5;color:var(--ink-3);margin:16px 0 0;text-align:center;}
  .ob-lien{background:none;border:none;padding:2px 4px;cursor:pointer;font:inherit;
    font-weight:700;color:var(--ink-2);text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1.5px;}
  .ob-lien:hover{color:var(--ink);}

  /* ── Champs ─────────────────────────────────────────────────────────── */
  .ob-champ{display:flex;gap:9px;align-items:stretch;}
  .ob-input{flex:1;min-width:0;min-height:56px;padding:0 20px;border-radius:16px;border:none;
    background:var(--carte);color:var(--ink);outline:none;text-align:center;
    font-family:var(--sans);font-size:16px;font-weight:600;
    box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.08),0 16px 32px -24px var(--vio-ombre);transition:box-shadow .16s,outline-color .16s;}
  .ob-input::placeholder{color:var(--ink-3);font-weight:500;}
  /* Le champ en cours de saisie est « sélectionné » : cadre violet décalé,
     comme un calque dans l'éditeur, plutôt qu'un anneau de formulaire. */
  .ob-input:focus{outline:2px solid var(--vio);outline-offset:4px;}

  /* ── Choix ──────────────────────────────────────────────────────────── */
  /* Étiquettes aux coins arrondis pour les listes courtes. Choisie : l'étiquette
     verte à liseré des curseurs. */
  .ob-chips{display:flex;flex-wrap:wrap;gap:9px;justify-content:center;}
  .ob-chip{position:relative;min-height:46px;padding:11px 17px;border-radius:13px;border:none;cursor:pointer;
    font-family:var(--sans);font-size:15px;font-weight:700;color:var(--ink-2);background:var(--carte);
    box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.08),0 10px 22px -18px var(--vio-ombre);
    transition:background .13s,color .13s,box-shadow .13s;}
  .ob-chip:hover{color:var(--ink);box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.2),0 10px 22px -18px var(--vio-ombre);}
  .ob-chip.is-on{background:#DDF8CF;color:#2E6A1D;box-shadow:inset 0 0 0 1.5px #A6E68A,0 12px 24px -16px rgba(120,190,90,.55);}
  /* Blocs pour les listes décrites. Choisi : SÉLECTIONNÉ, cadre et poignées. */
  .ob-blocs{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .ob-bloc{position:relative;border:none;border-radius:16px;padding:15px 14px;text-align:center;cursor:pointer;
    background:var(--carte);box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.07),0 14px 28px -22px var(--vio-ombre);
    transition:box-shadow .14s;}
  .ob-bloc:hover{box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.18),0 14px 28px -22px var(--vio-ombre);}
  .ob-bloc.is-on{outline:2px solid var(--vio);outline-offset:4px;}
  .ob-bloc.is-on::after{content:"";position:absolute;inset:-11.5px;pointer-events:none;${POIGNEES}}
  .ob-bloc-l{font-family:var(--sans);font-weight:800;font-size:15px;color:var(--ink);}
  .ob-bloc-d{font-family:var(--sans);font-size:12.5px;color:var(--ink-3);margin-top:2px;line-height:1.4;}

  /* Une réponse devinée par l'analyse : petite étiquette violette. */
  .ob-auto{margin-left:8px;padding:2px 6px;border-radius:7px;font-family:var(--sans);font-size:10.5px;font-weight:800;
    background:#E6E1FF;color:#4B3BC4;box-shadow:inset 0 0 0 1px #B9AEFF;vertical-align:1px;}
  .ob-bloc .ob-auto{position:absolute;top:8px;right:8px;margin:0;}

  .ob-saisie{position:relative;background:var(--carte);border-radius:20px;padding:15px 16px;margin-bottom:12px;
    box-shadow:inset 0 0 0 1px rgba(16,19,11,.06),0 18px 36px -26px var(--vio-ombre);}
  .ob-saisie .ob-auto{position:absolute;top:15px;right:17px;margin:0;}
  .ob-saisie-l{display:block;font-family:var(--sans);font-size:12.5px;font-weight:700;color:var(--ink-3);margin-bottom:8px;}
  .ob-in{width:100%;box-sizing:border-box;min-height:48px;padding:12px 15px;border-radius:12px;
    border:none;background:var(--creux);color:var(--ink);outline:none;text-align:center;
    font-family:var(--sans);font-size:15.5px;font-weight:600;transition:background .16s;}
  .ob-in:focus{background:#fff;outline:2px solid var(--vio);outline-offset:3px;}
  .ob-ta{text-align:left;line-height:1.55;resize:vertical;font-weight:500;}

  .ob-pied{display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;margin-top:clamp(20px,3.6vh,30px);}
  .ob-retour{background:none;border:none;padding:8px 6px;cursor:pointer;font-family:var(--sans);
    font-size:14px;font-weight:700;color:var(--ink-3);order:1;}
  .ob-retour:hover{color:var(--ink);}
  .ob-retour:disabled{display:none;}
  .ob-suite{order:2;min-height:54px;padding:0 30px;border:none;border-radius:999px;cursor:pointer;
    background:var(--leaf);color:var(--leaf-ink);font-family:var(--sans);font-weight:800;font-size:16px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 16px 30px -18px rgba(120,190,90,.65);transition:transform .14s,background .16s;}
  .ob-suite:hover:not(:disabled){background:#C9F5B2;}
  .ob-suite:active{transform:scale(.985);}
  .ob-suite:disabled{opacity:.4;cursor:not-allowed;}

  /* ── Étapes de l'analyse du site ────────────────────────────────────── */
  .ob .wsx-steps{background:var(--carte);border-radius:20px;padding:18px 20px;text-align:left;
    box-shadow:inset 0 0 0 1px rgba(16,19,11,.06),0 18px 36px -26px var(--vio-ombre);}
  .ob .wsx-step.is-now .wsx-step-dot{background:var(--vio);box-shadow:0 0 0 5px rgba(102,86,217,.22);}

  /* ── Modale : carte blanche coiffée du halo ─────────────────────────── */
  .ob-mod-bg{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
    padding:20px;background:rgba(20,16,50,.42);animation:obFond .16s ease-out;}
  .ob-mod{width:100%;max-width:440px;border-radius:28px;padding:clamp(24px,6vw,32px);text-align:center;
    background:radial-gradient(90% 34% at 50% -8%,rgba(102,86,217,.32),transparent 72%),#fff;
    box-shadow:0 30px 70px -24px rgba(20,10,80,.45);
    animation:obMonte .2s cubic-bezier(.16,1,.3,1);max-height:88dvh;overflow-y:auto;}
  @keyframes obFond{from{opacity:0}to{opacity:1}}
  @keyframes obMonte{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  .ob-mod-h{font-family:var(--heavy);font-weight:800;text-transform:none;letter-spacing:-.035em;
    line-height:1.08;color:#1D2019;font-size:clamp(23px,5.8vw,28px);margin:0 0 11px;}
  .ob-mod-p{font-family:var(--sans);font-size:15px;line-height:1.55;color:var(--ink-2);margin:0 auto 22px;max-width:32ch;}

  /* Focus clavier : le cadre violet de la sélection, jamais l'anneau par défaut
     du navigateur. focus-visible ne se déclenche pas au clic. */
  .ob *:focus-visible{outline:2px solid var(--vio);outline-offset:3px;}

  @media (prefers-reduced-motion: reduce){ .ob-curseur{animation:none;} }

  /* ── Tablette et plus : la colonne respire, rien ne change de nature. ── */
  @media(min-width:640px){
    .ob-corps{max-width:var(--ob-w,470px);}
    .ob-h1{font-size:clamp(38px,4.2vw,48px);}
  }
  /* ══ MOBILE ═════════════════════════════════════════════════════════════
     Trois décisions propres au téléphone : le contenu MONTE sous le logo,
     l'action DESCEND sous le pouce (safe-area comprise), le titre GROSSIT. */
  @media(max-width:639px){
    .ob{padding:clamp(76px,12vh,96px) 20px 18px;}
    .ob-h1{font-size:clamp(34px,10vw,44px);}
    .ob-mot{outline-offset:5px;}
    .ob-mot::after{inset:-12.5px;}
    .ob-sub{font-size:16px;max-width:30ch;}

    .ob-adeux{grid-template-rows:1fr auto;align-content:stretch;place-items:stretch;}
    /* Pas de overflow ici : il découpait net les ombres portées. */
    .ob-adeux .ob-corps{align-self:start;padding-top:clamp(14px,4vh,42px);margin-inline:auto;}
    .ob-adeux .ob-bas{align-self:end;width:100%;max-width:var(--ob-w,440px);margin-inline:auto;
      padding-bottom:env(safe-area-inset-bottom,0px);}

    .ob-visuel{display:block;}

    .ob-blocs{grid-template-columns:1fr;gap:16px;}
    .ob-champ{flex-direction:column;}
    .ob-pied{flex-direction:column-reverse;gap:6px;}
    .ob-pied .ob-suite{order:0;width:100%;}
    .ob-pied .ob-retour{order:1;}
  }
`;

export default function OnboardingShell({
  children, largeur, bas,
}: {
  children: React.ReactNode;
  largeur?: number;
  /** Zone d'action. Sur mobile elle se DÉTACHE du contenu et se colle en bas de
   *  l'écran, sous le pouce ; sur grand écran elle suit le contenu. */
  bas?: React.ReactNode;
}) {
  return (
    <div className={"ob" + (bas ? " ob-adeux" : "")}
      style={largeur ? ({ ["--ob-w" as string]: `${largeur}px` }) : undefined}>
      <style dangerouslySetInnerHTML={{ __html: ONB_CSS }} />
      <Link href="/" className="ob-marque"><img src="/icon-192.png" alt="Klip" /></Link>
      <div className="ob-corps">{children}</div>
      {bas && <div className="ob-bas">{bas}</div>}
    </div>
  );
}
