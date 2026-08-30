"use client";

/* ─────────────────────────────────────────────────────────────────────────────
   Fiche — la fenêtre de KLIP.

   Une feuille de papier posée sur le plan de travail. Elle ne assombrit rien :
   ce qu'il y a derrière reste net et lisible, seule l'ombre de contact et
   l'inclinaison disent qu'elle est au-dessus. C'est la seule primitive de
   fenêtre de l'app — avant elle, chaque écran réécrivait son propre voile,
   sa propre échappée au clavier et sa propre animation, treize fois.

   Le composant ne s'occupe que du comportement : le portail, la touche Échap,
   le clic à côté, le verrou de défilement et le retour du focus. L'habillage
   vit dans globals.css, section « Fiche » (.fiche-title, .fiche-field, etc.).
   ────────────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Lu par les lecteurs d'écran. Reprendre le titre visible de la fiche. */
  label: string;
  children: ReactNode;
  /** Bibliothèques et galeries : grande feuille, posée d'équerre. */
  large?: boolean;
  /** Le scotch, seulement là où la feuille a un bord libre. */
  tape?: boolean;
  /** Une croix dans l'angle, quand le pied n'offre pas déjà de sortie. */
  closeButton?: boolean;
  /** Certaines fiches attendent une décision : le clic à côté ne suffit pas. */
  dismissable?: boolean;
  /** L'éditeur empile ses propres surfaces bien au-dessus de 900. */
  zIndex?: number;
  className?: string;
};

export default function Fiche({
  open,
  onClose,
  label,
  children,
  large = false,
  tape,
  closeButton = false,
  dismissable = true,
  zIndex,
  className = "",
}: Props) {
  const [mounted, setMounted] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  // Ce qui avait le focus avant l'ouverture, pour le lui rendre après.
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  /* onClose est presque toujours une fonction anonyme, donc recréée à chaque
     rendu. La mettre dans les dépendances de l'effet le faisait se rejouer sans
     cesse : le nettoyage rendait le focus, l'effet le reprenait aussitôt, et
     `restoreTo` finissait par pointer sur la fiche elle-même — retirée du DOM à
     la fermeture, le focus retombait donc sur <body>. On la garde dans une ref
     et l'effet ne dépend plus que de `open`. */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    sheet.current?.focus();

    // Le fond ne défile pas pendant qu'une fiche est posée dessus : sans ça,
    // la molette fait glisser le calendrier sous la feuille.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      restoreTo.current?.focus?.();
    };
  }, [open]);

  if (!open || !mounted) return null;

  // Le scotch par défaut sur les petites fiches ; une grande feuille n'a pas
  // de bord libre où le coller.
  const showTape = tape ?? !large;

  return createPortal(
    <div
      className="fiche-layer"
      style={zIndex ? { zIndex } : undefined}
      onMouseDown={e => {
        // Comparer à la cible évite de fermer quand un glisser commencé dans
        // la feuille se termine sur le fond (sélection de texte, curseurs).
        if (dismissable && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`fiche${large ? " fiche-l" : ""}${className ? " " + className : ""}`}
        style={{ outline: "none" }}
      >
        {showTape && <span className="fiche-tape" aria-hidden="true" />}
        {closeButton && (
          <button type="button" className="fiche-x" onClick={onClose} aria-label="Fermer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
