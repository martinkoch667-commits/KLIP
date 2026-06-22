"use client";

import { useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

const AUTH_CSS = `
  .auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--canvas);padding:24px;}
  .auth-card{width:100%;max-width:440px;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.08);padding:40px;}
  .auth-logo{display:block;height:40px;width:auto;margin:0 auto 32px;}
  .auth-title{font-family:var(--display);font-weight:800;font-size:24px;text-transform:uppercase;color:var(--forest);letter-spacing:-.01em;margin-bottom:6px;}
  .auth-sub{font-size:13px;color:rgba(20,22,15,.6);margin-bottom:28px;line-height:1.5;}
  .auth-label{display:block;font-family:var(--sans);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(20,22,15,.6);margin-bottom:6px;}
  .auth-input{width:100%;border:1.5px solid rgba(20,22,15,.15);border-radius:8px;padding:12px 16px;font-family:var(--sans);font-size:14px;color:var(--ink);background:#fff;outline:none;transition:border-color .15s;}
  .auth-input:focus{border-color:var(--mint);}
  .auth-btn{width:100%;padding:13px;background:var(--forest);color:var(--canvas);font-family:var(--display);font-weight:700;font-size:14px;text-transform:uppercase;letter-spacing:.06em;border-radius:8px;border:none;cursor:pointer;transition:background .15s,color .15s;}
  .auth-btn:hover:not(:disabled){background:var(--mint);color:var(--forest);}
  .auth-btn:disabled{opacity:.6;cursor:not-allowed;}
  .auth-link{color:var(--mint);text-decoration:none;font-weight:600;}
  .auth-link:hover{text-decoration:underline;}
  .auth-error{font-size:13px;color:var(--warn);background:var(--warn-soft);border:1px solid rgba(200,115,43,.2);border-radius:8px;padding:9px 12px;}
  .auth-ok{font-size:14px;color:var(--mint-2);background:var(--mint-soft);border:1px solid rgba(47,215,155,.3);border-radius:8px;padding:14px 16px;line-height:1.5;}
  @media(max-width:480px){.auth-wrap{padding:16px;}.auth-card{padding:28px 20px;}.auth-btn{min-height:48px;}}
`;

export default function ForgotPasswordPage() {
  const supabase = createClientComponentClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  return (
    <main className="auth-wrap">
      <style dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />
      <div className="auth-card">
        <Link href="/" style={{ display: "block", textAlign: "center" }}>
          <img src="/logo-klip-dark.png" alt="Klip" className="auth-logo" />
        </Link>
        <h1 className="auth-title">Mot de passe oublié</h1>

        {sent ? (
          <>
            <p className="auth-ok">
              Si un compte existe pour <strong>{email}</strong>, vous allez recevoir un e-mail
              avec un lien pour réinitialiser votre mot de passe. Pensez à vérifier vos spams.
            </p>
            <p className="auth-sub" style={{ marginTop: 20, marginBottom: 0 }}>
              <Link href="/login" className="auth-link">← Retour à la connexion</Link>
            </p>
          </>
        ) : (
          <>
            <p className="auth-sub">
              Entrez votre adresse e-mail : nous vous enverrons un lien pour créer un nouveau mot de passe.
            </p>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label htmlFor="email" className="auth-label">Email</label>
                <input id="email" type="email" required autoComplete="email" value={email}
                  onChange={e => setEmail(e.target.value)} placeholder="vous@agence.com" className="auth-input" />
              </div>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" disabled={loading} className="auth-btn">
                {loading ? "Envoi…" : "Envoyer le lien"}
              </button>
            </form>
            <p className="auth-sub" style={{ marginTop: 20, marginBottom: 0 }}>
              <Link href="/login" className="auth-link">← Retour à la connexion</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
