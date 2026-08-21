"use client";

/* Pastille « Signaler un bug » de la phase d'ouverture.
 *
 * Repliée sur son étiquette au repos, elle se déplie au survol : le libellé
 * tient dans un élément à part pour pouvoir s'ouvrir avec un ressort. Un
 * bandeau permanent dans le coin de chaque page, c'était trop de place prise
 * pour une action qu'on ne fait pas tous les jours.
 *
 * Deux blocs dans un seul objet : une étiquette verte détachée, façon sticker
 * collé sur la pilule, puis l'action. C'est l'étiquette qui dit « bêta », le
 * texte dit ce qu'on peut faire — l'ancien libellé d'un seul tenant mélangeait
 * les deux.
 *
 * Le composant ne se place pas lui-même : c'est l'appelant qui l'ancre (cf.
 * `.kbeta-dock`). Il porte le geste, pas la position, pour pouvoir servir
 * ailleurs qu'en bas à droite.
 */

import * as React from "react";

interface BetaButtonProps {
  /** Action au clic. Ignoré si `href` est fourni. */
  onReport?: () => void;
  /** Rend un lien plutôt qu'un bouton. */
  href?: string;
  /** Texte de l'étiquette. `null` la retire — pour la sortie de bêta. */
  chipLabel?: string | null;
  label?: string;
  className?: string;
}

/* Fiole. Les identifiants de dégradé sont uniques PAR INSTANCE (useId) : deux
   pastilles sur la même page partageraient sinon les mêmes ids, et le jour où
   l'une se démonte, elle emporte les dégradés de l'autre. */
function FioleIcon() {
  const uid = React.useId().replace(/:/g, "");
  const fiole = `kb-flask-${uid}`;
  const verre = `kb-glass-${uid}`;
  const bouchon = `kb-cork-${uid}`;
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={fiole} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EAFDD8" />
          <stop offset="55%" stopColor="#B4EC8E" />
          <stop offset="100%" stopColor="#7CC957" />
        </linearGradient>
        <linearGradient id={verre} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".95" />
          <stop offset="100%" stopColor="#DFF3FF" stopOpacity=".55" />
        </linearGradient>
        <linearGradient id={bouchon} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD98A" />
          <stop offset="100%" stopColor="#E0A03C" />
        </linearGradient>
      </defs>
      <path
        d="M26 8h12v18l12 20a8 8 0 0 1-7 12H21a8 8 0 0 1-7-12l12-20V8z"
        fill={`url(#${verre})`}
        stroke="#8FD46A"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M19.5 40h25l5.5 6a8 8 0 0 1-7 12H21a8 8 0 0 1-7-12l5.5-6z" fill={`url(#${fiole})`} />
      <circle cx="27" cy="49" r="2.4" fill="#fff" opacity=".75" />
      <circle cx="37" cy="46" r="1.6" fill="#fff" opacity=".6" />
      <circle cx="33" cy="53" r="1.2" fill="#fff" opacity=".5" />
      <rect x="23" y="4" width="18" height="7" rx="3.5" fill={`url(#${bouchon})`} />
    </svg>
  );
}

const BetaButton = React.forwardRef<HTMLElement, BetaButtonProps>(function BetaButton(
  { onReport, href, chipLabel = "Bêta", label = "Signaler un bug", className = "" },
  ref,
) {
  const classes = ["kbeta", chipLabel ? "" : "kbeta--nue", className].filter(Boolean).join(" ");
  const contenu = (
    <>
      {chipLabel && (
        <span className="kbeta-chip">
          <FioleIcon />
          {chipLabel}
        </span>
      )}
      <span className="kbeta-txt">{label}</span>
    </>
  );

  if (href) {
    return (
      <a ref={ref as React.Ref<HTMLAnchorElement>} href={href} className={classes}>
        {contenu}
      </a>
    );
  }
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type="button" onClick={onReport} className={classes}>
      {contenu}
    </button>
  );
});

/* La fiole est exposée à part : la fenêtre de signalement reprend le même
   sticker en tête, et c'est ce qui relie visuellement le bouton à ce qui
   s'ouvre. */
export { FioleIcon };
export default BetaButton;
