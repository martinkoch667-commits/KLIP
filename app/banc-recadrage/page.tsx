"use client";

/* Banc d'essai du recadrage d'image : page temporaire, réservée au développement.
 *
 * L'éditeur vit derrière l'authentification et un document ouvert ; pour juger
 * une poignée de recadrage il fallait ouvrir un vrai post. On monte donc le
 * strict nécessaire : un cadre, une image posée dedans selon la MÊME règle que
 * le nœud Konva de l'éditeur (décalage figé, zoom figé), et le vrai
 * SelectionOverlay, qui est l'endroit où le recadrage se calcule.
 *
 * L'image de test est une pile de bandes numérotées : si une bande change de
 * place pendant qu'on tire une poignée, c'est que le cadre emmène la photo avec
 * lui, et c'est précisément le bug.
 */

import React, { useRef, useState } from "react";
import SelectionOverlay from "@/components/SelectionOverlay";

const NAT_W = 600, NAT_H = 900;
const BANDES = ["#E0563F", "#F2A03D", "#F2C14E", "#7FB069", "#2FD79B", "#3B7FC4", "#6656D9", "#B44A9B"];
const IMG = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${NAT_W}" height="${NAT_H}">` +
  BANDES.map((c, i) =>
    `<rect y="${i * (NAT_H / BANDES.length)}" width="${NAT_W}" height="${NAT_H / BANDES.length}" fill="${c}"/>` +
    `<text x="30" y="${i * (NAT_H / BANDES.length) + 70}" font-family="Helvetica" font-size="56" font-weight="bold" fill="#fff">${i + 1}</text>`
  ).join("") + `</svg>`
);

type El = {
  id: string; type: "image"; src: string;
  x: number; y: number; width: number; height: number; rotation: number; opacity: number;
  naturalW: number; naturalH: number; imgScale?: number; cropX?: number; cropY?: number;
};

const DEPART: El = {
  id: "img1", type: "image", src: IMG,
  x: 80, y: 60, width: 360, height: 480, rotation: 0, opacity: 100,
  naturalW: NAT_W, naturalH: NAT_H,
  imgScale: Math.max(360 / NAT_W, 480 / NAT_H),
};

export default function BancRecadrage() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return <BancRecadrageDev />;
}

function BancRecadrageDev() {
  const [el, setEl] = useState<El>(DEPART);
  const stageRef = useRef<HTMLDivElement>(null);

  // MÊME règle que le nœud image de l'éditeur : le zoom est figé, et le
  // décalage vaut le centrage tant que rien n'a été recadré.
  const scale = el.imgScale ?? Math.max(el.width / el.naturalW, el.height / el.naturalH);
  const scaledW = el.naturalW * scale, scaledH = el.naturalH * scale;
  const cropX = el.cropX ?? (el.width - scaledW) / 2;
  const cropY = el.cropY ?? (el.height - scaledH) / 2;

  return (
    <div style={{ padding: 24, fontFamily: "var(--sans)", background: "var(--canvas)", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Banc — recadrage d&apos;image</h1>
      <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16 }}>
        Tirez la barre du haut ou du bas : les bandes numérotées ne doivent PAS bouger, seul le cadre coupe dedans.
      </p>

      <div ref={stageRef} style={{ position: "relative", width: 600, height: 700, background: "#fff", boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: el.x, top: el.y, width: el.width, height: el.height,
          overflow: "hidden", outline: "1px dashed rgba(13,15,10,.25)",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={el.src} alt="" draggable={false}
            style={{ position: "absolute", left: cropX, top: cropY, width: scaledW, height: scaledH, maxWidth: "none" }} />
        </div>
        <SelectionOverlay
          el={el as unknown as Parameters<typeof SelectionOverlay>[0]["el"]}
          stageRef={stageRef as unknown as React.RefObject<unknown>}
          zoom={1}
          onChange={(u) => setEl((prev) => ({ ...prev, ...u } as El))}
        />
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", fontFamily: "var(--mono)", fontSize: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setEl(DEPART)}>Réinitialiser</button>
        <span>cadre {Math.round(el.x)},{Math.round(el.y)} · {Math.round(el.width)}×{Math.round(el.height)}</span>
        <span>image {Math.round(el.x + cropX)},{Math.round(el.y + cropY)} · zoom {scale.toFixed(3)}</span>
      </div>
    </div>
  );
}
