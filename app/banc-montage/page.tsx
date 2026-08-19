"use client";

/* Banc d'essai de la LECTURE dans le monteur : page temporaire, hors du produit.
 *
 * Le monteur rame quand on lit la vidéo. L'hypothèse à vérifier : l'horloge de
 * lecture appelle setTime à chaque image, et comme tout le monteur est un seul
 * composant React, c'est toute la timeline qui est recréée soixante fois par
 * seconde alors que rien d'autre que le curseur n'a bougé.
 *
 * Ce banc reproduit la timeline à l'échelle d'un vrai montage, avec les VRAIS
 * composants, et la fait tourner à 60 Hz pendant cinq secondes. Il compte les
 * rendus, mesure le temps passé dans React (Profiler) et la cadence réellement
 * atteinte. Deux modes, mêmes données :
 *
 *   « avant »  : tout est reconstruit à chaque image (l'architecture actuelle)
 *   « après »  : les blocs lourds sont mémoïsés (timeline-parts.tsx)
 *
 * L'écart entre les deux est la réponse à « pourquoi ça rame ».
 */

import React, { Profiler, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipStrip, ClipWave, AudioWave, FadeRamp, type ClipStripData } from "../workspace/[id]/montage/[postId]/timeline-parts";

// ── Versions NON mémoïsées, copies conformes de ce que fait page.tsx aujourd'hui ──
function ClipStripNaif({ data, width, height, filter }: { data?: ClipStripData; width: number; height: number; filter?: string }) {
  if (!data || !data.frames.length || width <= 0 || height <= 0) return null;
  let tileW = Math.max(14, Math.round(height * data.aspect));
  const MAX_TILES = 220;
  if (width / tileW > MAX_TILES) tileW = Math.ceil(width / MAX_TILES);
  const count = Math.max(1, Math.ceil(width / tileW));
  const last = data.frames.length - 1;
  const tiles: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const progress = count === 1 ? 0 : Math.min(1, (i * tileW + tileW / 2) / width);
    tiles.push(<span key={i} className="a-strip-tile" style={{ width: tileW, backgroundImage: `url("${data.frames[Math.round(progress * last)]}")` }} />);
  }
  return <div className="a-clip-strip" style={filter ? { filter } : undefined} aria-hidden>{tiles}</div>;
}

// ── Jeu de données : un montage réaliste ────────────────────────────────────
const NB_PLANS = 14;
const NB_PISTES_AUDIO = 3;
const PPS = 90;          // zoom timeline (px par seconde)
const H_PLAN = 52;

function vignettes(n: number): string[] {
  // Images minuscules générées sur place : on mesure le coût du DOM, pas celui
  // du réseau.
  return Array.from({ length: n }, (_, i) => {
    const c = document.createElement("canvas");
    c.width = 16; c.height = 9;
    const x = c.getContext("2d")!;
    x.fillStyle = `hsl(${(i * 37) % 360} 45% 45%)`;
    x.fillRect(0, 0, 16, 9);
    return c.toDataURL("image/png");
  });
}

interface PlanTest { id: string; start: number; dur: number; strip: ClipStripData; peaks: number[]; fi: number; fo: number }

function construireMontage(): { plans: PlanTest[]; pistes: { id: string; offset: number; dur: number; peaks: number[] }[]; total: number } {
  const frames = vignettes(8);
  const plans: PlanTest[] = [];
  let acc = 0;
  for (let i = 0; i < NB_PLANS; i++) {
    const dur = 2 + (i % 4);
    plans.push({
      id: `c${i}`, start: acc, dur,
      strip: { frames, aspect: 16 / 9 },
      peaks: Array.from({ length: Math.round(dur * 30) }, (_, k) => 0.15 + 0.85 * Math.abs(Math.sin(k / 9 + i) * Math.sin(k / 2.3))),
      fi: i % 3 === 0 ? 0.4 : 0, fo: i % 4 === 0 ? 0.5 : 0,
    });
    acc += dur;
  }
  const pistes = Array.from({ length: NB_PISTES_AUDIO }, (_, i) => ({
    id: `a${i}`, offset: i * 2, dur: acc - i * 2,
    peaks: Array.from({ length: Math.round((acc - i * 2) * 30) }, (_, k) => 0.1 + 0.9 * Math.abs(Math.sin(k / 11 + i * 2) * Math.sin(k / 3.1))),
  }));
  return { plans, pistes, total: acc };
}

// ── La timeline, dans les deux modes ────────────────────────────────────────
function Timeline({ memo, plans, pistes, time, curseurRef }: {
  memo: boolean;
  plans: PlanTest[];
  pistes: { id: string; offset: number; dur: number; peaks: number[] }[];
  time: number;
  curseurRef?: React.RefObject<HTMLDivElement>;
}) {
  const Strip = memo ? ClipStrip : ClipStripNaif;
  return (
    <div style={{ position: "relative", height: 240, overflow: "hidden", background: "#151233" }}>
      {/* piste vidéo */}
      <div style={{ position: "relative", height: H_PLAN + 4 }}>
        {plans.map((c) => (
          <div key={c.id} style={{ position: "absolute", left: c.start * PPS, width: c.dur * PPS, height: H_PLAN, overflow: "hidden", borderRadius: 6, background: "#2b8d57" }}>
            <Strip data={c.strip} width={c.dur * PPS} height={H_PLAN} filter={undefined} />
            {memo
              ? <ClipWave peaks={c.peaks} />
              : (
                <div className="a-clip-wave">
                  <svg width="100%" height="100%" preserveAspectRatio="none">
                    {c.peaks.map((p, wi) => { const x = (wi / c.peaks.length) * 100; const h = Math.max(10, p * 100); return <rect key={wi} x={`${x}%`} y={`${(100 - h) / 2}%`} width={`${100 / c.peaks.length}%`} height={`${h}%`} fill="rgba(255,255,255,.82)" />; })}
                  </svg>
                </div>
              )}
            {memo
              ? <FadeRamp className="a-clip-fade" w={c.dur * PPS} fi={c.fi * PPS} fo={c.fo * PPS} dim="rgba(0,0,0,.4)" />
              : (() => {
                  const w = c.dur * PPS, H = 30, fi = c.fi * PPS, fo = c.fo * PPS;
                  if (fi <= 0 && fo <= 0) return null;
                  return (
                    <svg className="a-clip-fade" viewBox={`0 0 ${Math.max(1, w)} ${H}`} preserveAspectRatio="none">
                      {fi > 0 && <><polygon points={`0,${H} ${fi},0 ${fi},${H}`} fill="rgba(0,0,0,.4)" /><line x1="0" y1={H} x2={fi} y2="0" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".95" /></>}
                      {fo > 0 && <><polygon points={`${w},${H} ${w - fo},0 ${w - fo},${H}`} fill="rgba(0,0,0,.4)" /><line x1={w} y1={H} x2={w - fo} y2="0" stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity=".95" /></>}
                    </svg>
                  );
                })()}
            <span style={{ position: "absolute", left: 6, bottom: 3, fontSize: 10, fontWeight: 700, color: "#fff" }}>{c.dur.toFixed(1)}s</span>
          </div>
        ))}
      </div>
      {/* pistes audio */}
      {pistes.map((a, i) => (
        <div key={a.id} style={{ position: "relative", height: 40, marginTop: 4 }}>
          <div style={{ position: "absolute", left: a.offset * PPS, width: a.dur * PPS, height: 36, background: "#3a2f7a", borderRadius: 6, overflow: "hidden" }}>
            {memo
              ? <AudioWave peaks={a.peaks} />
              : (
                <svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
                  {a.peaks.map((p, k) => { const x = (k / a.peaks.length) * 100; const h = Math.max(6, p * 100); return <rect key={k} x={`${x}%`} y={`${(100 - h) / 2}%`} width={`${100 / a.peaks.length}%`} height={`${h}%`} fill="#fff" />; })}
                </svg>
              )}
            <span style={{ position: "absolute", left: 6, top: 4, fontSize: 9.5, fontWeight: 700, color: "#fff" }}>piste {i + 1}</span>
          </div>
        </div>
      ))}
      {/* curseur de lecture : la SEULE chose qui bouge réellement. En mode
          « horloge hors React » il est repositionné par écriture DOM directe. */}
      <div ref={curseurRef} style={curseurRef
        ? { position: "absolute", top: 0, bottom: 0, width: 2, background: "#e33" }
        : { position: "absolute", top: 0, bottom: 0, width: 2, background: "#e33", left: time * PPS }} />
    </div>
  );
}

interface Resultat { mode: string; rendus: number; fps: number; battements: number; msParRendu: number; msTotal: number; noeuds: number }

export default function BancMontage() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return <BancMontageDev />;
}

const DUREE_ESSAI = 5000; // ms

/* Horloge non bridée, dans un worker.

   requestAnimationFrame est SUSPENDU dès que l'onglet passe en arrière-plan, et
   setInterval y tombe à une fois par seconde. Un banc cadencé par l'un ou
   l'autre ne mesure alors plus rien. Le worker, lui, continue de battre : c'est
   la même astuce que celle utilisée par l'export.

   Ce que le banc mesure du coup, c'est le temps passé DANS REACT (phase de
   rendu, via Profiler). La mise en page et la peinture ne sont pas comptées :
   la mesure sous-estime donc le problème réel plutôt que de l'exagérer. */
function creerHorloge() {
  const src = "let iv;onmessage=e=>{clearInterval(iv);if(e.data.ms)iv=setInterval(()=>postMessage(0),e.data.ms)}";
  const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
  const w = new Worker(url);
  return {
    battre(ms: number, cb: () => void) { w.onmessage = cb; w.postMessage({ ms }); return () => { w.postMessage({ ms: 0 }); w.onmessage = null; }; },
    fermer() { w.terminate(); URL.revokeObjectURL(url); },
  };
}

function BancMontageDev() {
  const [donnees, setDonnees] = useState<ReturnType<typeof construireMontage> | null>(null);
  useEffect(() => { setDonnees(construireMontage()); }, []);

  const [memo, setMemo] = useState(false);
  const [horsReact, setHorsReact] = useState(false);
  const curseurRef = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(0);
  const [enCours, setEnCours] = useState(false);
  const [resultats, setResultats] = useState<Resultat[]>([]);

  const rendus = useRef(0);
  const msTotal = useRef(0);
  const zoneRef = useRef<HTMLDivElement>(null);

  const onRender = useCallback((_id: string, _phase: string, actualDuration: number) => {
    rendus.current += 1;
    msTotal.current += actualDuration;
  }, []);

  // Un essai : l'horloge appelle setTime à chaque image, comme le monteur.
  const essai = useCallback((mode: boolean, hors: boolean, nom: string) => new Promise<Resultat>((resolve) => {
    setMemo(mode);
    setHorsReact(hors);
    setTime(0);
    // Laisse React poser le nouveau mode avant de compter.
    setTimeout(() => {
      rendus.current = 0; msTotal.current = 0;
      const horloge = creerHorloge();
      const t0 = performance.now();
      let battements = 0;
      let dernierRendu = 0;
      const arret = horloge.battre(1000 / 60, () => {
        const dt = performance.now() - t0;
        battements++;
        const t = dt / 1000;
        if (hors) {
          // Curseur à 60 Hz sans rendu ; React réveillé à 10 Hz seulement (aucune
          // animation continue dans ce montage de test).
          if (curseurRef.current) curseurRef.current.style.left = `${t * PPS}px`;
          if (dt - dernierRendu >= 100) { dernierRendu = dt; setTime(t); }
        } else {
          setTime(t);
        }
        if (dt < DUREE_ESSAI) return;
        arret();
        setTimeout(() => {
          horloge.fermer();
          const ecoule = performance.now() - t0;
          resolve({
            mode: nom,
            rendus: rendus.current,
            fps: (rendus.current / ecoule) * 1000,
            battements,
            msParRendu: msTotal.current / Math.max(1, rendus.current),
            msTotal: msTotal.current,
            noeuds: zoneRef.current ? zoneRef.current.getElementsByTagName("*").length : 0,
          });
        }, 60);
      });
    }, 300);
  }), []);

  async function lancer() {
    setEnCours(true);
    setResultats([]);
    const r: Resultat[] = [];
    r.push(await essai(false, false, "avant (tout reconstruit, 60 Hz)")); setResultats([...r]);
    r.push(await essai(true, false, "lot 1 : blocs lourds mémoïsés")); setResultats([...r]);
    r.push(await essai(true, true, "lot 1 + 2 : horloge hors React")); setResultats([...r]);
    setEnCours(false);
  }

  const styleBtn: React.CSSProperties = { padding: "6px 12px", border: "1px solid #ccc", borderRadius: 6, background: "#fff", cursor: "pointer" };
  const th: React.CSSProperties = { textAlign: "left", borderBottom: "2px solid #ddd", padding: "6px 10px", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { borderBottom: "1px solid #eee", padding: "6px 10px" };

  const gain = useMemo(() => {
    if (resultats.length < 3) return null;
    const a = resultats[0], c = resultats[2];
    return { total: a.msTotal / Math.max(0.001, c.msTotal), ms: a.msParRendu / Math.max(0.001, c.msParRendu) };
  }, [resultats]);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, color: "#111" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Banc d&apos;essai : lecture dans le monteur</h1>
      <p style={{ color: "#555", maxWidth: 760 }}>
        {NB_PLANS} plans, {NB_PISTES_AUDIO} pistes audio, spectre audio sur chaque plan. L&apos;horloge
        appelle <code>setTime</code> à chaque image pendant {DUREE_ESSAI / 1000} s, exactement comme
        la lecture du monteur. On mesure le temps passé dans React et la cadence atteinte.
      </p>
      <div style={{ display: "flex", gap: 8, margin: "16px 0", alignItems: "center" }}>
        <button onClick={lancer} disabled={enCours || !donnees} style={styleBtn}>Comparer avant / après</button>
        {enCours && <span>essai en cours…</span>}
      </div>

      <table style={{ borderCollapse: "collapse", fontSize: 13, marginBottom: 20 }}>
        <thead><tr>{["mode", "battements d'horloge", "rendus servis", "cadence", "temps React par rendu", "temps React total", "nœuds DOM"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {resultats.map((r, i) => (
            <tr key={i}>
              <td style={td}>{r.mode}</td>
              <td style={td}>{r.battements}</td>
              <td style={td}>{r.rendus}</td>
              <td style={td}>{r.fps.toFixed(1)} img/s</td>
              <td style={td}>{r.msParRendu.toFixed(2)} ms</td>
              <td style={td}>{(r.msTotal / 1000).toFixed(2)} s sur {DUREE_ESSAI / 1000} s</td>
              <td style={td}>{r.noeuds}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {gain && (
        <p style={{ fontWeight: 700 }}>
          Bout à bout : temps passé dans React pendant la lecture divisé par {gain.total.toFixed(0)}.
        </p>
      )}

      <div ref={zoneRef}>
        <Profiler id="timeline" onRender={onRender}>
          {donnees && <Timeline memo={memo} plans={donnees.plans} pistes={donnees.pistes} time={time} curseurRef={horsReact ? curseurRef : undefined} />}
        </Profiler>
      </div>
    </div>
  );
}
