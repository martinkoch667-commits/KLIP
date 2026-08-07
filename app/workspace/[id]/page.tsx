"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import PostPreviewPane from "@/components/PostPreviewPane";
import AssistantMark from "@/components/AssistantMark";
import { runPreEdit, newTranscriptCache } from "./montage/[postId]/preEdit";
import type { MontageClip } from "./montage/[postId]/constants";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";
import VoiceButton from "@/components/VoiceButton";
import NotificationBell from "@/components/NotificationBell";
import { Sticker } from "@/components/Stickers";
import SelFrame from "@/components/SelFrame";

// ─── Types ────────────────────────────────────────────────────────────────────

type PostStatus = "idle" | "generating" | "generated" | "validating" | "validated";
type PostType   = "post" | "reel" | "story" | "carrousel";

// Formats alignés sur l'éditeur (PT_FORMAT_MAP) : post = portrait 4:5 (1080×1350),
// carrousel = carré 1:1 (1080×1080), reel/story = vertical 9:16 (1080×1920).
// Picto par format — remplace les pastilles de couleur du sélecteur de type :
// une forme se reconnaît, un point coloré ne veut rien dire.
function PostTypeGlyph({ type }: { type: PostType }) {
  const c = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (type === 'reel') return <svg {...c}><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M10 8.5l6 3.5-6 3.5z"/></svg>;
  if (type === 'story') return <svg {...c}><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 6.5v5"/></svg>;
  if (type === 'carrousel') return <svg {...c}><rect x="7" y="4" width="13" height="16" rx="3"/><path d="M4 7v10"/></svg>;
  return <svg {...c}><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="9" cy="9.5" r="1.4"/><path d="M20 15l-4.5-4.5L6 20"/></svg>;
}

const POST_TYPE_CFG: Record<PostType, { label: string; tKey: string; color: string; bg: string; format: string }> = {
  // Palette DA : vert forest / violet / orange warn / rose — couleurs de la charte,
  // assez contrastées pour servir de texte sur leur fond teinté (color + 15 alpha).
  post:      { label: "Publication",  tKey: "ptPost",      color: "#1F7A4D", bg: "#1F7A4D15", format: "1080×1350 px" },
  reel:      { label: "Reel",         tKey: "ptReel",      color: "#6656D9", bg: "#6656D915", format: "1080×1920 px" },
  story:     { label: "Story",        tKey: "ptStory",     color: "#C8732B", bg: "#C8732B15", format: "1080×1920 px" },
  carrousel: { label: "Carrousel",    tKey: "ptCarrousel", color: "#C2456F", bg: "#C2456F15", format: "1080×1080 px" },
};

// Ratio d'affichage réel selon le format (post = 4:5, carrousel = carré, reel/story = 9:16).
function aspectForPostType(t?: PostType | null): string {
  if (t === "reel" || t === "story") return "9 / 16";
  if (t === "carrousel") return "1 / 1";
  return "4 / 5";
}
// Règles de format : une vidéo ne peut être que Reel/Story, une photo Post/Carrousel/Story (pas Reel).
function allowedPostTypes(isVideo: boolean): PostType[] {
  return isVideo ? ["reel", "story"] : ["post", "carrousel", "story"];
}

// Durée d'une vidéo à partir de son URL (métadonnées). Utilisé pour construire les plans
// d'un montage groupé côté compositeur. Retourne 0 en cas d'échec (le montage recalculera).
function getVideoDurationSafe(url: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    const done = (d: number) => { v.removeAttribute("src"); v.load(); resolve(d); };
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : 0);
    v.onerror = () => done(0);
    v.src = url;
  });
}

// Modèles éditoriaux (angle de contenu) proposés avant génération.
const EDITORIAL_MODELS: { id: string; label: string; tKey: string; color: string; hint: string }[] = [
  { id: 'citation',  label: 'Citation',  tKey: 'emCitation',  color: '#14160F', hint: 'une phrase forte / punchline qui marque' },
  { id: 'annonce',   label: 'Annonce',   tKey: 'emAnnonce',   color: '#2FD79B', hint: 'une annonce claire (nouveauté, ouverture, info)' },
  { id: 'produit',   label: 'Produit',   tKey: 'emProduit',   color: '#C8732B', hint: 'mise en avant d’un produit / plat / offre' },
  { id: 'evenement', label: 'Événement', tKey: 'emEvenement', color: '#6656D9', hint: 'un événement (date, lieu, invitation)' },
  { id: 'minimal',   label: 'Minimal',   tKey: 'emMinimal',   color: '#8B8E7F', hint: 'épuré, sobre, peu de texte' },
];
// Voix (ton) sélectionnable par post — surcharge le ton de la charte.
const POST_VOICES: { id: string; label: string; tKey: string }[] = [
  { id: 'Chic et premium',       label: 'Chic',    tKey: 'voiceChic' },
  { id: 'Punchy et direct',      label: 'Punchy',  tKey: 'voicePunchy' },
  { id: 'Minimaliste et sobre',  label: 'Minimal', tKey: 'voiceMinimal' },
  { id: 'Doux et chaleureux',    label: 'Doux',    tKey: 'voiceDoux' },
];

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
  thumbnail_url?: string | null;
  // Montage groupé : plusieurs fichiers réunis dans UN seul post vidéo (plans concaténés).
  // `file` = 1er plan (couverture) ; `groupedFiles` = tous les plans dans l'ordre.
  groupedFiles?: File[];
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
  /** Lu depuis la base et affiché sur les vignettes de post ; il manquait au type. */
  instagram_username: string | null;
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

const STATUS_CONFIG: Record<PostStatus, { label: string; tKey: string; bg: string; color: string }> = {
  idle:       { label: "Brouillon",   tKey: "stIdle",       bg: "var(--sunk)",      color: "var(--ink-3)" },
  generating: { label: "Génération…", tKey: "stGenerating", bg: "var(--mint-soft)", color: "var(--mint-2)" },
  generated:  { label: "Généré",      tKey: "stGenerated",  bg: "var(--mint-soft)", color: "var(--mint-2)" },
  validating: { label: "Sauvegarde…", tKey: "stValidating", bg: "var(--warn-soft)", color: "var(--warn)" },
  validated:  { label: "Validé",      tKey: "stValidated",  bg: "var(--mint)",      color: "var(--mint-ink)" },
};

function StatusChip({ status }: { status: PostStatus }) {
  const t = useTranslations('workspace');
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;
  return (
    <span className="chip" style={{ background: cfg.bg, color: cfg.color }}>
      {t(cfg.tKey)}
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

// Icônes du choix de regroupement (posts séparés vs montage unique).
const GROUP_ICONS = {
  separate: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  montage: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 9h20M2 15h20M7 5v14M17 5v14"/>
    </svg>
  ),
};

type ImportMode = 'separate' | 'montage';

function fmtClipDuration(s: number) {
  const total = Math.round(s);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// Un objectURL par fichier, révoqué au démontage. Les URL doivent vivre aussi
// longtemps que les vignettes qui les affichent : on ne peut pas les libérer
// dès la première image peinte.
function useClipUrls(files: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const made = files.map(f => URL.createObjectURL(f));
    setUrls(made);
    return () => { made.forEach(URL.revokeObjectURL); setUrls([]); };
  }, [files]);
  return urls;
}

// Vignette de chaque rush : un nom de fichier (IMG_1693.MOV) ne dit rien de ce
// qu'il y a dedans, on ne peut pas ordonner des plans à l'aveugle.
// On laisse le navigateur peindre l'image lui-même plutôt que de l'extraire à la
// main dans un canvas : sur un gros .MOV, `loadeddata` ne se déclenche jamais
// (le chargement s'arrête aux métadonnées, sans jamais décoder d'image) et la
// vignette restait bloquée sur un carré gris. Le fragment #t= demande une image
// un peu après le début — la toute première est souvent noire, le temps que
// l'exposition se cale — et les navigateurs qui l'ignorent affichent l'image 0,
// ce qui reste un aperçu valable. Codec illisible → picto, la ligne reste
// utilisable, elle perd juste son aperçu.
function ClipThumb({ file, url, index, onDuration }: {
  file: File;
  url?: string;
  index: number;
  onDuration: (index: number, seconds: number) => void;
}) {
  const [failed, setFailed] = useState(false);
  const isVideo = file.type.startsWith('video/');
  const media: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };

  return (
    <span style={{
      position: 'relative', flexShrink: 0, width: 40, height: 52, borderRadius: 'var(--r-s)',
      overflow: 'hidden', background: 'var(--line-2)', border: '1px solid var(--line)',
      display: 'grid', placeItems: 'center', color: 'var(--ink-3)',
    }}>
      {url && !failed ? (
        isVideo
          ? <video src={`${url}#t=0.6`} preload="metadata" muted playsInline style={media}
              onLoadedMetadata={e => {
                // Un conteneur qui n'annonce pas de durée fiable (webm en flux,
                // MOV tronqué) : pas de badge, plutôt qu'un faux « 0:00 ».
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && d >= 0.5) onDuration(index, d);
              }}
              onError={() => setFailed(true)} />
          : <img src={url} alt="" style={media} onError={() => setFailed(true)} />
      ) : isVideo ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 9h20M2 15h20M7 5v14M17 5v14"/></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="9" cy="9.5" r="1.4"/><path d="M20 15l-4.5-4.5L6 20"/></svg>
      )}
      {isVideo && url && !failed && (
        <span style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          background: 'linear-gradient(to top, rgba(10,14,10,.45), transparent 55%)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.5))' }}><path d="M8 5.5v13l11-6.5z"/></svg>
        </span>
      )}
    </span>
  );
}

function TypePickerModal({ files, onSeparate, onMontage, onClose }: {
  files: File[];
  onSeparate: (type: PostType) => void;
  onMontage: (ordered: File[]) => void;
  onClose: () => void;
}) {
  const t = useTranslations('workspace');
  const nVideos = files.filter(f => f.type.startsWith('video/')).length;
  const nPhotos = files.length - nVideos;
  const multi = files.length >= 2;
  const allVideos = files.length > 0 && nVideos === files.length;
  // Défaut malin : tout vidéos → montage groupé ; sinon posts séparés.
  const [mode, setMode] = useState<ImportMode>(multi && allVideos ? 'montage' : 'separate');
  const [selected, setSelected] = useState<PostType>('post');
  // Ordre des plans du futur montage (indices dans `files`), réarrangeable ici.
  const [order, setOrder] = useState<number[]>(() => files.map((_, i) => i));
  const clipUrls = useClipUrls(files);
  const [clipDurations, setClipDurations] = useState<Record<number, number>>({});
  const reportDuration = useCallback((index: number, seconds: number) => {
    setClipDurations(prev => (prev[index] === seconds ? prev : { ...prev, [index]: seconds }));
  }, []);
  function moveOrder(i: number, dir: -1 | 1) {
    setOrder(prev => {
      const next = [...prev]; const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const groupOptions: { id: ImportMode; icon: React.ReactNode; title: string; desc: string }[] = [
    { id: 'separate', icon: GROUP_ICONS.separate, title: t('groupSeparate'), desc: t('groupSeparateDesc', { count: files.length }) },
    { id: 'montage',  icon: GROUP_ICONS.montage,  title: t('groupMontage'),  desc: t('groupMontageDesc', { count: files.length }) },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(12,42,29,0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--paper)', borderRadius: 'var(--r-xl)', border: '1px solid var(--line)', padding: '32px', width: 480, maxWidth: '90vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(12,42,29,.45)' }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{t('typePickerEyebrow')}</p>
        <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--display)', lineHeight: 1.2 }}>{t('typePickerTitle')}</h2>
        <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{multi ? t('groupHint', { count: files.length }) : t('typePickerHint')}</p>

        {/* Étape 1 — regroupement (seulement pour plusieurs fichiers) */}
        {multi && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: mode === 'separate' ? 18 : 28 }}>
            {groupOptions.map((opt) => (
              <button key={opt.id} onClick={() => setMode(opt.id)}
                style={{
                  padding: '16px 14px', borderRadius: 'var(--r)', textAlign: 'left',
                  border: mode === opt.id ? '2px solid var(--mint-2)' : '1.5px solid var(--line)',
                  background: mode === opt.id ? 'rgba(47,215,155,0.08)' : 'var(--sunk)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8,
                  transition: 'border-color .15s, background .15s', outline: 'none',
                }}>
                <span style={{ color: mode === opt.id ? 'var(--mint-2)' : 'var(--ink-2)', display: 'flex' }}>{opt.icon}</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--sans)', marginBottom: 3 }}>{opt.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.35 }}>{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Étape 2 — type de post (posts séparés uniquement) */}
        {mode === 'separate' && (
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
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--sans)', marginBottom: 4 }}>{t(cfg.tKey)}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{cfg.format}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Récap montage + ORDRE DES PLANS : on met les rushes dans le bon ordre
            AVANT que le montage démarre, sinon tout arrive mélangé. */}
        {mode === 'montage' && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 'var(--r)', background: 'var(--leaf-soft)', border: '1px solid var(--leaf)' }}>
              <span style={{ color: 'var(--leaf-ink)', display: 'flex', flexShrink: 0 }}>{GROUP_ICONS.montage}</span>
              <p style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.45 }}>{t('montageSummary', { count: files.length })}</p>
            </div>

            <p className="label" style={{ margin: '16px 0 8px' }}>{t('orderLabel')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 272, overflowY: 'auto' }}>
              {order.map((fi, i) => (
                <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-s)', background: 'var(--sunk)' }}>
                  <span className="num" style={{ fontSize: 13, width: 18, textAlign: 'center', color: 'var(--ink-3)', flexShrink: 0 }}>{i + 1}</span>
                  <ClipThumb file={files[fi]} url={clipUrls[fi]} index={fi} onDuration={reportDuration} />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {files[fi]?.name}
                    </span>
                    {clipDurations[fi] != null && (
                      <span className="num" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{fmtClipDuration(clipDurations[fi])}</span>
                    )}
                  </span>
                  <button type="button" disabled={i === 0} onClick={() => moveOrder(i, -1)}
                    className="btn btn-ghost btn-icon" style={{ padding: 5, opacity: i === 0 ? 0.3 : 1 }} title={t('moveUp')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                  </button>
                  <button type="button" disabled={i === order.length - 1} onClick={() => moveOrder(i, 1)}
                    className="btn btn-ghost btn-icon" style={{ padding: 5, opacity: i === order.length - 1 ? 0.3 : 1 }} title={t('moveDown')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>{t('cancel')}</button>
          <button onClick={() => mode === 'montage' ? onMontage(order.map(i => files[i])) : onSeparate(selected)} className="btn btn-primary" style={{ flex: 2 }}>{t('continue')}</button>
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
  const t = useTranslations('workspace');
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
            <h2 className="h-title" style={{ fontSize: 18, marginBottom: 4 }}>{t('templatePickerTitle')}</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              {t('templatePickerHint')}
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
              background: 'var(--card)', border: '2px solid var(--line)',
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
              {t('fromScratch')}
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
  const t = useTranslations('workspace');
  const tVoice = useTranslations('voice');

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
  // Prémontage IA à l'ouverture du montage (coché par défaut), par post vidéo.
  const [preEdit, setPreEdit] = useState<Record<string, boolean>>({});
  // Date du jour figée APRÈS montage : évaluée au rendu, `new Date()` peut différer
  // entre le HTML du serveur et celui du client → erreur d'hydratation React.
  const [todayISO, setTodayISO] = useState("");
  useEffect(() => { setTodayISO(new Date().toISOString().slice(0, 10)); }, []);

  // ── Share link ────────────────────────────────────────────────────────────
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState<{ id: string; token: string; label: string; expires_at: string | null; created_at: string } | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareExpiryEnabled, setShareExpiryEnabled] = useState(false);
  const [shareExpiryDate, setShareExpiryDate] = useState('');

  const [postContexts, setPostContexts] = useState<Record<string, string>>({});
  const [refinePrompts, setRefinePrompts] = useState<Record<string, string>>({});
  const [photoHasText, setPhotoHasText] = useState<Record<string, boolean>>({}); // la photo contient déjà du texte -> l'IA n'ajoute pas de titre visuel
  const [editorialModel, setEditorialModel] = useState<Record<string, string>>({}); // angle éditorial choisi par post
  const [postVoice, setPostVoice] = useState<Record<string, string>>({});           // ton choisi par post (surcharge la charte)
  const [refiningIds, setRefiningIds] = useState<Set<string>>(new Set());

  // ── Thumbnail picker ─────────────────────────────────────────────────────
  const [thumbTimes, setThumbTimes] = useState<Record<string, number>>({});
  const [thumbDurations, setThumbDurations] = useState<Record<string, number>>({});
  const [thumbPreviews, setThumbPreviews] = useState<Record<string, string>>({});
  const [thumbUploadingIds, setThumbUploadingIds] = useState<Set<string>>(new Set());
  const videoScrubRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const canvasScrubRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  // ── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, name, logo_url, sector, tone, words_to_use, words_to_avoid, company_description, brand_voice_prompt, description_style, caption_examples, instagram_username")
      .eq("id", id)
      .single();

    if (ws) { setWorkspace(ws); setWorkspaceName(ws.name); }

    const { data: dbPosts } = await supabase
      .from("posts")
      .select("id, photo_url, exported_image_url, brief, description, texte_visuel, status, created_at, thumbnail_url, template_id, post_type")
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
        status: (p.status === "generated" ? "generated" : (p.status === "validated" || p.status === "scheduled" || p.status === "published") ? "validated" : "idle") as PostStatus,
        created_at: p.created_at,
        thumbnail_url: p.thumbnail_url ?? null,
        templateId: p.template_id ?? undefined,
        post_type: p.post_type ?? undefined,
        isVideo: /\.(mp4|mov|webm)(\?|$)/i.test(p.photo_url ?? ""),
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

  // ── Share helpers ─────────────────────────────────────────────────────────

  async function openShare() {
    setShareOpen(true);
    setShareLoading(true);
    const res = await fetch(`/api/share-tokens?workspaceId=${id}`);
    const { token } = await res.json();
    if (token) {
      setShareToken(token);
      if (token.expires_at) {
        setShareExpiryEnabled(true);
        setShareExpiryDate(token.expires_at.slice(0, 10));
      }
    } else {
      const r = await fetch('/api/share-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: id, label: 'Lien client' }),
      });
      const { token: newToken } = await r.json();
      setShareToken(newToken ?? null);
    }
    setShareLoading(false);
  }

  async function regenerateShareToken() {
    setShareLoading(true);
    const expiresAt = shareExpiryEnabled && shareExpiryDate ? new Date(shareExpiryDate).toISOString() : null;
    const r = await fetch('/api/share-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: id, label: 'Lien client', expiresAt }),
    });
    const { token } = await r.json();
    setShareToken(token ?? null);
    setShareLoading(false);
  }

  async function copyShareLink() {
    if (!shareToken) return;
    await navigator.clipboard.writeText(`https://getklip.fr/preview/${shareToken.token}`);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  }

  // ── File selection ────────────────────────────────────────────────────────

  // Tri naturel : IMG_2 avant IMG_10 (un tri texte mettrait 10 avant 2). Les
  // navigateurs ne garantissent pas l'ordre d'une sélection multiple — un glisser
  // depuis le Finder arrive régulièrement mélangé — alors que le sélecteur, lui,
  // affiche les fichiers triés par nom. On rejoue ce même ordre pour que le
  // premier fichier de la sélection soit bien le premier plan du montage.
  const naturalOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  function filterFiles(rawFiles: File[]): File[] {
    return rawFiles
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .filter((f) => { if (f.size > 100 * 1024 * 1024) { alert(`"${f.name}" dépasse 100 MB — fichier ignoré.`); return false; } return true; })
      .sort((a, b) => naturalOrder.compare(a.name, b.name));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = filterFiles(Array.from(e.target.files || []));
    if (!files.length) return;
    setPendingFiles(files);
    e.target.value = "";
  }

  function createPostItemsWithType(files: File[], post_type: PostType) {
    const newItems: PostItem[] = files.map((file) => {
      const isVideo = file.type.startsWith("video/");
      // Force un type compatible avec le média (vidéo → Reel/Story, photo → Post/Carrousel/Story).
      const allowed = allowedPostTypes(isVideo);
      return {
        localId: crypto.randomUUID(),
        file,
        isVideo,
        photo_url: URL.createObjectURL(file),
        brief: "", description: "", texte_visuel: "",
        status: "idle" as PostStatus,
        templateId: null,
        post_type: allowed.includes(post_type) ? post_type : allowed[0],
      };
    });
    setPosts((prev) => [...newItems, ...prev]);
    setPendingFiles(null);
  }

  // Regroupe plusieurs fichiers en UN SEUL post vidéo (montage) : les plans seront concaténés
  // dans l'ordre de dépôt à l'ouverture de l'éditeur montage (cf. validatePost → montage_json).
  function createMontagePostItem(files: File[]) {
    if (!files.length) return;
    const cover = files[0];
    const item: PostItem = {
      localId: crypto.randomUUID(),
      file: cover,
      groupedFiles: files,
      isVideo: true,
      photo_url: URL.createObjectURL(cover),
      brief: "", description: "", texte_visuel: "",
      status: "idle" as PostStatus,
      templateId: null,
      post_type: "reel",
    };
    setPosts((prev) => [item, ...prev]);
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

  // Un onglet laissé ouvert plus d'une heure porte un jeton d'accès expiré : le
  // serveur répondait « Non autorisé » et la génération échouait sans recours.
  // On rafraîchit la session et on retente une fois avant d'abandonner.
  async function postJsonAuth(url: string, payload: unknown): Promise<Response> {
    const send = () => fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const res = await send();
    if (res.status !== 401) return res;
    await supabase.auth.refreshSession();
    return send();
  }

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
      const res = await postJsonAuth("/api/generate-description", {
          brief: combinedBrief,
          photoUrl,
          // Server-side workspace fetch (preferred)
          workspaceId: id,
          // Context textarea for this specific post (+ angle éditorial choisi)
          context: [
            editorialModel[item.localId] ? `Angle éditorial : ${EDITORIAL_MODELS.find(m => m.id === editorialModel[item.localId])?.hint ?? ''}` : '',
            postContexts[item.localId] ?? '',
          ].filter(Boolean).join('\n'),
          // La photo contient déjà du texte -> ne pas générer de texte sur le visuel
          imageHasText: !!photoHasText[item.localId],
          // Brand identity (fallback if server fetch fails)
          workspaceName: workspace?.name ?? undefined,
          sector: workspace?.sector ?? undefined,
          tone: postVoice[item.localId] || workspace?.tone || undefined,
          companyDescription: workspace?.company_description ?? undefined,
          brandVoicePrompt: workspace?.brand_voice_prompt ?? undefined,
          // Voice rules
          wordsToUse: workspace?.words_to_use ?? undefined,
          wordsToAvoid: workspace?.words_to_avoid ?? undefined,
          captionExamples: workspace?.caption_examples ?? undefined,
          descriptionStyle: workspace?.description_style ?? undefined,
          // Template zone structure (if template selected before generating)
          templateZones: templateZones.length > 0 ? templateZones : undefined,
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
        setPosts((prev) => prev.map((p) => p.localId === item.localId ? { ...p, dbId, photo_url: pUrl, texte_visuel, description, status: "generated", templateId: item.templateId ?? p.templateId, error: undefined } : p));
      } else {
        // « Non autorisé » ne dit rien à personne : si la session est vraiment
        // perdue (rafraîchissement compris), on donne le geste à faire.
        const errMsg = res.status === 401
          ? "Session expirée — rechargez la page ou reconnectez-vous."
          : (typeof data?.error === "string" ? data.error : data?.error?.message) || "La génération a échoué. Réessayez dans un instant.";
        setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "idle", error: errMsg } : p)));
      }
    } catch {
      setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "idle", error: "Erreur réseau" } : p)));
    }
  }

  async function generateAll() {
    // On reste sur cette page après génération : la génération d'un seul post
    // (generateOne appelé seul, bouton par carte) ne redirige déjà pas — il
    // fallait la même chose ici. L'utilisateur doit voir la description
    // générée, l'ajuster, puis choisir lui-même d'ouvrir l'éditeur ou la file
    // de publication, pas être expédié ailleurs dès que le texte est prêt.
    const toGenerate = posts.filter((p) => !p.isVideo && p.brief.trim() && p.status === "idle");
    if (!toGenerate.length) return;
    setGeneratingAll(true);
    await Promise.all(toGenerate.map(generateOne));
    setGeneratingAll(false);
  }

  // ── Refine caption ───────────────────────────────────────────────────────

  async function refineCaption(item: PostItem) {
    const instruction = refinePrompts[item.localId]?.trim();
    if (!instruction) return;
    setRefiningIds(prev => new Set(prev).add(item.localId));
    try {
      const refinementBrief = `Voici la description Instagram actuelle :\n"${item.description}"\n\nL'utilisateur souhaite la modifier ainsi : ${instruction}\n\nRéécris la description en tenant compte de cette demande, en conservant la voix de marque.`;
      const res = await postJsonAuth("/api/generate-description", {
        brief: refinementBrief,
        workspaceId: id,
        workspaceName: workspace?.name ?? undefined,
        brandVoicePrompt: workspace?.brand_voice_prompt ?? undefined,
        wordsToUse: workspace?.words_to_use ?? undefined,
        wordsToAvoid: workspace?.words_to_avoid ?? undefined,
        captionExamples: workspace?.caption_examples ?? undefined,
        descriptionStyle: workspace?.description_style ?? undefined,
        refinementOnly: true,
      });
      const data = await res.json();
      const refined: string = data?.description || data?.texte_visuel || '';
      if (refined) {
        setPosts(prev => prev.map(p =>
          p.localId === item.localId ? { ...p, description: refined } : p
        ));
        if (item.dbId) {
          await supabase.from("posts").update({ description: refined }).eq("id", item.dbId);
        }
        setRefinePrompts(prev => ({ ...prev, [item.localId]: '' }));
      }
    } catch { /* silent */ }
    setRefiningIds(prev => { const s = new Set(prev); s.delete(item.localId); return s; });
  }

  // ── Thumbnail helpers ─────────────────────────────────────────────────────

  function captureVideoFrame(localId: string): string | null {
    const video = videoScrubRefs.current[localId];
    const canvas = canvasScrubRefs.current[localId];
    if (!video || !canvas) return null;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }



  // ── Remplacer la photo d'un post ────────────────────────────────────────────
  async function replacePhoto(post: PostItem, file: File) {
    if (file.size > 10 * 1024 * 1024) { alert(t('fileTooLarge10')); return; }
    const preview = URL.createObjectURL(file);
    // Aperçu immédiat
    setPosts(prev => prev.map(p => p.localId === post.localId ? { ...p, photo_url: preview, exported_image_url: null } : p));
    try {
      const path = `photos/${id}/${post.dbId ?? post.localId}-${Date.now()}.${file.name.split('.').pop() || 'jpg'}`;
      const { error } = await supabase.storage.from('photos').upload(path, file, { upsert: true, contentType: file.type });
      if (error) return;
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path);
      const url = urlData.publicUrl;
      if (post.dbId) await supabase.from('posts').update({ photo_url: url, exported_image_url: null }).eq('id', post.dbId);
      setPosts(prev => prev.map(p => p.localId === post.localId ? { ...p, photo_url: url, file, exported_image_url: null } : p));
    } catch { /* silent */ }
  }

  // ── Validate ──────────────────────────────────────────────────────────────

  // Enregistre un post (envoi des fichiers + ligne en base) SANS naviguer.
  // Séparé de validatePost pour que la génération en lot puisse enchaîner
  // plusieurs posts sans quitter l'écran de sélection.
  async function savePost(item: PostItem, templateId?: string | null): Promise<{ dbId: string; clips: Record<string, unknown>[] | null } | null> {
    {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      let pUrl = item.photo_url;
      let dbId = item.dbId;
      // montage_json pré-rempli quand plusieurs fichiers sont réunis en un seul montage.
      let montageJson: { clips: Record<string, unknown>[]; formatId: string } | undefined;

      if (item.groupedFiles && item.groupedFiles.length > 1) {
        // ── Montage groupé : on téléverse tous les plans et on construit la timeline ──
        const clips: Record<string, unknown>[] = [];
        const failed: string[] = [];
        for (const f of item.groupedFiles) {
          const isVid = f.type.startsWith("video/");
          const bucket = isVid ? "videos" : "photos";
          const ext = f.name.split(".").pop() ?? (isVid ? "mp4" : "jpg");
          const path = `${id}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from(bucket).upload(path, f, { upsert: true });
          // Un échec silencieux produisait un montage pointant vers des fichiers
          // inexistants (lecteur figé, 400 en boucle). On le signale.
          if (upErr) { failed.push(f.name); continue; }
          const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
          const dur = isVid ? (await getVideoDurationSafe(url) || 5) : 3; // fallback 5s si métadonnées illisibles
          clips.push({
            id: crypto.randomUUID(), kind: isVid ? "video" : "photo", name: f.name, src: url,
            srcDur: isVid ? dur : 15, trimStart: 0, trimEnd: dur,
            // Défauts effet/vitesse — alignés sur newClipDefaults() du module montage. Requis :
            // normalizeClip renvoie le plan tel quel dès que trimEnd est défini, sans compléter.
            speed: 1, filterId: "none", lum: 0, con: 0, sat: 0, transitionIn: "cut", transitionDur: 0.4, vol: 1,
          });
        }
        if (failed.length) {
          alert(`${failed.length} fichier(s) n'ont pas pu être envoyés et ont été retirés du montage :\n• ${failed.join("\n• ")}`);
        }
        if (!clips.length) {
          setPosts((prev) => prev.map((pp) => (pp.localId === item.localId ? { ...pp, status: "idle", error: "upload" } : pp)));
          return null; // rien n'a pu être envoyé : on ne crée pas un montage vide
        }
        pUrl = clips[0].src as string; montageJson = { clips, formatId: "story" };
      } else if (item.file) {
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
          ...(montageJson ? { montage_json: montageJson } : {}),
        }).select().single();
        if (post) dbId = post.id;
      } else {
        await supabase.from("posts").update({
          photo_url: pUrl,
          description: item.description, texte_visuel: item.texte_visuel,
          status: "validated",
          ...(templateId !== undefined ? { template_id: templateId ?? null } : {}),
          ...(montageJson ? { montage_json: montageJson } : {}),
        }).eq("id", dbId);
      }
      setPosts((prev) => prev.map((p) => p.localId === item.localId ? { ...p, dbId, photo_url: pUrl, status: "validated" } : p));
      return dbId ? { dbId, clips: montageJson?.clips ?? null } : null;
    }
  }

  // ── Prémontage en lot ──────────────────────────────────────────────────────
  // Monter trois vidéos ne devrait pas vouloir dire ouvrir trois fois l'éditeur.
  // On enregistre chaque post puis on lance le MÊME pipeline que l'éditeur
  // (preEdit.ts) ici, et on écrit le résultat dans montage_json. L'utilisateur
  // voit les montages avancer côte à côte sans quitter l'écran.
  //
  // En FILE plutôt qu'en vrai parallèle : chaque prémontage sature déjà le
  // processeur (décodage, analyse d'image) et l'API de transcription. Trois de
  // front, c'est trois fois plus lent et des erreurs de quota.
  type BatchState = { localId: string; name: string; status: "queued" | "running" | "done" | "error"; step: number; detail?: string };
  const [batch, setBatch] = useState<BatchState[] | null>(null);
  const batchAbort = useRef<AbortController | null>(null);

  const videoPosts = posts.filter((p) => p.isVideo);

  async function runBatchPreEdit() {
    if (batch) return;
    const targets = posts.filter((p) => p.isVideo);
    if (!targets.length) return;
    const ctrl = new AbortController();
    batchAbort.current = ctrl;
    setBatch(targets.map((p) => ({ localId: p.localId, name: p.brief?.trim() || p.file?.name || t('untitledPost'), status: "queued", step: -1 })));

    const cache = newTranscriptCache();  // un rush partagé n'est écouté qu'une fois
    const patch = (localId: string, next: Partial<BatchState>) =>
      setBatch((prev) => prev?.map((b) => (b.localId === localId ? { ...b, ...next } : b)) ?? prev);

    for (const item of targets) {
      if (ctrl.signal.aborted) break;
      patch(item.localId, { status: "running", step: 0 });
      try {
        const saved = await savePost(item, null);
        if (!saved) { patch(item.localId, { status: "error", detail: t('batchErrSave') }); continue; }

        // Plans de départ : ceux du montage groupé, sinon le média unique du post.
        let clips = (saved.clips as unknown as MontageClip[] | null) ?? null;
        if (!clips?.length) {
          const { data: post } = await supabase.from("posts").select("montage_json, photo_url").eq("id", saved.dbId).single();
          const proj = post?.montage_json as { clips?: MontageClip[] } | null;
          if (proj?.clips?.length) clips = proj.clips;
          else if (post?.photo_url) {
            const dur = (await getVideoDurationSafe(post.photo_url)) || 5;
            clips = [{
              id: crypto.randomUUID(), kind: "video", name: item.file?.name || "video", src: post.photo_url,
              srcDur: dur, trimStart: 0, trimEnd: dur,
              speed: 1, filterId: "none", lum: 0, con: 0, sat: 0, transitionIn: "cut", transitionDur: 0.4, vol: 1,
            }];
          }
        }
        if (!clips?.length) { patch(item.localId, { status: "error", detail: t('batchErrNoClips') }); continue; }

        const res = await runPreEdit(clips, {
          cache,
          signal: ctrl.signal,
          onStep: (i) => patch(item.localId, { step: i }),
          onLog: (ev) => { if (ev.type === "analyzing" || ev.type === "transcribing") patch(item.localId, { detail: ev.name }); },
        });

        // On n'écrit QUE si le pipeline a produit quelque chose d'utilisable :
        // un post dont l'analyse échoue reste strictement dans son état d'avant.
        if (!res.clips.length) { patch(item.localId, { status: "error", detail: t('batchErrEmpty') }); continue; }
        const { data: cur } = await supabase.from("posts").select("montage_json").eq("id", saved.dbId).single();
        const prev = (cur?.montage_json as Record<string, unknown> | null) ?? {};
        await supabase.from("posts").update({
          montage_json: {
            ...prev,
            clips: res.clips,
            ...(res.captions.length ? { captions: res.captions, rawSegments: res.rawSegments, rawWords: res.rawWords } : {}),
            formatId: (prev.formatId as string) || "story",
          },
        }).eq("id", saved.dbId);

        patch(item.localId, { status: "done", step: 3, detail: undefined });
      } catch {
        patch(item.localId, { status: "error", detail: t('batchErrGeneric') });
      }
    }
    batchAbort.current = null;
  }

  function stopBatch() {
    batchAbort.current?.abort();
    batchAbort.current = null;
    setBatch(null);
  }

  async function validatePost(item: PostItem, templateId?: string | null) {
    if (item.status === "validating") return;
    setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "validating" } : p)));
    try {
      const saved = await savePost(item, templateId);
      // Le drapeau de prémontage suit jusqu'au montage, qui enchaîne alors tout seul.
      if (saved) {
        const pre = (preEdit[item.localId] ?? true) ? "?premontage=1" : "";
        window.location.href = item.isVideo ? `/workspace/${id}/montage/${saved.dbId}${pre}` : `/workspace/${id}/editor/${saved.dbId}`;
      }
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
  // Les vidéos n'entrent PAS dans la génération de texte : la légende s'écrit une fois
  // le montage terminé (on ne sait pas encore ce que la vidéo raconte avant de la monter).
  const postsReadyToGenerate = posts.filter((p) => !p.isVideo && p.brief.trim() && p.status === "idle");

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
                <span className="chip" style={{ background: 'var(--mint-soft)', color: 'var(--mint-2)' }}>{t('active')}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>{t('clientWorkspace')}</p>
            </div>
          </div>
          <div className="ws-topbar-nav" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <NotificationBell />
            <Link href={`/workspace/${id}/planning`} className="btn btn-ghost btn-sm ws-topbar-link">{t('planning')}</Link>
            <Link href={`/workspace/${id}/results`} className="btn btn-ghost btn-sm ws-topbar-link">{t('results')}</Link>
            <Link href={`/workspace/${id}/parametres`} className="btn btn-ghost btn-sm ws-topbar-link">{t('settings')}</Link>
            <button
              onClick={openShare}
              className="btn btn-sm"
              style={{ background: 'var(--leaf)', color: 'var(--mint-ink)', border: 'none', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              {t('share')}
            </button>
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
              {tab === "produire" ? t('tabProduce') : t('tabSettings')}
              {activeTab === tab && <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'var(--leaf)', borderRadius: 2 }} />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="scroll" onClick={() => typeMenuPost && setTypeMenuPost(null)}>
          <div className="page">

            {activeTab === "produire" && (
              <div className="screen-in">

                {/* Hero */}
                <div style={{ position: 'relative', borderRadius: 'var(--r-xl)', overflow: 'hidden', padding: '30px 32px', marginBottom: 16, background: 'linear-gradient(120deg, #0A2418 0%, var(--forest) 48%, #103A28 100%)', color: 'var(--cream)' }}>
                  <div className="halo-blob" style={{ width: 300, height: 300, right: -70, top: -150, background: 'var(--leaf)', opacity: .42 }} />
                  <div className="halo-blob" style={{ width: 220, height: 220, right: 180, bottom: -150, background: 'var(--acid)', opacity: .28 }} />
                  {/* stickers décoratifs (coins, derrière le contenu z:2) */}
                  <Sticker name="bolt" size={40} float="B" style={{ position: 'absolute', top: 16, right: 22, zIndex: 1, ['--r' as string]: '10deg' }} />
                  <div className="ws-hero-grid" style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1fr auto', gap: 28, alignItems: 'center' }}>
                    <div>
                      <div className="label" style={{ color: 'var(--leaf)', marginBottom: 12 }}>{t('production')} · {workspace?.name ?? "…"}</div>
                      {/* Sticker accolé au mot surligné (et non derrière un bouton, où il était rogné). */}
                      <h1 className="h-display" style={{ position: 'relative', fontSize: 36, color: 'var(--cream)', maxWidth: 520 }}>
                        {t('heroPre')}<span className="acc-hl">{t('heroAccent')}</span>
                        <Sticker name="heart" size={34} float="A" style={{ position: 'absolute', top: -14, right: -26, ['--r' as string]: '12deg' }} />
                      </h1>
                      <p style={{ color: 'var(--cream-2)', marginTop: 10, maxWidth: 460, fontSize: 14.5 }}>
                        {posts.length > 0
                          ? t.rich('heroReady', { count: posts.filter(p => p.status === 'generated' || p.status === 'validated').length, b: (c) => <b style={{ color: 'var(--cream)' }}>{c}</b> })
                          : t('heroEmpty')}
                      </p>
                      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                        <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
                          <IconUpload /> {t('addPhotos')}
                        </button>
                        <button className="btn" style={{ background: 'rgba(238,237,227,.12)', color: 'var(--cream)', boxShadow: 'inset 0 0 0 1px rgba(238,237,227,.2)' }} onClick={() => document.getElementById('ai-gen-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                          <IconSpark /> {t('generateAI')}
                        </button>
                      </div>
                    </div>
                    {/* Session stats panel — « sélectionné » et posé de biais :
                        le panneau de la bannière devient un objet du plan de
                        travail plutôt qu'un encart administratif. */}
                    <span className="sel" style={{ rotate: '-1.6deg' }}>
                    {/* Carton blanc posé sur la bannière : le verre dépoli se
                        confondait avec le fond et jurait avec le cadre de
                        sélection (décision Martin). */}
                    <div style={{ width: 220, borderRadius: 'var(--r-l)', background: 'var(--white)', boxShadow: '0 18px 40px -22px rgba(0,0,0,.55)', padding: '16px 18px' }}>
                      <div className="label" style={{ marginBottom: 12 }}>{t('thisSession')}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                          { label: t('sessPhotos'), n: posts.length },
                          { label: t('sessGenerated'), n: posts.filter(p => p.status === 'generated').length },
                          { label: t('sessValidated'), n: posts.filter(p => p.status === 'validated').length },
                          { label: t('sessInProgress'), n: posts.filter(p => p.status === 'generating' || p.status === 'validating').length },
                        ].map(({ label, n }) => (
                          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>{label}</span>
                            <span className="num" style={{ fontSize: 18, color: n > 0 ? 'var(--ink)' : 'var(--ink-3)', lineHeight: 1 }}>{n}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                      <SelFrame />
                    </span>
                  </div>
                </div>

                {/* Upload + AI generation — 50/50 */}
                <div className="ws-upload-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, margin: '12px 0 34px' }}>

                  {/* Zone de dépôt « sélectionnée » (cadre + poignées violettes de
                      la landing v3) : le plan de travail ressemble à un éditeur,
                      pas à un formulaire. Le cadre est décoratif, il ne capte
                      aucun clic ; le survol porte sur l'ensemble pour que les
                      poignées suivent la carte. */}
                  <span className="sel sel-block card-hover">
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
                    style={{ padding: 28, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s, background 0.15s', border: '1.5px solid var(--line)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint-2)'; e.currentTarget.style.background = 'var(--mint-soft)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--card)'; }}
                  >
                    <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/quicktime" multiple onChange={handleFileChange} style={{ display: 'none' }} />
                    <span style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--ink)', color: 'var(--paper)', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                      <IconUpload />
                    </span>
                    <div className="h-title" style={{ fontSize: 15, marginBottom: 6 }}>{t('dropHere')}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{t('dropHint')}</div>
                  </div>
                    <SelFrame />
                  </span>

                  {/* AI generator */}
                  <div id="ai-gen-card" className="card card-hover" data-voice-scope="" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="h-title" style={{ fontSize: 15 }}>{t('generateAI')}</span>
                      <span className="chip" style={{ background: 'var(--mint-soft)', color: 'var(--mint-2)' }}>{t('klipAI')}</span>
                    </div>
                    <textarea
                      value={imagePrompt}
                      onChange={e => setImagePrompt(e.target.value)}
                      placeholder={t('imgPromptPh')}
                      className="input"
                      style={{ flex: 1, minHeight: 90, resize: 'none', padding: 12 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <VoiceButton value={imagePrompt} onChange={setImagePrompt} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer', flex: 1 }}>
                        <input type="checkbox" checked={includeStyle} onChange={e => setIncludeStyle(e.target.checked)} style={{ accentColor: 'var(--mint)' }} />
                        {t('brandStyle')}
                      </label>
                      <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                        {t('refImage')}
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
                      {generatingImage ? <><Spinner /> {t('generating')}</> : <><IconSpark /> {t('generateImage')}</>}
                    </button>
                  </div>
                </div>

                {/* Generated images */}
                {generatedImages.length > 0 && (
                  <div className="card" style={{ padding: 16, marginBottom: 20 }}>
                    <div className="label" style={{ marginBottom: 12 }}>{t('generatedImages')}</div>
                    <div className="ws-gen-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                      {generatedImages.map((url, i) => (
                        <div key={i} style={{ position: 'relative', aspectRatio: '4/5', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            onClick={() => addGeneratedImageToSession(url)}
                            className="btn btn-primary btn-sm"
                            style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
                          >
                            + {t('use')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Brief global — carte « posée » (scotch + étiquette), vocabulaire
                    atelier de la landing v3, mais d'équerre. */}
                <div className="card card-note card-hover" data-voice-scope="" style={{ padding: 22, margin: '26px 0 30px' }}>
                  <span className="tape" aria-hidden="true" />
                  <span className="stk-card stk-leaf" style={{ position: 'absolute', top: -16, right: 22, rotate: '3deg', fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', padding: '8px 13px', zIndex: 5 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 19v3" /><path d="M8 22h8" />
                    </svg>
                    {tVoice('sticker')}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <h2 className="h-title" style={{ fontSize: 16 }}>{t('globalBrief')}</h2>
                    <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{t('globalBriefHint')}</span>
                  </div>
                  <textarea
                    value={globalBrief}
                    onChange={e => setGlobalBrief(e.target.value)}
                    placeholder={t('globalBriefPh')}
                    className="input"
                    style={{ minHeight: 90, resize: 'vertical', lineHeight: 1.6 }}
                  />
                  {/* La dictée est mise à gauche, taille pleine : c'est le raccourci
                      le plus rentable du brief, il ne doit pas se cacher en coin. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                    <VoiceButton value={globalBrief} onChange={setGlobalBrief} hint />
                  </div>
                </div>

                {/* Générer tout */}
                {postsReadyToGenerate.length > 0 && (
                  <div className="card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
                        {t('readyToGenerate', { count: postsReadyToGenerate.length })}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{t('readyToGenerateHint')}</div>
                    </div>
                    <button onClick={generateAll} disabled={generatingAll} className="btn btn-primary">
                      {generatingAll ? <><Spinner /> {t('generating')}</> : <><IconSpark /> {t('generateAll', { count: postsReadyToGenerate.length })}</>}
                    </button>
                  </div>
                )}

                {/* Monter toutes les vidéos d'un coup : trois montages ne devraient
                    pas vouloir dire trois ouvertures de l'éditeur. Violet = vidéo. */}
                {videoPosts.length > 1 && (
                  <div className="card card-video" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
                        {t('batchTitle')}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{t('batchHint')}</div>
                    </div>
                    <button onClick={runBatchPreEdit} disabled={!!batch} className="btn btn-video" style={{ flexShrink: 0 }}>
                      <IconSpark /> {t('batchAll')}
                    </button>
                  </div>
                )}

                {/* Photo grid */}
                {posts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '56px 0', color: 'var(--ink-3)', fontSize: 14 }}>
                    {t('noPhoto')}
                  </div>
                ) : (
                  // Un post par ligne mais sur TOUTE la largeur : à deux par ligne,
                  // la hauteur de la carte suivait le format du visuel (un 9:16
                  // faisait exploser la ligne). Ici la carte s'étale à l'horizontale
                  // et reste basse.
                  <div className="ws-posts-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
                    {posts.map((post, pIdx) => {
                      const isGenerated = post.status === "generated" || post.status === "validating" || post.status === "validated";
                      return (
                        <div key={post.localId} className="card klip-card-in ws-post-card" style={{ overflow: 'hidden', display: 'flex', borderRadius: 16, border: '1px solid var(--line-2)', boxShadow: '0 1px 2px rgba(13,15,10,.03), 0 14px 32px -20px rgba(13,15,10,.28)', animationDelay: `${Math.min(pIdx, 8) * 55}ms` }}>
                          {/* ── Colonne gauche : visuel + type + remplacer ── */}
                          {/* Aperçu volontairement bridé en hauteur : à pleine taille
                              il dictait la hauteur de toute la carte, un 9:16 la
                              faisait doubler. Fond blanc, comme le reste de la carte. */}
                          <div className="ws-post-left" style={{ flex: '0 0 268px', minWidth: 200, background: 'var(--white)', borderRight: '1px solid var(--line-2)', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {/* Aperçu du rendu publié — même volet que la fenêtre de
                                programmation. On voyait jusqu'ici le média nu, sans la
                                légende ni le compte : impossible de juger le post. */}
                            {isGenerated && !post.isVideo ? (
                              <PostPreviewPane
                                workspace={workspace}
                                mediaUrl={post.exported_image_url || post.photo_url}
                                caption={post.description || ''}
                                postType={post.post_type}
                                platforms={['instagram']}
                                compact
                                mediaHeight="230px"
                              />
                            ) : (
                            <div style={{ position: 'relative', height: 230, borderRadius: 13, overflow: 'hidden', background: '#000' }}>
                              {post.isVideo ? (
                                <video src={post.photo_url} controls style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={post.exported_image_url || post.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              )}
                              {/* Nom du client (overlay) + badge vidéo */}
                              <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 5 }}>
                                <span style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 9px', borderRadius: 99, fontFamily: 'var(--mono)', letterSpacing: '.06em', textTransform: 'uppercase', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {workspace?.instagram_username || workspace?.name || t('clientFallback')}
                                </span>
                                {post.isVideo && (
                                  <span style={{ background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 9.5, fontWeight: 700, padding: '3px 7px', borderRadius: 99, fontFamily: 'var(--mono)', backdropFilter: 'blur(4px)', letterSpacing: '.05em' }}>▶ {post.groupedFiles && post.groupedFiles.length > 1 ? `${t('videoBadge')} · ${post.groupedFiles.length}` : t('videoBadge')}</span>
                                )}
                              </div>
                              <button onClick={() => removePost(post)}
                                style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                              </button>
                            </div>
                            )}
                            {/* Type de publication — contrôle segmenté posé dans un
                                renfoncement plutôt que quatre boutons encadrés :
                                on lit le choix actif d'un coup d'œil. */}
                            <div className="seg ws-type-pills" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3, width: '100%' }}>
                              {(['post', 'reel', 'carrousel', 'story'] as PostType[]).map(pt => {
                                const active = (post.post_type ?? 'post') === pt;
                                const ok = allowedPostTypes(!!post.isVideo).includes(pt);
                                return (
                                  <button key={pt} disabled={!ok} onClick={() => ok && updatePostType(post.localId, pt)}
                                    title={ok ? undefined : post.isVideo ? t('videoTypeTooltip') : t('photoTypeTooltip')}
                                    className={active ? 'on' : ''}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 4px',
                                      cursor: ok ? 'pointer' : 'not-allowed', opacity: ok ? 1 : 0.35, fontSize: 11.5,
                                      color: active ? 'var(--ink)' : 'var(--ink-3)' }}>
                                    <PostTypeGlyph type={pt} />
                                    {t(POST_TYPE_CFG[pt].tKey)}
                                  </button>
                                );
                              })}
                            </div>
                            {/* Remplacer la photo */}
                            {!post.isVideo && (
                              <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 'var(--r-btn)', background: 'var(--sunk)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', transition: 'background .14s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--leaf-soft)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'var(--sunk)'; }}>
                                <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--leaf)', color: 'var(--leaf-ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                </span>
                                {t('replacePhoto')}
                                <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                                  onChange={e => { const f = e.target.files?.[0]; if (f) replacePhoto(post, f); }} />
                              </label>
                            )}
                          </div>

                          {/* ── Colonne droite : contrôles ── */}
                          <div className="ws-post-right" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                            {/* En-tête compte */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px 0' }}>
                              <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--forest)', display: 'grid', placeItems: 'center', color: 'var(--mint)', fontWeight: 800, fontSize: 12, fontFamily: 'var(--mono)', flexShrink: 0, overflow: 'hidden' }}>
                                {workspace?.logo_url
                                  // eslint-disable-next-line @next/next/no-img-element
                                  ? <img src={workspace.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : (workspace?.name ?? 'C').slice(0, 2).toUpperCase()}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 800, fontSize: 14.5, fontFamily: 'var(--display)', letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.1 }}>{workspace?.name}</div>
                                {workspace?.instagram_username && <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>@{workspace.instagram_username}</div>}
                              </div>
                              <StatusChip status={post.status} />
                            </div>

                          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 18px 16px' }}>
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
                                          <span style={{ fontSize: 11, color: 'var(--mint-2)', fontWeight: 700 }}>{t('change')}</span>
                                        </>
                                      ) : (
                                        <>
                                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-3)', flexShrink: 0 }}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                                          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', flex: 1 }}>{t('chooseTemplate')}</span>
                                          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{t('optional')}</span>
                                        </>
                                      )}
                                    </button>
                                  );
                                })()}
                                <div data-voice-scope="">
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
                                    <span className="label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                                      {post.isVideo ? t('videoNotesLabel') : t('brief')}
                                    </span>
                                    <VoiceButton value={post.brief} onChange={(v) => updateBrief(post.localId, v)} />
                                  </div>
                                  <textarea
                                    value={post.brief}
                                    onChange={(e) => updateBrief(post.localId, e.target.value)}
                                    onBlur={() => saveBrief(post)}
                                    placeholder={post.isVideo ? t('videoNotesPh') : t('briefPh')}
                                    rows={post.isVideo ? 2 : 3}
                                    className="input"
                                    style={{ resize: 'none' }}
                                  />
                                  {/* La légende d'une vidéo s'écrit APRÈS le montage : avant, on ne sait
                                      pas encore ce que la vidéo raconte. */}
                                  {post.isVideo && (
                                    <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '6px 0 0', lineHeight: 1.45 }}>
                                      {t('videoCaptionLaterHint')}
                                    </p>
                                  )}
                                </div>
                                {/* Toggle : la photo contient-elle déjà du texte ? */}
                                {!post.isVideo && (
                                  <button type="button"
                                    onClick={() => setPhotoHasText(prev => ({ ...prev, [post.localId]: !prev[post.localId] }))}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: photoHasText[post.localId] ? 'color-mix(in srgb, var(--mint, #2FD79B) 12%, var(--card))' : 'var(--sunk)', border: `1px solid ${photoHasText[post.localId] ? 'var(--mint, #2FD79B)' : 'var(--line)'}`, borderRadius: 10, padding: '8px 11px', cursor: 'pointer', transition: 'all .15s' }}>
                                    <span style={{ width: 34, height: 20, borderRadius: 99, background: photoHasText[post.localId] ? 'var(--mint, #2FD79B)' : 'var(--line-2, #d9d8cc)', position: 'relative', flexShrink: 0, transition: 'background .18s' }}>
                                      <span style={{ position: 'absolute', top: 2, left: photoHasText[post.localId] ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left .18s cubic-bezier(.2,.7,.3,1)' }} />
                                    </span>
                                    <span style={{ flex: 1 }}>
                                      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{t('photoHasText')}</span>
                                      <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.3 }}>{t('photoHasTextHint')}</span>
                                    </span>
                                  </button>
                                )}
                                {/* Une vidéo ne se « génère » pas : elle se monte — on propose donc
                                    directement le montage, avec le prémontage IA en option. */}
                                {post.isVideo && (
                                  <>
                                    <label className="card-video" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: '9px 11px', borderRadius: 'var(--r-s)' }}>
                                      <input
                                        type="checkbox"
                                        checked={preEdit[post.localId] ?? true}
                                        onChange={e => setPreEdit(prev => ({ ...prev, [post.localId]: e.target.checked }))}
                                        style={{ accentColor: 'var(--vio)', marginTop: 1, flexShrink: 0 }}
                                      />
                                      <span style={{ minWidth: 0 }}>
                                        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{t('preEditLabel')}</span>
                                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4 }}>{t('preEditHint')}</span>
                                      </span>
                                    </label>
                                    <button
                                      onClick={() => validatePost(post)}
                                      disabled={post.status === "validating"}
                                      className="btn btn-video"
                                      style={{ width: '100%', opacity: post.status === "validating" ? 0.5 : 1 }}
                                    >
                                      {post.status === "validating" ? <><Spinner /> {t('saving')}</> : <><IconEdit /> {t('montageVideo')}</>}
                                    </button>
                                  </>
                                )}
                                {/* Une vidéo ne se « génère » pas : elle se monte. */}
                                {!post.isVideo && (
                                  <button
                                    onClick={() => generateOne(post)}
                                    disabled={!post.brief.trim() || post.status === "generating"}
                                    className="btn btn-primary"
                                    style={{ width: '100%', opacity: (!post.brief.trim() || post.status === "generating") ? 0.45 : 1 }}
                                  >
                                    {post.status === "generating" ? <><Spinner /> {t('generating')}</> : <><IconSpark /> {t('generatePost')}</>}
                                  </button>
                                )}
                              </>
                            ) : (
                              /* Post généré : les textes à gauche, les actions à droite.
                                 Empilés, ils faisaient une carte deux fois plus haute
                                 alors que la largeur ne servait à rien. La colonne des
                                 textes s'étire pour occuper la hauteur de l'aperçu :
                                 sinon la carte se terminait sur un grand vide. */
                              <div className="ws-post-fields" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 210px', gap: 14, alignItems: 'stretch' }}>
                                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {post.texte_visuel && (
                                  <div style={{ borderRadius: 12, background: 'linear-gradient(180deg, var(--card), color-mix(in srgb, var(--mint, #2FD79B) 5%, var(--card)))', border: '1px solid var(--line-2)', borderLeft: '3px solid var(--mint, #2FD79B)', padding: '11px 13px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A36F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V5h16v2M9 5v14M7 19h4"/></svg>
                                      <span className="label" style={{ margin: 0, color: '#16A36F' }}>{t('visualText')}</span>
                                    </div>
                                    <textarea
                                      value={post.texte_visuel}
                                      onChange={(e) => setPosts((prev) => prev.map((p) => p.localId === post.localId ? { ...p, texte_visuel: e.target.value } : p))}
                                      rows={2}
                                      className="input"
                                      style={{ resize: 'none', fontSize: 15, fontWeight: 800, fontFamily: 'var(--display, var(--sans))', letterSpacing: '-0.01em', color: 'var(--ink)', background: 'transparent', border: 'none', padding: 0, outline: 'none', width: '100%', lineHeight: 1.25, boxShadow: 'none' }}
                                    />
                                  </div>
                                )}

                                {post.description && (
                                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>
                                      <span className="label" style={{ margin: 0 }}>{t('igCaption')}</span>
                                    </div>
                                    <textarea
                                      value={post.description}
                                      onChange={(e) => setPosts((prev) => prev.map((p) => p.localId === post.localId ? { ...p, description: e.target.value } : p))}
                                      className="input"
                                      style={{ flex: 1, minHeight: 96, resize: 'none', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}
                                    />
                                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                      <input
                                        value={refinePrompts[post.localId] ?? ''}
                                        onChange={e => setRefinePrompts(prev => ({ ...prev, [post.localId]: e.target.value }))}
                                        onKeyDown={e => { if (e.key === 'Enter') refineCaption(post); }}
                                        placeholder={t('refinePh')}
                                        className="input"
                                        style={{ flex: 1, height: 36, fontSize: 12.5, padding: '0 10px', borderRadius: 'var(--r)', border: '1px solid var(--line)' }}
                                        disabled={refiningIds.has(post.localId)}
                                      />
                                      <button
                                        onClick={() => refineCaption(post)}
                                        disabled={!refinePrompts[post.localId]?.trim() || refiningIds.has(post.localId)}
                                        className="btn btn-ghost"
                                        style={{ height: 36, flexShrink: 0, color: 'var(--mint-2)', fontWeight: 700, opacity: (!refinePrompts[post.localId]?.trim() || refiningIds.has(post.localId)) ? 0.45 : 1 }}
                                      >
                                        {refiningIds.has(post.localId) ? '…' : t('refine')}
                                      </button>
                                    </div>
                                  </div>
                                )}

                                </div>

                                {/* La couverture se choisit dans l'éditeur de montage, une fois la vidéo montée :
                                    avant montage, on ne sait pas encore quelle image représente la vidéo. */}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignSelf: 'start' }}>
                                  {post.isVideo ? (
                                    /* Vidéo : direction l'éditeur de montage. Pas de génération de
                                       texte ici — la légende s'écrit après le montage. */
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      {/* Prémontage IA : dérushage + sous-titres + transitions, appliqués
                                          à l'ouverture pour ne pas avoir à lancer les outils un par un. */}
                                      <label className="card-video" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: '8px 10px', borderRadius: 'var(--r-s)' }}>
                                        <input
                                          type="checkbox"
                                          checked={preEdit[post.localId] ?? true}
                                          onChange={e => setPreEdit(prev => ({ ...prev, [post.localId]: e.target.checked }))}
                                          style={{ accentColor: 'var(--vio)', marginTop: 1, flexShrink: 0 }}
                                        />
                                        <span style={{ minWidth: 0 }}>
                                          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{t('preEditLabel')}</span>
                                          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4 }}>{t('preEditHint')}</span>
                                        </span>
                                      </label>
                                      {post.status !== "validated" && (
                                        <button
                                          onClick={() => validatePost(post)}
                                          disabled={post.status === "validating"}
                                          className="btn btn-video"
                                          style={{ opacity: post.status === "validating" ? 0.5 : 1 }}
                                        >
                                          {post.status === "validating" ? <><Spinner /> {t('saving')}</> : <><IconEdit /> {t('montageVideo')}</>}
                                        </button>
                                      )}
                                      {post.status === "validated" && post.dbId && (
                                        <Link href={`/workspace/${id}/montage/${post.dbId}${(preEdit[post.localId] ?? true) ? '?premontage=1' : ''}`} className="btn btn-video" style={{ textAlign: 'center' }}>
                                          <IconEdit /> {t('openMontage')}
                                        </Link>
                                      )}
                                    </div>
                                  ) : (
                                    /* Photo: standard editor flow */
                                    <>
                                      {post.status !== "validated" && (
                                        <button
                                          onClick={() => openEditorWithTemplatePicker(post)}
                                          disabled={post.status === "validating"}
                                          className="btn btn-dark"
                                          style={{ width: '100%', opacity: post.status === "validating" ? 0.5 : 1 }}
                                        >
                                          {post.status === "validating" ? <><Spinner /> {t('saving')}</> : <><IconEdit /> {t('editVisual')}</>}
                                        </button>
                                      )}
                                      {post.status === "validated" && post.dbId && (
                                        <Link href={`/workspace/${id}/editor/${post.dbId}`} className="btn btn-dark" style={{ width: '100%', textAlign: 'center' }}>
                                          <IconEdit /> {t('openEditor')}
                                        </Link>
                                      )}
                                      {post.status === "generated" && (
                                        <button onClick={() => generateOne(post)} className="btn btn-ghost btn-icon" title={t('regen')}>
                                          <IconSpark />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
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
                <h2 className="h-title" style={{ fontSize: 20, marginBottom: 24 }}>{t('wsSettings')}</h2>
                <div className="card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                      <label className="label" style={{ display: 'block', marginBottom: 7 }}>{t('clientName')}</label>
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
                        {savingSettings ? t('savingSettings') : <><IconCheck /> {t('save')}</>}
                      </button>
                      <Link href={`/workspace/${id}/style`} className="btn btn-ghost">
                        {t('visualStyle')} <IconChevR />
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
          files={pendingFiles}
          onSeparate={type => createPostItemsWithType(pendingFiles, type)}
          onMontage={(ordered) => createMontagePostItem(ordered)}
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
          {t('postDeleted')}
          <button
            onClick={undoDelete}
            style={{
              padding: '4px 12px', borderRadius: 6,
              background: 'var(--leaf)', color: 'var(--mint-ink)',
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: 'var(--sans)',
            }}
          >
            {t('undo')}
          </button>
        </div>
      )}

      {/* Share modal */}
      {shareOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(10,14,10,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShareOpen(false); }}
        >
          <div style={{ background: 'var(--white)', borderRadius: 'var(--r-xl)', border: '1px solid var(--line)', padding: '28px 28px 24px', width: 480, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(10,14,10,.55)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 className="h-title" style={{ fontSize: 18, marginBottom: 4 }}>{t('shareTitle')}</h2>
                <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>{t('shareHint')}</p>
              </div>
              <button onClick={() => setShareOpen(false)} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--sunk)', border: '1px solid var(--line)', cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>×</button>
            </div>

            {/* Link row */}
            {shareLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, color: 'var(--ink-3)', fontSize: 13 }}>{t('generatingLink')}</div>
            ) : shareToken ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  readOnly
                  value={`https://getklip.fr/preview/${shareToken.token}`}
                  style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink-2)', minWidth: 0 }}
                  onFocus={e => e.currentTarget.select()}
                />
                <button
                  onClick={copyShareLink}
                  className="btn btn-sm"
                  style={{ background: shareCopied ? 'var(--leaf)' : 'var(--forest)', color: shareCopied ? 'var(--mint-ink)' : 'var(--cream)', border: 'none', fontWeight: 700, whiteSpace: 'nowrap', transition: 'background .2s' }}
                >
                  {shareCopied ? t('copied') : t('copy')}
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--danger)', textAlign: 'center' }}>{t('linkError')}</p>
            )}

            {/* Expiry toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                <span style={{ position: 'relative', width: 36, height: 20, display: 'inline-block' }}>
                  <input
                    type="checkbox"
                    checked={shareExpiryEnabled}
                    onChange={e => setShareExpiryEnabled(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                  />
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: 20,
                    background: shareExpiryEnabled ? 'var(--leaf)' : 'var(--line)',
                    transition: 'background .2s',
                  }} />
                  <span style={{
                    position: 'absolute', top: 2, left: shareExpiryEnabled ? 18 : 2, width: 16, height: 16,
                    borderRadius: '50%', background: '#fff',
                    transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
                  }} />
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{t('expiryDate')}</span>
              </label>
              {shareExpiryEnabled && (
                <input
                  type="date"
                  value={shareExpiryDate}
                  min={todayISO}
                  onChange={e => setShareExpiryDate(e.target.value)}
                  style={{ fontFamily: 'var(--sans)', fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--sunk)', color: 'var(--ink)', width: '100%' }}
                />
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
              <button
                onClick={regenerateShareToken}
                disabled={shareLoading}
                className="btn btn-ghost btn-sm"
                style={{ flex: 1, justifyContent: 'center', display: 'flex', gap: 6, alignItems: 'center' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
                </svg>
                {t('regenLink')}
              </button>
              <button
                onClick={copyShareLink}
                disabled={!shareToken || shareLoading}
                className="btn btn-sm"
                style={{ flex: 1, background: 'var(--leaf)', color: 'var(--mint-ink)', border: 'none', fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
                {shareCopied ? t('linkCopied') : t('copyLink')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Prémontage en lot ─────────────────────────────────────────────
          On voit les montages se faire ici, au lieu d'ouvrir l'éditeur post
          par post. Violet : c'est de la vidéo. */}
      {batch && (
        <div className="kb-scrim" role="dialog" aria-label={t('batchTitle')}>
          <div className="kb-card">
            <div className="kb-head">
              <span className="kb-mark" aria-hidden><AssistantMark size={28} /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="kb-title">{t('batchTitle')}</div>
                <div className="kb-sub">{t('batchRunning', { done: batch.filter((b) => b.status === 'done' || b.status === 'error').length, total: batch.length })}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={stopBatch}>
                {batch.every((b) => b.status === 'done' || b.status === 'error') ? t('close') : t('batchStop')}
              </button>
            </div>

            <ul className="kb-list">
              {batch.map((b) => {
                const steps = [t('preStepRushes'), t('preStepSpeech'), t('preStepCaptions')];
                return (
                  <li key={b.localId} className={`kb-row is-${b.status}`}>
                    <span className="kb-dot" aria-hidden>
                      {b.status === 'done' && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                      {b.status === 'error' && '!'}
                    </span>
                    <span className="kb-name">{b.name}</span>
                    <span className="kb-state">
                      {b.status === 'queued' && t('batchQueued')}
                      {b.status === 'running' && (b.detail || steps[b.step] || '…')}
                      {b.status === 'done' && t('batchDone')}
                      {b.status === 'error' && b.detail}
                    </span>
                    {b.status === 'done' && (() => {
                      const post = posts.find((p) => p.localId === b.localId);
                      return post?.dbId ? <Link href={`/workspace/${id}/montage/${post.dbId}`} className="kb-open">{t('batchOpen')}</Link> : null;
                    })()}
                  </li>
                );
              })}
            </ul>
            <p className="kb-hint">{t('batchHint')}</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        /* Prémontage en lot */
        .kb-scrim{position:fixed;inset:0;z-index:9400;display:grid;place-items:center;padding:24px;
          background:radial-gradient(120% 90% at 50% 0%,rgba(102,86,217,.30),transparent 62%),rgba(12,14,10,.66);
          backdrop-filter:blur(7px);}
        .kb-card{width:min(520px,100%);max-height:88vh;overflow:auto;display:flex;flex-direction:column;gap:14px;
          padding:20px;border-radius:18px;background:var(--paper);
          border:1px solid color-mix(in srgb,var(--vio) 40%,transparent);
          box-shadow:0 26px 60px -22px color-mix(in srgb,var(--vio) 70%,transparent),0 4px 14px rgba(0,0,0,.16);}
        .kb-head{display:flex;align-items:center;gap:11px;}
        .kb-mark{flex-shrink:0;display:grid;place-items:center;width:28px;height:28px;
          filter:drop-shadow(0 3px 8px color-mix(in srgb,var(--vio) 45%,transparent));}
        .kb-title{font-family:var(--display);font-weight:800;font-style:italic;font-size:17px;color:var(--ink);line-height:1.15;}
        .kb-sub{font-size:11.5px;color:var(--ink-3);margin-top:2px;}
        .kb-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;}
        .kb-row{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:10px;background:var(--sunk);font-size:12.5px;}
        .kb-row.is-running{background:color-mix(in srgb,var(--vio) 12%,var(--sunk));}
        .kb-dot{width:16px;height:16px;flex-shrink:0;display:grid;place-items:center;border-radius:50%;
          font-size:10px;font-weight:900;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--vio) 35%,transparent);}
        .is-done .kb-dot{background:var(--vio);color:#fff;box-shadow:none;}
        .is-error .kb-dot{background:var(--warn);color:#fff;box-shadow:none;}
        .is-running .kb-dot{border:2px solid color-mix(in srgb,var(--vio) 28%,transparent);border-top-color:var(--vio);
          box-shadow:none;animation:spin .7s linear infinite;}
        .kb-name{flex:1;min-width:0;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .kb-state{flex-shrink:0;font-size:11.5px;color:var(--ink-3);max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .is-error .kb-state{color:var(--warn);}
        .kb-open{flex-shrink:0;font-size:11.5px;font-weight:800;color:var(--vio);text-decoration:underline;
          text-underline-offset:3px;}
        .kb-hint{margin:0;font-size:11.5px;color:var(--ink-3);line-height:1.5;}
        @media(prefers-reduced-motion:reduce){.is-running .kb-dot{animation:none;}}
        /* Textes et actions côte à côte tant qu'il y a la place. */
        @media(max-width:1100px){
          .ws-post-fields{grid-template-columns:1fr !important;}
        }
        @media(max-width:767px){
          .ws-hero-grid{grid-template-columns:1fr !important;}
          .ws-hero-grid > *:last-child{display:none !important;}
          .ws-upload-grid{grid-template-columns:1fr !important;}
          .ws-gen-grid{grid-template-columns:repeat(2,1fr) !important;}
        }
      `}</style>
    </div>
  );
}
