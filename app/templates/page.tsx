"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

interface Workspace { id: string; name: string }
interface Template {
  id: string;
  name: string;
  workspace_id: string;
  thumbnail_url: string | null;
  format_id: string | null;
  background_style: { type:string; color?:string; colorFrom?:string; colorTo?:string; angle?:number } | null;
  created_at: string;
}

const WS_COLORS = ["#7B5CF5","#2FD79B","#C8732B","#5A86E8","#DD2A7B","#88B394","#E8A03A","#4A8DD4"];
const FORMAT_LABEL: Record<string, string> = {
  "ig-portrait": "Portrait 4:5",
  "ig-square": "Carré",
  "ig-story": "Story",
  "facebook": "Facebook",
};

export default function TemplatesPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filterWsId, setFilterWsId] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const [{ data: ws }, { data: tpls }] = await Promise.all([
        supabase.from("workspaces").select("id,name").order("created_at"),
        supabase.from("post_templates").select("*").order("created_at", { ascending:false }),
      ]);
      setWorkspaces(ws ?? []);
      setTemplates(tpls ?? []);
      setLoading(false);
    })();
  }, [supabase, router]);

  const wsMap = Object.fromEntries(workspaces.map((w,i) => [w.id, { name:w.name, color: WS_COLORS[i % WS_COLORS.length] }]));
  const filtered = filterWsId === "all" ? templates : templates.filter(t => t.workspace_id === filterWsId);

  function getBgStyle(t: Template): React.CSSProperties {
    const bg = t.background_style;
    if (!bg) return { background:"var(--sunk)" };
    if (bg.type === "gradient") return { background:`linear-gradient(${bg.angle ?? 135}deg, ${bg.colorFrom ?? "#0038FF"}, ${bg.colorTo ?? "#fff"})` };
    if (bg.type === "color") return { background: bg.color ?? "var(--sunk)" };
    return { background:"var(--sunk)" };
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="work">
        <div className="topbar" style={{ justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <h1 style={{ fontSize:17, fontWeight:800, fontFamily:"var(--display)", margin:0 }}>Templates</h1>
            <span style={{ fontSize:13, color:"var(--ink-3)", fontWeight:600 }}>{filtered.length} modèle{filtered.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <select value={filterWsId} onChange={e => setFilterWsId(e.target.value)}
              style={{ fontSize:12, fontWeight:600, border:"1px solid var(--line)", borderRadius:"var(--r-s)", padding:"5px 10px", background:"var(--sunk)", color:"var(--ink)", outline:"none" }}>
              <option value="all">Tous les clients</option>
              {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            {filterWsId !== "all" && (
              <Link href={`/workspace/${filterWsId}/templates`} className="btn btn-primary btn-sm">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                Nouveau template
              </Link>
            )}
          </div>
        </div>

        <div className="scroll">
          <div className="page">
            {loading ? (
              <div style={{ textAlign:"center", padding:"60px 0", color:"var(--ink-3)" }}>Chargement…</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign:"center", padding:"80px 0" }}>
                <div style={{ width:52, height:52, borderRadius:"var(--r-l)", background:"var(--sunk)", display:"grid", placeItems:"center", margin:"0 auto 16px", color:"var(--ink-3)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/></svg>
                </div>
                <div style={{ fontSize:15, fontWeight:700, color:"var(--ink)", marginBottom:6 }}>Aucun template</div>
                <div style={{ fontSize:13, color:"var(--ink-3)", marginBottom:20 }}>
                  Créez des modèles réutilisables depuis l&apos;espace client.
                </div>
                {workspaces.length > 0 && (
                  <Link href={`/workspace/${workspaces[0].id}/templates`} className="btn btn-primary">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                    Créer un template
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:16 }}>
                {filtered.map(tpl => {
                  const ws = wsMap[tpl.workspace_id];
                  return (
                    <div key={tpl.id} className="card" style={{ display:"flex", flexDirection:"column", overflow:"hidden" }}>
                      {/* Preview */}
                      <div style={{ aspectRatio:"4/5", position:"relative", overflow:"hidden", ...getBgStyle(tpl) }}>
                        {tpl.thumbnail_url
                          ? <img src={tpl.thumbnail_url} alt={tpl.name} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                          : (
                            <div style={{ display:"grid", placeItems:"center", height:"100%", opacity:.3 }}>
                              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/></svg>
                            </div>
                          )}
                        {/* Format badge */}
                        {tpl.format_id && (
                          <span style={{ position:"absolute", top:8, left:8, background:"rgba(0,0,0,.55)", backdropFilter:"blur(4px)", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:4, fontFamily:"var(--mono)", letterSpacing:".05em" }}>
                            {FORMAT_LABEL[tpl.format_id] ?? tpl.format_id}
                          </span>
                        )}
                      </div>
                      {/* Info */}
                      <div style={{ padding:"10px 12px 12px", display:"flex", flexDirection:"column", gap:8 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"var(--ink)", lineHeight:1.3 }}>{tpl.name}</div>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                            <span style={{ width:18, height:18, borderRadius:4, background: ws?.color ?? "var(--mint)", display:"grid", placeItems:"center", fontSize:8, fontWeight:800, color:"#fff" }}>
                              {ws?.name?.slice(0,2).toUpperCase() ?? "??"}
                            </span>
                            <span style={{ fontSize:11, color:"var(--ink-3)", fontWeight:600 }}>{ws?.name ?? "Client"}</span>
                          </div>
                        </div>
                        <Link href={`/workspace/${tpl.workspace_id}/templates`}
                          className="btn btn-ghost btn-sm" style={{ width:"100%", textDecoration:"none", textAlign:"center", justifyContent:"center" }}>
                          Utiliser
                        </Link>
                      </div>
                    </div>
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
