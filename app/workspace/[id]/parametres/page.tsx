"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";
import { resetOnboardingTour } from "@/components/OnboardingTour";

const ERROR_MESSAGES: Record<string, string> = {
  cancelled:    "Connexion annulée.",
  token:        "Échec de l'échange de token Meta. Réessayez.",
  no_pages:     "Aucune page Facebook trouvée. Vérifiez vos permissions.",
  no_instagram: "Aucun compte Instagram Business lié à vos pages Facebook.",
  unknown:      "Une erreur est survenue lors de la connexion.",
};

interface Workspace {
  id: string;
  name: string;
  instagram_account_id: string | null;
  instagram_username: string | null;
  facebook_page_id: string | null;
}

function IconInstagram() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}
function IconFacebook() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}
function IconCheck() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
}
function IconTrash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>;
}
function IconArrow() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg>;
}

function ParametresContent() {
  const params = useParams();
  const id = params.id as string;
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const connected = searchParams.get("connected") === "true";
  const errorKey = searchParams.get("error");
  const errorMsg = errorKey ? (ERROR_MESSAGES[errorKey] ?? ERROR_MESSAGES.unknown) : null;

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("workspaces")
        .select("id, name, instagram_account_id, instagram_username, facebook_page_id")
        .eq("id", id)
        .single();
      if (data) setWorkspace(data);
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  async function handleDisconnect() {
    if (!confirm("Déconnecter Instagram de ce workspace ?")) return;
    setDisconnecting(true);
    await supabase.from("workspaces").update({
      instagram_account_id: null,
      instagram_access_token: null,
      instagram_username: null,
      facebook_page_id: null,
    }).eq("id", id);
    setWorkspace((prev) => prev ? {
      ...prev,
      instagram_account_id: null,
      instagram_username: null,
      facebook_page_id: null,
    } : null);
    setDisconnecting(false);
  }

  const isInstagramConnected = !!(workspace?.instagram_account_id || workspace?.instagram_username);

  return (
    <main style={{ marginLeft: "var(--sb-w)", flex: 1, overflowY: "auto" }}>
      <div className="page screen-in" style={{ maxWidth: 680 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 28, flexWrap: "wrap" }}>
          <div>
            <div className="label" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <Link href={`/workspace/${id}`} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", textDecoration: "none", fontSize: 12, fontWeight: 600, fontFamily: "var(--sans)" }}>
                ← Retour
              </Link>
              <span style={{ color: "var(--line)" }}>·</span>
              {workspace?.name ?? "…"}
            </div>
            <h1 className="h-display" style={{ fontSize: 30 }}>Paramètres</h1>
          </div>
        </div>

        {/* Success banner */}
        {connected && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: "var(--r-s)", background: "var(--mint-soft)", border: "1px solid rgba(47,215,155,.25)", marginBottom: 20 }}>
            <span style={{ color: "var(--mint-2)", display: "flex" }}><IconCheck /></span>
            <span style={{ fontSize: 13, color: "var(--mint-2)", fontWeight: 600 }}>Compte Instagram connecté avec succès.</span>
          </div>
        )}

        {/* Error banner */}
        {errorMsg && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: "var(--r-s)", background: "var(--warn-soft)", border: "1px solid rgba(200,115,43,.25)", marginBottom: 20 }}>
            <span style={{ color: "var(--warn)", fontSize: 14 }}>!</span>
            <span style={{ fontSize: 13, color: "var(--warn)", fontWeight: 600 }}>{errorMsg}</span>
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", color: "var(--ink-3)", fontSize: 14 }}>
            Chargement…
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* ── Section: Réseaux sociaux ── */}
            <section>
              <div style={{ marginBottom: 16 }}>
                <h2 className="h-title" style={{ fontSize: 16, marginBottom: 4 }}>Réseaux sociaux</h2>
                <p style={{ color: "var(--ink-2)", fontSize: 13 }}>Connectez vos comptes pour publier directement depuis Klip.</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Instagram row */}
                <div className="card" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)",
                    display: "grid", placeItems: "center",
                  }}>
                    <IconInstagram />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 2 }}>Instagram</div>
                    {isInstagramConnected ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="badge" style={{ background: "var(--mint-soft)", color: "var(--mint-2)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span className="dot" style={{ background: "var(--mint-2)" }} /> Connecté
                        </span>
                        <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>
                          @{workspace?.instagram_username ?? workspace?.instagram_account_id}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Non connecté</span>
                    )}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {isInstagramConnected ? (
                      <button
                        onClick={handleDisconnect}
                        disabled={disconnecting}
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--warn)", borderColor: "rgba(200,115,43,.3)", opacity: disconnecting ? 0.5 : 1 }}
                      >
                        <IconTrash /> {disconnecting ? "…" : "Déconnecter"}
                      </button>
                    ) : (
                      <a href={`/api/auth/meta/connect?workspaceId=${id}`} className="btn btn-dark btn-sm">
                        Connecter Instagram <IconArrow />
                      </a>
                    )}
                  </div>
                </div>

                {/* Facebook row */}
                <div className="card" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: "#1877F2",
                    display: "grid", placeItems: "center",
                  }}>
                    <IconFacebook />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 2 }}>Facebook</div>
                    {workspace?.facebook_page_id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="badge" style={{ background: "var(--mint-soft)", color: "var(--mint-2)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span className="dot" style={{ background: "var(--mint-2)" }} /> Connecté
                        </span>
                        <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>
                          Page {workspace.facebook_page_id}
                        </span>
                      </div>
                    ) : isInstagramConnected ? (
                      <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Connecté via Instagram</span>
                    ) : (
                      <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Non connecté</span>
                    )}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {!isInstagramConnected ? (
                      <a href={`/api/auth/meta/connect?workspaceId=${id}`} className="btn btn-sm" style={{ background: "#1877F2", color: "#fff" }}>
                        Connecter Facebook <IconArrow />
                      </a>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600, padding: "6px 10px" }}>Actif</span>
                    )}
                  </div>
                </div>
              </div>

              {!isInstagramConnected && (
                <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 10, lineHeight: 1.5 }}>
                  La connexion Instagram nécessite un compte Instagram Business lié à une page Facebook.
                </p>
              )}
            </section>

            {/* ── Section: Informations ── */}
            <section>
              <div style={{ marginBottom: 16 }}>
                <h2 className="h-title" style={{ fontSize: 16, marginBottom: 4 }}>Informations</h2>
              </div>
              <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Nom du client</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", padding: "10px 14px", background: "var(--sunk)", borderRadius: "var(--r-s)" }}>
                    {workspace?.name}
                  </div>
                </div>
                <div>
                  <Link href={`/workspace/${id}/style`} className="btn btn-primary btn-sm">
                    Modifier le style visuel <IconArrow />
                  </Link>
                </div>
              </div>
            </section>

            {/* ── Section: Aide & Tutoriel ── */}
            <section>
              <div style={{ marginBottom: 16 }}>
                <h2 className="h-title" style={{ fontSize: 16, marginBottom: 4 }}>Aide &amp; Tutoriel</h2>
                <p style={{ color: "var(--ink-2)", fontSize: 13 }}>Relancez le tutoriel de démarrage à tout moment.</p>
              </div>
              <div className="card" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: "var(--sunk)", display: "grid", placeItems: "center", color: "var(--ink-2)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 2 }}>Tutoriel de démarrage</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Revoir les fonctionnalités principales de Klip.</div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    resetOnboardingTour();
                    window.location.href = "/dashboard";
                  }}
                >
                  Revoir le tutoriel
                </button>
              </div>
            </section>

            {/* ── Section: Danger zone ── */}
            <section>
              <div className="card" style={{ padding: "18px 20px", borderColor: "rgba(200,115,43,.25)" }}>
                <div style={{ marginBottom: 14 }}>
                  <h2 className="h-title" style={{ fontSize: 15, marginBottom: 4, color: "var(--warn)" }}>Zone de danger</h2>
                  <p style={{ fontSize: 13, color: "var(--ink-2)" }}>Ces actions sont irréversibles.</p>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--warn)", borderColor: "rgba(200,115,43,.3)" }}
                  onClick={async () => {
                    if (!confirm(`Supprimer le workspace "${workspace?.name}" et tous ses posts ?`)) return;
                    await supabase.from("workspaces").delete().eq("id", id);
                    window.location.href = "/dashboard";
                  }}
                >
                  <IconTrash /> Supprimer ce workspace
                </button>
              </div>
            </section>

          </div>
        )}
      </div>
    </main>
  );
}

export default function ParametresPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--canvas)" }}>
      <Sidebar />
      <Suspense fallback={
        <div style={{ marginLeft: "var(--sb-w)", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", fontSize: 14 }}>
          Chargement…
        </div>
      }>
        <ParametresContent />
      </Suspense>
    </div>
  );
}
