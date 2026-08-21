"use client";

/* Widget de la phase d'ouverture : rappelle que Klip est en bêta et permet de
   signaler un bug depuis n'importe quelle page de l'app.

   Il est volontairement FLOTTANT et non pas en bandeau haut : les pages de
   l'app n'ont pas de layout commun (seules 6 sur 17 utilisent `.work`), un
   bandeau fixe en haut décalerait la moitié de l'application.

   L'habillage est en CSS (`.kbf-*` dans globals.css), pas en style en ligne :
   la fenêtre partage l'écriture de la pastille — sticker vert, titre en oaks,
   aplats sans filet — et un attribut style ne sait écrire ni le survol, ni le
   focus clavier, ni le respect de « moins d'animations ». */

import { useEffect, useRef, useState } from "react";
import BetaButton, { FioleIcon } from "@/components/BetaButton";

const SEEN_KEY = "klip-beta-intro-vu";

/* Hauteur occupée par ce widget dans le coin bas-droit, publiée sur <html>.
   Les autres flottants du même coin (prise en main) s'empilent au-dessus en
   lisant cette variable : la pastille de signalement est présente sur les dix-
   sept pages, c'est donc elle qui tient le bas de la pile, et personne n'a
   besoin de connaître la taille de personne. */
const DOCK_VAR = "--klip-dock-bas";
/* Hauteur de la seule pastille : la carte d'accueil s'appuie dessus pour se
   poser juste au-dessus, sans la recouvrir. */
const PASTILLE_VAR = "--klip-dock-pastille";
/* Largeur occupée dans le coin, écart compris. Ce qui partage ce coin sans
   être empilable (le bouton de l'assistant visuel) se décale vers la GAUCHE
   d'autant, au lieu de se poser par-dessus la pastille. Mesurée aussi : le
   libellé change de langue, et la pastille perd son étiquette en sortie de
   bêta. */
const LARGEUR_VAR = "--klip-dock-largeur";

type Kind = "bug" | "idee" | "autre";

const KINDS: { v: Kind; l: string }[] = [
  { v: "bug", l: "Un bug" },
  { v: "idee", l: "Une idée" },
  { v: "autre", l: "Autre chose" },
];

/* Ce que chaque genre demande. Le titre change avec le genre choisi : on ne
   pose pas « qu'est-ce qui s'est passé » à quelqu'un qui propose une idée. */
const VOIX: Record<Kind, { titre: string; sous: string; exemple: string }> = {
  bug: {
    titre: "Qu’est-ce qui s’est passé ?",
    sous: "Dites-nous ce que vous faisiez et ce que Klip a fait à la place. C’est corrigé au fil de l’eau.",
    exemple: "Le bouton « Générer » ne répond plus depuis que j’ai importé une image en AVIF…",
  },
  idee: {
    titre: "Qu’est-ce qui vous manque ?",
    sous: "Les idées des premiers utilisateurs décident de ce qu’on construit ensuite.",
    exemple: "J’aimerais pouvoir dupliquer un modèle d’un client vers un autre…",
  },
  autre: {
    titre: "On vous écoute.",
    sous: "Une question, un doute, un truc qui vous a fait tiquer : tout se dit ici.",
    exemple: "Je ne comprends pas ce que fait le bouton « Charte » dans l’atelier…",
  },
};

function IconeCroix() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function IconeLien() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </svg>
  );
}

function IconeCoche() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12.5l5.5 5.5L20 6.5" />
    </svg>
  );
}

export default function BetaFeedback() {
  const [intro, setIntro] = useState(false);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* Le chemin réel de la page, pour l'afficher plutôt que de le promettre. Il
     n'est lu qu'à l'ouverture : le rendu serveur ne connaît pas l'URL. */
  const [chemin, setChemin] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const pastilleRef = useRef<HTMLElement>(null);
  const introRef = useRef<HTMLDivElement>(null);

  // Carte d'introduction : une seule fois par navigateur.
  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setIntro(true);
    } catch { /* mode privé : on n'insiste pas */ }
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => areaRef.current?.focus(), 60);
  }, [open]);

  // Publie la hauteur réellement occupée (pastille, plus la carte d'accueil
  // quand elle est là). Mesurée, pas devinée : le libellé peut passer sur deux
  // lignes en écran étroit, et la carte change de hauteur avec la traduction.
  useEffect(() => {
    const racine = document.documentElement;
    const publier = () => {
      const p = pastilleRef.current?.offsetHeight ?? 0;
      const l = pastilleRef.current?.offsetWidth ?? 0;
      const i = introRef.current?.offsetHeight ?? 0;
      const h = BAS + p + (i ? ECART + i : 0);
      racine.style.setProperty(DOCK_VAR, `${h}px`);
      if (p) racine.style.setProperty(PASTILLE_VAR, `${p}px`);
      racine.style.setProperty(LARGEUR_VAR, l ? `${l + ECART}px` : "0px");
    };
    publier();
    const ro = new ResizeObserver(publier);
    if (pastilleRef.current) ro.observe(pastilleRef.current);
    if (introRef.current) ro.observe(introRef.current);
    window.addEventListener("resize", publier);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", publier);
      racine.style.removeProperty(DOCK_VAR);
      racine.style.removeProperty(PASTILLE_VAR);
      racine.style.removeProperty(LARGEUR_VAR);
    };
  }, [intro, open]);

  // Échap ferme la fenêtre.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function dismissIntro() {
    setIntro(false);
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
  }

  function openForm() {
    dismissIntro();
    setDone(false);
    setErr(null);
    setChemin(typeof window !== "undefined" ? window.location.pathname : "");
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) { setErr("Décrivez le problème en quelques mots."); return; }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          message,
          pageUrl: typeof window !== "undefined" ? window.location.href : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Erreur");
      setDone(true);
      setMessage("");
    } catch (e2) {
      setErr(e2 instanceof Error && e2.message !== "Erreur" ? e2.message : "L'envoi a échoué. Réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  const voix = VOIX[kind];

  /* Le sticker vert de la pastille, réutilisé tel quel en tête de fenêtre :
     c'est lui qui fait le lien entre le bouton cliqué et ce qui s'ouvre. */
  const sticker = (
    <span className="kbeta-chip">
      <FioleIcon />
      Phase d’ouverture
    </span>
  );

  return (
    <>
      {/* ── Carte d'accueil bêta (une fois) ── */}
      {intro && !open && (
        <div ref={introRef} className="kbf-intro" role="status">
          <div className="kbf-tete" style={{ padding: 0 }}>
            {sticker}
            <button onClick={dismissIntro} aria-label="Fermer" className="kbf-x"><IconeCroix /></button>
          </div>
          <h2 className="kbf-intro-titre">Vous êtes parmi les premiers.</h2>
          <p className="kbf-intro-texte">
            Klip vient d’ouvrir : il reste forcément des bugs. Signalez-les, on les corrige au fil
            de l’eau. C’est ce qui rendra l’outil meilleur pour tout le monde.
          </p>
          <button onClick={openForm} className="kbf-btn kbf-btn--vert">Signaler un bug</button>
        </div>
      )}

      {/* ── Pastille permanente ── */}
      {!open && (
        <BetaButton ref={pastilleRef} className="kbeta-dock" onReport={openForm} />
      )}

      {/* ── Fenêtre de signalement ── */}
      {open && (
        <div className="kbf-fond" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="kbf-carte" role="dialog" aria-modal="true" aria-label="Signaler un problème">
            <div className="kbf-tete">
              {sticker}
              <button onClick={() => setOpen(false)} aria-label="Fermer" className="kbf-x"><IconeCroix /></button>
            </div>

            {done ? (
              <>
                <div className="kbf-corps kbf-ok">
                  <div className="kbf-ok-pastille"><IconeCoche /></div>
                  <h2 className="kbf-titre">Merci, c’est parti.</h2>
                  <p className="kbf-sous">
                    Le signalement est arrivé avec la page où vous étiez. On corrige au plus vite,
                    et si besoin on vous recontacte.
                  </p>
                </div>
                <div className="kbf-pied">
                  <button onClick={() => setDone(false)} className="kbf-btn kbf-btn--fantome">Signaler autre chose</button>
                  <button onClick={() => setOpen(false)} className="kbf-btn kbf-btn--vert">Fermer</button>
                </div>
              </>
            ) : (
              <form onSubmit={submit} style={{ display: "contents" }}>
                <div className="kbf-corps">
                  <h2 className="kbf-titre">{voix.titre}</h2>
                  <p className="kbf-sous">{voix.sous}</p>

                  <div className="kbf-genres">
                    {KINDS.map(k => (
                      <button
                        key={k.v}
                        type="button"
                        onClick={() => setKind(k.v)}
                        aria-pressed={kind === k.v}
                        className="kbf-genre"
                      >
                        {k.l}
                      </button>
                    ))}
                  </div>

                  <textarea
                    ref={areaRef}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={5}
                    placeholder={voix.exemple}
                    className="kbf-champ"
                  />
                  <p className="kbf-joint">
                    <IconeLien />
                    Joint automatiquement <code>{chemin || "/"}</code>
                  </p>

                  {err && <p className="kbf-err">{err}</p>}
                </div>

                <div className="kbf-pied">
                  <button type="button" onClick={() => setOpen(false)} className="kbf-btn kbf-btn--fantome">Annuler</button>
                  <button type="submit" disabled={busy} className="kbf-btn kbf-btn--vert">
                    {busy ? "Envoi…" : "Envoyer"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* Géométrie du coin bas-droit, partagée par la pastille et la carte d'accueil. */
const BAS = 18;    // marge au bord de la fenêtre
const ECART = 10;  // espace entre deux éléments empilés
