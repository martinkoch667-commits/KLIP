"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

type PostStatus = "idle" | "generating" | "generated" | "validating" | "validated";

interface PostItem {
  localId: string;        // always present
  dbId?: string;          // set once saved to Supabase
  file?: File;            // present for locally-selected (not yet uploaded) photos
  photo_url: string;      // object URL or Supabase public URL
  exported_image_url?: string | null;
  brief: string;
  description: string;
  texte_visuel: string;
  status: PostStatus;
  error?: string;
  created_at?: string;
}

interface Workspace {
  id: string;
  name: string;
  logo_url: string | null;
  brand_voice_prompt: string | null;
  company_description: string | null;
  description_style: string | null;
  caption_examples: string | null;
}

// ─── Badge ────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  idle:       { label: "Brouillon",  cls: "bg-[#F0F0F0] text-[#888]" },
  generating: { label: "Génération…", cls: "bg-blue-50 text-blue-500" },
  generated:  { label: "Généré",     cls: "bg-blue-50 text-blue-600" },
  validating: { label: "Sauvegarde…", cls: "bg-yellow-50 text-yellow-600" },
  validated:  { label: "Validé",     cls: "bg-acid text-black" },
};

function Badge({ status }: { status: PostStatus }) {
  const { label, cls } = STATUS_BADGE[status] ?? STATUS_BADGE.idle;
  return <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-inter font-bold ${cls}`}>{label}</span>;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "produire" | "parametres";

export default function WorkspacePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("produire");
  const [generatingAll, setGeneratingAll] = useState(false);
  const [globalBrief, setGlobalBrief] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [includeStyle, setIncludeStyle] = useState(true);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [referenceImage, setReferenceImage] = useState('');
  const [workspaceName, setWorkspaceName] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // File input ref — placed outside the drop zone to avoid any click conflicts
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load DB posts on mount ─────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, name, logo_url, brand_voice_prompt, company_description, description_style, caption_examples")
      .eq("id", id)
      .single();

    if (ws) { setWorkspace(ws); setWorkspaceName(ws.name); }

    const { data: dbPosts } = await supabase
      .from("posts")
      .select("id, photo_url, exported_image_url, brief, description, texte_visuel, status, created_at")
      .eq("workspace_id", id)
      .order("created_at", { ascending: false });

    if (dbPosts) {
      setPosts(dbPosts.map((p) => ({
        localId: p.id,
        dbId: p.id,
        photo_url: p.photo_url ?? "",
        exported_image_url: p.exported_image_url ?? null,
        brief: p.brief ?? "",
        description: p.description ?? "",
        texte_visuel: p.texte_visuel ?? "",
        status: (p.status === "generated" ? "generated" : p.status === "validated" ? "validated" : "idle") as PostStatus,
        created_at: p.created_at,
      })));
    }
  }, [id, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── File selection — show immediately, no Supabase yet ────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newItems: PostItem[] = files
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        localId: crypto.randomUUID(),
        file,
        photo_url: URL.createObjectURL(file),
        brief: "",
        description: "",
        texte_visuel: "",
        status: "idle" as PostStatus,
      }));

    setPosts((prev) => [...newItems, ...prev]);
    // Reset input so the same file can be re-selected if needed
    e.target.value = "";
  }

  // ── Brief ──────────────────────────────────────────────────────────────────

  function updateBrief(localId: string, brief: string) {
    setPosts((prev) => prev.map((p) => (p.localId === localId ? { ...p, brief } : p)));
  }

  async function saveBrief(item: PostItem) {
    if (!item.dbId) return; // not in DB yet — will be saved on validate
    await supabase.from("posts").update({ brief: item.brief }).eq("id", item.dbId);
  }

  // ── Generate ───────────────────────────────────────────────────────────────

  async function generateOne(item: PostItem): Promise<void> {
    if (!item.brief.trim() || item.status === "generating") return;

    console.log("[Klip] Génération démarrée pour:", item.brief);
    setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "generating", error: undefined } : p)));

    try {
      // Only pass photoUrl if it's a Supabase public URL (not a local blob)
      const photoUrl = item.photo_url.startsWith("http") ? item.photo_url : undefined;
      const combinedBrief = globalBrief.trim()
        ? `CONSIGNES GLOBALES : ${globalBrief}\n\nINFOS SPÉCIFIQUES À CE POST : ${item.brief}`
        : item.brief;
      const res = await fetch("/api/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: combinedBrief,
          photoUrl,
          brandVoicePrompt: workspace?.brand_voice_prompt ?? undefined,
          companyDescription: workspace?.company_description ?? undefined,
          descriptionStyle: workspace?.description_style ?? undefined,
          captionExamples: workspace?.caption_examples ?? undefined,
        }),
      });

      console.log("[Klip] Status API:", res.status);
      const data = await res.json();
      console.log("[Klip] Résultat API:", data);

      if (res.ok && (data.texte_visuel || data.description)) {
        const texte_visuel = data.texte_visuel ?? "";
        const description = data.description ?? "";

        let dbId = item.dbId;
        let photoUrl = item.photo_url;

        if (!dbId) {
          // Upload photo to Storage if it's a local file
          if (item.file) {
            const ext = item.file.name.split(".").pop();
            const path = `${id}/${crypto.randomUUID()}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from("photos")
              .upload(path, item.file, { upsert: true });
            if (!uploadError) {
              const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
              photoUrl = urlData.publicUrl;
            }
          }
          // Insert new post into Supabase
          const { data: post } = await supabase
            .from("posts")
            .insert({
              workspace_id: id,
              photo_url: photoUrl,
              brief: item.brief,
              texte_visuel,
              description,
              status: "generated",
            })
            .select()
            .single();
          if (post) dbId = post.id;
        } else {
          await supabase.from("posts").update({ texte_visuel, description, status: "generated" }).eq("id", dbId);
        }

        setPosts((prev) =>
          prev.map((p) =>
            p.localId === item.localId
              ? { ...p, dbId, photo_url: photoUrl, texte_visuel, description, status: "generated", error: undefined }
              : p
          )
        );
      } else {
        const errMsg = data?.error
          ? (typeof data.error === "string" ? data.error : JSON.stringify(data.error))
          : `Erreur ${res.status}`;
        console.error("[Klip] Échec génération:", errMsg);
        setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "idle", error: errMsg } : p)));
      }
    } catch (err) {
      console.error("[Klip] Erreur réseau:", err);
      setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "idle", error: "Erreur réseau" } : p)));
    }
  }

  async function generateAll() {
    const toGenerate = posts.filter((p) => p.brief.trim() && p.status === "idle");
    if (!toGenerate.length) return;
    setGeneratingAll(true);
    await Promise.all(toGenerate.map(generateOne));
    setGeneratingAll(false);
    router.push(`/workspace/${id}/results`);
  }

  // ── Validate — upload to Storage if needed, then save to DB ───────────────

  async function validatePost(item: PostItem) {
    if (item.status === "validating") return;

    setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "validating" } : p)));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let photoUrl = item.photo_url;
      let dbId = item.dbId;

      // Upload photo to Storage if it's a local file
      if (item.file) {
        const ext = item.file.name.split(".").pop();
        const path = `${id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("photos")
          .upload(path, item.file, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
          photoUrl = urlData.publicUrl;
        }
      }

      if (!dbId) {
        // Insert new post
        const { data: post } = await supabase
          .from("posts")
          .insert({
            workspace_id: id,
            photo_url: photoUrl,
            brief: item.brief,
            description: item.description,
            texte_visuel: item.texte_visuel,
            status: "validated",
          })
          .select()
          .single();

        if (post) dbId = post.id;
      } else {
        // Update existing
        await supabase
          .from("posts")
          .update({ description: item.description, texte_visuel: item.texte_visuel, status: "validated" })
          .eq("id", dbId);
      }

      setPosts((prev) =>
        prev.map((p) =>
          p.localId === item.localId
            ? { ...p, dbId, photo_url: photoUrl, status: "validated" }
            : p
        )
      );

      // Navigate to editor
      if (dbId) {
        window.location.href = `/workspace/${id}/editor/${dbId}`;
      }
    } catch {
      setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "generated" } : p)));
    }
  }

  // ── Remove ─────────────────────────────────────────────────────────────────

  async function removePost(item: PostItem) {
    setPosts((prev) => prev.filter((p) => p.localId !== item.localId));
    if (item.dbId) {
      await supabase.from("posts").delete().eq("id", item.dbId);
    }
  }

  // ── AI image generation ────────────────────────────────────────────────────

  const handleGenerateImage = async () => {
    console.log('Génération démarrée:', imagePrompt);
    if (!imagePrompt.trim()) { alert('Écris un prompt'); return; }
    setGeneratingImage(true);
    try {
      const fullPrompt = includeStyle && workspace
        ? `${imagePrompt}. Style : couleurs ${(workspace as any).primary_color || '#000'} et ${(workspace as any).secondary_color || '#fff'}. Format portrait 4:5, qualité professionnelle.`
        : `${imagePrompt}. Format portrait 4:5, qualité professionnelle.`;
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, referenceImage: referenceImage || null }),
      });
      const data = await res.json();
      console.log('Résultat:', data);
      if (data.images?.length > 0) setGeneratedImages(data.images);
      else alert('Erreur : ' + (data.error || 'Aucune image'));
    } catch (err: unknown) {
      alert('Erreur : ' + (err instanceof Error ? err.message : 'inconnue'));
    }
    setGeneratingImage(false);
  };

  const addGeneratedImageToSession = async (imageUrl: string) => {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const file = new File([blob], `generated-${Date.now()}.png`, { type: 'image/png' });
    const fileName = `${id}/generated-${Date.now()}.png`;
    await supabase.storage.from('photos').upload(fileName, file, { upsert: true });
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName);
    setPosts(prev => [...prev, {
      localId: crypto.randomUUID(),
      photo_url: urlData.publicUrl,
      brief: imagePrompt,
      description: '',
      texte_visuel: '',
      status: 'idle' as PostStatus,
    }]);
  };

  // ── Settings ───────────────────────────────────────────────────────────────

  async function saveSettings() {
    if (!workspaceName.trim()) return;
    setSavingSettings(true);
    await supabase.from("workspaces").update({ name: workspaceName.trim() }).eq("id", id);
    setWorkspace((prev) => prev ? { ...prev, name: workspaceName.trim() } : prev);
    setSavingSettings(false);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const initials = workspace ? getInitials(workspace.name) : "…";
  const postsReadyToGenerate = posts.filter((p) => p.brief.trim() && p.status === "idle");

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#0A0A0A', fontFamily:'Satoshi,sans-serif' }}>
      <Sidebar />

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, marginLeft:240 }}>
        {/* Topbar */}
        <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 32px', borderBottom:'1px solid #1E1E1E', background:'#0A0A0A' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:40, height:40, borderRadius:'50%', background:'#B8F028', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
              {workspace?.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={workspace.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <span style={{ fontSize:13, fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:700, color:'#000' }}>{initials}</span>
              }
            </div>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <h1 style={{ fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:700, fontSize:17, color:'#F0EFE9', lineHeight:1 }}>{workspace?.name ?? "…"}</h1>
                <span style={{ padding:'2px 8px', borderRadius:20, background:'rgba(184,240,40,0.12)', border:'1px solid rgba(184,240,40,0.2)', fontSize:11, fontWeight:700, color:'#B8F028', fontFamily:'Satoshi,sans-serif' }}>Actif</span>
              </div>
              <p style={{ fontSize:12, color:'#555', marginTop:3 }}>Workspace client</p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Link href={`/workspace/${id}/planning`} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #2A2A2A', fontSize:13, fontWeight:600, color:'#888', textDecoration:'none' }}>Planning</Link>
            <Link href={`/workspace/${id}/results`} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #2A2A2A', fontSize:13, fontWeight:600, color:'#888', textDecoration:'none' }}>Résultats</Link>
            <Link href={`/workspace/${id}/parametres`} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #2A2A2A', fontSize:13, fontWeight:600, color:'#888', textDecoration:'none' }}>Paramètres</Link>
          </div>
        </header>

        {/* Tabs */}
        <div style={{ display:'flex', alignItems:'center', padding:'0 32px', borderBottom:'1px solid #1E1E1E' }}>
          {(["produire", "parametres"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{ position:'relative', padding:'14px 20px', fontSize:14, fontWeight:500, background:'none', border:'none', cursor:'pointer', color: activeTab === tab ? '#F0EFE9' : '#555', transition:'color 0.15s', fontFamily:'Satoshi,sans-serif' }}
            >
              {tab === "produire" ? "Produire" : "Paramètres"}
              {activeTab === tab && <span style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:'#B8F028', borderRadius:1 }} />}
            </button>
          ))}
        </div>

        {/* Content */}
        <main style={{ flex:1, padding:'32px' }}>
          {activeTab === "produire" && (
            <div>
              {/* Upload + AI — 50/50 grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

                {/* Gauche — Upload */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
                    if (!files.length) return;
                    const newItems: PostItem[] = files.map((file) => ({
                      localId: crypto.randomUUID(), file,
                      photo_url: URL.createObjectURL(file),
                      brief: "", description: "", texte_visuel: "", status: "idle" as PostStatus,
                    }));
                    setPosts((prev) => [...newItems, ...prev]);
                  }}
                  style={{ background: '#111', border: '2px dashed #2A2A2A', borderRadius: 12, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#B8F028'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#2A2A2A'}>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} />
                  <div style={{ fontSize: 36, marginBottom: 12 }}>📷</div>
                  <div style={{ fontFamily: 'Cabinet Grotesk,sans-serif', fontWeight: 700, fontSize: 15, color: '#F0EFE9', marginBottom: 6 }}>Uploader des photos</div>
                  <div style={{ fontSize: 12, color: '#555' }}>Clique ou glisse tes photos ici</div>
                  <div style={{ fontSize: 11, color: '#333', marginTop: 4 }}>JPG, PNG, WEBP</div>
                </div>

                {/* Droite — Génération IA */}
                <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'Cabinet Grotesk,sans-serif', fontWeight: 700, fontSize: 14, color: '#F0EFE9' }}>✦ Générer avec IA</span>
                    <span style={{ fontSize: 11, color: '#555', background: '#1a1a1a', padding: '2px 8px', borderRadius: 20, border: '1px solid #2A2A2A' }}>Gemini</span>
                  </div>
                  <textarea
                    value={imagePrompt}
                    onChange={e => setImagePrompt(e.target.value)}
                    placeholder="Ex : bouteille de vin sur table en bois, lumière dorée, ambiance estivale..."
                    style={{ flex: 1, minHeight: 90, background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: 8, color: '#F0EFE9', padding: 10, fontSize: 13, fontFamily: 'Satoshi,sans-serif', resize: 'none', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#666', fontSize: 12, cursor: 'pointer', flex: 1 }}>
                      <input type="checkbox" checked={includeStyle} onChange={e => setIncludeStyle(e.target.checked)} style={{ accentColor: '#B8F028' }} />
                      Style de la marque
                    </label>
                    <label style={{ cursor: 'pointer', color: '#555', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      🖼 Référence
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => setReferenceImage(reader.result as string);
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {referenceImage && <span style={{ fontSize: 11, color: '#B8F028' }}>✓</span>}
                  </div>
                  <button
                    onClick={handleGenerateImage}
                    disabled={generatingImage || !imagePrompt.trim()}
                    style={{ background: generatingImage ? '#1a1a1a' : '#B8F028', color: generatingImage ? '#555' : '#000', border: generatingImage ? '1px solid #2A2A2A' : 'none', padding: '10px', borderRadius: 8, cursor: generatingImage ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'Cabinet Grotesk,sans-serif', transition: 'all 0.2s' }}>
                    {generatingImage ? '⏳ Génération...' : '✦ Générer'}
                  </button>
                </div>
              </div>

              {/* Generated images */}
              {generatedImages.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                  {generatedImages.map((url, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '4/5', borderRadius: 8, overflow: 'hidden', border: '1px solid #2A2A2A' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        onClick={() => addGeneratedImageToSession(url)}
                        style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', background: '#B8F028', color: '#000', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>
                        + Utiliser
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Tout générer */}
              {postsReadyToGenerate.length > 0 && (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, padding:16, background:'#111', borderRadius:10, border:'1px solid #1E1E1E' }}>
                  <div>
                    <p style={{ fontSize:14, fontWeight:700, color:'#F0EFE9', fontFamily:'Satoshi,sans-serif' }}>{postsReadyToGenerate.length} photo{postsReadyToGenerate.length > 1 ? "s" : ""} prête{postsReadyToGenerate.length > 1 ? "s" : ""} à générer</p>
                    <p style={{ fontSize:12, color:'#555', marginTop:4 }}>Génère le texte visuel + la description Instagram en un clic</p>
                  </div>
                  <button
                    onClick={generateAll}
                    disabled={generatingAll}
                    style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:8, background:'#B8F028', color:'#000', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'Cabinet Grotesk,sans-serif' }}
                  >
                    {generatingAll
                      ? <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>Génération…</>
                      : <><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1l1.3 4H12L8.6 7.5l1.3 4.2L6.5 9.3 3.1 11.7l1.3-4.2L1 5h4.2L6.5 1z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg>Tout générer</>
                    }
                  </button>
                </div>
              )}

              {/* Brief global */}
              <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 12, padding: 24, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <span style={{ fontFamily: 'Cabinet Grotesk,sans-serif', fontWeight: 700, fontSize: 16, color: '#F0EFE9' }}>
                    Brief global
                  </span>
                  <span style={{ fontSize: 12, color: '#555', fontFamily: 'Satoshi,sans-serif' }}>
                    Consignes qui s&apos;appliquent à tous les posts de cette session
                  </span>
                </div>
                <textarea
                  value={globalBrief}
                  onChange={e => setGlobalBrief(e.target.value)}
                  placeholder="Ex : Semaine du 20 mai. Campagne été. Ton chaleureux et lumineux. Mettre en avant les produits de saison. Ne pas mentionner les prix. Toujours terminer avec une question engageante."
                  style={{ width: '100%', minHeight: 100, background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: 8, color: '#F0EFE9', padding: 14, fontSize: 14, fontFamily: 'Satoshi,sans-serif', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }}
                />
                <p style={{ color: '#444', fontSize: 12, marginTop: 8, fontFamily: 'Satoshi,sans-serif' }}>
                  Ce brief sera combiné avec le brief de chaque photo pour la génération.
                </p>
              </div>

              {/* Photo grid */}
              {posts.length === 0 ? (
                <p style={{ fontSize:14, color:'#444', textAlign:'center', padding:'48px 0', fontFamily:'Satoshi,sans-serif' }}>Aucune photo — commence par sélectionner des images ci-dessus.</p>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
                  {posts.map((post) => {
                    const isGenerated = post.status === "generated" || post.status === "validating" || post.status === "validated";
                    return (
                      <div key={post.localId} style={{ display:'flex', flexDirection:'column', borderRadius:10, border:'1px solid #1E1E1E', overflow:'hidden', background:'#111' }}>
                        {/* Photo */}
                        <div className="relative group aspect-square">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={post.exported_image_url || post.photo_url} alt="" className="w-full h-full object-cover" />
                          <div className="absolute top-2 left-2"><Badge status={post.status} /></div>
                          <button
                            onClick={() => removePost(post)}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </button>
                        </div>

                        <div style={{ display:'flex', flexDirection:'column', gap:10, padding:12 }}>
                          {/* Error */}
                          {post.error && (
                            <p style={{ fontSize:11, color:'#FF4D3B', background:'rgba(255,77,59,0.08)', border:'1px solid rgba(255,77,59,0.15)', borderRadius:6, padding:'6px 10px' }}>{post.error}</p>
                          )}

                          {!isGenerated ? (
                            /* ── Pre-generation: brief + generate button ── */
                            <>
                              <textarea
                                value={post.brief}
                                onChange={(e) => updateBrief(post.localId, e.target.value)}
                                onBlur={() => saveBrief(post)}
                                placeholder="Infos spécifiques à ce post : produit mis en avant, message clé, promotion particulière..."
                                rows={3}
                                style={{ width:'100%', borderRadius:8, border:'1px solid #2A2A2A', background:'#161616', padding:'8px 12px', fontSize:12, color:'#F0EFE9', resize:'none', outline:'none', fontFamily:'Satoshi,sans-serif' }}
                              />
                              <button
                                onClick={() => generateOne(post)}
                                disabled={!post.brief.trim() || post.status === "generating"}
                                style={{ width:'100%', padding:'9px', borderRadius:8, background:'#B8F028', border:'none', color:'#000', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity: (!post.brief.trim() || post.status === "generating") ? 0.4 : 1, fontFamily:'Cabinet Grotesk,sans-serif' }}
                              >
                                {post.status === "generating"
                                  ? <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>Génération…</>
                                  : <><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1l1 3.3H10L7.3 6.2l1 3.5-2.8-1.9L2.7 9.7l1-3.5L1 4.3h3.5L5.5 1z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></svg>Générer</>
                                }
                              </button>
                            </>
                          ) : (
                            /* ── Post-generation: texte_visuel + description + validate ── */
                            <>
                              {/* Texte visuel */}
                              {post.texte_visuel && (
                                <div style={{ borderRadius:8, background:'#000', padding:'10px 12px' }}>
                                  <p style={{ fontSize:10, color:'#444', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:4, fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:700 }}>Texte visuel</p>
                                  <p style={{ fontSize:14, fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:700, color:'#F0EFE9', lineHeight:1.3 }}>{post.texte_visuel}</p>
                                </div>
                              )}

                              {/* Description — editable */}
                              {post.description && (
                                <div>
                                  <p style={{ fontSize:10, color:'#444', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:700 }}>Description Instagram</p>
                                  <textarea
                                    value={post.description}
                                    onChange={(e) => setPosts((prev) => prev.map((p) => p.localId === post.localId ? { ...p, description: e.target.value } : p))}
                                    rows={5}
                                    style={{ width:'100%', borderRadius:8, border:'1px solid #2A2A2A', background:'#161616', padding:'8px 12px', fontSize:12, color:'#888', resize:'none', outline:'none', fontFamily:'Satoshi,sans-serif' }}
                                  />
                                </div>
                              )}

                              {/* Validate → save to DB + go to editor */}
                              {post.status !== "validated" && (
                                <button
                                  onClick={() => validatePost(post)}
                                  disabled={post.status === "validating"}
                                  style={{ width:'100%', padding:'10px', borderRadius:8, background:'#B8F028', border:'none', color:'#000', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity: post.status === "validating" ? 0.5 : 1, fontFamily:'Cabinet Grotesk,sans-serif' }}
                                >
                                  {post.status === "validating"
                                    ? <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/></svg>Sauvegarde…</>
                                    : <>Valider et éditer le visuel →</>
                                  }
                                </button>
                              )}

                              {/* Already validated */}
                              {post.status === "validated" && post.dbId && (
                                <Link
                                  href={`/workspace/${id}/editor/${post.dbId}`}
                                  style={{ display:'block', width:'100%', padding:'10px', borderRadius:8, background:'#B8F028', color:'#000', fontSize:12, fontWeight:700, textDecoration:'none', textAlign:'center', fontFamily:'Cabinet Grotesk,sans-serif' }}
                                >
                                  Ouvrir l&apos;éditeur visuel →
                                </Link>
                              )}

                              {/* Regénérer link */}
                              {post.status === "generated" && (
                                <button
                                  onClick={() => generateOne(post)}
                                  style={{ fontSize:11, color:'#444', background:'none', border:'none', cursor:'pointer', textAlign:'center', fontFamily:'Satoshi,sans-serif' }}
                                >
                                  Regénérer
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "parametres" && (
            <div style={{ maxWidth:480, paddingTop:16 }}>
              <h2 style={{ fontFamily:'Cabinet Grotesk,sans-serif', fontWeight:700, fontSize:16, color:'#F0EFE9', marginBottom:24 }}>Paramètres du workspace</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <label style={{ display:'block', marginBottom:6, fontSize:11, fontWeight:700, color:'#555', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:'Cabinet Grotesk,sans-serif' }}>Nom du client</label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    style={{ width:'100%', background:'#161616', border:'1px solid #2A2A2A', borderRadius:8, padding:'11px 14px', fontSize:14, color:'#F0EFE9', outline:'none', fontFamily:'Satoshi,sans-serif' }}
                  />
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button
                    onClick={saveSettings}
                    disabled={savingSettings || !workspaceName.trim()}
                    style={{ padding:'10px 20px', borderRadius:8, background:'#B8F028', border:'none', color:'#000', fontSize:13, fontWeight:700, cursor:'pointer', opacity: (savingSettings || !workspaceName.trim()) ? 0.4 : 1, fontFamily:'Cabinet Grotesk,sans-serif' }}
                  >
                    {savingSettings ? "Enregistrement…" : "Enregistrer"}
                  </button>
                  <Link href={`/workspace/${id}/style`} style={{ padding:'10px 20px', borderRadius:8, border:'1px solid #2A2A2A', background:'transparent', color:'#888', fontSize:13, fontWeight:600, textDecoration:'none', fontFamily:'Satoshi,sans-serif' }}>
                    Style visuel
                  </Link>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
