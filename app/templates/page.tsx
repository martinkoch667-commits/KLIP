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
        <div className="topbar" style={{ justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>Templates</h1>
          <Link href="/workspace/new" className="btn btn-primary btn-sm" style={{ textDecoration: "none", fontSize: 12 }}>
            + Nouveau client
          </Link>
        </div>

        <div className="scroll">
          <div className="page" style={{ maxWidth: 680 }}>
            {loading ? (
              <div style={{ color: "var(--ink-3)", fontSize: 13 }}>Chargement…</div>
            ) : workspaces.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p style={{ color: "var(--ink-3)", marginBottom: 16 }}>Aucun client pour l&apos;instant.</p>
                <Link href="/workspace/new" className="btn btn-primary">+ Nouveau client</Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {workspaces.map((ws, i) => {
                  const color = ws.primary_color || WS_COLORS[i % WS_COLORS.length];
                  const initials = ws.name.slice(0, 2).toUpperCase();
                  return (
                    <Link key={ws.id} href={`/workspace/${ws.id}/templates`} style={{ textDecoration: "none" }}>
                      <div
                        className="card"
                        style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "box-shadow .15s, transform .15s", borderLeft: `3px solid ${color}` }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-pop)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: "var(--mono)", flexShrink: 0 }}>
                          {initials}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{ws.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 1 }}>
                            {ws.templateCount > 0 ? `${ws.templateCount} template${ws.templateCount > 1 ? "s" : ""}` : "Aucun template"}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, background: ws.templateCount > 0 ? "rgba(79,142,247,.12)" : "var(--sunk)", color: ws.templateCount > 0 ? "#4F8EF7" : "var(--ink-3)", padding: "3px 9px", borderRadius: 99, flexShrink: 0 }}>
                          {ws.templateCount}
                        </span>
                        <svg style={{ color: "var(--ink-3)", flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
