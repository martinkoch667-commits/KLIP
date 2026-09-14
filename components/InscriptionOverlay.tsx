"use client";

/* La fenêtre d'inscription de la landing.
 *
 * Martin ne veut plus que l'inscription ouvre une nouvelle page (2026-09-14) :
 * elle s'ouvre PAR-DESSUS la page d'accueil. La carte reprend la carte
 * « Curseurs » : la scène en violet (demande explicite, malgré le vert de base
 * de Klip), sans la phrase de prix, et le formulaire actuel à côté, e-mail,
 * mot de passe, Google, qui garde le vert pour rester cohérent avec le site.
 * En haut sur mobile, à gauche sur ordinateur.
 *
 * Même logique que /register et /login, qui restent en place pour les liens
 * directs : inscription avec lien de confirmation, connexion par mot de passe,
 * Google. Le lien « Se connecter » bascule dans la même fenêtre au lieu de
 * changer de page.
 *
 * On l'ouvre de n'importe où avec `ouvrirCompte()`, qui émet un événement ; un
 * lien direct `getklip.fr/#inscription` ou `#connexion` l'ouvre au chargement.
 *
 * `suite` : où aller une fois le compte ouvert. Le CTA « votre site web » du
 * hero s'en sert (Martin, 2026-09-14) : on crée le compte AVANT d'analyser le
 * site, puis on revient sur l'analyse. L'adresse voyage dans le lien de
 * confirmation et le retour Google (`/auth/callback?next=`), parce que le mail
 * s'ouvre souvent dans un autre onglet, sans le sessionStorage de celui-ci.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { SceneCurseurs, CARTE_CSS } from "@/components/CarteCurseurs";

export type ModeCompte = "inscription" | "connexion";
const EVENEMENT = "klip:compte";

/** Ouvre la fenêtre. `plan` : l'offre cliquée sur la grille de prix ;
 *  `suite` : le chemin où reprendre une fois connecté. */
export function ouvrirCompte(mode: ModeCompte = "inscription", plan?: string, suite?: string) {
  window.dispatchEvent(new CustomEvent(EVENEMENT, { detail: { mode, plan, suite } }));
}

/* Navigateurs intégrés des applis (Instagram, Facebook, Messenger, TikTok…) :
   Google y refuse la connexion (« disallowed_useragent »). Avec une campagne
   Meta, c'est là qu'arrive la majorité des visiteurs mobiles. */
const APPLI_INTEGREE = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|LinkedInApp|musical_ly|TikTok|Snapchat/i;

/** Seulement un chemin du site : jamais une adresse externe. */
function cheminSur(v?: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

const IO_CSS = `
  /* Derrière la carte, la landing reste lisible : un flou seul, sans voile
     sombre ni teinte (demande de Martin). */
  .io-fond{position:fixed;inset:0;z-index:2000;overflow-y:auto;overscroll-behavior:contain;
    display:grid;padding:24px 16px;background:transparent;
    -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);
    animation:io-fond .2s ease-out;}
  /* margin:auto centre la carte et la garde entière quand elle dépasse. */
  .io-carte{width:100%;max-width:400px;margin:auto;text-align:left;
    --ink:#10130B;--ink-2:#50544A;--ink-3:#8A8D7D;--vio:#6656D9;--card:#fff;--line-2:rgba(16,19,11,.08);
    --forest:#072117;--forest-3:#124732;--leaf:#BDF2A0;--leaf-ink:#1E3317;--mint:#2FD79B;--mint-2:#1FA878;
    --heavy:'Archivo',system-ui,sans-serif;--sans:'early-sans-variable','Hanken Grotesk',system-ui,sans-serif;
    font-family:var(--sans);color:var(--ink);font-size:16px;line-height:1.5;
    box-shadow:0 0 0 1px rgba(16,19,11,.07),0 44px 90px -34px rgba(0,0,0,.5);
    animation:io-monte .3s cubic-bezier(.16,1,.3,1);}
  @keyframes io-fond{from{opacity:0}to{opacity:1}}
  @keyframes io-monte{from{opacity:0;transform:translateY(18px) scale(.98)}to{opacity:1;transform:none}}

  /* La scène garde son propre repère : ses cqw suivent sa largeur, qu'elle
     soit en haut de la carte (mobile) ou dans la colonne gauche (ordinateur). */
  .io-visuel{position:relative;container-type:inline-size;}

  /* Préfixés par .io-fond : la landing remet à zéro « .v3 button » et « .v3 a »,
     plus spécifiques qu'une classe seule. */
  .io-fond .io-fermer{position:absolute;top:9px;right:10px;z-index:6;width:30px;height:30px;border-radius:50%;
    display:grid;place-items:center;cursor:pointer;color:#fff;background:rgba(20,12,70,.32);
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.4);}
  .io-fond .io-fermer:hover{background:rgba(20,12,70,.48);}

  /* Sous la scène violette, tout reprend le vert de Klip, comme la landing. */
  .io-corps{position:relative;padding:0 24px 24px;margin-top:-2cqw;}
  .io-h{margin:0;font-family:var(--heavy);font-weight:800;font-size:25px;letter-spacing:-.035em;line-height:1.1;
    color:#1D2019;text-align:center;}
  .io-p{margin:8px 0 18px;font-size:14.5px;color:var(--ink-3);text-align:center;}
  /* Rappel du site en attente, quand on vient du CTA « votre site web ». */
  .io-contexte{display:flex;align-items:center;gap:7px;width:fit-content;max-width:100%;margin:0 auto 12px;padding:5px 12px 5px 9px;
    border-radius:999px;background:#F3F4F6;font-size:13px;font-weight:600;line-height:1.3;color:var(--ink-2);}
  .io-contexte svg{flex:none;color:var(--ink-3);}
  .io-contexte b{color:var(--ink);font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .io-fond .io-lien{border:none;background:none;padding:0;font:inherit;font-weight:800;color:var(--forest-3);cursor:pointer;
    text-decoration:underline;text-decoration-color:var(--mint-2);text-underline-offset:3px;text-decoration-thickness:2px;}
  .io-fond .io-lien:hover{color:var(--mint-2);}

  .io-form{display:flex;flex-direction:column;}
  .io-lab{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin:0 0 6px;}
  /* 16 px minimum dans les champs : en dessous, l'iPhone zoome à la saisie. */
  .io-fond .io-in{width:100%;min-height:50px;padding:0 15px;margin-bottom:14px;border:none;border-radius:14px;outline:none;
    background:#F4F5F7;color:var(--ink);font:inherit;font-size:16px;font-weight:600;
    box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.06);transition:box-shadow .15s,background .15s;}
  .io-in::placeholder{color:#A3A69B;font-weight:500;}
  .io-fond .io-in:focus{background:#fff;box-shadow:inset 0 0 0 2px var(--mint-2),0 0 0 4px rgba(47,215,155,.18);}
  .io-fond .io-oubli{align-self:flex-end;margin:-6px 0 14px;font-size:12.5px;font-weight:700;color:var(--ink-3);text-decoration:none;}
  .io-fond .io-oubli:hover{color:var(--forest-3);}
  .io-erreur{margin:0 0 12px;padding:9px 12px;border-radius:10px;font-size:13px;line-height:1.4;background:#FDECEA;color:#A8321F;}

  .io-fond .io-btn{min-height:52px;border:none;border-radius:999px;cursor:pointer;font:inherit;font-weight:800;font-size:15.5px;
    color:var(--leaf-ink);background:var(--leaf);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 16px 32px -16px rgba(120,190,90,.6);transition:background .15s,transform .12s;}
  .io-fond .io-btn:hover:not(:disabled){background:#C9F5B2;}
  .io-fond .io-btn:active{transform:scale(.985);}
  .io-fond .io-btn:disabled{opacity:.6;cursor:not-allowed;}

  .io-ou{display:flex;align-items:center;gap:12px;margin:16px 0;font-size:11px;font-weight:800;letter-spacing:.1em;color:var(--ink-3);}
  .io-ou span{flex:1;height:1px;background:rgba(16,19,11,.1);}
  .io-fond .io-google{width:100%;min-height:50px;border:none;border-radius:999px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;gap:10px;font:inherit;font-weight:700;font-size:15px;color:var(--ink);
    background:#fff;box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.12);}
  .io-fond .io-google:hover:not(:disabled){box-shadow:inset 0 0 0 2px var(--mint-2);}
  .io-fond .io-google:disabled{opacity:.6;cursor:not-allowed;}

  .io-appli{margin:14px 0 0;padding:10px 12px;border-radius:12px;background:#F3F4F6;font-size:12.5px;line-height:1.45;
    color:var(--ink-2);text-align:center;}
  .io-envoye{text-align:center;padding:4px 0 6px;}
  .io-envoye-ic{width:52px;height:52px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;
    background:var(--leaf);color:var(--leaf-ink);}
  .io-envoye .io-p{margin-bottom:0;}
  .io-envoye b{color:var(--ink);}

  /* Tablette et petit ordinateur à écran bas : la carte verticale se resserre. */
  @media(min-width:481px) and (max-width:859px) and (max-height:820px){
    .io-fond{padding:14px 16px;}
    .io-p{margin-bottom:14px;}
    .io-fond .io-in{min-height:46px;margin-bottom:12px;}
    .io-fond .io-btn{min-height:48px;}
    .io-fond .io-google{min-height:46px;}
    .io-ou{margin:12px 0;}
  }

  /* Ordinateur : la carte passe en largeur. La scène violette occupe un
     panneau à gauche, le formulaire est à droite. */
  @media(min-width:860px){
    .io-fond{padding:24px 32px;}
    .io-carte{max-width:900px;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);
      padding:10px;border-radius:30px;}
    .io-visuel{display:flex;flex-direction:column;justify-content:center;overflow:hidden;border-radius:22px;background:#F6F4FF;}
    /* Le halo couvre tout le panneau et non plus la seule scène. */
    .io-visuel .fx-halo{display:none;}
    .io-visuel::before{content:"";position:absolute;inset:0;pointer-events:none;
      background:
        radial-gradient(75% 45% at 55% -6%,#2F22A8 0%,#5646D6 38%,transparent 72%),
        linear-gradient(90deg,#8C7DFF 0%,#B7ADFF 12%,transparent 28%),
        linear-gradient(180deg,#9D90FF 0%,#D9D3FF 38%,transparent 72%);
      -webkit-mask-image:linear-gradient(to bottom,#000 40%,transparent 100%);mask-image:linear-gradient(to bottom,#000 40%,transparent 100%);}
    .io-visuel .fx-tete{margin-top:-4cqw;}
    .io-corps{margin:0;padding:40px 38px 32px 42px;display:flex;flex-direction:column;justify-content:center;}
    .io-h{font-size:30px;text-align:left;}
    .io-p{text-align:left;margin:8px 0 24px;}
    .io-contexte{margin-left:0;}
    .io-envoye .io-h,.io-envoye .io-p{text-align:center;}
    .io-fond .io-fermer{top:18px;right:18px;color:var(--ink-2);background:#F3F4F6;box-shadow:none;}
    .io-fond .io-fermer:hover{background:#E8EAEE;}
  }

  /* Mobile : une carte plus petite, pour que la page respire autour. */
  @media(max-width:480px){
    .io-fond{padding:20px 24px;}
    .io-carte{max-width:344px;border-radius:24px;}
    .io-corps{padding:0 18px 18px;}
    .io-h{font-size:21px;}
    .io-p{font-size:13.5px;margin:6px 0 14px;}
    .io-lab{font-size:11px;margin-bottom:5px;}
    .io-fond .io-in{min-height:44px;margin-bottom:11px;border-radius:12px;}
    .io-fond .io-oubli{margin:-3px 0 12px;font-size:12px;}
    .io-fond .io-btn{min-height:46px;font-size:15px;}
    .io-ou{margin:12px 0;}
    .io-fond .io-google{min-height:44px;font-size:14.5px;}
    .io-fond .io-fermer{top:8px;right:8px;width:28px;height:28px;}
  }
  @media (prefers-reduced-motion: reduce){ .io-fond,.io-carte{animation:none;} }
`;

export default function InscriptionOverlay() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState<ModeCompte>("inscription");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [google, setGoogle] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [suite, setSuite] = useState<string | null>(null);
  const [appliIntegree, setAppliIntegree] = useState(false);
  const champEmail = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAppliIntegree(APPLI_INTEGREE.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    function ouvrir(m: ModeCompte, plan?: string, apres?: string) {
      // Même mémoire que /register : l'onboarding présélectionne l'offre cliquée.
      if (plan) {
        try { localStorage.setItem("klip_plan", plan === "agence" || plan === "agency" ? "agency" : "solo"); } catch { /* navigation privée */ }
      }
      setMode(m);
      setErreur(null);
      setEnvoye(false);
      setSuite(cheminSur(apres));
      setOuvert(true);
    }
    const surEvenement = (e: Event) => {
      const d = (e as CustomEvent<{ mode?: ModeCompte; plan?: string; suite?: string }>).detail ?? {};
      ouvrir(d.mode === "connexion" ? "connexion" : "inscription", d.plan, d.suite);
    };
    window.addEventListener(EVENEMENT, surEvenement);
    if (location.hash === "#inscription" || location.hash === "#connexion") {
      ouvrir(location.hash === "#connexion" ? "connexion" : "inscription");
    }
    return () => window.removeEventListener(EVENEMENT, surEvenement);
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    /* Sur mobile c'est <body> qui défile (globals.css) : on bloque les deux. */
    const html = document.documentElement.style.overflow;
    const body = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    window.addEventListener("keydown", echap);
    /* Focus sur l'e-mail au clavier et à la souris seulement : au doigt, le
       clavier virtuel monterait tout de suite et masquerait la carte. */
    const id = window.matchMedia("(pointer: fine)").matches
      ? setTimeout(() => champEmail.current?.focus({ preventScroll: true }), 280)
      : undefined;
    return () => {
      document.documentElement.style.overflow = html;
      document.body.style.overflow = body;
      window.removeEventListener("keydown", echap);
      if (id) clearTimeout(id);
    };
  }, [ouvert]);

  if (!ouvert) return null;

  const inscription = mode === "inscription";
  /* Le retour de Supabase (mail de confirmation, Google) passe par le callback,
     qui renvoie sur `next`. */
  const retour = `${location.origin}/auth/callback${suite ? `?next=${encodeURIComponent(suite)}` : ""}`;
  let siteEnAttente: string | null = null;
  if (suite) {
    try { siteEnAttente = new URL(suite, location.origin).searchParams.get("site"); } catch { /* adresse illisible */ }
  }

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    if (inscription) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: motDePasse,
        options: { emailRedirectTo: retour },
      });
      setEnvoi(false);
      if (error) { setErreur(error.message); return; }
      // Sans confirmation d'adresse exigée, la session est déjà ouverte : on
      // reprend tout de suite là où la personne allait.
      if (data.session && suite) { router.push(suite); return; }
      setEnvoye(true);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
    if (error) {
      setErreur(error.message === "Invalid login credentials" ? t("signInError") : error.message);
      setEnvoi(false);
      return;
    }
    router.push(suite ?? "/dashboard");
  }

  async function avecGoogle() {
    setGoogle(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: retour },
    });
    if (error) {
      console.error(error);
      setGoogle(false);
    }
  }

  function basculer() {
    setMode(inscription ? "connexion" : "inscription");
    setErreur(null);
  }

  return (
    <div className="io-fond" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setOuvert(false); }}>
      <style dangerouslySetInnerHTML={{ __html: CARTE_CSS + IO_CSS }} />
      <div className="fx is-violet io-carte" role="dialog" aria-modal="true"
        aria-label={inscription ? t("registerTitle") : t("loginTitle")}>
        <button type="button" className="io-fermer" onClick={() => setOuvert(false)} aria-label="Fermer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>

        <div className="io-visuel"><SceneCurseurs /></div>

        <div className="io-corps">
          {envoye ? (
            <div className="io-envoye">
              <div className="io-envoye-ic">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <h2 className="io-h">{t("verifyEmailTitle")}</h2>
              <p className="io-p">
                {t("verifyEmailBody1")} <b>{email}</b>. {t("verifyEmailBody2")}
              </p>
            </div>
          ) : (
            <>
              {siteEnAttente && (
                <p className="io-contexte">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3Z" /></svg>
                  <span>On analyse</span> <b>{siteEnAttente}</b> <span>juste après</span>
                </p>
              )}
              <h2 className="io-h">{inscription ? t("registerTitle") : t("loginTitle")}</h2>
              <p className="io-p">
                {inscription ? t("haveAccount") : t("noAccount")}{" "}
                <button type="button" className="io-lien" onClick={basculer}>
                  {inscription ? t("signIn") : t("createAccount")}
                </button>
              </p>

              <form className="io-form" onSubmit={valider}>
                <label className="io-lab" htmlFor="io-email">{t("emailLabel")}</label>
                <input id="io-email" ref={champEmail} className="io-in" type="email" required autoComplete="email"
                  value={email} onChange={e => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} />
                <label className="io-lab" htmlFor="io-mdp">{t("passwordLabel")}</label>
                <input id="io-mdp" className="io-in" type="password" required
                  minLength={inscription ? 8 : undefined}
                  autoComplete={inscription ? "new-password" : "current-password"}
                  value={motDePasse} onChange={e => setMotDePasse(e.target.value)}
                  placeholder={inscription ? t("passwordPlaceholder") : ""} />
                {!inscription && <Link href="/mot-de-passe-oublie" className="io-oubli">{t("forgotPassword")}</Link>}
                {erreur && <p className="io-erreur">{erreur}</p>}
                <button type="submit" className="io-btn" disabled={envoi}>
                  {envoi
                    ? (inscription ? t("creating") : t("signingIn"))
                    : (inscription ? t("createMyAccount") : t("signIn"))}
                </button>
              </form>

              {appliIntegree ? (
                /* Pas de bouton Google qui mène à une erreur : on dit comment
                   faire, et l'e-mail au-dessus marche partout. */
                <p className="io-appli">
                  Google ne fonctionne pas dans le navigateur de l&apos;appli. Utilisez votre e-mail, ou ouvrez
                  getklip.fr dans Safari ou Chrome (menu <b>···</b> puis « Ouvrir dans le navigateur »).
                </p>
              ) : (
                <>
                  <div className="io-ou"><span />{t("or")}<span /></div>

                  <button type="button" className="io-google" onClick={() => void avecGoogle()} disabled={google}>
                    <GoogleIcon />
                    {google ? t("redirecting") : t("continueGoogle")}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
