'use client';

import React, { useRef, useState } from 'react';
import {
  Group,
  Image as KonvaImage,
  Layer,
  Rect,
  Stage,
  Text,
} from 'react-konva';
import useImage from 'use-image';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface BgStyle {
  type: 'gradient' | 'solid';
  color?: string;
  angle?: number;
  colorFrom?: string;
  colorTo?: string;
}

export interface TextZone {
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

export interface LogoPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateDraft {
  name: string;
  format_id: string;
  background_style: BgStyle;
  text_zones: TextZone[];
  logo_placement: LogoPlacement | null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TemplateEditorProps {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logoPreview?: string | null;
  initialDraft?: Partial<TemplateDraft>;
  onSave: (draft: TemplateDraft) => void;
  onCancel: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FORMATS = [
  { id: 'ig-portrait', label: 'Portrait 4:5', sub: '1080×1350', w: 360, h: 450 },
  { id: 'ig-square',   label: 'Carré',         sub: '1080×1080', w: 420, h: 420 },
  { id: 'ig-story',    label: 'Story',          sub: '1080×1920', w: 253, h: 450 },
  { id: 'facebook',    label: 'Facebook Post',  sub: '1200×630',  w: 420, h: 221 },
];

const ROLES: { id: TextZone['role']; label: string; size: number; style: string }[] = [
  { id: 'titre',        label: 'Titre',        size: 42, style: 'bold' },
  { id: 'sous-titre',   label: 'Sous-titre',   size: 22, style: 'bold' },
  { id: 'accroche',     label: 'Accroche',     size: 18, style: 'normal' },
  { id: 'corps',        label: 'Corps',        size: 14, style: 'normal' },
  { id: 'cta',          label: 'CTA',          size: 16, style: 'bold' },
  { id: 'tag',          label: 'Tag / Badge',  size: 12, style: 'bold' },
  { id: 'personnalise', label: 'Personnalisé', size: 16, style: 'normal' },
];

const ROLE_COLORS: Record<string, string> = {
  titre:        '#FFFFFF',
  'sous-titre': '#E0E0E0',
  accroche:     '#FFFFFF',
  corps:        '#CCCCCC',
  cta:          '#2FD79B',
  tag:          '#C8F135',
  personnalise: '#FFFFFF',
};

function newId() {
  return `z-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ─── Canvas sub-components ────────────────────────────────────────────────────

function GradientBg({ bg, w, h }: { bg: BgStyle; w: number; h: number }) {
  if (bg.type === 'solid') {
    return <Rect x={0} y={0} width={w} height={h} fill={bg.color ?? '#000'} />;
  }
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

function PhotoPlaceholder({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <Group x={x} y={y}>
      <Rect width={w} height={h} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} dash={[6, 4]} cornerRadius={6} />
      <Text text="PHOTO" width={w} height={h} align="center" verticalAlign="middle" fontSize={12} fontStyle="bold" fill="rgba(255,255,255,0.35)" fontFamily="Inter, sans-serif" listening={false} />
    </Group>
  );
}

function LogoImg({ src, x, y, w, h }: { src: string; x: number; y: number; w: number; h: number }) {
  const [img] = useImage(src, 'anonymous');
  if (!img) return null;
  return <KonvaImage image={img} x={x} y={y} width={w} height={h} />;
}

// ─── Zone inspector ───────────────────────────────────────────────────────────

function ZoneInspector({ zone, onChange, onDelete }: {
  zone: TextZone;
  onChange: (patch: Partial<TextZone>) => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ padding: '14px 18px', borderTop: '1px solid var(--cream-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cream-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Zone sélectionnée</span>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cream-3)', fontSize: 12, padding: '2px 6px' }}>Supprimer</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--cream-3)', display: 'block', marginBottom: 3 }}>Texte de référence</label>
          <input value={zone.placeholder} onChange={e => onChange({ placeholder: e.target.value })}
            style={{ width: '100%', background: 'var(--sunk)', border: '1px solid var(--cream-4)', borderRadius: 'var(--r-s)', padding: '6px 8px', color: 'var(--cream)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--cream-3)', width: 60, flexShrink: 0 }}>Taille</label>
          <input type="range" min={8} max={96} value={zone.fontSize} onChange={e => onChange({ fontSize: Number(e.target.value) })} style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--cream-2)', width: 28, textAlign: 'right' as const }}>{zone.fontSize}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--cream-3)', width: 60, flexShrink: 0 }}>Largeur</label>
          <input type="range" min={40} max={540} value={zone.width} onChange={e => onChange({ width: Number(e.target.value) })} style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--cream-2)', width: 28, textAlign: 'right' as const }}>{zone.width}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--cream-3)', width: 60, flexShrink: 0 }}>Couleur</label>
          <input type="color" value={zone.fill} onChange={e => onChange({ fill: e.target.value })}
            style={{ width: 32, height: 26, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }} />
          <span style={{ fontSize: 12, color: 'var(--cream-3)' }}>{zone.fill}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--cream-3)', width: 60, flexShrink: 0 }}>Alignement</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['left', 'center', 'right'] as const).map(a => (
              <button key={a} onClick={() => onChange({ align: a })} style={{ background: zone.align === a ? 'var(--mint-soft)' : 'var(--sunk)', border: `1px solid ${zone.align === a ? 'var(--mint)' : 'var(--cream-4)'}`, borderRadius: 4, padding: '4px 7px', color: zone.align === a ? 'var(--mint)' : 'var(--cream-3)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                {a === 'left' ? '⬅' : a === 'center' ? '↔' : '➡'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--cream-3)', width: 60, flexShrink: 0 }}>Style</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['normal', 'bold', 'italic'] as const).map(s => (
              <button key={s} onClick={() => onChange({ fontStyle: s })} style={{ background: zone.fontStyle === s ? 'var(--mint-soft)' : 'var(--sunk)', border: `1px solid ${zone.fontStyle === s ? 'var(--mint)' : 'var(--cream-4)'}`, borderRadius: 4, padding: '4px 6px', color: zone.fontStyle === s ? 'var(--mint)' : 'var(--cream-3)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                {s === 'normal' ? 'N' : s === 'bold' ? 'B' : 'I'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TemplateEditor({
  primaryColor = '#0038FF',
  secondaryColor = '#FFFFFF',
  fontFamily = 'Inter',
  logoPreview,
  initialDraft,
  onSave,
  onCancel,
}: TemplateEditorProps) {
  const stageRef = useRef<any>(null);

  const defaultBg: BgStyle = {
    type: 'gradient', angle: 135,
    colorFrom: primaryColor,
    colorTo: secondaryColor,
  };

  const [editorName, setEditorName] = useState(initialDraft?.name ?? 'Nouveau template');
  const [editorFormat, setEditorFormat] = useState(initialDraft?.format_id ?? 'ig-portrait');
  const [editorBg, setEditorBg] = useState<BgStyle>(initialDraft?.background_style ?? defaultBg);
  const [editorZones, setEditorZones] = useState<TextZone[]>(initialDraft?.text_zones ?? []);
  const [editorLogo, setEditorLogo] = useState<LogoPlacement | null>(initialDraft?.logo_placement ?? null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const fmt = FORMATS.find(f => f.id === editorFormat) ?? FORMATS[0];
  const stageW = fmt.w;
  const stageH = fmt.h;

  function addTextZone(role: TextZone['role']) {
    const cfg = ROLES.find(r => r.id === role)!;
    const zone: TextZone = {
      id: newId(), role,
      x: Math.round(stageW * 0.1),
      y: Math.round(stageH * 0.1 + editorZones.length * 60),
      width: Math.round(stageW * 0.8),
      fontSize: cfg.size,
      fontFamily,
      fontStyle: cfg.style,
      fill: ROLE_COLORS[role] ?? '#FFFFFF',
      align: 'left',
      placeholder: cfg.label,
    };
    setEditorZones(prev => [...prev, zone]);
    setSelectedZoneId(zone.id);
  }

  function updateZone(id: string, patch: Partial<TextZone>) {
    setEditorZones(prev => prev.map(z => z.id === id ? { ...z, ...patch } : z));
  }

  function deleteZone(id: string) {
    setEditorZones(prev => prev.filter(z => z.id !== id));
    if (selectedZoneId === id) setSelectedZoneId(null);
  }

  function handleSave() {
    onSave({
      name: editorName,
      format_id: editorFormat,
      background_style: editorBg,
      text_zones: editorZones,
      logo_placement: editorLogo,
    });
  }

  const selectedZone = editorZones.find(z => z.id === selectedZoneId) ?? null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.76)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'stretch',
    }}>
      {/* ── Left panel ──────────────────────────────────────────────────────── */}
      <div style={{
        width: 272, background: 'var(--surface)', borderRight: '1px solid var(--cream-4)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Name */}
        <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid var(--cream-4)' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--cream-3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Nom</label>
          <input value={editorName} onChange={e => setEditorName(e.target.value)}
            style={{ width: '100%', background: 'var(--sunk)', border: '1px solid var(--cream-4)', borderRadius: 'var(--r-s)', padding: '7px 10px', color: 'var(--cream)', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }} />
        </div>

        {/* Format */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--cream-4)' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--cream-3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Format</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {FORMATS.map(f => (
              <button key={f.id} onClick={() => setEditorFormat(f.id)} style={{
                background: editorFormat === f.id ? 'var(--mint-soft)' : 'var(--sunk)',
                border: `1px solid ${editorFormat === f.id ? 'var(--mint)' : 'var(--cream-4)'}`,
                borderRadius: 'var(--r-s)', padding: '6px 10px', textAlign: 'left' as const, cursor: 'pointer',
                color: editorFormat === f.id ? 'var(--mint)' : 'var(--cream-2)', fontSize: 12, fontWeight: 600,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{f.label}</span>
                <span style={{ opacity: 0.55, fontWeight: 400, fontSize: 11 }}>{f.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Background */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--cream-4)' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--cream-3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Arrière-plan</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['gradient', 'solid'] as const).map(type => (
              <button key={type} onClick={() => setEditorBg(b => ({ ...b, type }))} style={{
                flex: 1, padding: '5px 0', borderRadius: 'var(--r-s)',
                border: `1px solid ${editorBg.type === type ? 'var(--mint)' : 'var(--cream-4)'}`,
                background: editorBg.type === type ? 'var(--mint-soft)' : 'var(--sunk)',
                color: editorBg.type === type ? 'var(--mint)' : 'var(--cream-3)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                {type === 'gradient' ? 'Dégradé' : 'Uni'}
              </button>
            ))}
          </div>
          {editorBg.type === 'solid' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--cream-3)' }}>Couleur</span>
              <input type="color" value={editorBg.color ?? '#000000'} onChange={e => setEditorBg(b => ({ ...b, color: e.target.value }))}
                style={{ width: 32, height: 26, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0 }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { key: 'colorFrom' as const, label: 'Départ' },
                { key: 'colorTo'   as const, label: 'Fin' },
              ].map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--cream-3)', width: 44 }}>{label}</span>
                  <input type="color" value={editorBg[key] ?? '#0038FF'} onChange={e => setEditorBg(b => ({ ...b, [key]: e.target.value }))}
                    style={{ width: 32, height: 26, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--cream-3)' }}>{editorBg[key]}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--cream-3)', width: 44 }}>Angle</span>
                <input type="range" min={0} max={360} value={editorBg.angle ?? 135}
                  onChange={e => setEditorBg(b => ({ ...b, angle: Number(e.target.value) }))} style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: 'var(--cream-3)', width: 30, textAlign: 'right' as const }}>{editorBg.angle ?? 135}°</span>
              </div>
            </div>
          )}
        </div>

        {/* Zones de texte */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--cream-4)' }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--cream-3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Zones de texte</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {ROLES.map(r => (
              <button key={r.id} onClick={() => addTextZone(r.id)} style={{
                background: 'var(--sunk)', border: '1px solid var(--cream-4)', borderRadius: 'var(--r-s)',
                padding: '6px 10px', textAlign: 'left' as const, cursor: 'pointer', color: 'var(--cream-2)',
                fontSize: 12, display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: ROLE_COLORS[r.id], flexShrink: 0 }} />
                {r.label}
                <span style={{ marginLeft: 'auto', opacity: 0.45, fontSize: 16, lineHeight: 1 }}>+</span>
              </button>
            ))}
          </div>
        </div>

        {/* Logo */}
        {logoPreview && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--cream-4)' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--cream-3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Logo</label>
            {editorLogo ? (
              <button onClick={() => setEditorLogo(null)} style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 'var(--r-s)', padding: '6px 10px', color: '#ff6b6b', fontSize: 12, cursor: 'pointer', width: '100%' }}>
                Retirer le logo
              </button>
            ) : (
              <button onClick={() => setEditorLogo({ x: 16, y: 16, width: 80, height: 40 })} style={{ background: 'var(--sunk)', border: '1px solid var(--cream-4)', borderRadius: 'var(--r-s)', padding: '6px 10px', color: 'var(--cream-2)', fontSize: 12, cursor: 'pointer', width: '100%' }}>
                Placer le logo
              </button>
            )}
          </div>
        )}

        {/* Zone inspector */}
        {selectedZone && (
          <ZoneInspector
            zone={selectedZone}
            onChange={patch => updateZone(selectedZone.id, patch)}
            onDelete={() => deleteZone(selectedZone.id)}
          />
        )}
      </div>

      {/* ── Canvas area ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '32px 32px 80px' }}>
        <div style={{ position: 'relative', display: 'inline-block', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', borderRadius: 8, overflow: 'hidden' }}>
          <Stage ref={stageRef} width={stageW} height={stageH} style={{ display: 'block' }}>
            <Layer>
              <GradientBg bg={editorBg} w={stageW} h={stageH} />

              {/* Photo placeholder */}
              <PhotoPlaceholder
                x={Math.round(stageW * 0.2)} y={Math.round(stageH * 0.25)}
                w={Math.round(stageW * 0.6)} h={Math.round(stageH * 0.4)}
              />

              {/* Logo */}
              {editorLogo && logoPreview && (
                <LogoImg src={logoPreview} x={editorLogo.x} y={editorLogo.y} w={editorLogo.width} h={editorLogo.height} />
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
                  {selectedZoneId === zone.id && (
                    <Rect x={-2} y={-2} width={zone.width + 4} height={zone.fontSize + 12}
                      fill="transparent" stroke="#2FD79B" strokeWidth={1.5} dash={[4, 3]} cornerRadius={3} listening={false} />
                  )}
                  <Text text={zone.placeholder} fontSize={zone.fontSize} fontFamily={zone.fontFamily}
                    fontStyle={zone.fontStyle} fill={zone.fill} align={zone.align}
                    width={zone.width} wrap="word" opacity={0.85} listening={false} />
                  <Rect x={0} y={-17} width={58} height={13} fill={ROLE_COLORS[zone.role] ?? '#fff'} cornerRadius={3} opacity={0.12} listening={false} />
                  <Text x={3} y={-16} text={zone.role} fontSize={9} fontStyle="bold" fill={ROLE_COLORS[zone.role] ?? '#fff'} listening={false} />
                </Group>
              ))}
            </Layer>
          </Stage>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
          {fmt.label} — {fmt.sub} · Glissez les zones pour les repositionner
        </p>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 272, right: 0, height: 60,
        background: 'rgba(13,15,10,0.92)', borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '0 28px',
      }}>
        <button onClick={onCancel} style={{ background: 'var(--sunk)', border: '1px solid var(--cream-4)', borderRadius: 'var(--r-s)', padding: '8px 20px', color: 'var(--cream-2)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
          Annuler
        </button>
        <button onClick={handleSave} style={{ background: 'var(--mint)', border: 'none', borderRadius: 'var(--r-s)', padding: '9px 24px', color: 'var(--mint-ink)', fontSize: 13, cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--display)' }}>
          Enregistrer ce template
        </button>
      </div>
    </div>
  );
}

// ─── Mini CSS preview (no canvas) ─────────────────────────────────────────────

export function MiniTemplatePreview({ bg, name, formatId, zonesCount }: {
  bg: BgStyle;
  name: string;
  formatId: string;
  zonesCount: number;
}) {
  const fmt = FORMATS.find(f => f.id === formatId) ?? FORMATS[0];
  const gradient = bg.type === 'solid'
    ? bg.color ?? '#000'
    : `linear-gradient(${bg.angle ?? 135}deg, ${bg.colorFrom ?? '#0038FF'}, ${bg.colorTo ?? '#fff'})`;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--cream-4)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ paddingTop: `${(fmt.h / fmt.w) * 100}%`, position: 'relative', background: gradient }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', justifyContent: 'flex-end' }}>
          <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.7)', width: '70%' }} />
          <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.4)', width: '50%' }} />
        </div>
      </div>
      <div style={{ padding: '8px 10px' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 12, color: 'var(--cream)', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
        <p style={{ margin: 0, fontSize: 10, color: 'var(--cream-3)' }}>{fmt.label} · {zonesCount} zone{zonesCount !== 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}
