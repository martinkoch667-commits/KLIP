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
  templateCount: number;
}

const WS_COLORS = ["#7B5CF5","#2FD79B","#C8732B","#5A86E8","#DD2A7B","#88B394","#E8A03A","#4A8DD4"];

export default function TemplatesPage() {
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
        .select("id, name, primary_color")
        .order("created_at");

      if (!ws) { setLoading(false); return; }

      const cards: WorkspaceCard[] = await Promise.all(
        ws.map(async (w) => {
          const { count } = await supabase
            .from("post_templates")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", w.id);
          return { ...w, templateCount: count ?? 0 };
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
          <h1 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>Templates</h1>
        </div>

        <div className="scroll">
          <div className="page">
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 28, color: "var(--ink)", marginBottom: 6, letterSpacing: "-0.02em" }}>
                Sélectionner un client
              </h2>
              <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                Choisissez le client pour gérer ses templates visuels.
              </p>
            </div>

            {loading ? (
              <div style={{ color: "var(--ink-3)", fontSize: 13 }}>Chargement…</div>
            ) : workspaces.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p style={{ color: "var(--ink-3)", marginBottom: 16 }}>Aucun client pour l&apos;instant.</p>
                <Link href="/workspace/new" className="btn btn-primary">+ Nouveau client</Link>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {workspaces.map((ws, i) => {
                  const color = ws.primary_color || WS_COLORS[i % WS_COLORS.length];
                  const initials = ws.name.slice(0, 2).toUpperCase();
                  return (
                    <Link key={ws.id} href={`/workspace/${ws.id}/templates`} style={{ textDecoration: "none" }}>
                      <div
                        className="card"
                        style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "box-shadow .15s, transform .15s" }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-pop)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}
                      >
                        <div style={{ width: 46, height: 46, borderRadius: 12, background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff", fontFamily: "var(--mono)", flexShrink: 0 }}>
                          {initials}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 3 }}>{ws.name}</div>
                          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                            {ws.templateCount > 0 ? `${ws.templateCount} template${ws.templateCount > 1 ? "s" : ""}` : "Aucun template"}
                          </div>
                        </div>
                        <svg style={{ color: "var(--ink-3)", flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
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
