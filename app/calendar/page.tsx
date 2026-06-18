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
  scheduled_at: string | null;
  exported_image_url: string | null;
  photo_url: string | null;
  description: string | null;
  post_type: string | null;
  status: string;
}

const WS_COLORS = ["#7B5CF5","#2FD79B","#C8732B","#5A86E8","#DD2A7B","#88B394","#E8A03A","#4A8DD4"];
const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAY_NAMES   = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const POST_TYPE_COLOR: Record<string, string> = { post:"#4F8EF7", reel:"#A259FF", story:"#FF6B35" };
const POST_TYPE_LABEL: Record<string, string> = { post:"Post", reel:"Reel", story:"Story" };

function startOfWeek(d: Date) {
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - day);
  dt.setHours(0,0,0,0);
  return dt;
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export default function CalendarPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filterWsId, setFilterWsId] = useState<string>("all");
  const [calView, setCalView] = useState<"week"|"month">("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [monthDate, setMonthDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const [{ data: ws }, { data: ps }] = await Promise.all([
        supabase.from("workspaces").select("id,name").order("created_at"),
        supabase.from("posts").select("id,workspace_id,scheduled_at,exported_image_url,photo_url,description,post_type,status")
          .not("scheduled_at","is",null).order("scheduled_at"),
      ]);
      setWorkspaces(ws ?? []);
      setPosts(ps ?? []);
    })();
  }, [supabase, router]);

  const wsMap = Object.fromEntries(workspaces.map((w,i) => [w.id, { name: w.name, color: WS_COLORS[i % WS_COLORS.length] }]));
  const filtered = filterWsId === "all" ? posts : posts.filter(p => p.workspace_id === filterWsId);

  const byDay: Record<string, Post[]> = {};
  filtered.forEach(p => {
    if (!p.scheduled_at) return;
    const ymd = p.scheduled_at.slice(0,10);
    (byDay[ymd] = byDay[ymd] || []).push(p);
  });

  const weekDays = Array.from({length:7}, (_,i) => { const d = new Date(weekStart); d.setDate(d.getDate()+i); return d; });

  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstDow = (monthStart.getDay()+6)%7;
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 0).getDate();
  const totalCells = Math.ceil((firstDow + daysInMonth)/7)*7;
  const monthCells = Array.from({length:totalCells}, (_,i) => {
    const offset = i - firstDow;
    if (offset < 0 || offset >= daysInMonth) return null;
    return new Date(monthDate.getFullYear(), monthDate.getMonth(), offset+1);
  });

  function navWeek(dir: number) { const d = new Date(weekStart); d.setDate(d.getDate()+7*dir); setWeekStart(startOfWeek(d)); }
  function navMonth(dir: number) { const d = new Date(monthDate); d.setMonth(d.getMonth()+dir); d.setDate(1); setMonthDate(d); }

  const today = toYMD(new Date());

  function PostPill({ p, compact = false }: { p: Post; compact?: boolean }) {
    const ws = wsMap[p.workspace_id];
    const rawImg = p.exported_image_url || p.photo_url;
    const thumb = rawImg ? `/api/proxy-image?url=${encodeURIComponent(rawImg)}` : null;
    const pt = p.post_type ?? "post";
    const time = p.scheduled_at ? new Date(p.scheduled_at).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" }) : null;

    return (
      <Link href={`/workspace/${p.workspace_id}/editor/${p.id}`}
        style={{ display:"flex", alignItems:"center", gap:5, background: ws?.color ?? "var(--mint)", borderRadius:6, padding: compact ? "3px 5px" : "5px 7px", textDecoration:"none", marginBottom:2, overflow:"hidden", boxShadow: compact ? "none" : "0 1px 3px rgba(0,0,0,.15)" }}>
        {!compact && thumb && (
          <img src={thumb} alt="" style={{ width:20, height:20, borderRadius:3, objectFit:"cover", flexShrink:0 }}/>
        )}
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }}>
            <span style={{ fontSize:9, fontWeight:800, color:"#fff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:compact?60:90 }}>{ws?.name ?? "Client"}</span>
            <span style={{ fontSize:8, fontWeight:700, color:"rgba(255,255,255,.75)", background:"rgba(0,0,0,.18)", borderRadius:3, padding:"1px 4px", flexShrink:0 }}>
              {POST_TYPE_LABEL[pt] ?? pt}
            </span>
          </div>
          {!compact && time && (
            <span style={{ fontSize:8, color:"rgba(255,255,255,.7)", fontWeight:600 }}>{time}</span>
          )}
        </div>
      </Link>
    );
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="work">
        <div className="topbar" style={{ justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <h1 style={{ fontSize:14, fontWeight:800, margin:0 }}>Calendrier</h1>
            <select value={filterWsId} onChange={e => setFilterWsId(e.target.value)}
              style={{ fontSize:12, fontWeight:600, border:"1px solid var(--line)", borderRadius:"var(--r-s)", padding:"5px 10px", background:"var(--sunk)", color:"var(--ink)", outline:"none" }}>
              <option value="all">Tous les clients</option>
              {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="ws-topbar-link" style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div className="seg">
              {(["week","month"] as const).map(v => (
                <button key={v} onClick={() => setCalView(v)} className={calView===v?"on":""}>
                  {v==="week" ? "Semaine" : "Mois"}
                </button>
              ))}
            </div>
            <button onClick={() => calView==="week" ? navWeek(-1) : navMonth(-1)} className="btn btn-ghost btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
            </button>
            <span style={{ fontSize:13, fontWeight:700, color:"var(--ink)", minWidth:160, textAlign:"center" }}>
              {calView==="week"
                ? `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${MONTH_NAMES[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`
                : `${MONTH_NAMES[monthDate.getMonth()]} ${monthDate.getFullYear()}`}
            </span>
            <button onClick={() => calView==="week" ? navWeek(1) : navMonth(1)} className="btn btn-ghost btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
            </button>
            <button onClick={() => { setWeekStart(startOfWeek(new Date())); setMonthDate(new Date(new Date().getFullYear(),new Date().getMonth(),1)); }}
              className="btn btn-ghost btn-sm">Aujourd&apos;hui</button>
          </div>
        </div>

        {/* Mini stat banner */}
        <div className="ws-topbar-link" style={{ height:44, background:"var(--sunk)", borderBottom:"1px solid var(--line)", padding:"0 28px", display:"flex", alignItems:"center", gap:20, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            <span style={{ fontSize:13, fontWeight:700, color:"var(--ink-2)" }}>
              {posts.length} post{posts.length !== 1 ? "s" : ""} ce mois
            </span>
          </div>
        </div>

        <div className="scroll">
          <div className="cal-outer" style={{ padding:"24px 28px" }}>
            {calView === "week" ? (
              <div style={{ display:"grid", gridTemplateColumns:`60px repeat(7, 1fr)`, border:"1px solid var(--line)", borderRadius:"var(--r-l)", overflow:"hidden", background:"var(--card)" }}>
                {/* Header */}
                <div style={{ background:"var(--sunk)", borderBottom:"1px solid var(--line)" }}/>
                {weekDays.map(d => {
                  const ymd = toYMD(d);
                  const isToday = ymd === today;
                  const count = (byDay[ymd] ?? []).length;
                  return (
                    <div key={ymd} style={{ padding:"10px 8px", borderBottom:"1px solid var(--line)", borderLeft:"1px solid var(--line)", background: isToday ? "rgba(12,42,29,.06)" : "var(--sunk)", textAlign:"center" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"var(--ink-3)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:4 }}>{DAY_NAMES[(d.getDay()+6)%7]}</div>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                        <div style={{ width:28, height:28, borderRadius:"50%", background: isToday ? "var(--forest)" : "transparent", color: isToday ? "var(--cream)" : "var(--ink)", fontWeight:800, fontSize:14, display:"grid", placeItems:"center" }}>{d.getDate()}</div>
                        {count > 0 && <span style={{ fontSize:9, fontWeight:800, color:"var(--mint-2)", background:"var(--mint-soft)", borderRadius:99, padding:"1px 5px" }}>{count}</span>}
                      </div>
                    </div>
                  );
                })}
                {/* Time gutter */}
                <div style={{ borderRight:"1px solid var(--line)" }}>
                  {[9,10,11,12,13,14,15,16,17,18].map(h => (
                    <div key={h} style={{ height:64, borderBottom:"1px solid var(--line-2)", display:"flex", alignItems:"flex-start", paddingTop:4, justifyContent:"center" }}>
                      <span style={{ fontSize:10, color:"var(--ink-3)", fontWeight:700, fontFamily:"var(--mono)" }}>{h}h</span>
                    </div>
                  ))}
                </div>
                {/* Day columns */}
                {weekDays.map(d => {
                  const ymd = toYMD(d);
                  const dayPosts = byDay[ymd] ?? [];
                  return (
                    <div key={ymd} style={{ borderLeft:"1px solid var(--line)", position:"relative" }}>
                      {[9,10,11,12,13,14,15,16,17,18].map(h => (
                        <div key={h} style={{ height:64, borderBottom:"1px solid var(--line-2)" }}/>
                      ))}
                      <div style={{ position:"absolute", top:4, left:4, right:4, display:"flex", flexDirection:"column", gap:2 }}>
                        {dayPosts.map(p => <PostPill key={p.id} p={p} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ border:"1px solid var(--line)", borderRadius:"var(--r-l)", overflow:"hidden", background:"var(--card)" }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:"1px solid var(--line)", background:"var(--sunk)" }}>
                  {DAY_NAMES.map(d => (
                    <div key={d} style={{ padding:"10px 0", textAlign:"center", fontSize:11, fontWeight:700, color:"var(--ink-3)", textTransform:"uppercase", letterSpacing:".08em" }}>{d}</div>
                  ))}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)" }}>
                  {monthCells.map((d, i) => {
                    if (!d) return <div key={i} style={{ minHeight:100, borderRight:"1px solid var(--line-2)", borderBottom:"1px solid var(--line-2)", background:"var(--sunk)", opacity:.5 }}/>;
                    const ymd = toYMD(d);
                    const dayPosts = byDay[ymd] ?? [];
                    const isToday = ymd === today;
                    return (
                      <div key={ymd} style={{ minHeight:100, borderRight:"1px solid var(--line-2)", borderBottom:"1px solid var(--line-2)", padding:"6px 7px", boxShadow: isToday ? "inset 0 0 0 2px var(--forest)" : "none" }}>
                        <span style={{ width:22, height:22, borderRadius:"50%", background: isToday ? "var(--forest)" : "transparent", color: isToday ? "var(--cream)" : "var(--ink)", fontWeight:800, fontSize:12, display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:5 }}>{d.getDate()}</span>
                        <div style={{ display:"flex", flexDirection:"column" }}>
                          {dayPosts.slice(0,3).map(p => <PostPill key={p.id} p={p} compact />)}
                          {dayPosts.length > 3 && <span style={{ fontSize:9, color:"var(--ink-3)", fontWeight:700, marginTop:2 }}>+{dayPosts.length-3}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
