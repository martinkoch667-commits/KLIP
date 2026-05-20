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
  if (post.exported_image_url && post.exported_image_url.startsWith('https://')) {
    return post.exported_image_url;
  }
  return post.photo_url || '';
}

export default function ResultsPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [posts, setPosts] = useState<Post[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCanva, setShowCanva] = useState(false);
  const [canvaPostId, setCanvaPostId] = useState('');

  useEffect(() => {
    async function load() {
      const [{ data: ws }, { data: postsData }] = await Promise.all([
        supabase.from("workspaces").select("id, name, primary_color, secondary_color, font_family").eq("id", id).single(),
        supabase
          .from("posts")
          .select("id, photo_url, exported_image_url, texte_visuel, description, status")
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

  // Overlay style from workspace brand
  const overlayBg = workspace?.primary_color ?? "#000000";
  const overlayText = workspace?.secondary_color ?? "#FFFFFF";
  const overlayFont = workspace?.font_family ?? "Inter";

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#0A0A0A', fontFamily:'Satoshi,sans-serif' }}>
      <Sidebar />

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, marginLeft:240 }}>
        {/* Topbar */}
        <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 32px', borderBottom:'1px solid #1E1E1E' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button
              onClick={() => router.back()}
              style={{ width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, border:'1px solid #2A2A2A', background:'transparent', cursor:'pointer' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7l5 5" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div>
              <h1 style={{ fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:700, fontSize:18, color:'#F0EFE9', lineHeight:1 }}>Résultats générés</h1>
              <p style={{ fontSize:12, color:'#555', marginTop:3 }}>
                {loading ? "Chargement…" : `${posts.length} post${posts.length > 1 ? "s" : ""} prêt${posts.length > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <Link
            href={`/workspace/${id}`}
            style={{ padding:'8px 16px', borderRadius:8, background:'#B8F028', color:'#000', fontSize:13, fontWeight:700, textDecoration:'none', fontFamily:'Cabinet Grotesk,sans-serif' }}
          >
            + Nouveau post
          </Link>
        </header>

        <main style={{ flex:1, padding:'32px' }}>
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'96px 0' }}>
              <svg className="animate-spin w-6 h-6" style={{ color:'#444' }} viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
              </svg>
            </div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign:'center', padding:'96px 0' }}>
              <p style={{ fontSize:14, color:'#444', marginBottom:20 }}>Aucun post généré pour ce workspace.</p>
              <Link
                href={`/workspace/${id}`}
                style={{ display:'inline-flex', padding:'11px 24px', borderRadius:8, background:'#B8F028', color:'#000', fontSize:14, fontWeight:700, textDecoration:'none', fontFamily:'Cabinet Grotesk,sans-serif' }}
              >
                Créer des posts
              </Link>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
              {posts.map((post) => (
                <div key={post.id} style={{ display:'flex', flexDirection:'column', borderRadius:10, border:'1px solid #1E1E1E', overflow:'hidden', background:'#111' }}>

                  {/* Visual: exported final image OR raw photo + overlay */}
                  <div style={{ position:'relative', width:'100%', aspectRatio:'4/5', overflow:'hidden' }}>
                    {post.exported_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.exported_image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={post.photo_url || ''} alt="" className="w-full h-full object-cover" />
                        {post.texte_visuel && (
                          <div className="absolute bottom-3 left-3 right-3">
                            <div
                              style={{
                                backgroundColor: overlayBg,
                                display: "inline-block",
                                padding: "8px 12px",
                                borderRadius: "4px",
                              }}
                            >
                              <p
                                style={{
                                  fontFamily: `"${overlayFont}", sans-serif`,
                                  color: overlayText,
                                  fontWeight: 700,
                                  fontSize: "14px",
                                  textTransform: "uppercase",
                                  lineHeight: 1.2,
                                  margin: 0,
                                }}
                              >
                                {post.texte_visuel}
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Status badge */}
                    {post.status === "published" && (
                      <div className="absolute top-2 right-2">
                        <span className="inline-flex px-2 py-0.5 rounded bg-acid text-black text-[11px] font-inter font-bold">
                          Planifié
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ display:'flex', flexDirection:'column', gap:10, padding:12 }}>
                    <textarea
                      value={post.description}
                      onChange={(e) => updateDescription(post.id, e.target.value)}
                      onBlur={() => saveDescription(post)}
                      rows={5}
                      placeholder="Description Instagram…"
                      style={{ width:'100%', borderRadius:8, border:'1px solid #2A2A2A', background:'#161616', padding:'8px 12px', fontSize:12, color:'#888', resize:'none', outline:'none', fontFamily:'Satoshi,sans-serif' }}
                    />

                    <div style={{ display:'flex', gap:8, marginTop:12 }}>
                      <a href={`/workspace/${params.id}/editor/${post.id}`}
                        style={{ flex:1, textAlign:'center', background:'transparent', border:'1px solid #2A2A2A', color:'#F0EFE9', padding:'10px 0', borderRadius:8, textDecoration:'none', fontSize:13, fontFamily:'Satoshi,sans-serif' }}>
                        ✏️ Éditer
                      </a>
                      <button onClick={() => { setCanvaPostId(post.id); setShowCanva(true); }}
                        style={{ flex:1, background:'#B8F028', color:'#000', border:'none', padding:'10px 0', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13, fontFamily:'Cabinet Grotesk,sans-serif' }}>
                        ✦ Éditer avec Canva
                      </button>
                    </div>
                    <Link
                      href={`/workspace/${id}/planning?post=${post.id}`}
                      style={{ display:'flex', padding:'8px', borderRadius:8, border:'1px solid #1E1E1E', background:'transparent', color:'#555', fontSize:12, fontWeight:700, textDecoration:'none', alignItems:'center', justifyContent:'center', fontFamily:'Cabinet Grotesk,sans-serif' }}
                    >
                      Planifier
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── Canva modal ── */}
      {showCanva && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:1000, display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 24px', background:'#000', borderBottom:'1px solid #1E1E1E', flexShrink:0 }}>
            <span style={{ fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:900, fontSize:18, color:'#F0EFE9' }}>
              Kl<span style={{ color:'#B8F028' }}>ip</span> <span style={{ color:'#444', fontWeight:400, fontSize:14 }}>× Canva Editor</span>
            </span>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <label style={{ background:'#B8F028', color:'#000', fontWeight:700, padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontFamily:'Cabinet Grotesk,sans-serif' }}>
                ⬆ Uploader le PNG exporté
                <input type="file" accept="image/png,image/jpeg" style={{ display:'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const fileName = `${params.id}/${canvaPostId}-canva-${Date.now()}.png`;
                    await supabase.storage.from('exports').upload(fileName, file, { contentType: file.type, upsert: true });
                    const { data: urlData } = supabase.storage.from('exports').getPublicUrl(fileName);
                    await supabase.from('posts').update({ exported_image_url: urlData.publicUrl, status: 'validated' }).eq('id', canvaPostId);
                    setShowCanva(false);
                    window.location.reload();
                  }}
                />
              </label>
              <button onClick={() => setShowCanva(false)}
                style={{ background:'transparent', border:'1px solid #2A2A2A', color:'#888', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:13 }}>
                Fermer
              </button>
            </div>
          </div>
          <div style={{ background:'#111', padding:'8px 24px', fontSize:12, color:'#555', borderBottom:'1px solid #1E1E1E' }}>
            ℹ Créez votre visuel dans Canva ci-dessous → Téléchargez-le en PNG → Uploadez-le avec le bouton en haut à droite
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0A0A' }}>
            <div style={{ textAlign: 'center', maxWidth: 480, padding: 40 }}>
              <div style={{ fontSize: 64, marginBottom: 24 }}>✦</div>
              <h2 style={{ fontFamily: 'Cabinet Grotesk,sans-serif', fontSize: 28, fontWeight: 800, color: '#F0EFE9', marginBottom: 12, letterSpacing: '-0.03em' }}>
                Créez votre visuel dans Canva
              </h2>
              <p style={{ color: '#666', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
                Canva ne permet pas l'intégration directe. Ouvrez Canva dans un nouvel onglet, créez votre visuel, téléchargez-le en PNG, puis uploadez-le ici.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <a href="https://www.canva.com/design?create&type=InstagramPost" target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', background: '#B8F028', color: '#000', fontWeight: 700, padding: '14px 24px', borderRadius: 10, textDecoration: 'none', fontFamily: 'Cabinet Grotesk,sans-serif', fontSize: 15 }}>
                  Ouvrir Canva →
                </a>
                <label style={{ display: 'block', background: '#111', border: '1px solid #2A2A2A', color: '#F0EFE9', fontWeight: 600, padding: '14px 24px', borderRadius: 10, cursor: 'pointer', fontFamily: 'Cabinet Grotesk,sans-serif', fontSize: 15 }}>
                  ⬆ Uploader mon PNG Canva
                  <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fileName = `${params.id}/${canvaPostId}-canva-${Date.now()}.png`;
                      await supabase.storage.from('exports').upload(fileName, file, { contentType: file.type, upsert: true });
                      const { data: urlData } = supabase.storage.from('exports').getPublicUrl(fileName);
                      await supabase.from('posts').update({ exported_image_url: urlData.publicUrl, status: 'validated' }).eq('id', canvaPostId);
                      setShowCanva(false);
                      window.location.reload();
                    }}
                  />
                </label>
              </div>
              <div style={{ marginTop: 32, padding: '16px 20px', background: '#111', borderRadius: 8, border: '1px solid #1E1E1E' }}>
                <p style={{ color: '#555', fontSize: 13, lineHeight: 1.6 }}>
                  💡 <strong style={{ color: '#888' }}>Workflow :</strong> Ouvrir Canva → Créer le visuel → Fichier → Télécharger → PNG → Uploader ici
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
