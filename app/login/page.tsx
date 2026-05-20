"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect."
          : error.message
      );
      setLoading(false);
      return;
    }

    const redirect = searchParams.get("redirect") ?? "/dashboard";
    router.push(redirect);
    router.refresh();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#161616",
    border: "1px solid #1E1E1E",
    borderRadius: 8,
    padding: "13px 16px",
    fontSize: 15,
    color: "#F0EFE9",
    fontFamily: "'Satoshi', sans-serif",
    outline: "none",
    transition: "border-color 0.15s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 7,
    fontSize: 11,
    fontWeight: 700,
    color: "#444",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    fontFamily: "'Cabinet Grotesk', sans-serif",
  };

  return (
    <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <label htmlFor="email" style={labelStyle}>Email</label>
        <input
          id="email" type="email" required autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@agence.com"
          style={inputStyle}
          onFocus={e => (e.currentTarget.style.borderColor = "#B8F028")}
          onBlur={e => (e.currentTarget.style.borderColor = "#1E1E1E")}
        />
      </div>

      <div>
        <label htmlFor="password" style={labelStyle}>Mot de passe</label>
        <input
          id="password" type="password" required autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          style={inputStyle}
          onFocus={e => (e.currentTarget.style.borderColor = "#B8F028")}
          onBlur={e => (e.currentTarget.style.borderColor = "#1E1E1E")}
        />
      </div>

      {error && (
        <p style={{
          fontSize: 13, color: "#FF4D3B",
          background: "rgba(255,77,59,0.08)", border: "1px solid rgba(255,77,59,0.15)",
          borderRadius: 6, padding: "9px 12px", fontFamily: "'Satoshi', sans-serif",
        }}>
          {error}
        </p>
      )}

      <button
        type="submit" disabled={loading}
        style={{
          width: "100%", padding: "14px", borderRadius: 8,
          background: "#B8F028", color: "#080808",
          fontSize: 14, fontWeight: 700, fontFamily: "'Cabinet Grotesk', sans-serif",
          border: "none", cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1, marginTop: 4,
          letterSpacing: "0.02em",
          transition: "transform 0.15s, opacity 0.15s",
        }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
      >
        {loading ? "Connexion…" : "Se connecter →"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#000000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Geometric decorations */}
      {/* Large circle — top right */}
      <div style={{
        position: "absolute", top: -120, right: -120,
        width: 400, height: 400, borderRadius: "50%",
        border: "1px solid #1A1A1A",
        pointerEvents: "none",
      }} />
      {/* Medium circle — bottom left */}
      <div style={{
        position: "absolute", bottom: -80, left: -80,
        width: 260, height: 260, borderRadius: "50%",
        border: "1px solid #1A1A1A",
        pointerEvents: "none",
      }} />
      {/* Acid dot */}
      <div style={{
        position: "absolute", top: "22%", right: "18%",
        width: 8, height: 8, borderRadius: "50%",
        background: "#B8F028",
        pointerEvents: "none",
      }} />
      {/* Small square */}
      <div style={{
        position: "absolute", bottom: "28%", left: "16%",
        width: 12, height: 12,
        border: "1px solid #2A2A2A",
        transform: "rotate(45deg)",
        pointerEvents: "none",
      }} />

      <div className="animate-in" style={{ width: "100%", maxWidth: 420 }}>
        {/* Hero title */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{
              fontFamily: "'Cabinet Grotesk', sans-serif",
              fontWeight: 900, fontSize: 28,
              letterSpacing: "-0.04em", lineHeight: 1,
              color: "#F0EFE9",
            }}>
              Kl<span style={{ color: "#B8F028" }}>ip</span>
            </span>
          </Link>

          <h1 style={{
            fontFamily: "'Gambetta', serif",
            fontWeight: 700,
            fontSize: 52,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            color: "#F0EFE9",
            marginTop: 28,
            marginBottom: 16,
          }}>
            L&apos;outil qui publie<br />
            pour <em style={{ fontStyle: "italic", color: "#B8F028" }}>vous</em>.
          </h1>

          <p style={{
            fontSize: 16,
            color: "#555",
            fontFamily: "'Satoshi', sans-serif",
            letterSpacing: "0.01em",
          }}>
            Créez. Publiez. Répétez.
          </p>
        </div>

        {/* Form card */}
        <div className="animate-in-delay-1" style={{
          background: "#111111",
          border: "1px solid #1E1E1E",
          borderRadius: 16,
          padding: 32,
        }}>
          <h2 style={{
            fontFamily: "'Cabinet Grotesk', sans-serif",
            fontWeight: 800, fontSize: 18,
            color: "#F0EFE9", marginBottom: 24,
            letterSpacing: "-0.01em",
          }}>
            Connexion
          </h2>
          <Suspense fallback={<div style={{ height: 200 }} />}>
            <LoginForm />
          </Suspense>
        </div>

        {/* Register link */}
        <p className="animate-in-delay-2" style={{
          marginTop: 20, textAlign: "center",
          fontSize: 13, fontFamily: "'Satoshi', sans-serif",
          color: "#444",
        }}>
          Pas encore de compte ?{" "}
          <Link href="/register" style={{ color: "#B8F028", textDecoration: "none", fontWeight: 600 }}>
            S&apos;inscrire
          </Link>
        </p>
      </div>
    </main>
  );
}
