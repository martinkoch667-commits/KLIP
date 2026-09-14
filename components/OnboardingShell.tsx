"use client";

/* Socle des écrans du parcours d'essai : connexion, site, questionnaire, charte.
 *
 * CHAQUE ÉCRAN TIENT DANS UNE CASE, verrouillée par Martin le 2026-09-14 parmi
 * quatre idées : la « Fenêtre », tirée de la carte « Curseurs » de la page
 * d'offre. Halo vert en L, fenêtre de navigateur décalée et coupée par les
 * bords, adresse qui suit l'écran. TOUT est dedans, titre, champs, boutons et
 * mentions : rien ne flotte à côté.
 *
 * LE FOND DE PAGE EST BLANC PUR et sobre : le vert ne vit que dans la case.
 * LE VERT EST LA COULEUR DE KLIP, le violet n'est qu'un accent, celui de la
 * sélection dans l'éditeur.
 *
 * LE MOT CLÉ SÉLECTIONNÉ reprend EXACTEMENT la sélection du hero de la landing
 * (« OUTIL ») : carte blanche penchée en Oaks condensé capitales, cadre violet,
 * poignées rondes aux coins et en gélule au milieu des côtés, bouton de
 * rotation dessous, léger balancement.
 *
 * CE QUI A ÉTÉ RETIRÉ, et pourquoi. La première version empilait un fond
 * dégradé sombre, un fil d'étapes, un sur-titre et un paragraphe d'explication
 * sous chaque titre : chacun annonce un gabarit plutôt qu'un produit.
 *
 * LE LOGO EST DANS LA CASE, en onglet de la fenêtre (Martin, 2026-09-14) : posé
 * au-dessus, il prenait une bande entière sur mobile et poussait les boutons
 * sous la barre de Safari.
 *
 * SUR ORDINATEUR, LA CASE PASSE EN LARGEUR : l'intro (titre, phrase) à gauche,
 * le formulaire et ses actions à droite. D'où deux emplacements distincts,
 * `intro` et `children`.
 *
 * MOBILE D'ABORD. C'est là que les gens arriveront depuis la campagne :
 * `100dvh`, une colonne, des cibles d'au moins 54 px, le contenu en haut et
 * l'action collée en bas, sous le pouce.
 */

import Link from "next/link";

/** Le mot clé d'un titre, sélectionné comme le « OUTIL » du hero de la landing
 *  (composant `Sel` de landing-v3) : même carte, mêmes poignées, même rotation. */
export function MotChoisi({ children }: { children: React.ReactNode }) {
  return (
    <span className="ob-mot">
      <span className="ob-mot-carte">{children}</span>
      <span className="ob-sel-cadre" aria-hidden="true">
        <i className="ob-sel-h" style={{ top: -7, left: -7 }} />
        <i className="ob-sel-h" style={{ top: -7, right: -7 }} />
        <i className="ob-sel-h" style={{ bottom: -7, left: -7 }} />
        <i className="ob-sel-h" style={{ bottom: -7, right: -7 }} />
        <i className="ob-sel-p" style={{ top: -5, left: "50%", marginLeft: -11, width: 22, height: 9 }} />
        <i className="ob-sel-p" style={{ bottom: -5, left: "50%", marginLeft: -11, width: 22, height: 9 }} />
        <i className="ob-sel-p" style={{ left: -5, top: "50%", marginTop: -11, width: 9, height: 22 }} />
        <i className="ob-sel-p" style={{ right: -5, top: "50%", marginTop: -11, width: 9, height: 22 }} />
      </span>
      <span className="ob-sel-rot" aria-hidden="true">
        <span><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.9-6.2M20 3v4h-4" /></svg></span>
      </span>
    </span>
  );
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

/* Les poignées RONDES de la sélection de la landing (blanc, contour violet),
   dessinées en fond sur un pseudo-élément pour ne pas ajouter quatre éléments
   à chaque bloc ou carte sélectionnés. */
export const POIGNEES = `
    background:
      radial-gradient(circle,#fff 0 4.5px,#6656D9 4.6px 6.5px,transparent 6.6px) 0 0/14px 14px no-repeat,
      radial-gradient(circle,#fff 0 4.5px,#6656D9 4.6px 6.5px,transparent 6.6px) 100% 0/14px 14px no-repeat,
      radial-gradient(circle,#fff 0 4.5px,#6656D9 4.6px 6.5px,transparent 6.6px) 0 100%/14px 14px no-repeat,
      radial-gradient(circle,#fff 0 4.5px,#6656D9 4.6px 6.5px,transparent 6.6px) 100% 100%/14px 14px no-repeat;`;

export const ONB_CSS = `
  .ob{
    /* Fond BLANC pur et gris neutres : le #F4F5F1 d'avant tirait sur le beige
       (Martin, 2026-09-14). */
    --fond:#FFFFFF; --carte:#FFFFFF; --creux:#F3F4F6;
    --ink:#10130B; --ink-2:#50544A; --ink-3:#8A8D7D;
    --vio:#6656D9; --ombre:rgba(12,49,35,.28);
    --leaf:#BDF2A0; --leaf-ink:#1E3317;
    --heavy:'Archivo', system-ui, sans-serif;
    /* Anciens noms, encore lus par les écrans (charte, étapes d'analyse). */
    --sunk:var(--creux); --btn-soft:#EDEEF1; --btn-soft-2:#E6E8EC;
    position:relative;min-height:100vh;min-height:100dvh;overflow:hidden;background:var(--fond);color:var(--ink);
    /* align-content (et non place-items) : c'est lui qui centre l'ENSEMBLE des
       lignes. Avec place-items, deux enfants se partagent la hauteur. */
    display:grid;align-content:center;justify-items:center;gap:clamp(18px,3vh,26px);
    padding:clamp(24px,5vh,48px) clamp(18px,5vw,28px);}
  /* Positionnés SANS z-index : un z-index créait un contexte d'empilement par
     bloc, et la modale, rangée dans le contenu, restait sous d'autres blocs. */
  .ob > *{position:relative;}

  /* ob-corps est le conteneur, ob-in le champ : les deux noms ne doivent plus
     jamais se croiser (ils se cumulaient quand le conteneur s'appelait ob-in). */
  .ob-corps{width:100%;max-width:var(--ob-w,440px);text-align:center;}

  /* ── Titres ─────────────────────────────────────────────────────────── */
  /* Casse normale et léger relief. Interligne 1.36 et 54 px dessous : la carte
     du mot sélectionné est plus haute que la ligne, son cadre déborde de 10 px
     et le bouton de rotation pend de 46 px sous le mot. */
  .ob-h1{font-family:var(--heavy);font-weight:800;text-transform:none;letter-spacing:-.04em;line-height:1.36;
    color:#1D2019;text-shadow:0 3px 12px rgba(16,19,11,.12);
    font-size:clamp(32px,7.4vw,44px);margin:0 0 54px;text-wrap:balance;}

  /* Le mot sélectionné : la sélection du hero de la landing, à l'identique. */
  /* Marges : le cadre déborde de 10 px et ses gélules de 5 de plus. Sans
     marge haute, sur un titre de deux lignes, le cadre touchait la ligne du
     dessus ; sans marges latérales, il collait au « ? » voisin. */
  .ob-mot{position:relative;display:inline-block;margin:.4em .34em 0 .3em;rotate:-3deg;z-index:2;text-shadow:none;
    animation:ob-balance 5.5s ease-in-out 1.2s infinite;}
  @keyframes ob-balance{0%,100%{rotate:-3deg;}50%{rotate:-1deg;}}
  .ob-mot-carte{display:inline-flex;align-items:center;background:#fff;border-radius:.18em;padding:.06em .22em .1em;
    font-family:var(--oaks-c,'oaks-condensed'),Georgia,serif;font-weight:700;text-transform:uppercase;letter-spacing:.01em;
    line-height:1;color:var(--ink);font-size:1.2em;
    box-shadow:0 0 0 1.5px rgba(16,19,11,.08),0 24px 50px -22px rgba(16,19,11,.42);}
  .ob-sel-cadre{position:absolute;inset:-10px;border:2px solid var(--vio);border-radius:4px;pointer-events:none;}
  .ob-sel-cadre i{position:absolute;display:block;background:#fff;border:2px solid var(--vio);box-shadow:0 2px 6px rgba(16,19,11,.18);box-sizing:border-box;}
  .ob-sel-h{width:13px;height:13px;border-radius:50%;}
  .ob-sel-p{border-radius:999px;}
  .ob-sel-rot{position:absolute;left:50%;bottom:-46px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;pointer-events:none;}
  .ob-sel-rot::before{content:"";width:2px;height:18px;background:var(--vio);}
  .ob-sel-rot span{width:26px;height:26px;border-radius:50%;background:#fff;border:2px solid var(--vio);display:grid;place-items:center;
    color:var(--ink);box-shadow:0 3px 8px rgba(16,19,11,.2);}
  .ob-sel-rot svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;}
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
    box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.08),0 16px 32px -24px var(--ombre);transition:box-shadow .16s,outline-color .16s;}
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
    box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.08),0 10px 22px -18px var(--ombre);
    transition:background .13s,color .13s,box-shadow .13s;}
  .ob-chip:hover{color:var(--ink);box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.2),0 10px 22px -18px var(--ombre);}
  .ob-chip.is-on{background:#DDF8CF;color:#2E6A1D;box-shadow:inset 0 0 0 1.5px #A6E68A,0 12px 24px -16px rgba(120,190,90,.55);}
  /* Blocs pour les listes décrites. Choisi : SÉLECTIONNÉ, cadre et poignées. */
  .ob-blocs{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .ob-bloc{position:relative;border:none;border-radius:16px;padding:15px 14px;text-align:center;cursor:pointer;
    background:var(--carte);box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.07),0 14px 28px -22px var(--ombre);
    transition:box-shadow .14s;}
  .ob-bloc:hover{box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.18),0 14px 28px -22px var(--ombre);}
  /* Cadre RECTANGULAIRE autour du bloc arrondi, poignées sur ses coins : c'est
     la boîte qu'on sélectionne. Un outline suivait l'arrondi et laissait les
     poignées flotter à côté des coins. */
  .ob-bloc.is-on::before{content:"";position:absolute;inset:-6px;border:2px solid var(--vio);border-radius:4px;pointer-events:none;}
  .ob-bloc.is-on::after{content:"";position:absolute;inset:-12px;pointer-events:none;${POIGNEES}}
  .ob-bloc-l{font-family:var(--sans);font-weight:800;font-size:15px;color:var(--ink);}
  .ob-bloc-d{font-family:var(--sans);font-size:12.5px;color:var(--ink-3);margin-top:2px;line-height:1.4;}

  /* Une réponse devinée par l'analyse : petite étiquette violette. */
  .ob-auto{margin-left:8px;padding:2px 6px;border-radius:7px;font-family:var(--sans);font-size:10.5px;font-weight:800;
    background:#E6E1FF;color:#4B3BC4;box-shadow:inset 0 0 0 1px #B9AEFF;vertical-align:1px;}
  .ob-bloc .ob-auto{position:absolute;top:8px;right:8px;margin:0;}

  .ob-saisie{position:relative;background:var(--carte);border-radius:20px;padding:15px 16px;margin-bottom:12px;
    box-shadow:inset 0 0 0 1px rgba(16,19,11,.06),0 18px 36px -26px var(--ombre);}
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
    box-shadow:inset 0 0 0 1px rgba(16,19,11,.06),0 18px 36px -26px var(--ombre);}
  .ob .wsx-step.is-now .wsx-step-dot{background:var(--leaf);box-shadow:0 0 0 5px rgba(189,242,160,.4);}

  /* ── Modale : carte blanche, halo vert discret en tête ──────────────── */
  .ob-mod-bg{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
    padding:20px;background:rgba(7,20,14,.46);animation:obFond .16s ease-out;}
  .ob-mod{width:100%;max-width:440px;border-radius:28px;padding:clamp(24px,6vw,32px);text-align:center;
    background:radial-gradient(90% 34% at 50% -8%,rgba(31,168,120,.3),transparent 72%),#fff;
    box-shadow:0 30px 70px -24px rgba(7,33,23,.45);
    animation:obMonte .2s cubic-bezier(.16,1,.3,1);max-height:88dvh;overflow-y:auto;}
  @keyframes obFond{from{opacity:0}to{opacity:1}}
  @keyframes obMonte{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  .ob-mod-h{font-family:var(--heavy);font-weight:800;text-transform:none;letter-spacing:-.035em;
    line-height:1.08;color:#1D2019;font-size:clamp(23px,5.8vw,28px);margin:0 0 11px;}
  .ob-mod-p{font-family:var(--sans);font-size:15px;line-height:1.55;color:var(--ink-2);margin:0 auto 22px;max-width:32ch;}

  /* Focus clavier : le cadre violet de la sélection, jamais l'anneau par défaut
     du navigateur. focus-visible ne se déclenche pas au clic. */
  .ob *:focus-visible{outline:2px solid var(--vio);outline-offset:3px;}

  /* ══ LA CASE ═══════════════════════════════════════════════════════════
     Pas de transform, de filter ni de mask sur la case ou ses parents : ils
     font d'un élément le repère des enfants en position fixe, et les modales
     (connexion, charte) se retrouveraient enfermées dans la case. */
  .ob-corps{max-width:calc(var(--ob-w,440px) + 56px);}
  .ob-case{position:relative;display:flex;flex-direction:column;width:100%;border-radius:28px;overflow:hidden;
    background:#fff;text-align:center;box-shadow:0 0 0 1px rgba(16,19,11,.06),0 40px 80px -40px rgba(7,33,23,.45);}
  /* Le halo vert en L : fort en haut, il longe le bord gauche puis s'éteint. */
  .ob-case::before{content:"";position:absolute;inset:0;pointer-events:none;
    background:
      linear-gradient(180deg,rgba(255,255,255,0) 26%,#fff 70%),
      radial-gradient(70% 42% at 55% -6%,#072117 0%,#13603F 40%,transparent 72%),
      linear-gradient(90deg,#2FBF84 0%,#8BE3B5 8%,transparent 20%),
      linear-gradient(180deg,#3DC98E 0%,#C9F3DC 26%,transparent 50%);}
  /* La fenêtre, décalée et coupée par les bords droit et bas, avec son liseré
     de verre en haut et à gauche. */
  .ob-case-cadre{position:relative;flex:1;display:flex;flex-direction:column;margin:34px 0 0 24px;padding:8px 0 0 8px;
    border-radius:22px 0 0 0;background:rgba(255,255,255,.34);box-shadow:inset 1px 1px 0 rgba(255,255,255,.5);}
  .ob-case-fenetre{position:relative;flex:1;display:flex;flex-direction:column;overflow:hidden;background:#fff;
    border-radius:14px 0 0 0;box-shadow:0 0 30px -12px rgba(7,33,23,.25);}
  .ob-case-barre{display:flex;align-items:center;gap:6px;height:34px;padding:0 14px;background:#F6F7F8;
    border-bottom:1px solid rgba(16,19,11,.06);}
  .ob-case-barre i{width:10px;height:10px;border-radius:50%;flex:none;}
  /* L'onglet de la fenêtre porte le logo, comme la favicon d'un vrai site. */
  .ob-case-onglet{display:inline-flex;align-items:center;gap:6px;height:24px;margin-left:10px;padding:0 10px 0 4px;
    border-radius:8px;background:#fff;box-shadow:inset 0 0 0 1px rgba(16,19,11,.07),0 2px 6px -3px rgba(16,19,11,.18);
    font-family:var(--sans);font-size:12.5px;font-weight:800;letter-spacing:-.01em;color:var(--ink);text-decoration:none;}
  .ob-case-onglet img{width:17px;height:17px;border-radius:5px;display:block;}
  .ob-case-url{margin-left:auto;margin-right:12px;display:inline-flex;align-items:center;gap:5px;
    font-family:var(--sans);font-size:12.5px;font-weight:600;color:#7B7F75;white-space:nowrap;}
  .ob-case-url svg{width:11px;height:11px;fill:currentColor;}
  /* La fenêtre est décalée de 32 px à gauche et coupée à droite : le contenu en
     reprend une partie à droite pour rester centré dans la CASE. Jamais moins
     de 14 px à gauche : les poignées d'un bloc sélectionné débordent de 12 px. */
  .ob-case-contenu{position:relative;flex:1;display:flex;flex-direction:column;padding:30px 34px 28px 14px;}
  .ob-case-action{flex:1;display:flex;flex-direction:column;}
  .ob-case .ob-h1{font-size:clamp(30px,8.6vw,40px);}
  .ob-case .ob-sub{margin-bottom:clamp(18px,3vh,26px);}
  /* Les actions, DANS la fenêtre, poussées en bas de la case. */
  .ob-case-bas{margin-top:auto;padding-top:clamp(20px,3vh,28px);}

  @media (prefers-reduced-motion: reduce){ .ob-curseur{animation:none;} }

  /* ── Tablette et plus : la colonne respire, rien ne change de nature. ── */
  @media(min-width:640px){
    .ob-corps{max-width:var(--ob-w,470px);}
    .ob-h1{font-size:clamp(38px,4.2vw,48px);}
  }
  /* ══ ORDINATEUR : LA CASE EN LARGEUR ═══════════════════════════════════
     L'intro à gauche, le formulaire à droite. La case garde une hauteur
     minimale pour ne pas changer de taille d'une question à l'autre. */
  @media(min-width:980px){
    .ob-corps{max-width:1080px;}
    .ob-case{min-height:clamp(480px,76vh,620px);border-radius:30px;}
    .ob-case-cadre{margin:40px 0 0 32px;padding:9px 0 0 9px;border-radius:24px 0 0 0;}
    .ob-case-fenetre{border-radius:15px 0 0 0;}
    .ob-case-barre{height:40px;padding:0 16px;}
    .ob-case-onglet{height:27px;font-size:13.5px;padding-right:12px;}
    .ob-case-onglet img{width:19px;height:19px;}
    .ob-case-url{font-size:13px;margin-right:18px;}
    .ob-case-contenu{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1fr);column-gap:clamp(40px,5vw,72px);
      align-items:center;padding:40px 64px 44px 44px;text-align:left;}
    .ob-case-intro .ob-h1{font-size:clamp(42px,3.9vw,54px);margin-bottom:58px;text-wrap:balance;}
    .ob-case-intro .ob-mot{margin-left:.2em;}
    .ob-case-intro .ob-sub{margin:0;max-width:30ch;font-size:17px;}
    .ob-case-action{justify-content:center;}
    .ob-case-bas{margin-top:0;padding-top:26px;}
    /* À droite, tout s'aligne sur le bord gauche de la colonne. */
    .ob-case-action .ob-chips{justify-content:flex-start;}
    .ob-case-action .ob-fin{text-align:left;}
    .ob-case-action .ob-input,.ob-case-action .ob-in:not(.ob-ta){text-align:left;}
    .ob-case-action .ob-pied{justify-content:flex-end;}
    .ob-case-action .wsx-steps{margin-top:0;}
    /* La charte a six cartes à ranger : la colonne de droite prend la place. */
    .ob-case.is-large .ob-case-contenu{grid-template-columns:minmax(0,.62fr) minmax(0,1fr);}
    .ob-case.is-large .ob-case-intro .ob-h1{font-size:clamp(38px,3.3vw,46px);}
  }

  /* ══ MOBILE ═════════════════════════════════════════════════════════════
     Trois décisions propres au téléphone : le contenu MONTE sous le logo,
     l'action DESCEND sous le pouce (safe-area comprise), le titre GROSSIT. */
  @media(max-width:639px){
    .ob{padding:12px 12px 12px;}
    .ob-h1{font-size:clamp(34px,10vw,44px);}
    .ob-sel-cadre{inset:-7px;}
    .ob-sel-rot{bottom:-40px;}
    .ob-h1{margin-bottom:48px;}
    .ob-sub{font-size:16px;max-width:30ch;}

    /* La case REMPLIT l'écran, et ses actions se calent en bas de la case,
       sous le pouce. */
    .ob{align-content:start;padding-bottom:max(12px,env(safe-area-inset-bottom));}
    .ob-case{min-height:calc(100dvh - 12px - max(12px,env(safe-area-inset-bottom)));}


    .ob-blocs{grid-template-columns:1fr;gap:16px;}
    .ob-champ{flex-direction:column;}
    .ob-pied{flex-direction:column-reverse;gap:6px;}
    .ob-pied .ob-suite{order:0;width:100%;}
    .ob-pied .ob-retour{order:1;}

    .ob-case{border-radius:24px;}
    .ob-case-cadre{margin:28px 0 0 16px;padding:6px 0 0 6px;}
    .ob-case-contenu{padding:26px 22px 20px 12px;}
  }
`;

export default function OnboardingShell({
  children, intro, largeur, bas, chemin,
}: {
  children?: React.ReactNode;
  /** Titre et phrase : en haut sur mobile, colonne gauche sur ordinateur. */
  intro?: React.ReactNode;
  largeur?: number;
  /** Zone d'action, rangée DANS la fenêtre et poussée en bas de la case. */
  bas?: React.ReactNode;
  /** L'adresse affichée dans la barre de la fenêtre : getklip.fr/<chemin>. */
  chemin?: string;
}) {
  return (
    <div className="ob" style={largeur ? ({ ["--ob-w" as string]: `${largeur}px` }) : undefined}>
      <style dangerouslySetInnerHTML={{ __html: ONB_CSS }} />
      <div className="ob-corps">
        <div className={"ob-case" + (largeur && largeur >= 600 ? " is-large" : "")}>
          <div className="ob-case-cadre">
            <div className="ob-case-fenetre">
              <div className="ob-case-barre">
                <i style={{ background: "#EE6A5F" }} /><i style={{ background: "#F5BD4F" }} /><i style={{ background: "#61C454" }} />
                <Link href="/" className="ob-case-onglet" aria-label="Klip, accueil"><img src="/icon-192.png" alt="" />Klip</Link>
                <span className="ob-case-url" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.4" /></svg>
                  getklip.fr{chemin ? `/${chemin}` : ""}
                </span>
              </div>
              <div className="ob-case-contenu">
                {intro && <div className="ob-case-intro">{intro}</div>}
                <div className="ob-case-action">
                  <div className="ob-case-haut">{children}</div>
                  {bas && <div className="ob-case-bas">{bas}</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
