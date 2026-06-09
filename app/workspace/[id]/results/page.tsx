"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";

interface Post {
  id: string;
  photo_url: string;
  exported_image_url: string | null;
  texte_visuel: string;
  description: string;
  status: string;
  created_at?: string;
}

interface Workspace {
  id: string;
  name: string;
  primary_color: string | null;
  secondary_color: string | null;
  font_family: string | null;
}

function loadGoogleFont(family: string) {
  const id = `gf-${family.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&display=swap`;
  document.head.appendChild(link);
}

function getImageUrl(post: Post): string {
  if (post.exported_image_url && post.exported_image_url.startsWith("https://")) {
    return post.exported_image_url;
  }
  return post.photo_url || "";
}

const STATUS_CFG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  generated:  { label: "À valider",  bg: "var(--warn-soft)",  color: "var(--warn)",   dot: "var(--warn)" },
  validated:  { label: "Validé",     bg: "var(--mint-soft)",  color: "var(--mint-2)", dot: "var(--mint-2)" },
  published:  { label: "Publié",     bg: "var(--mint)",       color: "var(--mint-ink)", dot: "var(--mint-ink)" },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, bg: "var(--sunk)", color: "var(--ink-3)", dot: "var(--ink-3)" };
  return (
    <span className="badge" style={{ background: cfg.bg, color: cfg.color, display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span className="dot" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function IconInstagram() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}
function IconCheck() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
}
function IconSettings() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>;
}
function IconEdit() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg>;
}
function IconCalendar() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>;
}
function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>;
}

export default function ResultsPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [posts, setPosts] = useState<Post[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "pending" | "scheduled">("all");
  const [validated, setValidated] = useState<Record<string, boolean>>({});
  const [showCanva, setShowCanva] = useState(false);
  const [canvaPostId, setCanvaPostId] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [{ data: ws }, { data: postsData }] = await Promise.all([
        supabase.from("workspaces").select("id, name, primary_color, secondary_color, font_family").eq("id", id).single(),
        supabase
          .from("posts")
          .select("id, photo_url, exported_image_url, texte_visuel, description, status, created_at")
          .eq("workspace_id", id)
          .in("status", ["generated", "validated", "published"])
          .order("created_at", { ascending: false }),
      ]);

      if (ws) {
        setWorkspace(ws);
        if (ws.font_family) loadGoogleFont(ws.font_family);
      }
      if (postsData) setPosts(postsData);
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  function updateDescription(postId: string, description: string) {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, description } : p)));
  }

  async function saveDescription(post: Post) {
    await supabase.from("posts").update({ description: post.description }).eq("id", post.id);
  }

  async function validatePost(post: Post) {
    await supabase.from("posts").update({ status: "validated" }).eq("id", post.id);
    setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, status: "validated" } : p));
    setValidated((v) => ({ ...v, [post.id]: true }));
  }

  async function deletePost(post: Post) {
    setOpenMenuId(null);
    if (!confirm("Supprimer ce post ? Cette action est irréversible.")) return;
    await supabase.from("posts").delete().eq("id", post.id);
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
  }

  // Filter posts by tab
  const filteredPosts = posts.filter((p) => {
    if (tab === "pending") return p.status === "generated";
    if (tab === "scheduled") return p.status === "validated" || p.status === "published";
    return true;
  });

  // Group by date
  const grouped: Record<string, Post[]> = {};
  filteredPosts.forEach((p) => {
    const date = p.created_at ? new Date(p.created_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "Sans date";
    (grouped[date] ||= []).push(p);
  });

  const counts = {
    all: posts.length,
    pending: posts.filter((p) => p.status === "generated").length,
    scheduled: posts.filter((p) => p.status === "validated" || p.status === "published").length,
  };

  const overlayBg = workspace?.primary_color ?? "#000000";
  const overlayText = workspace?.secondary_color ?? "#FFFFFF";
  const overlayFont = workspace?.font_family ?? "Inter";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--canvas)" }}>
      <Sidebar />
      <main style={{ marginLeft: "var(--sb-w)", flex: 1, overflowY: "auto" }}>
        <div className="page screen-in" style={{ maxWidth: 860 }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 24, flexWrap: "wrap" }}>
            <div>
              <div className="label" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => router.back()}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 4, padding: 0, fontSize: 12, fontWeight: 600, fontFamily: "var(--sans)" }}
                >
                  ← Retour
                </button>
                <span style={{ color: "var(--line)" }}>·</span>
                {workspace?.name}
              </div>
              <h1 className="h-display" style={{ fontSize: 30 }}>File de publication</h1>
            </div>
            <Link href={`/workspace/${id}`} className="btn btn-primary btn-sm">
              <IconPlus /> Nouveau post
            </Link>
          </div>

          {/* Instagram connection banner */}
          <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, marginBottom: 18, background: "var(--forest)", color: "var(--cream)", border: "none" }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)", display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}>
              <IconInstagram />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", gap: 8, color: "var(--cream)" }}>
                {workspace?.name ?? "Compte"} connecté
                <span className="badge" style={{ background: "var(--mint)", color: "var(--mint-ink)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <IconCheck /> Actif
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--cream-2)", marginTop: 2 }}>
                Klip publie automatiquement au créneau planifié. Aucune action requise.
              </div>
            </div>
            <Link href={`/workspace/${id}/parametres`} className="btn btn-sm" style={{ background: "rgba(244,243,236,0.12)", color: "var(--cream)", flexShrink: 0 }}>
              <IconSettings /> Gérer
            </Link>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div className="seg">
              {([["all", "Tout"], ["pending", "À valider"], ["scheduled", "Planifiés"]] as [string, string][]).map(([k, l]) => (
                <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k as typeof tab)}>
                  {l} <span style={{ opacity: 0.55 }}>{counts[k as keyof typeof counts]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", color: "var(--ink-3)" }}>
              Chargement…
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>
              <p style={{ marginBottom: 20, fontSize: 14 }}>Aucun post dans cette file.</p>
              <Link href={`/workspace/${id}`} className="btn btn-primary">Créer des posts</Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {Object.entries(grouped).map(([date, datePosts]) => (
                <div key={date}>
                  <div className="label" style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    <IconCalendar />
                    {date.charAt(0).toUpperCase() + date.slice(1)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {datePosts.map((post) => {
                      const imgUrl = getImageUrl(post);
                      const isPending = post.status === "generated";
                      return (
                        <div key={post.id} className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 14 }}>
                          {/* Thumbnail */}
                          <div style={{ width: 52, height: 65, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "var(--sunk)" }}>
                            {imgUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={imgUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: "100%", height: "100%", background: "var(--sunk)" }} />
                            )}
                          </div>

                          {/* Info */}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25, marginBottom: 4 }} className="trunc">
                              {post.texte_visuel || "Post sans titre"}
                            </div>
                            <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.3 }} className="trunc">
                              {post.description || <span style={{ color: "var(--ink-3)" }}>Aucune description</span>}
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            {isPending && !validated[post.id] ? (
                              <>
                                <a href={`/workspace/${params.id}/editor/${post.id}`} className="btn btn-ghost btn-sm">
                                  <IconEdit /> Voir
                                </a>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => validatePost(post)}
                                >
                                  <IconCheck /> Valider
                                </button>
                              </>
                            ) : (
                              <StatusChip status={validated[post.id] ? "validated" : post.status} />
                            )}
                            <div style={{ position: "relative" }}>
                              <button
                                className="btn btn-ghost btn-icon"
                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === post.id ? null : post.id); }}
                                title="Actions"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                              </button>
                              {openMenuId === post.id && (
                                <>
                                  <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setOpenMenuId(null)} />
                                  <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 10, background: "var(--white)", border: "1px solid var(--line)", borderRadius: "var(--r-s)", boxShadow: "var(--shadow-pop)", minWidth: 160, overflow: "hidden" }}>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setCanvaPostId(post.id); setShowCanva(true); }}
                                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", fontSize: 13, fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", color: "var(--ink)", textAlign: "left" }}
                                      onMouseEnter={e => (e.currentTarget.style.background = "var(--sunk)")}
                                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                    >
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg>
                                      Éditer avec Canva
                                    </button>
                                    <div style={{ height: 1, background: "var(--line)", margin: "0 8px" }} />
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deletePost(post); }}
                                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", fontSize: 13, fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", color: "var(--warn)", textAlign: "left" }}
                                      onMouseEnter={e => (e.currentTarget.style.background = "var(--warn-soft)")}
                                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                    >
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>
                                      Supprimer
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Canva modal */}
      {showCanva && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="card pop-in" style={{ width: "100%", maxWidth: 480, overflow: "hidden" }}>
            {/* Modal header */}
            <div style={{ background: "var(--forest)", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--display)", fontWeight: 900, fontSize: 20, letterSpacing: "-0.05em", color: "var(--cream)" }}>
                Kl<span style={{ color: "var(--mint)" }}>ip</span>
                <span style={{ color: "var(--cream-3)", fontWeight: 400, fontSize: 13 }}> × Canva Editor</span>
              </span>
              <button onClick={() => setShowCanva(false)} className="btn btn-ghost btn-sm" style={{ color: "var(--cream-2)" }}>
                Fermer
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: "28px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ padding: "10px 14px", background: "var(--sunk)", borderRadius: "var(--r-s)", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
                Ouvrez Canva, créez votre visuel, téléchargez en PNG puis uploadez-le ici.
              </div>
              <a
                href="https://www.canva.com/design?create&type=InstagramPost"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ justifyContent: "center", width: "100%" }}
              >
                Ouvrir Canva →
              </a>
              <label className="btn btn-dark" style={{ justifyContent: "center", width: "100%", cursor: "pointer" }}>
                Uploader mon PNG Canva
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const fileName = `${params.id}/${canvaPostId}-canva-${Date.now()}.png`;
                    await supabase.storage.from("exports").upload(fileName, file, { contentType: file.type, upsert: true });
                    const { data: urlData } = supabase.storage.from("exports").getPublicUrl(fileName);
                    await supabase.from("posts").update({ exported_image_url: urlData.publicUrl, status: "validated" }).eq("id", canvaPostId);
                    setShowCanva(false);
                    window.location.reload();
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
