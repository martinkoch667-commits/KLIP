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
      setError(error.message === "Invalid login credentials" ? "Email ou mot de passe incorrect." : error.message);
      setLoading(false);
      return;
    }
    const redirect = searchParams.get("redirect") ?? "/dashboard";
    router.push(redirect);
    router.refresh();
  }

  return (
    <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <label htmlFor="email" className="label" style={{ display: "block", marginBottom: 7 }}>Email</label>
        <input
          id="email" type="email" required autoComplete="email"
          value={email} onChange={e => setEmail(e.target.value)}
          placeholder="vous@agence.com"
          className="input"
          style={{ height: 44 }}
        />
      </div>
      <div>
        <label htmlFor="password" className="label" style={{ display: "block", marginBottom: 7 }}>Mot de passe</label>
        <input
          id="password" type="password" required autoComplete="current-password"
          value={password} onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          className="input"
          style={{ height: 44 }}
        />
      </div>

      {error && (
        <p style={{
          fontSize: 13, color: "var(--warn)",
          background: "var(--warn-soft)", border: "1px solid rgba(200,115,43,.2)",
          borderRadius: "var(--r-s)", padding: "9px 12px",
        }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary"
        style={{ width: "100%", padding: "13px", fontSize: 14.5, marginTop: 4, opacity: loading ? 0.6 : 1 }}
      >
        {loading ? "Connexion…" : "Se connecter →"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", background: "var(--canvas)" }}>

      {/* Left panel — forest */}
      <div style={{
        width: "42%", minHeight: "100vh",
        background: "var(--forest)",
        display: "flex", flexDirection: "column",
        padding: "48px 52px",
        position: "relative", overflow: "hidden",
        flexShrink: 0,
      }}>
        {/* Halo blobs */}
        <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", right: -80, top: -100, background: "radial-gradient(circle, var(--mint), transparent 70%)", opacity: 0.18, filter: "blur(30px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", left: 40, bottom: -80, background: "radial-gradient(circle, var(--acid), transparent 70%)", opacity: 0.2, filter: "blur(20px)", pointerEvents: "none" }} />

        {/* Logo */}
        <div style={{ position: "relative", zIndex: 2, marginBottom: "auto" }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            <img src="/logo-klip-mint.png" alt="Klip" style={{ height: 48, width: "auto" }} />
          </Link>
        </div>

        {/* Tagline */}
        <div style={{ position: "relative", zIndex: 2, marginTop: "auto" }}>
          <h1 className="h-display" style={{ fontSize: 42, color: "var(--cream)", marginBottom: 16, lineHeight: 1.05 }}>
            Créez.<br />
            Publiez.<br />
            <span className="it" style={{ color: "var(--mint)" }}>Répétez.</span>
          </h1>
          <p style={{ color: "var(--cream-2)", fontSize: 15, lineHeight: 1.6, maxWidth: 340 }}>
            L'outil pour agences qui gèrent plusieurs marques sur Instagram — contenu IA, calendrier, publication automatique.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{
        flex: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "48px 40px",
      }}>
        <div className="animate-in" style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ marginBottom: 36 }}>
            <div className="label" style={{ marginBottom: 10 }}>Bienvenue</div>
            <h2 className="h-display" style={{ fontSize: 32, color: "var(--ink)", marginBottom: 8 }}>
              Connexion
            </h2>
            <p style={{ color: "var(--ink-2)", fontSize: 14 }}>
              Pas encore de compte ?{" "}
              <Link href="/register" style={{ color: "var(--mint-2)", fontWeight: 700 }}>
                S'inscrire
              </Link>
            </p>
          </div>

          <div className="card" style={{ padding: 28 }}>
            <Suspense fallback={<div style={{ height: 200 }} />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
