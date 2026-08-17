'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Sidebar from '@/components/Sidebar';
import SubtitleStyleEditor from '@/components/SubtitleStyleEditor';
import {
  SUB_STYLES, effectiveSubStyle, loadSubTemplates, saveSubTemplates,
  DEFAULT_SUB_POS, DEFAULT_WORDS_PER_CAPTION,
  type SubTemplate, type SubCustom,
} from '../montage/[postId]/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Workspace {
  id: string;
  name: string;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  logo_url: string | null;
  logo_dark_url: string | null;
  font_family: string | null;
}

interface BgStyle {
  type: 'gradient' | 'solid';
  color?: string;
  angle?: number;
  colorFrom?: string;
  colorTo?: string;
}

interface PostTemplate {
  id: string;
  workspace_id: string;
  name: string;
  format_id: string;
  background_style: BgStyle;
  text_zones: any[];
  // Template de carrousel : une entrée par page (absent = template une page).
  pages?: { elements?: any[] }[] | null;
  logo_placement: { x: number; y: number; width: number; height: number } | null;
  thumbnail_url: string | null;
  sort_order: number;
  created_at: string;
}

// ─── Format definitions ───────────────────────────────────────────────────────

const FORMATS = [
  { id: 'ig-portrait', labelKey: 'formatPortraitFull', sub: '1080×1350', w: 360, h: 450 },
  { id: 'ig-square',   labelKey: 'formatSquareFull',   sub: '1080×1080', w: 420, h: 420 },
  { id: 'ig-story',    labelKey: 'formatStoryFull',    sub: '1080×1920', w: 253, h: 450 },
  { id: 'facebook',    labelKey: 'formatFacebookFull', sub: '1200×630',  w: 420, h: 221 },
] as const;

// Libellé de réglage — même voix que les autres panneaux du produit.
const subLabel: React.CSSProperties = {
  display: 'block', marginBottom: 6, fontSize: 10.5, fontWeight: 800,
  color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em',
  fontFamily: 'var(--mono)',
};

// Polices proposées pour les sous-titres. Valeurs CSS directement utilisables
// par le rendu du montage, qui lit `font` tel quel.
const SUB_FONTS: { label: string; value: string }[] = [
  { label: 'Archivo (titrage)', value: 'var(--display)' },
  { label: 'Sans (interface)', value: 'var(--sans)' },
  { label: 'Mono', value: 'var(--mono)' },
  { label: 'Instrument Serif', value: "'Instrument Serif', serif" },
  { label: 'Impact', value: 'Impact, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
];

const panelInput: React.CSSProperties = {
  width: '100%', background: 'var(--white)', border: '1px solid var(--line)',
  borderRadius: 'var(--r-s)', padding: '7px 10px', color: 'var(--ink)',
  fontSize: 13.5, outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--sans)',
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const t = useTranslations('workspaceTemplates');
  const { id: workspaceId } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [templates, setTemplates] = useState<PostTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [formatFilter, setFormatFilter] = useState('all');

  useEffect(() => {
    if (!workspaceId) return;
    async function load() {
      setLoading(true);
      const [{ data: ws }, res] = await Promise.all([
        supabase.from('workspaces').select('id,name,primary_color,secondary_color,accent_color,logo_url,logo_dark_url,font_family').eq('id', workspaceId).single(),
        fetch(`/api/templates?workspaceId=${workspaceId}`),
      ]);
      setWorkspace(ws);
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.templates ?? []);
      }
      setLoading(false);
    }
    load();
  }, [workspaceId, supabase]);

  const filteredTemplates = formatFilter === 'all'
    ? templates
    : templates.filter(tpl => tpl.format_id === formatFilter);

  function openNew() {
    router.push(`/workspace/${workspaceId}/template-editor/new`);
  }

  function openEdit(tpl: PostTemplate) {
    router.push(`/workspace/${workspaceId}/template-editor/${tpl.id}`);
  }

  async function deleteTemplate(id: string) {
    if (!confirm(t('confirmDeleteTemplate'))) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    setTemplates(prev => prev.filter(tpl => tpl.id !== id));
  }

  const primaryColor = workspace?.primary_color ?? '#2FD79B';
  const palette = [workspace?.primary_color, workspace?.secondary_color, workspace?.accent_color].filter(Boolean) as string[];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="app">
      <Sidebar />
      <div className="work">

        {/* Topbar */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href={`/workspace/${workspaceId}`} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)',
              textDecoration: 'none', padding: '4px 0',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              {workspace?.name ?? '…'}
            </a>
            <span style={{ color: 'var(--line)', fontSize: 14 }}>/</span>
            <h1 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{t('title')}</h1>
          </div>
          <button onClick={openNew} className="btn btn-primary btn-sm" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            {t('newTemplate')}
          </button>
        </div>

        <div className="scroll">
          <div className="page screen-in" style={{ maxWidth: 1320 }}>

            {/* Brand hero header */}
            {workspace && (
              <div style={{ position: 'relative', borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 22 }}>
                <div style={{ height: 132, background: primaryColor, position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 80% 0%, rgba(255,255,255,.13), transparent 60%)' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, padding: '0 24px 22px', marginTop: -36 }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: 18, flexShrink: 0,
                    background: primaryColor,
                    display: 'grid', placeItems: 'center',
                    fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'var(--mono)',
                    boxShadow: '0 0 0 4px var(--canvas)',
                  }}>
                    {workspace.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ paddingBottom: 4, flex: 1, minWidth: 0 }}>
                    <h1 className="h-display" style={{ fontSize: 26, margin: 0 }}>{workspace.name}</h1>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 }}>
                      {t('modelsCount', { count: templates.length })}
                    </div>
                  </div>
                  <button onClick={openNew} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end', marginBottom: 2 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                    {t('newTemplate')}
                  </button>
                </div>
              </div>
            )}

            {/* Charte — palette + typography */}
            {workspace && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 26 }} className="kit-charte">
                {/* Palette */}
                <div className="card" style={{ padding: 22 }}>
                  <div className="label" style={{ marginBottom: 16 }}>{t('paletteTitle')}</div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {palette.length > 0 ? palette.map((col, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'center' }}>
                        <span style={{ width: 64, height: 64, borderRadius: 14, background: col, boxShadow: 'inset 0 0 0 1px rgba(13,15,10,.12)' }} />
                        <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', fontFamily: 'var(--mono)' }}>{col}</span>
                      </div>
                    )) : (
                      <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{t('noColors')}</span>
                    )}
                    <a href={`/workspace/${workspaceId}/parametres`} style={{
                      width: 64, height: 64, borderRadius: 14, border: '1.5px solid var(--line)',
                      color: 'var(--ink-3)', display: 'grid', placeItems: 'center',
                      textDecoration: 'none', alignSelf: 'flex-start',
                      transition: 'border-color .14s, color .14s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--mint-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--mint-2)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line)'; (e.currentTarget as HTMLElement).style.color = 'var(--ink-3)'; }}
                      title={t('editPalette')}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                    </a>
                  </div>
                </div>

                {/* Typography */}
                <div className="card" style={{ padding: 22 }}>
                  <div className="label" style={{ marginBottom: 16 }}>{t('typographyTitle')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <div style={{ fontFamily: workspace.font_family || 'var(--display)', fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', lineHeight: 1 }}>
                        {t('titleSample')}
                      </div>
                      <div className="label" style={{ marginTop: 6, fontSize: 9.5 }}>{t('displayFontLabel', { font: workspace.font_family || 'Archivo' })}</div>
                    </div>
                    <div style={{ height: 1, background: 'var(--line)' }} />
                    <div>
                      <div style={{ fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 15, color: 'var(--ink-2)' }}>{t('bodySample')}</div>
                      <div className="label" style={{ marginTop: 6, fontSize: 9.5 }}>{t('bodyFontLabel')}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Templates section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>{t('title')}</h2>
                <span style={{ color: 'var(--ink-3)', fontWeight: 700, fontSize: 14 }}>{filteredTemplates.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--sunk)', borderRadius: 'var(--r-s)', border: '1px solid var(--line)' }}>
                  {[['all', t('filterAll')], ['ig-portrait', t('formatPortraitShort')], ['ig-square', t('formatSquareShort')], ['ig-story', t('formatStoryShort')]].map(([id, label]) => (
                    <button key={id} onClick={() => setFormatFilter(id)} style={{
                      padding: '5px 10px', borderRadius: 6, fontSize: 12.5, fontWeight: 600,
                      cursor: 'pointer', border: 'none',
                      background: formatFilter === id ? 'var(--white)' : 'transparent',
                      color: formatFilter === id ? 'var(--ink)' : 'var(--ink-3)',
                      boxShadow: formatFilter === id ? 'var(--shadow-s)' : 'none',
                      transition: 'all .14s',
                    }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '40px 0' }}>{t('loading')}</div>
            ) : (
              <div className="tpl-grid">
                {/* Create tile */}
                <button onClick={openNew} style={{
                  border: '1.5px solid var(--line)', borderRadius: 'var(--r-m)', background: 'transparent',
                  minHeight: 230, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 12, color: 'var(--ink-3)', transition: 'all .15s', cursor: 'pointer',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--mint-2)'; e.currentTarget.style.color = 'var(--mint-2)'; e.currentTarget.style.background = 'var(--mint-soft)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--sunk)', display: 'grid', placeItems: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{t('newTemplate')}</span>
                </button>

                {filteredTemplates.map(tpl => (
                  <TemplateCard key={tpl.id} tpl={tpl} onEdit={() => openEdit(tpl)} onDelete={() => deleteTemplate(tpl.id)} />
                ))}
              </div>
            )}

            <SubtitleTemplatesSection workspaceId={workspaceId} workspace={workspace} />

            <style>{`
              .tpl-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
              @media (max-width: 1280px) { .tpl-grid { grid-template-columns: repeat(3, 1fr); } }
              @media (max-width: 960px)  { .tpl-grid { grid-template-columns: repeat(2, 1fr); } .kit-charte { grid-template-columns: 1fr !important; } }
              @media (max-width: 560px)  { .tpl-grid { grid-template-columns: 1fr; } }
              .tpl-card:hover .tpl-hover { opacity: 1 !important; }
              .tpl-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-pop); }
            `}</style>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({ tpl, onEdit, onDelete }: { tpl: PostTemplate; onEdit: () => void; onDelete: () => void }) {
  const t = useTranslations('workspaceTemplates');
  const fmt = FORMATS.find(f => f.id === tpl.format_id) ?? FORMATS[0];
  const aspect = fmt.h / fmt.w;
  const zones = Array.isArray(tpl.text_zones) ? tpl.text_zones : [];
  // Un template peut décrire un carrousel entier : on le dit sur la carte, sinon
  // rien ne distingue un modèle d'une page d'un modèle de six.
  const pageCount = Array.isArray(tpl.pages) && tpl.pages.length ? tpl.pages.length : 1;

  return (
    <div className="card tpl-card" style={{
      overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column',
      transition: 'transform .14s, box-shadow .14s',
    }}>
      {/* Thumbnail */}
      <div onClick={onEdit} style={{ width: '100%', paddingTop: `${aspect * 100}%`, position: 'relative', background: 'var(--sunk)', overflow: 'hidden' }}>
        {tpl.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tpl.thumbnail_url} alt={tpl.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <MiniPreview bg={tpl.background_style} />
        )}
        {/* Hover overlay */}
        <div className="tpl-hover" style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(0deg, rgba(12,42,29,.80), rgba(12,42,29,.04) 55%)',
          opacity: 0, transition: 'opacity .16s',
          display: 'flex', alignItems: 'flex-end', gap: 8, padding: 12,
        }}>
          <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={e => { e.stopPropagation(); onEdit(); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            {t('modify')}
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{
              background: 'rgba(255,255,255,.92)', color: '#DC2626', border: 'none',
              borderRadius: 'var(--r-s)', padding: '6px 9px', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
            }}
            title={t('delete')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '11px 14px 13px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpl.name}</p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
            {t('zonesCount', { count: zones.length })}{pageCount > 1 ? ` · ${pageCount} pages` : ''}
          </p>
        </div>
        <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: 10.5, flexShrink: 0 }}>{t(fmt.labelKey)}</span>
      </div>
    </div>
  );
}

// ─── Mini preview ─────────────────────────────────────────────────────────────

function MiniPreview({ bg }: { bg: BgStyle }) {
  const background = bg.type === 'solid'
    ? (bg.color ?? '#000')
    : `linear-gradient(${bg.angle ?? 135}deg, ${bg.colorFrom ?? '#0038FF'}, ${bg.colorTo ?? '#FFFFFF'})`;
  return (
    <div style={{ position: 'absolute', inset: 0, background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 80% 0%, rgba(255,255,255,.10), transparent 60%)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 10px', width: '70%', position: 'relative' }}>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.7)', width: '80%' }} />
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.4)', width: '55%' }} />
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.25)', width: '90%' }} />
      </div>
    </div>
  );
}

// ─── Modèles de sous-titres (vidéo) ───────────────────────────────────────────
// Partagés avec le monteur via localStorage (clé « klip-sub-templates »). Permet de
// créer/supprimer ici des modèles réutilisables dans le module Montage.

function SubtitleTemplatesSection({ workspaceId, workspace }: { workspaceId: string; workspace: Workspace | null }) {
  const t = useTranslations('workspaceTemplates');
  const tse = useTranslations('subtitleEditor');
  const [list, setList] = useState<SubTemplate[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [styleId, setStyleId] = useState(SUB_STYLES[0].id);
  const [custom, setCustom] = useState<SubCustom>({});
  const [maxWords, setMaxWords] = useState(DEFAULT_WORDS_PER_CAPTION);
  const [pos, setPos] = useState(DEFAULT_SUB_POS);
  const frameRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => { setList(loadSubTemplates()); }, []);

  // Le style de base n'a aucune raison d'ignorer la charte du compte : on part
  // de ses couleurs et de sa police, quitte à ce que tout soit ensuite repris
  // à la main. Un nouveau modèle qui ressemble déjà à la marque évite de
  // refaire le même réglage à chaque fois.
  // Point de départ volontairement SOBRE : la police et les couleurs du compte,
  // et rien d'autre. Pas de fond, pas de pilule, pas de contour — un sous-titre
  // lisible posé sur l'image, sur lequel on ajoute ensuite ce qu'on veut.
  // Arriver avec un aplat coloré et un cerclage obligeait à tout défaire avant
  // de pouvoir commencer.
  const charterCustom = useCallback((): SubCustom => ({
    font: workspace?.font_family || undefined,
    fg: '#FFFFFF',
    hi: workspace?.accent_color || workspace?.primary_color || '#BDF2A0',
    bg: 'transparent',
    pill: false,
    stroke: '',
    weight: 800,
  }), [workspace]);

  const openCreator = () => {
    if (creating) { setCreating(false); return; }
    setCustom(charterCustom());
    setStyleId(SUB_STYLES[0].id);
    setName('');
    setMaxWords(DEFAULT_WORDS_PER_CAPTION);
    setPos(DEFAULT_SUB_POS);
    setCreating(true);
  };

  const eff = effectiveSubStyle(styleId, custom);
  const patch = (p: SubCustom) => setCustom(c => ({ ...c, ...p }));
  const hasCharter = !!(workspace?.primary_color || workspace?.font_family);

  function persist(next: SubTemplate[]) { setList(next); saveSubTemplates(next); }
  function create() {
    const tpl: SubTemplate = {
      id: crypto.randomUUID(),
      name: name.trim() || t('defaultTemplateName', { n: list.length + 1 }),
      styleId, custom, maxWords, pos,
    };
    persist([...list, tpl]);
    setCreating(false); setName(''); setCustom({}); setStyleId(SUB_STYLES[0].id);
    setMaxWords(DEFAULT_WORDS_PER_CAPTION); setPos(DEFAULT_SUB_POS);
  }
  function remove(id: string) { persist(list.filter(tpl => tpl.id !== id)); }

  // Déplacement du sous-titre dans le cadre : on travaille en % pour que la
  // position reste juste quel que soit le format de la vidéo.
  const startPosDrag = (e: React.MouseEvent) => {
    const box = frameRef.current;
    if (!box) return;
    e.preventDefault();
    const move = (ev: MouseEvent | React.MouseEvent) => {
      const r = box.getBoundingClientRect();
      setPos({
        x: Math.max(4, Math.min(96, ((ev.clientX - r.left) / r.width) * 100)),
        y: Math.max(4, Math.min(96, ((ev.clientY - r.top) / r.height) * 100)),
      });
    };
    move(e);
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // Libellés de l'éditeur partagé — mêmes clés que le monteur et l'assistant.
  const subEditorLabels = React.useMemo(() => ({
    basic: tse('basic'), font: tse('font'), brandFont: tse('brandFont'), system: tse('system'),
    serif: tse('serif'), mono: tse('mono'), size: tse('size'), style: tse('style'), case: tse('case'),
    align: tse('align'), letterSpacing: tse('letterSpacing'), lineHeight: tse('lineHeight'),
    colors: tse('colors'), text: tse('text'), highlight: tse('highlight'),
    background: tse('background'), none: tse('none'), opacity: tse('opacity'), radius: tse('radius'), pill: tse('pill'),
    stroke: tse('stroke'), thickness: tse('thickness'),
    shadow: tse('shadow'), blur: tse('blur'), offsetX: tse('offsetX'), offsetY: tse('offsetY'),
    glow: tse('glow'), intensity: tse('intensity'),
    transform: tse('transform'), rotation: tse('rotation'),
    anim: tse('anim'), animWords: tse('animWords'), animNone: tse('animNone'),
    layout: tse('layout'), boxWidth: tse('boxWidth'), lines: tse('lines'),
    oneLine: tse('oneLine'), twoLines: tse('twoLines'), threeLines: tse('threeLines'),
    bgWidth: tse('bgWidth'), bgHeight: tse('bgHeight'), spread: tse('spread'),
    tabBasic: tse('tabBasic'), tabBubble: tse('tabBubble'), tabEffects: tse('tabEffects'), curve: tse('curve'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);


  const slider = (label: string, value: number, min: number, max: number, step: number,
                  on: (v: number) => void, fmt: (v: number) => string) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={subLabel}>{label}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 800, color: 'var(--ink-2)' }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => on(parseFloat(e.target.value))} style={{ width: '100%', accentColor: 'var(--mint-2)' }} />
    </div>
  );


  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>{t('subtitlesTitle')}</h2>
          <span style={{ color: 'var(--ink-3)', fontWeight: 700, fontSize: 14 }}>{list.length}</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreator}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          {creating ? t('close') : t('newTemplate')}
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 16px', maxWidth: 620 }}>
        {t('subtitlesDesc')}
      </p>

      {creating && (
        <div className="card" style={{ padding: 18, marginBottom: 18, display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: 22, alignItems: 'start' }}>
          {/* Aperçu — un vrai cadre 9:16, comme le monteur. Le fond vert dégradé
              ne représentait rien : on montre une image neutre, sur laquelle un
              sous-titre blanc se juge comme il se jugera sur une vidéo. Le bloc
              se déplace à la souris, la position est enregistrée dans le modèle. */}
          <div>
            <div
              ref={frameRef}
              onMouseDown={startPosDrag}
              style={{
                position: 'relative', aspectRatio: '9 / 16', borderRadius: 'var(--r)', overflow: 'hidden',
                background: 'linear-gradient(180deg,#3A3D42 0%,#26282C 55%,#151719 100%)',
                cursor: 'grab', userSelect: 'none',
              }}
            >
              {/* Repères de cadrage : sans eux, « en bas » ne veut rien dire. */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px 25%)' }} />
              <span style={{
                position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-50%)',
                maxWidth: '86%', textAlign: 'center', pointerEvents: 'none',
                display: 'inline-block',
                padding: eff.bg !== 'transparent' ? (eff.pill ? '6px 14px' : '5px 10px') : 0,
                borderRadius: eff.pill ? 99 : (eff.radius ?? 8),
                background: eff.bg, color: eff.fg,
                fontFamily: eff.font || 'var(--sans)',
                fontStyle: eff.italic ? 'italic' : 'normal', fontWeight: eff.weight,
                fontSize: 19 * (eff.scale ?? 1),
                lineHeight: eff.lineHeight ?? 1.15,
                letterSpacing: eff.letterSpacing ? `${eff.letterSpacing}em` : undefined,
                textDecoration: eff.underline ? 'underline' : undefined,
                textTransform: eff.uppercase ? 'uppercase' : 'none',
                WebkitTextStroke: eff.stroke ? `${eff.strokeW ?? 2}px ${eff.stroke}` : undefined,
                paintOrder: 'stroke fill',
                textShadow: eff.bg === 'transparent' && !eff.stroke ? '0 2px 8px rgba(0,0,0,.75)' : 'none',
              }}>
                Bonjour <span style={{ color: eff.hi }}>Klip</span>
              </span>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '8px 0 0', textAlign: 'center' }}>
              Glissez le sous-titre pour choisir sa place
            </p>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'center' }}>
              {([['Haut', 18], ['Milieu', 50], ['Bas', 84]] as const).map(([lbl, y]) => (
                <button key={lbl} onClick={() => setPos({ x: 50, y })}
                  className={'wsn-chip' + (Math.abs(pos.y - y) < 3 && Math.abs(pos.x - 50) < 3 ? ' is-on' : '')}
                  style={{ padding: '5px 12px', fontSize: 11.5 }}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* Réglages — l'éditeur complet, le même que dans le monteur vidéo et
              l'assistant nouveau client. Une seule implémentation, donc les
              mêmes possibilités partout : effets, contour, ombre, lueur, casse,
              alignement, mise en page. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t('namePlaceholder')} style={panelInput} />

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                <label style={subLabel}>{t('baseStyleLabel')}</label>
                {hasCharter && (
                  <button onClick={() => setCustom(charterCustom())} className="wsn-chip" style={{ padding: '5px 12px', fontSize: 11.5 }}>
                    Repartir de ma charte
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SUB_STYLES.map(st => (
                  <button key={st.id} onClick={() => { setStyleId(st.id); setCustom({}); }}
                    className={'wsn-chip' + (styleId === st.id ? ' is-on' : '')}
                    style={{ padding: '6px 12px', fontSize: 12 }}>{st.name}</button>
                ))}
              </div>
            </div>

            <SubtitleStyleEditor
              styleId={styleId}
              custom={custom}
              onChange={next => setCustom(next)}
              brandFont={workspace?.font_family ?? null}
              labels={subEditorLabels}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ ...subLabel, marginBottom: 0 }}>{t('lengthLabel')}</label>
              {[1, 2, 3, 4, 6].map(w => (
                <button key={w} onClick={() => setMaxWords(w)}
                  className={'wsn-chip' + (maxWords === w ? ' is-on' : '')}
                  style={{ padding: '5px 11px', fontSize: 11.5 }}>{t('wordsCount', { count: w })}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              <button className="btn btn-primary btn-sm" onClick={create}>{t('saveTemplate')}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {list.length === 0 && !creating ? (
        <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '20px 0' }}>{t('noSubtitleTemplates')}</div>
      ) : (
        <div className="tpl-grid">
          {list.map(tpl => {
            const te = effectiveSubStyle(tpl.styleId, tpl.custom);
            return (
              <div key={tpl.id} className="card" style={{ overflow: 'hidden', padding: 0 }}>
                <div style={{ height: 120, background: 'linear-gradient(150deg,#2b8d57,#0c2a1d)', display: 'grid', placeItems: 'center' }}>
                  <span style={{
                    display: 'inline-block', padding: te.pill ? '5px 12px' : '4px 9px', borderRadius: te.pill ? 99 : 6,
                    background: te.bg, color: te.fg, fontFamily: te.font || 'var(--sans)', fontWeight: te.weight,
                    fontSize: 15 * (te.scale ?? 1),
                    letterSpacing: te.letterSpacing ? `${te.letterSpacing}em` : undefined,
                    textDecoration: te.underline ? 'underline' : undefined,
                    fontStyle: te.italic ? 'italic' : 'normal', textTransform: te.uppercase ? 'uppercase' : 'none',
                    WebkitTextStroke: te.stroke ? `1.3px ${te.stroke}` : undefined, paintOrder: 'stroke fill',
                    textShadow: te.bg === 'transparent' && !te.stroke ? '0 1px 6px rgba(0,0,0,.6)' : 'none',
                  }}>Aa <span style={{ color: te.hi }}>Bb</span></span>
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>{t('wordsPerBlock', { count: tpl.maxWords })}</div>
                  </div>
                  <button onClick={() => remove(tpl.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{t('delete')}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
