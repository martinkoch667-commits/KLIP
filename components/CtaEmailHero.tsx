'use client';

/* Le CTA du hero de la landing : on demande l'E-MAIL pour commencer.
 *
 * Historique (Martin, 2026-09-14). D'abord « Essayer gratuitement », puis une
 * barre « votre site web » qui lançait l'analyse. Les gens demandaient
 * pourquoi il fallait un site pour essayer : on commence donc par l'adresse
 * e-mail, et le site n'est demandé qu'une fois le compte ouvert, dans le
 * parcours d'essai (`/onboarding/site`).
 *
 * « Commencer » ouvre la fenêtre d'inscription de la landing avec l'adresse
 * déjà remplie : il ne reste que le mot de passe, ou Google. Déjà connecté,
 * on file au parcours.
 *
 * FORME : la « Barre » violette retenue parmi quatre formes, compacte sur
 * mobile. Le bouton n'a PAS la classe `.btn` de la landing : GSAP rend ces
 * boutons magnétiques, et un bouton qui suit la souris se décolle de sa gélule.
 */

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ouvrirCompte } from '@/components/InscriptionOverlay';

/** Où reprend le parcours une fois le compte ouvert. */
const SUITE = '/onboarding/site';

function Fleche() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}
function Enveloppe() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" />
    </svg>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  .v3 .cs-go{display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:none;height:46px;padding:0 22px;
    border-radius:999px;white-space:nowrap;font-family:var(--sans);font-weight:800;font-size:15px;letter-spacing:-.01em;color:#fff;
    background:linear-gradient(180deg,#7B6CF0 0%,#5A4AD1 100%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 16px 32px -16px rgba(90,74,209,.7);transition:transform .12s;}
  .v3 .cs-go:hover{background:linear-gradient(180deg,#8778F5 0%,#6353DA 100%);}
  .v3 .cs-go:active{transform:scale(.97);}
  .v3 .cs-go:disabled{opacity:.7;cursor:progress;}
  .v3 .cs-go .cs-arr{display:inline-flex;transition:transform .22s;}
  .v3 .cs-go:hover .cs-arr{transform:translate(2px,-2px);}

  /* L'aide sous le champ, posée en absolu : elle ne décale rien. */
  .cs-aide{position:absolute;left:0;right:0;top:calc(100% + 12px);margin:0;text-align:center;font-family:var(--sans);
    font-size:13.5px;font-weight:600;color:#F5C2B5;}

  /* « Voir KLIP en action » à la même hauteur que la gélule. */
  .v3 .hero-cta .btn-ghost{padding:17px 24px;font-size:15px;}

  @media(max-width:640px){
    .cs{width:100%;height:46px;padding:4px 4px 4px 14px;gap:8px;}
    .cs-ic svg{width:16px;height:16px;}
    .v3 .cs-go{height:38px;padding:0 16px;font-size:14px;gap:6px;}
    .cs-aide{font-size:12.5px;}
  }
  @media(max-width:560px){
    .v3 .hero-cta{align-items:center !important;}
    .v3 .hero-cta .cs{align-self:stretch;}
    .v3 .hero-cta .btn-ghost{width:auto;padding:10px 18px;font-size:14px;}
  }
`;

export default function CtaEmailHero() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [aide, setAide] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  async function valider(e: { preventDefault(): void }) {
    e.preventDefault();
    const adresse = email.trim();
    if (!EMAIL.test(adresse)) {
      setAide(true);
      champ.current?.focus({ preventScroll: true });
      return;
    }
    setEnvoi(true);
    const { data } = await createClientComponentClient().auth.getSession();
    setEnvoi(false);
    if (data.session) router.push(SUITE);
    else ouvrirCompte('inscription', undefined, SUITE, adresse);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <form className="cs" onSubmit={e => void valider(e)} noValidate>
        <span className="cs-ic"><Enveloppe /></span>
        <input
          ref={champ}
          value={email}
          onChange={e => { setEmail(e.target.value); setAide(false); }}
          /* Entrée validée à la main : l'envoi implicite du formulaire ne part
             pas avec tous les claviers. */
          onKeyDown={e => { if (e.key === 'Enter') void valider(e); }}
          type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder="votre@email.com" aria-label="Votre adresse e-mail"
        />
        <button type="submit" className="cs-go" disabled={envoi}>
          Commencer <span className="cs-arr"><Fleche /></span>
        </button>
        {aide && <p className="cs-aide" role="alert">Entrez une adresse e-mail valide, par exemple vous@agence.com.</p>}
      </form>
    </>
  );
}
