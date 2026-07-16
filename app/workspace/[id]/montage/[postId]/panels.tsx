"use client";

// panels.tsx — corps des panneaux de propriétés par outil (Direction A).
// Reprend la structure de design_handoff_montage_video/design_files/panels.jsx,
// branché sur de vraies actions (state du projet Montage).

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { VIcon } from "./icons";
import {
  MontageClip, OverlayClip, Caption, TitleEl, StickerEl, AudioTrack, SubCustom, SubTemplate,
  FILTERS, TRANSITIONS, SPEEDS, SUB_STYLES, SUB_LENGTHS, STICKER_GLYPHS, FONT_CHOICES,
  effectiveSubStyle, loadSubTemplates, saveSubTemplates,
  clipFilterCss, overlayFilterCss, clipTimelineDur, overlayTimelineDur,
} from "./constants";

export interface MontageCtx {
  clips: MontageClip[];
  selectedClip: (MontageClip & { start: number; end: number }) | null;
  captions: Caption[];
  subStyleId: string;
  subMaxWords: number;
  subCustom: SubCustom;
  subPos: { x: number; y: number };
  hasRawSegments: boolean;
  titles: TitleEl[];
  stickers: StickerEl[];
  audioTracks: AudioTrack[];
  showProgressBar: boolean;
  time: number;
  total: number;
  logoUrl: string | null;
  uploadingAudio: boolean;
  transcribing: boolean;
  isRecordingVO: boolean;
  croppingClipId: string | null;
  smartCropClip: (clipId: string) => void;
  assembling: boolean;
  autoAssembleAI: () => void;
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

// ─── petits composants réutilisables ────────────────────────────────────────

function Range({ label, value, min, max, step = 1, unit = "", onChange, fmtv }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void; fmtv?: (v: number) => string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="mz-rangelbl">
        <span style={{ fontWeight: 700, fontSize: 12.5, color: "var(--ink-2)" }}>{label}</span>
        <span className="mz-rangeval">{fmtv ? fmtv(value) : value + unit}</span>
      </div>
      <input className="mz-range" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "4px 0", marginBottom: 6, border: "none", background: "transparent", cursor: "pointer" }}>
      <span style={{ width: 38, height: 22, borderRadius: 99, background: on ? "var(--mint)" : "var(--sunk)", boxShadow: on ? "none" : "inset 0 0 0 1px var(--line)", position: "relative", flexShrink: 0, transition: "background .18s" }}>
        <span style={{ position: "absolute", top: 2, left: 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(13,15,10,.3)", transform: on ? "translateX(16px)" : "none", transition: "transform .2s var(--ease)" }} />
      </span>
      <span style={{ fontWeight: 600, fontSize: 12.5, color: "var(--ink-2)", textAlign: "left" }}>{label}</span>
    </button>
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
          <div className="a-section">
            <span className="mz-sec-label">{t('font')}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {FONT_CHOICES.map((f) => (
                <button key={f.id} className="font-pick" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 13px", borderRadius: 9, background: tt.font === f.id ? "var(--mint-soft)" : "var(--white)", boxShadow: tt.font === f.id ? "inset 0 0 0 1.5px var(--mint-2)" : "inset 0 0 0 1px var(--line)", border: "none", cursor: "pointer" }} onClick={() => ctx.updateTitle(tt.id, { font: f.id })}>
                  <span style={{ fontFamily: f.css, fontWeight: f.weight, fontStyle: f.italic ? "italic" : "normal", fontSize: 19 }}>{tc(`fontChoiceName.${f.id}`)}</span>
                  <span className="mz-sec-label">{tc(`fontChoiceSub.${f.id}`)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="a-section">
            <span className="mz-sec-label">{t('entryAnimation')}</span>
            <div className="mz-seg">
              {([["rise", t('animRise')], ["type", t('animType')], ["pop", t('animPop')]] as const).map(([k, l]) => (
                <button key={k} className={tt.anim === k ? "on" : ""} onClick={() => ctx.updateTitle(tt.id, { anim: k })}>{l}</button>
              ))}
            </div>
          </div>
          <div className="a-section">
            <span className="mz-sec-label">{t('color')}</span>
            <div className="mz-swrow">
              {["#FFFFFF", "#0C2A1D", "#2FD79B", "#C8F135", "#1F7A4D", "#14160F"].map((col) => (
                <button key={col} className={"mz-sw" + (tt.color === col ? " on" : "")} style={{ background: col }} onClick={() => ctx.updateTitle(tt.id, { color: col })} />
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

const SUB_FONTS: { label: string; css: string }[] = [
  { label: "Satoshi", css: "var(--sans)" },
  { label: "Archivo", css: "var(--display)" },
  { label: "Serif", css: "'Instrument Serif', serif" },
  { label: "Mono", css: "var(--mono)" },
];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // color input exige un hex ; on retombe sur noir/blanc pour les valeurs non-hex (rgba/transparent).
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : "#ffffff";
  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, color: "var(--ink-2)", fontWeight: 700 }}>
      {label}
      <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} style={{ width: 34, height: 26, border: "1px solid var(--line)", borderRadius: 6, background: "var(--white)", padding: 0, cursor: "pointer" }} />
    </label>
  );
}

export function CaptionsPanel({ ctx }: { ctx: MontageCtx }) {
  const t = useTranslations('montage');
  const tc = useTranslations('montageConstants');
  const hasVideo = ctx.clips.some((c) => c.kind === "video");
  const eff = effectiveSubStyle(ctx.subStyleId, ctx.subCustom);
  const [tpls, setTpls] = useState<SubTemplate[]>(() => loadSubTemplates());
  const [tplName, setTplName] = useState("");
  const patch = (p: SubCustom) => ctx.setSubCustom((c) => ({ ...c, ...p }));
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
      <div className="a-section">
        <div className="mz-ai-card">
          <div className="halo-blob" style={{ width: 140, height: 140, right: -40, top: -50, background: "radial-gradient(circle, var(--mint), transparent 70%)", opacity: .5 }} />
          <div style={{ position: "relative", zIndex: 2 }}>
            <div className="mz-sec-label" style={{ color: "var(--mint)", marginBottom: 8 }}>{t('aiTranscriptionLabel')}</div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "italic", fontSize: 18, letterSpacing: "-0.02em", marginBottom: 4 }}>{t('autoCaptionsTitle')}</div>
            <p style={{ fontSize: 12, color: "var(--cream-2)", marginBottom: 12, lineHeight: 1.45 }}>{t('autoCaptionsDesc')}</p>
            <button className="mz-ai-btn" disabled={!hasVideo || ctx.transcribing} onClick={ctx.generateCaptionsAI}>
              <VIcon name="sparkles" size={16} /> {ctx.transcribing ? t('transcribing') : t('generateCaptions')}
            </button>
          </div>
        </div>
      </div>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span className="mz-sec-label" style={{ margin: 0 }}>{t('customizationTitle')}</span>
          <button className="btn btn-ghost btn-sm" onClick={ctx.resetSubCustom} title={t('resetToBaseStyle')}><VIcon name="undo" size={12} /> {t('reset')}</button>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "0 0 10px" }}>{t('dragSubtitlesHint')}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <ColorField label={t('text')} value={eff.fg} onChange={(v) => patch({ fg: v })} />
          <ColorField label={t('activeWord')} value={eff.hi} onChange={(v) => patch({ hi: v })} />
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, color: "var(--ink-2)", fontWeight: 700 }}>
            {t('background')}
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className={"mz-chip-btn" + (eff.bg === "transparent" ? " on" : "")} style={{ padding: "4px 9px", fontSize: 11 }} onClick={() => patch({ bg: eff.bg === "transparent" ? "#0C2A1D" : "transparent" })}>{eff.bg === "transparent" ? t('none') : t('full')}</button>
              {eff.bg !== "transparent" && <input type="color" value={/^#([0-9a-f]{6})$/i.test(eff.bg) ? eff.bg : "#0c2a1d"} onChange={(e) => patch({ bg: e.target.value })} style={{ width: 34, height: 26, border: "1px solid var(--line)", borderRadius: 6, padding: 0, cursor: "pointer" }} />}
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, color: "var(--ink-2)", fontWeight: 700 }}>
            {t('outline')}
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className={"mz-chip-btn" + (eff.stroke ? " on" : "")} style={{ padding: "4px 9px", fontSize: 11 }} onClick={() => patch({ stroke: eff.stroke ? "" : "#000000" })}>{eff.stroke ? t('yes') : t('no')}</button>
              {eff.stroke && <input type="color" value={/^#([0-9a-f]{6})$/i.test(eff.stroke) ? eff.stroke : "#000000"} onChange={(e) => patch({ stroke: e.target.value })} style={{ width: 34, height: 26, border: "1px solid var(--line)", borderRadius: 6, padding: 0, cursor: "pointer" }} />}
            </span>
          </label>
        </div>
        <span className="mz-sec-label" style={{ marginBottom: 6 }}>{t('typography')}</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {SUB_FONTS.map((f) => (
            <button key={f.label} className={"mz-chip-btn" + ((eff.font || "var(--sans)") === f.css ? " on" : "")} style={{ fontFamily: f.css }} onClick={() => patch({ font: f.css })}>{f.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          <button className={"mz-chip-btn" + (eff.uppercase ? " on" : "")} onClick={() => patch({ uppercase: !eff.uppercase })}>{t('uppercaseShort')}</button>
          <button className={"mz-chip-btn" + (eff.weight >= 800 ? " on" : "")} onClick={() => patch({ weight: eff.weight >= 800 ? 600 : 900 })} style={{ fontWeight: 800 }}>{t('bold')}</button>
          <button className={"mz-chip-btn" + (eff.italic ? " on" : "")} onClick={() => patch({ italic: !eff.italic })} style={{ fontStyle: "italic" }}>{t('italic')}</button>
          <button className={"mz-chip-btn" + (eff.pill ? " on" : "")} onClick={() => patch({ pill: !eff.pill })}>{t('pill')}</button>
        </div>
        <Range label={t('size')} value={eff.scale} min={0.5} max={2.4} step={0.05} onChange={(v) => patch({ scale: v })} fmtv={(v) => `${Math.round(v * 100)}%`} />
      </div>
      <div className="a-section">
        <span className="mz-sec-label">{t('myTemplatesTitle')}</span>
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
      <div className="a-section">
        <span className="mz-sec-label">{t('transcribedTextTitle', { count: ctx.captions.length })}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ctx.captions.map((s) => (
            <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "9px 11px", borderRadius: 9, background: "var(--sunk)" }}>
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  style={{ fontSize: 12.5, lineHeight: 1.4, outline: "none", flex: 1 }}
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
          ))}
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={ctx.addCaption}><VIcon name="plus" size={13} /> {t('addAtPlayhead')}</button>
        </div>
      </div>
    </>
  );
}

// ─── Audio ──────────────────────────────────────────────────────────────────

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
          <Range label={t('volumeVoiceover')} value={Math.round(a.vol * 100)} min={0} max={100} unit="%" onChange={(v) => ctx.setAudioVol(a.id, v / 100)} />
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
            <Range label={t('volumeMusic')} value={Math.round(a.vol * 100)} min={0} max={100} unit="%" onChange={(v) => ctx.setAudioVol(a.id, v / 100)} />
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
          <div className="mz-grid3">
            {TRANSITIONS.map((tr) => (
              <button key={tr.id} className={"mz-thumb" + (c.transitionIn === tr.id ? " on" : "")} style={{ aspectRatio: "1", background: "var(--sunk)", display: "grid", placeItems: "center", position: "relative" }} onClick={() => ctx.updateClip(c.id, { transitionIn: tr.id })}>
                <span style={{ fontSize: 22, color: "var(--ink-2)" }}>{tr.glyph}</span>
                <span style={{ position: "absolute", bottom: 5, fontWeight: 700, fontSize: 10, color: "var(--ink-2)" }}>{tc(`transition.${tr.id}`)}</span>
              </button>
            ))}
          </div>
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
      <div className="mz-ai-card">
        <div className="halo-blob" style={{ width: 150, height: 150, right: -40, top: -50, background: "radial-gradient(circle, var(--mint), transparent 70%)", opacity: .5 }} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="mz-sec-label" style={{ color: "var(--mint)", marginBottom: 8 }}>{t('aiAssistantLabel')}</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "italic", fontSize: 18, letterSpacing: "-0.02em", marginBottom: 4 }}>{t('autoCaptionsTitlePeriod')}</div>
          <p style={{ fontSize: 12.5, color: "var(--cream-2)", marginBottom: 14, lineHeight: 1.45 }}>{t('autoCaptionsDescAlt')}</p>
          <button className="mz-ai-btn" disabled={!hasVideo || ctx.transcribing} onClick={ctx.generateCaptionsAI}>
            <VIcon name="sparkles" size={16} /> {ctx.transcribing ? t('transcribingShort') : t('generateCaptions')}
          </button>
        </div>
      </div>

      <div className="mz-ai-card">
        <div className="halo-blob" style={{ width: 130, height: 130, right: -30, top: -40, background: "radial-gradient(circle, var(--mint), transparent 70%)", opacity: .4 }} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="mz-sec-label" style={{ color: "var(--mint)", marginBottom: 8 }}>{t('autoAssemblyLabel')}</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "italic", fontSize: 19, letterSpacing: "-0.02em", marginBottom: 4 }}>{t('oneClickAssembly')}</div>
          <p style={{ fontSize: 12.5, color: "var(--cream-2)", marginBottom: 14, lineHeight: 1.45 }}>{t('autoAssemblyDesc')}</p>
          <button className="mz-ai-btn" disabled={ctx.clips.length < 2 || ctx.assembling} onClick={ctx.autoAssembleAI}>
            <VIcon name="sparkles" size={16} /> {ctx.assembling ? t('assembling') : t('generateAssembly')}
          </button>
        </div>
      </div>

      <div className="mz-ai-card">
        <div className="halo-blob" style={{ width: 130, height: 130, right: -30, top: -40, background: "radial-gradient(circle, var(--mint), transparent 70%)", opacity: .4 }} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="mz-sec-label" style={{ color: "var(--mint)", marginBottom: 8 }}>{t('musicMoodLabel')}</div>
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
