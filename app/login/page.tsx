"use client";

import { useState, Suspense } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sticker } from "@/components/Stickers";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* Écran de connexion — refonte 2026-09.
 *
 * Avant : carte blanche neutre sur fond gris, aucun lien visuel avec la
 * marque. Après : le fond dégradé forêt + la typo signature de la landing
 * (t-arch en Archivo, mot accent surligné en Oaks — voir `.acc-hl` dans
 * globals.css) pour que la connexion ait la même tête que la promesse qui a
 * amené la personne jusqu'ici, à deux clics d'intervalle.
 *
 * Le texte du titre est un gabarit à valider avec Martin, pas le texte
 * final — la composition (deux lignes, la seconde surlignée) est ce qui
 * compte à ce stade.
 */

const AUTH_CSS = `
  .auth-wrap{
    min-height:100vh; position:relative; overflow:hidden;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:64px 24px;
    background:
      radial-gradient(100% 65% at 50% -10%, rgba(189,242,160,.10), transparent 55%),
      radial-gradient(85% 75% at 6% 105%, rgba(31,168,120,.12), transparent 60%),
      var(--forest);
  }
  .auth-logo{display:block;height:44px;width:44px;border-radius:12px;margin:0 auto 40px;position:relative;z-index:2;}
  .auth-head{position:relative;z-index:2;text-align:center;max-width:560px;margin:0 auto;}
  .auth-h1{
    font-family:var(--display); font-weight:800; text-transform:uppercase;
    letter-spacing:-.02em; line-height:1.05; color:var(--cream);
    font-size:clamp(30px,5.2vw,46px); margin:0;
  }
  .auth-h1 .acc-hl{ font-size:.94em; }
  .auth-sub{
    font-family:var(--sans); font-size:15.5px; line-height:1.55; color:var(--cream-2);
    max-width:400px; margin:16px auto 0;
  }
  .auth-body{position:relative;z-index:2;width:100%;max-width:400px;margin:36px auto 0;}
  .auth-notice-ok{font-size:13px;line-height:1.5;color:var(--leaf-ink);background:var(--leaf);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-weight:600;}
  .auth-notice-warn{font-size:13px;line-height:1.5;color:var(--cream);background:rgba(200,115,43,.22);border:1px solid rgba(200,115,43,.4);border-radius:10px;padding:10px 14px;margin-bottom:16px;}
  .auth-google{
    width:100%; padding:14px 16px; background:var(--cream); border:none; border-radius:999px;
    font-family:var(--sans); font-size:14.5px; font-weight:700; color:#14160F; cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:10px;
    transition:transform .16s cubic-bezier(.2,.7,.3,1), box-shadow .18s;
  }
  .auth-google:hover:not(:disabled){ transform:translateY(-1.5px); box-shadow:0 16px 30px -16px rgba(0,0,0,.5); }
  .auth-google:disabled{opacity:.65;cursor:not-allowed;}
  .auth-sep{display:flex;align-items:center;gap:12px;margin:22px 0;}
  .auth-sep-line{flex:1;height:1px;background:var(--cream-4);}
  .auth-sep-text{font-family:var(--sans);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--cream-3);}
  .auth-label{display:block;font-family:var(--sans);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--cream-3);margin-bottom:7px;}
  .auth-input{
    width:100%; border:1.5px solid var(--cream-4); border-radius:10px; padding:13px 15px;
    font-family:var(--sans); font-size:14.5px; color:var(--cream); background:rgba(255,255,255,.05);
    outline:none; transition:border-color .15s, background .15s; box-sizing:border-box;
  }
  .auth-input::placeholder{color:var(--cream-3);}
  .auth-input:focus{border-color:var(--leaf); background:rgba(255,255,255,.08);}
  .auth-forgot{font-size:12px;color:var(--cream-3);text-decoration:none;display:block;text-align:right;margin-top:6px;}
  .auth-forgot:hover{color:var(--leaf);}
  .auth-error{font-size:13px;color:#F4D0B3;background:rgba(200,115,43,.18);border:1px solid rgba(200,115,43,.35);border-radius:10px;padding:10px 13px;}
  .auth-btn{
    width:100%; padding:14px; background:var(--leaf); color:var(--leaf-ink);
    font-family:var(--oaks); font-weight:700; font-size:19px; text-transform:uppercase; letter-spacing:-.005em;
    border-radius:999px; border:none; cursor:pointer;
    transition:transform .16s cubic-bezier(.2,.7,.3,1), box-shadow .18s;
  }
  .auth-btn:hover:not(:disabled){ transform:translateY(-1.5px); box-shadow:0 16px 30px -16px rgba(189,242,160,.65); }
  .auth-btn:disabled{opacity:.6;cursor:not-allowed;}
  .auth-foot{position:relative;z-index:2;text-align:center;font-family:var(--sans);font-size:13.5px;color:var(--cream-3);margin-top:26px;}
  .auth-link{color:var(--leaf);text-decoration:none;font-weight:700;}
  .auth-link:hover{text-decoration:underline;}
  .auth-stk{position:absolute;z-index:1;}
  @media(max-width:640px){
    /* Sur mobile le titre passe sur deux lignes et mord sur leur zone :
       mieux vaut les enlever que les voir recouvrir le texte. */
    .auth-stk{display:none;}
  }
  @media(max-width:480px){
    .auth-wrap{padding:48px 20px;}
    .auth-google,.auth-btn{min-height:50px;font-size:15px;}
    .auth-input{padding:14px 15px;}
  }
`;

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function LoginForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  // Posé par /auth/callback quand l'adresse a bien été confirmée mais que la
  // session n'a pas pu s'ouvrir sur cet appareil, ou quand le lien est périmé.
  // Sans ce retour, l'utilisateur arrive sur un écran de connexion nu et n'a
  // aucun moyen de savoir si son clic a servi à quelque chose.
  const verif = searchParams.get("verif");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message === "Invalid login credentials" ? t("signInError") : error.message);
      setLoading(false);
      return;
    }
    const redirect = searchParams.get("redirect") ?? "/dashboard";
    router.push(redirect);
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    const redirect = searchParams.get("redirect") ?? "/dashboard";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}` },
    });
    if (error) {
      console.error(error);
      setGoogleLoading(false);
    }
  }

  return (
    <>
      {verif === "ok" && <p className="auth-notice-ok">{t("emailConfirmed")}</p>}
      {verif === "expire" && <p className="auth-notice-warn">{t("linkExpired")}</p>}

      <button onClick={handleGoogleSignIn} disabled={googleLoading} className="auth-google">
        <GoogleIcon />
        {googleLoading ? t("redirecting") : t("continueGoogle")}
      </button>

      <div className="auth-sep">
        <div className="auth-sep-line" />
        <span className="auth-sep-text">{t("or")}</span>
        <div className="auth-sep-line" />
      </div>

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label htmlFor="email" className="auth-label">{t("emailLabel")}</label>
          <input
            id="email" type="email" required autoComplete="email"
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")} className="auth-input"
          />
        </div>
        <div>
          <label htmlFor="password" className="auth-label">{t("passwordLabel")}</label>
          <input
            id="password" type="password" required autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" className="auth-input"
          />
          <Link href="/mot-de-passe-oublie" className="auth-forgot">{t("forgotPassword")}</Link>
        </div>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" disabled={loading} className="auth-btn">
          {loading ? t("signingIn") : t("signIn")}
        </button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="auth-wrap">
      <style dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />

      {/* stickers décoratifs, repris du vocabulaire de la landing — cachés sous
         640px via .auth-stk, voir AUTH_CSS */}
      <Sticker name="sparkle" size={44} float="spin" className="auth-stk" style={{ top: '14%', left: '9%', opacity: .9 }} />
      <Sticker name="eyes" size={64} float="B" className="auth-stk" style={{ top: '18%', right: '8%' }} />
      <Sticker name="heart" size={40} float="A" className="auth-stk" style={{ bottom: '12%', left: '12%', ['--r' as string]: '-8deg' }} />

      <Link href="/" style={{ position: 'relative', zIndex: 2 }}>
        <img src="/icon-192.png" alt="Klip" className="auth-logo" />
      </Link>

      {/* Titre gabarit — composition à garder, texte à valider avec Martin. */}
      <div className="auth-head">
        <h1 className="auth-h1">
          VOTRE STUDIO SOCIAL<br />
          <span className="acc-hl">vous attend</span>
        </h1>
        <p className="auth-sub">Reconnectez-vous pour retrouver vos clients, vos visuels et vos plannings.</p>
      </div>

      <div className="auth-body">
        <Suspense fallback={<div style={{ height: 260 }} />}>
          <LoginForm />
        </Suspense>
      </div>

      <p className="auth-foot">
        Pas encore de compte ?{" "}
        <Link href="/register" className="auth-link">Créer un compte</Link>
      </p>
    </main>
  );
}
