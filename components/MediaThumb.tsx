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

/**
 * URL d'affichage d'une image, redimensionnée.
 *
 * Le point critique pour la mémoire. /api/proxy-image règle le CORS et les
 * en-têtes exigés par Instagram, mais renvoie l'ORIGINAL : une photo d'iPhone
 * de 12 Mpx pèse 48 Mo une fois décodée par le navigateur, quelle que soit la
 * taille d'affichage. Une grille d'une douzaine de vignettes suffisait donc à
 * faire recharger l'onglet par Safari — sans que rien ne « rame » au sens du
 * calcul : c'est de la mémoire, pas du CPU.
 *
 * On enchaîne donc l'optimiseur d'images de Next derrière le proxy : le proxy
 * va chercher le fichier, l'optimiseur le réduit à la largeur demandée et le
 * sert en WebP. Une vignette de 320 px retombe sous le mégaoctet.
 */
export function thumbUrl(raw: string, width = 480): string {
  const proxied = `/api/proxy-image?url=${encodeURIComponent(raw)}`;
  return `/_next/image?url=${encodeURIComponent(proxied)}&w=${width}&q=70`;
}

export default function MediaThumb({
  raw,
  style,
  width = 480,
}: {
  raw?: string | null;
  style?: React.CSSProperties;
  /** Largeur de rendu visée, en pixels. Doit figurer dans imageSizes/deviceSizes. */
  width?: number;
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
  return <img src={thumbUrl(raw, width)} alt="" loading="lazy" decoding="async" style={base} />;
}
