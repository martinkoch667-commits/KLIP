"use client";

/* Widget de la phase d'ouverture : rappelle que Klip est en bêta et permet de
   signaler un bug depuis n'importe quelle page de l'app.

   Il est volontairement FLOTTANT et non pas en bandeau haut : les pages de
   l'app n'ont pas de layout commun (seules 6 sur 17 utilisent `.work`), un
   bandeau fixe en haut décalerait la moitié de l'application.

   Le signalement s'écrit dans un VOLET du coin bas-droit, pas dans une fenêtre
   centrée : décrire un bug demande de le regarder. Une modale sur fond noirci
   cachait précisément l'écran que la personne voulait décrire, et forçait à
   fermer/rouvrir pour vérifier un détail. Ici le plan de travail reste
   visible, et le volet ne se ferme que si on le lui demande.

   L'habillage est en CSS (`.kbf-*` dans globals.css), pas en style en ligne :
   un attribut style ne sait écrire ni le survol, ni le focus clavier, ni le
   respect de « moins d'animations ». */

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
/* Largeur occupée dans le coin, écart compris — celle de la pastille, ou celle
   du volet quand il est ouvert. Ce qui partage ce coin sans être empilable
   (le bouton de l'assistant visuel, son volet) se décale d'autant vers la
   GAUCHE au lieu de se poser par-dessus. Mesurée : le libellé change de
   langue, et la pastille perd son étiquette en sortie de bêta. */
const LARGEUR_VAR = "--klip-dock-largeur";
/* Marqueur d'ouverture : en écran étroit, il n'y a pas la place pour deux
   objets côte à côte, l'assistant s'efface le temps du signalement. */
const OUVERT_ATTR = "data-klip-signalement";

/* Durée de l'animation de sortie (cf. `.kbf-volet.est-parti`). */
const SORTIE_MS = 160;

type Kind = "bug" | "idee" | "autre";

function IconeBug() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6a4 4 0 0 1 8 0" /><rect x="7" y="8" width="10" height="12" rx="5" />
      <path d="M7 12H3M21 12h-4M7 17l-3 2M17 17l3 2M7 9L4 7M17 9l3-2" />
    </svg>
  );
}
function IconeIdee() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.4.3.6.8.6 1.2h6c0-.4.2-.9.6-1.2A6 6 0 0 0 12 3z" />
    </svg>
  );
}
function IconeAutre() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-5A8 8 0 1 1 21 11.5z" />
    </svg>
  );
}
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

/* Ce que chaque genre demande. Le titre et l'exemple suivent le genre choisi :
   on ne pose pas « qu'est-ce qui s'est passé » à quelqu'un qui propose une
   idée. C'est le titre qui tient lieu d'intitulé de champ — un volet de trois
   éléments n'a pas besoin qu'on nomme chacun d'eux. */
const GENRES: {
  v: Kind; l: string; icone: () => React.ReactElement;
  titre: string; sous: string; exemple: string;
}[] = [
  {
    v: "bug", l: "Un bug", icone: IconeBug,
    titre: "Qu’est-ce qui s’est passé ?",
    sous: "Klip est en début d’ouverture. Chaque bug remonté est corrigé au fil de l’eau.",
    exemple: "Le bouton « Générer » ne répond plus depuis que j’ai importé une image en AVIF…",
  },
  {
    v: "idee", l: "Une idée", icone: IconeIdee,
    titre: "Qu’est-ce qui vous manque ?",
    sous: "Les idées des premiers utilisateurs décident de ce qu’on construit ensuite.",
    exemple: "J’aimerais dupliquer un modèle d’un client vers un autre…",
  },
  {
    v: "autre", l: "Autre chose", icone: IconeAutre,
    titre: "On vous écoute.",
    sous: "Une question, un doute, un truc qui vous a fait tiquer : tout se dit ici.",
    exemple: "Je ne comprends pas ce que fait le bouton « Charte » dans l’atelier…",
  },
];

export default function BetaFeedback() {
  const [intro, setIntro] = useState(false);
  const [open, setOpen] = useState(false);
  const [sortie, setSortie] = useState(false);
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /* Le chemin réel de la page, pour l'afficher plutôt que de le promettre. Lu
     à l'ouverture : le rendu serveur ne connaît pas l'URL. */
  const [chemin, setChemin] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const pastilleRef = useRef<HTMLElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const voletRef = useRef<HTMLDivElement>(null);

  // Carte d'introduction : une seule fois par navigateur.
  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setIntro(true);
    } catch { /* mode privé : on n'insiste pas */ }
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => areaRef.current?.focus(), 60);
  }, [open]);

  // Publie la place réellement occupée dans le coin (pastille, carte d'accueil,
  // volet). Mesurée, pas devinée : le libellé peut passer sur deux lignes en
  // écran étroit, et la carte change de hauteur avec la traduction.
  useEffect(() => {
    const racine = document.documentElement;
    const publier = () => {
      const p = pastilleRef.current?.offsetHeight ?? 0;
      const i = introRef.current?.offsetHeight ?? 0;
      const h = BAS + p + (i ? ECART + i : 0);
      racine.style.setProperty(DOCK_VAR, `${h}px`);
      if (p) racine.style.setProperty(PASTILLE_VAR, `${p}px`);
      // Le volet remplace la pastille dans le coin : c'est lui qui donne la
      // largeur à contourner tant qu'il est ouvert.
      const l = voletRef.current?.offsetWidth ?? pastilleRef.current?.offsetWidth ?? 0;
      racine.style.setProperty(LARGEUR_VAR, l ? `${l + ECART}px` : "0px");
    };
    publier();
    const ro = new ResizeObserver(publier);
    if (pastilleRef.current) ro.observe(pastilleRef.current);
    if (introRef.current) ro.observe(introRef.current);
    if (voletRef.current) ro.observe(voletRef.current);
    window.addEventListener("resize", publier);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", publier);
      racine.style.removeProperty(DOCK_VAR);
      racine.style.removeProperty(PASTILLE_VAR);
      racine.style.removeProperty(LARGEUR_VAR);
    };
  }, [intro, open]);

  // Marqueur d'ouverture, lu par le CSS (assistant visuel en écran étroit).
  useEffect(() => {
    const racine = document.documentElement;
    if (open) racine.setAttribute(OUVERT_ATTR, "ouvert");
    else racine.removeAttribute(OUVERT_ATTR);
    return () => racine.removeAttribute(OUVERT_ATTR);
  }, [open]);

  // Échap ferme le volet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") fermer(); };
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
    setSortie(false);
    setChemin(typeof window !== "undefined" ? window.location.pathname : "");
    setOpen(true);
  }

  /* Fermeture en deux temps : l'animation de sortie a besoin que le volet
     reste monté le temps de se replier vers la pastille. */
  function fermer() {
    setSortie(true);
    setTimeout(() => { setOpen(false); setSortie(false); }, SORTIE_MS);
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

  const genre = GENRES.find(g => g.v === kind)!;

  /* Le sticker vert de la pastille, repris en tête du volet : c'est lui qui
     relie le bouton cliqué à ce qui s'ouvre. */
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
          <div className="kbf-tete">
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

      {/* ── Volet de signalement ──
          Pas de fond noirci, pas de `aria-modal` : le reste de la page continue
          d'exister, et c'est tout l'intérêt. */}
      {open && (
        <div ref={voletRef} className={"kbf-volet" + (sortie ? " est-parti" : "")}
          role="dialog" aria-label="Signaler un problème">
          <button onClick={fermer} aria-label="Fermer" className="kbf-x kbf-x--flottant"><IconeCroix /></button>

          {done ? (
            <>
              <div className="kbf-ok">
                <div className="kbf-ok-pastille"><IconeCoche /></div>
                <h2 className="kbf-titre">Merci, c’est parti.</h2>
                <p className="kbf-sous">
                  Le signalement est arrivé avec la page où vous étiez. On corrige au plus vite,
                  et si besoin on vous recontacte.
                </p>
              </div>
              <div className="kbf-pied kbf-pied--ok">
                <button onClick={() => setDone(false)} className="kbf-btn kbf-btn--fantome">Autre chose</button>
                <button onClick={fermer} className="kbf-btn kbf-btn--vert">Fermer</button>
              </div>
            </>
          ) : (
            <form onSubmit={submit} style={{ display: "contents" }}>
              <div className="kbf-corps">
                <h2 className="kbf-titre">{genre.titre}</h2>
                <p className="kbf-sous">{genre.sous}</p>

                <div className="kbf-genres">
                  {GENRES.map(g => {
                    const Icone = g.icone;
                    return (
                      <button
                        key={g.v}
                        type="button"
                        onClick={() => setKind(g.v)}
                        aria-pressed={kind === g.v}
                        className="kbf-genre"
                      >
                        <Icone />
                        {g.l}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  ref={areaRef}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={5}
                  placeholder={genre.exemple}
                  className="kbf-champ"
                />
                <p className="kbf-joint">
                  <IconeLien />
                  Joint automatiquement <code>{chemin || "/"}</code>
                </p>
                {err && <p className="kbf-err">{err}</p>}
              </div>

              <div className="kbf-pied">
                <button type="button" onClick={fermer} className="kbf-btn kbf-btn--fantome">Annuler</button>
                <button type="submit" disabled={busy} className="kbf-btn kbf-btn--vert">
                  {busy ? "Envoi…" : "Envoyer"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}

/* Géométrie du coin bas-droit, partagée par la pastille et la carte d'accueil. */
const BAS = 18;    // marge au bord de la fenêtre
const ECART = 10;  // espace entre deux éléments empilés
