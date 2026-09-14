'use client';

/* Le CTA du hero de la landing : on demande le SITE au lieu d'« Essayer
 * gratuitement » (Martin, 2026-09-14). L'adresse part vers le parcours d'essai,
 * qui lance l'analyse tout de suite (`/onboarding/site?site=…`) : la personne
 * voit ses couleurs et ses polices avant d'avoir créé quoi que ce soit.
 *
 * QUATRE PROPOSITIONS à départager, comme pour les cases du parcours :
 *  · Barre       une seule gélule, champ et bouton dedans ;
 *  · Calque      le champ est un calque sélectionné (cadre et poignées de la
 *                sélection du hero), avec son étiquette « Votre site web » ;
 *  · Navigateur  une barre d'adresse, qui annonce la fenêtre du parcours ;
 *  · Bouton      le bouton vert d'aujourd'hui, qui s'ouvre en champ au clic.
 * Le sélecteur n'apparaît pas sur getklip.fr. Choix gardé dans l'onglet
 * (sessionStorage) et forçable par `?cta=`.
 *
 * Les boutons n'ont PAS la classe `.btn` de la landing : GSAP rend ces
 * boutons magnétiques, et un bouton qui suit la souris dans un champ se
 * décolle de son cadre.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type VarianteCta = 'barre' | 'calque' | 'navigateur' | 'bouton';

const VARIANTES: { id: VarianteCta; nom: string }[] = [
  { id: 'barre', nom: 'Barre' },
  { id: 'calque', nom: 'Calque' },
  { id: 'navigateur', nom: 'Navigateur' },
  { id: 'bouton', nom: 'Bouton' },
];
const CLE = 'klip_cta_hero';

function Fleche({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}
function Globe() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3Z" />
    </svg>
  );
}
function Cadenas() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

/** « https://www.Smashy-Burger.fr/ » → « www.smashy-burger.fr ». */
function nettoyer(v: string) {
  return v.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
}
const ADRESSE = /^[^\s./]+(\.[^\s./]+)+(\/\S*)?$/;

const CSS = `
  .cs{position:relative;}
  .cs input{font-family:var(--sans);font-size:16px;font-weight:650;border:none;outline:none;background:none;min-width:0;}
  /* Bouton vert maison, sans .btn (voir l'en-tête). */
  .v3 .cs-go{display:inline-flex;align-items:center;justify-content:center;gap:9px;flex:none;white-space:nowrap;
    font-family:var(--sans);font-weight:800;font-size:15.5px;letter-spacing:-.01em;color:var(--leaf-ink);background:var(--leaf);
    border-radius:999px;box-shadow:0 16px 32px -16px rgba(120,190,90,.55);transition:background .2s,transform .12s;}
  .v3 .cs-go:hover{background:#C9F5B2;}
  .v3 .cs-go:active{transform:scale(.97);}
  .v3 .cs-go .cs-arr{display:inline-flex;transition:transform .22s;}
  .v3 .cs-go:hover .cs-arr{transform:translate(2px,-2px);}
  .cs-court{display:none;}

  /* L'aide sous le champ, posée en absolu : elle ne décale rien. */
  .cs-aide{position:absolute;left:0;right:0;top:calc(100% + 12px);margin:0;text-align:center;font-family:var(--sans);
    font-size:13.5px;font-weight:600;color:#F5C2B5;white-space:nowrap;}
  .v3 .cs-aide a{color:var(--cream);text-decoration:underline;text-underline-offset:3px;}

  /* ── Barre ── */
  .cs-barre{display:flex;align-items:center;gap:10px;width:min(100%,540px);height:66px;padding:7px 7px 7px 20px;border-radius:999px;
    background:rgba(241,240,229,.06);box-shadow:inset 0 0 0 1.5px var(--line-f),0 24px 44px -26px rgba(0,0,0,.7);transition:box-shadow .2s;}
  .cs-barre:focus-within{box-shadow:inset 0 0 0 2px var(--leaf),0 0 0 5px rgba(189,242,160,.14),0 24px 44px -26px rgba(0,0,0,.7);}
  .cs-barre .cs-ic{display:inline-flex;color:var(--cream-3);}
  .cs-barre input{flex:1;height:100%;color:var(--cream);}
  .cs-barre input::placeholder{color:var(--cream-3);font-weight:500;}
  .v3 .cs-barre .cs-go{height:52px;padding:0 22px;}

  /* ── Calque ── */
  .cs-calque{display:flex;align-items:center;gap:30px;margin-top:22px;}
  .cs-calque .sel{display:block;}
  .cs-calque-champ{display:flex;align-items:center;gap:10px;width:min(64vw,350px);height:62px;padding:0 20px;border-radius:14px;
    background:#fff;box-shadow:0 26px 50px -24px rgba(0,0,0,.65);}
  .cs-calque-champ .cs-ic{display:inline-flex;color:var(--ink-3);}
  .cs-calque-champ input{flex:1;height:100%;color:var(--ink);font-size:17px;}
  .cs-calque-champ input::placeholder{color:#A3A69B;font-weight:500;}
  /* L'étiquette du calque, comme le nom d'un élément dans Figma. */
  .cs-tag{position:absolute;left:-10px;bottom:calc(100% + 16px);padding:3px 9px;border-radius:6px;background:var(--vio);color:#fff;
    font-family:var(--sans);font-size:12px;font-weight:800;letter-spacing:.01em;white-space:nowrap;}
  .v3 .cs-calque .cs-go{height:60px;padding:0 26px;font-size:16px;}

  /* ── Navigateur ── */
  .cs-nav{display:flex;align-items:center;gap:8px;width:min(100%,580px);padding:8px;border-radius:18px;background:#fff;
    box-shadow:0 30px 60px -28px rgba(0,0,0,.75);}
  .cs-nav-points{display:flex;gap:6px;padding:0 8px 0 8px;}
  .cs-nav-points i{width:11px;height:11px;border-radius:50%;}
  .cs-nav-url{flex:1;display:flex;align-items:center;gap:6px;height:50px;padding:0 14px;border-radius:12px;background:#F3F4F6;color:#8A8D7D;
    min-width:0;box-shadow:inset 0 0 0 1.5px transparent;transition:box-shadow .2s,background .2s;}
  .cs-nav-url:focus-within{background:#fff;box-shadow:inset 0 0 0 2px var(--mint-2);}
  .cs-nav-proto{font-family:var(--sans);font-size:16px;font-weight:500;color:#A3A69B;}
  .cs-nav-url input{flex:1;height:100%;color:var(--ink);}
  .cs-nav-url input::placeholder{color:#A3A69B;font-weight:500;}
  .v3 .cs-nav .cs-go{height:50px;padding:0 20px;border-radius:12px;box-shadow:none;}

  /* ── Bouton qui s'ouvre ── */
  .cs-bouton{display:flex;align-items:center;justify-content:flex-end;height:60px;width:252px;border-radius:999px;
    transition:width .5s cubic-bezier(.2,.9,.25,1),background .3s,box-shadow .3s,padding .5s;}
  .cs-bouton input{width:0;flex:0 1 0;opacity:0;height:100%;color:var(--cream);transition:opacity .25s;}
  .cs-bouton input::placeholder{color:var(--cream-3);font-weight:500;}
  .v3 .cs-bouton .cs-go{height:60px;padding:0 27px;font-size:16px;width:100%;transition:width .5s cubic-bezier(.2,.9,.25,1),height .3s,background .2s;}
  .cs-bouton.is-ouvert{width:min(100%,520px);padding:6px 6px 6px 22px;background:rgba(241,240,229,.06);
    box-shadow:inset 0 0 0 2px var(--leaf),0 0 0 5px rgba(189,242,160,.12);}
  .cs-bouton.is-ouvert input{flex:1;opacity:1;transition:opacity .3s .2s;}
  .v3 .cs-bouton.is-ouvert .cs-go{width:auto;height:48px;padding:0 20px;font-size:15.5px;}

  /* ── Sélecteur de propositions (hors getklip.fr) ── */
  .cs-choix{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:1500;display:flex;align-items:center;gap:4px;
    padding:5px;border-radius:999px;background:#10130B;box-shadow:0 0 0 1px rgba(255,255,255,.12),0 18px 40px -12px rgba(0,0,0,.6);
    font-family:var(--sans);}
  .cs-choix span{padding:0 10px 0 12px;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:rgba(241,240,229,.5);}
  .v3 .cs-choix button{height:32px;padding:0 13px;border-radius:999px;font-size:13px;font-weight:700;color:rgba(241,240,229,.8);}
  .v3 .cs-choix button.is-on{background:var(--leaf);color:var(--leaf-ink);}

  @media(max-width:640px){
    .cs-long{display:none;} .cs-court{display:inline;}
    .cs-barre{width:100%;height:60px;padding-left:16px;}
    .v3 .cs-barre .cs-go{height:46px;padding:0 18px;}
    .cs-calque{flex-direction:column;align-items:stretch;gap:26px;margin-top:30px;}
    .cs-calque-champ{width:100%;}
    .v3 .cs-calque .cs-go{width:100%;height:56px;}
    .cs-nav{width:100%;padding:6px;border-radius:16px;}
    .cs-nav-points,.cs-nav-proto{display:none;}
    .cs-nav-url{height:48px;padding:0 12px;}
    .v3 .cs-nav .cs-go{height:48px;padding:0 16px;}
    .cs-bouton{width:100%;}
    .cs-bouton.is-ouvert{width:100%;padding-left:16px;}
    .cs-aide{white-space:normal;}
    .cs-choix{bottom:12px;}
    .cs-choix span{display:none;}
    .v3 .cs-choix button{padding:0 10px;font-size:12.5px;}
  }
`;

export default function CtaSiteHero() {
  const router = useRouter();
  const [variante, setVariante] = useState<VarianteCta>('barre');
  const [choix, setChoix] = useState(false);
  const [site, setSite] = useState('');
  const [aide, setAide] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hote = location.hostname.replace(/^www\./, '');
    setChoix(hote !== 'getklip.fr');
    const demande = new URLSearchParams(location.search).get('cta');
    let garde: string | null = null;
    try { garde = sessionStorage.getItem(CLE); } catch { /* navigation privée */ }
    const v = VARIANTES.find(x => x.id === (demande || garde));
    if (v) setVariante(v.id);
  }, []);

  function choisir(v: VarianteCta) {
    setVariante(v);
    setAide(false);
    setOuvert(false);
    try { sessionStorage.setItem(CLE, v); } catch { /* navigation privée */ }
  }

  function valider(e: React.FormEvent) {
    e.preventDefault();
    if (variante === 'bouton' && !ouvert) {
      setOuvert(true);
      champ.current?.focus({ preventScroll: true });
      return;
    }
    const adresse = nettoyer(site);
    if (!ADRESSE.test(adresse)) {
      setAide(true);
      champ.current?.focus({ preventScroll: true });
      return;
    }
    router.push(`/onboarding/site?site=${encodeURIComponent(adresse)}`);
  }

  const saisie = {
    ref: champ,
    value: site,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setSite(e.target.value); setAide(false); },
    type: 'text' as const,
    inputMode: 'url' as const,
    autoComplete: 'url',
    autoCapitalize: 'none',
    autoCorrect: 'off',
    spellCheck: false,
    placeholder: 'votre-site.fr',
    'aria-label': 'Adresse de votre site web',
  };

  const aideSousChamp = aide && (
    <p className="cs-aide" role="alert">
      Entrez une adresse, par exemple smashy-burger.fr. Pas de site ? <a href="/onboarding/connexion">Commencer sans</a>
    </p>
  );

  let formulaire: React.ReactNode;
  if (variante === 'barre') {
    formulaire = (
      <form className="cs cs-barre" onSubmit={valider} noValidate>
        <span className="cs-ic"><Globe /></span>
        <input {...saisie} />
        <button type="submit" className="cs-go">
          <span className="cs-long">Analyser mon site</span><span className="cs-court">Analyser</span>
          <span className="cs-arr"><Fleche /></span>
        </button>
        {aideSousChamp}
      </form>
    );
  } else if (variante === 'calque') {
    formulaire = (
      <form className="cs cs-calque" onSubmit={valider} noValidate>
        <span className="sel in">
          <span className="cs-calque-champ">
            <span className="cs-ic"><Globe /></span>
            <input {...saisie} />
          </span>
          <span className="sel-frame" aria-hidden="true">
            <span className="sel-h" style={{ top: -7, left: -7 }} />
            <span className="sel-h" style={{ top: -7, right: -7 }} />
            <span className="sel-h" style={{ bottom: -7, left: -7 }} />
            <span className="sel-h" style={{ bottom: -7, right: -7 }} />
            <span className="sel-p" style={{ top: -5, left: '50%', transform: 'translateX(-50%)', width: 22, height: 9 }} />
            <span className="sel-p" style={{ bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 22, height: 9 }} />
            <span className="sel-p" style={{ left: -5, top: '50%', transform: 'translateY(-50%)', width: 9, height: 22 }} />
            <span className="sel-p" style={{ right: -5, top: '50%', transform: 'translateY(-50%)', width: 9, height: 22 }} />
            <span className="cs-tag">Votre site web</span>
          </span>
        </span>
        <button type="submit" className="cs-go">
          Voir ma charte <span className="cs-arr"><Fleche size={18} /></span>
        </button>
        {aideSousChamp}
      </form>
    );
  } else if (variante === 'navigateur') {
    formulaire = (
      <form className="cs cs-nav" onSubmit={valider} noValidate>
        <span className="cs-nav-points" aria-hidden="true">
          <i style={{ background: '#EE6A5F' }} /><i style={{ background: '#F5BD4F' }} /><i style={{ background: '#61C454' }} />
        </span>
        <label className="cs-nav-url">
          <Cadenas />
          <span className="cs-nav-proto">https://</span>
          <input {...saisie} />
        </label>
        <button type="submit" className="cs-go">
          <span className="cs-long">Lire ma charte</span><span className="cs-court">Lire</span>
          <span className="cs-arr"><Fleche /></span>
        </button>
        {aideSousChamp}
      </form>
    );
  } else {
    formulaire = (
      <form className={'cs cs-bouton' + (ouvert ? ' is-ouvert' : '')} onSubmit={valider} noValidate>
        <input {...saisie} tabIndex={ouvert ? 0 : -1} aria-hidden={!ouvert} />
        <button type="submit" className="cs-go">
          {ouvert ? 'Analyser' : 'Votre site web'} <span className="cs-arr"><Fleche size={18} /></span>
        </button>
        {aideSousChamp}
      </form>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {formulaire}
      {choix && (
        <div className="cs-choix" role="group" aria-label="Propositions de CTA">
          <span>CTA</span>
          {VARIANTES.map(v => (
            <button key={v.id} type="button" className={variante === v.id ? 'is-on' : ''} onClick={() => choisir(v.id)}>
              {v.nom}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
