"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import PostPreviewPane from "@/components/PostPreviewPane";
import AiThinkingPanel from "@/components/AiThinkingPanel";
import type { PreEditHooks } from "./montage/[postId]/preEdit";
import { runPreEdit, newTranscriptCache } from "./montage/[postId]/preEdit";
import { renderComposedVisual, renderElementSpecs, renderTemplateVisual } from "@/lib/composeRender";
import { buildCarouselSlide, themeFromBrand } from "@/lib/carouselDesigns";
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
import { thumbUrl } from "@/components/MediaThumb";

// ─── Types ────────────────────────────────────────────────────────────────────

type PostStatus = "idle" | "generating" | "generated" | "validating" | "validated";
type PostType   = "post" | "reel" | "story" | "carrousel";

// Formats alignés sur l'éditeur (PT_FORMAT_MAP) : post = portrait 3:4 (1080×1440),
// reel/story = vertical 9:16 (1080×1920). Le carrousel n'a plus de format à lui :
// il se publie au format du post.
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
  post:      { label: "Publication",  tKey: "ptPost",      color: "#1F7A4D", bg: "#1F7A4D15", format: "1080×1440 px" },
  reel:      { label: "Reel",         tKey: "ptReel",      color: "#6656D9", bg: "#6656D915", format: "1080×1920 px" },
  story:     { label: "Story",        tKey: "ptStory",     color: "#C8732B", bg: "#C8732B15", format: "1080×1920 px" },
  carrousel: { label: "Carrousel",    tKey: "ptCarrousel", color: "#C2456F", bg: "#C2456F15", format: "1080×1080 px" },
};

// Ratio d'affichage réel selon le format (post = 3:4, reel/story = 9:16).
// Un ancien post « carrousel » garde le carré dans lequel il a été dessiné.
function aspectForPostType(t?: PostType | null): string {
  if (t === "reel" || t === "story") return "9 / 16";
  if (t === "carrousel") return "1 / 1";
  return "3 / 4";
}
// Règles de format : une vidéo ne peut être que Reel/Story, une photo Post/Story (pas Reel).
// « Carrousel » n'est plus un type à choisir : une publication DEVIENT un carrousel
// dès qu'on lui ajoute des pages dans l'éditeur, au même format qu'un post simple.
// Le type reste connu pour lire les posts créés avant cette fusion.
function allowedPostTypes(isVideo: boolean): PostType[] {
  return isVideo ? ["reel", "story"] : ["post", "story"];
}
// Types proposés au choix (l'ancien « carrousel » n'en fait plus partie).
const SELECTABLE_POST_TYPES: PostType[] = ["post", "reel", "story"];
// Un ancien post « carrousel » se lit comme une publication : c'est le même format
// et le même parcours, seule la façon de le créer a changé.
function typeForSelector(t?: PostType | null): PostType {
  return t === "carrousel" ? "post" : (t ?? "post");
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

// Suivi visible d'une génération : rien de plus que l'étape en cours (0..3).
// Le journal détaillé appartient à l'écran de montage vidéo ; sur une carte de
// post, il prenait toute la place pour une opération de quelques secondes.
interface GenFlow {
  step: number;
  done: boolean;
  failed?: boolean;
}

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
  /** Aperçu du visuel COMPOSÉ (data URL), rendu hors écran après génération.
   *  L'aperçu ne montrait que la photo brute : le visuel fini n'existait pas
   *  encore, la composition ayant lieu dans l'éditeur. */
  preview_url?: string;
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
  /** Identité visuelle — nécessaire à l'aperçu composé, qui applique la charte. */
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_family: string | null;
  font_secondary: string | null;
  /** Nombre de mots par sous-titre choisi à la création du client. */
  subtitle_max_words: number | null;
}

interface PostTemplate {
  id: string;
  name: string;
  thumbnail_url: string | null;
  format_id: string;
  background_style: { type: string; color?: string; colorFrom?: string; colorTo?: string; angle?: number } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  text_zones: any[];  // full CanvasEl[] — needed to build zone-aware prompt + editor_json
  // Template de carrousel : une entrée par page. Absent = template une page,
  // décrite par `text_zones`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pages?: { elements?: any[] }[] | null;
}

// Pages d'un template, toujours au moins une — `text_zones` reste la première page
// pour les templates enregistrés avant les templates multi-pages.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function templatePages(tpl: PostTemplate | null): any[][] {
  if (!tpl) return [];
  if (Array.isArray(tpl.pages) && tpl.pages.length) {
    return tpl.pages.map(p => (Array.isArray(p?.elements) ? p.elements : []));
  }
  return [Array.isArray(tpl.text_zones) ? tpl.text_zones : []];
}

const PHOTO_PLACEHOLDER_SRC_COMPOSER = '__PHOTO_PLACEHOLDER__';

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PostStatus, { label: string; tKey: string; bg: string; color: string }> = {
  idle:       { label: "Brouillon",   tKey: "stIdle",       bg: "var(--sunk)",      color: "var(--ink-3)" },
  generating: { label: "Génération…", tKey: "stGenerating", bg: "var(--leaf-soft)", color: "var(--leaf-ink)" },
  generated:  { label: "Généré",      tKey: "stGenerated",  bg: "var(--leaf-soft)", color: "var(--leaf-ink)" },
  validating: { label: "Sauvegarde…", tKey: "stValidating", bg: "var(--warn-soft)", color: "var(--warn)" },
  // `--leaf` est LE vert d'accent de la charte (celui des boutons) ; `--mint`
  // est réservé aux micro-accents et sortait du ton.
  validated:  { label: "Validé",      tKey: "stValidated",  bg: "var(--leaf)",      color: "var(--leaf-ink)" },
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

// « carousel » : plusieurs photos réunies en UN post, une page par photo — ce que
// « montage » fait pour les vidéos.
type ImportMode = 'separate' | 'montage' | 'carousel';

function fmtClipDuration(s: number) {
  const total = Math.round(s);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// Un objectURL par fichier, révoqué au démontage. Les URL doivent vivre aussi
// longtemps que les vignettes qui les affichent : on ne peut pas les libérer
// dès la première image peinte.
// Un aperçu local (blob:) retient TOUT le fichier en mémoire jusqu'à sa
// libération explicite — le navigateur ne peut pas le deviner. Sur une session
// d'import de plusieurs vidéos, les aperçus oubliés se comptent en centaines de
// mégaoctets : l'onglet ralentit puis Safari le tue. Chaque fois qu'un aperçu
// est remplacé par l'URL définitive, il faut donc le relâcher.
function releasePreview(url?: string | null) {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

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

function TypePickerModal({ files, onSeparate, onMontage, onCarousel, onClose }: {
  files: File[];
  onSeparate: (type: PostType) => void;
  onMontage: (ordered: File[]) => void;
  onCarousel: (ordered: File[]) => void;
  onClose: () => void;
}) {
  const t = useTranslations('workspace');
  const nVideos = files.filter(f => f.type.startsWith('video/')).length;
  const nPhotos = files.length - nVideos;
  const multi = files.length >= 2;
  const allVideos = files.length > 0 && nVideos === files.length;
  const allPhotos = files.length > 0 && nPhotos === files.length;
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
    // Photos : un seul post, une page par photo — c'est ce qui fait un carrousel.
    ...(allPhotos ? [{ id: 'carousel' as ImportMode, icon: TYPE_ICONS.carrousel, title: 'Un seul post', desc: `Carrousel de ${files.length} pages, une par photo` }] : []),
    // Vidéos : un seul post monté, les plans à la suite.
    ...(!allPhotos ? [{ id: 'montage' as ImportMode, icon: GROUP_ICONS.montage, title: t('groupMontage'), desc: t('groupMontageDesc', { count: files.length }) }] : []),
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
            {/* Plus de tuile « Carrousel » : plusieurs pages sur une publication
                suffisent à en faire un, et c'est le mode « un seul post » ci-dessus
                qui sert à en créer un depuis plusieurs médias. */}
            {SELECTABLE_POST_TYPES.map(id => POST_TYPE_CFG[id] && (
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
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--sans)', marginBottom: 4 }}>{t(POST_TYPE_CFG[id].tKey)}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{POST_TYPE_CFG[id].format}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Récap montage + ORDRE DES PLANS : on met les rushes dans le bon ordre
            AVANT que le montage démarre, sinon tout arrive mélangé. */}
        {(mode === 'montage' || mode === 'carousel') && (
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
          <button onClick={() => {
            const ordered = order.map(i => files[i]);
            if (mode === 'montage') onMontage(ordered);
            else if (mode === 'carousel') onCarousel(ordered);
            else onSeparate(selected);
          }} className="btn btn-primary" style={{ flex: 2 }}>{t('continue')}</button>
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
              borderRadius: 'var(--r)', padding: '12px 8px 10px',
              cursor: 'pointer', gap: 8, transition: 'border-color .15s, background .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint-2)'; e.currentTarget.style.background = 'var(--mint-soft)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.background = 'var(--card)'; }}
          >
            <div style={{
              width: '100%', aspectRatio: '3/4', borderRadius: 8,
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
                  borderRadius: 'var(--r)', padding: '8px 8px 10px',
                  cursor: 'pointer', gap: 8, transition: 'border-color .15s, box-shadow .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint-2)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--mint-soft)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{
                  width: '100%', aspectRatio: '3/4', borderRadius: 8, overflow: 'hidden',
                  background: gradientCss, position: 'relative',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {/* Un template de carrousel se choisit en connaissance de cause :
                      il produira un post à plusieurs pages, pas une image seule. */}
                  {Array.isArray(tpl.pages) && tpl.pages.length > 1 && (
                    <span style={{ position: 'absolute', top: 6, left: 6, zIndex: 1, background: 'rgba(13,15,10,.62)', color: '#fff', fontSize: 9.5, fontWeight: 800, fontFamily: 'var(--mono)', padding: '2px 6px', borderRadius: 999, backdropFilter: 'blur(4px)' }}>
                      {tpl.pages.length} pages
                    </span>
                  )}
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
  // Les libellés du prémontage vivent dans l'espace « montage ».
  const tm = useTranslations('montage');
  const tVoice = useTranslations('voice');

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);

  // Filet de sécurité : en quittant l'écran, les aperçus restés locaux (import
  // abandonné, envoi échoué) doivent être relâchés. La navigation côté client
  // ne recharge pas la page, donc sans ça ils survivent jusqu'à la fermeture de
  // l'onglet.
  const postsRef = useRef<PostItem[]>([]);
  postsRef.current = posts;
  useEffect(() => () => { postsRef.current.forEach(p => releasePreview(p.photo_url)); }, []);
  const [activeTab, setActiveTab] = useState<Tab>("produire");
  const [generatingAll, setGeneratingAll] = useState(false);
  // Journal de génération par post : ce que l'IA est en train de faire, étape par
  // étape, jusqu'à l'état « prêt » qui se voit.
  const [genFlow, setGenFlow] = useState<Record<string, GenFlow>>({});
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

  /* Une vidéo DÉJÀ prémontée ne repart pas pour un tour.

     La case reste cochée d'un post à l'autre, et c'est très bien : c'est un
     réglage, pas une action. Mais elle envoyait `?premontage=1` même vers une
     vidéo déjà prémontée, qui relançait alors tout et écrasait le travail fait
     depuis. On coche donc la case, mais on ne l'écoute plus une fois le
     prémontage passé. La marque est posée par le monteur lui-même, dans ce
     navigateur, au moment où il termine. */
  const dejaPremonte = useCallback((dbId?: string | null) => {
    if (!dbId || typeof window === "undefined") return false;
    try { return !!localStorage.getItem(`klip-premontage-${dbId}`); } catch { return false; }
  }, []);
  /** La case, telle qu'elle compte VRAIMENT pour ce post. */
  const preEditActif = useCallback(
    (localId: string, dbId?: string | null) => (preEdit[localId] ?? true) && !dejaPremonte(dbId),
    [preEdit, dejaPremonte],
  );
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
      // Les couleurs et polices ne servaient à rien ici tant que l'aperçu montrait
      // la photo brute ; l'aperçu composé applique la charte, il lui faut donc.
      // subtitle_max_words : le prémontage en lot découpe les sous-titres ici,
      // il doit le faire au nombre de mots choisi pour ce client (sinon le
      // monteur affichait bien le style de la charte, mais des blocs découpés
      // au réglage d'usine).
      .select("id, name, logo_url, sector, tone, words_to_use, words_to_avoid, company_description, brand_voice_prompt, description_style, caption_examples, instagram_username, primary_color, secondary_color, accent_color, font_family, font_secondary, subtitle_max_words")
      .eq("id", id)
      .single();

    if (ws) { setWorkspace(ws); setWorkspaceName(ws.name); }

    const { data: dbPosts } = await supabase
      .from("posts")
      .select("id, photo_url, exported_image_url, brief, description, texte_visuel, status, created_at, thumbnail_url, template_id, post_type")
      .eq("workspace_id", id)
      .order("created_at", { ascending: false })
      // Un client actif depuis un an, c'est plusieurs centaines de posts rendus
      // d'un bloc, chacun avec sa vignette. Au-delà, l'historique complet est à
      // sa place dans la page Historique.
      .limit(150);

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

    // `pages` (templates de carrousel) est arrivé après coup : tant que la
    // migration n'est pas passée en base, la colonne n'existe pas et la requête
    // entière échouerait — donc plus AUCUN template ne s'afficherait. On retombe
    // alors sur la sélection d'avant, qui suffit à travailler.
    const baseCols = "id, name, thumbnail_url, format_id, background_style, text_zones";
    const withPages = await supabase
      .from("post_templates")
      .select(`${baseCols}, pages`)
      .eq("workspace_id", id)
      .order("sort_order", { ascending: true });
    const tplRes = withPages.error
      ? await supabase
          .from("post_templates")
          .select(baseCols)
          .eq("workspace_id", id)
          .order("sort_order", { ascending: true })
      : withPages;
    if (tplRes.data) setTemplates(tplRes.data as PostTemplate[]);
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

  // Réunit plusieurs PHOTOS en UN post : chaque photo deviendra une page du
  // carrousel à la génération (cf. generateOne → groupUrls).
  function createCarouselPostItem(files: File[]) {
    if (!files.length) return;
    const item: PostItem = {
      localId: crypto.randomUUID(),
      file: files[0],
      groupedFiles: files,
      isVideo: false,
      photo_url: URL.createObjectURL(files[0]),
      brief: "", description: "", texte_visuel: "",
      status: "idle" as PostStatus,
      templateId: null,
      post_type: "post",
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

  // ── Journal de génération ───────────────────────────────────────────────────
  // Trois étapes réelles, dans l'ordre où elles se produisent : lire la marque,
  // écrire les textes, dessiner le visuel. Le journal n'est jamais décoratif —
  // chaque ligne est écrite au moment où la chose arrive vraiment.
  const genStart = (localId: string) =>
    setGenFlow(f => ({ ...f, [localId]: { step: 0, done: false } }));
  const genStep = (localId: string, step: number) =>
    setGenFlow(f => {
      const cur = f[localId];
      if (!cur) return f;
      return { ...f, [localId]: { ...cur, step } };
    });
  const genEnd = (localId: string, ok: boolean) => {
    setGenFlow(f => {
      const cur = f[localId];
      if (!cur) return f;
      return { ...f, [localId]: { ...cur, step: 3, done: true, failed: !ok } };
    });
    // L'état « fini » reste à l'écran le temps d'être lu, puis la carte reprend
    // sa forme normale avec le visuel généré.
    if (ok) setTimeout(() => setGenFlow(f => { const { [localId]: _drop, ...rest } = f; return rest; }), 2600);
  };

  // ── Aperçu du visuel COMPOSÉ ────────────────────────────────────────────────
  // L'aperçu du Composer ne montrait que la photo importée, parce que le visuel
  // fini n'existait pas encore : la composition et son rendu vivent dans
  // l'éditeur, où il y a un canvas. On refait donc le chemin ici, hors écran.
  //
  // Best-effort de bout en bout : un aperçu qui échoue laisse simplement la photo
  // brute à l'écran. Il ne doit jamais empêcher de générer, d'éditer ou de publier
  // — c'est un confort, pas une étape du parcours.
  async function buildPreview(item: PostItem): Promise<void> {
    if (item.isVideo) return; // une vidéo montre déjà son premier plan
    try {
      // Format du cadre selon le type de publication, comme dans l'éditeur.
      const [w, h] = item.post_type === 'reel' || item.post_type === 'story'
        ? [1080, 1920]
        : item.post_type === 'carrousel' ? [1080, 1080] : [1080, 1440];

      let url: string | null = null;

      if (item.post_type === 'carrousel') {
        // Couverture seulement : c'est elle qui décide si le carrousel est lu, et
        // elle se dessine sans appel IA (le sujet est déjà écrit). Le carrousel
        // complet, lui, s'écrit à l'ouverture de l'éditeur.
        const theme = themeFromBrand(workspace ?? null);
        const els = buildCarouselSlide(
          'cover-statement',
          { titre: item.texte_visuel || item.brief, corps: item.description?.split('\n')[0] },
          theme, w, h, 1, 6,
        );
        url = renderElementSpecs(els, w, h);
      } else {
        const texts = [item.texte_visuel].filter((t): t is string => !!t && !!t.trim());
        if (!texts.length) return; // rien à composer : la photo brute suffit
        const res = await fetch('/api/compose-layout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: item.photo_url?.startsWith('http') ? item.photo_url : undefined,
            // Le modèle ne peut pas REGARDER un blob local, mais la composition,
            // elle, doit quand même réserver sa zone photo.
            hasPhoto: !!item.photo_url,
            format: { w, h }, workspaceId: id,
            brand: { primary: workspace?.primary_color, secondary: workspace?.secondary_color, accent: workspace?.accent_color },
            blocks: texts,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const layout = Array.isArray(data?.layouts) ? data.layouts[0] : null;
        if (!layout) return;
        // Une composition DESSINÉE (système de design ou template maison) arrive
        // en calques complets : on la rend telle quelle. Sans ce chemin, le
        // Composer retombait sur la photo brute et l'utilisateur ne découvrait le
        // vrai visuel qu'en ouvrant l'éditeur.
        if (Array.isArray(layout.template?.elements) && layout.template.elements.length) {
          url = await renderTemplateVisual({
            elements: layout.template.elements,
            sourceFormat: layout.template.sourceFormat ?? null,
            // Y compris un blob local : l'aperçu se dessine dans le navigateur,
            // il n'a pas besoin que la photo soit déjà en ligne.
            photoUrl: item.photo_url || null,
            w, h,
          });
          if (url) setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, preview_url: url! } : p)));
          return;
        }
        if (!layout.blocks?.length) return;
        url = await renderComposedVisual({
          photoUrl: item.photo_url?.startsWith('http') ? item.photo_url : null,
          blocks: layout.blocks, accents: layout.accents, scrim: layout.scrim,
          brand: {
            primary: workspace?.primary_color, secondary: workspace?.secondary_color, accent: workspace?.accent_color,
            display: workspace?.font_family, body: workspace?.font_secondary,
          },
          w, h,
        });
      }

      if (url) setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, preview_url: url! } : p)));
    } catch (e) {
      console.warn('[buildPreview] aperçu composé indisponible :', e);
    }
  }

  async function generateOne(item: PostItem): Promise<void> {
    if (!item.brief.trim() || item.status === "generating") return;
    setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "generating", error: undefined } : p)));
    // Le clic sur « Générer » ne disait rien de ce qui se passait : on ouvre le
    // journal de la génération sur la carte, avec les étapes réellement franchies.
    genStart(item.localId);
    try {
      // ── Template zone detection ────────────────────────────────────────────
      const selectedTemplate = item.templateId
        ? templates.find(t => t.id === item.templateId) ?? null
        : null;
      // Un template peut décrire plusieurs pages : l'IA doit remplir les zones de
      // TOUTES les pages en une fois, pour que le carrousel se tienne d'une page
      // à l'autre (page 1 = accroche, dernière = conclusion / appel à l'action).
      const tplPages = templatePages(selectedTemplate);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allZones: any[] = tplPages.flat();
      // Only send zones that have a role — those are AI-fillable
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const templateZones = tplPages.flatMap((pageZones: any[], pageIdx: number) => pageZones
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((z: any) => z.type === 'text' && z.role)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((z: any) => ({
          id: z.id,
          role: z.role,
          // Champ nommé par l'auteur du template : c'est LUI qui dit ce que le bloc
          // contient, l'IA n'a plus à le deviner.
          roleLabel: z.roleLabel || undefined,
          roleHint: z.roleHint || undefined,
          // Longueur du texte que le modèle porte à cet endroit : la mise en page
          // a été dessinée pour CETTE longueur-là.
          sampleLen: typeof z.text === 'string' && z.text.trim() ? z.text.trim().length : undefined,
          page: tplPages.length > 1 ? pageIdx + 1 : undefined,
          pageCount: tplPages.length > 1 ? tplPages.length : undefined,
          width: Math.max(z.width ?? 200, 1),
          height: Math.max(z.fontSize + ((z.paddingV ?? z.padding ?? 8) * 2), 1),
          fontSize: Math.max(z.fontSize ?? 24, 1),
        })));

      genStep(item.localId, 1);

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
        genStep(item.localId, 2);

        // Upload photo first (need public URL for editor_json)
        let dbId = item.dbId;
        let pUrl = item.photo_url;
        // Photos réunies en UN post : chacune devient une page du carrousel, il
        // faut donc les envoyer toutes, pas seulement la couverture.
        const groupPhotos = !item.isVideo && item.groupedFiles && item.groupedFiles.length > 1
          ? item.groupedFiles
          : null;
        const groupUrls: string[] = [];
        const uploadOne = async (file: File): Promise<string | null> => {
          const ext = file.name.split(".").pop() ?? (item.isVideo ? "mp4" : "jpg");
          const path = `${id}/${crypto.randomUUID()}.${ext}`;
          const bucket = item.isVideo ? "videos" : "photos";
          const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
          if (uploadError) return null;
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
          return urlData.publicUrl;
        };
        if (groupPhotos) {
          for (const f of groupPhotos) {
            const u = await uploadOne(f);
            if (u) groupUrls.push(u);
          }
          if (groupUrls.length) pUrl = groupUrls[0];
        } else if (item.file) {
          const u = await uploadOne(item.file);
          if (u) pUrl = u;
        }
        const proxyOf = (u: string) => (u.startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(u)}` : '');

        // ── Build editor_json from template zones + AI zone blocks ───────────
        let editorJson: string | undefined;
        if (selectedTemplate && data.zoneBlocks && typeof data.zoneBlocks === 'object') {
          const zoneBlocks = data.zoneBlocks as Record<string, string>;
          const proxyUrl = proxyOf(pUrl);
          // Autant de pages que nécessaire : celles du template, ou celles des
          // photos réunies si elles sont plus nombreuses (la dernière page du
          // template se répète pour habiller les photos en trop).
          const pageCount = Math.max(tplPages.length, groupUrls.length || 1);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pagesToBuild: any[][] = Array.from({ length: pageCount }, (_, i) =>
            tplPages[Math.min(i, tplPages.length - 1)] ?? []);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const slidesFromTemplate = pagesToBuild.map((pageZones: any[], i: number) => {
            // Photo de CETTE page quand plusieurs photos ont été réunies.
            const pagePhoto = groupUrls[i] ? proxyOf(groupUrls[i]) : (i === 0 ? proxyUrl : '');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hasPhotoZone = pageZones.some((z: any) => z.type === 'image' && z.src === PHOTO_PLACEHOLDER_SRC_COMPOSER);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const elements = pageZones.map((el: any) => {
              // Fill text zones with AI-generated content
              if (el.type === 'text' && zoneBlocks[el.id]) {
                // `origText` garde la trace de ce que le modèle écrivait ici :
                // l'éditeur s'en sert pour retrouver la même silhouette (même
                // nombre de lignes, même ancrage) malgré un texte de longueur
                // différente.
                return { ...el, text: zoneBlocks[el.id], origText: el.text };
              }
              // Replace photo placeholder with actual photo
              if (el.type === 'image' && el.src === PHOTO_PLACEHOLDER_SRC_COMPOSER) {
                return { ...el, id: `tpl-p${i}-${el.id}`, src: pagePhoto };
              }
              // Les identifiants doivent rester uniques d'une page à l'autre,
              // sinon deux pages bâties sur le même modèle se marchent dessus.
              return { ...el, id: `tpl-p${i}-${el.id}` };
            });
            return {
              id: `slide-${i + 1}`,
              elements,
              // Sans photos multiples, l'image importée n'habille que la première
              // page : les suivantes partent du fond du template.
              proxyUrl: hasPhotoZone ? '' : pagePhoto,
              ...(i === 0 ? { bgStyle: selectedTemplate.background_style ?? undefined } : {}),
            };
          });

          editorJson = JSON.stringify({ version: 2, slides: slidesFromTemplate });
        } else if (groupUrls.length > 1) {
          // Sans template : une page par photo, chacune en fond de sa page.
          // L'éditeur habillera la première à l'ouverture.
          editorJson = JSON.stringify({
            version: 2,
            slides: groupUrls.map((u, i) => ({ id: `slide-${i + 1}`, elements: [], proxyUrl: proxyOf(u) })),
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
        releasePreview(item.photo_url);
        setPosts((prev) => prev.map((p) => p.localId === item.localId ? { ...p, dbId, photo_url: pUrl, texte_visuel, description, status: "generated", templateId: item.templateId ?? p.templateId, error: undefined } : p));
        void buildPreview({ ...item, dbId, photo_url: pUrl, texte_visuel, description })
          .finally(() => genEnd(item.localId, true));
      } else {
        // « Non autorisé » ne dit rien à personne : si la session est vraiment
        // perdue (rafraîchissement compris), on donne le geste à faire.
        const errMsg = res.status === 401
          ? "Session expirée — rechargez la page ou reconnectez-vous."
          : (typeof data?.error === "string" ? data.error : data?.error?.message) || "La génération a échoué. Réessayez dans un instant.";
        setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "idle", error: errMsg } : p)));
        genEnd(item.localId, false);
      }
    } catch {
      setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "idle", error: "Erreur réseau" } : p)));
      genEnd(item.localId, false);
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
    // Aperçu immédiat — l'aperçu précédent, s'il était local, n'a plus de raison
    // d'occuper la mémoire.
    releasePreview(post.photo_url);
    setPosts(prev => prev.map(p => p.localId === post.localId ? { ...p, photo_url: preview, exported_image_url: null } : p));
    try {
      const path = `photos/${id}/${post.dbId ?? post.localId}-${Date.now()}.${file.name.split('.').pop() || 'jpg'}`;
      const { error } = await supabase.storage.from('photos').upload(path, file, { upsert: true, contentType: file.type });
      if (error) return;
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path);
      const url = urlData.publicUrl;
      if (post.dbId) await supabase.from('posts').update({ photo_url: url, exported_image_url: null }).eq('id', post.dbId);
      releasePreview(preview);
      setPosts(prev => prev.map(p => p.localId === post.localId ? { ...p, photo_url: url, file, exported_image_url: null } : p));
    } catch { /* silent */ }
  }

  // ── Validate ──────────────────────────────────────────────────────────────

  // Enregistre un post (envoi des fichiers + ligne en base) SANS naviguer.
  // Séparé de validatePost pour que la génération en lot puisse enchaîner
  // plusieurs posts sans quitter l'écran de sélection.
  // Colonnes de `posts` que le code écrit mais qu'AUCUNE migration du dépôt ne
  // crée : une base qui n'a pas reçu le bon ALTER TABLE à la main fait échouer
  // l'insert entier avec « column ... does not exist » (Postgres 42703, PostgREST
  // PGRST204). Un post perdu parce qu'une colonne facultative manque, c'est le
  // pire rapport dégât/bénéfice possible : on retire la colonne fautive et on
  // réessaie, exactement comme le fait déjà la création de client.
  //
  // Ce n'est pas un remplacement de migration : `supabase/add-posts-columns.sql`
  // ajoute ces colonnes pour de bon. C'est le filet en attendant qu'elle soit
  // passée, et pour les bases qui ne le seront jamais.
  const POST_SOFT_COLUMNS = ["post_type", "template_id", "montage_json", "texte_visuel"] as const;

  async function insertPost(payload: Record<string, unknown>) {
    const p = { ...payload };
    for (let i = 0; i <= POST_SOFT_COLUMNS.length; i++) {
      const res = await supabase.from("posts").insert(p).select().single();
      if (!res.error) return res;
      const msg = res.error.message || "";
      const missing = POST_SOFT_COLUMNS.find((c) => c in p && msg.includes(c));
      if (!missing) return res;
      console.warn(`[savePost] colonne « ${missing} » absente de la base — réessai sans elle. Passez supabase/add-posts-columns.sql.`);
      delete p[missing];
    }
    return await supabase.from("posts").insert(p).select().single();
  }

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
      let saveError: string | null = null;
      if (!dbId) {
        const { data: post, error } = await insertPost({
          workspace_id: id, photo_url: pUrl, brief: item.brief,
          description: item.description, texte_visuel: item.texte_visuel,
          status: "validated",
          template_id: templateId ?? null,
          post_type: item.post_type ?? 'post',
          ...(montageJson ? { montage_json: montageJson } : {}),
        });
        if (post) dbId = post.id;
        else saveError = error?.message ?? "insert";
      } else {
        const { error } = await supabase.from("posts").update({
          photo_url: pUrl,
          // Le sujet est ré-enregistré : c'est lui qui alimente l'écriture du
          // carrousel à l'ouverture de l'éditeur, il ne doit pas rester périmé.
          brief: item.brief,
          description: item.description, texte_visuel: item.texte_visuel,
          status: "validated",
          ...(templateId !== undefined ? { template_id: templateId ?? null } : {}),
          ...(montageJson ? { montage_json: montageJson } : {}),
        }).eq("id", dbId);
        if (error) saveError = error.message;
      }

      // ÉCHEC D'ENREGISTREMENT : le post ne doit surtout PAS passer « validé ».
      //
      // C'est ce qui se passait — l'erreur de Supabase n'était même pas lue, le
      // post était marqué validé sans identifiant en base, et l'interface se
      // retrouvait sans aucune action : « Éditer le visuel » ne s'affiche que
      // tant que le post n'est pas validé, « Ouvrir l'éditeur » seulement s'il a
      // un dbId. Ni l'un ni l'autre → le bouton disparaissait purement et
      // simplement, sans un mot d'explication (retour de Martin).
      if (!dbId || saveError) {
        console.error("[savePost] enregistrement impossible :", saveError);
        setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "generated", error: "save" } : p)));
        // La cause EXACTE est affichée, pas seulement « ça a échoué ». Un message
        // générique oblige l'utilisateur à ouvrir la console pour qu'on puisse
        // diagnostiquer — autant lui donner directement de quoi nous le dire.
        alert(`${t('saveFailed')}\n\n${saveError ?? 'raison inconnue'}`);
        return null;
      }

      releasePreview(item.photo_url);
      setPosts((prev) => prev.map((p) => p.localId === item.localId ? { ...p, dbId, photo_url: pUrl, status: "validated" } : p));
      return { dbId, clips: montageJson?.clips ?? null };
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
  type BatchState = { localId: string; name: string; status: "queued" | "running" | "done" | "error"; step: number; detail?: string; lines: string[] };
  const [batch, setBatch] = useState<BatchState[]>([]);
  const queueRef = useRef<PostItem[]>([]);
  const workingRef = useRef(false);
  const batchAbort = useRef<AbortController | null>(null);
  // Le cache de transcription vit au-delà d'un lancement : deux vidéos qui
  // partagent un rush ne le font écouter qu'une fois, même lancées séparément.
  const trCacheRef = useRef(newTranscriptCache());

  const videoPosts = posts.filter((p) => p.isVideo);
  const batchFor = (localId: string) => batch.find((b) => b.localId === localId);

  // Un prémontage tourne DANS l'onglet : quitter la page l'interrompt. On note
  // donc en local ceux qui n'ont pas fini, pour les relancer en revenant — sinon
  // on retrouvait une carte figée sans savoir que rien n'avançait plus.
  // Clé par identifiant de post en base : les identifiants locaux, eux, sont
  // régénérés à chaque chargement.
  const PENDING_KEY = `klip-preedit-${id}`;
  const readPending = (): string[] => {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); } catch { return []; }
  };
  const writePending = (ids: string[]) => {
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(Array.from(new Set(ids)))); } catch { /* stockage indisponible */ }
  };
  const markPending = (dbId: string) => writePending([...readPending(), dbId]);
  const clearPending = (dbId: string) => writePending(readPending().filter((x) => x !== dbId));

  const patchBatch = (localId: string, next: Partial<BatchState>) =>
    setBatch((prev) => prev.map((b) => (b.localId === localId ? { ...b, ...next } : b)));

  const pushBatchLine = (localId: string, line: string) =>
    setBatch((prev) => prev.map((b) => (b.localId === localId
      ? (b.lines[b.lines.length - 1] === line ? b : { ...b, lines: [...b.lines, line] })
      : b)));

  // Les libellés du prémontage vivent dans l'espace « montage » : les demander à
  // `t` (espace « workspace ») affichait la clé brute, workspace.preStep…
  function preEditLogLine(ev: Parameters<NonNullable<PreEditHooks['onLog']>>[0]): string | null {
    switch (ev.type) {
      case 'startRushes':      return tm('logStartRushes', { n: ev.n });
      case 'analyzing':        return tm('logAnalyzing', { name: ev.name });
      case 'speechMapped':     return tm('logSpeechMapped', { n: ev.n });
      case 'trimmed':          return tm('logTrimmed', { s: ev.seconds.toFixed(1) });
      case 'clipClean':        return tm('logClipClean');
      case 'transcribing':     return tm('logTranscribing', { name: ev.name });
      case 'wordsHeard':       return tm('logWordsHeard', { n: ev.n });
      case 'cutsFound':        return tm('logCutsFound', { n: ev.n });
      case 'speechClean':      return tm('logSpeechClean');
      case 'captions':         return ev.byWords ? tm('logCaptionsWords', { n: ev.n }) : tm('logCaptionsSegments', { n: ev.n });
      case 'transcribeFailed': return tm('logTranscribeFailed', { name: ev.name });
      case 'allDone':          return tm('logAllDone');
      default:                 return null;
    }
  }

  // File d'attente NON bloquante : on peut lancer une vidéo, puis une autre
  // pendant que la première tourne. En file plutôt qu'en vrai parallèle — chaque
  // prémontage sature déjà le processeur et l'API de transcription, trois de
  // front seraient plus lents et déclencheraient des quotas.
  function enqueuePreEdit(targets: PostItem[]) {
    const fresh = targets.filter((p) => {
      const st = batchFor(p.localId)?.status;
      return st !== "queued" && st !== "running" && st !== "done";
    });
    if (!fresh.length) return;
    setBatch((prev) => [
      ...prev.filter((b) => !fresh.some((f) => f.localId === b.localId)),
      ...fresh.map((p) => ({ localId: p.localId, name: p.brief?.trim() || p.file?.name || t('untitledPost'), status: "queued" as const, step: -1, lines: [] })),
    ]);
    queueRef.current.push(...fresh);
    void drainQueue();
  }

  async function drainQueue() {
    if (workingRef.current) return;
    workingRef.current = true;
    const ctrl = batchAbort.current ?? new AbortController();
    batchAbort.current = ctrl;
    try {
      while (queueRef.current.length) {
        if (ctrl.signal.aborted) break;
        const item = queueRef.current.shift()!;
        patchBatch(item.localId, { status: "running", step: 0 });
        try {
          const saved = await savePost(item, null);
          if (!saved) { patchBatch(item.localId, { status: "error", detail: t('batchErrSave') }); continue; }
          markPending(saved.dbId);

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
          if (!clips?.length) { clearPending(saved.dbId); patchBatch(item.localId, { status: "error", detail: t('batchErrNoClips') }); continue; }

          const res = await runPreEdit(clips, {
            subMaxWords: workspace?.subtitle_max_words ?? null,
            cache: trCacheRef.current,
            signal: ctrl.signal,
            onStep: (i) => patchBatch(item.localId, { step: i }),
            onLog: (ev) => {
              const line = preEditLogLine(ev);
              if (line) pushBatchLine(item.localId, line);
              if (ev.type === "analyzing" || ev.type === "transcribing") patchBatch(item.localId, { detail: ev.name });
            },
          });

          // On n'écrit QUE si le pipeline a produit quelque chose d'utilisable :
          // un post dont l'analyse échoue reste strictement dans son état d'avant.
          if (!res.clips.length) { clearPending(saved.dbId); patchBatch(item.localId, { status: "error", detail: t('batchErrEmpty') }); continue; }
          const { data: cur } = await supabase.from("posts").select("montage_json").eq("id", saved.dbId).single();
          const prev = (cur?.montage_json as Record<string, unknown> | null) ?? {};
          await supabase.from("posts").update({
            montage_json: {
              ...prev,
              clips: res.clips,
              ...(res.captions.length ? { captions: res.captions, rawSegments: res.rawSegments, rawWords: res.rawWords } : {}),
              formatId: (prev.formatId as string) || "story",
              // Marque le montage comme prémonté : l'ouvrir ensuite ne relancera
              // pas l'analyse par-dessus le résultat.
              preEditedAt: new Date().toISOString(),
            },
          }).eq("id", saved.dbId);

          clearPending(saved.dbId);
          patchBatch(item.localId, {
            status: "done", step: 3,
            // Une réussite partielle se dit : sans ça, le trou de sous-titres
            // apparaissait plus tard sans explication.
            detail: res.failed.length ? t('toastPartialTranscribe', { n: res.failed.length }) : undefined,
          });
        } catch {
          patchBatch(item.localId, { status: "error", detail: t('batchErrGeneric') });
        }
      }
    } finally {
      workingRef.current = false;
      batchAbort.current = null;
    }
  }

  // Progression du prémontage, affichée DANS la carte du post — là où la zone
  // était vide. C'est exactement le panneau qu'on avait dans l'éditeur : étapes,
  // journal qui s'écrit, barre d'avancement. La place vide sert enfin à voir
  // l'IA travailler, et on peut en lancer d'autres à côté.
  // Reprise : en revenant sur la page, on relance les prémontages que la
  // navigation avait interrompus. Le traitement vit dans l'onglet — il ne peut
  // pas continuer pendant qu'on est ailleurs — mais il ne doit pas rester en
  // plan pour autant. Une seule tentative par chargement : si le post est
  // toujours marqué après ça, c'est un échec réel, pas une interruption.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || !posts.length) return;
    const pending = readPending();
    if (!pending.length) return;
    resumedRef.current = true;
    const toResume = posts.filter((p) => p.isVideo && p.dbId && pending.includes(p.dbId));
    // Les identifiants orphelins (post supprimé depuis) sont oubliés.
    writePending(toResume.map((p) => p.dbId!));
    if (toResume.length) enqueuePreEdit(toResume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length]);

  function PreEditCard({ post }: { post: PostItem }) {
    const b = batchFor(post.localId);
    if (!b) return null;
    const done = b.status === 'done' || b.status === 'error';
    return (
      <AiThinkingPanel
        inline
        title={b.status === 'done' ? t('batchDone') : b.status === 'error' ? t('batchErrGeneric') : tm('preEditRunning')}
        subtitle={b.status === 'error' ? b.detail : (b.detail || (b.status === 'queued' ? t('batchQueued') : undefined))}
        steps={[
          { id: 'rushes',   label: tm('preStepRushes') },
          { id: 'speech',   label: tm('preStepSpeech') },
          { id: 'captions', label: tm('preStepCaptions') },
        ]}
        activeStep={done ? 3 : b.step}
        lines={b.lines}
        progress={b.step < 0 ? 0 : Math.min(1, b.step / 3)}
      />
    );
  }

  // Accès au montage une fois le prémontage terminé (colonne d'actions).
  function PreEditDone({ post }: { post: PostItem }) {
    const b = batchFor(post.localId);
    if (b?.status !== 'done' || !post.dbId) return null;
    return (
      <Link href={`/workspace/${id}/montage/${post.dbId}`} className="btn btn-video" style={{ justifyContent: 'center' }}>
        <IconEdit /> {t('openMontage')}
      </Link>
    );
  }

  async function validatePost(item: PostItem, templateId?: string | null) {
    if (item.status === "validating") return;
    setPosts((prev) => prev.map((p) => (p.localId === item.localId ? { ...p, status: "validating" } : p)));
    try {
      const saved = await savePost(item, templateId);
      // Le drapeau de prémontage suit jusqu'au montage, qui enchaîne alors tout seul.
      if (saved) {
        const pre = preEditActif(item.localId, saved.dbId) ? "?premontage=1" : "";
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
                    <button onClick={() => enqueuePreEdit(videoPosts)} disabled={!!batch} className="btn btn-video" style={{ flexShrink: 0 }}>
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
                        <div key={post.localId} className="card klip-card-in ws-post-card" style={{ position: 'relative', overflow: 'hidden', display: 'flex', borderRadius: 16, border: '1px solid var(--line-2)', boxShadow: '0 1px 2px rgba(13,15,10,.03), 0 14px 32px -20px rgba(13,15,10,.28)', animationDelay: `${Math.min(pIdx, 8) * 55}ms` }}>
                          {/* Retirer le post — au coin de la CARTE, donc présent à
                              tous les stades. La croix ne vivait que sur l'aperçu du
                              post pas encore généré : une fois généré, plus aucun
                              endroit pour se débarrasser d'un post dont on ne veut pas.
                              La suppression reste annulable quelques secondes. */}
                          <button
                            onClick={() => removePost(post)}
                            title={t('deletePost')}
                            aria-label={t('deletePost')}
                            style={{
                              position: 'absolute', top: 10, right: 10, zIndex: 3,
                              width: 26, height: 26, borderRadius: '50%',
                              background: 'var(--white)', border: '1px solid var(--line)',
                              color: 'var(--ink-3)', cursor: 'pointer', padding: 0,
                              display: 'grid', placeItems: 'center',
                              boxShadow: '0 1px 4px rgba(13,15,10,.14)', transition: 'color .12s, border-color .12s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--warn)'; e.currentTarget.style.borderColor = 'var(--warn)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
                          >
                            <svg width="11" height="11" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                          </button>
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
                                mediaUrl={post.exported_image_url || post.preview_url || post.photo_url}
                                caption={post.description || ''}
                                postType={post.post_type}
                                platforms={['instagram']}
                                compact
                                mediaHeight="230px"
                              />
                            ) : (
                            /* Le cadre suit le FORMAT du post (3:4 pour une publication).
                               Une hauteur fixe donnait un aperçu presque carré : on ne
                               voyait pas le cadrage réel avant d'ouvrir l'éditeur. */
                            <div style={{ position: 'relative', height: 230, width: 'auto', maxWidth: '100%', aspectRatio: aspectForPostType(post.post_type), margin: '0 auto', borderRadius: 13, overflow: 'hidden', background: '#000' }}>
                              {post.isVideo ? (
                                /* `preload="none"` : sans lui, le navigateur ouvre un
                                   décodeur vidéo par vignette dès l'affichage de la
                                   grille, et une douzaine suffit à faire recharger
                                   l'onglet. Le fichier n'est cherché qu'au clic. */
                                <video src={post.photo_url} controls preload="none" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                              ) : (() => {
                                /* Même règle que partout ailleurs : on affiche une
                                   version réduite, jamais l'original. */
                                const brut = post.exported_image_url || post.preview_url || post.photo_url;
                                return brut ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={thumbUrl(brut, 480)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : null;
                              })()}
                              {/* Nom du client (overlay) + badge vidéo */}
                              <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 5 }}>
                                <span style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 9px', borderRadius: 99, fontFamily: 'var(--mono)', letterSpacing: '.06em', textTransform: 'uppercase', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {workspace?.instagram_username || workspace?.name || t('clientFallback')}
                                </span>
                                {post.isVideo && (
                                  <span style={{ background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 9.5, fontWeight: 700, padding: '3px 7px', borderRadius: 99, fontFamily: 'var(--mono)', backdropFilter: 'blur(4px)', letterSpacing: '.05em' }}>▶ {post.groupedFiles && post.groupedFiles.length > 1 ? `${t('videoBadge')} · ${post.groupedFiles.length}` : t('videoBadge')}</span>
                                )}
                                {/* Photos réunies : on doit voir tout de suite que ce
                                    post en contient plusieurs, et combien. */}
                                {!post.isVideo && post.groupedFiles && post.groupedFiles.length > 1 && (
                                  <span style={{ background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 9.5, fontWeight: 700, padding: '3px 7px', borderRadius: 99, fontFamily: 'var(--mono)', backdropFilter: 'blur(4px)', letterSpacing: '.05em' }}>CARROUSEL · {post.groupedFiles.length}</span>
                                )}
                              </div>
                            </div>
                            )}
                            {/* Type de publication — contrôle segmenté posé dans un
                                renfoncement plutôt que quatre boutons encadrés :
                                on lit le choix actif d'un coup d'œil. */}
                            <div className="seg ws-type-pills" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, width: '100%' }}>
                              {SELECTABLE_POST_TYPES.map(pt => {
                                const active = typeForSelector(post.post_type) === pt;
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
                              {/* Décalé du bord : la croix de suppression occupe le coin. */}
                              <span style={{ marginRight: 30 }}><StatusChip status={post.status} /></span>
                            </div>

                          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 18px 16px' }}>
                            {/* Error */}
                            {post.error && (
                              <p style={{ fontSize: 12, color: 'var(--warn)', background: 'var(--warn-soft)', borderRadius: 'var(--r-s)', padding: '6px 10px' }}>{post.error}</p>
                            )}

                            {/* Ce que l'IA est en train de faire — le clic sur « Générer »
                                laissait sinon l'écran muet jusqu'au résultat. */}
                            {genFlow[post.localId] && (() => {
                              const g = genFlow[post.localId];
                              // Une seule ligne : où on en est, et rien d'autre. Le
                              // journal détaillé est le langage de l'écran de montage
                              // vidéo — sur une carte de post, il écrase tout le reste.
                              const stepLabel = ['Lecture de la marque', 'Écriture des textes', 'Mise en page du visuel'][Math.min(g.step, 2)];
                              const pct = Math.round(Math.min(1, g.step / 3) * 100);
                              return (
                                <div style={{
                                  padding: '10px 12px', borderRadius: 'var(--r-s)',
                                  background: g.failed ? 'var(--warn-soft)' : g.done ? 'var(--mint-soft)' : 'var(--sunk)',
                                  border: `1px solid ${g.failed ? 'var(--warn)' : g.done ? 'var(--mint-2)' : 'var(--line)'}`,
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                    {g.done ? (
                                      <span style={{ width: 15, height: 15, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
                                        background: g.failed ? 'var(--warn)' : 'var(--mint-2)', color: '#fff' }}>
                                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                          {g.failed ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 12.5l5 5 11-11" />}
                                        </svg>
                                      </span>
                                    ) : <Spinner />}
                                    <span style={{ fontSize: 12.5, fontWeight: 700, color: g.failed ? 'var(--warn)' : 'var(--ink-2)' }}>
                                      {g.failed ? 'Génération interrompue' : g.done ? 'Publication prête' : `${stepLabel}…`}
                                    </span>
                                  </div>
                                  {!g.done && (
                                    <div style={{ marginTop: 8, height: 3, borderRadius: 99, background: 'var(--line)', overflow: 'hidden' }}>
                                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--mint-2)', transition: 'width .35s ease' }} />
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

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
                                    {batchFor(post.localId) ? <PreEditCard post={post} /> : (
                                    <button
                                      onClick={() => (preEdit[post.localId] ?? true) ? enqueuePreEdit([post]) : validatePost(post)}
                                      disabled={post.status === "validating"}
                                      className="btn btn-video"
                                      style={{ width: '100%', opacity: post.status === "validating" ? 0.5 : 1 }}
                                    >
                                      {post.status === "validating" ? <><Spinner /> {t('saving')}</> : <><IconEdit /> {t('montageVideo')}</>}
                                    </button>
                                    )}
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
                                {/* Sur une vidéo, cette colonne était vide : c'est là que le
                                    prémontage se montre, en grand, plutôt que dans un filet. */}
                                {batchFor(post.localId) && <PreEditCard post={post} />}
                                {post.texte_visuel && (
                                  <div style={{ borderRadius: 12, background: 'linear-gradient(180deg, var(--card), color-mix(in srgb, var(--leaf) 14%, var(--card)))', border: '1px solid var(--line-2)', borderLeft: '3px solid var(--leaf)', padding: '11px 13px' }}>
                                    {/* Le libellé et le filet peignaient un vert codé en dur (#16A36F),
                                        hors charte. Ils suivent maintenant les jetons de la marque. */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--leaf-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V5h16v2M9 5v14M7 19h4"/></svg>
                                      <span className="label" style={{ margin: 0, color: 'var(--leaf-ink)' }}>{t('visualText')}</span>
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
                                      <PreEditDone post={post} />
                                      {/* Même garde-fou que côté photo : validé sans dbId = aucun
                                          montage ouvrable, on garde le bouton qui réessaie. */}
                                      {(post.status !== "validated" || !post.dbId) && !batchFor(post.localId) && (
                                        <button
                                          onClick={() => (preEdit[post.localId] ?? true) ? enqueuePreEdit([post]) : validatePost(post)}
                                          disabled={post.status === "validating"}
                                          className="btn btn-video"
                                          style={{ opacity: post.status === "validating" ? 0.5 : 1 }}
                                        >
                                          {post.status === "validating" ? <><Spinner /> {t('saving')}</> : <><IconEdit /> {t('montageVideo')}</>}
                                        </button>
                                      )}
                                      {/* Un prémontage terminé affiche déjà son propre accès via
                                          PreEditDone : sans cette condition, les deux boutons
                                          « Ouvrir le montage » se superposaient. Celui-ci ne sert
                                          qu'au cas sans prémontage, et porte alors ?premontage=1
                                          pour le lancer à l'ouverture. */}
                                      {post.status === "validated" && post.dbId && batchFor(post.localId)?.status !== 'done' && (
                                        <Link href={`/workspace/${id}/montage/${post.dbId}${preEditActif(post.localId, post.dbId) ? '?premontage=1' : ''}`} className="btn btn-video" style={{ textAlign: 'center' }}>
                                          <IconEdit /> {t('openMontage')}
                                        </Link>
                                      )}
                                    </div>
                                  ) : (
                                    /* Photo: standard editor flow */
                                    <>
                                      {/* `|| !post.dbId` : ceinture et bretelles. Un post
                                          « validé » sans identifiant en base ne peut ouvrir
                                          aucun éditeur — mieux vaut lui laisser le bouton qui
                                          RETENTE l'enregistrement que ne rien afficher du tout. */}
                                      {(post.status !== "validated" || !post.dbId) && (
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
          onCarousel={(ordered) => createCarouselPostItem(ordered)}
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

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}

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
