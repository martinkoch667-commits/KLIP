'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Layer,
  Rect,
  Stage,
  Text,
  Image as KonvaImage,
  Group,
} from 'react-konva';
import useImage from 'use-image';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Sidebar from '@/components/Sidebar';
import SelectionOverlay from '@/components/SelectionOverlay';

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

interface PostTemplate {
  id: string;
  workspace_id: string;
  name: string;
  format_id: string;
  background_style: BgStyle;
  text_zones: TextZone[];
  logo_placement: LogoPlacement | null;
  thumbnail_url: string | null;
  sort_order: number;
  created_at: string;
}

interface BgStyle {
  type: 'gradient' | 'solid';
  color?: string;
  angle?: number;
  colorFrom?: string;
  colorTo?: string;
}

interface TextZone {
  id: string;
  role: 'titre' | 'sous-titre' | 'accroche' | 'corps' | 'cta' | 'tag' | 'personnalise';
  x: number;
  y: number;
  width: number;
  fontSize: number;
  fontFamily: string;
  fontStyle: string;
  fill: string;
  align: 'left' | 'center' | 'right';
  placeholder: string;
}

interface LogoPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Format definitions ───────────────────────────────────────────────────────

const FORMATS = [
  { id: 'ig-portrait', label: 'Portrait 4:5', sub: '1080×1350', w: 360, h: 450 },
  { id: 'ig-square',   label: 'Carré',         sub: '1080×1080', w: 420, h: 420 },
  { id: 'ig-story',    label: 'Story',          sub: '1080×1920', w: 253, h: 450 },
  { id: 'facebook',    label: 'Facebook Post',  sub: '1200×630',  w: 420, h: 221 },
];

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLES: { id: TextZone['role']; label: string; defaultSize: number; defaultStyle: string }[] = [
  { id: 'titre',       label: 'Titre',       defaultSize: 42, defaultStyle: 'bold' },
  { id: 'sous-titre',  label: 'Sous-titre',  defaultSize: 22, defaultStyle: 'bold' },
  { id: 'accroche',    label: 'Accroche',    defaultSize: 18, defaultStyle: 'normal' },
  { id: 'corps',       label: 'Corps',       defaultSize: 14, defaultStyle: 'normal' },
  { id: 'cta',         label: 'CTA',         defaultSize: 16, defaultStyle: 'bold' },
  { id: 'tag',         label: 'Tag / Badge', defaultSize: 12, defaultStyle: 'bold' },
  { id: 'personnalise',label: 'Personnalisé', defaultSize: 16, defaultStyle: 'normal' },
];

const ROLE_COLORS: Record<string, string> = {
  titre:       '#FFFFFF',
  'sous-titre':'#E0E0E0',
  accroche:    '#FFFFFF',
  corps:       '#CCCCCC',
  cta:         '#2FD79B',
  tag:         '#C8F135',
  personnalise:'#FFFFFF',
};

function newId() { return `z-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; }

// ─── Linear gradient helper for Konva ────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ─── Canvas gradient background component ────────────────────────────────────

function GradientBg({ bg, w, h }: { bg: BgStyle; w: number; h: number }) {
  const stageRef = useRef<HTMLCanvasElement | null>(null);

  if (bg.type === 'solid') {
    return <Rect x={0} y={0} width={w} height={h} fill={bg.color ?? '#000'} />;
  }

  // Gradient via fillLinearGradientColorStops
  const angle = ((bg.angle ?? 135) * Math.PI) / 180;
  const len = Math.sqrt(w * w + h * h);
  const cx = w / 2;
  const cy = h / 2;
  const startX = cx - Math.cos(angle) * len / 2;
  const startY = cy - Math.sin(angle) * len / 2;
  const endX   = cx + Math.cos(angle) * len / 2;
  const endY   = cy + Math.sin(angle) * len / 2;

  const [r1, g1, b1] = hexToRgb(bg.colorFrom ?? '#0038FF');
  const [r2, g2, b2] = hexToRgb(bg.colorTo   ?? '#FFFFFF');

  return (
    <Rect
      x={0} y={0} width={w} height={h}
      fillLinearGradientStartPoint={{ x: startX, y: startY }}
      fillLinearGradientEndPoint={{ x: endX, y: endY }}
      fillLinearGradientColorStops={[
        0, `rgb(${r1},${g1},${b1})`,
        1, `rgb(${r2},${g2},${b2})`,
      ]}
    />
  );
}

// ─── Photo placeholder ────────────────────────────────────────────────────────

function PhotoPlaceholder({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <Group x={x} y={y}>
      <Rect
        width={w} height={h}
        fill="rgba(255,255,255,0.08)"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={1.5}
        dash={[6, 4]}
        cornerRadius={6}
      />
      <Text
        text="PHOTO"
        width={w} height={h}
        align="center" verticalAlign="middle"
        fontSize={12} fontStyle="bold"
        fill="rgba(255,255,255,0.35)"
        fontFamily="Inter, sans-serif"
        listening={false}
      />
    </Group>
  );
}

// ─── Logo on canvas ───────────────────────────────────────────────────────────

function LogoImg({ src, x, y, w, h }: { src: string; x: number; y: number; w: number; h: number }) {
  const [img] = useImage(src, 'anonymous');
  if (!img) return null;
  return <KonvaImage image={img} x={x} y={y} width={w} height={h} />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const supabase = createClientComponentClient();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [templates, setTemplates] = useState<PostTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editor state
  const [editing, setEditing] = useState<PostTemplate | null>(null);
  const [editorName, setEditorName] = useState('');
  const [editorFormat, setEditorFormat] = useState('ig-portrait');
  const [editorBg, setEditorBg] = useState<BgStyle>({ type: 'gradient', angle: 135, colorFrom: '#0038FF', colorTo: '#FFFFFF' });
  const [editorZones, setEditorZones] = useState<TextZone[]>([]);
  const [editorLogo, setEditorLogo] = useState<LogoPlacement | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const stageRef = useRef<any>(null);

  // ── Load workspace & templates ──────────────────────────────────────────────

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

  // ── Format dimensions ───────────────────────────────────────────────────────

  const fmt = FORMATS.find(f => f.id === editorFormat) ?? FORMATS[0];
  const stageW = fmt.w;
  const stageH = fmt.h;

  // ── Open editor for new or existing template ────────────────────────────────

  function openNew() {
    const bg: BgStyle = {
      type: 'gradient',
      angle: 135,
      colorFrom: workspace?.primary_color ?? '#0038FF',
      colorTo: workspace?.secondary_color ?? '#FFFFFF',
    };
    setEditorName('Nouveau template');
    setEditorFormat('ig-portrait');
    setEditorBg(bg);
    setEditorZones([]);
    setEditorLogo(null);
    setSelectedZoneId(null);
    setEditing({ id: '', workspace_id: workspaceId, name: 'Nouveau template', format_id: 'ig-portrait', background_style: bg, text_zones: [], logo_placement: null, thumbnail_url: null, sort_order: 0, created_at: '' });
  }

  function openEdit(tpl: PostTemplate) {
    setEditorName(tpl.name);
    setEditorFormat(tpl.format_id);
    setEditorBg(tpl.background_style);
    setEditorZones(Array.isArray(tpl.text_zones) ? tpl.text_zones : []);
    setEditorLogo(tpl.logo_placement ?? null);
    setSelectedZoneId(null);
    setEditing(tpl);
  }

  // ── Add a text zone ─────────────────────────────────────────────────────────

  function addTextZone(role: TextZone['role']) {
    const cfg = ROLES.find(r => r.id === role)!;
    const zone: TextZone = {
      id: newId(),
      role,
      x: Math.round(stageW * 0.1),
      y: Math.round(stageH * 0.1 + editorZones.length * 60),
      width: Math.round(stageW * 0.8),
      fontSize: cfg.defaultSize,
      fontFamily: workspace?.font_family ?? 'Inter',
      fontStyle: cfg.defaultStyle,
      fill: ROLE_COLORS[role] ?? '#FFFFFF',
      align: 'left',
      placeholder: cfg.label,
    };
    setEditorZones(prev => [...prev, zone]);
    setSelectedZoneId(zone.id);
  }

  // ── Add logo ────────────────────────────────────────────────────────────────

  function addLogo() {
    if (!workspace?.logo_url && !workspace?.logo_dark_url) return;
    setEditorLogo({ x: 20, y: 20, width: 80, height: 40 });
  }

  // ── Remove logo ──────────────────────────────────────────────────────────────

  function removeLogo() { setEditorLogo(null); }

  // ── Delete zone ──────────────────────────────────────────────────────────────

  function deleteZone(id: string) {
    setEditorZones(prev => prev.filter(z => z.id !== id));
    if (selectedZoneId === id) setSelectedZoneId(null);
  }

  // ── Update zone field ────────────────────────────────────────────────────────

  function updateZone(id: string, patch: Partial<TextZone>) {
    setEditorZones(prev => prev.map(z => z.id === id ? { ...z, ...patch } : z));
  }

  // ── Save template ────────────────────────────────────────────────────────────

  async function saveTemplate() {
    if (!editing) return;
    setSaving(true);

    // Capture thumbnail
    let thumbnailUrl: string | null = editing.thumbnail_url ?? null;
    if (stageRef.current) {
      try {
        const dataUrl = stageRef.current.toDataURL({ pixelRatio: 0.5 });
        // Upload to Supabase storage
        const blob = await (await fetch(dataUrl)).blob();
        const path = `templates/${workspaceId}/${editing.id || newId()}.png`;
        const { data: storageData } = await supabase.storage.from('photos').upload(path, blob, { upsert: true, contentType: 'image/png' });
        if (storageData) {
          const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path);
          thumbnailUrl = publicUrl;
        }
      } catch { /* ignore thumbnail errors */ }
    }

    const payload = {
      workspace_id: workspaceId,
      name: editorName,
      format_id: editorFormat,
      background_style: editorBg,
      text_zones: editorZones,
      logo_placement: editorLogo,
      thumbnail_url: thumbnailUrl,
    };

    try {
      if (editing.id) {
        const res = await fetch(`/api/templates/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const { template } = await res.json();
        setTemplates(prev => prev.map(t => t.id === template.id ? template : t));
      } else {
        const res = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const { template } = await res.json();
        setTemplates(prev => [...prev, template]);
      }
      setEditing(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete template ──────────────────────────────────────────────────────────

  async function deleteTemplate(id: string) {
    if (!confirm('Supprimer ce template ?')) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  // ── SelectionOverlay adapter for text zones ──────────────────────────────────

  const selectedZone = editorZones.find(z => z.id === selectedZoneId) ?? null;

  // Convert zone to CanvasEl-like for SelectionOverlay
  const overlayEl = selectedZone ? {
    id: selectedZone.id,
    type: 'text' as const,
    x: selectedZone.x,
    y: selectedZone.y,
    rotation: 0,
    opacity: 1,
    text: selectedZone.placeholder,
    fontSize: selectedZone.fontSize,
    fontFamily: selectedZone.fontFamily,
    fontStyle: selectedZone.fontStyle,
    textDecoration: '',
    fill: selectedZone.fill,
    align: selectedZone.align,
    width: selectedZone.width,
    hasBg: false,
    bgColor: '#000000',
    bgOpacity: 0.5,
    cornerRadius: 4,
    padding: 8,
    paddingH: 8,
    paddingV: 4,
    role: selectedZone.role,
  } : null;

  function handleOverlayChange(patch: Partial<typeof overlayEl>) {
    if (!selectedZoneId) return;
    updateZone(selectedZoneId, patch as Partial<TextZone>);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const logoSrc = workspace?.logo_url ?? workspace?.logo_dark_url ?? '';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />

      <main style={{ marginLeft: 'var(--sb-w)', flex: 1, padding: '32px 40px', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 28, letterSpacing: '-0.04em', color: 'var(--cream)', margin: 0 }}>
              Templates
            </h1>
            <p style={{ color: 'var(--cream-3)', fontSize: 14, marginTop: 4 }}>
              Créez des mises en page réutilisables pour {workspace?.name ?? '…'}
            </p>
          </div>
          <button
            onClick={openNew}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
            Nouveau template
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <p style={{ color: 'var(--cream-3)' }}>Chargement…</p>
        ) : templates.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '80px 0', color: 'var(--cream-3)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
              <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>
            </svg>
            <p style={{ fontSize: 16, margin: 0 }}>Aucun template pour ce client</p>
            <button onClick={openNew} className="btn-secondary">Créer le premier template</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
            {templates.map(tpl => (
              <TemplateCard
                key={tpl.id}
                tpl={tpl}
                onEdit={() => openEdit(tpl)}
                onDelete={() => deleteTemplate(tpl.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Editor overlay ─────────────────────────────────────────────────────── */}
      {editing && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'stretch',
        }}>
          {/* Left panel — tools */}
          <div style={{
            width: 280, background: 'var(--surface)', borderRight: '1px solid var(--cream-4)',
            display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto',
          }}>
            {/* Name & format */}
            <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid var(--cream-4)' }}>
              <label className="label" style={{ color: 'var(--cream-3)', fontSize: 11, display: 'block', marginBottom: 4 }}>NOM DU TEMPLATE</label>
              <input
                value={editorName}
                onChange={e => setEditorName(e.target.value)}
                style={{ width: '100%', background: 'var(--sunk)', border: '1px solid var(--cream-4)', borderRadius: 'var(--r-s)', padding: '7px 10px', color: 'var(--cream)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* Format */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--cream-4)' }}>
              <label className="label" style={{ color: 'var(--cream-3)', fontSize: 11, display: 'block', marginBottom: 8 }}>FORMAT</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {FORMATS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setEditorFormat(f.id)}
                    style={{
                      background: editorFormat === f.id ? 'var(--mint-soft)' : 'var(--sunk)',
                      border: `1px solid ${editorFormat === f.id ? 'var(--mint)' : 'var(--cream-4)'}`,
                      borderRadius: 'var(--r-s)', padding: '7px 10px', textAlign: 'left', cursor: 'pointer',
                      color: editorFormat === f.id ? 'var(--mint)' : 'var(--cream-2)', fontSize: 13, fontWeight: 600,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <span>{f.label}</span>
                    <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}>{f.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Background */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--cream-4)' }}>
              <label className="label" style={{ color: 'var(--cream-3)', fontSize: 11, display: 'block', marginBottom: 8 }}>ARRIÈRE-PLAN</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {(['gradient', 'solid'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setEditorBg(b => ({ ...b, type }))}
                    style={{ flex: 1, padding: '6px 0', borderRadius: 'var(--r-s)', border: `1px solid ${editorBg.type === type ? 'var(--mint)' : 'var(--cream-4)'}`, background: editorBg.type === type ? 'var(--mint-soft)' : 'var(--sunk)', color: editorBg.type === type ? 'var(--mint)' : 'var(--cream-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {type === 'gradient' ? 'Dégradé' : 'Uni'}
                  </button>
                ))}
              </div>
              {editorBg.type === 'solid' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--cream-3)' }}>Couleur</span>
                  <input type="color" value={editorBg.color ?? '#000000'} onChange={e => setEditorBg(b => ({ ...b, color: e.target.value }))} style={{ width: 36, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--cream-3)', width: 50 }}>Départ</span>
                    <input type="color" value={editorBg.colorFrom ?? '#0038FF'} onChange={e => setEditorBg(b => ({ ...b, colorFrom: e.target.value }))} style={{ width: 36, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }} />
                    <span style={{ fontSize: 12, color: 'var(--cream-3)', flex: 1 }}>{editorBg.colorFrom ?? '#0038FF'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--cream-3)', width: 50 }}>Fin</span>
                    <input type="color" value={editorBg.colorTo ?? '#FFFFFF'} onChange={e => setEditorBg(b => ({ ...b, colorTo: e.target.value }))} style={{ width: 36, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }} />
                    <span style={{ fontSize: 12, color: 'var(--cream-3)', flex: 1 }}>{editorBg.colorTo ?? '#FFFFFF'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--cream-3)', width: 50 }}>Angle</span>
                    <input type="range" min={0} max={360} value={editorBg.angle ?? 135} onChange={e => setEditorBg(b => ({ ...b, angle: Number(e.target.value) }))} style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, color: 'var(--cream-3)', width: 30, textAlign: 'right' }}>{editorBg.angle ?? 135}°</span>
                  </div>
                </div>
              )}
            </div>

            {/* Add text zones */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--cream-4)' }}>
              <label className="label" style={{ color: 'var(--cream-3)', fontSize: 11, display: 'block', marginBottom: 8 }}>ZONES DE TEXTE</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ROLES.map(r => (
                  <button
                    key={r.id}
                    onClick={() => addTextZone(r.id)}
                    style={{
                      background: 'var(--sunk)', border: '1px solid var(--cream-4)', borderRadius: 'var(--r-s)',
                      padding: '7px 10px', textAlign: 'left', cursor: 'pointer', color: 'var(--cream-2)',
                      fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROLE_COLORS[r.id], flexShrink: 0 }} />
                    {r.label}
                    <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: 18, lineHeight: 1 }}>+</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Logo */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--cream-4)' }}>
              <label className="label" style={{ color: 'var(--cream-3)', fontSize: 11, display: 'block', marginBottom: 8 }}>LOGO</label>
              {editorLogo ? (
                <button onClick={removeLogo} style={{ background: 'var(--error-soft, #3a1212)', border: '1px solid var(--cream-4)', borderRadius: 'var(--r-s)', padding: '7px 10px', color: 'var(--error, #ff6b6b)', fontSize: 13, cursor: 'pointer', width: '100%' }}>
                  Retirer le logo
                </button>
              ) : (
                <button
                  onClick={addLogo}
                  disabled={!workspace?.logo_url && !workspace?.logo_dark_url}
                  style={{ background: 'var(--sunk)', border: '1px solid var(--cream-4)', borderRadius: 'var(--r-s)', padding: '7px 10px', color: 'var(--cream-2)', fontSize: 13, cursor: 'pointer', width: '100%', opacity: (!workspace?.logo_url && !workspace?.logo_dark_url) ? 0.4 : 1 }}
                >
                  {(!workspace?.logo_url && !workspace?.logo_dark_url) ? 'Aucun logo configuré' : 'Placer le logo'}
                </button>
              )}
            </div>

            {/* Zone inspector */}
            {selectedZone && (
              <ZoneInspector zone={selectedZone} onChange={patch => updateZone(selectedZone.id, patch)} onDelete={() => deleteZone(selectedZone.id)} />
            )}
          </div>

          {/* Canvas area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, position: 'relative', padding: 32 }}>
            {/* Canvas with overlay */}
            <div style={{ position: 'relative', display: 'inline-block', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
              <Stage ref={stageRef} width={stageW} height={stageH} style={{ display: 'block', borderRadius: 8 }}>
                <Layer>
                  <GradientBg bg={editorBg} w={stageW} h={stageH} />

                  {/* Photo placeholder — centered, 60% width */}
                  <PhotoPlaceholder
                    x={Math.round(stageW * 0.2)}
                    y={Math.round(stageH * 0.25)}
                    w={Math.round(stageW * 0.6)}
                    h={Math.round(stageH * 0.4)}
                  />

                  {/* Logo */}
                  {editorLogo && logoSrc && (
                    <LogoImg src={logoSrc} x={editorLogo.x} y={editorLogo.y} w={editorLogo.width} h={editorLogo.height} />
                  )}

                  {/* Text zones */}
                  {editorZones.map(zone => (
                    <Group
                      key={zone.id}
                      x={zone.x} y={zone.y}
                      draggable
                      onDragEnd={e => updateZone(zone.id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) })}
                      onClick={() => setSelectedZoneId(zone.id)}
                      onTap={() => setSelectedZoneId(zone.id)}
                    >
                      {/* Selection indicator */}
                      {selectedZoneId === zone.id && (
                        <Rect
                          x={-2} y={-2}
                          width={zone.width + 4}
                          height={zone.fontSize + 12}
                          fill="transparent"
                          stroke="var(--mint)"
                          strokeWidth={1.5}
                          dash={[4, 3]}
                          cornerRadius={3}
                          listening={false}
                        />
                      )}
                      <Text
                        text={zone.placeholder}
                        fontSize={zone.fontSize}
                        fontFamily={zone.fontFamily}
                        fontStyle={zone.fontStyle}
                        fill={zone.fill}
                        align={zone.align}
                        width={zone.width}
                        wrap="word"
                        opacity={0.8}
                        listening={false}
                      />
                      {/* Role badge */}
                      <Rect x={0} y={-18} width={60} height={14} fill={ROLE_COLORS[zone.role] ?? '#fff'} cornerRadius={3} opacity={0.15} listening={false} />
                      <Text x={3} y={-17} text={zone.role} fontSize={9} fontStyle="bold" fill={ROLE_COLORS[zone.role] ?? '#fff'} listening={false} />
                    </Group>
                  ))}
                </Layer>
              </Stage>

              {/* Click outside to deselect */}
              {selectedZoneId && (
                <div
                  style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                  onClick={() => setSelectedZoneId(null)}
                />
              )}
            </div>

            {/* Stage dimensions */}
            <p style={{ color: 'var(--cream-3)', fontSize: 12, margin: 0 }}>
              {fmt.label} — {fmt.sub}
            </p>
          </div>

          {/* Footer actions */}
          <div style={{
            position: 'absolute', bottom: 0, left: 280, right: 0, height: 64,
            background: 'rgba(13,15,10,0.9)', borderTop: '1px solid var(--cream-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '0 32px',
          }}>
            <button
              onClick={() => setEditing(null)}
              style={{ background: 'var(--sunk)', border: '1px solid var(--cream-4)', borderRadius: 'var(--r-s)', padding: '9px 20px', color: 'var(--cream-2)', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}
            >
              Annuler
            </button>
            <button
              onClick={saveTemplate}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer le template'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({ tpl, onEdit, onDelete }: { tpl: PostTemplate; onEdit: () => void; onDelete: () => void }) {
  const fmt = FORMATS.find(f => f.id === tpl.format_id) ?? FORMATS[0];
  const aspect = fmt.h / fmt.w;

  return (
    <div
      style={{ background: 'var(--surface)', border: '1px solid var(--cream-4)', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s', display: 'flex', flexDirection: 'column' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--mint)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--cream-4)'; }}
    >
      {/* Thumbnail */}
      <div
        onClick={onEdit}
        style={{ width: '100%', paddingTop: `${aspect * 100}%`, position: 'relative', background: 'var(--sunk)', overflow: 'hidden' }}
      >
        {tpl.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tpl.thumbnail_url} alt={tpl.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <MiniPreview bg={tpl.background_style} aspect={aspect} />
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: 'var(--cream)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpl.name}</p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--cream-3)' }}>{fmt.label} · {(tpl.text_zones ?? []).length} zone{(tpl.text_zones ?? []).length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cream-3)', padding: 4, borderRadius: 4 }}
          title="Supprimer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─── Mini preview (CSS gradient, no canvas) ───────────────────────────────────

function MiniPreview({ bg, aspect }: { bg: BgStyle; aspect: number }) {
  let background: string;
  if (bg.type === 'solid') {
    background = bg.color ?? '#000';
  } else {
    const angle = bg.angle ?? 135;
    background = `linear-gradient(${angle}deg, ${bg.colorFrom ?? '#0038FF'}, ${bg.colorTo ?? '#FFFFFF'})`;
  }
  return (
    <div style={{ position: 'absolute', inset: 0, background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px', width: '70%' }}>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.7)', width: '80%' }} />
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.4)', width: '55%' }} />
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.25)', width: '90%' }} />
      </div>
    </div>
  );
}

// ─── Zone inspector panel ─────────────────────────────────────────────────────

function ZoneInspector({ zone, onChange, onDelete }: { zone: TextZone; onChange: (patch: Partial<TextZone>) => void; onDelete: () => void }) {
  return (
    <div style={{ padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <label className="label" style={{ color: 'var(--cream-3)', fontSize: 11 }}>ZONE SÉLECTIONNÉE</label>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cream-3)', fontSize: 12, padding: '2px 6px' }}>Supprimer</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Placeholder text */}
        <div>
          <label style={{ fontSize: 11, color: 'var(--cream-3)', display: 'block', marginBottom: 3 }}>Texte de référence</label>
          <input
            value={zone.placeholder}
            onChange={e => onChange({ placeholder: e.target.value })}
            style={{ width: '100%', background: 'var(--sunk)', border: '1px solid var(--cream-4)', borderRadius: 'var(--r-s)', padding: '6px 8px', color: 'var(--cream)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Font size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--cream-3)', width: 60, flexShrink: 0 }}>Taille</label>
          <input type="range" min={8} max={96} value={zone.fontSize} onChange={e => onChange({ fontSize: Number(e.target.value) })} style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--cream-2)', width: 28, textAlign: 'right' }}>{zone.fontSize}</span>
        </div>

        {/* Width */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--cream-3)', width: 60, flexShrink: 0 }}>Largeur</label>
          <input type="range" min={40} max={560} value={zone.width} onChange={e => onChange({ width: Number(e.target.value) })} style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--cream-2)', width: 28, textAlign: 'right' }}>{zone.width}</span>
        </div>

        {/* Color */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--cream-3)', width: 60, flexShrink: 0 }}>Couleur</label>
          <input type="color" value={zone.fill} onChange={e => onChange({ fill: e.target.value })} style={{ width: 36, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }} />
          <span style={{ fontSize: 12, color: 'var(--cream-3)' }}>{zone.fill}</span>
        </div>

        {/* Align */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--cream-3)', width: 60, flexShrink: 0 }}>Alignement</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['left', 'center', 'right'] as const).map(a => (
              <button
                key={a}
                onClick={() => onChange({ align: a })}
                style={{ background: zone.align === a ? 'var(--mint-soft)' : 'var(--sunk)', border: `1px solid ${zone.align === a ? 'var(--mint)' : 'var(--cream-4)'}`, borderRadius: 4, padding: '4px 8px', color: zone.align === a ? 'var(--mint)' : 'var(--cream-3)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
              >
                {a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}
              </button>
            ))}
          </div>
        </div>

        {/* Style */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--cream-3)', width: 60, flexShrink: 0 }}>Style</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['normal', 'bold', 'italic'] as const).map(s => (
              <button
                key={s}
                onClick={() => onChange({ fontStyle: s })}
                style={{ background: zone.fontStyle === s ? 'var(--mint-soft)' : 'var(--sunk)', border: `1px solid ${zone.fontStyle === s ? 'var(--mint)' : 'var(--cream-4)'}`, borderRadius: 4, padding: '4px 7px', color: zone.fontStyle === s ? 'var(--mint)' : 'var(--cream-3)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
              >
                {s === 'normal' ? 'N' : s === 'bold' ? 'B' : 'I'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
