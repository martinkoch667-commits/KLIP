"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

const AUTH_CSS = `
  .auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--canvas);padding:24px;}
  .auth-card{width:100%;max-width:440px;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.08);padding:40px;}
  .auth-logo{display:block;height:40px;width:auto;margin:0 auto 32px;}
  .auth-title{font-family:var(--display);font-weight:800;font-size:24px;text-transform:uppercase;color:var(--forest);letter-spacing:-.01em;margin-bottom:6px;}
  .auth-sub{font-size:13px;color:rgba(20,22,15,.6);margin-bottom:28px;}
  .auth-label{display:block;font-family:var(--sans);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(20,22,15,.6);margin-bottom:6px;}
  .auth-input{width:100%;border:1.5px solid rgba(20,22,15,.15);border-radius:8px;padding:12px 16px;font-family:var(--sans);font-size:14px;color:var(--ink);background:#fff;outline:none;transition:border-color .15s;}
  .auth-input::placeholder{color:rgba(20,22,15,.30);}
  .auth-input:focus{border-color:var(--mint);}
  .auth-btn{width:100%;padding:13px;background:var(--forest);color:var(--canvas);font-family:var(--display);font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.06em;border-radius:8px;border:none;cursor:pointer;transition:background .15s,color .15s;}
  .auth-btn:hover:not(:disabled){background:var(--mint);color:var(--forest);}
  .auth-btn:disabled{opacity:.6;cursor:not-allowed;}
  .auth-sep{display:flex;align-items:center;gap:12px;margin:20px 0;}
  .auth-sep-line{flex:1;height:1px;background:rgba(20,22,15,.15);}
  .auth-sep-text{font-family:var(--sans);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(20,22,15,.40);}
  .auth-google{width:100%;padding:12px 16px;background:#fff;border:1.5px solid rgba(20,22,15,.15);border-radius:8px;font-family:var(--sans);font-size:14px;font-weight:500;color:var(--forest);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:border-color .15s,background .15s;}
  .auth-google:hover:not(:disabled){border-color:rgba(20,22,15,.30);background:var(--paper);}
  .auth-google:disabled{opacity:.6;cursor:not-allowed;}
  .auth-link{color:var(--mint);text-decoration:none;font-weight:600;}
  .auth-link:hover{text-decoration:underline;}
  .auth-error{font-size:13px;color:var(--warn);background:var(--warn-soft);border:1px solid rgba(200,115,43,.2);border-radius:8px;padding:9px 12px;}
  .auth-success-icon{width:52px;height:52px;border-radius:50%;background:var(--mint-soft);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;}
  @media(max-width:480px){
    .auth-wrap{padding:16px;}
    .auth-card{padding:28px 20px;border-radius:14px;}
    .auth-title{font-size:20px;}
    .auth-btn,.auth-google{min-height:48px;font-size:15px;}
    .auth-input{padding:13px 14px;}
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

export default function RegisterPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClientComponentClient();

  // Mémorise l'offre choisie sur la landing (?plan=studio|agency) pour l'onboarding
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("plan");
      if (p === "studio" || p === "solo") localStorage.setItem("klip_plan", "solo");
      else if (p === "agency" || p === "agence") localStorage.setItem("klip_plan", "agency");
    } catch { /* ignore */ }
  }, []);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSent(true);
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      console.error(error);
      setGoogleLoading(false);
    }
  }

  if (sent) {
    return (
      <main className="auth-wrap">
        <style dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />
        <div className="auth-card" style={{ textAlign: "center" }}>
          <img src="/logo-klip-dark.png" alt="Klip" className="auth-logo" />
          <div className="auth-success-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--mint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          </div>
          <h1 className="auth-title" style={{ marginBottom: 12 }}>{t("verifyEmailTitle")}</h1>
          <p style={{ fontSize: 14, color: "rgba(20,22,15,.6)", lineHeight: 1.6 }}>
            {t("verifyEmailBody1")}{" "}
            <strong style={{ color: "var(--forest)" }}>{email}</strong>.
            <br />{t("verifyEmailBody2")}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-wrap">
      <style dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />
      <div className="auth-card">
        <img src="/logo-klip-dark.png" alt="Klip" className="auth-logo" />
        <h1 className="auth-title">{t("registerTitle")}</h1>
        <p className="auth-sub">
          {t("haveAccount")}{" "}
          <Link href="/login" className="auth-link">{t("signIn")}</Link>
        </p>

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
              id="password" type="password" required autoComplete="new-password"
              minLength={8} value={password} onChange={e => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder")} className="auth-input"
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={loading} className="auth-btn">
            {loading ? t("creating") : t("createMyAccount")}
          </button>
        </form>

        <div className="auth-sep">
          <div className="auth-sep-line" />
          <span className="auth-sep-text">{t("or")}</span>
          <div className="auth-sep-line" />
        </div>

        <button onClick={handleGoogleSignIn} disabled={googleLoading} className="auth-google">
          <GoogleIcon />
          {googleLoading ? t("redirecting") : t("continueGoogle")}
        </button>
      </div>
    </main>
  );
}
