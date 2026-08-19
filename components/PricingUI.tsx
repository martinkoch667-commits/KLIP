"use client";

/* Vocabulaire visuel des écrans d'offre, repris tel quel de la section Tarifs de
   la landing v3 (`app/landing-v3.tsx`), pour que la page vue avant l'inscription
   et celle vue juste après soient le même produit.

   Les règles qui font la DA, et qu'il ne faut pas « améliorer » à la légère :
   - fond clair, PAS de fond sombre plein écran. Le forest est réservé à la carte
     mise en avant, ce qui est précisément ce qui la met en avant.
   - un seul vert, le leaf pastel. Le mint reste un micro-accent (les coches).
   - le mot accent du titre est en oaks surligné leaf, jamais en couleur.
   - les prix sont en Archivo lourd et gros, c'est l'information que la personne
     est venue chercher. */

import type { CSSProperties, ReactNode } from "react";
import { useLocale } from "next-intl";
import { formatPrice } from "@/lib/launch-offer";

export const PRICING_CSS = `
  .kp *,.kp *::before,.kp *::after{box-sizing:border-box;}
  .kp{
    --kp-paper:#FFFFFF; --kp-paper-3:#F1F0E9;
    --kp-forest:#072117; --kp-forest-2:#0C3123;
    --kp-ink:#10130B; --kp-ink-2:#50544A; --kp-ink-3:#8A8D7D;
    --kp-line:rgba(16,19,11,.14); --kp-line-2:rgba(16,19,11,.08);
    --kp-cream:#F1F0E5; --kp-cream-2:rgba(241,240,229,.66); --kp-cream-3:rgba(241,240,229,.36);
    --kp-leaf:#BDF2A0; --kp-leaf-soft:#D9F8C7; --kp-leaf-ink:#1E3317; --kp-mint-2:#1FA878; --kp-vio:#6656D9;
    --kp-heavy:'Archivo',system-ui,sans-serif;
    --kp-oaks:'oaks',Georgia,serif;
    --kp-oaksx:'oaks-expanded',Georgia,serif;
    --kp-sans:'early-sans-variable','Hanken Grotesk',system-ui,sans-serif;
    min-height:100vh;
    background:
      radial-gradient(120% 80% at 50% -20%, rgba(189,242,160,.20), transparent 60%),
      #FAF9F4;
    font-family:var(--kp-sans);
    color:var(--kp-ink);
    display:flex;flex-direction:column;align-items:center;
    padding:clamp(34px,6vw,66px) 22px 64px;
  }

  .kp-logo{display:block;height:34px;width:auto;margin:0 0 26px;}
  .kp-eyebrow{font-family:var(--kp-sans);font-weight:800;font-size:12px;letter-spacing:.16em;
    text-transform:uppercase;color:var(--kp-ink-3);text-align:center;margin:0 0 16px;}
  .kp-title{font-family:var(--kp-heavy);font-weight:800;text-transform:uppercase;letter-spacing:-.03em;
    line-height:.98;font-size:clamp(38px,5.6vw,72px);text-align:center;margin:0;text-wrap:balance;}
  /* Le mot accent : oaks surligné leaf. Règle typo commune à toute la marque. */
  .kp-acc{font-family:var(--kp-oaks);font-weight:700;text-transform:none;letter-spacing:-.01em;
    background:var(--kp-leaf);color:var(--kp-leaf-ink);border-radius:14px;padding:.02em .18em .09em;
    box-decoration-break:clone;-webkit-box-decoration-break:clone;}
  .kp-lead{color:var(--kp-ink-2);font-size:19px;line-height:1.62;text-align:center;
    max-width:560px;margin:22px auto 0;text-wrap:pretty;}

  .kp-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;align-items:start;
    width:100%;max-width:840px;margin:clamp(34px,5vw,54px) 0 0;}
  @media(max-width:760px){.kp-grid{grid-template-columns:1fr;gap:34px;}}

  .kp-card{position:relative;border-radius:13px;padding:34px 32px;display:flex;flex-direction:column;
    background:var(--kp-paper);color:var(--kp-ink);border:1px solid var(--kp-line);
    box-shadow:0 20px 44px -30px rgba(16,19,11,.2);}
  /* La carte mise en avant est la seule surface sombre de l'écran, et elle est
     remontée de quelques pixels : c'est ce décalage qui fait l'accroche. */
  .kp-card.pop{background:var(--kp-forest);color:var(--kp-cream);border:none;
    box-shadow:0 40px 80px -40px rgba(7,33,23,.7);transform:translateY(-14px) rotate(.8deg);}
  @media(max-width:760px){.kp-card.pop{transform:none;}}

  /* Le cadre de sélection de la landing : la carte est posée là comme un objet
     dans l'éditeur, poignées comprises. C'est la métaphore de tout le site, et
     c'est ce qui manquait ici pour que les deux écrans se ressemblent. */
  .kp-sel{position:absolute;inset:-10px;border:2px solid var(--kp-vio);border-radius:4px;pointer-events:none;}
  .kp-sel i{position:absolute;background:#fff;border:2px solid var(--kp-vio);
    box-shadow:0 2px 6px rgba(16,19,11,.18);}
  .kp-sel i.h{width:13px;height:13px;border-radius:50%;}
  .kp-sel i.p{border-radius:999px;}
  @media(max-width:760px){.kp-sel{inset:-7px;}}

  .kp-flag{position:absolute;top:-15px;right:20px;rotate:3deg;z-index:3;
    display:inline-flex;align-items:center;gap:7px;padding:8px 13px;border-radius:14px;
    background:var(--kp-leaf);color:var(--kp-leaf-ink);
    font-family:var(--kp-sans);font-weight:800;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;
    box-shadow:0 18px 36px -18px rgba(16,19,11,.35);}

  .kp-name{font-family:var(--kp-oaksx);font-weight:700;text-transform:uppercase;letter-spacing:.015em;
    line-height:.95;font-size:24px;margin:0;}
  .kp-tag{font-weight:600;font-size:13px;color:var(--kp-ink-3);margin-top:6px;}
  .kp-card.pop .kp-tag{color:var(--kp-cream-3);}

  /* Offre de lancement : pastille leaf puis prix barré à côté du prix remisé.
     Même présentation que la landing, sinon le client voit une remise avant de
     s'inscrire et plus rien à l'écran de paiement, alors que la caisse
     l'applique quand même. */
  .kp-badge{display:inline-flex;align-items:center;align-self:flex-start;gap:7px;margin-top:20px;
    padding:6px 11px;border-radius:999px;background:var(--kp-leaf-soft);color:var(--kp-leaf-ink);
    font-family:var(--kp-sans);font-weight:800;font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;}
  .kp-card.pop .kp-badge{background:var(--kp-leaf);}
  .kp-price s{font-family:var(--kp-heavy);font-weight:800;font-size:30px;letter-spacing:-.03em;line-height:1;
    color:var(--kp-ink-3);text-decoration:line-through;text-decoration-thickness:2px;}
  .kp-card.pop .kp-price s{color:var(--kp-cream-3);}
  .kp-price{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:22px 0 2px;}
  .kp-price b{font-family:var(--kp-heavy);font-weight:800;font-size:58px;letter-spacing:-.04em;line-height:1;}
  .kp-price span{font-weight:700;font-size:13px;color:var(--kp-ink-3);}
  .kp-card.pop .kp-price span{color:var(--kp-cream-2);}
  .kp-note{font-size:12px;color:var(--kp-ink-3);margin-bottom:18px;min-height:16px;}
  .kp-card.pop .kp-note{color:var(--kp-cream-3);}

  .kp-chip{display:inline-flex;align-items:center;align-self:flex-start;gap:8px;padding:8px 14px;border-radius:999px;
    font-weight:700;font-size:12.5px;letter-spacing:.02em;margin-bottom:22px;
    background:var(--kp-paper-3);color:var(--kp-ink-2);box-shadow:inset 0 0 0 1px var(--kp-line);}
  .kp-card.pop .kp-chip{background:var(--kp-forest-2);color:var(--kp-cream-2);box-shadow:inset 0 0 0 1px rgba(241,240,229,.16);}

  .kp-btn{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:9px;
    font-family:var(--kp-sans);font-weight:800;font-size:16px;letter-spacing:-.01em;
    padding:16px 27px;border-radius:999px;border:none;cursor:pointer;white-space:nowrap;
    transition:background .2s,box-shadow .2s,color .2s;}
  .kp-btn-leaf{background:var(--kp-leaf);color:var(--kp-leaf-ink);box-shadow:0 16px 32px -16px rgba(120,190,90,.55);}
  .kp-btn-leaf:hover:not(:disabled){background:#C9F5B2;}
  .kp-btn-ghost{background:transparent;color:var(--kp-ink);box-shadow:inset 0 0 0 1.6px var(--kp-line);}
  .kp-btn-ghost:hover:not(:disabled){box-shadow:inset 0 0 0 2px var(--kp-ink);}
  .kp-card.pop .kp-btn-ghost{color:var(--kp-cream);box-shadow:inset 0 0 0 1.6px rgba(241,240,229,.28);}
  .kp-btn:disabled{opacity:.5;cursor:not-allowed;}

  .kp-feats{list-style:none;display:flex;flex-direction:column;gap:12px;padding:0;margin:24px 0 0;}
  .kp-feat{display:flex;gap:11px;align-items:flex-start;font-size:15px;color:var(--kp-ink-2);}
  .kp-card.pop .kp-feat{color:var(--kp-cream-2);}
  .kp-feat svg{flex:none;margin-top:2px;color:var(--kp-mint-2);}
  .kp-card.pop .kp-feat svg{color:var(--kp-leaf);}

  .kp-label{display:block;font-family:var(--kp-sans);font-size:11px;font-weight:800;text-transform:uppercase;
    letter-spacing:.1em;color:var(--kp-cream-3);margin:0 0 7px;}
  .kp-input{width:100%;border:1.5px solid rgba(241,240,229,.24);border-radius:12px;padding:12px 15px;
    font-family:var(--kp-sans);font-size:15px;color:var(--kp-cream);background:rgba(241,240,229,.07);
    outline:none;transition:border-color .15s,background .15s;margin-bottom:12px;}
  .kp-input::placeholder{color:rgba(241,240,229,.32);}
  .kp-input:focus{border-color:var(--kp-leaf);background:rgba(189,242,160,.08);}

  .kp-foot{margin-top:26px;text-align:center;font-size:13px;color:var(--kp-ink-3);line-height:1.6;max-width:520px;}
  .kp-err{margin-top:22px;font-size:14px;font-weight:700;color:#B4402A;text-align:center;}
  .kp-quiet{margin-top:22px;font-size:13.5px;color:var(--kp-ink-3);text-decoration:underline;
    text-underline-offset:3px;background:none;border:none;cursor:pointer;}

  @media(max-width:760px){
    .kp-card{padding:26px 22px;}
    .kp-price b{font-size:46px;}
    .kp-btn{min-height:50px;}
  }
`;

export function CheckIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Cadre de sélection violet avec ses huit poignées, repris de `Sel` sur la
    landing. Purement décoratif, donc invisible aux lecteurs d'écran. */
function SelectionFrame() {
  return (
    <span className="kp-sel" aria-hidden="true">
      <i className="h" style={{ top: -7, left: -7 }} />
      <i className="h" style={{ top: -7, right: -7 }} />
      <i className="h" style={{ bottom: -7, left: -7 }} />
      <i className="h" style={{ bottom: -7, right: -7 }} />
      <i className="p" style={{ top: -5, left: "50%", transform: "translateX(-50%)", width: 22, height: 9 }} />
      <i className="p" style={{ bottom: -5, left: "50%", transform: "translateX(-50%)", width: 22, height: 9 }} />
      <i className="p" style={{ left: -5, top: "50%", transform: "translateY(-50%)", width: 9, height: 22 }} />
      <i className="p" style={{ right: -5, top: "50%", transform: "translateY(-50%)", width: 9, height: 22 }} />
    </span>
  );
}

export function PlanCard({
  name, tag, price, strikePrice, badge, perMonth, note, chip, features, popular, flag, children, style,
}: {
  name: string;
  tag: string;
  price: number;
  /** Prix plein, barré à côté du prix remisé. Absent = pas de remise en cours. */
  strikePrice?: number;
  /** Pastille de l'offre de lancement, au dessus du prix. */
  badge?: string;
  perMonth: string;
  note?: string;
  chip?: string;
  features: string[];
  popular?: boolean;
  /** Étiquette penchée posée sur le coin de la carte mise en avant. */
  flag?: string;
  /** Bouton, et tout ce qui l'accompagne (le champ « nom de l'agence »). */
  children: ReactNode;
  style?: CSSProperties;
}) {
  const locale = useLocale();
  return (
    <div className={`kp-card${popular ? " pop" : ""}`} style={style}>
      {popular && <SelectionFrame />}
      {popular && flag && <span className="kp-flag">{flag}</span>}
      <h2 className="kp-name">{name}</h2>
      <div className="kp-tag">{tag}</div>
      {badge && <div className="kp-badge">{badge}</div>}
      <div className="kp-price" style={badge ? { marginTop: 10 } : undefined}>
        {strikePrice !== undefined && <s>{formatPrice(strikePrice, locale)}€</s>}
        <b>{formatPrice(price, locale)}€</b>
        <span>{perMonth}</span>
      </div>
      <div className="kp-note">{note}</div>
      {chip && <div className="kp-chip">{chip}</div>}
      {children}
      <ul className="kp-feats">
        {features.map(f => (
          <li key={f} className="kp-feat"><CheckIcon /><span>{f}</span></li>
        ))}
      </ul>
    </div>
  );
}
