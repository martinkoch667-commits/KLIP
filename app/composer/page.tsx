"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

interface WorkspaceCard {
  id: string;
  name: string;
  primary_color: string | null;
  logo_url: string | null;
  draftCount: number;
}

const WS_COLORS = ["#7B5CF5","#2FD79B","#C8732B","#5A86E8","#DD2A7B","#88B394","#E8A03A","#4A8DD4"];

export default function ComposerPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const { data: ws } = await supabase
        .from("workspaces")
        .select("id, name, primary_color, logo_url")
        .order("created_at");

      if (!ws) { setLoading(false); return; }

      const cards: WorkspaceCard[] = await Promise.all(
        ws.map(async (w) => {
          const { count } = await supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", w.id)
            .in("status", ["idle", "generated"]);
          return { ...w, draftCount: count ?? 0 };
        })
      );

      setWorkspaces(cards);
      setLoading(false);
    })();
  }, [supabase, router]);

  return (
    <div className="app">
      <Sidebar />
      <div className="work">
        <div className="topbar">
          <h1 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>Composer avec l&apos;IA</h1>
          <div style={{ marginLeft: "auto" }}>
            <Link href="/workspace/new" className="btn btn-sm btn-primary">+ Nouveau client</Link>
          </div>
        </div>

        <div className="scroll">
          {/* Hero block — outside .page, but padded to match laterals */}
          <div style={{ padding: "28px 34px 0" }}>
            <div style={{ position: "relative", background: "linear-gradient(150deg, #1b5e3a, #0c2a1d)", borderRadius: "var(--r-l)", padding: "28px 32px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {/* Glow blobs */}
              <div style={{ position: "absolute", top: -60, right: 60, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, var(--mint), transparent 70%)", opacity: .28, filter: "blur(24px)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: -60, right: -20, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, #C8F135, transparent 70%)", opacity: .14, filter: "blur(18px)", pointerEvents: "none" }} />

              {/* Left content */}
              <div style={{ position: "relative", zIndex: 1 }}>
                {/* Klip IA badge */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(47,215,155,.15)", borderRadius: 99, padding: "4px 10px", marginBottom: 14 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--mint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "var(--mint)", fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: ".08em" }}>Klip IA</span>
                </div>
                <h2 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 22, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                  Générer du contenu
                </h2>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,.55)", margin: 0, lineHeight: 1.5 }}>
                  Sélectionnez un client pour créer des posts IA.
                </p>
              </div>

              {/* Right: preview bars */}
              <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                <div style={{ width: 40, height: 7, borderRadius: 99, background: "rgba(255,255,255,.15)" }} />
                <div style={{ width: 60, height: 7, borderRadius: 99, background: "linear-gradient(90deg, var(--mint), #C8F135)" }} />
                <div style={{ width: 40, height: 7, borderRadius: 99, background: "rgba(255,255,255,.18)" }} />
              </div>
            </div>
          </div>

          <div className="page">
            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span className="label">Vos clients</span>
              <span className="chip">{workspaces.length}</span>
            </div>

            {loading ? (
              <div style={{ color: "var(--ink-3)", fontSize: 13 }}>Chargement…</div>
            ) : workspaces.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p style={{ color: "var(--ink-3)", marginBottom: 16 }}>Aucun client pour l&apos;instant.</p>
                <Link href="/workspace/new" className="btn btn-primary">+ Nouveau client</Link>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {workspaces.map((ws, i) => {
                  const color = ws.primary_color || WS_COLORS[i % WS_COLORS.length];
                  const initials = ws.name.slice(0, 2).toUpperCase();
                  return (
                    <Link key={ws.id} href={`/workspace/${ws.id}`} style={{ textDecoration: "none" }}>
                      <div
                        className="card"
                        style={{ padding: "16px 18px", overflow: "hidden", borderTop: `4px solid ${color}`, display: "flex", flexDirection: "column", gap: 10, cursor: "pointer", transition: "box-shadow .15s, transform .15s" }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-pop)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}
                      >
                        {/* Top row: avatar + name */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {ws.logo_url ? (
                            <img src={ws.logo_url} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "var(--mono)", flexShrink: 0 }}>
                              {initials}
                            </div>
                          )}
                          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", lineHeight: 1.3 }}>{ws.name}</span>
                        </div>
                        {/* Bottom row: draft badge + chevron */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: ws.draftCount > 0 ? "var(--warn)" : "var(--ink-3)", background: ws.draftCount > 0 ? "var(--warn-soft)" : "var(--sunk)", borderRadius: 99, padding: "3px 8px" }}>
                            {ws.draftCount > 0 ? `${ws.draftCount} brouillon${ws.draftCount > 1 ? "s" : ""}` : "Aucun brouillon"}
                          </span>
                          <svg style={{ color: "var(--ink-3)", flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6"/>
                          </svg>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
