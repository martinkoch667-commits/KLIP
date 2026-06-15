"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

interface Workspace { id: string; name: string }
interface Post {
  id: string;
  workspace_id: string;
  exported_image_url: string | null;
  photo_url: string | null;
  texte_visuel: string | null;
  description: string | null;
  status: string;
  post_type: string | null;
  updated_at: string | null;
  created_at: string;
}

const WS_COLORS = ["#7B5CF5","#2FD79B","#C8732B","#5A86E8","#DD2A7B","#88B394","#E8A03A","#4A8DD4"];
const POST_TYPE_LABEL: Record<string, string> = { post:"Post", reel:"Reel", story:"Story" };
const POST_TYPE_COLOR: Record<string, string> = { post:"#4F8EF7", reel:"#A259FF", story:"#FF6B35" };

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  idle:       { label:"Brouillon",       bg:"var(--sunk)",      color:"var(--ink-3)" },
  generating: { label:"En génération",   bg:"var(--sunk)",      color:"var(--ink-3)" },
  generated:  { label:"Prêt à valider",  bg:"var(--warn-soft)", color:"var(--warn)" },
  validated:  { label:"En validation",   bg:"rgba(255,107,53,.14)", color:"#FF6B35" },
  rejected:   { label:"Refusé",          bg:"rgba(220,38,38,.12)", color:"#DC2626" },
};

export default function ComposerPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filterWsId, setFilterWsId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const [{ data: ws }, { data: ps }] = await Promise.all([
        supabase.from("workspaces").select("id,name").order("created_at"),
        supabase.from("posts")
          .select("id,workspace_id,exported_image_url,photo_url,texte_visuel,description,status,post_type,updated_at,created_at")
          .in("status", ["idle","generating","generated","validated","rejected"])
          .order("updated_at", { ascending: false, nullsFirst: false }),
      ]);
      setWorkspaces(ws ?? []);
      setPosts(ps ?? []);
      setLoading(false);
    })();
  }, [supabase, router]);

  const wsMap = Object.fromEntries(workspaces.map((w,i) => [w.id, { name: w.name, color: WS_COLORS[i % WS_COLORS.length] }]));
  const filtered = filterWsId === "all" ? posts : posts.filter(p => p.workspace_id === filterWsId);

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("fr-FR", { day:"numeric", month:"short" });
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="work">
        <div className="topbar" style={{ justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <h1 style={{ fontSize:14, fontWeight:800, margin:0 }}>Composer</h1>
            <span style={{ fontSize:13, color:"var(--ink-3)", fontWeight:600 }}>
              {filtered.length} brouillon{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <select value={filterWsId} onChange={e => setFilterWsId(e.target.value)}
              style={{ fontSize:12, fontWeight:600, border:"1px solid var(--line)", borderRadius:"var(--r-s)", padding:"5px 10px", background:"var(--sunk)", color:"var(--ink)", outline:"none" }}>
              <option value="all">Tous les clients</option>
              {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        </div>

        <div className="scroll">
          <div className="page">
            {loading ? (
              <div style={{ textAlign:"center", padding:"60px 0", color:"var(--ink-3)", fontSize:14 }}>Chargement…</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign:"center", padding:"80px 0" }}>
                <div style={{ width:52, height:52, borderRadius:"var(--r-l)", background:"var(--sunk)", display:"grid", placeItems:"center", margin:"0 auto 16px", color:"var(--ink-3)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M13.5 7.5l3 3"/></svg>
                </div>
                <div style={{ fontSize:15, fontWeight:700, color:"var(--ink)", marginBottom:6 }}>Aucun brouillon</div>
                <div style={{ fontSize:13, color:"var(--ink-3)", marginBottom:20 }}>Importez des visuels depuis un espace client pour commencer.</div>
                <Link href="/dashboard" className="btn btn-primary">Aller au tableau de bord</Link>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:16 }}>
                {filtered.map(post => {
                  const ws = wsMap[post.workspace_id];
                  const rawImg = post.exported_image_url || post.photo_url;
                  const thumb = rawImg ? `/api/proxy-image?url=${encodeURIComponent(rawImg)}` : null;
                  const pt = post.post_type ?? "post";
                  const cfg = STATUS_CFG[post.status] ?? { label: post.status, bg:"var(--sunk)", color:"var(--ink-3)" };
                  return (
                    <Link key={post.id} href={`/workspace/${post.workspace_id}/editor/${post.id}`}
                      className="card lift" style={{ textDecoration:"none", display:"flex", flexDirection:"column", overflow:"hidden", cursor:"pointer" }}>
                      {/* Thumbnail */}
                      <div style={{ aspectRatio:"4/5", background:"var(--sunk)", position:"relative", overflow:"hidden" }}>
                        {thumb
                          ? <img src={thumb} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                          : <div style={{ display:"grid", placeItems:"center", height:"100%", color:"var(--ink-3)" }}>
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                            </div>}
                        {/* Type badge */}
                        <span style={{ position:"absolute", bottom:8, right:8, background: POST_TYPE_COLOR[pt] ?? "#4F8EF7", color:"#fff", fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:4, fontFamily:"var(--mono)" }}>
                          {POST_TYPE_LABEL[pt] ?? pt}
                        </span>
                      </div>
                      {/* Info */}
                      <div style={{ padding:"11px 13px 13px", display:"flex", flexDirection:"column", gap:7, flex:1 }}>
                        {/* Client badge */}
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ width:20, height:20, borderRadius:5, background: ws?.color ?? "var(--mint)", display:"grid", placeItems:"center", fontSize:9, fontWeight:800, color:"#fff", flexShrink:0 }}>
                            {ws?.name?.slice(0,2).toUpperCase() ?? "??"}
                          </span>
                          <span style={{ fontSize:12, fontWeight:700, color:"var(--ink-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ws?.name ?? "Client"}</span>
                        </div>
                        {post.texte_visuel && (
                          <p style={{ fontSize:12, fontWeight:600, color:"var(--ink)", margin:0, lineHeight:1.4, overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
                            {post.texte_visuel}
                          </p>
                        )}
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:"auto" }}>
                          <span style={{ fontSize:11, color:"var(--ink-3)" }}>{formatDate(post.updated_at ?? post.created_at)}</span>
                          <span style={{ fontSize:10, fontWeight:700, background: cfg.bg, color: cfg.color, padding:"2px 7px", borderRadius:4, fontFamily:"var(--mono)" }}>
                            {cfg.label}
                          </span>
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
