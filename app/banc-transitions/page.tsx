"use client";

/* Banc d'essai des TRANSITIONS : page temporaire, hors du produit.
 *
 * Une transition ne se juge qu'en la voyant, et le monteur demande un projet,
 * une session et deux rushes. Ce banc dessine chaque transition avec les VRAIES
 * fonctions du moteur (transitionPairAt + drawMediaWithState, celles-là mêmes
 * qui servent aux deux exports), sur deux images fabriquées ici, franchement
 * différentes pour qu'on voie qui entre et qui sort.
 *
 * Une ligne par transition, une pellicule d'images le long de la durée. C'est là
 * qu'on vérifie l'essentiel : le plan sortant est-il vivant pendant la
 * transition, ou est-ce qu'on glisse encore sur du noir ?
 */

import React, { useEffect, useRef, useState } from "react";
import { TRANSITIONS, transitionPairAt, estTransitionGl, type MontageClip } from "../workspace/[id]/montage/[postId]/constants";
import { drawMediaWithState, drawTransitionVeils, drawGlTransitionFrame, setCanvasSize } from "../workspace/[id]/montage/[postId]/render-core";
import { TransitionsPanel } from "../workspace/[id]/montage/[postId]/panels";
import { PerfHud, useCompteurRendus } from "../workspace/[id]/montage/[postId]/perf-hud";
import type { MontageCtx } from "../workspace/[id]/montage/[postId]/panels";

export default function BancTransitions() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return <BancTransitionsDev />;
}

const W = 76, H = 135;       // vignette 9:16
const ETAPES = 7;            // images le long de la transition

/** Deux images qu'on ne peut pas confondre : A rouge avec un rond, B bleue avec
 *  une croix. Sur une capture, on voit immédiatement laquelle sort et laquelle entre. */
function fabriquerImage(couleur: string, forme: "rond" | "croix", etiquette: string): Promise<HTMLImageElement> {
  const c = document.createElement("canvas");
  c.width = 216; c.height = 384;
  const x = c.getContext("2d")!;
  x.fillStyle = couleur; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = "#fff"; x.lineWidth = 14; x.lineCap = "round";
  if (forme === "rond") {
    x.beginPath(); x.arc(108, 192, 62, 0, Math.PI * 2); x.stroke();
  } else {
    x.beginPath(); x.moveTo(52, 136); x.lineTo(164, 248); x.moveTo(164, 136); x.lineTo(52, 248); x.stroke();
  }
  x.fillStyle = "#fff"; x.font = "bold 44px system-ui"; x.textAlign = "center";
  x.fillText(etiquette, 108, 70);
  const img = new Image();
  img.src = c.toDataURL();
  // `decode()` ne rend pas la main dans certains contextes (mesuré ici même :
  // image complète, promesse jamais tenue). `onload` est le signal fiable.
  return new Promise<HTMLImageElement>((res, rej) => {
    if (img.complete && img.naturalWidth) return res(img);
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("image"));
  });
}

const planFactice = (id: string, src: string): MontageClip & { start: number; end: number; dur: number } => ({
  id, kind: "photo", name: id, src, srcDur: 3, trimStart: 0, trimEnd: 3, speed: 1,
  filterId: "none", lum: 0, con: 0, sat: 0, transitionIn: "cut", transitionDur: 0.5,
  start: 0, end: 3, dur: 3,
});

function BancTransitionsDev() {
  // Le même compteur que dans le monteur : il mesure ici le coût des vignettes.
  const compteurRendus = useCompteurRendus(true);
  const dureeRenduRef = useRef(0);
  const debutRenduRef = useRef(performance.now());
  debutRenduRef.current = performance.now();
  useEffect(() => {
    const d = performance.now() - debutRenduRef.current;
    dureeRenduRef.current = dureeRenduRef.current * 0.8 + d * 0.2;
  });
  const [pret, setPret] = useState(false);
  // #gl dans l'adresse : n'affiche que les transitions à shader, pour les juger
  // sans faire défiler les quarante autres.
  const [liste, setListe] = useState(TRANSITIONS);
  useEffect(() => {
    if (window.location.hash === "#gl") setListe(TRANSITIONS.filter((t) => estTransitionGl(t.id)));
  }, []);
  const refs = useRef(new Map<string, HTMLCanvasElement>());

  useEffect(() => {
    let annule = false;
    (async () => {
      const [a, b] = await Promise.all([
        fabriquerImage("#D93A2B", "rond", "A"),
        fabriquerImage("#2B5BD9", "croix", "B"),
      ]);
      if (annule) return;
      setCanvasSize(W, H);
      const sortant = planFactice("a", a.src);
      for (const tr of liste) {
        const cv = refs.current.get(tr.id);
        if (!cv) continue;
        const ctx = cv.getContext("2d")!;
        const entrant = { ...planFactice("b", b.src), transitionIn: tr.id, transitionDur: 1 };
        for (let k = 0; k < ETAPES; k++) {
          const p = k / (ETAPES - 1);
          ctx.save();
          ctx.translate(k * (W + 4), 0);
          ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
          ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
          // Transition à shader : même chemin qu'à l'export. Si WebGL manque, le
          // dessin renvoie false et on voit le fondu de repli — ce que verra
          // aussi l'utilisateur dans ce cas.
          const faitEnGl = estTransitionGl(tr.id)
            && drawGlTransitionFrame(ctx, a, sortant, sortant.dur, b, entrant, p, tr.id, p);
          if (!faitEnGl) {
            const paire = transitionPairAt(tr.id, 1, p, false);
            drawMediaWithState(ctx, a, sortant, sortant.dur, paire.out);
            drawMediaWithState(ctx, b, entrant, p, paire.in);
            drawTransitionVeils(ctx, paire.in);
          }
          ctx.restore();
        }
      }
      setPret(true);
    })();
    return () => { annule = true; };
  }, [liste]);

  /* Le panneau réel, monté à côté de la planche. Il vérifie deux choses qu'on ne
     voit pas sur les vignettes : que les familles se rangent, et que chacune des
     quarante-cinq a bien son nom traduit — une clé manquante fait tomber la page
     entière avec next-intl. */
  const ctxPanneau = {
    selectedClip: { id: "x", transitionIn: "fade", transitionDur: 0.5 },
    updateClip: () => {},
    applyTransitionToAll: () => {},
    toast: () => {},
  } as unknown as MontageCtx;

  return (
    <div style={{ fontFamily: "system-ui", padding: 20, background: "#14141A", color: "#EDEDF2", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Transitions · A (rouge, rond) sort, B (bleu, croix) entre</h1>
      <p style={{ fontSize: 13, color: "#9A9AA8", marginBottom: 18 }}>
        {pret ? "Sur chaque ligne, A doit rester vivant tant que B n'a pas pris toute la place. Du noir au milieu = transition qui glisse sur le vide." : "Rendu…"}
      </p>
      <div className="a-panel" style={{ width: 300, marginBottom: 20, borderRadius: 10, overflow: "hidden" }}>
        <div className="a-panel-head"><span className="a-panel-title">Panneau Transitions</span></div>
        <div className="a-panel-scroll" style={{ maxHeight: 340 }}><TransitionsPanel ctx={ctxPanneau} /></div>
      </div>
      <PerfHud compteurRendus={compteurRendus} dureeRenduRef={dureeRenduRef} videoRef={() => null} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {liste.map((tr) => (
          <div key={tr.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 110, fontSize: 12, fontWeight: 700 }}>{tr.glyph} {tr.name}</span>
            <canvas
              ref={(el) => { if (el) refs.current.set(tr.id, el); else refs.current.delete(tr.id); }}
              width={ETAPES * (W + 4)}
              height={H}
              style={{ borderRadius: 6, background: "#000" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
