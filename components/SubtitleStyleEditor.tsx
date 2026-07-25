"use client";

// Éditeur de style de sous-titre — jeu de paramètres complet (façon CapCut).
// PARTAGÉ entre l'assistant « nouveau client » (charte, thème clair) et l'éditeur
// de montage (thème sombre .a-root) : les deux endroits proposent donc exactement
// les mêmes réglages. Le rendu est piloté par subtitleBoxCss/effectiveSubStyle,
// et répliqué à l'identique par l'export canvas (export.ts drawCaptions).
import React from "react";
import {
  effectiveSubStyle, applySubCase, subtitleBoxCss,
  type SubCustom, type CaseMode, type SubAlign,
} from "@/app/workspace/[id]/montage/[postId]/constants";

const HEX = /^#([0-9a-f]{6})$/i;
const safeHex = (v: string | undefined, fallback = "#000000") => (v && HEX.test(v) ? v : fallback);

// ─── petits contrôles ────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ display: "block", fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 7 }}>{children}</span>;
}

function Swatch({ value, onChange, allowNone, noneLabel, onNone }: {
  value: string; onChange: (v: string) => void;
  allowNone?: boolean; noneLabel?: string; onNone?: () => void;
}) {
  const isNone = !value || value === "transparent";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <input
        type="color" value={safeHex(isNone ? undefined : value, "#ffffff")}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 34, height: 28, borderRadius: 8, border: "1px solid var(--line)", background: "none", cursor: "pointer", padding: 0 }}
      />
      {allowNone && (
        <button type="button" onClick={onNone}
          className={isNone ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
          style={{ fontSize: 11, padding: "4px 10px" }}>
          {noneLabel}
        </button>
      )}
    </div>
  );
}

function Slider({ value, min, max, step = 1, onChange, fmt }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: "var(--leaf-ink)" }} />
      <span style={{ minWidth: 44, textAlign: "right", fontSize: 11.5, fontWeight: 700, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
        {fmt ? fmt(value) : value}
      </span>
    </div>
  );
}

function Seg<T extends string | number>({ options, value, onChange }: {
  options: { v: T; label: React.ReactNode; title?: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {options.map((o) => (
        <button type="button" key={String(o.v)} title={o.title} onClick={() => onChange(o.v)}
          className={value === o.v ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
          style={{ padding: "5px 11px", fontSize: 12, minWidth: 38 }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
      <Label>{title}</Label>
      {children}
    </div>
  );
}

// ─── éditeur ─────────────────────────────────────────────────────────────────

export interface SubtitleStyleEditorLabels {
  basic: string; font: string; brandFont: string; system: string; serif: string; mono: string;
  size: string; style: string; case: string; align: string; letterSpacing: string; lineHeight: string;
  colors: string; text: string; highlight: string;
  background: string; none: string; opacity: string; radius: string; pill: string;
  stroke: string; thickness: string;
  shadow: string; blur: string; offsetX: string; offsetY: string;
  glow: string; intensity: string;
  transform: string; rotation: string;
}

export default function SubtitleStyleEditor({
  styleId, custom, onChange, brandFont, labels: L,
}: {
  styleId: string;
  custom: SubCustom;
  onChange: (patch: SubCustom) => void;
  brandFont?: string | null;
  labels: SubtitleStyleEditorLabels;
}) {
  const e = effectiveSubStyle(styleId, custom);
  const patch = (p: SubCustom) => onChange({ ...custom, ...p });

  const fontOptions = [
    ...(brandFont ? [{ v: brandFont, label: L.brandFont, title: brandFont }] : []),
    { v: "", label: L.system },
    { v: "Georgia", label: L.serif },
    { v: "ui-monospace", label: L.mono },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── Basique ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Label>{L.basic}</Label>

        <div>
          <Label>{L.font}</Label>
          <Seg options={fontOptions} value={e.font ?? ""} onChange={(v) => patch({ font: v || undefined })} />
        </div>

        <div>
          <Label>{L.size}</Label>
          <Slider value={e.scale} min={0.5} max={2.4} step={0.05} onChange={(v) => patch({ scale: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
        </div>

        <div>
          <Label>{L.style}</Label>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {([
              ["weight", <b key="b">B</b>, e.weight >= 800, () => patch({ weight: e.weight >= 800 ? 600 : 800 })],
              ["underline", <u key="u">U</u>, e.underline, () => patch({ underline: !e.underline })],
              ["italic", <i key="i">I</i>, e.italic, () => patch({ italic: !e.italic })],
            ] as const).map(([k, node, on, act]) => (
              <button type="button" key={k} onClick={act}
                className={on ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
                style={{ padding: "5px 13px", fontSize: 13, minWidth: 38 }}>{node}</button>
            ))}
          </div>
        </div>

        <div>
          <Label>{L.case}</Label>
          <Seg<CaseMode>
            options={[
              { v: "none", label: "Aa" }, { v: "upper", label: "TT" },
              { v: "lower", label: "tt" }, { v: "title", label: "Tt" },
            ]}
            value={e.caseMode}
            onChange={(v) => patch({ caseMode: v, uppercase: v === "upper" })}
          />
        </div>

        <div>
          <Label>{L.align}</Label>
          <Seg<SubAlign>
            options={[{ v: "left", label: "◧" }, { v: "center", label: "▣" }, { v: "right", label: "◨" }]}
            value={e.align} onChange={(v) => patch({ align: v })}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <Label>{L.letterSpacing}</Label>
            <Slider value={e.letterSpacing} min={-0.05} max={0.5} step={0.01} onChange={(v) => patch({ letterSpacing: v })} fmt={(v) => v.toFixed(2)} />
          </div>
          <div>
            <Label>{L.lineHeight}</Label>
            <Slider value={e.lineHeight} min={0.9} max={2} step={0.05} onChange={(v) => patch({ lineHeight: v })} fmt={(v) => v.toFixed(2)} />
          </div>
        </div>
      </div>

      {/* ── Couleurs ── */}
      <Section title={L.colors}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><Label>{L.text}</Label><Swatch value={e.fg} onChange={(v) => patch({ fg: v })} /></div>
          <div><Label>{L.highlight}</Label><Swatch value={e.hi} onChange={(v) => patch({ hi: v })} /></div>
        </div>
      </Section>

      {/* ── Arrière-plan ── */}
      <Section title={L.background}>
        <Swatch value={e.bg} onChange={(v) => patch({ bg: v })} allowNone noneLabel={L.none} onNone={() => patch({ bg: "transparent" })} />
        {e.bg !== "transparent" && (
          <>
            <div><Label>{L.opacity}</Label><Slider value={e.bgOpacity} min={0} max={1} step={0.05} onChange={(v) => patch({ bgOpacity: v })} fmt={(v) => `${Math.round(v * 100)}%`} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => patch({ pill: !e.pill })}
                className={e.pill ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}>{L.pill}</button>
              {!e.pill && (
                <div style={{ flex: 1, minWidth: 140 }}>
                  <Slider value={e.radius} min={0} max={40} step={1} onChange={(v) => patch({ radius: v })} fmt={(v) => `${v}px`} />
                </div>
              )}
            </div>
          </>
        )}
      </Section>

      {/* ── Trait (contour) ── */}
      <Section title={L.stroke}>
        <Swatch value={e.stroke ?? ""} onChange={(v) => patch({ stroke: v })} allowNone noneLabel={L.none} onNone={() => patch({ stroke: "" })} />
        {!!e.stroke && (
          <div><Label>{L.thickness}</Label><Slider value={e.strokeW} min={0.5} max={8} step={0.5} onChange={(v) => patch({ strokeW: v })} fmt={(v) => `${v}px`} /></div>
        )}
      </Section>

      {/* ── Ombre ── */}
      <Section title={L.shadow}>
        <Swatch value={e.shadowColor} onChange={(v) => patch({ shadowColor: v, shadowBlur: e.shadowBlur || 8 })} allowNone noneLabel={L.none} onNone={() => patch({ shadowColor: "", shadowBlur: 0, shadowX: 0, shadowY: 0 })} />
        {!!e.shadowColor && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div><Label>{L.blur}</Label><Slider value={e.shadowBlur} min={0} max={40} step={1} onChange={(v) => patch({ shadowBlur: v })} /></div>
            <div><Label>{L.offsetX}</Label><Slider value={e.shadowX} min={-20} max={20} step={1} onChange={(v) => patch({ shadowX: v })} /></div>
            <div><Label>{L.offsetY}</Label><Slider value={e.shadowY} min={-20} max={20} step={1} onChange={(v) => patch({ shadowY: v })} /></div>
          </div>
        )}
      </Section>

      {/* ── Lueur ── */}
      <Section title={L.glow}>
        <Swatch value={e.glowColor} onChange={(v) => patch({ glowColor: v, glowBlur: e.glowBlur || 12 })} allowNone noneLabel={L.none} onNone={() => patch({ glowColor: "", glowBlur: 0 })} />
        {!!e.glowColor && (
          <div><Label>{L.intensity}</Label><Slider value={e.glowBlur} min={0} max={40} step={1} onChange={(v) => patch({ glowBlur: v })} /></div>
        )}
      </Section>

      {/* ── Transformer / mélange ── */}
      <Section title={L.transform}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><Label>{L.rotation}</Label><Slider value={e.rotation} min={-45} max={45} step={1} onChange={(v) => patch({ rotation: v })} fmt={(v) => `${v}°`} /></div>
          <div><Label>{L.opacity}</Label><Slider value={e.opacity} min={0.1} max={1} step={0.05} onChange={(v) => patch({ opacity: v })} fmt={(v) => `${Math.round(v * 100)}%`} /></div>
        </div>
      </Section>
    </div>
  );
}

// Aperçu d'un sous-titre rendu avec le style résolu (même source que le montage).
export function SubtitlePreviewChip({ styleId, custom, fontSize = 22, words = ["Vos", "clips"] }: {
  styleId: string; custom?: SubCustom; fontSize?: number; words?: string[];
}) {
  const e = effectiveSubStyle(styleId, custom);
  const css = subtitleBoxCss(e, fontSize) as React.CSSProperties;
  return (
    <span style={{ ...css, display: "inline-block", maxWidth: "100%", transform: e.rotation ? `rotate(${e.rotation}deg)` : undefined }}>
      {words.map((w, i) => (
        <React.Fragment key={i}>
          <span style={{ color: i === 1 ? e.hi : e.fg }}>{applySubCase(w, e.caseMode)}</span>
          {i < words.length - 1 ? " " : ""}
        </React.Fragment>
      ))}
    </span>
  );
}
