"use client";

/* Banc : cinq familles de pictogrammes pour les outils image.
 *
 * Les dessins et les teintes viennent de components/PictosOutils : ce banc ne
 * fait que les rendre de cinq façons. La famille retenue est E, la tuile
 * bombée, sans ombre portée colorée.
 */

import React from "react";
import { SCENES_OUTILS, TEINTES_OUTILS, type SceneOutil } from "@/components/PictosOutils";

type Scene = SceneOutil;

const SCENES: { id: string; nom: string; scene: Scene }[] = [
  { id: 'ajuster', nom: 'Ajuster', scene: SCENES_OUTILS.ajuster },
  { id: 'recadrer', nom: 'Recadrer', scene: SCENES_OUTILS.recadrer },
  { id: 'fond', nom: 'Effacer le fond', scene: SCENES_OUTILS.fond },
  { id: 'capture', nom: 'Capture magique', scene: SCENES_OUTILS.capture },
  { id: 'generer', nom: 'Générer le fond', scene: SCENES_OUTILS.generer },
  { id: 'edition', nom: 'Édition magique', scene: SCENES_OUTILS.edition },
  { id: 'gomme', nom: 'Gomme magique', scene: SCENES_OUTILS.gomme },
];

// ── Les quatre traitements ───────────────────────────────────────────────────
type Style = { id: string; nom: string; desc: string; rendu: (scene: Scene, i: number) => React.ReactNode };

/** Une teinte vive par outil : c'est la couleur qui identifie l'outil, pas le dessin. */
const CLAIRS = ['#DDD6FE', '#BFDBFE', '#A5F3FC', '#FFD9B3', '#A7F3D0', '#FBCFE8', '#FECACA'];
const TEINTES: [string, string, string][] = SCENES.map((sc, i) => {
  const [profond, vif] = TEINTES_OUTILS[sc.id];
  return [profond, vif, CLAIRS[i]];
});

const STYLES: Style[] = [
  {
    id: 'volume', nom: 'A. Volume', desc: 'Un disque en dégradé, la scène en blanc avec un reflet en haut. Le plus proche de Canva, sans copier leurs illustrations.',
    rendu: (scene, i) => {
      const [profond, vif, clair] = TEINTES[i];
      return (
        <span style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden',
          background: `radial-gradient(120% 120% at 28% 12%, ${vif} 0%, ${vif} 34%, ${profond} 100%)`,
          boxShadow: 'inset 0 2.5px 0 rgba(255,255,255,.45), inset 0 -9px 16px rgba(0,0,0,.2)' }}>
          <span style={{ position: 'absolute', top: '4%', left: '14%', width: '52%', height: '26%', borderRadius: '50%', background: 'rgba(255,255,255,.34)', filter: 'blur(5px)' }} />
          <svg width="52%" height="52%" viewBox="0 0 24 24" style={{ position: 'relative', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.32))' }}>
            {scene('#FFFFFF', 'rgba(255,255,255,.42)')}
          </svg>
        </span>
      );
    },
  },
  {
    id: 'papier', nom: 'B. Papier découpé', desc: 'Pastille de couleur pleine, scène blanche posée sur son double décalé en ton foncé. Le découpage papier de la marque, en version saturée.',
    rendu: (scene, i) => {
      const [profond, vif, clair] = TEINTES[i];
      return (
        <span style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', display: 'grid', placeItems: 'center', position: 'relative',
          background: vif }}>
          <svg width="54%" height="54%" viewBox="0 0 24 24" style={{ position: 'absolute', transform: 'translate(9%, 10%)', opacity: .34 }}>
            {scene('#0A0D08', '#0A0D08')}
          </svg>
          <svg width="54%" height="54%" viewBox="0 0 24 24" style={{ position: 'relative' }}>
            {scene('#FFFFFF', clair)}
          </svg>
        </span>
      );
    },
  },
  {
    id: 'aplat', nom: 'C. Aplat franc', desc: 'Un aplat de couleur pleine, la scène en blanc, zéro dégradé. Le plus net à petite taille, et le plus rapide à lire.',
    rendu: (scene, i) => {
      const [profond, vif, clair] = TEINTES[i];
      return (
        <span style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', display: 'grid', placeItems: 'center', background: vif }}>
          <svg width="54%" height="54%" viewBox="0 0 24 24">{scene('#FFFFFF', clair)}</svg>
        </span>
      );
    },
  },
  {
    id: 'verre', nom: 'D. Verre teinté', desc: 'Une tache floue derrière un disque translucide cerclé de blanc, scène en blanc. Moderne, plus technologique, un peu moins chaleureux.',
    rendu: (scene, i) => {
      const [profond, vif, clair] = TEINTES[i];
      return (
        <span style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden',
          background: `${vif}40`, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.75)' }}>
          <span style={{ position: 'absolute', width: '96%', height: '96%', borderRadius: '50%', background: `linear-gradient(140deg, ${vif} 20%, ${profond})`, filter: 'blur(7px)' }} />
          <span style={{ position: 'absolute', top: '8%', width: '46%', height: '24%', borderRadius: '50%', background: 'rgba(255,255,255,.4)', filter: 'blur(5px)' }} />
          <svg width="50%" height="50%" viewBox="0 0 24 24" style={{ position: 'relative' }}>{scene('#FFFFFF', 'rgba(255,255,255,.42)')}</svg>
        </span>
      );
    },
  },
  {
    id: 'squircle', nom: 'E. Tuile bombée', desc: 'RETENUE. Un carré très arrondi plutôt qu\'un rond, biseau lumineux en haut, creux en bas, aucune ombre portée. La forme des icônes d\'application, elle tient bien en grille de quatre.',
    rendu: (scene, i) => {
      const [profond, vif, clair] = TEINTES[i];
      return (
        <span style={{ width: '100%', aspectRatio: '1', borderRadius: '30%', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden',
          background: `linear-gradient(155deg, ${vif} 4%, ${profond} 96%)`,
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,.45), inset 0 -7px 14px rgba(0,0,0,.18)' }}>
          <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(255,255,255,.34), transparent 46%)' }} />
          <svg width="50%" height="50%" viewBox="0 0 24 24" style={{ position: 'relative', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.3))' }}>
            {scene('#FFFFFF', 'rgba(255,255,255,.42)')}
          </svg>
        </span>
      );
    },
  },
];

export default function BancPictos() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return (
    <main style={{ minHeight: "100vh", background: "#FBFAF6", padding: "32px 30px 60px" }}>
      <h1 style={{ fontFamily: "var(--display, Archivo), system-ui", fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em", margin: "0 0 6px", color: "var(--ink, #14160F)" }}>
        Pictogrammes des outils : cinq familles
      </h1>
      <p style={{ fontSize: 13.5, color: "var(--ink-2, #3C4034)", margin: "0 0 26px", maxWidth: 680, lineHeight: 1.5 }}>
        Même dessin dans les cinq, seul le traitement change. Une couleur franche par outil, saturée comme chez Canva :
        la charte habille le produit, pas la boîte à outils, et un picto se reconnaît d&apos;abord à sa couleur. Dites-moi la lettre.
      </p>
      <div style={{ display: "grid", gap: 30 }}>
        {STYLES.map(st => (
          <section key={st.id} style={{ background: "#fff", borderRadius: 16, padding: 22, boxShadow: "0 2px 10px rgba(0,0,0,.05)" }}>
            <h2 style={{ fontFamily: "var(--display, Archivo), system-ui", fontWeight: 800, fontSize: 17, margin: "0 0 4px", color: "var(--ink, #14160F)" }}>{st.nom}</h2>
            <p style={{ fontSize: 12.5, color: "var(--ink-3, #6B6F63)", margin: "0 0 16px", lineHeight: 1.5, maxWidth: 620 }}>{st.desc}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 86px)", gap: 14 }}>
              {SCENES.map((sc, i) => (
                <div key={sc.id} style={{ display: "grid", gap: 7, justifyItems: "center" }}>
                  {st.rendu(sc.scene, i)}
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--ink-2, #3C4034)", textAlign: "center", lineHeight: 1.2 }}>{sc.nom}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
