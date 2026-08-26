"use client";

// panels.tsx — corps des panneaux de propriétés par outil (Direction A).
// Reprend la structure de design_handoff_montage_video/design_files/panels.jsx,
// branché sur de vraies actions (state du projet Montage).

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { VIcon } from "./icons";
import SubtitleStyleEditor from "@/components/SubtitleStyleEditor";
import { Row, Ico, Num, Fold, Swatches, AlignIcon, chargerCatalogue, type GFont } from "@/components/EditorControls";
import {
  MontageClip, OverlayClip, Caption, TitleEl, StickerEl, AudioTrack, SubCustom, SubTemplate,
  FILTERS, TRANSITIONS, TRANSITION_FAMILIES, SPEEDS, SUB_STYLES, SUB_LENGTHS, STICKER_GLYPHS, FONT_CHOICES,
  effectiveSubStyle, loadSubTemplates, saveSubTemplates,
  clipFilterCss, overlayFilterCss, clipTimelineDur, overlayTimelineDur,
  OVERLAY_EFFECT_PRESETS, overlayEffectCss, TITLE_DEFAULT_MAX_WIDTH,
  TITLE_EFFECT_PRESETS, titleLook, titleShadowCss, titleWeight, titleItalic, withAlpha,
} from "./constants";
import { chargerPoliceGoogle } from "./fonts";

export interface MontageCtx {
  clips: MontageClip[];
  selectedClip: (MontageClip & { start: number; end: number }) | null;
  captions: Caption[];
  subStyleId: string;
  subMaxWords: number;
  subCustom: SubCustom;
  subPos: { x: number; y: number };
  linkedSubs: boolean;
  /** Nombre de sous-titres sélectionnés au lasso (0 = aucun lot). */
  capSelectedCount: number;
  setLinkedSubs: (v: boolean) => void;
  selectedCaptionId: string | null;
  setSelectedCaptionId: (id: string | null) => void;
  hasRawSegments: boolean;
  titles: TitleEl[];
  stickers: StickerEl[];
  audioTracks: AudioTrack[];
  showProgressBar: boolean;
  time: number;
  total: number;
  logoUrl: string | null;
  /** Couleurs et polices de la charte du client (page Style de l'espace). */
  brandColors: string[];
  brandFonts: string[];
  uploadingAudio: boolean;
  transcribing: boolean;
  isRecordingVO: boolean;
  croppingClipId: string | null;
  smartCropClip: (clipId: string) => void;
  assembling: boolean;
  autoAssembleAI: () => void;
  cuttingSilence: boolean;
  cutSilences: () => void;
  // Prémontage par analyse d'image (noir / flou / cramé / figé) — sans clé API.
  autoCutting: boolean;
  autoCutQuality: () => void;
  autoCutProgress: { done: number; total: number; name: string } | null;
  // Découpe fine via transcription (hésitations, faux départs, prises refaites).
  cuttingFillers: boolean;
  cutFillers: () => void;
  // Prémontage complet : enchaîne dérushage image + parole, sous-titres, transitions.
  preEditing: boolean;
  preEditStep: string | null;
  runFullPreEdit: () => void;
  generatingDesc: boolean;
  videoDescription: string | null;
  generateVideoDescription: () => void;
  suggestingMusic: boolean;
  musicSuggestion: string | null;
  suggestMusicMoodAI: () => void;

  toast: (msg: string) => void;
  updateClip: (id: string, patch: Partial<MontageClip>) => void;
  splitAtPlayhead: () => void;
  duplicateSelected: () => void;
  removeSelected: () => void;
  applyTransitionToAll: (transitionIn: string, dur: number) => void;

  addTitle: () => void;
  updateTitle: (id: string, patch: Partial<TitleEl>) => void;
  removeTitle: (id: string) => void;

  addCaption: () => void;
  updateCaption: (id: string, patch: Partial<Caption>) => void;
  removeCaption: (id: string) => void;
  setSubStyleId: (id: string) => void;
  setCaptionLength: (words: number) => void;
  setSubCustom: (updater: (c: SubCustom) => SubCustom) => void;
  resetSubCustom: () => void;
  applySubTemplate: (tpl: { styleId: string; custom: SubCustom; pos: { x: number; y: number }; maxWords: number }) => void;
  generateCaptionsAI: () => void;
  /** Amène la tête de lecture à cet instant (clic sur une ligne de transcription). */
  seek: (t: number) => void;

  addSticker: (glyph: string, isImage?: boolean) => void;
  updateSticker: (id: string, patch: Partial<StickerEl>) => void;
  removeSticker: (id: string) => void;

  toggleProgressBar: () => void;
  importAudio: (file: File, kind: "music" | "voiceover") => void;
  removeAudioTrack: (id: string) => void;
  setAudioVol: (id: string, vol: number) => void;
  setAudioFade: (id: string, kind: "fadeIn" | "fadeOut", seconds: number) => void;
  toggleRecordVO: () => void;
  audioTrackCount: number;
  moveAudioTrackRow: (id: string, dir: 1 | -1) => void;
  addVolKey: (id: string) => void;
  setVolKey: (id: string, idx: number, v: number) => void;
  removeVolKey: (id: string, idx: number) => void;
  processingVoice: string | null;
  isolateVoiceOnTrack: (id: string, mode: "isolate" | "remove") => void;
  beatSyncing: string | null;
  snapCutsToBeat: (id: string) => void;

  overlays: OverlayClip[];
  selectedOverlay: OverlayClip | null;
  uploadingOverlay: boolean;
  addOverlayFiles: () => void;
  updateOverlay: (id: string, patch: Partial<OverlayClip>) => void;
  removeOverlay: (id: string) => void;
  duplicateOverlay: (id: string) => void;
  selectOverlay: (id: string) => void;
  videoTrackCount: number;
  moveOverlayTrack: (id: string, dir: 1 | -1) => void;
}

// Convertit un id à tirets ("bold-white") en clé camelCase ("boldWhite") pour
// retrouver la traduction correspondante dans le namespace montageConstants.
function camelKey(id: string): string {
  return id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

const SUB_LENGTH_KEY: Record<number, string> = { 1: "one", 2: "two", 3: "three", 4: "four", 6: "six", 99: "sentence" };

/** Ce réglage d'effet est-il celui de l'incrustation ? Sert à marquer la
 *  vignette active : on compare champ à champ ce que le réglage impose. */
function memeEffet(o: OverlayClip, patch: Partial<OverlayClip>): boolean {
  return (Object.keys(patch) as (keyof OverlayClip)[]).every((k) => {
    const attendu = patch[k], courant = o[k];
    if (typeof attendu === "number") return Math.abs((courant as number ?? 0) - attendu) < 0.05;
    if (typeof attendu === "boolean") return !!courant === attendu;
    return String(courant ?? "").toUpperCase() === String(attendu ?? "").toUpperCase();
  });
}

// ─── petits composants réutilisables ────────────────────────────────────────

function Range({ label, value, min, max, step = 1, unit = "", onChange, fmtv }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void; fmtv?: (v: number) => string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="mz-rangelbl">
        <span style={{ fontWeight: 700, fontSize: 12.5, color: "var(--ink-2)" }}>{label}</span>
        {/* Arrondi par défaut : une valeur posée à la souris (le début d'un
            titre glissé sur la timeline, par exemple) arrivait avec toutes ses
            décimales et s'affichait telle quelle, sur trois lignes. */}
        <span className="mz-rangeval">{fmtv ? fmtv(value) : `${Math.round(value * 100) / 100}${unit}`}</span>
      </div>
      <input className="mz-range" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "4px 0", marginBottom: 6, border: "none", background: "transparent", cursor: "pointer" }}>
      <span style={{ width: 38, height: 22, borderRadius: 99, background: on ? "var(--leaf)" : "var(--sunk)", boxShadow: on ? "none" : "inset 0 0 0 1px var(--line)", position: "relative", flexShrink: 0, transition: "background .18s" }}>
        <span style={{ position: "absolute", top: 2, left: 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(13,15,10,.3)", transform: on ? "translateX(16px)" : "none", transition: "transform .2s var(--ease)" }} />
      </span>
      <span style={{ fontWeight: 600, fontSize: 12.5, color: "var(--ink-2)", textAlign: "left" }}>{label}</span>
    </button>
  );
}

/* ─── Habillage d'un titre ───────────────────────────────────────────────────

   Le panneau empilait de gros blocs cliquables pour le gras, l'italique,
   l'alignement, et déroulait les polices en grandes cartes. Personne ne
   reconnaissait ces commandes : partout ailleurs, dans un traitement de texte
   comme dans un logiciel de montage, ce sont de petits carrés à icône alignés
   sur une ligne avec leur libellé, et une liste déroulante pour la police.

   On reprend donc les conventions que tout le monde connaît, dans les codes de
   KLIP : lignes libellé + contrôle, carrés de 30 px, champs numériques courts,
   et les effets rangés dans des sections repliables qu'on active à la case. */

function TitleStylePanel({ ctx, tt }: { ctx: MontageCtx; tt: TitleEl }) {
  const t = useTranslations('montage');
  const tc = useTranslations('montageConstants');
  const [fonts, setFonts] = useState<GFont[]>([]);
  useEffect(() => { chargerCatalogue().then(setFonts); }, []);
  const look = titleLook(tt);

  // Valeur de la liste : "k:<id>" pour les polices KLIP, la famille sinon.
  const valPolice = tt.fontFamily ? tt.fontFamily : `k:${tt.font}`;
  const choisirPolice = (v: string) => {
    if (v.startsWith("k:")) { ctx.updateTitle(tt.id, { font: v.slice(2) as TitleEl["font"], fontFamily: undefined }); return; }
    chargerPoliceGoogle(v);
    ctx.updateTitle(tt.id, { fontFamily: v });
  };
  // La police retenue doit être déclarée, sinon l'aperçu et le fichier la
  // mesureraient sur une autre fonte.
  useEffect(() => { if (tt.fontFamily) chargerPoliceGoogle(tt.fontFamily); }, [tt.fontFamily]);

  return (
    <>
      <div className="a-section">
        <span className="mz-sec-label">{t('font')}</span>
        <Row label={t('font')}>
          <select className="mz-sel" value={valPolice} onChange={(e) => choisirPolice(e.target.value)}>
            {ctx.brandFonts.length > 0 && (
              <optgroup label={t('brandFonts')}>
                {ctx.brandFonts.map((f) => <option key={f} value={f}>{f}</option>)}
              </optgroup>
            )}
            <optgroup label={t('builtInFonts')}>
              {FONT_CHOICES.map((f) => <option key={f.id} value={`k:${f.id}`}>{tc(`fontChoiceName.${f.id}`)}</option>)}
            </optgroup>
            {fonts.length > 0 && (
              <optgroup label={t('fontCatalogue')}>
                {fonts.map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
              </optgroup>
            )}
          </select>
        </Row>
        <Row label={t('size')}>
          <input className="mz-range" type="range" min={0.3} max={3} step={0.05} value={tt.scale ?? 1}
            onChange={(e) => ctx.updateTitle(tt.id, { scale: parseFloat(e.target.value) })} style={{ flex: 1 }} />
          <Num value={Math.round((tt.scale ?? 1) * 100)} min={30} max={300} step={5} suffix="%"
            onChange={(v) => ctx.updateTitle(tt.id, { scale: v / 100 })} />
        </Row>
        <Row label={t('style')}>
          <Ico on={titleWeight(tt) >= 700} title={t('bold')} onClick={() => ctx.updateTitle(tt.id, { weight: titleWeight(tt) >= 700 ? 400 : 800 })}>
            <span style={{ fontWeight: 900, fontSize: 13 }}>B</span>
          </Ico>
          <Ico on={titleItalic(tt)} title={t('italic')} onClick={() => ctx.updateTitle(tt.id, { italic: !titleItalic(tt) })}>
            <span style={{ fontStyle: "italic", fontWeight: 700, fontSize: 13, fontFamily: "Georgia, serif" }}>I</span>
          </Ico>
          <span style={{ width: 6 }} />
          {(["left", "center", "right"] as const).map((k) => (
            <Ico key={k} on={(tt.align ?? "center") === k} title={t(`align_${k}`)} onClick={() => ctx.updateTitle(tt.id, { align: k })}>
              <AlignIcon k={k} />
            </Ico>
          ))}
        </Row>
        <Row label={t('caseLabel')}>
          <div className="mz-seg">
            {([["none", "Aa"], ["upper", "AA"], ["lower", "aa"], ["title", "Aa."]] as const).map(([k, l]) => (
              <button key={k} className={(tt.caseMode ?? "none") === k ? "on" : ""} onClick={() => ctx.updateTitle(tt.id, { caseMode: k })}>{l}</button>
            ))}
          </div>
        </Row>
        <Row label={t('spacingLabel')}>
          <Num value={look.letterSpacing} min={-0.05} max={0.5} step={0.01} suffix="em"
            onChange={(v) => ctx.updateTitle(tt.id, { letterSpacing: v })} />
          <Num value={tt.maxWidth ?? TITLE_DEFAULT_MAX_WIDTH} min={20} max={100} step={1} suffix="%"
            onChange={(v) => ctx.updateTitle(tt.id, { maxWidth: v })} />
        </Row>
        <Row label={t('color')}>
          <Swatches brandColors={ctx.brandColors} value={tt.color} onPick={(c) => ctx.updateTitle(tt.id, { color: c })} />
        </Row>
        <Row label={t('opacity')}>
          <input className="mz-range" type="range" min={0.05} max={1} step={0.02} value={look.opacity}
            onChange={(e) => ctx.updateTitle(tt.id, { opacity: parseFloat(e.target.value) })} style={{ flex: 1 }} />
          <Num value={Math.round(look.opacity * 100)} min={5} max={100} step={5} suffix="%"
            onChange={(v) => ctx.updateTitle(tt.id, { opacity: v / 100 })} />
        </Row>
      </div>

      <div className="a-section">
        <span className="mz-sec-label">{t('presetStyle')}</span>
        <div className="mz-grid5">
          {TITLE_EFFECT_PRESETS.map((p) => {
            const vu = { ...tt, ...p.patch };
            const l = titleLook(vu);
            return (
              <button key={p.id} className="mz-aa" title={tc(`titleEffect.${p.id}`)} onClick={() => ctx.updateTitle(tt.id, p.patch)}>
                <span style={{
                  fontWeight: 800, fontSize: 16, color: l.fg,
                  textShadow: titleShadowCss(vu, 0.35),
                  WebkitTextStroke: l.stroke && l.strokeW > 0 ? `${l.strokeW * 0.35}px ${l.stroke}` : undefined,
                  paintOrder: "stroke fill",
                  background: l.bg !== "transparent" ? withAlpha(l.bg, l.bgOpacity) : undefined,
                  padding: l.bg !== "transparent" ? "1px 6px" : undefined,
                  borderRadius: l.bg !== "transparent" ? Math.min(9, l.radius * 0.35) : undefined,
                }}>Aa</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="a-section">
        <span className="mz-sec-label">{t('effects')}</span>

        <Fold name={t('outline')} on={look.strokeW > 0} onToggle={(v) => ctx.updateTitle(tt.id, { strokeW: v ? 2.5 : 0, stroke: tt.stroke || "#000000" })}>
          <Row label={t('outlineWidth')}>
            <input className="mz-range" type="range" min={0.25} max={8} step={0.25} value={look.strokeW || 2.5}
              onChange={(e) => ctx.updateTitle(tt.id, { strokeW: parseFloat(e.target.value) })} style={{ flex: 1 }} />
            <Num value={look.strokeW} min={0} max={8} step={0.25} onChange={(v) => ctx.updateTitle(tt.id, { strokeW: v })} />
          </Row>
          <Row label={t('color')}><Swatches brandColors={ctx.brandColors} value={tt.stroke || "#000000"} onPick={(c) => ctx.updateTitle(tt.id, { stroke: c })} /></Row>
        </Fold>

        <Fold name={t('textBackground')} on={look.bg !== "transparent"} onToggle={(v) => ctx.updateTitle(tt.id, { bg: v ? (tt.bg && tt.bg !== "transparent" ? tt.bg : "#14160F") : "transparent" })}>
          <Row label={t('color')}><Swatches brandColors={ctx.brandColors} value={look.bg} onPick={(c) => ctx.updateTitle(tt.id, { bg: c })} /></Row>
          <Row label={t('opacity')}>
            <input className="mz-range" type="range" min={0} max={1} step={0.02} value={look.bgOpacity}
              onChange={(e) => ctx.updateTitle(tt.id, { bgOpacity: parseFloat(e.target.value) })} style={{ flex: 1 }} />
            <Num value={Math.round(look.bgOpacity * 100)} min={0} max={100} step={5} suffix="%" onChange={(v) => ctx.updateTitle(tt.id, { bgOpacity: v / 100 })} />
          </Row>
          <Row label={t('padding')}>
            <input className="mz-range" type="range" min={0} max={60} step={1} value={look.padX}
              onChange={(e) => { const v = parseFloat(e.target.value); ctx.updateTitle(tt.id, { padX: v, padY: Math.round(v * 0.5) }); }} style={{ flex: 1 }} />
            <Num value={look.padX} min={0} max={60} step={1} onChange={(v) => ctx.updateTitle(tt.id, { padX: v, padY: Math.round(v * 0.5) })} />
          </Row>
          {/* UN SEUL réglage d'arrondi, du carré à la pilule.

              Il y en avait deux : un curseur, et un interrupteur « Pilule » qui
              imposait l'arrondi maximal. Et comme la pilule rendait le curseur
              sans objet, je le cachais quand elle était allumée — si bien qu'un
              utilisateur en mode pilule ne trouvait plus aucun moyen de régler
              l'arrondi. Deux commandes pour une seule idée, dont une qui faisait
              disparaître l'autre.

              La pilule n'est qu'un arrondi poussé à fond : le curseur va
              jusque-là, et le rendu borne de lui-même à la moitié de la hauteur,
              des deux côtés. */}
          <Row label={t('roundedCorners')}>
            <input className="mz-range" type="range" min={0} max={60} step={1}
              value={look.radius}
              onChange={(e) => ctx.updateTitle(tt.id, { radius: parseFloat(e.target.value) })} style={{ flex: 1 }} />
            <Num value={look.radius} min={0} max={60} step={1}
              onChange={(v) => ctx.updateTitle(tt.id, { radius: v })} />
          </Row>
        </Fold>

        <Fold name={t('glow')} on={look.glow} onToggle={(v) => ctx.updateTitle(tt.id, { glow: v })}>
          <Row label={t('color')}><Swatches brandColors={ctx.brandColors} value={look.glowColor} onPick={(c) => ctx.updateTitle(tt.id, { glowColor: c })} /></Row>
          <Row label={t('shadowBlur')}>
            <input className="mz-range" type="range" min={2} max={40} step={1} value={look.glowBlur}
              onChange={(e) => ctx.updateTitle(tt.id, { glowBlur: parseFloat(e.target.value) })} style={{ flex: 1 }} />
            <Num value={look.glowBlur} min={2} max={40} step={1} onChange={(v) => ctx.updateTitle(tt.id, { glowBlur: v })} />
          </Row>
        </Fold>

        <Fold name={t('dropShadow')} on={look.shadow} onToggle={(v) => ctx.updateTitle(tt.id, { shadow: v })}>
          <Row label={t('color')}><Swatches brandColors={ctx.brandColors} value={tt.shadowColor || "#000000"} onPick={(c) => ctx.updateTitle(tt.id, { shadowColor: c })} /></Row>
          <Row label={t('shadowBlur')}>
            <input className="mz-range" type="range" min={0} max={30} step={0.5} value={look.shadowBlur}
              onChange={(e) => ctx.updateTitle(tt.id, { shadowBlur: parseFloat(e.target.value) })} style={{ flex: 1 }} />
            <Num value={look.shadowBlur} min={0} max={30} step={0.5} onChange={(v) => ctx.updateTitle(tt.id, { shadowBlur: v })} />
          </Row>
          <Row label={t('offset')}>
            <Num value={look.shadowX} min={-20} max={20} step={0.5} suffix="x" onChange={(v) => ctx.updateTitle(tt.id, { shadowX: v })} />
            <Num value={look.shadowY} min={-20} max={20} step={0.5} suffix="y" onChange={(v) => ctx.updateTitle(tt.id, { shadowY: v })} />
          </Row>
          <Row label={t('shadowStrength')}>
            <input className="mz-range" type="range" min={0} max={1} step={0.02} value={tt.shadowOpacity ?? 0.5}
              onChange={(e) => ctx.updateTitle(tt.id, { shadowOpacity: parseFloat(e.target.value) })} style={{ flex: 1 }} />
            <Num value={Math.round((tt.shadowOpacity ?? 0.5) * 100)} min={0} max={100} step={5} suffix="%" onChange={(v) => ctx.updateTitle(tt.id, { shadowOpacity: v / 100 })} />
          </Row>
        </Fold>
      </div>
    </>
  );
}

// ─── Découper / Rogner ──────────────────────────────────────────────────────

export function CutPanel({ ctx }: { ctx: MontageCtx }) {
  const t = useTranslations('montage');
  const c = ctx.selectedClip;
  return (
    <>
      <div className="a-section">
        <span className="mz-sec-label">{t('cutSelectedClip')}</span>
        {c ? (
          <div className="mz-music" style={{ cursor: "default" }}>
            <span className="mz-music-play" style={{ background: "var(--forest)" }}><VIcon name={c.kind === "photo" ? "image" : "video"} size={15} /></span>
            <div style={{ minWidth: 0 }}><div className="mz-music-name trunc">{c.name}</div><div className="mz-music-meta">{t('cutTimelineTime', { s: clipTimelineDur(c).toFixed(1) })}</div></div>
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{t('selectClipHint')}</p>
        )}
      </div>
      <div className="a-section">
        <span className="mz-sec-label">{t('actions')}</span>
        <div className="mz-ai-list">
          <button className="btn btn-dark mz-btn-block" disabled={!c} onClick={ctx.splitAtPlayhead}><VIcon name="split" size={15} /> {t('splitAtPlayhead')}</button>
          <button className="btn btn-ghost mz-btn-block" disabled={!c} onClick={ctx.duplicateSelected}><VIcon name="copy" size={15} /> {t('duplicate')}</button>
          <button className="btn btn-ghost mz-btn-block" disabled={!c} onClick={ctx.removeSelected}><VIcon name="trash" size={15} /> {t('delete')}</button>
        </div>
      </div>
      {c && (
        <div className="a-section">
          <span className="mz-sec-label">{t('trimming')} {c.kind === "photo" ? t('trimmingFixedDur') : ""}</span>
          {c.kind === "video" ? (
            <>
              <Range label={t('start')} value={c.trimStart} min={0} max={Math.max(0, c.trimEnd - 0.2)} step={0.1} unit="s" onChange={(v) => ctx.updateClip(c.id, { trimStart: v })} />
              <Range label={t('end')} value={c.trimEnd} min={c.trimStart + 0.2} max={c.srcDur} step={0.1} unit="s" onChange={(v) => ctx.updateClip(c.id, { trimEnd: v })} />
            </>
          ) : (
            <Range label={t('duration')} value={c.trimEnd} min={1} max={15} step={0.5} unit="s" onChange={(v) => ctx.updateClip(c.id, { trimEnd: v })} />
          )}
        </div>
      )}
      {c && (
        <div className="a-section">
          <span className="mz-sec-label">{t('gapBeforeTitle')}</span>
          <p style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.45, marginBottom: 8 }}>
            {t('gapBeforeHint')}
          </p>
          <Range label={t('gapBeforeLabel')} value={c.gapBefore ?? 0} min={0} max={10} step={0.1} unit="s" onChange={(v) => ctx.updateClip(c.id, { gapBefore: v })} />
        </div>
      )}
      {c && c.kind === "photo" && (
        <div className="a-section">
          <span className="mz-sec-label">{t('kenBurnsTitle')}</span>
          <div className="mz-seg">
            {([[undefined, t('none')], ["in", t('zoomIn')], ["out", t('zoomOut')]] as const).map(([k, l]) => (
              <button key={l} className={c.kenBurns === k ? "on" : ""} onClick={() => ctx.updateClip(c.id, { kenBurns: k })}>{l}</button>
            ))}
          </div>
        </div>
      )}
      {c && (
        <div className="a-section">
          <span className="mz-sec-label">{t('smartCropTitle')}</span>
          <p style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.45, marginBottom: 8 }}>
            {t('smartCropDesc')}
          </p>
          <button className="btn btn-dark mz-btn-block" disabled={ctx.croppingClipId === c.id} onClick={() => ctx.smartCropClip(c.id)}>
            <VIcon name="sparkles" size={15} /> {ctx.croppingClipId === c.id ? t('analyzing') : t('smartCropButton')}
          </button>
          {(c.focusX !== undefined || c.focusY !== undefined) && (
            <button className="btn btn-ghost mz-btn-block" style={{ marginTop: 6 }} onClick={() => ctx.updateClip(c.id, { focusX: undefined, focusY: undefined })}>
              {t('resetCrop')}
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ─── Texte & titres ─────────────────────────────────────────────────────────

export function TextPanel({ ctx, selectedTitleId }: { ctx: MontageCtx; selectedTitleId: string | null }) {
  const t = useTranslations('montage');
  const tc = useTranslations('montageConstants');
  const tt = ctx.titles.find((x) => x.id === selectedTitleId) || null;
  return (
    <>
      <div className="a-section">
        <button className="btn btn-primary mz-btn-block" onClick={ctx.addTitle}><VIcon name="plus" size={15} /> {t('addTitle')}</button>
      </div>
      {!tt ? (
        <div className="a-section">
          <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>{t('clickTitleHint')}</p>
        </div>
      ) : (
        <>
          <div className="a-section">
            <span className="mz-sec-label">{t('text')}</span>
            <textarea className="input" value={tt.text} onChange={(e) => ctx.updateTitle(tt.id, { text: e.target.value })} rows={2} style={{ width: "100%", resize: "vertical" }} />
          </div>
          <TitleStylePanel ctx={ctx} tt={tt} />
          <div className="a-section">
            <span className="mz-sec-label">{t('entryAnimation')}</span>
            <div className="mz-seg">
              {([["none", t('animNone')], ["rise", t('animRise')], ["type", t('animType')], ["pop", t('animPop')]] as const).map(([k, l]) => (
                <button key={k} className={tt.anim === k ? "on" : ""} onClick={() => ctx.updateTitle(tt.id, { anim: k })}>{l}</button>
              ))}
            </div>
          </div>

          <div className="a-section">
            <span className="mz-sec-label">{t('timing')}</span>
            <Range label={t('start')} value={tt.start} min={0} max={Math.max(0.5, ctx.total - 0.5)} step={0.1} unit="s" onChange={(v) => ctx.updateTitle(tt.id, { start: Math.min(v, tt.end - 0.2) })} />
            <Range label={t('end')} value={tt.end} min={tt.start + 0.2} max={ctx.total} step={0.1} unit="s" onChange={(v) => ctx.updateTitle(tt.id, { end: v })} />
          </div>
          <div className="a-section">
            <button className="btn btn-ghost mz-btn-block" onClick={() => ctx.removeTitle(tt.id)}><VIcon name="trash" size={15} /> {t('deleteThisTitle')}</button>
          </div>
        </>
      )}
    </>
  );
}

// ─── Sous-titres ────────────────────────────────────────────────────────────

export function CaptionsPanel({ ctx }: { ctx: MontageCtx }) {
  const t = useTranslations('montage');
  const tc = useTranslations('montageConstants');
  const hasVideo = ctx.clips.some((c) => c.kind === "video");
  const [tpls, setTpls] = useState<SubTemplate[]>(() => loadSubTemplates());
  const [tplName, setTplName] = useState("");

  /* Deux onglets plutôt qu'une seule colonne interminable.

     Tout cohabitait dans un même défilement : la bibliothèque de styles, tous
     les réglages, les modèles, et la transcription tout en bas. Corriger un mot
     mal entendu demandait de descendre sous une page entière de réglages qu'on
     ne venait pas voir. Ce sont deux gestes différents — relire ce qui est dit,
     et décider de quoi ça a l'air — donc deux onglets. */
  const [tab, setTab] = useState<"transcript" | "style">("transcript");

  /* Sélectionner un sous-titre (sur la timeline, ou dans l'aperçu) amène droit
     à sa ligne dans la transcription : on voit tout de suite où le corriger.
     Le repère est posé ici et consommé une fois l'onglet affiché, sinon on
     chercherait à faire défiler une ligne qui n'est pas encore à l'écran. */
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const lastSelRef = useRef<string | null>(null);
  const toScrollRef = useRef<string | null>(null);
  useEffect(() => {
    const id = ctx.selectedCaptionId;
    if (!id || id === lastSelRef.current) return;
    lastSelRef.current = id;
    toScrollRef.current = id;
    setTab("transcript");
  }, [ctx.selectedCaptionId]);
  useEffect(() => {
    const id = toScrollRef.current;
    if (!id || tab !== "transcript") return;
    // La ligne vient d'apparaître avec l'onglet : on laisse le navigateur finir
    // sa mise en page avant de viser. Un défilement « doux » lancé dans le même
    // souffle que le changement d'onglet se fait avaler par la remise à zéro du
    // conteneur ; on saute donc directement au bon endroit.
    const timer = setTimeout(() => {
      const el = rowRefs.current.get(id);
      // Tant qu'on ne la tient pas, le repère reste posé et le prochain rendu
      // réessaiera : sinon la demande serait perdue en silence.
      if (!el) return;
      toScrollRef.current = null;
      el.scrollIntoView({ block: "center" });
    }, 0);
    return () => clearTimeout(timer);
  }, [tab, ctx.selectedCaptionId, ctx.captions.length]);

  function saveTemplate() {
    const name = tplName.trim() || t('defaultTemplateName', { n: tpls.length + 1 });
    const tpl: SubTemplate = { id: crypto.randomUUID(), name, styleId: ctx.subStyleId, custom: ctx.subCustom, maxWords: ctx.subMaxWords, pos: ctx.subPos };
    const next = [...tpls, tpl];
    setTpls(next); saveSubTemplates(next); setTplName("");
    ctx.toast(t('subTemplateSavedToast'));
  }
  function deleteTemplate(id: string) {
    const next = tpls.filter((tpl) => tpl.id !== id);
    setTpls(next); saveSubTemplates(next);
  }
  return (
    <>
      {/* Même vocabulaire que le sélecteur « lié / individuel » juste en dessous :
          le monteur n'a pas besoin d'une deuxième façon de proposer un choix. */}
      <div className="a-section" style={{ paddingBottom: 0 }}>
        <div style={{ display: "flex", gap: 6, background: "var(--sunk)", borderRadius: 10, padding: 4 }}>
          <button className={"mz-chip-btn" + (tab === "transcript" ? " on" : "")} style={{ flex: 1, justifyContent: "center" }} onClick={() => setTab("transcript")}>
            <VIcon name="captions" size={13} /> {t('subTabTranscript')}
            {ctx.captions.length > 0 && <span style={{ opacity: .6, fontVariantNumeric: "tabular-nums" }}>{ctx.captions.length}</span>}
          </button>
          <button className={"mz-chip-btn" + (tab === "style" ? " on" : "")} style={{ flex: 1, justifyContent: "center" }} onClick={() => setTab("style")}>
            <VIcon name="sparkles" size={13} /> {t('subTabStyle')}
          </button>
        </div>
      </div>

      {tab === "transcript" ? (
        <>
      <div className="a-section">
        <div className="mz-ai-card">
          <div className="halo-blob" style={{ width: 140, height: 140, right: -40, top: -50, background: "radial-gradient(circle, var(--mint), transparent 70%)", opacity: .5 }} />
          <div style={{ position: "relative", zIndex: 2 }}>
            <div className="mz-sec-label" style={{ color: "var(--leaf)", marginBottom: 8 }}>{t('aiTranscriptionLabel')}</div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "italic", fontSize: 18, letterSpacing: "-0.02em", marginBottom: 4 }}>{t('autoCaptionsTitle')}</div>
            <p style={{ fontSize: 12, color: "var(--cream-2)", marginBottom: 12, lineHeight: 1.45 }}>{t('autoCaptionsDesc')}</p>
            <button className="mz-ai-btn" disabled={!hasVideo || ctx.transcribing} onClick={ctx.generateCaptionsAI}>
              <VIcon name="sparkles" size={16} /> {ctx.transcribing ? t('transcribing') : t('generateCaptions')}
            </button>
          </div>
        </div>
      </div>
      <div className="a-section">
        <span className="mz-sec-label">{t('manualCaptionTitle')}</span>
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "0 0 8px" }}>{t('manualCaptionDesc')}</p>
        <button className="btn btn-dark btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={ctx.addCaption}>
          <VIcon name="plus" size={14} /> {t('createCaption')}
        </button>
      </div>
      <div className="a-section">
        <span className="mz-sec-label">{t('transcribedTextTitle', { count: ctx.captions.length })}</span>
        {ctx.captions.length === 0 && (
          <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "0 0 8px" }}>{t('noCaptionsHint')}</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ctx.captions.map((s) => {
            const sel = ctx.selectedCaptionId === s.id;
            return (
            <div
              key={s.id}
              ref={(el) => { if (el) rowRefs.current.set(s.id, el); else rowRefs.current.delete(s.id); }}
              onClick={(e) => {
                // Un clic sur un champ ou un bouton fait son travail à lui : on ne
                // déplace pas la tête de lecture pendant qu'on règle un horodatage.
                if ((e.target as HTMLElement).closest("input,button")) return;
                ctx.setSelectedCaptionId(s.id);
                ctx.seek(s.start + 0.05);
              }}
              style={{
                display: "flex", flexDirection: "column", gap: 6, padding: "9px 11px", borderRadius: 9,
                background: sel ? "color-mix(in srgb, var(--vio) 14%, var(--sunk))" : "var(--sunk)",
                boxShadow: sel ? "inset 0 0 0 1.5px var(--vio)" : "none",
                cursor: "pointer", scrollMarginBlock: 12,
              }}>
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  style={{ fontSize: 12.5, lineHeight: 1.4, outline: "none", flex: 1, cursor: "text" }}
                  onBlur={(e) => ctx.updateCaption(s.id, { text: e.currentTarget.textContent || "" })}
                >
                  {s.text}
                </span>
                <button className="mz-hbtn" style={{ width: 22, height: 22, flexShrink: 0 }} onClick={() => ctx.removeCaption(s.id)}><VIcon name="x" size={12} /></button>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: 9.5, color: "var(--ink-3)" }}>{t('captionStart')}</span>
                <input type="number" step={0.1} min={0} value={Number(s.start.toFixed(2))} onChange={(e) => ctx.updateCaption(s.id, { start: Math.min(parseFloat(e.target.value) || 0, s.end - 0.1) })} style={{ width: 58, fontFamily: "var(--mono)", fontSize: 11, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--white)" }} />
                <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: 9.5, color: "var(--ink-3)" }}>{t('captionEnd')}</span>
                <input type="number" step={0.1} min={0} value={Number(s.end.toFixed(2))} onChange={(e) => ctx.updateCaption(s.id, { end: Math.max(parseFloat(e.target.value) || 0, s.start + 0.1) })} style={{ width: 58, fontFamily: "var(--mono)", fontSize: 11, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--white)" }} />
              </div>
            </div>
            );
          })}
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={ctx.addCaption}><VIcon name="plus" size={13} /> {t('addAtPlayhead')}</button>
        </div>
      </div>
        </>
      ) : (
        <>
      <div className="a-section">
        <span className="mz-sec-label">{t('displayLengthTitle')}</span>
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "0 0 8px" }}>{t('wordsPerCaptionDesc')} {ctx.hasRawSegments ? t('reflowsLive') : t('appliedNextGen')}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SUB_LENGTHS.map((l) => (
            <button
              key={l.words}
              className={"mz-chip-btn" + (ctx.subMaxWords === l.words ? " on" : "")}
              onClick={() => ctx.setCaptionLength(l.words)}
            >
              {tc(`subLength.${SUB_LENGTH_KEY[l.words] ?? "four"}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="a-section">
        <span className="mz-sec-label">{t('styleLibraryTitle')}</span>
        <div className="mz-substyle">
          {SUB_STYLES.map((s) => (
            <button key={s.id} className={"mz-substyle-card" + (ctx.subStyleId === s.id ? " on" : "")} onClick={() => ctx.setSubStyleId(s.id)}>
              <div className="mz-substyle-prev">
                <span style={{
                  display: "inline-block",
                  padding: s.pill ? "4px 10px" : "4px 8px",
                  borderRadius: s.pill ? 99 : 6,
                  background: s.bg, color: s.fg,
                  fontFamily: s.font || (s.italic ? "var(--display)" : "var(--sans)"),
                  fontStyle: s.italic ? "italic" : "normal",
                  fontWeight: s.weight, fontSize: 13,
                  textTransform: s.uppercase ? "uppercase" : "none",
                  WebkitTextStroke: s.stroke ? `1.4px ${s.stroke}` : undefined,
                  paintOrder: "stroke fill",
                  textShadow: s.bg === "transparent" && !s.stroke ? "0 1px 6px rgba(0,0,0,.6)" : "none",
                }}>
                  Auto<span style={{ color: s.hi }}>mne</span>
                </span>
              </div>
              <div className="mz-substyle-meta"><div className="mz-substyle-name">{tc(`subStyleName.${camelKey(s.id)}`)}</div><div className="mz-substyle-sub">{tc(`subStyleSub.${camelKey(s.id)}`)}</div></div>
            </button>
          ))}
        </div>
      </div>
      <div className="a-section">
        {/* Lier / délier : un style commun à tous, ou un style par sous-titre. */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, background: "var(--sunk)", borderRadius: 10, padding: 4 }}>
          <button className={"mz-chip-btn" + (ctx.linkedSubs ? " on" : "")} style={{ flex: 1, justifyContent: "center" }} onClick={() => ctx.setLinkedSubs(true)}>
            <VIcon name="link" size={13} /> {t('subsLinked')}
          </button>
          <button className={"mz-chip-btn" + (!ctx.linkedSubs ? " on" : "")} style={{ flex: 1, justifyContent: "center" }} onClick={() => ctx.setLinkedSubs(false)}>
            <VIcon name="unlink" size={13} /> {t('subsIndividual')}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span className="mz-sec-label" style={{ margin: 0 }}>{t('customizationTitle')}</span>
          <button className="btn btn-ghost btn-sm" onClick={ctx.resetSubCustom} title={t('resetToBaseStyle')}><VIcon name="undo" size={12} /> {t('reset')}</button>
        </div>
        {ctx.capSelectedCount > 1 ? (
          // Un lot est sélectionné : on le dit, sinon on croit régler un seul
          // sous-titre (ou tous) alors qu'on en règle une partie.
          <p style={{ fontSize: 11.5, margin: "0 0 10px", padding: "7px 10px", borderRadius: 8,
            background: "color-mix(in srgb, var(--vio) 14%, transparent)", color: "var(--ink)", fontWeight: 600 }}>
            {t('subsMultiHint', { n: ctx.capSelectedCount })}
          </p>
        ) : (
          <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "0 0 10px" }}>{ctx.linkedSubs ? t('subsLinkedHint') : t('subsIndividualHint')}</p>
        )}
      </div>
      {/* Réglages complets — MÊME composant que l'assistant « nouveau client »,
          pour que les trois endroits proposent exactement les mêmes paramètres,
          et MÊMES contrôles que le panneau Texte : le sous-titre se règle avec
          la grammaire du reste du monteur. Le composant pose lui-même ses
          sections, il n'est donc pas rangé dans celle du dessus. */}
      <SubtitleStyleEditor
        styleId={ctx.subStyleId}
        custom={ctx.subCustom}
        onChange={(next) => ctx.setSubCustom(() => next)}
        brandFont={ctx.brandFonts[0] ?? null}
        brandColors={ctx.brandColors}
      />
      <div className="a-section">
        <span className="mz-sec-label">{t('myTemplatesTitle')}</span>
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "0 0 8px" }}>{t('createSubTemplateDesc')}</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <input className="input" placeholder={t('templateNamePlaceholder')} value={tplName} onChange={(e) => setTplName(e.target.value)} style={{ flex: 1, fontSize: 12.5, padding: "6px 9px" }} />
          <button className="btn btn-primary btn-sm" onClick={saveTemplate}><VIcon name="plus" size={13} /> {t('save')}</button>
        </div>
        {tpls.length === 0 ? (
          <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: 0 }}>{t('noSubTemplatesHint')}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tpls.map((tpl) => {
              const te = effectiveSubStyle(tpl.styleId, tpl.custom);
              return (
                <div key={tpl.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 9, background: "var(--sunk)" }}>
                  <span style={{ display: "inline-block", padding: te.pill ? "3px 8px" : "3px 6px", borderRadius: te.pill ? 99 : 5, background: te.bg, color: te.fg, fontFamily: te.font || "var(--sans)", fontWeight: te.weight, fontSize: 11, textTransform: te.uppercase ? "uppercase" : "none", WebkitTextStroke: te.stroke ? `1px ${te.stroke}` : undefined, paintOrder: "stroke fill", flexShrink: 0 }}>Aa</span>
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tpl.name}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => ctx.applySubTemplate(tpl)}>{t('apply')}</button>
                  <button className="mz-hbtn" style={{ width: 24, height: 24 }} onClick={() => deleteTemplate(tpl.id)}><VIcon name="trash" size={12} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}
    </>
  );
}

// ─── Audio ──────────────────────────────────────────────────────────────────

// Points-clés de volume (automation) d'une piste audio — ajout au curseur, réglage, suppression.
function VolKeyframes({ track, ctx }: { track: AudioTrack; ctx: MontageCtx }) {
  const t = useTranslations('montage');
  const keys = track.volKeys || [];
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="mz-sec-label">{t('volKeysTitle')}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => ctx.addVolKey(track.id)} title={t('volKeyAddTitle')}><VIcon name="plus" size={12} /> {t('volKeyAdd')}</button>
      </div>
      {keys.length === 0 ? (
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.4 }}>{t('volKeysHint')}</p>
      ) : (
        keys.map((k, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)", minWidth: 42 }}>{k.t.toFixed(1)}s</span>
            <input type="range" min={0} max={200} value={Math.round(k.v * 100)} onChange={(e) => ctx.setVolKey(track.id, i, Number(e.target.value) / 100)} style={{ flex: 1 }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", minWidth: 38, textAlign: "right" }}>{Math.round(k.v * 100)}%</span>
            <button className="mz-hbtn" style={{ width: 22, height: 22, flexShrink: 0 }} onClick={() => ctx.removeVolKey(track.id, i)}><VIcon name="x" size={11} /></button>
          </div>
        ))
      )}
    </div>
  );
}

// Isolation / suppression de la voix sur une piste (DSP best-effort).
function VoiceTools({ track, ctx }: { track: AudioTrack; ctx: MontageCtx }) {
  const t = useTranslations('montage');
  const busy = ctx.processingVoice === track.id;
  return (
    <div style={{ marginTop: 10 }}>
      <span className="mz-sec-label">{t('voiceToolsTitle')}</span>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} disabled={!!ctx.processingVoice} onClick={() => ctx.isolateVoiceOnTrack(track.id, "isolate")}>
          <VIcon name="sparkles" size={13} /> {busy ? t('voiceWorking') : t('voiceIsolate')}
        </button>
        <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} disabled={!!ctx.processingVoice} onClick={() => ctx.isolateVoiceOnTrack(track.id, "remove")}>
          {t('voiceRemove')}
        </button>
      </div>
      <p style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.4, marginTop: 5 }}>{t('voiceToolsHint')}</p>
    </div>
  );
}

// Calage des coupes sur le rythme du morceau. Proposé sur les pistes de MUSIQUE
// seulement : une voix off n'a pas de pulsation, et y caler des coupes n'a pas de sens.
function BeatSyncTool({ track, ctx }: { track: AudioTrack; ctx: MontageCtx }) {
  const t = useTranslations('montage');
  const busy = ctx.beatSyncing === track.id;
  return (
    <div style={{ marginTop: 10 }}>
      <span className="mz-sec-label">{t('beatSyncTitle')}</span>
      <button
        className="btn btn-ghost btn-sm mz-btn-block"
        style={{ marginTop: 6 }}
        disabled={!!ctx.beatSyncing || ctx.clips.length < 2}
        onClick={() => ctx.snapCutsToBeat(track.id)}
      >
        <VIcon name="sparkles" size={13} /> {busy ? t('beatSyncWorking') : t('beatSyncAction')}
      </button>
      <p style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.4, marginTop: 5 }}>{t('beatSyncHint')}</p>
    </div>
  );
}

export function AudioPanel({ ctx }: { ctx: MontageCtx }) {
  const t = useTranslations('montage');
  const fileRef = useRef<HTMLInputElement>(null);
  const music = ctx.audioTracks.filter((a) => a.kind === "music");
  const vo = ctx.audioTracks.filter((a) => a.kind === "voiceover");
  const videoClips = ctx.clips.filter((c) => c.kind === "video");
  return (
    <>
      {videoClips.length > 0 && (
        <div className="a-section">
          <span className="mz-sec-label">{t('clipSoundTitle')}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
            {videoClips.map((c) => (
              <div key={c.id}>
                <div className="mz-music on" style={{ cursor: "default" }}>
                  <button className="mz-music-play" style={{ background: (c.vol ?? 1) === 0 ? "var(--ink-3)" : "var(--forest)", border: "none", cursor: "pointer" }} title={(c.vol ?? 1) === 0 ? t('unmuteSound') : t('muteSound')} onClick={() => ctx.updateClip(c.id, { vol: (c.vol ?? 1) === 0 ? 1 : 0 })}>
                    <VIcon name={(c.vol ?? 1) === 0 ? "mute" : "volume"} size={14} />
                  </button>
                  <div style={{ minWidth: 0 }}><div className="mz-music-name trunc">{c.name}</div><div className="mz-music-meta">{t('clipSound')}</div></div>
                </div>
                <Range label={t('volume')} value={Math.round((c.vol ?? 1) * 100)} min={0} max={100} unit="%" onChange={(v) => ctx.updateClip(c.id, { vol: v / 100 })} />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="a-section">
        <button className="btn btn-dark mz-btn-block" onClick={ctx.toggleRecordVO}>
          <VIcon name="mic" size={15} /> {ctx.isRecordingVO ? t('stopRecording') : t('recordVoiceover')}
        </button>
      </div>
      {vo.map((a) => (
        <div key={a.id} className="a-section">
          <div className="mz-music on">
            <span className="mz-music-play"><VIcon name="mic" size={14} /></span>
            <div style={{ minWidth: 0 }}><div className="mz-music-name trunc">{a.name}</div><div className="mz-music-meta">{t('voiceoverLabel', { dur: a.dur.toFixed(1) })}</div></div>
            <button className="mz-hbtn" onClick={() => ctx.removeAudioTrack(a.id)}><VIcon name="trash" size={14} /></button>
          </div>
          <Range label={t('volumeVoiceover')} value={Math.round(a.vol * 100)} min={0} max={200} unit="%" onChange={(v) => ctx.setAudioVol(a.id, v / 100)} />
          <VolKeyframes track={a} ctx={ctx} />
          <VoiceTools track={a} ctx={ctx} />
          <Range label={t('fadeIn')} value={Math.round((a.fadeIn ?? 0) * 10) / 10} min={0} max={5} step={0.1} unit="s" onChange={(v) => ctx.setAudioFade(a.id, "fadeIn", v)} />
          <Range label={t('fadeOut')} value={Math.round((a.fadeOut ?? 0) * 10) / 10} min={0} max={5} step={0.1} unit="s" onChange={(v) => ctx.setAudioFade(a.id, "fadeOut", v)} />
          {ctx.audioTrackCount > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <button className="btn btn-ghost" style={{ minWidth: 34, padding: "5px 0" }} disabled={(a.track ?? 0) <= 0} onClick={() => ctx.moveAudioTrackRow(a.id, -1)} title={t('trackDown')}>−</button>
              <span style={{ flex: 1, textAlign: "center", fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>{t('videoTrackValue', { n: (a.track ?? 0) + 1, total: ctx.audioTrackCount })}</span>
              <button className="btn btn-ghost" style={{ minWidth: 34, padding: "5px 0" }} disabled={(a.track ?? 0) >= ctx.audioTrackCount - 1} onClick={() => ctx.moveAudioTrackRow(a.id, 1)} title={t('trackUp')}>+</button>
            </div>
          )}
        </div>
      ))}
      <div className="a-section">
        <span className="mz-sec-label">{t('musicLabel')}</span>
        <div
          className="mz-import"
          style={{ padding: "14px 12px" }}
          onClick={() => fileRef.current?.click()}
        >
          <VIcon name="music" size={18} />
          <span className="mz-import-t">{ctx.uploadingAudio ? t('importingAudio') : t('importMusic')}</span>
          <span className="mz-import-s">MP3, WAV, M4A</span>
        </div>
        <input ref={fileRef} type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) ctx.importAudio(f, "music"); e.target.value = ""; }} />
        {music.map((a) => (
          <div key={a.id} style={{ marginTop: 10 }}>
            <div className="mz-music on">
              <span className="mz-music-play"><VIcon name="music" size={14} /></span>
              <div style={{ minWidth: 0 }}><div className="mz-music-name trunc">{a.name}</div><div className="mz-music-meta">{a.dur.toFixed(1)}s</div></div>
              <button className="mz-hbtn" onClick={() => ctx.removeAudioTrack(a.id)}><VIcon name="trash" size={14} /></button>
            </div>
            <Range label={t('volumeMusic')} value={Math.round(a.vol * 100)} min={0} max={200} unit="%" onChange={(v) => ctx.setAudioVol(a.id, v / 100)} />
            <VolKeyframes track={a} ctx={ctx} />
            <BeatSyncTool track={a} ctx={ctx} />
          <VoiceTools track={a} ctx={ctx} />
            <Range label={t('fadeIn')} value={Math.round((a.fadeIn ?? 0) * 10) / 10} min={0} max={5} step={0.1} unit="s" onChange={(v) => ctx.setAudioFade(a.id, "fadeIn", v)} />
            <Range label={t('fadeOut')} value={Math.round((a.fadeOut ?? 0) * 10) / 10} min={0} max={5} step={0.1} unit="s" onChange={(v) => ctx.setAudioFade(a.id, "fadeOut", v)} />
            {ctx.audioTrackCount > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <button className="btn btn-ghost" style={{ minWidth: 34, padding: "5px 0" }} disabled={(a.track ?? 0) <= 0} onClick={() => ctx.moveAudioTrackRow(a.id, -1)} title={t('trackDown')}>−</button>
                <span style={{ flex: 1, textAlign: "center", fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>{t('videoTrackValue', { n: (a.track ?? 0) + 1, total: ctx.audioTrackCount })}</span>
                <button className="btn btn-ghost" style={{ minWidth: 34, padding: "5px 0" }} disabled={(a.track ?? 0) >= ctx.audioTrackCount - 1} onClick={() => ctx.moveAudioTrackRow(a.id, 1)} title={t('trackUp')}>+</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Transitions ────────────────────────────────────────────────────────────

export function TransitionsPanel({ ctx }: { ctx: MontageCtx }) {
  const t = useTranslations('montage');
  const tc = useTranslations('montageConstants');
  const c = ctx.selectedClip;
  return (
    <>
      <div className="a-section">
        <span className="mz-sec-label">{t('entryTransitionTitle')}</span>
        {!c ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{t('selectOtherClipHint')}</p>
        ) : (
          // Rangées par famille : à quarante-cinq, une grille à plat devient un mur
          // qu'on parcourt au hasard. On cherche « un zoom », pas « la vingt-deuxième ».
          <>
            {TRANSITION_FAMILIES.map((fam) => {
              const lot = TRANSITIONS.filter((tr) => tr.family === fam);
              if (!lot.length) return null;
              return (
                <div key={fam} style={{ marginBottom: 12 }}>
                  <span className="mz-sec-label" style={{ display: "block", marginBottom: 6, opacity: .8 }}>{tc(`transitionFamily.${fam}`)}</span>
                  <div className="mz-grid3">
                    {lot.map((tr) => (
                      <button key={tr.id} className={"mz-thumb" + (c.transitionIn === tr.id ? " on" : "")} style={{ aspectRatio: "1", background: "var(--sunk)", display: "grid", placeItems: "center", position: "relative" }} onClick={() => ctx.updateClip(c.id, { transitionIn: tr.id })}>
                        <span style={{ fontSize: 22, color: "var(--ink-2)" }}>{tr.glyph}</span>
                        <span style={{ position: "absolute", bottom: 5, fontWeight: 700, fontSize: 10, color: "var(--ink-2)" }}>{tc(`transition.${tr.id}`)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
      {c && (
        <div className="a-section">
          <Range label={t('duration')} value={c.transitionDur} min={0.1} max={1.5} step={0.1} onChange={(v) => ctx.updateClip(c.id, { transitionDur: v })} fmtv={(v) => v.toFixed(1) + "s"} />
          <button className="btn btn-ghost mz-btn-block" onClick={() => ctx.applyTransitionToAll(c.transitionIn, c.transitionDur)}>{t('applyToAllClips')}</button>
        </div>
      )}
    </>
  );
}

// ─── Filtres ────────────────────────────────────────────────────────────────

export function FilterPanel({ ctx }: { ctx: MontageCtx }) {
  const t = useTranslations('montage');
  const tc = useTranslations('montageConstants');
  const c = ctx.selectedClip;
  return (
    <>
      <div className="a-section">
        <span className="mz-sec-label">{t('filters')}</span>
        {!c ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{t('selectClipHint')}</p>
        ) : (
          <div className="mz-grid3">
            {FILTERS.map((f) => (
              <button key={f.id} className={"mz-thumb" + (c.filterId === f.id ? " on" : "")} style={{ position: "relative", overflow: "hidden" }} onClick={() => ctx.updateClip(c.id, { filterId: f.id })}>
                {c.kind === "photo" ? <img src={c.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: f.css }} /> : <video src={c.src} muted preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", filter: f.css }} />}
                <span style={{ position: "absolute", bottom: 5, left: 0, right: 0, textAlign: "center", fontFamily: "var(--mono)", fontWeight: 800, fontSize: 9, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.7)" }}>{tc(`filter.${f.id}`)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {c && (
        <div className="a-section">
          <span className="mz-sec-label">{t('grading')}</span>
          <Range label={t('brightness')} value={c.lum} min={-50} max={50} onChange={(v) => ctx.updateClip(c.id, { lum: v })} />
          <Range label={t('contrast')} value={c.con} min={-50} max={50} onChange={(v) => ctx.updateClip(c.id, { con: v })} />
          <Range label={t('saturation')} value={c.sat} min={-50} max={50} onChange={(v) => ctx.updateClip(c.id, { sat: v })} />
        </div>
      )}
    </>
  );
}

// ─── Vitesse ────────────────────────────────────────────────────────────────

export function SpeedPanel({ ctx }: { ctx: MontageCtx }) {
  const t = useTranslations('montage');
  const c = ctx.selectedClip;
  return (
    <>
      <div className="a-section">
        <span className="mz-sec-label">{t('playbackSpeedTitle')}</span>
        {!c ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{t('selectVideoClipHint')}</p>
        ) : c.kind !== "video" ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{t('speedVideoOnly')}</p>
        ) : (
          <>
            <div className="mz-seg">
              {SPEEDS.map((s) => (
                <button key={s} className={c.speed === s ? "on" : ""} onClick={() => ctx.updateClip(c.id, { speed: s })}>{s}×</button>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <Range label={t('speedCustom')} value={c.speed} min={0.1} max={4} step={0.05} onChange={(v) => ctx.updateClip(c.id, { speed: v })} fmtv={(v) => v.toFixed(2) + "×"} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Stickers & habillage ───────────────────────────────────────────────────

export function StickerPanel({ ctx }: { ctx: MontageCtx }) {
  const t = useTranslations('montage');
  return (
    <>
      <div className="a-section">
        <span className="mz-sec-label">{t('elements')}</span>
        <div className="mz-grid4">
          {STICKER_GLYPHS.map((g) => (
            <button key={g} style={{ aspectRatio: 1, borderRadius: 11, display: "grid", placeItems: "center", fontSize: 22, background: "var(--sunk)", cursor: "pointer", border: "none" }} onClick={() => ctx.addSticker(g)}>{g}</button>
          ))}
        </div>
      </div>
      <div className="a-section">
        <span className="mz-sec-label">{t('dressing')}</span>
        <div className="mz-ai-list">
          <button className="btn btn-ghost mz-btn-block" style={{ justifyContent: "flex-start" }} disabled={!ctx.logoUrl} onClick={() => ctx.logoUrl && ctx.addSticker(ctx.logoUrl, true)}>
            <VIcon name="image" size={15} /> {ctx.logoUrl ? t('brandLogo') : t('noLogoInSettings')}
          </button>
          <Toggle label={t('progressBar')} on={ctx.showProgressBar} onChange={ctx.toggleProgressBar} />
        </div>
      </div>
      {ctx.stickers.length > 0 && (
        <div className="a-section">
          <span className="mz-sec-label">{t('onStageTitle', { count: ctx.stickers.length })}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ctx.stickers.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, background: "var(--sunk)" }}>
                {s.isImage ? <img src={s.glyph} alt="" style={{ width: 22, height: 22, borderRadius: 5, objectFit: "cover" }} /> : <span style={{ fontSize: 18 }}>{s.glyph}</span>}
                <input type="range" className="mz-range" min={0.4} max={2.5} step={0.1} value={s.scale} onChange={(e) => ctx.updateSticker(s.id, { scale: parseFloat(e.target.value) })} style={{ flex: 1 }} />
                <button className="mz-hbtn" style={{ width: 22, height: 22, flexShrink: 0 }} onClick={() => ctx.removeSticker(s.id)}><VIcon name="x" size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Incrustation (PIP — 2e piste vidéo/photo) ──────────────────────────────

export function OverlayPanel({ ctx }: { ctx: MontageCtx }) {
  const t = useTranslations('montage');
  const tc = useTranslations('montageConstants');
  const o = ctx.selectedOverlay;
  // Le premier réglage qui correspond aux valeurs actuelles : c'est lui qu'on
  // marque comme actif dans la grille.
  const idPresetActif = o ? OVERLAY_EFFECT_PRESETS.find((q) => memeEffet(o, q.patch))?.id : undefined;
  return (
    <>
      <div className="a-section">
        <button className="btn btn-dark mz-btn-block" disabled={ctx.uploadingOverlay} onClick={ctx.addOverlayFiles}>
          <VIcon name="upload" size={15} /> {ctx.uploadingOverlay ? t('importingAudio') : t('addOverlay')}
        </button>
        <p style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.45, marginTop: 9 }}>
          {t('overlayDesc')}
        </p>
      </div>

      {ctx.overlays.length > 0 && (
        <div className="a-section">
          <span className="mz-sec-label">{t('overlaysTitle', { count: ctx.overlays.length })}</span>
          <div className="mz-grid3" style={{ marginTop: 10 }}>
            {ctx.overlays.map((ov) => (
              <div key={ov.id} className={"mz-thumb" + (o?.id === ov.id ? " on" : "")} onClick={() => ctx.selectOverlay(ov.id)} style={{ position: "relative" }}>
                {ov.kind === "photo"
                  ? <img src={ov.src} alt="" style={{ filter: overlayFilterCss(ov) }} />
                  : <video src={ov.src} muted preload="metadata" style={{ filter: overlayFilterCss(ov) }} />}
                <span style={{ position: "absolute", top: 5, left: 5, width: 16, height: 16, borderRadius: 5, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", color: "#fff" }}>
                  <VIcon name={ov.kind === "photo" ? "image" : "video"} size={10} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {o ? (
        <>
          <div className="a-section">
            <span className="mz-sec-label">{t('videoTrackTitle')}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <button className="btn btn-ghost" style={{ minWidth: 34, padding: "6px 0" }} disabled={(o.track ?? 0) <= 0} onClick={() => ctx.moveOverlayTrack(o.id, -1)} title={t('trackDown')}>−</button>
              <span style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>{t('videoTrackValue', { n: (o.track ?? 0) + 1, total: ctx.videoTrackCount })}</span>
              <button className="btn btn-ghost" style={{ minWidth: 34, padding: "6px 0" }} disabled={(o.track ?? 0) >= ctx.videoTrackCount - 1} onClick={() => ctx.moveOverlayTrack(o.id, 1)} title={t('trackUp')}>+</button>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.45 }}>{t('videoTrackHint')}</p>
          </div>

          <div className="a-section">
            <span className="mz-sec-label">{t('positionSize')}</span>
            <Range label={t('size')} value={o.scale} min={0.2} max={2.5} step={0.05} onChange={(v) => ctx.updateOverlay(o.id, { scale: v })} fmtv={(v) => Math.round(v * 100) + "%"} />
            <Range label={t('rotation')} value={o.rotation} min={-180} max={180} step={1} unit="°" onChange={(v) => ctx.updateOverlay(o.id, { rotation: v })} />
            <Range label={t('opacity')} value={o.opacity} min={0} max={1} step={0.02} onChange={(v) => ctx.updateOverlay(o.id, { opacity: v })} fmtv={(v) => Math.round(v * 100) + "%"} />
            <Range label={t('positionX')} value={o.x} min={0} max={100} step={1} unit="%" onChange={(v) => ctx.updateOverlay(o.id, { x: v })} />
            <Range label={t('positionY')} value={o.y} min={0} max={100} step={1} unit="%" onChange={(v) => ctx.updateOverlay(o.id, { y: v })} />
          </div>

          <div className="a-section">
            <span className="mz-sec-label">{t('time')}</span>
            <Range label={t('appearance')} value={o.offset} min={0} max={Math.max(o.offset, ctx.total)} step={0.1} unit="s" onChange={(v) => ctx.updateOverlay(o.id, { offset: v })} />
            {o.kind === "video" ? (
              <>
                <Range label={t('trimStart')} value={o.trimStart} min={0} max={Math.max(0, o.trimEnd - 0.2)} step={0.1} unit="s" onChange={(v) => ctx.updateOverlay(o.id, { trimStart: v })} />
                <Range label={t('trimEnd')} value={o.trimEnd} min={o.trimStart + 0.2} max={o.srcDur} step={0.1} unit="s" onChange={(v) => ctx.updateOverlay(o.id, { trimEnd: v })} />
                <Range label={t('volume')} value={o.vol ?? 1} min={0} max={1} step={0.02} onChange={(v) => ctx.updateOverlay(o.id, { vol: v })} fmtv={(v) => Math.round(v * 100) + "%"} />
              </>
            ) : (
              <Range label={t('duration')} value={o.trimEnd} min={1} max={15} step={0.5} unit="s" onChange={(v) => ctx.updateOverlay(o.id, { trimEnd: v })} />
            )}
          </div>

          {/* ── Effets de l'objet ────────────────────────────────────────────
              Ombre portée, contour et coins arrondis. Les vignettes montrent
              l'incrustation réelle avec chaque réglage : on choisit en voyant,
              pas en lisant un nom. */}
          <div className="a-section">
            <span className="mz-sec-label">{t('effects')}</span>
            <div className="mz-grid3">
              {OVERLAY_EFFECT_PRESETS.map((p) => {
                const apercu = { ...o, ...p.patch };
                const actif = idPresetActif === p.id;
                return (
                  <button key={p.id} className={"mz-thumb" + (actif ? " on" : "")}
                    style={{ position: "relative", overflow: "visible", display: "grid", placeItems: "center", background: "var(--sunk)" }}
                    onClick={() => ctx.updateOverlay(o.id, p.patch)} title={tc(`overlayEffect.${p.id}`)}>
                    <span style={{ display: "block", width: "62%", filter: overlayEffectCss(apercu, 40) || undefined, borderRadius: (apercu.radius ?? 0) > 0 ? `${((apercu.radius ?? 0) / 100) * 40}px` : undefined, overflow: "hidden" }}>
                      {o.kind === "photo"
                        ? <img src={o.src} alt="" style={{ width: "100%", display: "block" }} />
                        : <video src={o.src} muted preload="metadata" style={{ width: "100%", display: "block" }} />}
                    </span>
                    <span style={{ position: "absolute", bottom: 3, left: 0, right: 0, textAlign: "center", fontFamily: "var(--mono)", fontWeight: 800, fontSize: 8.5, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.8)" }}>{tc(`overlayEffect.${p.id}`)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="a-section">
            <Toggle label={t('dropShadow')} on={!!o.shadow} onChange={(v) => ctx.updateOverlay(o.id, { shadow: v })} />
            {o.shadow && (
              <>
                <div className="mz-swrow" style={{ marginBottom: 12 }}>
                  {["#000000", "#14160F", "#FFFFFF", "#C9C0FF", "#7A69E8", "#F2A03D"].map((col) => (
                    <button key={col} className={"mz-sw" + ((o.shadowColor || "#000000").toUpperCase() === col.toUpperCase() ? " on" : "")} style={{ background: col }} onClick={() => ctx.updateOverlay(o.id, { shadowColor: col })} />
                  ))}
                </div>
                <Range label={t('shadowBlur')} value={o.shadowBlur ?? 8} min={0} max={30} step={0.5} onChange={(v) => ctx.updateOverlay(o.id, { shadowBlur: v })} fmtv={(v) => v.toFixed(1) + " %"} />
                <Range label={t('shadowX')} value={o.shadowX ?? 1.5} min={-25} max={25} step={0.5} onChange={(v) => ctx.updateOverlay(o.id, { shadowX: v })} fmtv={(v) => v.toFixed(1) + " %"} />
                <Range label={t('shadowY')} value={o.shadowY ?? 2.5} min={-25} max={25} step={0.5} onChange={(v) => ctx.updateOverlay(o.id, { shadowY: v })} fmtv={(v) => v.toFixed(1) + " %"} />
                <Range label={t('shadowStrength')} value={o.shadowOpacity ?? 0.45} min={0} max={1} step={0.02} onChange={(v) => ctx.updateOverlay(o.id, { shadowOpacity: v })} fmtv={(v) => Math.round(v * 100) + "%"} />
              </>
            )}
          </div>

          <div className="a-section">
            <span className="mz-sec-label">{t('outlineCorners')}</span>
            <Range label={t('outline')} value={o.outlineW ?? 0} min={0} max={12} step={0.2} onChange={(v) => ctx.updateOverlay(o.id, { outlineW: v })} fmtv={(v) => v <= 0 ? t('none') : v.toFixed(1) + " %"} />
            {(o.outlineW ?? 0) > 0 && (
              <div className="mz-swrow">
                {["#FFFFFF", "#14160F", "#1E1246", "#C9C0FF", "#7A69E8", "#F2A03D"].map((col) => (
                  <button key={col} className={"mz-sw" + ((o.outlineColor || "#FFFFFF").toUpperCase() === col.toUpperCase() ? " on" : "")} style={{ background: col }} onClick={() => ctx.updateOverlay(o.id, { outlineColor: col })} />
                ))}
              </div>
            )}
            <Range label={t('roundedCorners')} value={o.radius ?? 0} min={0} max={50} step={1} onChange={(v) => ctx.updateOverlay(o.id, { radius: v })} fmtv={(v) => v <= 0 ? t('none') : v + " %"} />
          </div>

          <div className="a-section">
            <span className="mz-sec-label">{t('filter')}</span>
            <div className="mz-grid3">
              {FILTERS.map((f) => (
                <button key={f.id} className={"mz-thumb" + (o.filterId === f.id ? " on" : "")} style={{ position: "relative", overflow: "hidden" }} onClick={() => ctx.updateOverlay(o.id, { filterId: f.id })}>
                  {o.kind === "photo" ? <img src={o.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: f.css }} /> : <video src={o.src} muted preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", filter: f.css }} />}
                  <span style={{ position: "absolute", bottom: 5, left: 0, right: 0, textAlign: "center", fontFamily: "var(--mono)", fontWeight: 800, fontSize: 9, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.7)" }}>{tc(`filter.${f.id}`)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="a-section">
            <div className="mz-ai-list">
              <button className="btn btn-ghost mz-btn-block" onClick={() => ctx.duplicateOverlay(o.id)}><VIcon name="copy" size={15} /> {t('duplicate')}</button>
              <button className="btn btn-ghost mz-btn-block" onClick={() => ctx.removeOverlay(o.id)}><VIcon name="trash" size={15} /> {t('delete')}</button>
            </div>
          </div>
        </>
      ) : ctx.overlays.length > 0 ? (
        <div className="a-section"><p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{t('selectOverlayHint')}</p></div>
      ) : null}
    </>
  );
}

// ─── Assistant IA (capacités réelles uniquement) ───────────────────────────

export function AiPanel({ ctx }: { ctx: MontageCtx }) {
  const t = useTranslations('montage');
  const hasVideo = ctx.clips.some((c) => c.kind === "video");
  const hasClips = ctx.clips.length > 0;
  return (
    <div className="a-section" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Outil principal : enchaîne tout. Les cartes suivantes servent à reprendre
          une étape isolément si le résultat automatique ne convient pas. */}
      <div className="mz-ai-card" style={{ boxShadow: "inset 0 0 0 1.5px var(--leaf)" }}>
        <div className="halo-blob" style={{ width: 170, height: 170, right: -40, top: -60, background: "radial-gradient(circle, var(--leaf), transparent 70%)", opacity: .45 }} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="mz-sec-label" style={{ color: "var(--leaf)", marginBottom: 8 }}>{t('preEditLabel')}</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "italic", fontSize: 20, letterSpacing: "-0.02em", marginBottom: 6 }}>{t('preEditTitle')}</div>
          <p style={{ fontSize: 12.5, color: "var(--cream-2)", marginBottom: 14, lineHeight: 1.45 }}>{t('preEditDesc')}</p>
          <button className="mz-ai-btn" disabled={!hasVideo || ctx.preEditing} onClick={ctx.runFullPreEdit}>
            <VIcon name="sparkles" size={16} /> {ctx.preEditing ? (ctx.preEditStep || t('preEditRunning')) : t('preEditBtn')}
          </button>
        </div>
      </div>

      <div className="mz-ai-card">
        <div className="halo-blob" style={{ width: 150, height: 150, right: -40, top: -50, background: "radial-gradient(circle, var(--mint), transparent 70%)", opacity: .5 }} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="mz-sec-label" style={{ color: "var(--leaf)", marginBottom: 8 }}>{t('aiAssistantLabel')}</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "italic", fontSize: 18, letterSpacing: "-0.02em", marginBottom: 4 }}>{t('autoCaptionsTitlePeriod')}</div>
          <p style={{ fontSize: 12.5, color: "var(--cream-2)", marginBottom: 14, lineHeight: 1.45 }}>{t('autoCaptionsDescAlt')}</p>
          <button className="mz-ai-btn" disabled={!hasVideo || ctx.transcribing} onClick={ctx.generateCaptionsAI}>
            <VIcon name="sparkles" size={16} /> {ctx.transcribing ? t('transcribingShort') : t('generateCaptions')}
          </button>
        </div>
      </div>

      
      
      {/* Prémontage visuel : écarte le noir, le flou, le cramé et les plans figés.
          Analyse locale (aucune clé API) — complète la coupe des silences. */}
      <div className="mz-ai-card">
        <div className="halo-blob" style={{ width: 130, height: 130, right: -30, top: -40, background: "radial-gradient(circle, var(--mint), transparent 70%)", opacity: .4 }} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="mz-sec-label" style={{ color: "var(--leaf)", marginBottom: 8 }}>{t('autoCutLabel')}</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "italic", fontSize: 19, letterSpacing: "-0.02em", marginBottom: 6 }}>{t('autoCutTitle')}</div>
          <p style={{ fontSize: 12.5, color: "var(--cream-2)", marginBottom: 14, lineHeight: 1.45 }}>{t('autoCutDesc')}</p>
          {ctx.autoCutProgress && (
            <p style={{ fontSize: 11.5, color: "var(--cream-2)", marginBottom: 10 }}>
              {ctx.autoCutProgress.done}/{ctx.autoCutProgress.total} — {ctx.autoCutProgress.name}
            </p>
          )}
          <button className="mz-ai-btn" disabled={!hasVideo || ctx.autoCutting} onClick={ctx.autoCutQuality}>
            <VIcon name="scissors" size={16} /> {ctx.autoCutting ? t('autoCutWorking') : t('autoCutBtn')}
          </button>
        </div>
      </div>

      {/* Découpe fine par transcription : hésitations, faux départs, prises refaites. */}
      <div className="mz-ai-card">
        <div className="halo-blob" style={{ width: 130, height: 130, right: -30, top: -40, background: "radial-gradient(circle, var(--mint), transparent 70%)", opacity: .4 }} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="mz-sec-label" style={{ color: "var(--leaf)", marginBottom: 8 }}>{t('fillersLabel')}</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "italic", fontSize: 19, letterSpacing: "-0.02em", marginBottom: 6 }}>{t('fillersTitle')}</div>
          <p style={{ fontSize: 12.5, color: "var(--cream-2)", marginBottom: 14, lineHeight: 1.45 }}>{t('fillersDesc')}</p>
          <button className="mz-ai-btn" disabled={!hasVideo || ctx.cuttingFillers} onClick={ctx.cutFillers}>
            <VIcon name="scissors" size={16} /> {ctx.cuttingFillers ? t('fillersWorking') : t('fillersBtn')}
          </button>
        </div>
      </div>

      
      <div className="mz-ai-card">
        <div className="halo-blob" style={{ width: 130, height: 130, right: -30, top: -40, background: "radial-gradient(circle, var(--mint), transparent 70%)", opacity: .4 }} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="mz-sec-label" style={{ color: "var(--leaf)", marginBottom: 8 }}>{t('musicMoodLabel')}</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "italic", fontSize: 19, letterSpacing: "-0.02em", marginBottom: 4 }}>{t('whichMusicStyle')}</div>
          <p style={{ fontSize: 12.5, color: "var(--cream-2)", marginBottom: 14, lineHeight: 1.45 }}>
            {t('musicMoodDesc')}
          </p>
          <button className="mz-ai-btn" disabled={!hasClips || ctx.suggestingMusic} onClick={ctx.suggestMusicMoodAI}>
            <VIcon name="sparkles" size={16} /> {ctx.suggestingMusic ? t('analyzing') : t('suggestMood')}
          </button>
          {ctx.musicSuggestion && (
            <p style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.5, marginTop: 12, padding: 10, borderRadius: 8, background: "var(--sunk)", border: "1px solid var(--line)" }}>
              {ctx.musicSuggestion}
            </p>
          )}
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
        {t('smartCropHintFooter')}
      </p>
    </div>
  );
}
