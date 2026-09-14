"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CadreCompte } from "@/components/InscriptionOverlay";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";


export default function ForgotPasswordPage() {
  const t = useTranslations('forgotPassword');
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

  /* Même carte que la connexion (CadreCompte) : l'ancien écran blanc sur fond
     beige ne ressemblait plus à rien du parcours. */
  return (
    <CadreCompte titre={t('title')}>
      <h2 className="io-h">{t('title')}</h2>
      {sent ? (
        <>
          <p className="io-note is-ok" style={{ marginTop: 14 }}>{t('sentMessage', { email })}</p>
          <p className="io-p" style={{ marginBottom: 0 }}>
            <Link href="/login" className="io-oubli" style={{ float: "none" }}>{t('backToLogin')}</Link>
          </p>
        </>
      ) : (
        <>
          <p className="io-p">{t('subtitle')}</p>
          <form className="io-form" onSubmit={handleSubmit}>
            <label className="io-lab" htmlFor="io-email">{t('emailLabel')}</label>
            <input id="io-email" className="io-in" type="email" required autoComplete="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="vous@agence.com" />
            {error && <p className="io-erreur">{error}</p>}
            <button type="submit" disabled={loading} className="io-btn">
              {loading ? t('sending') : t('sendLink')}
            </button>
          </form>
          <p className="io-p" style={{ margin: "16px 0 0" }}>
            <Link href="/login" className="io-oubli">{t('backToLogin')}</Link>
          </p>
        </>
      )}
    </CadreCompte>
  );
}
