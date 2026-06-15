"use client";
import { useState, useCallback, useRef } from "react";
import Link from "next/link";

/* ── Inline SVG icons ────────────────────────────────────────────────────── */
function Ic({ name, size = 18, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24" as const, fill: "none" as const, stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, style };
  switch (name) {
    case "image":     return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5L5 20"/></svg>;
    case "check":     return <svg {...p}><path d="M4 12.5l5 5 11-11"/></svg>;
    case "spark":     return <svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>;
    case "arrow":     return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "arrowUR":   return <svg {...p}><path d="M7 17L17 7M8 7h9v9"/></svg>;
    case "instagram": return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>;
    case "facebook":  return <svg {...p}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>;
    case "clock":     return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>;
    case "pen":       return <svg {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
    default: return null;
  }
}

/* ── Constants ───────────────────────────────────────────────────────────── */
const DEMO_PHOTOS = [
  { id: 0, label: "Photo produit 1", color: "#8B6914" },
  { id: 1, label: "Photo ambiance",  color: "#4A3728" },
  { id: 2, label: "Photo équipe",    color: "#6B4423" },
  { id: 3, label: "Photo atelier",   color: "#3D2B1F" },
];

const DEMO_CAPTIONS = [
  "Une nouvelle collection qui raconte l'histoire de notre savoir-faire. Chaque pièce, une promesse.\n\n#maisonleclerc #artisanat #collection",
  "Dans les coulisses de l'atelier. La passion du détail, au cœur de chaque création.\n\n#behindthescenes #artisanat #maisonleclerc",
  "Notre équipe, votre confiance. Depuis 1987, nous construisons ensemble.\n\n#team #maisonleclerc #confiance",
  "L'excellence n'est pas un hasard. C'est le résultat d'un travail quotidien et passionné.\n\n#excellence #maisonleclerc #passion",
];

const STEP_LABELS = ["Importer", "Générer", "Éditer", "Programmer"];

/* ── Shared tokens ───────────────────────────────────────────────────────── */
const SANS = "'early-sans-variable', system-ui, sans-serif";
const DISPLAY = "'Archivo', system-ui, sans-serif";
const MINT = "#2FD79B";
const FOREST = "#0C2A1D";
const INK = "#0D0F0A";
const INK2 = "#565A4E";
const INK3 = "#8E9183";
const CREAM = "#EFEEE4";
const CANVAS = "#F4F3EC";
const SUNK = "#ECEBE1";

/* ── Main component ──────────────────────────────────────────────────────── */
export default function KlipDemo() {
  const [step, setStep] = useState(0);
  /* step 0 */
  const [selected, setSelected] = useState<number[]>([0, 1, 2, 3]);
  const [postType, setPostType] = useState<"Post" | "Reel" | "Story">("Post");
  /* step 1 */
  const [generating, setGenerating] = useState(false);
  const [captionsReady, setCaptionsReady] = useState(false);
  const [captions, setCaptions] = useState<string[]>(DEMO_CAPTIONS);
  /* step 2 */
  const [textSize, setTextSize] = useState(54);
  const [textPos, setTextPos] = useState<"top" | "center" | "bottom">("bottom");
  const [textColor, setTextColor] = useState("#ffffff");
  /* step 3 */
  const [published, setPublished] = useState<number[]>([]);
  const [allDone, setAllDone] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() { if (timerRef.current) clearTimeout(timerRef.current); }

  const handleGenerate = useCallback(() => {
    clearTimer();
    setGenerating(true);
    setCaptionsReady(false);
    setStep(1);
    timerRef.current = setTimeout(() => {
      setGenerating(false);
      setCaptionsReady(true);
    }, 1800);
  }, []);

  function handlePublishAll() {
    setPublished([]);
    setAllDone(false);
    selected.forEach((id, i) => {
      timerRef.current = setTimeout(() => {
        setPublished(prev => [...prev, id]);
        if (i === selected.length - 1) {
          timerRef.current = setTimeout(() => setAllDone(true), 400);
        }
      }, i * 380);
    });
  }

  function reset() {
    clearTimer();
    setStep(0);
    setSelected([0, 1, 2, 3]);
    setPostType("Post");
    setGenerating(false);
    setCaptionsReady(false);
    setCaptions(DEMO_CAPTIONS);
    setPublished([]);
    setAllDone(false);
  }

  const fontSize = 14 + Math.round(textSize * 0.18); // 14–32px
  const ph = DEMO_PHOTOS[0];

  return (
    <section style={{ padding: "96px 0 0" }}>
      <style>{`
        @keyframes klip-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes klip-fade { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .klip-demo-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
        @media (max-width: 600px) { .klip-demo-grid { grid-template-columns: repeat(2,1fr); } }
        .klip-edit-layout { display: grid; grid-template-columns: 1fr 220px; gap: 18px; }
        @media (max-width: 680px) { .klip-edit-layout { grid-template-columns: 1fr; } }
      `}</style>

      <div className="lp-wrap">
        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: SANS, fontWeight: 800, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: INK3, marginBottom: 18 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: MINT, boxShadow: `0 0 0 4px rgba(47,215,155,.25)`, flexShrink: 0 }} />
            Démo interactive
          </span>
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "clamp(32px,4vw,54px)", letterSpacing: "-0.03em", lineHeight: 1, textTransform: "uppercase", margin: "0 0 16px" }}>
            Voyez Klip en action.
          </h2>
          <p style={{ fontFamily: SANS, fontWeight: 600, fontSize: 16, color: INK2, maxWidth: 500, margin: "0 auto" }}>
            Cliquez pour vivre le workflow complet — de l&apos;import à la publication.
          </p>
        </div>

        {/* Shell */}
        <div style={{ maxWidth: 900, margin: "0 auto", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 64px rgba(13,15,10,.14), inset 0 0 0 1px rgba(13,15,10,.1)", background: CANVAS }}>

          {/* ── Fake navbar ── */}
          <div style={{ background: FOREST, padding: "13px 20px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["#ff5f57", "#febc2e", "#28c840"].map(c => (
                <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: 7, background: MINT, display: "grid", placeItems: "center", color: "#06281C", fontSize: 10, fontWeight: 900, fontFamily: SANS, flexShrink: 0 }}>ML</span>
              <span style={{ color: CREAM, fontSize: 13.5, fontWeight: 800, fontFamily: SANS }}>Maison Leclerc</span>
              <span style={{ color: "rgba(239,238,228,.4)", fontSize: 11.5, fontFamily: SANS }}>· espace client</span>
            </div>
            <span style={{ marginLeft: "auto", color: "rgba(239,238,228,.35)", fontSize: 9.5, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", fontFamily: SANS }}>Démo Klip</span>
          </div>

          {/* ── Progress bar ── */}
          <div style={{ background: SUNK, borderBottom: `1px solid rgba(13,15,10,.1)`, padding: "16px 28px", display: "flex", alignItems: "flex-start" }}>
            {STEP_LABELS.map((s, i) => (
              <div key={s} style={{ flex: i < STEP_LABELS.length - 1 ? 1 : "none", display: "flex", alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, fontFamily: SANS, background: i < step ? MINT : i === step ? INK : "#D8D7CF", color: i <= step ? (i === step ? CREAM : "#06281C") : INK3, transition: "all .3s", flexShrink: 0 }}>
                    {i < step ? <Ic name="check" size={14} /> : i + 1}
                  </div>
                  <span style={{ fontSize: 9.5, fontWeight: 800, fontFamily: SANS, textTransform: "uppercase", letterSpacing: ".1em", color: i === step ? INK : i < step ? MINT : INK3, whiteSpace: "nowrap" }}>{s}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: i < step ? MINT : "#D8D7CF", margin: "13px 8px 0", transition: "background .3s" }} />
                )}
              </div>
            ))}
          </div>

          {/* ── Sliding content ── */}
          <div style={{ overflow: "hidden", position: "relative" }}>
            <div style={{ display: "flex", transition: "transform .4s cubic-bezier(.25,.46,.45,.94)", transform: `translateX(-${step * 25}%)`, width: "400%" }}>

              {/* ══ STEP 0 : IMPORTER ══ */}
              <div style={{ width: "25%", padding: "24px 28px" }}>
                <p style={{ fontSize: 12, fontWeight: 800, fontFamily: SANS, color: INK3, marginBottom: 14, textTransform: "uppercase", letterSpacing: ".1em" }}>
                  Sélectionnez vos photos
                </p>
                <div className="klip-demo-grid" style={{ marginBottom: 20 }}>
                  {DEMO_PHOTOS.map(p => {
                    const sel = selected.includes(p.id);
                    return (
                      <button key={p.id} onClick={() => setSelected(s => s.includes(p.id) ? s.filter(x => x !== p.id) : [...s, p.id])}
                        style={{ position: "relative", borderRadius: 12, overflow: "hidden", aspectRatio: "4/5", border: "none", padding: 0, cursor: "pointer", boxShadow: sel ? `0 0 0 3px ${MINT}` : "inset 0 0 0 1.5px rgba(13,15,10,.15)", transition: "all .18s", transform: sel ? "translateY(-3px)" : "none", background: p.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: "rgba(255,255,255,.35)" }}><Ic name="image" size={28} /></span>
                        {!sel && <span style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.3)" }} />}
                        {sel && (
                          <span style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%", background: MINT, color: "#06281C", display: "grid", placeItems: "center" }}>
                            <Ic name="check" size={13} />
                          </span>
                        )}
                        <span style={{ position: "absolute", bottom: 6, left: 6, right: 6, fontSize: 9, fontWeight: 700, fontFamily: SANS, color: "rgba(255,255,255,.75)", textAlign: "center", lineHeight: 1.3 }}>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 800, fontFamily: SANS, color: INK3, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>Type de post</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["Post", "Reel", "Story"] as const).map(t => (
                      <button key={t} onClick={() => setPostType(t)} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, fontFamily: SANS, fontWeight: 800, fontSize: 13.5, border: "none", cursor: "pointer", background: postType === t ? INK : "transparent", color: postType === t ? CREAM : INK, boxShadow: postType === t ? "none" : "inset 0 0 0 1.5px rgba(13,15,10,.15)", transition: "all .15s" }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleGenerate} disabled={selected.length === 0}
                  style={{ width: "100%", padding: "14px 20px", borderRadius: 999, background: MINT, color: "#06281C", fontFamily: SANS, fontWeight: 800, fontSize: 15, border: "none", cursor: selected.length > 0 ? "pointer" : "default", opacity: selected.length > 0 ? 1 : 0.4, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all .2s" }}>
                  <Ic name="spark" size={18} /> Générer les légendes
                </button>
              </div>

              {/* ══ STEP 1 : GÉNÉRER ══ */}
              <div style={{ width: "25%", padding: "24px 28px", minHeight: 380 }}>
                {generating ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 340, gap: 22 }}>
                    <div style={{ width: 58, height: 58, borderRadius: "50%", background: MINT, color: "#06281C", display: "grid", placeItems: "center", animation: "klip-spin 1.1s linear infinite" }}>
                      <Ic name="spark" size={28} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontFamily: SANS, fontWeight: 800, fontSize: 15, color: INK, margin: "0 0 6px" }}>L&apos;IA analyse vos contenus…</p>
                      <p style={{ fontFamily: SANS, fontSize: 13, color: INK3 }}>Génération pour {selected.length} photo{selected.length > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                ) : captionsReady ? (
                  <div style={{ animation: "klip-fade .4s ease" }}>
                    <p style={{ fontSize: 12, fontWeight: 800, fontFamily: SANS, color: INK3, marginBottom: 14, textTransform: "uppercase", letterSpacing: ".1em" }}>
                      Légendes générées — relisez & ajustez
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {selected.slice(0, 3).map(id => {
                        const p = DEMO_PHOTOS[id];
                        return (
                          <div key={id} style={{ display: "flex", gap: 12, background: "#fff", borderRadius: 12, padding: "12px 14px", boxShadow: "inset 0 0 0 1px rgba(13,15,10,.09)" }}>
                            <div style={{ width: 48, height: 60, borderRadius: 8, background: p.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ color: "rgba(255,255,255,.4)" }}><Ic name="image" size={18} /></span>
                            </div>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 9.5, fontWeight: 800, fontFamily: SANS, color: INK3, textTransform: "uppercase", letterSpacing: ".08em", display: "block", marginBottom: 4 }}>{p.label}</span>
                              <textarea
                                value={captions[id]}
                                onChange={e => { const c = [...captions]; c[id] = e.target.value; setCaptions(c); }}
                                style={{ width: "100%", border: "none", background: "transparent", resize: "none", fontSize: 12, lineHeight: 1.5, color: INK, fontFamily: SANS, outline: "none", minHeight: 58 }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {selected.length > 3 && (
                        <p style={{ textAlign: "center", fontSize: 12, color: INK3, fontFamily: SANS, fontWeight: 700, margin: "2px 0" }}>
                          + {selected.length - 3} autre{selected.length - 3 > 1 ? "s" : ""} légende{selected.length - 3 > 1 ? "s" : ""} générée{selected.length - 3 > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                    <button onClick={() => setStep(2)}
                      style={{ width: "100%", marginTop: 18, padding: "13px 20px", borderRadius: 999, background: INK, color: CREAM, fontFamily: SANS, fontWeight: 800, fontSize: 14.5, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      Éditer le visuel <Ic name="arrow" size={16} />
                    </button>
                  </div>
                ) : null}
              </div>

              {/* ══ STEP 2 : ÉDITER ══ */}
              <div style={{ width: "25%", padding: "24px 28px" }}>
                <div className="klip-edit-layout">
                  {/* Canvas */}
                  <div style={{ borderRadius: 14, overflow: "hidden", aspectRatio: "4/5", background: ph.color, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 24px rgba(0,0,0,.2)" }}>
                    <span style={{ color: "rgba(255,255,255,.2)" }}><Ic name="image" size={40} /></span>
                    {/* Text overlay */}
                    <div style={{ position: "absolute", left: 14, right: 14, ...(textPos === "top" ? { top: 14 } : textPos === "center" ? { top: "50%", transform: "translateY(-50%)" } : { bottom: 14 }), fontFamily: DISPLAY, fontWeight: 700, fontStyle: "italic", fontSize, color: textColor, textShadow: "0 2px 8px rgba(0,0,0,.5)", lineHeight: 1.2 }}>
                      {captions[0].split("\n")[0]}
                    </div>
                    {/* Type badge */}
                    <span style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", borderRadius: 4, padding: "3px 8px", fontSize: 9.5, fontWeight: 700, fontFamily: SANS, color: "#fff", letterSpacing: ".06em" }}>
                      {postType.toUpperCase()}
                    </span>
                    {/* IG badge */}
                    <span style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", borderRadius: 4, padding: "4px 5px", display: "flex", alignItems: "center" }}>
                      <Ic name="instagram" size={12} style={{ color: "#fff" }} />
                    </span>
                  </div>

                  {/* Controls panel */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 800, fontFamily: SANS, textTransform: "uppercase", letterSpacing: ".09em", color: INK3, marginBottom: 8 }}>Taille du texte</p>
                      <input type="range" min={0} max={100} value={textSize} onChange={e => setTextSize(Number(e.target.value))} style={{ width: "100%", accentColor: MINT }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 800, fontFamily: SANS, textTransform: "uppercase", letterSpacing: ".09em", color: INK3, marginBottom: 8 }}>Couleur</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        {["#ffffff", MINT, INK].map(c => (
                          <button key={c} onClick={() => setTextColor(c)} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: "none", cursor: "pointer", boxShadow: textColor === c ? `0 0 0 3px ${MINT}` : "inset 0 0 0 1.5px rgba(13,15,10,.2)", transition: "all .15s" }} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 800, fontFamily: SANS, textTransform: "uppercase", letterSpacing: ".09em", color: INK3, marginBottom: 8 }}>Position</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {(["top", "center", "bottom"] as const).map(pos => {
                          const labels = { top: "Haut", center: "Centre", bottom: "Bas" };
                          return (
                            <button key={pos} onClick={() => setTextPos(pos)} style={{ padding: "8px 12px", borderRadius: 8, fontFamily: SANS, fontWeight: 700, fontSize: 12.5, border: "none", cursor: "pointer", background: textPos === pos ? INK : "transparent", color: textPos === pos ? CREAM : INK, boxShadow: textPos === pos ? "none" : "inset 0 0 0 1px rgba(13,15,10,.14)", transition: "all .15s" }}>
                              {labels[pos]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button onClick={() => setStep(3)} style={{ marginTop: "auto", padding: "11px 14px", borderRadius: 999, background: MINT, color: "#06281C", fontFamily: SANS, fontWeight: 800, fontSize: 13.5, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      Programmer <Ic name="arrow" size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* ══ STEP 3 : PROGRAMMER ══ */}
              <div style={{ width: "25%", padding: "24px 28px" }}>
                {allDone ? (
                  <div style={{ textAlign: "center", padding: "32px 16px", animation: "klip-fade .4s ease" }}>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: MINT, color: "#06281C", display: "grid", placeItems: "center", margin: "0 auto 22px" }}>
                      <Ic name="check" size={32} />
                    </div>
                    <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em", textTransform: "uppercase", marginBottom: 12, lineHeight: 1.1 }}>Tout est programmé.</h3>
                    <p style={{ color: INK2, fontSize: 15, lineHeight: 1.62, marginBottom: 6 }}>
                      {selected.length} post{selected.length > 1 ? "s" : ""} publiés automatiquement<br />sur Instagram et Facebook.
                    </p>
                    <p style={{ fontFamily: SANS, fontWeight: 800, fontSize: 16, color: INK, marginBottom: 28 }}>Vous venez de gagner 2 heures.</p>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                      <Link href="/register" style={{ padding: "13px 22px", borderRadius: 999, background: MINT, color: "#06281C", fontFamily: SANS, fontWeight: 800, fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
                        Créer un compte gratuit <Ic name="arrowUR" size={14} />
                      </Link>
                      <button onClick={reset} style={{ padding: "13px 22px", borderRadius: 999, background: "transparent", color: INK, fontFamily: SANS, fontWeight: 800, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "inset 0 0 0 1.5px rgba(13,15,10,.18)" }}>
                        Recommencer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 800, fontFamily: SANS, color: INK3, marginBottom: 14, textTransform: "uppercase", letterSpacing: ".1em" }}>
                      Choisissez une date &amp; une plateforme
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                      {selected.map((id, i) => {
                        const p = DEMO_PHOTOS[id];
                        const isPub = published.includes(id);
                        return (
                          <div key={id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12, background: isPub ? "rgba(47,215,155,.1)" : "#fff", boxShadow: isPub ? `inset 0 0 0 1.5px ${MINT}` : "inset 0 0 0 1px rgba(13,15,10,.1)", transition: "all .3s" }}>
                            <div style={{ width: 40, height: 50, borderRadius: 8, background: p.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {isPub
                                ? <span style={{ color: MINT }}><Ic name="check" size={18} /></span>
                                : <span style={{ color: "rgba(255,255,255,.4)" }}><Ic name="image" size={16} /></span>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: INK3, fontFamily: SANS, display: "block" }}>{p.label}</span>
                              <input type="datetime-local" defaultValue={`2026-06-${16 + i * 2}T18:30`} style={{ fontSize: 11, color: INK, border: "none", background: "transparent", fontFamily: SANS, padding: 0, width: "100%", marginTop: 2, outline: "none" }} />
                            </div>
                            <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                              <span style={{ width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center", background: MINT, color: "#06281C" }}><Ic name="instagram" size={13} /></span>
                              <span style={{ width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center", background: "rgba(13,15,10,.08)", color: INK3 }}><Ic name="facebook" size={13} /></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={handlePublishAll}
                      style={{ width: "100%", padding: "14px 20px", borderRadius: 999, background: FOREST, color: CREAM, fontFamily: SANS, fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      <Ic name="instagram" size={18} /> Publier tout
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ── Footer nav ── */}
          <div style={{ padding: "13px 24px", borderTop: `1px solid rgba(13,15,10,.1)`, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={reset} style={{ fontFamily: SANS, fontWeight: 700, fontSize: 13, color: INK3, background: "none", border: "none", cursor: "pointer" }}>↺ Recommencer</button>
            {step > 0 && step < 3 && step !== 1 && (
              <button onClick={() => setStep(s => s - 1)} style={{ fontFamily: SANS, fontWeight: 700, fontSize: 13, color: INK2, background: "none", border: "none", cursor: "pointer" }}>← Retour</button>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
