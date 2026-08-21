"use client";

/* Widget de la phase d'ouverture : rappelle que Klip est en bêta et permet de
   signaler un bug depuis n'importe quelle page de l'app.

   Il est volontairement FLOTTANT et non pas en bandeau haut : les pages de
   l'app n'ont pas de layout commun (seules 6 sur 17 utilisent `.work`), un
   bandeau fixe en haut décalerait la moitié de l'application. */

import { useEffect, useRef, useState } from "react";
import BetaButton from "@/components/BetaButton";

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

type Kind = "bug" | "idee" | "autre";

const KINDS: { v: Kind; l: string }[] = [
  { v: "bug", l: "Un bug" },
  { v: "idee", l: "Une idée" },
  { v: "autre", l: "Autre chose" },
];

export default function BetaFeedback() {
  const [intro, setIntro] = useState(false);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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
      const i = introRef.current?.offsetHeight ?? 0;
      const h = BAS + p + (i ? ECART + i : 0);
      racine.style.setProperty(DOCK_VAR, `${h}px`);
      if (p) racine.style.setProperty(PASTILLE_VAR, `${p}px`);
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

  return (
    <>
      {/* ── Carte d'accueil bêta (une fois) ── */}
      {intro && !open && (
        <div ref={introRef} style={S.intro} role="status">
          <div style={S.introTop}>
            <span style={S.badge}>Phase d’ouverture</span>
            <button onClick={dismissIntro} aria-label="Fermer" style={S.close}>×</button>
          </div>
          <p style={S.introText}>
            Klip vient d’ouvrir et vous faites partie des premiers à l’utiliser. Il reste
            forcément des bugs&nbsp;: <strong>signalez-les</strong>, on les corrige au fil de l’eau —
            c’est ce qui rendra l’outil meilleur pour tout le monde.
          </p>
          <button onClick={openForm} style={S.introBtn}>Signaler un bug</button>
        </div>
      )}

      {/* ── Pastille permanente ── */}
      {!open && (
        <BetaButton ref={pastilleRef} className="kbeta-dock" onReport={openForm} />
      )}

      {/* ── Fenêtre de signalement ── */}
      {open && (
        <div style={S.backdrop} onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={S.modal} role="dialog" aria-modal="true" aria-label="Signaler un problème">
            <div style={S.introTop}>
              <span style={S.badge}>Phase d’ouverture</span>
              <button onClick={() => setOpen(false)} aria-label="Fermer" style={S.close}>×</button>
            </div>

            {done ? (
              <div style={{ padding: "8px 0 4px" }}>
                <h2 style={S.h2}>Merci, c’est envoyé.</h2>
                <p style={S.text}>
                  Le signalement est arrivé avec la page où vous étiez. On corrige au plus vite —
                  et si besoin, on vous recontacte.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                  <button onClick={() => setDone(false)} style={S.ghost}>Signaler autre chose</button>
                  <button onClick={() => setOpen(false)} style={S.submit}>Fermer</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h2 style={S.h2}>Qu’est-ce qui s’est passé&nbsp;?</h2>
                <p style={S.text}>
                  Klip est en début d’ouverture. Chaque bug remonté est corrigé au fil de l’eau.
                </p>

                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "16px 0 14px" }}>
                  {KINDS.map(k => (
                    <button
                      key={k.v}
                      type="button"
                      onClick={() => setKind(k.v)}
                      aria-pressed={kind === k.v}
                      style={{ ...S.chip, ...(kind === k.v ? S.chipOn : null) }}
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
                  placeholder="Le bouton « Générer » ne répond plus depuis que j’ai importé une image en AVIF…"
                  style={S.area}
                />
                <p style={S.hint}>La page où vous vous trouvez est jointe automatiquement.</p>

                {err && <p style={S.err}>{err}</p>}

                <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setOpen(false)} style={S.ghost}>Annuler</button>
                  <button type="submit" disabled={busy} style={{ ...S.submit, opacity: busy ? .6 : 1 }}>
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

/* ── Styles (tokens du design system) ─────────────────────────────────────── */

/* Géométrie du coin bas-droit, partagée par la pastille et la carte d'accueil. */
const BAS = 18;    // marge au bord de la fenêtre
const ECART = 10;  // espace entre deux éléments empilés

const S: Record<string, React.CSSProperties> = {
  intro: {
    position: "fixed", right: BAS, bottom: `calc(${BAS + ECART}px + var(--klip-dock-pastille, 38px))`, zIndex: 900, width: 310,
    background: "var(--card)", borderRadius: "var(--r-l)", padding: "14px 16px 16px",
    border: "1px solid var(--line-2)",
    boxShadow: "0 26px 54px -30px rgba(16,19,11,.5)",
    fontFamily: "var(--sans)",
  },
  introTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  introText: { margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--ink-2)" },
  introBtn: {
    marginTop: 13, width: "100%", background: "var(--leaf)", color: "var(--leaf-ink)",
    fontFamily: "var(--sans)", fontWeight: 700, fontSize: 13, padding: "9px 14px",
    borderRadius: "var(--r-btn)", border: "none", cursor: "pointer",
  },

  badge: {
    display: "inline-flex", alignItems: "center",
    background: "var(--leaf)", color: "var(--leaf-ink)",
    fontSize: 11, fontWeight: 800, letterSpacing: ".02em",
    padding: "4px 9px", borderRadius: 999,
  },
  close: {
    background: "transparent", border: "none", cursor: "pointer",
    fontSize: 20, lineHeight: 1, color: "var(--ink-3)", padding: "0 2px",
  },

  backdrop: {
    position: "fixed", inset: 0, zIndex: 9000,
    background: "rgba(13,15,10,.42)", backdropFilter: "blur(2px)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
  },
  modal: {
    width: "100%", maxWidth: 470, background: "var(--card)",
    borderRadius: "var(--r-xl)", padding: "16px 20px 20px",
    border: "1px solid var(--line-2)", boxShadow: "0 40px 80px -40px rgba(16,19,11,.6)",
    fontFamily: "var(--sans)", maxHeight: "90vh", overflowY: "auto",
  },
  h2: { margin: "4px 0 6px", fontFamily: "var(--display)", fontSize: 21, letterSpacing: "-.025em", color: "var(--ink)", fontWeight: 800 },
  text: { margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)" },
  hint: { margin: "8px 0 0", fontSize: 12, color: "var(--ink-3)" },

  chip: {
    fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
    padding: "7px 13px", borderRadius: 999,
    border: "1px solid var(--line)", background: "var(--paper)", color: "var(--ink-2)",
    cursor: "pointer",
  },
  chipOn: { background: "var(--leaf)", color: "var(--leaf-ink)", borderColor: "transparent" },

  area: {
    width: "100%", padding: "12px 14px", borderRadius: "var(--r-s)",
    background: "var(--card)", border: "1px solid var(--line)",
    fontFamily: "inherit", fontSize: 14, lineHeight: 1.6, color: "var(--ink)",
    resize: "vertical", boxSizing: "border-box",
  },
  err: {
    margin: "12px 0 0", fontSize: 13, lineHeight: 1.5,
    color: "var(--leaf-ink)", background: "var(--sunk)",
    borderRadius: "var(--r-s)", padding: "10px 12px",
  },

  ghost: {
    fontFamily: "inherit", fontWeight: 700, fontSize: 13,
    padding: "9px 15px", borderRadius: "var(--r-btn)",
    background: "transparent", color: "var(--ink)",
    border: "1px solid var(--line)", cursor: "pointer",
  },
  submit: {
    fontFamily: "inherit", fontWeight: 700, fontSize: 13,
    padding: "9px 17px", borderRadius: "var(--r-btn)",
    background: "var(--leaf)", color: "var(--leaf-ink)",
    border: "none", cursor: "pointer",
  },
};
