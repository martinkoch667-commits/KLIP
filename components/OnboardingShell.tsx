"use client";

/* Socle des écrans du parcours d'essai — page blanche, contenu centré.
 *
 * CE QUI A ÉTÉ RETIRÉ, et pourquoi. La première version empilait un fond
 * dégradé sombre, un fil d'étapes « Compte · Site · Questions · Charte », un
 * sur-titre « PREMIÈRE ÉTAPE » et un paragraphe d'explication sous chaque
 * titre. Chacun annonce un gabarit plutôt qu'un produit.
 *
 * LE CENTRAGE, qui a demandé deux essais. Mettre le logo dans le flux puis
 * centrer le reste avec `margin:auto` ne centre PAS sur la page : ça centre
 * dans l'espace qui reste SOUS le logo, donc tout descend d'une demi-hauteur de
 * logo et le bloc finit collé en bas. Le logo est donc sorti du flux (absolu,
 * en haut), la page est une grille `place-items:center` sur toute sa hauteur, et
 * un padding haut réserve la place du logo pour que rien ne passe dessous.
 *
 * MOBILE D'ABORD. C'est là que les gens arriveront depuis la campagne, donc
 * c'est le cas traité en premier : `100dvh` (et non `100vh`, qui compte la
 * barre d'adresse et fait sauter la page au premier défilement sur iOS), une
 * seule colonne, des cibles tactiles d'au moins 54 px, et les tailles qui
 * montent avec l'écran plutôt que l'inverse.
 *
 * L'ADN Klip tient en trois choses : titre Archivo capitales, mot accent en
 * Oaks surligné leaf (`.acc-hl`), leaf sur l'action principale.
 */

import Link from "next/link";

export const ONB_CSS = `
  /* align-content (et non place-items) : c'est lui qui centre l'ENSEMBLE des
     lignes. Avec place-items, deux enfants font deux lignes qui se partagent la
     hauteur, et le contenu redescend — l'erreur déjà faite avec le logo. */
  .ob{position:relative;min-height:100vh;min-height:100dvh;background:#FFFFFF;
    display:grid;align-content:center;justify-items:center;gap:clamp(18px,3vh,26px);
    padding:clamp(72px,12vh,104px) clamp(18px,5vw,28px) clamp(40px,8vh,72px);}
  /* C'est le LIEN qui sort du flux, pas seulement l'image qu'il contient. Avec
     l'image seule en absolu, le lien restait un élément de grille et créait une
     seconde ligne : le contenu se centrait alors dans la moitié basse de la
     page, d'où le bloc collé vers le bas. */
  .ob-marque{position:absolute;top:clamp(20px,3.4vh,36px);left:50%;transform:translateX(-50%);
    z-index:2;line-height:0;}
  .ob-marque img{height:clamp(30px,4vh,36px);width:clamp(30px,4vh,36px);
    border-radius:10px;display:block;}
  /* ATTENTION AU NOM. Le conteneur s'appelait ob-in, comme les champs de
     saisie : les deux règles se cumulaient, et la colonne centrale héritait du
     fond blanc, de la hauteur minimale et du centrage d'un champ de formulaire.
     Le conteneur est ob-corps, le champ reste ob-in, et les deux ne doivent
     plus jamais se croiser. */
  .ob-corps{width:100%;max-width:var(--ob-w,440px);text-align:center;}
  .ob-bas{width:100%;max-width:var(--ob-w,440px);text-align:center;}
  /* Respiration décorative, réservée au mobile : sur grand écran le contenu
     est centré et n'a pas de vide à occuper, alors que sur téléphone le
     titre monte et l'action descend, ce qui laisse un blanc au milieu. */
  .ob-visuel{display:none;}

  /* Le titre porte l'écran : gros, capitales, serré. Rien au-dessus de lui. */
  /* 900 et non 800 : c'est la graisse des grands titres de la landing. En 800
     à cette taille, le titre paraît maigre à côté du reste du site. */
  .ob-h1{font-family:var(--display);font-weight:900;text-transform:uppercase;
    letter-spacing:-.03em;line-height:.98;color:var(--leaf-ink);
    font-size:clamp(28px,7.4vw,40px);margin:0 0 13px;text-wrap:balance;}
  .ob-h1 .acc-hl{font-size:.96em;}
  .ob-sub{font-family:var(--sans);font-size:clamp(14.5px,3.9vw,16.5px);line-height:1.5;
    color:var(--ink-2);margin:0 auto clamp(22px,4vh,34px);max-width:34ch;text-wrap:pretty;}

  /* Boutons en gélule, pleine largeur, empilés. 54 px minimum au doigt. */
  .ob-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;
    min-height:56px;padding:15px 20px;border:none;border-radius:999px;cursor:pointer;
    font-family:var(--sans);font-weight:800;font-size:clamp(15px,4vw,16px);letter-spacing:-.01em;
    transition:transform .14s cubic-bezier(.2,.7,.3,1),filter .16s,background .16s;}
  .ob-btn + .ob-btn{margin-top:10px;}
  .ob-btn:active{transform:scale(.985);}
  .ob-btn svg{flex-shrink:0;}
  .ob-btn:disabled{opacity:.4;cursor:not-allowed;}
  /* Chaque réseau porte SA couleur : c'est ce qui rend le bouton reconnaissable
     avant d'être lu, et c'est aussi ce qu'attendent les gens d'un bouton de
     connexion sociale. */
  .ob-btn-ig{background:linear-gradient(78deg,#F9CE34 2%,#EE2A7B 46%,#6228D7 96%);color:#fff;}
  .ob-btn-fb{background:#1877F2;color:#fff;}
  .ob-btn-ig:hover:not(:disabled),.ob-btn-fb:hover:not(:disabled){filter:brightness(1.07);}
  .ob-btn-leaf{background:var(--leaf);color:var(--leaf-ink);}
  .ob-btn-leaf:hover:not(:disabled){background:var(--leaf-soft);}
  .ob-btn-soft{background:var(--btn-soft);color:var(--ink);}
  .ob-btn-soft:hover:not(:disabled){background:var(--btn-soft-2);}

  .ob-fin{font-family:var(--sans);font-size:13.5px;line-height:1.5;color:var(--ink-3);
    margin:16px 0 0;text-align:center;}
  .ob-lien{background:none;border:none;padding:2px 4px;cursor:pointer;font:inherit;
    font-weight:700;color:var(--ink-2);text-decoration:underline;text-underline-offset:4px;
    text-decoration-thickness:1.5px;}
  .ob-lien:hover{color:var(--ink);}

  /* Champ large, pour l'écran du site. En colonne sur mobile. */
  .ob-champ{display:flex;gap:9px;align-items:stretch;}
  .ob-input{flex:1;min-width:0;min-height:56px;padding:0 20px;border-radius:999px;border:none;
    background:var(--sunk);color:var(--ink);outline:none;text-align:center;
    font-family:var(--sans);font-size:16px;font-weight:600;
    box-shadow:inset 0 0 0 1.5px transparent;
    transition:box-shadow .16s,background .16s;}
  .ob-input::placeholder{color:var(--ink-3);font-weight:500;}
  .ob-input:hover:not(:focus){background:var(--btn-soft-2);}
  /* Liseré FIN à l'intérieur, pas un halo. L'anneau vert de 3 px posé autour du
     champ se lit comme un contour de formulaire des années 2010 : il double la
     forme et alourdit toute la page. Un trait intérieur d'1,5 px suffit à dire
     où l'on écrit. */
  .ob-input:focus{background:#fff;
    box-shadow:inset 0 0 0 1.5px rgba(30,51,23,.5), 0 2px 10px -6px rgba(13,15,10,.3);}

  /* Choix : gélules pour les listes courtes, blocs pour les listes décrites. */
  .ob-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}
  .ob-chip{position:relative;min-height:46px;padding:11px 18px;border-radius:999px;border:none;
    cursor:pointer;font-family:var(--sans);font-size:15px;font-weight:700;color:var(--ink-2);
    background:var(--sunk);transition:background .13s,color .13s;}
  .ob-chip:hover{background:var(--btn-soft-2);color:var(--ink);}
  .ob-chip.is-on{background:var(--leaf);color:var(--leaf-ink);}
  .ob-blocs{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
  .ob-bloc{position:relative;border:none;border-radius:16px;padding:15px 14px;text-align:center;
    cursor:pointer;background:var(--sunk);box-shadow:inset 0 0 0 2px transparent;
    transition:background .14s,box-shadow .14s;}
  .ob-bloc:hover{background:var(--btn-soft-2);}
  .ob-bloc.is-on{background:var(--leaf);box-shadow:inset 0 0 0 2px var(--leaf-ink);}
  .ob-bloc-l{font-family:var(--sans);font-weight:800;font-size:15px;color:var(--ink);}
  .ob-bloc-d{font-family:var(--sans);font-size:12.5px;color:var(--ink-3);margin-top:2px;line-height:1.4;}
  .ob-bloc.is-on .ob-bloc-d{color:var(--leaf-ink);opacity:.72;}

  /* Marque une réponse devinée par l'analyse plutôt que saisie. */
  .ob-auto{margin-left:7px;font-family:var(--sans);font-size:11px;font-weight:800;
    color:var(--mint-2);letter-spacing:0;}
  .ob-chip.is-on .ob-auto,.ob-bloc.is-on .ob-auto{color:var(--leaf-ink);opacity:.62;}

  .ob-saisie{position:relative;background:var(--sunk);border-radius:18px;padding:15px 16px;margin-bottom:9px;}
  .ob-saisie .ob-auto{position:absolute;top:15px;right:17px;margin:0;}
  .ob-saisie-l{display:block;font-family:var(--sans);font-size:12.5px;font-weight:700;
    color:var(--ink-3);margin-bottom:8px;}
  .ob-in{width:100%;box-sizing:border-box;min-height:48px;padding:12px 15px;border-radius:12px;
    border:none;background:#fff;color:var(--ink);outline:none;text-align:center;
    font-family:var(--sans);font-size:15.5px;font-weight:600;
    box-shadow:inset 0 0 0 1.5px transparent;transition:box-shadow .16s;}
  .ob-in:focus{box-shadow:inset 0 0 0 1.5px rgba(30,51,23,.5);}
  .ob-ta{text-align:left;line-height:1.55;resize:vertical;font-weight:500;}

  .ob-pied{display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;
    margin-top:clamp(20px,3.6vh,30px);}
  .ob-retour{background:none;border:none;padding:8px 6px;cursor:pointer;font-family:var(--sans);
    font-size:14px;font-weight:700;color:var(--ink-3);order:1;}
  .ob-retour:hover{color:var(--ink);}
  .ob-retour:disabled{display:none;}
  .ob-suite{order:2;min-height:54px;padding:0 30px;border:none;border-radius:999px;cursor:pointer;
    background:var(--leaf);color:var(--leaf-ink);font-family:var(--sans);font-weight:800;font-size:16px;
    transition:transform .14s,background .16s;}
  .ob-suite:hover:not(:disabled){background:var(--leaf-soft);}
  .ob-suite:active{transform:scale(.985);}
  .ob-suite:disabled{opacity:.4;cursor:not-allowed;}

  /* Modale : même page blanche, posée par-dessus. */
  .ob-mod-bg{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
    padding:20px;background:rgba(20,22,15,.42);animation:obFond .16s ease-out;}
  .ob-mod{width:100%;max-width:440px;background:#fff;border-radius:26px;padding:clamp(22px,6vw,30px);
    text-align:center;box-shadow:0 30px 70px -24px rgba(13,15,10,.4);
    animation:obMonte .2s cubic-bezier(.16,1,.3,1);max-height:88dvh;overflow-y:auto;}
  @keyframes obFond{from{opacity:0}to{opacity:1}}
  @keyframes obMonte{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  .ob-mod-h{font-family:var(--display);font-weight:900;text-transform:uppercase;letter-spacing:-.028em;
    line-height:1;color:var(--leaf-ink);font-size:clamp(21px,5.6vw,27px);margin:0 0 11px;}
  .ob-mod-p{font-family:var(--sans);font-size:15px;line-height:1.55;color:var(--ink-2);margin:0 auto 22px;max-width:32ch;}

  /* Focus clavier : un trait fin à l'extérieur, jamais l'anneau par défaut du
     navigateur. Visible pour qui navigue au clavier, invisible à la souris,
     puisque focus-visible ne se déclenche pas au clic. */
  .ob *:focus-visible{outline:1.5px solid rgba(30,51,23,.55);outline-offset:3px;}
  .ob .ob-input:focus-visible,.ob .ob-in:focus-visible{outline:none;}

  /* ── Tablette et plus : la colonne respire, rien ne change de nature. ──── */
  @media(min-width:640px){
    .ob-corps{max-width:var(--ob-w,470px);}
    .ob-h1{font-size:clamp(34px,3.9vw,42px);}
  }
  /* ══ MOBILE ═════════════════════════════════════════════════════════════
     Pas un desktop rétréci. Trois décisions propres au téléphone :

     1. LE CONTENU MONTE. Centrer verticalement sur un écran haut et étroit
        laisse deux grandes bandes vides et donne une page qui n'a pas
        commencé. Le titre se cale donc en haut, juste sous le logo.
     2. L'ACTION DESCEND. Elle se colle au bas de l'écran, là où le pouce
        tombe, et respecte la barre d'accueil de l'iPhone (safe-area).
     3. LE TITRE GROSSIT. 10 vw plutôt que 7 : sur 375 px il passe de 28 à
        38 px. C'est lui qui doit porter l'écran, pas le remplir à moitié.
     ═════════════════════════════════════════════════════════════════════ */
  @media(max-width:639px){
    .ob{padding:clamp(62px,11vh,84px) 20px 18px;}
    .ob-h1{font-size:clamp(32px,10vw,44px);}
    .ob-sub{font-size:16px;max-width:30ch;}

    /* Écrans qui ont une zone d'action : contenu en haut, action en bas. */
    .ob-adeux{grid-template-rows:1fr auto;align-content:stretch;place-items:stretch;}
    /* Pas de overflow ici : il découpait net les ombres portées qui dépassent
       du conteneur, d'où le trait horizontal sous les stickers. Le contenu de
       ces écrans tient, et si un jour il déborde c'est la PAGE qui défile. */
    .ob-adeux .ob-corps{align-self:start;padding-top:clamp(10px,4vh,42px);
      margin-inline:auto;}
    .ob-adeux .ob-bas{align-self:end;width:100%;max-width:var(--ob-w,440px);
      margin-inline:auto;padding-bottom:env(safe-area-inset-bottom,0px);}
    /* Les boutons se détachent du blanc quand ils sont posés tout en bas. */
    .ob-adeux .ob-bas .ob-btn{box-shadow:0 6px 20px -10px rgba(13,15,10,.45);}

    .ob-visuel{display:flex;align-items:center;justify-content:center;gap:22px;
      margin:clamp(22px,5vh,48px) 0 0;}

    .ob-blocs{grid-template-columns:1fr;}
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
   *  l'écran, sous le pouce ; sur grand écran elle suit le contenu comme un
   *  bloc ordinaire. C'est la seule différence de structure entre les deux, et
   *  c'est celle qui change tout : un bouton au milieu d'une page mobile se
   *  cherche, un bouton en bas se presse. */
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
