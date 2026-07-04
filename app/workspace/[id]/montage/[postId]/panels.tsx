"use client";

// panels.tsx — corps des panneaux de propriétés par outil (Direction A).
// Reprend la structure de design_handoff_montage_video/design_files/panels.jsx,
// branché sur de vraies actions (state du projet Montage).

import { useRef } from "react";
import { VIcon } from "./icons";
import {
  MontageClip, Caption, TitleEl, StickerEl, AudioTrack,
  FILTERS, TRANSITIONS, SPEEDS, SUB_STYLES, SUB_LENGTHS, STICKER_GLYPHS, FONT_CHOICES,
  clipFilterCss, clipTimelineDur,
} from "./constants";

export interface MontageCtx {
  clips: MontageClip[];
  selectedClip: (MontageClip & { start: number; end: number }) | null;
  captions: Caption[];
  subStyleId: string;
  subMaxWords: number;
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
  generateCaptionsAI: () => void;

  addSticker: (glyph: string, isImage?: boolean) => void;
  updateSticker: (id: string, patch: Partial<StickerEl>) => void;
  removeSticker: (id: string) => void;

  toggleProgressBar: () => void;
  importAudio: (file: File, kind: "music" | "voiceover") => void;
  removeAudioTrack: (id: string) => void;
  setAudioVol: (id: string, vol: number) => void;
  toggleRecordVO: () => void;
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
  const c = ctx.selectedClip;
  return (
    <>
      <div className="a-section">
        <span className="mz-sec-label">Plan sélectionné</span>
        {c ? (
          <div className="mz-music" style={{ cursor: "default" }}>
            <span className="mz-music-play" style={{ background: "var(--forest)" }}><VIcon name={c.kind === "photo" ? "image" : "video"} size={15} /></span>
            <div style={{ minWidth: 0 }}><div className="mz-music-name trunc">{c.name}</div><div className="mz-music-meta">{clipTimelineDur(c).toFixed(1)}s sur la timeline</div></div>
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Sélectionnez un plan dans la timeline.</p>
        )}
      </div>
      <div className="a-section">
        <span className="mz-sec-label">Actions</span>
        <div className="mz-ai-list">
          <button className="btn btn-dark mz-btn-block" disabled={!c} onClick={ctx.splitAtPlayhead}><VIcon name="split" size={15} /> Diviser au curseur</button>
          <button className="btn btn-ghost mz-btn-block" disabled={!c} onClick={ctx.duplicateSelected}><VIcon name="copy" size={15} /> Dupliquer</button>
          <button className="btn btn-ghost mz-btn-block" disabled={!c} onClick={ctx.removeSelected}><VIcon name="trash" size={15} /> Supprimer</button>
        </div>
      </div>
      {c && (
        <div className="a-section">
          <span className="mz-sec-label">Rognage {c.kind === "photo" ? "(durée du plan fixe)" : ""}</span>
          {c.kind === "video" ? (
            <>
              <Range label="Début" value={c.trimStart} min={0} max={Math.max(0, c.trimEnd - 0.2)} step={0.1} unit="s" onChange={(v) => ctx.updateClip(c.id, { trimStart: v })} />
              <Range label="Fin" value={c.trimEnd} min={c.trimStart + 0.2} max={c.srcDur} step={0.1} unit="s" onChange={(v) => ctx.updateClip(c.id, { trimEnd: v })} />
            </>
          ) : (
            <Range label="Durée" value={c.trimEnd} min={1} max={15} step={0.5} unit="s" onChange={(v) => ctx.updateClip(c.id, { trimEnd: v })} />
          )}
        </div>
      )}
    </>
  );
}

// ─── Texte & titres ─────────────────────────────────────────────────────────

export function TextPanel({ ctx, selectedTitleId }: { ctx: MontageCtx; selectedTitleId: string | null }) {
  const t = ctx.titles.find((x) => x.id === selectedTitleId) || null;
  return (
    <>
      <div className="a-section">
        <button className="btn btn-primary mz-btn-block" onClick={ctx.addTitle}><VIcon name="plus" size={15} /> Ajouter un titre</button>
      </div>
      {!t ? (
        <div className="a-section">
          <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>Cliquez un titre sur l&apos;aperçu pour le modifier, ou ajoutez-en un nouveau.</p>
        </div>
      ) : (
        <>
          <div className="a-section">
            <span className="mz-sec-label">Texte</span>
            <textarea className="input" value={t.text} onChange={(e) => ctx.updateTitle(t.id, { text: e.target.value })} rows={2} style={{ width: "100%", resize: "vertical" }} />
          </div>
          <div className="a-section">
            <span className="mz-sec-label">Police</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {FONT_CHOICES.map((f) => (
                <button key={f.id} className="font-pick" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 13px", borderRadius: 9, background: t.font === f.id ? "var(--mint-soft)" : "var(--white)", boxShadow: t.font === f.id ? "inset 0 0 0 1.5px var(--mint-2)" : "inset 0 0 0 1px var(--line)", border: "none", cursor: "pointer" }} onClick={() => ctx.updateTitle(t.id, { font: f.id })}>
                  <span style={{ fontFamily: f.css, fontWeight: f.weight, fontStyle: f.italic ? "italic" : "normal", fontSize: 19 }}>{f.name}</span>
                  <span className="mz-sec-label">{f.sub}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="a-section">
            <span className="mz-sec-label">Animation d&apos;entrée</span>
            <div className="mz-seg">
              {([["rise", "Apparition"], ["type", "Machine"], ["pop", "Pop"]] as const).map(([k, l]) => (
                <button key={k} className={t.anim === k ? "on" : ""} onClick={() => ctx.updateTitle(t.id, { anim: k })}>{l}</button>
              ))}
            </div>
          </div>
          <div className="a-section">
            <span className="mz-sec-label">Couleur</span>
            <div className="mz-swrow">
              {["#FFFFFF", "#0C2A1D", "#2FD79B", "#C8F135", "#1F7A4D", "#14160F"].map((col) => (
                <button key={col} className={"mz-sw" + (t.color === col ? " on" : "")} style={{ background: col }} onClick={() => ctx.updateTitle(t.id, { color: col })} />
              ))}
            </div>
          </div>
          <div className="a-section">
            <span className="mz-sec-label">Calage</span>
            <Range label="Début" value={t.start} min={0} max={Math.max(0.5, ctx.total - 0.5)} step={0.1} unit="s" onChange={(v) => ctx.updateTitle(t.id, { start: Math.min(v, t.end - 0.2) })} />
            <Range label="Fin" value={t.end} min={t.start + 0.2} max={ctx.total} step={0.1} unit="s" onChange={(v) => ctx.updateTitle(t.id, { end: v })} />
          </div>
          <div className="a-section">
            <button className="btn btn-ghost mz-btn-block" onClick={() => ctx.removeTitle(t.id)}><VIcon name="trash" size={15} /> Supprimer ce titre</button>
          </div>
        </>
      )}
    </>
  );
}

// ─── Sous-titres ────────────────────────────────────────────────────────────

export function CaptionsPanel({ ctx }: { ctx: MontageCtx }) {
  const hasVideo = ctx.clips.some((c) => c.kind === "video");
  return (
    <>
      <div className="a-section">
        <div className="mz-ai-card">
          <div className="halo-blob" style={{ width: 140, height: 140, right: -40, top: -50, background: "radial-gradient(circle, var(--mint), transparent 70%)", opacity: .5 }} />
          <div style={{ position: "relative", zIndex: 2 }}>
            <div className="mz-sec-label" style={{ color: "var(--mint)", marginBottom: 8 }}>Transcription IA</div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "italic", fontSize: 18, letterSpacing: "-0.02em", marginBottom: 4 }}>Sous-titres automatiques</div>
            <p style={{ fontSize: 12, color: "var(--cream-2)", marginBottom: 12, lineHeight: 1.45 }}>Klip transcrit la voix du premier plan vidéo et cale les mots dans le temps.</p>
            <button className="mz-ai-btn" disabled={!hasVideo || ctx.transcribing} onClick={ctx.generateCaptionsAI}>
              <VIcon name="sparkles" size={16} /> {ctx.transcribing ? "Transcription en cours…" : "Générer les sous-titres"}
            </button>
          </div>
        </div>
      </div>
      <div className="a-section">
        <span className="mz-sec-label">Longueur d'affichage</span>
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "0 0 8px" }}>Nombre de mots par sous-titre. {ctx.hasRawSegments ? "Le texte se re-découpe à la volée." : "Appliqué à la prochaine génération IA."}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SUB_LENGTHS.map((l) => (
            <button
              key={l.words}
              className={"mz-chip-btn" + (ctx.subMaxWords === l.words ? " on" : "")}
              onClick={() => ctx.setCaptionLength(l.words)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="a-section">
        <span className="mz-sec-label">Style · bibliothèque</span>
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
              <div className="mz-substyle-meta"><div className="mz-substyle-name">{s.name}</div><div className="mz-substyle-sub">{s.sub}</div></div>
            </button>
          ))}
        </div>
      </div>
      <div className="a-section">
        <span className="mz-sec-label">Texte transcrit · {ctx.captions.length}</span>
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
                <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: 9.5, color: "var(--ink-3)" }}>DÉBUT</span>
                <input type="number" step={0.1} min={0} value={Number(s.start.toFixed(2))} onChange={(e) => ctx.updateCaption(s.id, { start: Math.min(parseFloat(e.target.value) || 0, s.end - 0.1) })} style={{ width: 58, fontFamily: "var(--mono)", fontSize: 11, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--white)" }} />
                <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: 9.5, color: "var(--ink-3)" }}>FIN</span>
                <input type="number" step={0.1} min={0} value={Number(s.end.toFixed(2))} onChange={(e) => ctx.updateCaption(s.id, { end: Math.max(parseFloat(e.target.value) || 0, s.start + 0.1) })} style={{ width: 58, fontFamily: "var(--mono)", fontSize: 11, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--white)" }} />
              </div>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={ctx.addCaption}><VIcon name="plus" size={13} /> Ajouter au curseur</button>
        </div>
      </div>
    </>
  );
}

// ─── Audio ──────────────────────────────────────────────────────────────────

export function AudioPanel({ ctx }: { ctx: MontageCtx }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const music = ctx.audioTracks.filter((a) => a.kind === "music");
  const vo = ctx.audioTracks.filter((a) => a.kind === "voiceover");
  const videoClips = ctx.clips.filter((c) => c.kind === "video");
  return (
    <>
      {videoClips.length > 0 && (
        <div className="a-section">
          <span className="mz-sec-label">Son des plans vidéo</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
            {videoClips.map((c) => (
              <div key={c.id}>
                <div className="mz-music on" style={{ cursor: "default" }}>
                  <button className="mz-music-play" style={{ background: (c.vol ?? 1) === 0 ? "var(--ink-3)" : "var(--forest)", border: "none", cursor: "pointer" }} title={(c.vol ?? 1) === 0 ? "Réactiver le son" : "Couper le son"} onClick={() => ctx.updateClip(c.id, { vol: (c.vol ?? 1) === 0 ? 1 : 0 })}>
                    <VIcon name={(c.vol ?? 1) === 0 ? "mute" : "volume"} size={14} />
                  </button>
                  <div style={{ minWidth: 0 }}><div className="mz-music-name trunc">{c.name}</div><div className="mz-music-meta">Son du plan</div></div>
                </div>
                <Range label="Volume" value={Math.round((c.vol ?? 1) * 100)} min={0} max={100} unit="%" onChange={(v) => ctx.updateClip(c.id, { vol: v / 100 })} />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="a-section">
        <button className="btn btn-dark mz-btn-block" onClick={ctx.toggleRecordVO}>
          <VIcon name="mic" size={15} /> {ctx.isRecordingVO ? "Arrêter l'enregistrement" : "Enregistrer une voix off"}
        </button>
      </div>
      {vo.map((a) => (
        <div key={a.id} className="a-section">
          <div className="mz-music on">
            <span className="mz-music-play"><VIcon name="mic" size={14} /></span>
            <div style={{ minWidth: 0 }}><div className="mz-music-name trunc">{a.name}</div><div className="mz-music-meta">Voix off · {a.dur.toFixed(1)}s</div></div>
            <button className="mz-hbtn" onClick={() => ctx.removeAudioTrack(a.id)}><VIcon name="trash" size={14} /></button>
          </div>
          <Range label="Volume voix off" value={Math.round(a.vol * 100)} min={0} max={100} unit="%" onChange={(v) => ctx.setAudioVol(a.id, v / 100)} />
        </div>
      ))}
      <div className="a-section">
        <span className="mz-sec-label">Musique</span>
        <div
          className="mz-import"
          style={{ padding: "14px 12px" }}
          onClick={() => fileRef.current?.click()}
        >
          <VIcon name="music" size={18} />
          <span className="mz-import-t">{ctx.uploadingAudio ? "Import en cours…" : "Importer une musique"}</span>
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
            <Range label="Volume musique" value={Math.round(a.vol * 100)} min={0} max={100} unit="%" onChange={(v) => ctx.setAudioVol(a.id, v / 100)} />
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Transitions ────────────────────────────────────────────────────────────

export function TransitionsPanel({ ctx }: { ctx: MontageCtx }) {
  const c = ctx.selectedClip;
  return (
    <>
      <div className="a-section">
        <span className="mz-sec-label">Transition d&apos;entrée du plan sélectionné</span>
        {!c ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Sélectionnez un plan (autre que le premier) dans la timeline.</p>
        ) : (
          <div className="mz-grid3">
            {TRANSITIONS.map((t) => (
              <button key={t.id} className={"mz-thumb" + (c.transitionIn === t.id ? " on" : "")} style={{ aspectRatio: "1", background: "var(--sunk)", display: "grid", placeItems: "center", position: "relative" }} onClick={() => ctx.updateClip(c.id, { transitionIn: t.id })}>
                <span style={{ fontSize: 22, color: "var(--ink-2)" }}>{t.glyph}</span>
                <span style={{ position: "absolute", bottom: 5, fontWeight: 700, fontSize: 10, color: "var(--ink-2)" }}>{t.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {c && (
        <div className="a-section">
          <Range label="Durée" value={c.transitionDur} min={0.1} max={1.5} step={0.1} onChange={(v) => ctx.updateClip(c.id, { transitionDur: v })} fmtv={(v) => v.toFixed(1) + "s"} />
          <button className="btn btn-ghost mz-btn-block" onClick={() => ctx.applyTransitionToAll(c.transitionIn, c.transitionDur)}>Appliquer à tous les plans</button>
        </div>
      )}
    </>
  );
}

// ─── Filtres ────────────────────────────────────────────────────────────────

export function FilterPanel({ ctx }: { ctx: MontageCtx }) {
  const c = ctx.selectedClip;
  return (
    <>
      <div className="a-section">
        <span className="mz-sec-label">Filtres</span>
        {!c ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Sélectionnez un plan dans la timeline.</p>
        ) : (
          <div className="mz-grid3">
            {FILTERS.map((f) => (
              <button key={f.id} className={"mz-thumb" + (c.filterId === f.id ? " on" : "")} style={{ position: "relative", overflow: "hidden" }} onClick={() => ctx.updateClip(c.id, { filterId: f.id })}>
                {c.kind === "photo" ? <img src={c.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: f.css }} /> : <video src={c.src} muted preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", filter: f.css }} />}
                <span style={{ position: "absolute", bottom: 5, left: 0, right: 0, textAlign: "center", fontFamily: "var(--mono)", fontWeight: 800, fontSize: 9, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,.7)" }}>{f.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {c && (
        <div className="a-section">
          <span className="mz-sec-label">Étalonnage</span>
          <Range label="Lumière" value={c.lum} min={-50} max={50} onChange={(v) => ctx.updateClip(c.id, { lum: v })} />
          <Range label="Contraste" value={c.con} min={-50} max={50} onChange={(v) => ctx.updateClip(c.id, { con: v })} />
          <Range label="Saturation" value={c.sat} min={-50} max={50} onChange={(v) => ctx.updateClip(c.id, { sat: v })} />
        </div>
      )}
    </>
  );
}

// ─── Vitesse ────────────────────────────────────────────────────────────────

export function SpeedPanel({ ctx }: { ctx: MontageCtx }) {
  const c = ctx.selectedClip;
  return (
    <>
      <div className="a-section">
        <span className="mz-sec-label">Vitesse de lecture</span>
        {!c ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Sélectionnez un plan vidéo dans la timeline.</p>
        ) : c.kind !== "video" ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-3)" }}>La vitesse ne s&apos;applique qu&apos;aux plans vidéo.</p>
        ) : (
          <div className="mz-seg">
            {SPEEDS.map((s) => (
              <button key={s} className={c.speed === s ? "on" : ""} onClick={() => ctx.updateClip(c.id, { speed: s })}>{s}×</button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Stickers & habillage ───────────────────────────────────────────────────

export function StickerPanel({ ctx }: { ctx: MontageCtx }) {
  return (
    <>
      <div className="a-section">
        <span className="mz-sec-label">Éléments</span>
        <div className="mz-grid4">
          {STICKER_GLYPHS.map((g) => (
            <button key={g} style={{ aspectRatio: 1, borderRadius: 11, display: "grid", placeItems: "center", fontSize: 22, background: "var(--sunk)", cursor: "pointer", border: "none" }} onClick={() => ctx.addSticker(g)}>{g}</button>
          ))}
        </div>
      </div>
      <div className="a-section">
        <span className="mz-sec-label">Habillage</span>
        <div className="mz-ai-list">
          <button className="btn btn-ghost mz-btn-block" style={{ justifyContent: "flex-start" }} disabled={!ctx.logoUrl} onClick={() => ctx.logoUrl && ctx.addSticker(ctx.logoUrl, true)}>
            <VIcon name="image" size={15} /> {ctx.logoUrl ? "Logo de la marque" : "Aucun logo dans les réglages"}
          </button>
          <Toggle label="Barre de progression" on={ctx.showProgressBar} onChange={ctx.toggleProgressBar} />
        </div>
      </div>
      {ctx.stickers.length > 0 && (
        <div className="a-section">
          <span className="mz-sec-label">Sur la scène · {ctx.stickers.length}</span>
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

// ─── Assistant IA (capacités réelles uniquement) ───────────────────────────

export function AiPanel({ ctx }: { ctx: MontageCtx }) {
  const hasVideo = ctx.clips.some((c) => c.kind === "video");
  return (
    <div className="a-section">
      <div className="mz-ai-card">
        <div className="halo-blob" style={{ width: 150, height: 150, right: -40, top: -50, background: "radial-gradient(circle, var(--mint), transparent 70%)", opacity: .5 }} />
        <div style={{ position: "relative", zIndex: 2 }}>
          <div className="mz-sec-label" style={{ color: "var(--mint)", marginBottom: 8 }}>Assistant Klip</div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "italic", fontSize: 19, letterSpacing: "-0.02em", marginBottom: 4 }}>Sous-titres automatiques.</div>
          <p style={{ fontSize: 12.5, color: "var(--cream-2)", marginBottom: 14, lineHeight: 1.45 }}>Klip transcrit la voix du premier plan vidéo et pose les sous-titres dans le temps.</p>
          <button className="mz-ai-btn" disabled={!hasVideo || ctx.transcribing} onClick={ctx.generateCaptionsAI}>
            <VIcon name="sparkles" size={16} /> {ctx.transcribing ? "Transcription…" : "Générer les sous-titres"}
          </button>
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.5, marginTop: 12 }}>
        Montage automatique, suggestion musicale et recadrage IA du sujet arrivent dans un prochain lot.
      </p>
    </div>
  );
}
