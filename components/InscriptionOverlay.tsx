"use client";

/* La fenêtre d'inscription de la landing.
 *
 * Martin ne veut plus que l'inscription ouvre une nouvelle page (2026-09-14) :
 * elle s'ouvre PAR-DESSUS la page d'accueil. La carte reprend la carte
 * « Curseurs » dans sa version violette (demande explicite, malgré le vert de
 * base de Klip) : la scène en haut, sans la phrase de prix, et le formulaire
 * actuel dessous, e-mail, mot de passe, Google.
 *
 * Même logique que /register et /login, qui restent en place pour les liens
 * directs : inscription avec lien de confirmation, connexion par mot de passe,
 * Google. Le lien « Se connecter » bascule dans la même fenêtre au lieu de
 * changer de page.
 *
 * On l'ouvre de n'importe où avec `ouvrirCompte()`, qui émet un événement ; un
 * lien direct `getklip.fr/#inscription` ou `#connexion` l'ouvre au chargement.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { SceneCurseurs, CARTE_CSS } from "@/components/CarteCurseurs";

export type ModeCompte = "inscription" | "connexion";
const EVENEMENT = "klip:compte";

/** Ouvre la fenêtre. `plan` : l'offre cliquée sur la grille de prix. */
export function ouvrirCompte(mode: ModeCompte = "inscription", plan?: string) {
  window.dispatchEvent(new CustomEvent(EVENEMENT, { detail: { mode, plan } }));
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
  .io-fond{position:fixed;inset:0;z-index:2000;overflow-y:auto;overscroll-behavior:contain;
    display:grid;place-items:center;padding:24px 16px;
    background:rgba(22,16,58,.5);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
    animation:io-fond .2s ease-out;}
  .io-carte{width:100%;max-width:430px;margin:auto;text-align:left;
    --ink:#10130B;--ink-2:#50544A;--ink-3:#8A8D7D;--vio:#6656D9;--card:#fff;--line-2:rgba(16,19,11,.08);
    --heavy:'Archivo',system-ui,sans-serif;--sans:'early-sans-variable','Hanken Grotesk',system-ui,sans-serif;
    font-family:var(--sans);color:var(--ink);font-size:16px;line-height:1.5;
    box-shadow:0 0 0 1px rgba(255,255,255,.08),0 50px 100px -30px rgba(10,6,40,.7);
    animation:io-monte .3s cubic-bezier(.16,1,.3,1);}
  @keyframes io-fond{from{opacity:0}to{opacity:1}}
  @keyframes io-monte{from{opacity:0;transform:translateY(18px) scale(.98)}to{opacity:1;transform:none}}

  /* Préfixés par .io-fond : la landing remet à zéro « .v3 button » (fond
     transparent), plus spécifique qu'une classe seule. */
  .io-fond .io-fermer{position:absolute;top:9px;right:10px;z-index:6;width:30px;height:30px;border-radius:50%;
    display:grid;place-items:center;cursor:pointer;color:#fff;background:rgba(255,255,255,.18);
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.35);}
  .io-fond .io-fermer:hover{background:rgba(255,255,255,.3);}

  .io-corps{position:relative;padding:0 26px 26px;margin-top:-2cqw;}
  .io-h{margin:0;font-family:var(--heavy);font-weight:800;font-size:26px;letter-spacing:-.035em;line-height:1.1;
    color:#1D2019;text-align:center;}
  .io-p{margin:8px 0 18px;font-size:14.5px;color:var(--ink-3);text-align:center;}
  .io-fond .io-lien{border:none;background:none;padding:0;font:inherit;font-weight:800;color:var(--vio);cursor:pointer;
    text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1.5px;}

  .io-form{display:flex;flex-direction:column;}
  .io-lab{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin:0 0 6px;}
  .io-in{width:100%;min-height:50px;padding:0 15px;margin-bottom:14px;border:none;border-radius:14px;outline:none;
    background:#F4F5F7;color:var(--ink);font:inherit;font-size:16px;font-weight:600;
    box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.06);transition:box-shadow .15s,background .15s;}
  .io-in::placeholder{color:#A3A69B;font-weight:500;}
  /* En saisie, le champ prend le violet de la sélection. */
  .io-in:focus{background:#fff;box-shadow:inset 0 0 0 2px var(--vio),0 0 0 4px rgba(102,86,217,.14);}
  .io-oubli{align-self:flex-end;margin:-6px 0 14px;font-size:12.5px;font-weight:700;color:var(--ink-3);text-decoration:none;}
  .io-oubli:hover{color:var(--vio);}
  .io-erreur{margin:0 0 12px;padding:9px 12px;border-radius:10px;font-size:13px;line-height:1.4;background:#FDECEA;color:#A8321F;}

  .io-fond .io-btn{min-height:52px;border:none;border-radius:999px;cursor:pointer;font:inherit;font-weight:800;font-size:15.5px;
    color:#fff;background:linear-gradient(180deg,#7869E6 0%,#5A4AD1 100%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 16px 30px -16px rgba(90,74,209,.75);transition:filter .15s,transform .12s;}
  .io-fond .io-btn:hover:not(:disabled){filter:brightness(1.06);}
  .io-fond .io-btn:active{transform:scale(.985);}
  .io-fond .io-btn:disabled{opacity:.6;cursor:not-allowed;}

  .io-ou{display:flex;align-items:center;gap:12px;margin:16px 0;font-size:11px;font-weight:800;letter-spacing:.1em;color:var(--ink-3);}
  .io-ou span{flex:1;height:1px;background:rgba(16,19,11,.1);}
  .io-fond .io-google{width:100%;min-height:50px;border:none;border-radius:999px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;gap:10px;font:inherit;font-weight:700;font-size:15px;color:var(--ink);
    background:#fff;box-shadow:inset 0 0 0 1.5px rgba(16,19,11,.12);}
  .io-fond .io-google:hover:not(:disabled){box-shadow:inset 0 0 0 2px var(--vio);}
  .io-fond .io-google:disabled{opacity:.6;cursor:not-allowed;}

  .io-envoye{text-align:center;padding:4px 0 6px;}
  .io-envoye-ic{width:52px;height:52px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;
    background:#E6E1FF;color:#4B3BC4;box-shadow:inset 0 0 0 1.5px #B9AEFF;}
  .io-envoye .io-p{margin-bottom:0;}
  .io-envoye b{color:var(--ink);}

  @media(max-width:480px){
    .io-fond{padding:12px 10px;place-items:start center;}
    .io-corps{padding:0 18px 20px;}
    .io-h{font-size:23px;}
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
  const champEmail = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function ouvrir(m: ModeCompte, plan?: string) {
      // Même mémoire que /register : l'onboarding présélectionne l'offre cliquée.
      if (plan) {
        try { localStorage.setItem("klip_plan", plan === "agence" || plan === "agency" ? "agency" : "solo"); } catch { /* navigation privée */ }
      }
      setMode(m);
      setErreur(null);
      setEnvoye(false);
      setOuvert(true);
    }
    const surEvenement = (e: Event) => {
      const d = (e as CustomEvent<{ mode?: ModeCompte; plan?: string }>).detail ?? {};
      ouvrir(d.mode === "connexion" ? "connexion" : "inscription", d.plan);
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

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    if (inscription) {
      const { error } = await supabase.auth.signUp({
        email,
        password: motDePasse,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      setEnvoi(false);
      if (error) { setErreur(error.message); return; }
      setEnvoye(true);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse });
    if (error) {
      setErreur(error.message === "Invalid login credentials" ? t("signInError") : error.message);
      setEnvoi(false);
      return;
    }
    router.push("/dashboard");
  }

  async function avecGoogle() {
    setGoogle(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
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

        <SceneCurseurs />

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

              <div className="io-ou"><span />{t("or")}<span /></div>

              <button type="button" className="io-google" onClick={() => void avecGoogle()} disabled={google}>
                <GoogleIcon />
                {google ? t("redirecting") : t("continueGoogle")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
