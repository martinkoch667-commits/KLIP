"use client";

import { useState } from "react";
import Image from "next/image";
import { trackLead } from "@/components/analytics/MetaPixel";

const PERKS = [
  { icon: "M5 13l4 4L19 7", title: "Accès prioritaire", desc: "Vous êtes prévenu·e en premier dès l'ouverture, avant tout le monde." },
  { icon: "M12 2l2.4 7.4H22l-6 4.6 2.3 7.4L12 17l-6.3 4.4L8 14 2 9.4h7.6z", title: "Tarif fondateur", desc: "Un prix de lancement réservé aux inscrits de la première heure." },
  { icon: "M20 6 9 17l-5-5", title: "Onboarding offert", desc: "On configure votre premier client avec vous, gratuitement." },
];

export default function EarlyAccessView() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [instagram, setInstagram] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Entrez un email valide."); return; }
    setBusy(true);
    try {
      const source = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref") || "direct" : "direct";
      const res = await fetch("/api/waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, instagram, company, source }),
      });
      if (res.ok) {
        trackLead({ content_name: "waitlist-acces-anticipe", source });
        setDone(true);
      }
      else { const d = await res.json(); setError(d?.error || "Inscription impossible."); }
    } catch { setError("Une erreur est survenue."); }
    setBusy(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "13px 15px", borderRadius: 12, fontSize: 15,
    background: "rgba(255,255,255,.06)", border: "1px solid rgba(238,237,227,.18)",
    color: "#F4F3EC", outline: "none", fontFamily: "var(--sans)", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(120% 80% at 50% -10%, #0F3324, #06140C 70%)", color: "#F4F3EC", fontFamily: "var(--sans)", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 22px 64px" }}>
      <style>{`@keyframes eaIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}`}</style>

      <Image src="/logo-klip-mint.png" alt="Klip" width={1096} height={408} priority style={{ height: 30, width: "auto", marginBottom: 30 }} />

      {!done ? (
        <div style={{ width: "100%", maxWidth: 560, animation: "eaIn .4s cubic-bezier(.16,1,.3,1)" }}>
          <span style={{ display: "inline-block", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "#06281C", background: "var(--mint, #2FD79B)", padding: "6px 13px", borderRadius: 99, marginBottom: 20 }}>
            Pré-ouverture · accès anticipé
          </span>
          <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: "clamp(32px, 6vw, 50px)", lineHeight: 1.02, letterSpacing: "-0.03em", textTransform: "uppercase", margin: "0 0 16px" }}>
            Rejoignez la liste d&apos;attente de <span style={{ color: "var(--mint, #2FD79B)" }}>Klip</span>
          </h1>
          <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "rgba(244,243,236,.7)", margin: "0 0 28px", maxWidth: 480 }}>
            L&apos;outil tout-en-un pour gérer l&apos;Instagram de tous vos clients : création de visuels, IA, calendrier, validation client, publication. Inscrivez-vous pour un <strong style={{ color: "#F4F3EC" }}>accès anticipé</strong> et des avantages réservés aux premiers.
          </p>

          {/* Avantages */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 30 }}>
            {PERKS.map(p => (
              <div key={p.title} style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, background: "rgba(47,215,155,.14)", display: "grid", placeItems: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mint, #2FD79B)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={p.icon} /></svg>
                </span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, fontFamily: "var(--display)" }}>{p.title}</div>
                  <div style={{ fontSize: 13.5, color: "rgba(244,243,236,.6)", lineHeight: 1.45 }}>{p.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Formulaire */}
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <input style={inputStyle} type="email" required placeholder="Votre email *" value={email} onChange={e => setEmail(e.target.value)} />
            <div style={{ display: "flex", gap: 11 }}>
              <input style={inputStyle} placeholder="Prénom / nom" value={name} onChange={e => setName(e.target.value)} />
              <input style={inputStyle} placeholder="@instagram" value={instagram} onChange={e => setInstagram(e.target.value)} />
            </div>
            <input style={inputStyle} placeholder="Agence, freelance, combien de clients ?" value={company} onChange={e => setCompany(e.target.value)} />
            {error && <p style={{ color: "#FCA5A5", fontSize: 13, margin: "2px 0 0" }}>{error}</p>}
            <button type="submit" disabled={busy}
              style={{ marginTop: 6, padding: "15px", borderRadius: 12, border: "none", cursor: busy ? "not-allowed" : "pointer", background: "var(--mint, #2FD79B)", color: "#06281C", fontFamily: "var(--display)", fontWeight: 800, fontSize: 15.5, textTransform: "uppercase", letterSpacing: ".02em", opacity: busy ? 0.7 : 1, transition: "transform .15s, box-shadow .2s" }}
              onMouseEnter={e => { if (!busy) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 16px 30px -14px rgba(47,215,155,.7)"; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
              {busy ? "Inscription…" : "Je veux l'accès anticipé →"}
            </button>
            <p style={{ fontSize: 12, color: "rgba(244,243,236,.4)", textAlign: "center", margin: "4px 0 0" }}>
              Aucun spam. Juste un email le jour de l&apos;ouverture.
            </p>
          </form>
        </div>
      ) : (
        <div style={{ width: "100%", maxWidth: 480, textAlign: "center", animation: "eaIn .4s cubic-bezier(.16,1,.3,1)", paddingTop: 30 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(47,215,155,.16)", display: "grid", placeItems: "center", margin: "0 auto 22px" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--mint, #2FD79B)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 30, textTransform: "uppercase", letterSpacing: "-0.02em", margin: "0 0 12px" }}>Vous êtes sur la liste !</h1>
          <p style={{ fontSize: 16, color: "rgba(244,243,236,.7)", lineHeight: 1.6, margin: 0 }}>
            Merci 🙌 On vous prévient par email <strong style={{ color: "#F4F3EC" }}>dès l&apos;ouverture de Klip</strong>, avec vos avantages d&apos;accès anticipé. À très vite !
          </p>
        </div>
      )}
    </div>
  );
}
