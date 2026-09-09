"use client";

/* Questionnaire de marque du parcours d'essai.
 *
 * Ce qui arrive de l'analyse est DÉJÀ posé : le rôle de cet écran n'est pas de
 * faire remplir un formulaire, c'est de faire relire ce qu'on a trouvé. Les
 * réponses devinées portent une pastille « pré-rempli » et sont sélectionnées
 * d'avance, donc on peut enchaîner en cliquant « Continuer » sans rien saisir.
 *
 * Les libellés (secteurs, tons et leurs descriptions) sont ceux du produit,
 * repris de `messages/fr.json`. Pas de nouvelle liste inventée.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingShell from "@/components/OnboardingShell";
import { lireDraft, ecrireDraft, type OnbDraft } from "@/lib/onboardingDraft";

const SECTEURS = ["Restaurant", "Café", "Retail", "Mode", "Beauté", "Sport", "Tech", "Autre"];

const TONS = [
  { v: "Chic", d: "Élégant, raffiné, haut de gamme" },
  { v: "Punchy", d: "Direct, percutant, accrocheur" },
  { v: "Minimal", d: "Épuré, sobre, essentiel" },
  { v: "Chaleureux", d: "Proche, humain, convivial" },
  { v: "Direct", d: "Clair, sans détour, efficace" },
  { v: "Doux", d: "Délicat, rassurant, bienveillant" },
];

const ORIGINES = ["Instagram", "Recherche Google", "ChatGPT ou une autre IA", "Un proche", "Une publicité", "Autre"];

type Rep = { secteur: string; ton: string; nom: string; handle: string; description: string; origine: string };

/* Un titre, une phrase, et rien d'autre. Les sous-titres d'origine décrivaient
   le fonctionnement interne (« oriente les compositions proposées », « dans
   chaque description générée ») : personne n'a besoin de ça pour répondre, et
   c'est ce qui donnait le ton de notice. */
const TITRES: { titre: React.ReactNode; sub: string }[] = [
  { titre: <>Vous faites <span className="acc-hl">quoi</span> ?</>, sub: "Choisissez ce qui s'en rapproche le plus." },
  { titre: <>Vous parlez <span className="acc-hl">comment</span> ?</>, sub: "C'est le ton de vos descriptions." },
  { titre: <>Votre <span className="acc-hl">nom</span></>, sub: "Il signera vos visuels." },
  { titre: <>En deux <span className="acc-hl">mots</span></>, sub: "Ce que vous faites, sans soigner le style." },
  { titre: <>Vous nous avez <span className="acc-hl">connus</span> comment ?</>, sub: "Pour savoir ce qui marche de notre côté." },
];

export default function QuestionnairePage() {
  const router = useRouter();
  const [draft, setDraft] = useState<OnbDraft | null>(null);
  const [pret, setPret] = useState(false);
  const [i, setI] = useState(0);
  const [r, setR] = useState<Rep>({ secteur: "", ton: "", nom: "", handle: "", description: "", origine: "" });

  // Le brouillon vient de l'écran précédent. Sans lui on laisse le
  // questionnaire vide plutôt que de renvoyer la personne en arrière.
  useEffect(() => {
    const d = lireDraft();
    if (d) {
      setDraft(d);
      setR({
        secteur: SECTEURS.includes(d.sector ?? "") ? d.sector! : "",
        ton: TONS.some(t => t.v === d.tone) ? d.tone! : "",
        nom: d.name ?? "",
        handle: d.handle ?? "",
        description: d.description ?? "",
        origine: "",
      });
    }
    setPret(true);
  }, []);

  const auto = (cle: string) => draft?.prefilled.includes(cle) ?? false;

  const peutContinuer =
    i === 0 ? !!r.secteur :
    i === 1 ? !!r.ton :
    i === 2 ? r.nom.trim().length > 0 :
    i === 3 ? true :
    !!r.origine;

  function continuer() {
    if (i < TITRES.length - 1) { setI(i + 1); return; }
    ecrireDraft({
      ...(draft ?? { source: "manuel", prefilled: [] }),
      name: r.nom, handle: r.handle, sector: r.secteur, tone: r.ton, description: r.description,
    });
    router.push("/onboarding/marque");
  }

  if (!pret) return <OnboardingShell><div style={{ height: 320 }} /></OnboardingShell>;

  const zoneBasse = (
    <div className="ob-pied">
      <button className="ob-retour" onClick={() => setI(i - 1)} disabled={i === 0}>Retour</button>
      <button className="ob-suite" onClick={continuer} disabled={!peutContinuer}>
        {i === TITRES.length - 1 ? "Voir ma charte" : "Continuer"}
      </button>
    </div>
  );

  return (
    <OnboardingShell bas={zoneBasse}>
      <h1 className="ob-h1">{TITRES[i].titre}</h1>
      <p className="ob-sub">{TITRES[i].sub}</p>

      {i === 0 && (
        <div className="ob-chips">
          {SECTEURS.map(s => (
            <button key={s} type="button" className={"ob-chip" + (r.secteur === s ? " is-on" : "")}
              onClick={() => setR({ ...r, secteur: s })}>
              {s}
              {auto("sector") && draft?.sector === s && <span className="ob-auto">trouvé</span>}
            </button>
          ))}
        </div>
      )}

      {i === 1 && (
        <div className="ob-blocs">
          {TONS.map(t => (
            <button key={t.v} type="button" className={"ob-bloc" + (r.ton === t.v ? " is-on" : "")}
              onClick={() => setR({ ...r, ton: t.v })}>
              {auto("tone") && draft?.tone === t.v && <span className="ob-auto">trouvé</span>}
              <span className="ob-bloc-l">{t.v}</span>
              <div className="ob-bloc-d">{t.d}</div>
            </button>
          ))}
        </div>
      )}

      {i === 2 && (
        <>
          <div className="ob-saisie">
            <span className="ob-saisie-l">Nom de la marque</span>
            {auto("name") && <span className="ob-auto" style={{ top: 13, right: 15 }}>trouvé</span>}
            <input className="ob-in" value={r.nom} onChange={e => setR({ ...r, nom: e.target.value })}
              placeholder="Ex : Café Lumière, Studio Nova…" />
          </div>
          <div className="ob-saisie">
            <span className="ob-saisie-l">Compte Instagram — facultatif</span>
            <input className="ob-in" value={r.handle}
              onChange={e => setR({ ...r, handle: e.target.value.replace(/^@/, "") })}
              placeholder="nomdemarque" />
          </div>
        </>
      )}

      {i === 3 && (
        <div className="ob-saisie">
          <span className="ob-saisie-l">Description</span>
          {auto("description") && <span className="ob-auto" style={{ top: 13, right: 15 }}>trouvé</span>}
          <textarea className="ob-in ob-ta" rows={5} value={r.description}
            onChange={e => setR({ ...r, description: e.target.value })}
            placeholder="Ex : Café de spécialité dans le quartier des arts, connu pour son ambiance chaleureuse et ses recettes maison…" />
        </div>
      )}

      {i === 4 && (
        <div className="ob-chips">
          {ORIGINES.map(o => (
            <button key={o} type="button" className={"ob-chip" + (r.origine === o ? " is-on" : "")}
              onClick={() => setR({ ...r, origine: o })}>
              {o}
            </button>
          ))}
        </div>
      )}

      {draft?.demo && i === 0 && (
        <p className="ob-fin">Valeurs d&apos;exemple : la lecture réelle demande une session ouverte.</p>
      )}
    </OnboardingShell>
  );
}
