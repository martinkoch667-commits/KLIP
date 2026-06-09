"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";
import VoiceButton from "@/components/VoiceButton";

// ─── Types ────────────────────────────────────────────────────────────────────

type PostStatus = "idle" | "generating" | "generated" | "validating" | "validated";

interface PostItem {
  localId: string;
  dbId?: string;
  file?: File;
  photo_url: string;
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

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PostStatus, { label: string; bg: string; color: string }> = {
  idle:       { label: "Brouillon",   bg: "var(--sunk)",      color: "var(--ink-3)" },
  generating: { label: "Génération…", bg: "var(--mint-soft)", color: "var(--mint-2)" },
  generated:  { label: "Généré",      bg: "var(--mint-soft)", color: "var(--mint-2)" },
  validating: { label: "Sauvegarde…", bg: "var(--warn-soft)", color: "var(--warn)" },
  validated:  { label: "Validé",      bg: "var(--mint)",      color: "var(--mint-ink)" },
};

function StatusChip({ status }: { status: PostStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;
  return (
    <span className="chip" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconUpload() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/></svg>;
}
function IconSpark() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/></svg>;
}
function IconEdit() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M13.5 7.5l3 3"/></svg>;
}
function IconTrash() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>;
}
function IconCheck() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5 11-11"/></svg>;
}
function IconChevR() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--mint-soft)", borderTopColor: "var(--mint-2)", display: "inline-block", animation: "spin .7s linear infinite" }} />
  );
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load data ─────────────────────────────────────────────────────────────

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

  // ── File selection ────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newItems: PostItem[] = files
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        localId: crypto.randomUUID(),
        file,
        photo_url: URL.createObjectURL(file),
        brief: "", description: "", texte_visuel: "",
        status: "idle" as PostStatus,
      }));
    setPosts((prev) => [...newItems, ...prev]);
    e.target.value = "";
  }

  // ── Brief ─────────────────────────────────────────────────────────────────

  function updateBrief(localId: string, brief: string) {
    setPosts((prev) => prev.map((p) => (p.localId === localId ? { ...p, brief } : p)));
  }

  async function saveBrief(item: PostItem) {
    if (!item.dbId) return;
    await supabase.from("posts").update({ brief: item.brief }).eq("id", item.dbId);
  }

  // ── Generate ──────────────────────────────────────────────────────────────

  async function generateOne(item: PostItem): Promise<void> {
    if (!item.brief.trim() || item.status === "generating") return;
    setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "generating", error: undefined } : p)));
    try {
      const photoUrl = item.photo_url.startsWith("http") ? item.photo_url : undefined;
      const combinedBrief = globalBrief.trim()
        ? `CONSIGNES GLOBALES : ${globalBrief}\n\nINFOS SPÉCIFIQUES À CE POST : ${item.brief}`
        : item.brief;
      const res = await fetch("/api/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: combinedBrief, photoUrl,
          brandVoicePrompt: workspace?.brand_voice_prompt ?? undefined,
          companyDescription: workspace?.company_description ?? undefined,
          descriptionStyle: workspace?.description_style ?? undefined,
          captionExamples: workspace?.caption_examples ?? undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.texte_visuel || data.description)) {
        const texte_visuel = data.texte_visuel ?? "";
        const description = data.description ?? "";
        let dbId = item.dbId;
        let pUrl = item.photo_url;
        if (!dbId) {
          if (item.file) {
            const ext = item.file.name.split(".").pop();
            const path = `${id}/${crypto.randomUUID()}.${ext}`;
            const { error: uploadError } = await supabase.storage.from("photos").upload(path, item.file, { upsert: true });
            if (!uploadError) {
              const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
              pUrl = urlData.publicUrl;
            }
          }
          const { data: post } = await supabase.from("posts").insert({ workspace_id: id, photo_url: pUrl, brief: item.brief, texte_visuel, description, status: "generated" }).select().single();
          if (post) dbId = post.id;
        } else {
          await supabase.from("posts").update({ texte_visuel, description, status: "generated" }).eq("id", dbId);
        }
        setPosts((prev) => prev.map((p) => p.localId === item.localId ? { ...p, dbId, photo_url: pUrl, texte_visuel, description, status: "generated", error: undefined } : p));
      } else {
        const errMsg = data?.error ? (typeof data.error === "string" ? data.error : JSON.stringify(data.error)) : `Erreur ${res.status}`;
        setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "idle", error: errMsg } : p)));
      }
    } catch {
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

  // ── Validate ──────────────────────────────────────────────────────────────

  async function validatePost(item: PostItem) {
    if (item.status === "validating") return;
    setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "validating" } : p)));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let pUrl = item.photo_url;
      let dbId = item.dbId;
      if (item.file) {
        const ext = item.file.name.split(".").pop();
        const path = `${id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("photos").upload(path, item.file, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
          pUrl = urlData.publicUrl;
        }
      }
      if (!dbId) {
        const { data: post } = await supabase.from("posts").insert({ workspace_id: id, photo_url: pUrl, brief: item.brief, description: item.description, texte_visuel: item.texte_visuel, status: "validated" }).select().single();
        if (post) dbId = post.id;
      } else {
        await supabase.from("posts").update({ description: item.description, texte_visuel: item.texte_visuel, status: "validated" }).eq("id", dbId);
      }
      setPosts((prev) => prev.map((p) => p.localId === item.localId ? { ...p, dbId, photo_url: pUrl, status: "validated" } : p));
      if (dbId) window.location.href = `/workspace/${id}/editor/${dbId}`;
    } catch {
      setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "generated" } : p)));
    }
  }

  // ── Remove ────────────────────────────────────────────────────────────────

  async function removePost(item: PostItem) {
    setPosts((prev) => prev.filter((p) => p.localId !== item.localId));
    if (item.dbId) await supabase.from("posts").delete().eq("id", item.dbId);
  }

  // ── AI image generation ───────────────────────────────────────────────────

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setGeneratingImage(true);
    try {
      const fullPrompt = includeStyle && workspace
        ? `${imagePrompt}. Style : couleurs ${(workspace as any).primary_color || '#000'} et ${(workspace as any).secondary_color || '#fff'}. Format portrait 4:5, qualité professionnelle.`
        : `${imagePrompt}. Format portrait 4:5, qualité professionnelle.`;
      const res = await fetch('/api/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: fullPrompt, referenceImage: referenceImage || null }) });
      const data = await res.json();
      if (data.images?.length > 0) setGeneratedImages(data.images);
    } catch { /* silent */ }
    setGeneratingImage(false);
  };

  const addGeneratedImageToSession = async (imageUrl: string) => {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const file = new File([blob], `generated-${Date.now()}.png`, { type: 'image/png' });
    const fileName = `${id}/generated-${Date.now()}.png`;
    await supabase.storage.from('photos').upload(fileName, file, { upsert: true });
    const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName);
    setPosts(prev => [...prev, { localId: crypto.randomUUID(), photo_url: urlData.publicUrl, brief: imagePrompt, description: '', texte_visuel: '', status: 'idle' as PostStatus }]);
  };

  // ── Settings ──────────────────────────────────────────────────────────────

  async function saveSettings() {
    if (!workspaceName.trim()) return;
    setSavingSettings(true);
    await supabase.from("workspaces").update({ name: workspaceName.trim() }).eq("id", id);
    setWorkspace((prev) => prev ? { ...prev, name: workspaceName.trim() } : prev);
    setSavingSettings(false);
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const initials = workspace ? getInitials(workspace.name) : "…";
  const postsReadyToGenerate = posts.filter((p) => p.brief.trim() && p.status === "idle");

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--canvas)' }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, marginLeft: 'var(--sb-w)' }}>

        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--cream)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
              {initials}
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="h-title" style={{ fontSize: 15, color: 'var(--ink)' }}>{workspace?.name ?? "…"}</span>
                <span className="chip" style={{ background: 'var(--mint-soft)', color: 'var(--mint-2)' }}>Actif</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>Workspace client</p>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href={`/workspace/${id}/planning`} className="btn btn-ghost btn-sm">Planning</Link>
            <Link href={`/workspace/${id}/results`} className="btn btn-ghost btn-sm">Résultats</Link>
            <Link href={`/workspace/${id}/parametres`} className="btn btn-ghost btn-sm">Paramètres</Link>
          </div>
        </header>

        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 26px', borderBottom: '1px solid var(--line)', background: 'var(--canvas)' }}>
          {(["produire", "parametres"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{ position: 'relative', padding: '14px 18px', fontSize: 13.5, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: activeTab === tab ? 'var(--ink)' : 'var(--ink-3)', transition: 'color 0.15s' }}
            >
              {tab === "produire" ? "Produire" : "Paramètres"}
              {activeTab === tab && <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'var(--mint)', borderRadius: 2 }} />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="scroll">
          <div className="page">

            {activeTab === "produire" && (
              <div className="screen-in">

                {/* Forest header banner */}
                <div style={{ position: 'relative', borderRadius: 'var(--r-xl)', overflow: 'hidden', padding: '28px 30px', marginBottom: 26, background: 'var(--forest)', color: 'var(--cream)' }}>
                  <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', right: -60, top: -100, background: 'radial-gradient(circle, var(--mint), transparent 70%)', opacity: 0.35, filter: 'blur(20px)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', right: 200, bottom: -100, background: 'radial-gradient(circle, var(--acid), transparent 70%)', opacity: 0.25, filter: 'blur(16px)', pointerEvents: 'none' }} />
                  <div style={{ position: 'relative', zIndex: 2 }}>
                    <div className="label" style={{ color: 'var(--mint)', marginBottom: 10 }}>Production</div>
                    <h1 className="h-display" style={{ fontSize: 34, color: 'var(--cream)', maxWidth: 560 }}>
                      {workspace?.name ?? "…"}. <span className="it" style={{ color: 'var(--mint)' }}>Une fournée de posts.</span>
                    </h1>
                    <p style={{ color: 'var(--cream-2)', marginTop: 10, maxWidth: 500, fontSize: 14 }}>
                      Déposez vos photos, l'IA rédige chaque description et texte visuel en un clic.
                    </p>
                  </div>
                </div>

                {/* Upload + AI generation — 50/50 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

                  {/* Upload zone */}
                  <div
                    className="card"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
                      if (!files.length) return;
                      setPosts((prev) => [...files.map(file => ({ localId: crypto.randomUUID(), file, photo_url: URL.createObjectURL(file), brief: "", description: "", texte_visuel: "", status: "idle" as PostStatus })), ...prev]);
                    }}
                    style={{ padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s, background 0.15s', border: '1.5px dashed var(--line)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint-2)'; e.currentTarget.style.background = 'var(--mint-soft)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--card)'; }}
                  >
                    <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} />
                    <span style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--ink)', color: 'var(--paper)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                      <IconUpload />
                    </span>
                    <div className="h-title" style={{ fontSize: 15, marginBottom: 6 }}>Déposez vos photos ici</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>ou cliquez pour sélectionner · JPG, PNG, WEBP</div>
                  </div>

                  {/* AI generator */}
                  <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="h-title" style={{ fontSize: 15 }}>Générer avec l'IA</span>
                      <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)' }}>Gemini</span>
                    </div>
                    <textarea
                      value={imagePrompt}
                      onChange={e => setImagePrompt(e.target.value)}
                      placeholder="Ex : bouteille de vin sur table en bois, lumière dorée, ambiance estivale..."
                      className="input"
                      style={{ flex: 1, minHeight: 90, resize: 'none', padding: 12 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer', flex: 1 }}>
                        <input type="checkbox" checked={includeStyle} onChange={e => setIncludeStyle(e.target.checked)} style={{ accentColor: 'var(--mint)' }} />
                        Style de la marque
                      </label>
                      <VoiceButton value={imagePrompt} onChange={setImagePrompt} />
                      <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                        Image référence
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => setReferenceImage(reader.result as string);
                            reader.readAsDataURL(file);
                          }}
                        />
                        {referenceImage && <IconCheck />}
                      </label>
                    </div>
                    <button
                      onClick={handleGenerateImage}
                      disabled={generatingImage || !imagePrompt.trim()}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '11px', opacity: (generatingImage || !imagePrompt.trim()) ? 0.5 : 1 }}
                    >
                      {generatingImage ? <><Spinner /> Génération…</> : <><IconSpark /> Générer une image</>}
                    </button>
                  </div>
                </div>

                {/* Generated images */}
                {generatedImages.length > 0 && (
                  <div className="card" style={{ padding: 16, marginBottom: 20 }}>
                    <div className="label" style={{ marginBottom: 12 }}>Images générées</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                      {generatedImages.map((url, i) => (
                        <div key={i} style={{ position: 'relative', aspectRatio: '4/5', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            onClick={() => addGeneratedImageToSession(url)}
                            className="btn btn-primary btn-sm"
                            style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
                          >
                            + Utiliser
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Brief global */}
                <div className="card" style={{ padding: 22, marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <h2 className="h-title" style={{ fontSize: 16 }}>Brief global</h2>
                    <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Consignes appliquées à tous les posts</span>
                  </div>
                  <textarea
                    value={globalBrief}
                    onChange={e => setGlobalBrief(e.target.value)}
                    placeholder="Ex : Semaine du 20 mai. Campagne été. Ton chaleureux et lumineux. Mettre en avant les produits de saison..."
                    className="input"
                    style={{ minHeight: 90, resize: 'vertical', lineHeight: 1.6 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                    <VoiceButton value={globalBrief} onChange={setGlobalBrief} />
                  </div>
                </div>

                {/* Générer tout */}
                {postsReadyToGenerate.length > 0 && (
                  <div className="card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
                        {postsReadyToGenerate.length} photo{postsReadyToGenerate.length > 1 ? "s" : ""} prête{postsReadyToGenerate.length > 1 ? "s" : ""} à générer
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>Génère le texte visuel + la description Instagram en un clic</div>
                    </div>
                    <button onClick={generateAll} disabled={generatingAll} className="btn btn-primary">
                      {generatingAll ? <><Spinner /> Génération…</> : <><IconSpark /> Tout générer ({postsReadyToGenerate.length})</>}
                    </button>
                  </div>
                )}

                {/* Photo grid */}
                {posts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--ink-3)', fontSize: 14 }}>
                    Aucune photo — commence par sélectionner des images ci-dessus.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                    {posts.map((post) => {
                      const isGenerated = post.status === "generated" || post.status === "validating" || post.status === "validated";
                      return (
                        <div key={post.localId} className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          {/* Photo */}
                          <div style={{ padding: 8 }}>
                            <div style={{ position: 'relative', aspectRatio: '4/5', borderRadius: 11, overflow: 'hidden' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={post.exported_image_url || post.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <div style={{ position: 'absolute', top: 8, left: 8 }}>
                                <StatusChip status={post.status} />
                              </div>
                              <button
                                onClick={() => removePost(post)}
                                style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', backdropFilter: 'blur(4px)', opacity: 0, transition: 'opacity 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onFocus={e => e.currentTarget.style.opacity = '1'}
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 14px 14px' }}>
                            {/* Error */}
                            {post.error && (
                              <p style={{ fontSize: 12, color: 'var(--warn)', background: 'var(--warn-soft)', borderRadius: 'var(--r-s)', padding: '6px 10px' }}>{post.error}</p>
                            )}

                            {!isGenerated ? (
                              <>
                                <textarea
                                  value={post.brief}
                                  onChange={(e) => updateBrief(post.localId, e.target.value)}
                                  onBlur={() => saveBrief(post)}
                                  placeholder="Infos spécifiques : produit, message clé, promotion..."
                                  rows={3}
                                  className="input"
                                  style={{ resize: 'none' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <VoiceButton value={post.brief} onChange={(v) => updateBrief(post.localId, v)} />
                                </div>
                                <button
                                  onClick={() => generateOne(post)}
                                  disabled={!post.brief.trim() || post.status === "generating"}
                                  className="btn btn-primary"
                                  style={{ width: '100%', opacity: (!post.brief.trim() || post.status === "generating") ? 0.45 : 1 }}
                                >
                                  {post.status === "generating" ? <><Spinner /> Génération…</> : <><IconSpark /> Générer</>}
                                </button>
                              </>
                            ) : (
                              <>
                                {post.texte_visuel && (
                                  <div style={{ borderRadius: 'var(--r-s)', background: 'var(--sunk)', padding: '10px 12px' }}>
                                    <p className="label" style={{ marginBottom: 4 }}>Texte visuel</p>
                                    <p className="h-title" style={{ fontSize: 14, lineHeight: 1.3 }}>{post.texte_visuel}</p>
                                  </div>
                                )}

                                {post.description && (
                                  <div>
                                    <p className="label" style={{ marginBottom: 6 }}>Description Instagram</p>
                                    <textarea
                                      value={post.description}
                                      onChange={(e) => setPosts((prev) => prev.map((p) => p.localId === post.localId ? { ...p, description: e.target.value } : p))}
                                      rows={4}
                                      className="input"
                                      style={{ resize: 'none', fontSize: 12.5, color: 'var(--ink-2)' }}
                                    />
                                  </div>
                                )}

                                <div style={{ display: 'flex', gap: 7, marginTop: 2 }}>
                                  {post.status !== "validated" && (
                                    <button
                                      onClick={() => validatePost(post)}
                                      disabled={post.status === "validating"}
                                      className="btn btn-dark"
                                      style={{ flex: 1, opacity: post.status === "validating" ? 0.5 : 1 }}
                                    >
                                      {post.status === "validating" ? <><Spinner /> Sauvegarde…</> : <><IconEdit /> Éditer le visuel</>}
                                    </button>
                                  )}
                                  {post.status === "validated" && post.dbId && (
                                    <Link href={`/workspace/${id}/editor/${post.dbId}`} className="btn btn-dark" style={{ flex: 1, textAlign: 'center' }}>
                                      <IconEdit /> Ouvrir l'éditeur
                                    </Link>
                                  )}
                                  {post.status === "generated" && (
                                    <button onClick={() => generateOne(post)} className="btn btn-ghost btn-icon" title="Regénérer">
                                      <IconSpark />
                                    </button>
                                  )}
                                </div>
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
              <div className="screen-in" style={{ maxWidth: 520 }}>
                <h2 className="h-title" style={{ fontSize: 20, marginBottom: 24 }}>Paramètres du workspace</h2>
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                      <label className="label" style={{ display: 'block', marginBottom: 7 }}>Nom du client</label>
                      <input
                        type="text"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        className="input"
                        style={{ height: 44 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 10, paddingTop: 6 }}>
                      <button
                        onClick={saveSettings}
                        disabled={savingSettings || !workspaceName.trim()}
                        className="btn btn-primary"
                        style={{ opacity: (savingSettings || !workspaceName.trim()) ? 0.45 : 1 }}
                      >
                        {savingSettings ? "Enregistrement…" : <><IconCheck /> Enregistrer</>}
                      </button>
                      <Link href={`/workspace/${id}/style`} className="btn btn-ghost">
                        Style visuel <IconChevR />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
