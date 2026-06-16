"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";
import VoiceButton from "@/components/VoiceButton";

// ─── Types ────────────────────────────────────────────────────────────────────

type PostStatus = "idle" | "generating" | "generated" | "validating" | "validated";
type PostType   = "post" | "reel" | "story" | "carrousel";

const POST_TYPE_CFG: Record<PostType, { label: string; color: string; bg: string; format: string }> = {
  post:      { label: "Publication",  color: "#4F8EF7", bg: "#4F8EF715", format: "1080×1080 px" },
  reel:      { label: "Reel",         color: "#A259FF", bg: "#A259FF15", format: "1080×1920 px" },
  story:     { label: "Story",        color: "#FF6B35", bg: "#FF6B3515", format: "1080×1920 px" },
  carrousel: { label: "Carrousel",    color: "#F7A94F", bg: "#F7A94F15", format: "1080×1080 px" },
};

interface PostItem {
  localId: string;
  dbId?: string;
  file?: File;
  isVideo?: boolean;          // true for .mp4 / .mov imports
  photo_url: string;          // public URL (image or video)
  exported_image_url?: string | null;
  brief: string;
  description: string;
  texte_visuel: string;
  status: PostStatus;
  error?: string;
  created_at?: string;
  templateId?: string | null;  // template chosen BEFORE generation
  post_type?: PostType;
}

interface Workspace {
  id: string;
  name: string;
  logo_url: string | null;
  sector: string | null;
  tone: string | null;
  words_to_use: string | null;
  words_to_avoid: string | null;
  company_description: string | null;
  brand_voice_prompt: string | null;
  description_style: string | null;
  caption_examples: string | null;
}

interface PostTemplate {
  id: string;
  name: string;
  thumbnail_url: string | null;
  format_id: string;
  background_style: { type: string; color?: string; colorFrom?: string; colorTo?: string; angle?: number } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  text_zones: any[];  // full CanvasEl[] — needed to build zone-aware prompt + editor_json
}

const PHOTO_PLACEHOLDER_SRC_COMPOSER = '__PHOTO_PLACEHOLDER__';

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

// ─── Type Picker Modal ────────────────────────────────────────────────────────

const TYPE_ICONS: Record<PostType, React.ReactNode> = {
  post: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M3 9h18M9 21V9"/>
    </svg>
  ),
  reel: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="3"/>
      <polygon points="10 9 15 12 10 15 10 9"/>
      <path d="M4 6h16M4 18h16"/>
    </svg>
  ),
  story: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="12" height="20" rx="3"/>
      <path d="M9 7h6M9 11h4"/>
    </svg>
  ),
  carrousel: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="16" rx="2"/>
      <path d="M2 7v10M22 7v10"/>
    </svg>
  ),
};

function TypePickerModal({ onConfirm, onClose }: { onConfirm: (type: PostType) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<PostType>('post');
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(12,42,29,0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--paper)', borderRadius: 'var(--r-xl)', border: '1px solid var(--line)', padding: '32px', width: 480, maxWidth: '90vw', boxShadow: '0 24px 64px rgba(12,42,29,.45)' }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>Nouveau contenu</p>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--display)', lineHeight: 1.2 }}>Quel type de contenu ?</h2>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>Choisissez le format — modifiable plus tard dans la fiche ou le planificateur.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 28 }}>
          {(Object.entries(POST_TYPE_CFG) as [PostType, typeof POST_TYPE_CFG[PostType]][]).map(([id, cfg]) => (
            <button key={id} onClick={() => setSelected(id)}
              style={{
                padding: '22px 12px 18px',
                borderRadius: 'var(--r)',
                border: selected === id ? '2px solid var(--mint-2)' : '1.5px solid var(--line)',
                background: selected === id ? 'rgba(47,215,155,0.08)' : 'var(--sunk)',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                transition: 'border-color .15s, background .15s',
                outline: 'none',
              }}>
              <span style={{ color: selected === id ? 'var(--mint-2)' : 'var(--ink-2)', display: 'flex' }}>
                {TYPE_ICONS[id as PostType]}
              </span>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--sans)', marginBottom: 4 }}>{cfg.label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{cfg.format}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Annuler</button>
          <button onClick={() => onConfirm(selected)} className="btn btn-primary" style={{ flex: 2 }}>Continuer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Template Picker Modal ────────────────────────────────────────────────────

function TemplatePicker({
  templates,
  onSelect,
  onClose,
}: {
  templates: PostTemplate[];
  onSelect: (templateId: string | null) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(10,14,10,0.72)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--canvas)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--line)',
        padding: '28px 28px 24px',
        width: 640, maxWidth: '90vw', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', gap: 20,
        boxShadow: '0 20px 60px rgba(10,14,10,.55)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 className="h-title" style={{ fontSize: 18, marginBottom: 4 }}>Choisir un template</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              Le template définit la mise en page, les zones de texte et le fond du visuel.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--sunk)', border: '1px solid var(--line)', cursor: 'pointer', fontSize: 16, color: 'var(--ink-3)', display: 'grid', placeItems: 'center' }}
          >×</button>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: 12, overflowY: 'auto', paddingBottom: 4,
        }}>
          {/* "Partir de zéro" option — always first */}
          <button
            onClick={() => onSelect(null)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: 'var(--card)', border: '2px dashed var(--line)',
              borderRadius: 'var(--r-m)', padding: '12px 8px 10px',
              cursor: 'pointer', gap: 8, transition: 'border-color .15s, background .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint-2)'; e.currentTarget.style.background = 'var(--mint-soft)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--card)'; }}
          >
            <div style={{
              width: '100%', aspectRatio: '4/5', borderRadius: 8,
              background: 'var(--sunk)', border: '1.5px solid var(--line)',
              display: 'grid', placeItems: 'center', fontSize: 26, color: 'var(--ink-3)',
            }}>+</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', textAlign: 'center' }}>
              Partir de zéro
            </span>
          </button>

          {/* Template cards */}
          {templates.map((tpl) => {
            const bg = tpl.background_style;
            const gradientCss = bg?.type === 'gradient'
              ? `linear-gradient(${bg.angle ?? 135}deg, ${bg.colorFrom ?? '#0038FF'}, ${bg.colorTo ?? '#fff'})`
              : bg?.type === 'solid' ? (bg.color ?? '#fff')
              : 'var(--sunk)';
            return (
              <button
                key={tpl.id}
                onClick={() => onSelect(tpl.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: 'var(--card)', border: '2px solid var(--line)',
                  borderRadius: 'var(--r-m)', padding: '8px 8px 10px',
                  cursor: 'pointer', gap: 8, transition: 'border-color .15s, box-shadow .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint-2)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--mint-soft)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{
                  width: '100%', aspectRatio: '4/5', borderRadius: 8, overflow: 'hidden',
                  background: gradientCss,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {tpl.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tpl.thumbnail_url}
                      alt={tpl.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.05em', textAlign: 'center', padding: '0 8px' }}>
                      {tpl.name.slice(0, 20)}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink)', textAlign: 'center', lineHeight: 1.2, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tpl.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
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
  const [templates, setTemplates] = useState<PostTemplate[]>([]);
  const [templatePickerPost, setTemplatePickerPost] = useState<PostItem | null>(null);
  // Pre-generation template picker (user selects template BEFORE clicking Générer)
  const [preGenPickerPost, setPreGenPickerPost] = useState<PostItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [typeMenuPost, setTypeMenuPost] = useState<string | null>(null);

  // ── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, name, logo_url, sector, tone, words_to_use, words_to_avoid, company_description, brand_voice_prompt, description_style, caption_examples")
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

    const { data: tpls } = await supabase
      .from("post_templates")
      .select("id, name, thumbnail_url, format_id, background_style, text_zones")
      .eq("workspace_id", id)
      .order("sort_order", { ascending: true });
    if (tpls) setTemplates(tpls);
  }, [id, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── File selection ────────────────────────────────────────────────────────

  function filterFiles(rawFiles: File[]): File[] {
    return rawFiles
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .filter((f) => { if (f.size > 100 * 1024 * 1024) { alert(`"${f.name}" dépasse 100 MB — fichier ignoré.`); return false; } return true; });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = filterFiles(Array.from(e.target.files || []));
    if (!files.length) return;
    setPendingFiles(files);
    e.target.value = "";
  }

  function createPostItemsWithType(files: File[], post_type: PostType) {
    const newItems: PostItem[] = files.map((file) => ({
      localId: crypto.randomUUID(),
      file,
      isVideo: file.type.startsWith("video/"),
      photo_url: URL.createObjectURL(file),
      brief: "", description: "", texte_visuel: "",
      status: "idle" as PostStatus,
      templateId: null,
      post_type,
    }));
    setPosts((prev) => [...newItems, ...prev]);
    setPendingFiles(null);
  }

  function updatePostType(localId: string, post_type: PostType) {
    setPosts(prev => prev.map(p => p.localId === localId ? { ...p, post_type } : p));
    const post = posts.find(p => p.localId === localId);
    if (post?.dbId) supabase.from("posts").update({ post_type }).eq("id", post.dbId).then(() => {});
    setTypeMenuPost(null);
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
      // ── Template zone detection ────────────────────────────────────────────
      const selectedTemplate = item.templateId
        ? templates.find(t => t.id === item.templateId) ?? null
        : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allZones: any[] = Array.isArray(selectedTemplate?.text_zones) ? selectedTemplate!.text_zones : [];
      // Only send zones that have a role — those are AI-fillable
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const templateZones = allZones
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((z: any) => z.type === 'text' && z.role)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((z: any) => ({
          id: z.id,
          role: z.role,
          width: Math.max(z.width ?? 200, 1),
          height: Math.max(z.fontSize + ((z.paddingV ?? z.padding ?? 8) * 2), 1),
          fontSize: Math.max(z.fontSize ?? 24, 1),
        }));

      // For video posts, don't pass photoUrl to the AI (no frame analysis)
      const photoUrl = item.isVideo ? undefined : (item.photo_url.startsWith("http") ? item.photo_url : undefined);
      const combinedBrief = globalBrief.trim()
        ? `CONSIGNES GLOBALES : ${globalBrief}\n\nINFOS SPÉCIFIQUES À CE POST : ${item.brief}`
        : item.brief;
      const res = await fetch("/api/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: combinedBrief,
          photoUrl,
          // Brand identity
          workspaceName: workspace?.name ?? undefined,
          sector: workspace?.sector ?? undefined,
          tone: workspace?.tone ?? undefined,
          companyDescription: workspace?.company_description ?? undefined,
          brandVoicePrompt: workspace?.brand_voice_prompt ?? undefined,
          // Voice rules
          wordsToUse: workspace?.words_to_use ?? undefined,
          wordsToAvoid: workspace?.words_to_avoid ?? undefined,
          captionExamples: workspace?.caption_examples ?? undefined,
          descriptionStyle: workspace?.description_style ?? undefined,
          // Template zone structure (if template selected before generating)
          templateZones: templateZones.length > 0 ? templateZones : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.texte_visuel || data.description)) {
        const texte_visuel = item.isVideo ? "" : (data.texte_visuel ?? "");
        const description = data.description ?? "";

        // Upload photo first (need public URL for editor_json)
        let dbId = item.dbId;
        let pUrl = item.photo_url;
        if (item.file) {
          const ext = item.file.name.split(".").pop() ?? (item.isVideo ? "mp4" : "jpg");
          const path = `${id}/${crypto.randomUUID()}.${ext}`;
          const bucket = item.isVideo ? "videos" : "photos";
          const { error: uploadError } = await supabase.storage.from(bucket).upload(path, item.file, { upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
            pUrl = urlData.publicUrl;
          }
        }

        // ── Build editor_json from template zones + AI zone blocks ───────────
        let editorJson: string | undefined;
        if (selectedTemplate && data.zoneBlocks && typeof data.zoneBlocks === 'object') {
          const zoneBlocks = data.zoneBlocks as Record<string, string>;
          const proxyUrl = pUrl.startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(pUrl)}` : '';
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hasPhotoZone = allZones.some((z: any) => z.type === 'image' && z.src === PHOTO_PLACEHOLDER_SRC_COMPOSER);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const initialElements = allZones.map((el: any) => {
            // Fill text zones with AI-generated content
            if (el.type === 'text' && zoneBlocks[el.id]) {
              return { ...el, text: zoneBlocks[el.id] };
            }
            // Replace photo placeholder with actual photo
            if (el.type === 'image' && el.src === PHOTO_PLACEHOLDER_SRC_COMPOSER) {
              return { ...el, id: `tpl-${el.id}`, src: proxyUrl };
            }
            return { ...el, id: el.id.startsWith('tpl-') ? el.id : `tpl-${el.id}` };
          });

          editorJson = JSON.stringify({
            version: 2,
            slides: [{
              id: 'slide-1',
              elements: initialElements,
              proxyUrl: hasPhotoZone ? '' : proxyUrl,
              bgStyle: selectedTemplate.background_style ?? undefined,
            }],
          });
        }

        if (!dbId) {
          const { data: post } = await supabase.from("posts").insert({
            workspace_id: id, photo_url: pUrl, brief: item.brief,
            texte_visuel, description, status: "generated",
            template_id: item.templateId ?? null,
            post_type: item.post_type ?? 'post',
            ...(editorJson ? { editor_json: editorJson } : {}),
          }).select().single();
          if (post) dbId = post.id;
        } else {
          await supabase.from("posts").update({
            texte_visuel, description, status: "generated",
            post_type: item.post_type ?? 'post',
            ...(editorJson ? { editor_json: editorJson } : {}),
          }).eq("id", dbId);
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

  async function validatePost(item: PostItem, templateId?: string | null) {
    if (item.status === "validating") return;
    setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "validating" } : p)));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let pUrl = item.photo_url;
      let dbId = item.dbId;
      if (item.file) {
        const ext = item.file.name.split(".").pop() ?? (item.isVideo ? "mp4" : "jpg");
        const path = `${id}/${crypto.randomUUID()}.${ext}`;
        const bucket = item.isVideo ? "videos" : "photos";
        const { error: uploadError } = await supabase.storage.from(bucket).upload(path, item.file, { upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
          pUrl = urlData.publicUrl;
        }
      }
      if (!dbId) {
        const { data: post } = await supabase.from("posts").insert({
          workspace_id: id, photo_url: pUrl, brief: item.brief,
          description: item.description, texte_visuel: item.texte_visuel,
          status: "validated",
          template_id: templateId ?? null,
          post_type: item.post_type ?? 'post',
        }).select().single();
        if (post) dbId = post.id;
      } else {
        await supabase.from("posts").update({
          description: item.description, texte_visuel: item.texte_visuel,
          status: "validated",
          ...(templateId !== undefined ? { template_id: templateId ?? null } : {}),
        }).eq("id", dbId);
      }
      setPosts((prev) => prev.map((p) => p.localId === item.localId ? { ...p, dbId, photo_url: pUrl, status: "validated" } : p));
      // Video posts go straight to planning — no visual editor
      if (dbId) window.location.href = item.isVideo ? `/workspace/${id}/planning?post=${dbId}` : `/workspace/${id}/editor/${dbId}`;
    } catch {
      setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "generated" } : p)));
    }
  }

  // Opens template picker if templates exist and no template was pre-selected
  function openEditorWithTemplatePicker(post: PostItem) {
    if (post.isVideo) { validatePost(post, null); return; }
    // Template was already chosen before generation → go straight to editor
    if (post.templateId) { validatePost(post, post.templateId); return; }
    // No templates at all → skip picker
    if (templates.length === 0) { validatePost(post, null); return; }
    // Show picker
    setTemplatePickerPost(post);
  }

  // ── Soft-delete ───────────────────────────────────────────────────────────

  const [deletedPost, setDeletedPost] = useState<{ item: PostItem; timeoutId: ReturnType<typeof setTimeout> } | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (deletedPost) clearTimeout(deletedPost.timeoutId); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletedPost]);

  function removePost(item: PostItem) {
    setPosts((prev) => prev.filter((p) => p.localId !== item.localId));
    // Commit any previously pending delete now
    if (deletedPost) {
      clearTimeout(deletedPost.timeoutId);
      if (deletedPost.item.dbId) supabase.from("posts").delete().eq("id", deletedPost.item.dbId);
    }
    const timeoutId = setTimeout(async () => {
      if (item.dbId) await supabase.from("posts").delete().eq("id", item.dbId);
      setDeletedPost(null);
    }, 4000);
    setDeletedPost({ item, timeoutId });
  }

  function undoDelete() {
    if (!deletedPost) return;
    clearTimeout(deletedPost.timeoutId);
    setPosts((prev) => [deletedPost.item, ...prev]);
    setDeletedPost(null);
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
        <div className="scroll" onClick={() => typeMenuPost && setTypeMenuPost(null)}>
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
                      const files = filterFiles(Array.from(e.dataTransfer.files));
                      if (!files.length) return;
                      setPendingFiles(files);
                    }}
                    style={{ padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s, background 0.15s', border: '1.5px dashed var(--line)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint-2)'; e.currentTarget.style.background = 'var(--mint-soft)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--card)'; }}
                  >
                    <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/quicktime" multiple onChange={handleFileChange} style={{ display: 'none' }} />
                    <span style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--ink)', color: 'var(--paper)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                      <IconUpload />
                    </span>
                    <div className="h-title" style={{ fontSize: 15, marginBottom: 6 }}>Déposez photos ou vidéos ici</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>ou cliquez pour sélectionner · JPG, PNG, MP4, MOV · max 100 MB</div>
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
                          {/* Photo / Video preview */}
                          <div style={{ padding: 8 }}>
                            <div style={{ position: 'relative', aspectRatio: '4/5', borderRadius: 11, overflow: 'hidden', background: '#000' }}>
                              {post.isVideo ? (
                                <video
                                  src={post.photo_url}
                                  controls
                                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                                />
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={post.exported_image_url || post.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              )}
                              {/* Status + Video badge */}
                              <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 5 }}>
                                <StatusChip status={post.status} />
                                {post.isVideo && (
                                  <span style={{ background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 9.5, fontWeight: 700, padding: '3px 7px', borderRadius: 99, fontFamily: 'var(--mono)', backdropFilter: 'blur(4px)', letterSpacing: '.05em' }}>
                                    ▶ VIDÉO
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => removePost(post)}
                                style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                              </button>
                              {/* Post type badge — cliquable */}
                              <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
                                {typeMenuPost === post.localId ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, background: 'rgba(0,0,0,.82)', borderRadius: 7, padding: '5px 5px', backdropFilter: 'blur(6px)' }}>
                                    {(Object.entries(POST_TYPE_CFG) as [PostType, typeof POST_TYPE_CFG[PostType]][]).map(([tid, cfg]) => (
                                      <button key={tid} onClick={e => { e.stopPropagation(); updatePostType(post.localId, tid); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: (post.post_type ?? 'post') === tid ? cfg.color : 'transparent', border: 'none', borderRadius: 4, padding: '3px 7px', cursor: 'pointer', color: '#fff', fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--sans)', whiteSpace: 'nowrap' }}>
                                        {cfg.label}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <button onClick={e => { e.stopPropagation(); setTypeMenuPost(post.localId); }}
                                    style={{ background: POST_TYPE_CFG[post.post_type ?? 'post'].color, color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 6px 2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                    {POST_TYPE_CFG[post.post_type ?? 'post'].label}
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 14px 14px' }}>
                            {/* Error */}
                            {post.error && (
                              <p style={{ fontSize: 12, color: 'var(--warn)', background: 'var(--warn-soft)', borderRadius: 'var(--r-s)', padding: '6px 10px' }}>{post.error}</p>
                            )}

                            {!isGenerated ? (
                              <>
                                {/* ── Template selector (before generation) ── */}
                                {!post.isVideo && templates.length > 0 && (() => {
                                  const activeTpl = post.templateId ? templates.find(t => t.id === post.templateId) : null;
                                  const bg = activeTpl?.background_style;
                                  const gradientCss = bg?.type === 'gradient'
                                    ? `linear-gradient(${bg.angle ?? 135}deg, ${bg.colorFrom ?? '#0038FF'}, ${bg.colorTo ?? '#fff'})`
                                    : bg?.type === 'solid' ? (bg.color ?? 'var(--sunk)') : 'var(--sunk)';
                                  return (
                                    <button
                                      onClick={() => setPreGenPickerPost(post)}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '7px 10px', borderRadius: 'var(--r-s)',
                                        background: 'var(--sunk)', border: '1px solid var(--line)',
                                        cursor: 'pointer', width: '100%', textAlign: 'left',
                                        transition: 'border-color .15s',
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint-2)'; }}
                                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; }}
                                    >
                                      {activeTpl ? (
                                        <>
                                          <span style={{ width: 22, height: 22, borderRadius: 5, background: gradientCss, flexShrink: 0, border: '1px solid rgba(0,0,0,.08)' }} />
                                          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTpl.name}</span>
                                          <span style={{ fontSize: 11, color: 'var(--mint-2)', fontWeight: 700 }}>Changer →</span>
                                        </>
                                      ) : (
                                        <>
                                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-3)', flexShrink: 0 }}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                                          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', flex: 1 }}>Choisir un template</span>
                                          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>optionnel →</span>
                                        </>
                                      )}
                                    </button>
                                  );
                                })()}
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
                                  {post.isVideo ? (
                                    /* Video: no visual editor — go straight to planning */
                                    <>
                                      {post.status !== "validated" && (
                                        <button
                                          onClick={() => validatePost(post)}
                                          disabled={post.status === "validating"}
                                          className="btn btn-primary"
                                          style={{ flex: 1, opacity: post.status === "validating" ? 0.5 : 1 }}
                                        >
                                          {post.status === "validating" ? <><Spinner /> Sauvegarde…</> : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Programmer ce Reel</>}
                                        </button>
                                      )}
                                      {post.status === "validated" && post.dbId && (
                                        <Link href={`/workspace/${id}/planning?post=${post.dbId}`} className="btn btn-primary" style={{ flex: 1, textAlign: 'center' }}>
                                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Voir dans le planning
                                        </Link>
                                      )}
                                      {post.status === "generated" && (
                                        <button onClick={() => generateOne(post)} className="btn btn-ghost btn-icon" title="Regénérer la description">
                                          <IconSpark />
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    /* Photo: standard editor flow */
                                    <>
                                      {post.status !== "validated" && (
                                        <button
                                          onClick={() => openEditorWithTemplatePicker(post)}
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
                                    </>
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

      {/* Template picker modal — post-generation (before opening editor) */}
      {pendingFiles && (
        <TypePickerModal
          onConfirm={type => createPostItemsWithType(pendingFiles, type)}
          onClose={() => setPendingFiles(null)}
        />
      )}

      {templatePickerPost && (
        <TemplatePicker
          templates={templates}
          onSelect={(tplId) => {
            const post = templatePickerPost;
            setTemplatePickerPost(null);
            validatePost(post, tplId);
          }}
          onClose={() => setTemplatePickerPost(null)}
        />
      )}

      {/* Template picker modal — pre-generation (before clicking Générer) */}
      {preGenPickerPost && (
        <TemplatePicker
          templates={templates}
          onSelect={(tplId) => {
            const localId = preGenPickerPost.localId;
            setPreGenPickerPost(null);
            // Store template on the post item — doesn't open editor
            setPosts(prev => prev.map(p => p.localId === localId ? { ...p, templateId: tplId } : p));
          }}
          onClose={() => setPreGenPickerPost(null)}
        />
      )}

      {/* Delete toast */}
      {deletedPost && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--forest)', color: 'var(--cream)',
          borderRadius: 10, padding: '10px 16px',
          boxShadow: '0 8px 30px rgba(13,15,10,.35)',
          fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 600,
          zIndex: 9999, whiteSpace: 'nowrap',
        }}>
          Post supprimé
          <button
            onClick={undoDelete}
            style={{
              padding: '4px 12px', borderRadius: 6,
              background: 'var(--mint)', color: 'var(--mint-ink)',
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: 'var(--sans)',
            }}
          >
            Annuler
          </button>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
