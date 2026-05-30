"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";

// ─── Error messages ───────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  cancelled:     "Connexion annulée.",
  token:         "Échec de l'échange de token Meta. Réessayez.",
  no_pages:      "Aucune page Facebook trouvée. Vérifiez vos permissions.",
  no_instagram:  "Aucun compte Instagram Business lié à vos pages Facebook.",
  unknown:       "Une erreur est survenue lors de la connexion.",
};

// ─── Workspace type ───────────────────────────────────────────────────────────

interface Workspace {
  id: string;
  name: string;
  instagram_account_id: string | null;
  instagram_username: string | null;
  instagram_access_token: string | null;
  facebook_page_id: string | null;
}

// ─── Content (needs Suspense for useSearchParams) ─────────────────────────────

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
        .select("id, name, instagram_account_id, instagram_username, instagram_access_token, facebook_page_id")
        .eq("id", id)
        .single();
      if (data) setWorkspace(data);
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  async function handleDisconnect() {
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

  const isInstagramConnected = !!(workspace?.instagram_account_id || workspace?.instagram_access_token || workspace?.instagram_username);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-[#E0E0E0] bg-white">
        <div>
          <h1 className="font-syne font-extrabold text-xl text-black leading-none">
            {workspace?.name ?? "…"}
          </h1>
          <p className="text-xs font-inter text-[#888] mt-0.5">Paramètres du workspace</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/workspace/${id}`} className="px-4 py-2 rounded border border-[#E0E0E0] text-sm font-inter font-bold text-black hover:border-black transition-colors">
            Retour
          </Link>
        </div>
      </header>

      <main className="flex-1 px-8 py-8 max-w-2xl">

        {/* Success banner */}
        {connected && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded bg-green-50 border border-green-200">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#16a34a" strokeWidth="1.5"/><path d="M5 8l2.5 2.5 4-4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <p className="text-sm font-inter font-medium text-green-700">
              Compte Instagram connecté avec succès.
            </p>
          </div>
        )}

        {/* Error banner */}
        {errorMsg && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded bg-red-50 border border-red-200">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.5"/><path d="M8 5v4M8 11h.01" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <p className="text-sm font-inter font-medium text-red-700">{errorMsg}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin w-5 h-5 text-[#CCC]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
            </svg>
          </div>
        ) : (
          <div className="space-y-8">

            {/* ── Réseaux sociaux ── */}
            <section>
              <h2 className="font-syne font-bold text-base text-black mb-1">Réseaux sociaux</h2>
              <p className="text-sm font-inter text-[#888] mb-5">
                Connectez vos comptes pour publier directement depuis Klip.
              </p>

              <div className="space-y-3">
                {/* Instagram */}
                <div className="flex items-center justify-between p-4 rounded border border-[#E0E0E0] bg-white">
                  <div className="flex items-center gap-3">
                    {/* Instagram gradient icon */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-inter font-bold text-black">Instagram</p>
                      {isInstagramConnected ? (
                        <p className="text-xs font-inter text-green-600 mt-0.5">
                          Connecté · @{workspace?.instagram_username ?? workspace?.instagram_account_id}
                        </p>
                      ) : (
                        <p className="text-xs font-inter text-[#888] mt-0.5">Non connecté</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isInstagramConnected ? (
                      <button
                        onClick={handleDisconnect}
                        disabled={disconnecting}
                        className="px-4 py-2 rounded border border-red-200 text-xs font-inter font-bold text-red-500 hover:border-red-400 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {disconnecting ? "…" : "Déconnecter"}
                      </button>
                    ) : (
                      <a
                        href={`/api/auth/meta/connect?workspaceId=${id}`}
                        className="px-4 py-2 rounded bg-black text-white text-xs font-inter font-bold hover:bg-black/80 transition-colors"
                      >
                        Connecter Instagram
                      </a>
                    )}
                  </div>
                </div>

                {/* Facebook */}
                <div className="flex items-center justify-between p-4 rounded border border-[#E0E0E0] bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1877F2] flex items-center justify-center shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-inter font-bold text-black">Facebook</p>
                      {workspace?.facebook_page_id ? (
                        <p className="text-xs font-inter text-green-600 mt-0.5">
                          Connecté · Page {workspace.facebook_page_id}
                        </p>
                      ) : (
                        <p className="text-xs font-inter text-[#888] mt-0.5">
                          Connecté via Instagram
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isInstagramConnected ? (
                      <a
                        href={`/api/auth/meta/connect?workspaceId=${id}`}
                        className="px-4 py-2 rounded bg-[#1877F2] text-white text-xs font-inter font-bold hover:bg-[#1877F2]/90 transition-colors"
                      >
                        Connecter Facebook
                      </a>
                    ) : (
                      <span className="px-4 py-2 text-xs font-inter text-[#888]">
                        Connecté
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!isInstagramConnected && (
                <p className="text-xs font-inter text-[#AAA] mt-3">
                  La connexion Instagram nécessite un compte Instagram Business lié à une page Facebook.
                </p>
              )}
            </section>

            {/* ── Workspace name ── */}
            <section>
              <h2 className="font-syne font-bold text-base text-black mb-4">Informations</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-inter font-medium text-[#888] uppercase tracking-wider mb-1.5">Nom du client</p>
                  <p className="text-sm font-inter text-black bg-[#F5F5F5] border border-[#E0E0E0] rounded px-3.5 py-2.5">
                    {workspace?.name}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Link
                    href={`/workspace/${id}/style`}
                    className="px-5 py-2.5 rounded bg-acid text-black text-sm font-inter font-bold hover:bg-acid/90 transition-colors"
                  >
                    Modifier le style visuel
                  </Link>
                </div>
              </div>
            </section>

          </div>
        )}
      </main>
    </div>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function ParametresPage() {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center">
          <svg className="animate-spin w-5 h-5 text-[#CCC]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
          </svg>
        </div>
      }>
        <ParametresContent />
      </Suspense>
    </div>
  );
}
