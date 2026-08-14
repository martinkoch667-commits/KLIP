"use client";
import React from "react";

// Vignette média — une seule implémentation, partagée par le tableau de bord,
// le planning, l'aperçu de feed et le volet d'aperçu, qui en avaient chacun
// leur copie.
//
// Le point important est le choix de la source. Un élément <video> est
// bien plus coûteux qu'une <img> : le navigateur ouvre un décodeur par
// élément, et Safari en tolère mal une grille entière — c'est une cause
// directe de ralentissement puis de plantage d'onglet. On ne rend donc une
// vidéo que lorsqu'il n'existe réellement aucune image pour ce post.

export function isVideoUrl(url?: string | null): boolean {
  return !!url && /\.(webm|mp4|mov|m4v|quicktime)(\?|$)/i.test(url);
}

/**
 * Choisit quoi afficher parmi les sources d'un post, dans l'ordre de
 * préférence donné : la première image l'emporte sur n'importe quelle vidéo,
 * même mieux placée. On ne retombe sur une vidéo que faute d'image.
 */
export function pickThumbSource(...candidates: (string | null | undefined)[]): string | null {
  const present = candidates.filter((u): u is string => !!u);
  return present.find((u) => !isVideoUrl(u)) ?? present[0] ?? null;
}

export default function MediaThumb({
  raw,
  style,
}: {
  raw?: string | null;
  style?: React.CSSProperties;
}) {
  if (!raw) return null;
  const base: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    ...style,
  };
  if (isVideoUrl(raw)) {
    // #t=0.1 fige la vidéo sur sa première image ; preload="metadata" évite de
    // télécharger le flux entier pour une simple vignette.
    return <video src={`${raw}#t=0.1`} muted playsInline preload="metadata" style={base} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/proxy-image?url=${encodeURIComponent(raw)}`} alt="" loading="lazy" decoding="async" style={base} />;
}
