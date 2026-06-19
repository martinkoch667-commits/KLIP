"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { useAccountType } from "@/hooks/useAccountType";

interface Workspace { id: string; name: string }
interface Post {
  id: string;
  workspace_id: string;
  exported_image_url: string | null;
  photo_url: string | null;
  thumbnail_url?: string | null;
  description: string | null;
  status: string;
  post_type: string | null;
  scheduled_at: string | null;
  created_at: string;
}

const WS_COLORS = ["#7B5CF5","#2FD79B","#C8732B","#5A86E8","#DD2A7B","#88B394","#E8A03A","#4A8DD4"];
const POST_TYPE_COLOR: Record<string, string> = { post:"#4F8EF7", reel:"#A259FF", story:"#FF6B35" };
const POST_TYPE_LABEL: Record<string, string> = { post:"Post", reel:"Reel", story:"Story" };

const COLUMNS = [
  { key: "pending",   label: "À valider",  statuses: ["generated","validated"], accentColor: "var(--warn)", accentBg: "var(--warn-soft)" },
  { key: "scheduled", label: "Programmés", statuses: ["scheduled"],             accentColor: "#4F8EF7",      accentBg: "rgba(79,142,247,.12)" },
  { key: "published", label: "Publiés",    statuses: ["published"],             accentColor: "var(--mint-2)", accentBg: "var(--mint-soft)" },
] as const;

export default function FeedPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filterWsId, setFilterWsId] = useState("all");
  const [loading, setLoading] = useState(true);
  const { isAgency } = useAccountType();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const [{ data: ws }, { data: ps }] = await Promise.all([
        supabase.from("workspaces").select("id,name").order("created_at"),
        supabase.from("posts")
          .select("id,workspace_id,exported_image_url,photo_url,thumbnail_url,description,status,post_type,scheduled_at,created_at")
          .in("status", ["generated","validated","scheduled","published"])
          .order("scheduled_at", { ascending: false, nullsFirst: false }),
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
    return new Date(iso).toLocaleDateString("fr-FR", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });
  }

  async function handleValidate(postId: string) {
    await supabase.from("posts").update({ status: "scheduled" }).eq("id", postId);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: "scheduled" } : p));
  }

  async function handleReject(postId: string) {
    await supabase.from("posts").update({ status: "rejected" }).eq("id", postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
  }

  function PostCard({ post, col }: { post: Post; col: typeof COLUMNS[number] }) {
    const ws = wsMap[post.workspace_id];
    const rawImg = post.exported_image_url || post.thumbnail_url || post.photo_url;
    const thumb = rawImg ? `/api/proxy-image?url=${encodeURIComponent(rawImg)}` : null;
    const pt = post.post_type ?? "post";
    const isPending = col.key === "pending";

    return (
      <div className="card" style={{ overflow:"hidden", display:"flex", flexDirection:"column" }}>
        {/* Thumbnail */}
        <div style={{ aspectRatio:"4/5", background:"var(--sunk)", position:"relative", overflow:"hidden", flexShrink:0 }}>
          {thumb
            ? <img src={thumb} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            : <div style={{ display:"grid", placeItems:"center", height:"100%", color:"var(--ink-3)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
              </div>}
          {/* Type badge */}
          <span style={{ position:"absolute", top:7, right:7, background: POST_TYPE_COLOR[pt] ?? "#4F8EF7", color:"#fff", fontSize:8, fontWeight:700, padding:"2px 5px", borderRadius:3, fontFamily:"var(--mono)" }}>
            {POST_TYPE_LABEL[pt] ?? pt}
          </span>
          {/* Instagram badge */}
          <span style={{ position:"absolute", top:7, left:7, background:"rgba(0,0,0,.5)", backdropFilter:"blur(4px)", borderRadius:4, padding:"3px 5px", display:"flex", alignItems:"center", gap:3 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="#fff" stroke="none"/></svg>
          </span>
        </div>

        {/* Body */}
        <div style={{ padding:"10px 12px 12px", display:"flex", flexDirection:"column", gap:8, flex:1 }}>
          {/* Client */}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:18, height:18, borderRadius:4, background: ws?.color ?? "var(--mint)", display:"grid", placeItems:"center", fontSize:8, fontWeight:800, color:"#fff", flexShrink:0 }}>
              {ws?.name?.slice(0,2).toUpperCase() ?? "??"}
            </span>
            <span style={{ fontSize:11, fontWeight:700, color:"var(--ink-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{ws?.name ?? "Client"}</span>
          </div>

          {/* Description */}
          {post.description && (
            <p style={{ fontSize:11.5, color:"var(--ink-2)", margin:0, lineHeight:1.4, overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
              {post.description}
            </p>
          )}

          {/* Date */}
          <div style={{ fontSize:10.5, color:"var(--ink-3)", fontWeight:600 }}>
            {formatDate(post.scheduled_at ?? post.created_at)}
          </div>

          {/* Actions */}
          {isPending && isAgency ? (
            <div style={{ display:"flex", gap:6, marginTop:"auto" }}>
              <button
                onClick={() => handleValidate(post.id)}
                className="btn btn-primary btn-sm"
                style={{ flex:1, fontSize:11 }}>
                Valider
              </button>
              <button
                onClick={() => handleReject(post.id)}
                className="btn btn-ghost btn-sm"
                style={{ fontSize:11, color:"#DC2626", borderColor:"rgba(220,38,38,.25)", flexShrink:0 }}>
                Refuser
              </button>
            </div>
          ) : (
            <Link href={`/workspace/${post.workspace_id}/editor/${post.id}`}
              className="btn btn-ghost btn-sm"
              style={{ textDecoration:"none", justifyContent:"center", fontSize:11, marginTop:"auto" }}>
              Éditer
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="work">
        <div className="topbar" style={{ justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <h1 style={{ fontSize:14, fontWeight:800, margin:0 }}>Fil de publication</h1>
            <span className="ws-topbar-link" style={{ fontSize:13, color:"var(--ink-3)", fontWeight:600 }}>{filtered.length} post{filtered.length !== 1 ? "s" : ""}</span>
          </div>
          <select value={filterWsId} onChange={e => setFilterWsId(e.target.value)}
            style={{ fontSize:12, fontWeight:600, border:"1px solid var(--line)", borderRadius:"var(--r-s)", padding:"5px 10px", background:"var(--sunk)", color:"var(--ink)", outline:"none" }}>
            <option value="all">Tous les clients</option>
            {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {/* Summary bar */}
        <div style={{ height:52, borderBottom:"1px solid var(--line)", padding:"0 28px", display:"flex", alignItems:"center", gap:16, background:"var(--sunk)", flexShrink:0 }}>
          {COLUMNS.map(col => {
            const count = posts.filter(p => col.statuses.includes(p.status as never)).length;
            return (
              <div key={col.key} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 12px", borderRadius:99, background: col.accentBg }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background: col.accentColor, flexShrink:0 }} />
                <span style={{ fontWeight:800, color: col.accentColor, fontSize:13, lineHeight:1 }}>{count}</span>
                <span style={{ fontSize:12, color:"var(--ink-2)", lineHeight:1 }}>{col.label}</span>
              </div>
            );
          })}
        </div>

        <div className="scroll">
          {loading ? (
            <div style={{ textAlign:"center", padding:"60px 0", color:"var(--ink-3)" }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"80px 20px", gap:20, minHeight:"calc(100vh - 116px)" }}>
              <div style={{ width:76, height:76, borderRadius:22, background:"var(--mint-soft)", border:"1px solid rgba(47,215,155,.2)", display:"grid", placeItems:"center", color:"var(--mint-2)" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 3L11 14M22 3l-7 19-4-8-8-4 19-7Z"/>
                </svg>
              </div>
              <div>
                <h2 style={{ fontFamily:"var(--display)", fontWeight:800, fontSize:24, color:"var(--ink)", marginBottom:8, letterSpacing:"-.02em" }}>Aucune publication en attente</h2>
                <p style={{ fontSize:14, color:"var(--ink-3)", maxWidth:360, lineHeight:1.6, margin:"0 auto" }}>Tout est à jour. Créez du nouveau contenu pour commencer à alimenter votre fil.</p>
              </div>
              <Link href="/composer" className="btn btn-primary" style={{ textDecoration:"none" }}>Composer du contenu</Link>
            </div>
          ) : (
            <div className="feed-kanban" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:0, height:"100%", minHeight:"calc(100vh - 64px)" }}>
              {COLUMNS.map((col, ci) => {
                const colPosts = filtered.filter(p => col.statuses.includes(p.status as never));
                return (
                  <div key={col.key} style={{ borderRight: ci < 2 ? "1px solid var(--line)" : "none", display:"flex", flexDirection:"column", overflow:"hidden" }}>
                    {/* Column header */}
                    <div style={{ padding:"16px 20px 13px", borderBottom:`3px solid ${col.accentColor}`, background:"var(--paper)", flexShrink:0, display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background: col.accentColor, flexShrink:0 }}/>
                      <span style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", color:"var(--ink-2)", fontFamily:"var(--mono)" }}>{col.label}</span>
                      <span style={{ marginLeft:"auto", fontSize:11, fontWeight:700, background: col.accentBg, color: col.accentColor, padding:"2px 7px", borderRadius:99 }}>{colPosts.length}</span>
                    </div>
                    {/* Scrollable cards */}
                    <div style={{ flex:1, overflowY:"auto", padding:"14px 14px 24px" }}>
                      {colPosts.length === 0 ? (
                        <div style={{ textAlign:"center", padding:"40px 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
                          <div style={{ width:40, height:40, borderRadius:12, background:"var(--sunk)", display:"grid", placeItems:"center", color:"var(--ink-3)" }}>
                            {col.key === "pending" && (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6 9 17l-5-5"/>
                              </svg>
                            )}
                            {col.key === "scheduled" && (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
                              </svg>
                            )}
                            {col.key === "published" && (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 3L11 14M22 3l-7 19-4-8-8-4 19-7Z"/>
                              </svg>
                            )}
                          </div>
                          <span style={{ fontSize:12, color:"var(--ink-3)", fontWeight:600 }}>Aucun post</span>
                        </div>
                      ) : (
                        <div className="feed-cards-grid" style={{ display:"flex", flexDirection:"column", gap:12 }}>
                          {colPosts.map(post => <PostCard key={post.id} post={post} col={col} />)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
