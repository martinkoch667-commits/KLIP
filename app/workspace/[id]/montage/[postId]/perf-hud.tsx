"use client";

/* perf-hud.tsx — le compteur qui remplace les suppositions.
 *
 * On tourne depuis plusieurs jours autour de « ça saccade » sans savoir OÙ passe
 * le temps. Ce panneau se branche sur le vrai monteur, avec les vrais rushes, sur
 * la vraie machine, et rend quatre chiffres qui suffisent à trancher :
 *
 *   • RENDUS/S et MS/RENDU — ce que React coûte. C'est la piste qu'on a suivie
 *     jusqu'ici : si ces deux nombres sont bas et que ça saccade quand même, le
 *     problème n'est pas là et on arrête de chercher de ce côté.
 *   • TÂCHES LONGUES — le fil principal bloqué plus de 50 ms d'affilée. C'est
 *     EXACTEMENT ce qui hache le son : le mixage audio n'a plus la main. Un son
 *     qui hache sans tâche longue viendrait d'ailleurs (décodage, réseau).
 *   • IMAGES PERDUES — ce que le lecteur vidéo n'a pas réussi à afficher. Sépare
 *     « la vidéo saccade » de « l'interface saccade ».
 *
 * Ouvert avec ?perf=1, et rien du tout sans. Ce n'est pas un outil de production,
 * c'est un stéthoscope.
 */

import { useEffect, useRef, useState } from "react";

export interface MesuresPerf {
  rendus: number;
  msRendu: number;
  tachesLongues: number;
  msBloquees: number;
  piresTaches: string;
  imagesPerdues: number;
  imagesTotal: number;
  cadence: number;
}

/** Compte les rendus du composant qui l'appelle. À poser dans le corps. */
export function useCompteurRendus(actif: boolean) {
  const n = useRef(0);
  if (actif) n.current++;
  return n;
}

export function PerfHud({
  compteurRendus,
  dureeRenduRef,
  videoRef,
}: {
  compteurRendus: React.MutableRefObject<number>;
  dureeRenduRef: React.MutableRefObject<number>;
  videoRef: () => HTMLVideoElement | null;
}) {
  const [m, setM] = useState<MesuresPerf>({
    rendus: 0, msRendu: 0, tachesLongues: 0, msBloquees: 0, piresTaches: "",
    imagesPerdues: 0, imagesTotal: 0, cadence: 0,
  });
  const [replie, setReplie] = useState(false);

  useEffect(() => {
    let taches: { d: number; nom: string }[] = [];
    let obs: PerformanceObserver | null = null;
    try {
      // `longtask` : tout ce qui tient le fil principal plus de 50 ms. Le son se
      // mixe sur ce fil ; au delà de 50 ms il n'a plus de quoi remplir sa mémoire
      // tampon, et ça s'entend.
      obs = new PerformanceObserver((liste) => {
        for (const e of liste.getEntries()) {
          const att = (e as PerformanceEntry & { attribution?: { name?: string }[] }).attribution?.[0]?.name;
          taches.push({ d: Math.round(e.duration), nom: att || e.name });
        }
      });
      obs.observe({ entryTypes: ["longtask"] });
    } catch { /* Safari : pas de longtask, les autres chiffres restent lisibles */ }

    let derniersRendus = compteurRendus.current;
    let imagesPerduesAvant = 0, imagesTotalAvant = 0;
    let images = 0;
    let raf = 0;
    const compterImage = () => { images++; raf = requestAnimationFrame(compterImage); };
    raf = requestAnimationFrame(compterImage);

    const minuteur = setInterval(() => {
      const v = videoRef();
      let perdues = 0, total = 0;
      if (v && typeof v.getVideoPlaybackQuality === "function") {
        const q = v.getVideoPlaybackQuality();
        perdues = q.droppedVideoFrames - imagesPerduesAvant;
        total = q.totalVideoFrames - imagesTotalAvant;
        imagesPerduesAvant = q.droppedVideoFrames;
        imagesTotalAvant = q.totalVideoFrames;
      }
      const rendus = compteurRendus.current - derniersRendus;
      derniersRendus = compteurRendus.current;
      const pires = [...taches].sort((a, b) => b.d - a.d).slice(0, 2).map((t) => `${t.d}ms ${t.nom}`).join(" · ");
      setM({
        rendus,
        msRendu: Math.round(dureeRenduRef.current * 10) / 10,
        tachesLongues: taches.length,
        msBloquees: taches.reduce((s, t) => s + t.d, 0),
        piresTaches: pires,
        imagesPerdues: Math.max(0, perdues),
        imagesTotal: Math.max(0, total),
        cadence: images,
      });
      taches = [];
      images = 0;
    }, 1000);

    return () => { clearInterval(minuteur); cancelAnimationFrame(raf); obs?.disconnect(); };
  }, [compteurRendus, dureeRenduRef, videoRef]);

  const alerte = m.msBloquees > 120 || m.imagesPerdues > 2;
  const ligne = (nom: string, valeur: string, mauvais = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
      <span style={{ opacity: .65 }}>{nom}</span>
      <span style={{ fontWeight: 800, color: mauvais ? "#FF8A6B" : "#B9F5A0" }}>{valeur}</span>
    </div>
  );

  return (
    <div
      onClick={() => setReplie((r) => !r)}
      style={{
        position: "fixed", right: 12, bottom: 12, zIndex: 9999, cursor: "pointer",
        background: "rgba(12,14,10,.92)", color: "#EDEDF2", borderRadius: 10, padding: replie ? "6px 10px" : "10px 12px",
        font: "600 11px/1.5 ui-monospace, monospace", minWidth: replie ? 0 : 250,
        boxShadow: "0 6px 24px rgba(0,0,0,.5)", border: `1px solid ${alerte ? "#FF8A6B" : "rgba(255,255,255,.14)"}`,
      }}
    >
      {replie ? (
        <span>PERF {m.msBloquees}ms bloqués/s</span>
      ) : (
        <>
          <div style={{ fontWeight: 800, marginBottom: 6, letterSpacing: ".04em" }}>MESURE · 1 s</div>
          {ligne("rendus React", `${m.rendus}/s`, m.rendus > 30)}
          {ligne("ms par rendu", `${m.msRendu} ms`, m.msRendu > 8)}
          {ligne("tâches longues", `${m.tachesLongues}`, m.tachesLongues > 0)}
          {ligne("fil bloqué", `${m.msBloquees} ms/s`, m.msBloquees > 120)}
          {ligne("images vidéo perdues", `${m.imagesPerdues} / ${m.imagesTotal}`, m.imagesPerdues > 2)}
          {ligne("images écran", `${m.cadence}/s`, m.cadence < 45)}
          {m.piresTaches && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,.14)", opacity: .8, fontSize: 10 }}>
              {m.piresTaches}
            </div>
          )}
          <div style={{ marginTop: 6, opacity: .5, fontSize: 9.5 }}>clic pour replier · ?perf=1</div>
        </>
      )}
    </div>
  );
}
