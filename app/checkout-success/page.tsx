"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export default function CheckoutSuccessPage() {
  const t = useTranslations('checkoutSuccess');
  const router = useRouter();

  useEffect(() => {
    let done = false;
    const go = () => { if (!done) { done = true; router.replace("/dashboard?welcome=true"); } };
    // Synchronise l'abonnement Stripe → DB avant d'arriver sur l'app (évite le rebond middleware)
    fetch("/api/stripe/sync", { method: "POST" })
      .then(() => go())
      .catch(() => go());
    // garde-fou : on continue même si la sync traîne
    const t = setTimeout(go, 4000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--canvas)", fontFamily: "var(--sans)" }}>
      <div style={{ textAlign: "center", color: "var(--ink-2)" }}>
        <div style={{ width: 40, height: 40, margin: "0 auto 16px", borderRadius: "50%", border: "3px solid rgba(47,215,155,.25)", borderTopColor: "#2FD79B", animation: "lp-spin .8s linear infinite" }} />
        <p style={{ fontWeight: 700 }}>{t('activating')}</p>
        <style>{`@keyframes lp-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </main>
  );
}
