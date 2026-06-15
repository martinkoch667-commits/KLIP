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
  description: string | null;
  status: string;
  post_type: string | null;
  scheduled_at: string | null;
  created_at: string;
}

const WS_COLORS = ["#7B5CF5","#2FD79B","#C8732B","#5A86E8","#DD2A7B","#88B394","#E8A03A","#4A8DD4"];
const STATUS_CFG: Record<string, { label:string; bg:string; color:string }> = {
  scheduled:  { label:"Programmé",    bg:"var(--warn-soft)",  color:"var(--warn)" },
  validated:  { label:"Validé",       bg:"var(--mint-soft)",  color:"var(--mint-2)" },
  published:  { label:"Publié",       bg:"var(--mint)",       color:"var(--mint-ink)" },
};
const POST_TYPE_COLOR: Record<string, string> = { post:"#4F8EF7", reel:"#A259FF", story:"#FF6B35" };
const POST_TYPE_LABEL: Record<string, string> = { post:"Post", reel:"Reel", story:"Story" };

export default function FeedPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filterWsId, setFilterWsId] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const [{ data: ws }, { data: ps }] = await Promise.all([
        supabase.from("workspaces").select("id,name").order("created_at"),
        supabase.from("posts")
          .select("id,workspace_id,exported_image_url,photo_url,description,status,post_type,scheduled_at,created_at")
          .in("status", ["validated","scheduled","published"])
          .order("scheduled_at", { ascending: false, nullsFirst: false }),
      ]);
      setWorkspaces(ws ?? []);
      setPosts(ps ?? []);
      setLoading(false);
    })();
  }, [supabase, router]);

  const wsMap = Object.fromEntries(workspaces.map((w,i) => [w.id, { name:w.name, color: WS_COLORS[i % WS_COLORS.length] }]));
  const filtered = posts
    .filter(p => filterWsId === "all" || p.workspace_id === filterWsId)
    .filter(p => filterStatus === "all" || p.status === filterStatus);

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("fr-FR", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="work">
        <div className="topbar" style={{ justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <h1 style={{ fontSize:17, fontWeight:800, fontFamily:"var(--display)", margin:0 }}>Fil de publication</h1>
            <span style={{ fontSize:13, color:"var(--ink-3)", fontWeight:600 }}>{filtered.length} post{filtered.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <select value={filterWsId} onChange={e => setFilterWsId(e.target.value)}
              style={{ fontSize:12, fontWeight:600, border:"1px solid var(--line)", borderRadius:"var(--r-s)", padding:"5px 10px", background:"var(--sunk)", color:"var(--ink)", outline:"none" }}>
              <option value="all">Tous les clients</option>
              {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ fontSize:12, fontWeight:600, border:"1px solid var(--line)", borderRadius:"var(--r-s)", padding:"5px 10px", background:"var(--sunk)", color:"var(--ink)", outline:"none" }}>
              <option value="all">Tous les statuts</option>
              <option value="validated">Validé</option>
              <option value="scheduled">Programmé</option>
              <option value="published">Publié</option>
            </select>
          </div>
        </div>

        <div className="scroll">
          <div className="page">
            {loading ? (
              <div style={{ textAlign:"center", padding:"60px 0", color:"var(--ink-3)" }}>Chargement…</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign:"center", padding:"80px 0" }}>
                <div style={{ width:52, height:52, borderRadius:"var(--r-l)", background:"var(--sunk)", display:"grid", placeItems:"center", margin:"0 auto 16px", color:"var(--ink-3)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3L11 14M22 3l-7 19-4-8-8-4 19-7Z"/></svg>
                </div>
                <div style={{ fontSize:15, fontWeight:700, color:"var(--ink)", marginBottom:6 }}>Aucune publication</div>
                <div style={{ fontSize:13, color:"var(--ink-3)" }}>Les posts validés et programmés apparaîtront ici.</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {filtered.map(post => {
                  const ws = wsMap[post.workspace_id];
                  const rawImg = post.exported_image_url || post.photo_url;
                  const thumb = rawImg ? `/api/proxy-image?url=${encodeURIComponent(rawImg)}` : null;
                  const cfg = STATUS_CFG[post.status] ?? { label:post.status, bg:"var(--sunk)", color:"var(--ink-3)" };
                  const pt = post.post_type ?? "post";
                  return (
                    <div key={post.id} className="card" style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 16px" }}>
                      {/* Thumbnail */}
                      <div style={{ width:52, height:64, borderRadius:8, overflow:"hidden", flexShrink:0, background:"var(--sunk)" }}>
                        {thumb
                          ? <img src={thumb} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                          : <div style={{ display:"grid", placeItems:"center", height:"100%", color:"var(--ink-3)" }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
                            </div>}
                      </div>
                      {/* Workspace */}
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0, width:130 }}>
                        <span style={{ width:24, height:24, borderRadius:6, background: ws?.color ?? "var(--mint)", display:"grid", placeItems:"center", fontSize:9, fontWeight:800, color:"#fff", flexShrink:0 }}>
                          {ws?.name?.slice(0,2).toUpperCase() ?? "??"}
                        </span>
                        <span style={{ fontSize:12, fontWeight:700, color:"var(--ink)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ws?.name ?? "Client"}</span>
                      </div>
                      {/* Description */}
                      <p style={{ flex:1, fontSize:13, color:"var(--ink-2)", margin:0, overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", lineHeight:1.4 }}>
                        {post.description ?? "—"}
                      </p>
                      {/* Type */}
                      <span style={{ fontSize:10, fontWeight:700, color:"#fff", background: POST_TYPE_COLOR[pt] ?? "#4F8EF7", padding:"2px 6px", borderRadius:4, flexShrink:0, fontFamily:"var(--sans)" }}>
                        {POST_TYPE_LABEL[pt] ?? pt}
                      </span>
                      {/* Date */}
                      <span style={{ fontSize:12, color:"var(--ink-3)", flexShrink:0, minWidth:130, textAlign:"right" }}>
                        {formatDate(post.scheduled_at)}
                      </span>
                      {/* Status */}
                      <span style={{ fontSize:11, fontWeight:700, background: cfg.bg, color: cfg.color, padding:"3px 9px", borderRadius:99, flexShrink:0 }}>
                        {cfg.label}
                      </span>
                      {/* Actions */}
                      <Link href={`/workspace/${post.workspace_id}/editor/${post.id}`}
                        className="btn btn-ghost btn-sm" style={{ flexShrink:0, textDecoration:"none" }}>
                        Editer
                      </Link>
                      <Link href={`/workspace/${post.workspace_id}/planning`}
                        className="btn btn-primary btn-sm" style={{ flexShrink:0, textDecoration:"none" }}>
                        Planning
                      </Link>
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
