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

/**
 * Média d'aperçu, lisible.
 *
 * MediaThumb fige la vidéo sur sa première image — ce qu'il faut dans une
 * grille, mais pas dans un aperçu du rendu : quand cette première image est
 * noire (une ouverture en fondu, un plan sombre), l'aperçu paraît vide et rien
 * n'indique qu'il y a une vidéo, encore moins comment la lancer. Ici un bouton
 * de lecture centré la démarre sur place.
 */
export function MediaPreview({
  raw,
  poster,
  style,
  controls,
}: {
  raw?: string | null;
  /** Image d'attente : évite le rectangle noir avant la première lecture. */
  poster?: string | null;
  style?: React.CSSProperties;
  /** Commandes natives (lecture, pause, barre de progression, son).
      À réserver aux grands aperçus : sur une vignette elles écrasent l'image.
      Sans elles, une fois la lecture lancée il n'y a plus rien à cliquer pour
      revenir en arrière ou couper le son, et on ne peut pas vraiment regarder
      la vidéo qu'on s'apprête à publier. */
  controls?: boolean;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(false);
  /* Panne de lecture, affichée au lieu d'être avalée.

     Jusqu'ici, `play()` était appelé avec un `.catch()` vide et l'élément
     n'écoutait pas `error` : quand le navigateur refusait le fichier (format
     qu'il ne décode pas, fichier illisible, réseau), il ne se passait
     RIEN. Le bouton de lecture restait là, la vidéo ne démarrait pas, et
     personne, ni l'utilisateur ni nous, ne savait pourquoi. */
  const [failure, setFailure] = React.useState<string | null>(null);

  if (!raw) return null;

  const base: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    ...style,
  };

  if (!isVideoUrl(raw)) return <MediaThumb raw={raw} style={style} />;

  const MEDIA_ERR: Record<number, string> = {
    1: "lecture interrompue",
    2: "erreur réseau",
    3: "fichier illisible (décodage impossible)",
    4: "format non pris en charge par ce navigateur",
  };

  const toggle = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[MediaPreview] lecture refusée :", raw, msg);
        setFailure(msg);
      });
    } else { el.pause(); }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
      <video
        ref={videoRef}
        // #t=0.1 n'est pas cosmétique : sans ce fragment, un <video> en
        // preload="metadata" charge le fichier (readyState 4, dimensions
        // connues) mais ne peint AUCUNE image — l'aperçu reste noir jusqu'à la
        // première lecture. Demander une position force le décodage de cette
        // image-là et l'affiche. Vérifié sur un MP4 issu de MediaRecorder,
        // exactement celui que produit l'export.
        src={`${raw}#t=0.1`}
        poster={poster ? thumbUrl(poster, 640) : undefined}
        playsInline
        preload="metadata"
        controls={controls}
        onClick={controls ? undefined : toggle}
        onPlay={() => { setPlaying(true); setFailure(null); }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={(e) => {
          const code = e.currentTarget.error?.code ?? 0;
          const why = MEDIA_ERR[code] ?? "erreur inconnue";
          console.warn("[MediaPreview] média en erreur :", raw, code, why);
          setFailure(why);
        }}
        style={{ ...base, cursor: "pointer" }}
      />
      {failure && (
        <div style={{
          position: "absolute", left: 8, right: 8, bottom: 8, padding: "9px 11px", borderRadius: 9,
          background: "rgba(12,14,11,.86)", color: "#fff", fontSize: 11.5, lineHeight: 1.45,
          fontFamily: "var(--sans)", display: "flex", flexDirection: "column", gap: 6,
        }}>
          <span>Lecture impossible ici : {failure}.</span>
          <a href={raw} target="_blank" rel="noopener noreferrer" style={{ color: "var(--leaf, #BDF2A0)", fontWeight: 700 }}>
            Ouvrir la vidéo dans un onglet
          </a>
        </div>
      )}
      {!playing && !failure && !controls && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Lire la vidéo"
          style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            width: 62, height: 62, borderRadius: "50%", border: "none", cursor: "pointer",
            background: "rgba(12,14,11,.55)", backdropFilter: "blur(4px)",
            display: "grid", placeItems: "center", color: "#fff",
            boxShadow: "0 2px 14px rgba(0,0,0,.35)",
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 3 }}>
            <path d="M6 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 6 4.5Z" />
          </svg>
        </button>
      )}
    </div>
  );
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
