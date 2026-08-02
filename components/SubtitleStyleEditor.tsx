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

// Taille de police du sous-titre à l'échelle 1, telle que l'export la dessine
// (cf. export.ts). C'est elle qui permet d'afficher des pixels plutôt qu'un
// pourcentage abstrait.
const SUB_BASE_PX = 34;

function AlignIcon({ dir }: { dir: "left" | "center" | "right" }) {
  const short = dir === "left" ? { x1: 3, x2: 14 } : dir === "right" ? { x1: 10, x2: 21 } : { x1: 6, x2: 18 };
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1={short.x1} y1="12" x2={short.x2} y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
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

  // Quatre familles imposées, c'était trop peu : on ouvre la liste complète de
  // l'éditeur, la police de la marque restant en tête.
  const FONT_LIST = [
    'Anton', 'Archivo Black', 'Barlow Condensed', 'Bebas Neue', 'DM Sans', 'Exo 2',
    'Fjalla One', 'Inter', 'Lato', 'Montserrat', 'Nunito', 'Oswald',
    'Playfair Display', 'Poppins', 'Raleway', 'Roboto Condensed', 'Space Grotesk',
    'Syne', 'Ubuntu', 'Work Sans',
  ];
  // Valeurs RÉELLES utilisées par les styles de base "Magazine"/"Vintage" et
  // "Terminal" (cf. SUB_STYLES) — doivent être IDENTIQUES aux valeurs des
  // <option> ci-dessous, sinon le <select> ne trouve aucune correspondance et
  // s'affiche vide (aucune option sélectionnée) alors qu'une police est bien
  // appliquée.
  const SERIF_FONT = "'Instrument Serif', serif";
  const MONO_FONT = "var(--mono)";
  const KNOWN_FONT_VALUES = new Set([brandFont || "", "", SERIF_FONT, MONO_FONT, ...FONT_LIST]);
  // Filet de sécurité : une police de marque personnalisée (import externe) ou
  // tout autre réglage déjà enregistré peut ne correspondre à aucune des
  // options ci-dessus — sans repli, le <select> se retrouve sans option
  // sélectionnée et paraît vide côté client.
  const currentFont = e.font ?? "";
  const unknownFont = currentFont && !KNOWN_FONT_VALUES.has(currentFont) ? currentFont : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* ── Basique ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Label>{L.basic}</Label>

        <div>
          <Label>{L.font}</Label>
          <select
            value={e.font ?? ""}
            onChange={(ev) => patch({ font: ev.target.value || undefined })}
            className="input"
            style={{ height: 34, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: e.font || undefined }}
          >
            {brandFont && <option value={brandFont}>{L.brandFont} — {brandFont}</option>}
            {unknownFont && <option value={unknownFont}>{unknownFont}</option>}
            <option value="">{L.system}</option>
            <option value={SERIF_FONT}>{L.serif}</option>
            <option value={MONO_FONT}>{L.mono}</option>
            {FONT_LIST.filter(f => f !== brandFont).map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div>
          <Label>{L.size}</Label>
          {/* La taille se règle en PIXELS du rendu final : « 120 % » ne disait
              rien de ce qu'on obtient. 34px = échelle 1 à l'export. */}
          <Slider
            value={Math.round(e.scale * SUB_BASE_PX)}
            min={Math.round(0.5 * SUB_BASE_PX)}
            max={Math.round(2.4 * SUB_BASE_PX)}
            step={1}
            onChange={(px) => patch({ scale: +(px / SUB_BASE_PX).toFixed(3) })}
            fmt={(px) => `${Math.round(px)} px`}
          />
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
            options={[
              { v: "left", label: <AlignIcon key="l" dir="left" /> },
              { v: "center", label: <AlignIcon key="c" dir="center" /> },
              { v: "right", label: <AlignIcon key="r" dir="right" /> },
            ]}
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
// activeIdx pilote le mot en surbrillance : -1 = aucun (rendu statique), sinon on
// reproduit la révélation progressive de drawCaptions (export.ts).
export function SubtitlePreviewChip({ styleId, custom, fontSize = 22, words = ["Vos", "clips"], activeIdx, progress }: {
  styleId: string; custom?: SubCustom; fontSize?: number; words?: string[];
  activeIdx?: number; progress?: number;
}) {
  const e = effectiveSubStyle(styleId, custom);
  const css = subtitleBoxCss(e, fontSize) as React.CSSProperties;
  const animating = typeof activeIdx === "number" && activeIdx >= 0;
  return (
    <span style={{ ...css, display: "inline-block", maxWidth: "100%", transform: e.rotation ? `rotate(${e.rotation}deg)` : undefined }}>
      {words.map((w, i) => {
        // Mêmes paliers d'opacité que l'export canvas : mot à venir 0.28,
        // mot révélé 0.35 → 1 selon sa propre progression.
        let alpha = 1;
        let color = i === 1 ? e.hi : e.fg;
        if (animating) {
          const wordProg = Math.max(0, Math.min(1, (progress ?? 0) * words.length - i));
          alpha = i <= activeIdx! ? 0.35 + 0.65 * wordProg : 0.28;
          color = i === activeIdx ? e.hi : e.fg;
        }
        return (
          <React.Fragment key={i}>
            <span style={{ color, opacity: alpha }}>{applySubCase(w, e.caseMode)}</span>
            {i < words.length - 1 ? " " : ""}
          </React.Fragment>
        );
      })}
    </span>
  );
}

// ─── Scène d'aperçu ──────────────────────────────────────────────────────────
// Cadre 9:16 sur une VRAIE image, pour juger la lisibilité du sous-titre comme
// sur une vidéo. Les fonds viennent de /api/pexels (repli Openverse sans clé) ;
// on peut aussi déposer une image de son propre rush. Repli sur un décor
// synthétique si le réseau ne répond pas. Le sous-titre se place à la souris et
// se rejoue mot à mot avec la même mécanique que l'export.

// Requêtes volontairement COURTES : la banque anonyme (Openverse) renvoie des 403
// sur les requêtes longues, et refuse les rafales. On charge donc une scène à la
// fois, à la demande, jamais les trois en parallèle au montage du composant.
// Requêtes volontairement COURTES et NEUTRES : la banque anonyme (Openverse)
// renvoie des 403 sur les requêtes longues et refuse les rafales, et son premier
// résultat n'est pas curé — d'où le bouton « autre image » pour retirer au sort.
// Les trois scènes couvrent ce qui décide de la lisibilité : clair, sombre, chargé.
const TEST_SCENES = [
  { id: 'clair',  q: 'landscape', label: 'Fond clair' },
  { id: 'sombre', q: 'night',     label: 'Fond sombre' },
  { id: 'charge', q: 'city',      label: 'Fond chargé' },
];

const DEMO_PHRASE = "Voilà à quoi ressemblent vos sous-titres";

// Longueur de bloc par défaut si aucune n'est fournie — cohérent avec
// DEFAULT_WORDS_PER_CAPTION (constants.ts), sans dépendre de ce module.
const DEFAULT_PREVIEW_MAX_WORDS = 4;

export function SubtitlePreviewStage({
  styleId, custom, pos, onPosChange, fontSize = 14, phrase = DEMO_PHRASE, hint,
  maxWords = DEFAULT_PREVIEW_MAX_WORDS, editableTextLabel, onScaleChange,
}: {
  styleId: string;
  custom?: SubCustom;
  pos: { x: number; y: number };
  onPosChange: (p: { x: number; y: number }) => void;
  fontSize?: number;
  phrase?: string;
  hint?: string;
  // Glisser directement le coin du sous-titre pour changer sa taille (en plus
  // du curseur TAILLE du panneau). Absent → pas de poignée affichée.
  onScaleChange?: (scale: number) => void;
  // Mots max par bloc (façon montage réel) : le texte se réaffiche par blocs
  // de cette taille plutôt qu'en une seule phrase figée. Passer un grand
  // nombre (ex. 99, "Phrase") pour tout afficher d'un bloc.
  maxWords?: number;
  editableTextLabel?: string;
}) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [scene, setScene] = React.useState(0);
  // Plusieurs candidats par scène : « autre image » se contente d'avancer l'index,
  // sans nouvelle requête réseau.
  const [pool, setPool] = React.useState<string[][]>([[], [], []]);
  const [pick, setPick] = React.useState<number[]>([0, 0, 0]);
  const [ownFrame, setOwnFrame] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Lecture animée
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);

  // Texte modifiable : on part de `phrase` mais l'utilisateur peut le remplacer
  // par son propre exemple, pour juger le rendu sur SON texte plutôt que sur
  // une démo figée.
  const [customPhrase, setCustomPhrase] = React.useState(phrase);
  const words = React.useMemo(() => customPhrase.split(/\s+/).filter(Boolean), [customPhrase]);
  const DURATION = 2600; // ms — cadence proche d'un bloc de sous-titre réel

  // Redécoupage en blocs de `maxWords` mots — EXACTEMENT comme segmentCaptions()
  // appliqué à un vrai montage : le sous-titre s'affiche bloc par bloc, pas en
  // une phrase entière figée, pour montrer fidèlement combien de mots
  // apparaissent à l'écran à la fois.
  const step = Math.max(1, Math.floor(maxWords));
  const chunks = React.useMemo(() => {
    const out: string[][] = [];
    for (let i = 0; i < words.length; i += step) out.push(words.slice(i, i + step));
    return out.length ? out : [[]];
  }, [words, step]);

  // Charge la scène demandée si on ne l'a pas déjà. Une seule requête à la fois.
  React.useEffect(() => {
    if (pool[scene].length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/pexels?query=${encodeURIComponent(TEST_SCENES[scene].q)}&page=1`);
        if (!r.ok) return;
        const j = await r.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list: string[] = (j?.photos ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((p: any) => p?.src?.large || p?.src?.medium)
          .filter((s: unknown): s is string => typeof s === 'string')
          .slice(0, 8)
          .map((s: string) => `/api/proxy-image?url=${encodeURIComponent(s)}`);
        if (!cancelled && list.length) setPool(prev => prev.map((v, i) => (i === scene ? list : v)));
      } catch { /* on garde le décor de repli */ }
    })();
    return () => { cancelled = true; };
  }, [scene, pool]);

  React.useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // requestAnimationFrame est gelé dans un onglet en arrière-plan : sans ça, revenir
  // sur l'onglet laisserait la lecture figée en plein milieu et le bouton bloqué
  // sur « Lecture… ». On termine proprement l'animation en partant.
  React.useEffect(() => {
    const onHide = () => {
      if (document.hidden && rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        setProgress(1);
        setPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const play = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const t0 = performance.now();
    setPlaying(true);
    const tick = (now: number) => {
      const p = (now - t0) / DURATION;
      if (p >= 1) { setProgress(1); setPlaying(false); rafRef.current = null; return; }
      setProgress(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  function onPointerDown(e: React.PointerEvent) {
    const box = stageRef.current;
    if (!box) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const move = (clientX: number, clientY: number) => {
      const r = box.getBoundingClientRect();
      onPosChange({
        x: Math.round(Math.max(6, Math.min(94, ((clientX - r.left) / r.width) * 100))),
        y: Math.round(Math.max(6, Math.min(94, ((clientY - r.top) / r.height) * 100))),
      });
    };
    move(e.clientX, e.clientY);
    const onMove = (ev: PointerEvent) => move(ev.clientX, ev.clientY);
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Poignée de coin : redimensionne en direct sur l'aperçu, au lieu de forcer
  // un aller-retour vers le curseur TAILLE du panneau. Le facteur d'échelle
  // suit le ratio distance-au-point-d'ancrage courante / distance de départ.
  const eff = effectiveSubStyle(styleId, custom);
  const [chipSize, setChipSize] = React.useState({ w: 0, h: 0 });
  const chipWrapRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setChipSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
  }, []);

  function onResizeStart(ev: React.PointerEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    const box = stageRef.current;
    if (!box || !onScaleChange) return;
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    const r = box.getBoundingClientRect();
    const anchorX = r.left + (pos.x / 100) * r.width;
    const anchorY = r.top + (pos.y / 100) * r.height;
    const d0 = Math.max(1, Math.hypot(ev.clientX - anchorX, ev.clientY - anchorY));
    const scale0 = eff.scale;
    const move = (clientX: number, clientY: number) => {
      const d1 = Math.max(1, Math.hypot(clientX - anchorX, clientY - anchorY));
      onScaleChange(Math.max(0.5, Math.min(2.4, +(scale0 * (d1 / d0)).toFixed(3))));
    };
    const onMove = (e: PointerEvent) => move(e.clientX, e.clientY);
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const sceneList = pool[scene];
  const bg = ownFrame ?? (sceneList.length ? sceneList[pick[scene] % sceneList.length] : null);

  // Progression globale répartie sur les BLOCS (pas sur les mots de toute la
  // phrase) : chaque bloc s'affiche à son tour, exactement comme au montage.
  const animating = playing || progress > 0;
  const chunkFloat = animating ? Math.min(chunks.length - 1e-6, progress * chunks.length) : 0;
  const activeChunk = Math.min(chunks.length - 1, Math.floor(chunkFloat));
  const chunkWords = chunks[activeChunk] ?? [];
  const chunkProgress = animating ? chunkFloat - activeChunk : 0;
  const activeIdx = animating
    ? Math.min(chunkWords.length - 1, Math.floor(chunkProgress * chunkWords.length))
    : -1;

  return (
    <div>
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        style={{
          position: "relative", aspectRatio: "9 / 16", borderRadius: 12, overflow: "hidden",
          cursor: "grab", touchAction: "none", userSelect: "none",
          background: "linear-gradient(160deg,#3b4a52 0%,#22303a 42%,#131c22 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)",
        }}
      >
        {bg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bg} alt="" draggable={false}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          // Repli si la banque d'images ne répond pas : on garde un décor lisible.
          <>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 40% at 50% 22%, rgba(255,236,190,.28), transparent 70%)" }} />
            <div style={{ position: "absolute", left: "50%", top: "34%", transform: "translate(-50%,-50%)", width: "42%", aspectRatio: "1", borderRadius: "50%", background: "rgba(255,255,255,.10)" }} />
          </>
        )}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "34%", background: "linear-gradient(to top, rgba(0,0,0,.45), transparent)" }} />

        <div ref={chipWrapRef} style={{ position: "absolute", left: pos.x + "%", top: pos.y + "%", transform: "translate(-50%,-50%)", maxWidth: "88%", textAlign: "center", pointerEvents: "none" }}>
          <SubtitlePreviewChip
            styleId={styleId} custom={custom} fontSize={fontSize}
            words={chunkWords} activeIdx={activeIdx} progress={chunkProgress}
          />
        </div>

        {onScaleChange && chipSize.w > 0 && (
          <div
            onPointerDown={onResizeStart}
            title="Glisser pour changer la taille"
            style={{
              position: "absolute",
              left: `calc(${pos.x}% + ${chipSize.w / 2}px)`,
              top: `calc(${pos.y}% + ${chipSize.h / 2}px)`,
              transform: "translate(-50%,-50%)",
              width: 20, height: 20, borderRadius: 99, cursor: "nwse-resize",
              background: "rgba(12,42,29,.88)", boxShadow: "0 0 0 2px #EEEDE3",
              zIndex: 4, touchAction: "none",
            }}
          />
        )}

        <div style={{ position: "absolute", right: 8, bottom: 8, zIndex: 3, display: "flex", gap: 6 }}>
          {!ownFrame && sceneList.length > 1 && (
            <button type="button"
              onClick={e => { e.stopPropagation(); setPick(prev => prev.map((v, i) => (i === scene ? v + 1 : v))); }}
              onPointerDown={e => e.stopPropagation()}
              title="Autre image de test"
              style={{
                display: "grid", placeItems: "center", width: 28, height: 28,
                borderRadius: 99, border: "none", cursor: "pointer",
                background: "rgba(12,42,29,.82)", color: "#EEEDE3",
              }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v4h-4"/></svg>
            </button>
          )}
          <button type="button" onClick={e => { e.stopPropagation(); play(); }}
            onPointerDown={e => e.stopPropagation()}
            title="Rejouer l'animation"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 11px", borderRadius: 99, border: "none", cursor: "pointer",
              background: "rgba(12,42,29,.82)", color: "#EEEDE3",
              fontSize: 11.5, fontWeight: 800, fontFamily: "var(--sans)",
            }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4l14 8-14 8V4Z" /></svg>
            {playing ? "Lecture…" : "Animer"}
          </button>
        </div>
      </div>

      {/* Choix du fond de test : la lisibilité dépend entièrement de l'image */}
      <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
        {TEST_SCENES.map((s, i) => (
          <button type="button" key={s.id}
            onClick={() => { setOwnFrame(null); setScene(i); }}
            className={!ownFrame && scene === i ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
            style={{ fontSize: 11, padding: "4px 9px" }}>
            {s.label}
          </button>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()}
          className={ownFrame ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
          style={{ fontSize: 11, padding: "4px 9px" }}>
          Mon image
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) setOwnFrame(URL.createObjectURL(f));
          }} />
      </div>

      {/* Texte d'exemple modifiable : on juge le rendu sur SON propre texte,
          plutôt que sur une phrase de démo imposée. */}
      <input
        type="text"
        value={customPhrase}
        onChange={(e) => setCustomPhrase(e.target.value)}
        placeholder={editableTextLabel}
        className="input"
        style={{ marginTop: 8, height: 32, fontSize: 12.5 }}
      />

      {hint && <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "8px 0 0", lineHeight: 1.4 }}>{hint}</p>}
    </div>
  );
}
