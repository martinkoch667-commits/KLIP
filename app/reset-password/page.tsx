"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function ResetPasswordPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Le lien e-mail → /auth/callback (échange le code) → ici avec une session active
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session);
      setReady(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Le mot de passe doit faire au moins 8 caractères."); return; }
    if (password !== confirm) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
    setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 1500);
  }

  return (
    <main className="auth-wrap">
      <style dangerouslySetInnerHTML={{ __html: AUTH_CSS }} />
      <div className="auth-card">
        <Link href="/" style={{ display: "block", textAlign: "center" }}>
          <img src="/logo-klip-dark.png" alt="Klip" className="auth-logo" />
        </Link>
        <h1 className="auth-title">Nouveau mot de passe</h1>

        {!ready ? (
          <p className="auth-sub">Vérification du lien…</p>
        ) : done ? (
          <p className="auth-ok">Mot de passe mis à jour ✓ Redirection vers votre tableau de bord…</p>
        ) : !validSession ? (
          <>
            <p className="auth-sub">
              Ce lien de réinitialisation est invalide ou a expiré. Redemandez-en un nouveau.
            </p>
            <Link href="/mot-de-passe-oublie" className="auth-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
              Redemander un lien
            </Link>
          </>
        ) : (
          <>
            <p className="auth-sub">Choisissez un nouveau mot de passe pour votre compte.</p>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label htmlFor="password" className="auth-label">Nouveau mot de passe</label>
                <input id="password" type="password" required autoComplete="new-password" value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="auth-input" />
              </div>
              <div>
                <label htmlFor="confirm" className="auth-label">Confirmer</label>
                <input id="confirm" type="password" required autoComplete="new-password" value={confirm}
                  onChange={e => setConfirm(e.target.value)} placeholder="••••••••" className="auth-input" />
              </div>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" disabled={loading} className="auth-btn">
                {loading ? "Mise à jour…" : "Mettre à jour le mot de passe"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
