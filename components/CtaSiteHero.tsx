'use client';

/* Le CTA du hero de la landing : on demande le SITE au lieu d'« Essayer
 * gratuitement » (Martin, 2026-09-14). L'adresse part vers le parcours d'essai,
 * qui lance l'analyse tout de suite (`/onboarding/site?site=…`) : la personne
 * voit ses couleurs et ses polices tout de suite.
 *
 * LE COMPTE D'ABORD (Martin, 2026-09-14) : sans session, « Analyser » ouvre la
 * fenêtre d'inscription de la landing (e-mail ou Google), qui renvoie ensuite
 * sur l'analyse. Déjà connecté, on y va directement.
 *
 * FORME RETENUE : la « Barre » en VIOLET, parmi quatre formes (Barre, Calque,
 * Navigateur, Curseur) déclinées en vert et en violet. Une seule gélule, le
 * champ et le bouton dedans. Martin l'a ensuite voulue plus petite, surtout
 * sur mobile, où elle prenait trop de place avec « Voir KLIP en action ».
 *
 * Le bouton n'a PAS la classe `.btn` de la landing : GSAP rend ces boutons
 * magnétiques, et un bouton qui suit la souris dans un champ se décolle de
 * sa gélule.
 */

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ouvrirCompte } from '@/components/InscriptionOverlay';

function Fleche() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}
function Globe() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3Z" />
    </svg>
  );
}

/** « https://www.Smashy-Burger.fr/ » → « www.smashy-burger.fr ». */
function nettoyer(v: string) {
  return v.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
}
const ADRESSE = /^[^\s./]+(\.[^\s./]+)+(\/\S*)?$/;

const CSS = `
  .cs{position:relative;display:flex;align-items:center;gap:10px;width:min(100%,500px);height:58px;padding:6px 6px 6px 20px;
    border-radius:999px;background:rgba(241,240,229,.06);
    box-shadow:inset 0 0 0 1.5px var(--line-f),0 24px 44px -26px rgba(0,0,0,.7);transition:box-shadow .2s;}
  .cs:focus-within{box-shadow:inset 0 0 0 2px #8C7DFF,0 0 0 5px rgba(140,125,255,.24),0 24px 44px -26px rgba(0,0,0,.7);}
  .cs-ic{display:inline-flex;color:var(--cream-3);}
  /* 16 px minimum : en dessous, l'iPhone zoome dans la page à la saisie. */
  .cs input{flex:1;min-width:0;height:100%;border:none;outline:none;background:none;
    font-family:var(--sans);font-size:16px;font-weight:650;color:var(--cream);}
  .cs input::placeholder{color:var(--cream-3);font-weight:500;}
  .v3 .cs-go{display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:none;height:46px;padding:0 20px;
    border-radius:999px;white-space:nowrap;font-family:var(--sans);font-weight:800;font-size:15px;letter-spacing:-.01em;color:#fff;
    background:linear-gradient(180deg,#7B6CF0 0%,#5A4AD1 100%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 16px 32px -16px rgba(90,74,209,.7);transition:transform .12s;}
  .v3 .cs-go:hover{background:linear-gradient(180deg,#8778F5 0%,#6353DA 100%);}
  .v3 .cs-go:active{transform:scale(.97);}
  .v3 .cs-go .cs-arr{display:inline-flex;transition:transform .22s;}
  .v3 .cs-go:hover .cs-arr{transform:translate(2px,-2px);}
  .cs-court{display:none;}

  /* L'aide sous le champ, posée en absolu : elle ne décale rien. */
  .cs-aide{position:absolute;left:0;right:0;top:calc(100% + 12px);margin:0;text-align:center;font-family:var(--sans);
    font-size:13.5px;font-weight:600;color:#F5C2B5;white-space:nowrap;}
  .v3 .cs-aide a{color:var(--cream);text-decoration:underline;text-underline-offset:3px;}

  /* « Voir KLIP en action » à la même hauteur que la gélule. */
  .v3 .hero-cta .btn-ghost{padding:17px 24px;font-size:15px;}

  /* Mobile : environ 30 % plus bas qu'avant, et « Voir KLIP en action » ne
     prend plus toute la largeur. */
  @media(max-width:640px){
    .cs-long{display:none;} .cs-court{display:inline;}
    .cs{width:100%;height:46px;padding:4px 4px 4px 14px;gap:8px;}
    .cs-ic svg{width:16px;height:16px;}
    .v3 .cs-go{height:38px;padding:0 15px;font-size:14px;gap:6px;}
    .cs-aide{white-space:normal;font-size:12.5px;}
  }
  @media(max-width:560px){
    .v3 .hero-cta{align-items:center !important;}
    .v3 .hero-cta .cs{align-self:stretch;}
    .v3 .hero-cta .btn-ghost{width:auto;padding:10px 18px;font-size:14px;}
  }
`;

export default function CtaSiteHero() {
  const router = useRouter();
  const [site, setSite] = useState('');
  const [aide, setAide] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  async function valider(e: { preventDefault(): void }) {
    e.preventDefault();
    const adresse = nettoyer(site);
    if (!ADRESSE.test(adresse)) {
      setAide(true);
      champ.current?.focus({ preventScroll: true });
      return;
    }
    const suite = `/onboarding/site?site=${encodeURIComponent(adresse)}`;
    const { data } = await createClientComponentClient().auth.getSession();
    if (data.session) router.push(suite);
    else ouvrirCompte('inscription', undefined, suite);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <form className="cs" onSubmit={e => void valider(e)} noValidate>
        <span className="cs-ic"><Globe /></span>
        <input
          ref={champ}
          value={site}
          onChange={e => { setSite(e.target.value); setAide(false); }}
          /* Entrée validée à la main, comme sur l'écran du site : l'envoi
             implicite du formulaire ne part pas avec tous les claviers. */
          onKeyDown={e => { if (e.key === 'Enter') void valider(e); }}
          type="text" inputMode="url" autoComplete="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder="votre-site.fr" aria-label="Adresse de votre site web"
        />
        <button type="submit" className="cs-go">
          <span className="cs-long">Analyser mon site</span><span className="cs-court">Analyser</span>
          <span className="cs-arr"><Fleche /></span>
        </button>
        {aide && (
          <p className="cs-aide" role="alert">
            Entrez une adresse, par exemple smashy-burger.fr. Pas de site ? <a href="/onboarding/connexion">Commencer sans</a>
          </p>
        )}
      </form>
    </>
  );
}
