"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CadreCompte } from "@/components/InscriptionOverlay";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";


export default function ResetPasswordPage() {
  const t = useTranslations('resetPassword');
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
    if (password.length < 8) { setError(t('errorTooShort')); return; }
    if (password !== confirm) { setError(t('errorMismatch')); return; }
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

  /* Même carte que la connexion (CadreCompte). */
  return (
    <CadreCompte titre={t('title')}>
      <h2 className="io-h">{t('title')}</h2>
      {!ready ? (
        <p className="io-p">{t('checkingLink')}</p>
      ) : done ? (
        <p className="io-note is-ok" style={{ marginTop: 14 }}>{t('passwordUpdated')}</p>
      ) : !validSession ? (
        <>
          <p className="io-p">{t('invalidLink')}</p>
          <Link href="/mot-de-passe-oublie" className="io-btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            {t('requestNewLink')}
          </Link>
        </>
      ) : (
        <>
          <p className="io-p">{t('subtitle')}</p>
          <form className="io-form" onSubmit={handleSubmit}>
            <label className="io-lab" htmlFor="io-mdp">{t('newPasswordLabel')}</label>
            <input id="io-mdp" className="io-in" type="password" required autoComplete="new-password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="8 caractères minimum" />
            <label className="io-lab" htmlFor="io-confirm">{t('confirmLabel')}</label>
            <input id="io-confirm" className="io-in" type="password" required autoComplete="new-password" value={confirm}
              onChange={e => setConfirm(e.target.value)} />
            {error && <p className="io-erreur">{error}</p>}
            <button type="submit" disabled={loading} className="io-btn">
              {loading ? t('updating') : t('updateButton')}
            </button>
          </form>
        </>
      )}
    </CadreCompte>
  );
}
