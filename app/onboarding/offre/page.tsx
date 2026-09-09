"use client";

/* Page d'offre — construite sur le croquis de Martin, à la lettre.
 *
 * LA COMPOSITION, relue sur le dessin :
 *  · l'écran est coupé par une DIAGONALE, pas par une colonne verticale ;
 *  · à gauche, sur fond clair : le titre en bandeau large, puis TROIS
 *    RECTANGLES VERTICAUX HAUTS, les offres, alignés et collés ;
 *  · à droite, une zone SOMBRE occupée par une grille de posts INCLINÉE, dont
 *    les gouttières claires dessinent le quadrillage ;
 *  · sur la diagonale, les pastilles vert clair des outils remplacés, qui
 *    descendent en escalier.
 *
 * Ce que j'avais livré avant ne gardait que la liste des ingrédients : deux
 * colonnes droites, des offres plates, un mur vertical. La diagonale et les
 * trois rectangles hauts sont justement ce qui fait la composition.
 *
 * Les visuels viennent de `public/vitrine/` s'il contient des fichiers (voir
 * son README), sinon ils sont composés à la volée par la chaîne de production
 * avec la charte validée à l'écran précédent.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import { LAUNCH_OFFER, launchApplies, launchPrice, formatPrice } from "@/lib/launch-offer";
import { DESIGN_RECIPES, buildDesignElements, effectiveMax } from "@/lib/designSystem";
import { renderTemplateVisual } from "@/lib/composeRender";
import { lireDraft } from "@/lib/onboardingDraft";

const PHOTOS = [
  "/banc-photos/produit-sombre-1.jpg",
  "/banc-photos/produit-carre.jpg",
  "/banc-photos/studio-box.jpg",
  "/banc-photos/ugc-mains.jpg",
  "/banc-photos/produit-sombre-2.jpg",
  "/banc-photos/ugc-visage.jpg",
];

const MESSAGES = [
  { frags: ["Ce soir", "Ouvert ce soir", "La cuisine reste ouverte jusqu'à 23 h"], prix: "12 €" },
  { frags: ["Nouveau", "La carte change", "De nouveaux plats chaque semaine"], prix: "8,50 €" },
  { frags: ["Maison", "Fait maison", "Préparé sur place tous les matins"], prix: "14 €" },
  { frags: ["Complet ?", "Trois places", "Il reste de la place ce week-end"], prix: "19 €" },
  { frags: ["Dimanche", "On ouvre le dimanche", "Service continu de 11 h à 22 h"], prix: "16 €" },
  { frags: ["Retour", "Le retour du best", "Votre préféré revient à la carte"], prix: "11 €" },
];

/** Mêmes outils et mêmes tarifs que la section comparaison de la landing. */
const OUTILS = [
  { nom: "Canva", cout: 12, domaine: "canva.com" },
  { nom: "CapCut", cout: 15, domaine: "capcut.com" },
  { nom: "ChatGPT", cout: 23, domaine: "chatgpt.com" },
  { nom: "Metricool", cout: 25, domaine: "metricool.com" },
  { nom: "WeTransfer", cout: 10, domaine: "wetransfer.com" },
];
const TOTAL = OUTILS.reduce((s, o) => s + o.cout, 0);

const OFFRES = [
  { cle: "starter" as const, plan: PLANS.starter, quoi: "1 client", pour: "Pour démarrer" },
  { cle: "solo" as const, plan: PLANS.solo, quoi: "6 clients", pour: "Freelances & CM", vedette: true },
  { cle: "agency" as const, plan: PLANS.agency, quoi: "12 clients", pour: "Agences" },
];

function repartir(frags: string[], capacites: number[]): string[] {
  const libres = [...frags].sort((a, b) => b.length - a.length);
  return capacites.map(max => {
    const i = libres.findIndex(f => f.length <= max);
    return i === -1 ? "" : libres.splice(i, 1)[0];
  });
}

function LogoOutil({ domaine, nom }: { domaine: string; nom: string }) {
  const [rate, setRate] = useState(false);
  if (rate) return <span className="pv-logo-txt">{nom.charAt(0)}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://www.google.com/s2/favicons?sz=128&domain=${domaine}`}
    alt={nom} width={128} height={128} loading="lazy" onError={() => setRate(true)} />;
}

const CSS = `
  .pv{position:relative;min-height:100vh;min-height:100dvh;overflow:hidden;background:#F2F4F3;}

  /* ── La zone sombre, coupée en diagonale ─────────────────────────────── */
  .pv-sombre{position:absolute;inset:0;background:var(--forest);
    clip-path:polygon(61% 0, 100% 0, 100% 100%, 48% 100%);}
  /* La grille de posts, inclinée. Le fond clair du conteneur passe entre les
     tuiles : ce sont les gouttières qui dessinent le quadrillage du croquis.
     TAILLE FIXE et non des fractions : en repeat(3,1fr) sur un conteneur large
     de 128 %, chaque tuile faisait 400 px et on ne voyait plus un post mais un
     gros plan de frites. À 150 px, on lit la composition entière. */
  .pv-mur{position:absolute;top:-22%;left:30%;width:96%;height:150%;
    background:var(--leaf-soft);transform:rotate(-10deg);
    display:grid;grid-template-columns:repeat(auto-fill,150px);justify-content:center;
    gap:8px;padding:8px;align-content:start;}
  .pv-tuile{width:100%;aspect-ratio:4/5;overflow:hidden;background:var(--forest-2);}
  .pv-tuile img{width:100%;height:100%;object-fit:cover;display:block;}

  /* ── Les pastilles des outils, en escalier sur la diagonale ──────────── */
  /* Calées à gauche de la diagonale, donc sur le fond clair : posées dessus,
     elles se perdaient dans les photos et le total devenait illisible. */
  .pv-outils{position:absolute;top:50%;left:calc(52% - 40px);transform:translateY(-50%);z-index:3;
    display:flex;flex-direction:column;gap:14px;}
  .pv-logo{position:relative;width:clamp(52px,5vw,66px);height:clamp(52px,5vw,66px);
    border-radius:20px;background:var(--leaf);display:grid;place-items:center;overflow:hidden;}
  .pv-logo img{width:58%;height:58%;object-fit:contain;}
  .pv-logo-txt{font-family:var(--display);font-weight:900;font-size:20px;color:var(--leaf-ink);}
  .pv-logo::after{content:"";position:absolute;left:-5px;right:-5px;top:50%;height:2px;
    border-radius:2px;background:var(--leaf-ink);opacity:.55;transform:rotate(-38deg);}
  /* L'escalier : chaque pastille descend vers la droite, comme sur le dessin. */
  .pv-logo:nth-child(1){margin-left:0;}
  .pv-logo:nth-child(2){margin-left:22px;}
  .pv-logo:nth-child(3){margin-left:40px;}
  .pv-logo:nth-child(4){margin-left:52px;}
  .pv-logo:nth-child(5){margin-left:58px;}
  .pv-total{margin:8px 0 0 0;max-width:150px;font-family:var(--sans);font-size:12px;
    font-weight:800;line-height:1.3;color:var(--ink-2);}

  /* ── La colonne claire, à gauche ─────────────────────────────────────── */
  .pv-gauche{position:relative;z-index:2;width:min(52%,620px);
    min-height:100dvh;display:flex;flex-direction:column;justify-content:center;
    padding:clamp(64px,9vh,88px) 0 clamp(28px,5vh,48px) clamp(24px,4vw,56px);}
  .pv-marque{position:absolute;top:clamp(20px,3.4vh,34px);left:clamp(24px,4vw,56px);z-index:4;line-height:0;}
  .pv-marque img{height:32px;width:32px;border-radius:10px;display:block;}

  .pv-h1{font-family:var(--display);font-weight:900;text-transform:uppercase;
    letter-spacing:-.03em;line-height:.98;color:var(--leaf-ink);
    font-size:clamp(30px,3.6vw,46px);margin:0 0 11px;text-wrap:balance;}
  .pv-sub{font-family:var(--sans);font-size:15px;line-height:1.5;color:var(--ink-2);
    margin:0 0 clamp(16px,2.6vh,24px);max-width:38ch;}

  .pv-periode{display:inline-flex;align-self:flex-start;background:#fff;border-radius:999px;padding:3px;
    margin-bottom:clamp(12px,2vh,18px);}
  .pv-periode button{border:none;background:none;cursor:pointer;border-radius:999px;padding:8px 16px;
    font-family:var(--sans);font-size:13.5px;font-weight:700;color:var(--ink-3);transition:background .15s,color .15s;}
  .pv-periode button.is-on{background:var(--forest);color:var(--cream);}

  /* Les trois rectangles verticaux, hauts et collés. */
  .pv-offres{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
    max-width:min(100%,520px);}
  .pv-offre{display:flex;flex-direction:column;align-items:flex-start;gap:4px;
    min-height:clamp(180px,26vh,240px);padding:16px 15px;border:none;border-radius:16px;
    background:var(--forest);color:var(--cream);cursor:pointer;font:inherit;text-align:left;
    transition:background .16s,transform .16s;}
  .pv-offre:hover{transform:translateY(-3px);}
  .pv-offre.is-on{background:var(--leaf);}
  .pv-pour{font-family:var(--sans);font-size:11.5px;font-weight:700;color:var(--cream-3);}
  .pv-nom{font-family:var(--display);font-weight:900;font-size:clamp(15px,1.5vw,18px);
    text-transform:uppercase;letter-spacing:-.02em;color:var(--cream);}
  /* nowrap : « 22,75 € » se coupait entre le nombre et l'euro, ce qui laissait
     le symbole seul sur la ligne suivante. */
  .pv-ligne-prix{margin-top:auto;display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;}
  .pv-prix{font-family:var(--display);font-weight:900;letter-spacing:-.03em;line-height:1;
    font-size:clamp(21px,2.2vw,28px);color:var(--leaf);white-space:nowrap;}
  .pv-barre{font-family:var(--sans);font-size:12px;font-weight:600;color:var(--cream-3);
    text-decoration:line-through;}
  .pv-quoi{font-family:var(--sans);font-size:12.5px;color:var(--cream-2);}
  .pv-vedette{font-family:var(--sans);font-size:10px;font-weight:800;letter-spacing:.07em;
    text-transform:uppercase;color:var(--leaf);}
  /* Offre choisie : l'aplat passe en leaf, donc tout le texte bascule en encre. */
  .pv-offre.is-on .pv-nom,.pv-offre.is-on .pv-prix{color:var(--leaf-ink);}
  .pv-offre.is-on .pv-pour,.pv-offre.is-on .pv-quoi,.pv-offre.is-on .pv-barre{color:rgba(30,51,23,.62);}
  .pv-offre.is-on .pv-vedette{color:var(--leaf-ink);}

  .pv-cta{align-self:flex-start;margin-top:clamp(16px,2.6vh,24px);min-height:54px;padding:0 30px;
    border:none;border-radius:999px;cursor:pointer;background:var(--forest);color:var(--cream);
    font-family:var(--sans);font-weight:800;font-size:16px;transition:background .16s,transform .14s;}
  .pv-cta:hover{background:var(--forest-2);transform:translateY(-1px);}
  .pv-note{font-family:var(--sans);font-size:12.5px;line-height:1.5;color:var(--ink-3);
    margin:11px 0 0;max-width:42ch;}
  .pv-note b{color:var(--ink-2);}

  /* ── Sous 1000 px : la diagonale ne tient plus, on empile ────────────── */
  @media(max-width:1000px){
    .pv{min-height:0;}
    .pv-sombre{position:relative;inset:auto;height:34vh;min-height:220px;
      clip-path:polygon(0 0, 100% 0, 100% 84%, 0 100%);}
    .pv-mur{top:-30%;left:-10%;width:120%;height:170%;grid-template-columns:repeat(4,1fr);}
    .pv-outils{position:relative;top:auto;left:auto;transform:none;margin:-30px 0 0 clamp(20px,5vw,32px);
      flex-direction:row;align-items:center;gap:9px;flex-wrap:wrap;}
    .pv-logo:nth-child(n){margin-left:0;}
    .pv-logo{width:44px;height:44px;border-radius:15px;}
    .pv-total{margin:0;color:var(--ink-3);max-width:none;}
    .pv-gauche{width:100%;min-height:0;padding:clamp(20px,4vh,30px) clamp(20px,5vw,32px) 40px;}
    .pv-marque{top:clamp(14px,2.4vh,22px);left:clamp(20px,5vw,32px);}
    .pv-marque img{filter:drop-shadow(0 2px 6px rgba(0,0,0,.4));}
    .pv-offres{max-width:none;}
  }
  @media(max-width:560px){
    .pv-offres{grid-template-columns:1fr;gap:7px;}
    .pv-offre{flex-direction:row;align-items:center;justify-content:space-between;
      min-height:0;padding:14px 16px;}
    .pv-prix{margin-top:0;}
    .pv-cta{width:100%;}
  }
`;

export default function OffrePage() {
  const [periode, setPeriode] = useState<"monthly" | "yearly">("yearly");
  const [choix, setChoix] = useState<"starter" | "solo" | "agency">("solo");
  const [visuels, setVisuels] = useState<string[]>([]);
  const [nom, setNom] = useState("");

  const fmt = (v: number) => formatPrice(v, "fr-FR");
  const remise = launchApplies(periode);

  const charger = useCallback(async () => {
    const d = lireDraft();
    setNom(d?.name ?? "");
    try {
      const res = await fetch("/api/vitrine");
      const { visuels: deposes } = await res.json();
      if (Array.isArray(deposes) && deposes.length) { setVisuels(deposes); return; }
    } catch { /* on compose à la place */ }

    const charte = {
      primary: d?.colors?.[0] ?? "#0C2A1D", secondary: d?.colors?.[1] ?? "#103A28",
      accent: d?.colors?.[2] ?? "#BDF2A0",
      display: d?.fonts?.[0] ?? null, body: d?.fonts?.[1] ?? null,
      name: d?.name ?? "Votre marque", handle: d?.handle ? `@${d.handle}` : null,
      sector: d?.sector ?? "Restaurant", tone: d?.tone ?? "direct",
    };
    /* Les photos du banc sont gitignorées : elles n'existent donc PAS sur un
       déploiement. Plutôt que d'afficher des tuiles vides, on bascule sur les
       recettes qui savent se passer de photo — `buildDesignElements` remplace
       alors la zone image par un aplat de la charte, et on obtient de vrais
       visuels typographiques de la marque. */
    let avecPhotos = true;
    try {
      const test = await fetch(PHOTOS[0], { method: "HEAD" });
      avecPhotos = test.ok;
    } catch { avecPhotos = false; }

    const recettes = avecPhotos
      ? DESIGN_RECIPES.filter(r => r.photo !== "none").slice(0, PHOTOS.length)
      : DESIGN_RECIPES.filter(r => r.photo !== "required").slice(0, 6);
    const sortie: string[] = [];
    for (let i = 0; i < recettes.length; i++) {
      const r = recettes[i];
      const msg = MESSAGES[i % MESSAGES.length];
      const fields: Record<string, string> = {};
      const libres = r.slots.filter(s => !/prix|^p\d|date|heure|^h\d/.test(s.key));
      const ordre = [...libres].sort((a, b) => effectiveMax(r, b) - effectiveMax(r, a));
      const textes = repartir(msg.frags, ordre.map(s => effectiveMax(r, s)));
      ordre.forEach((s, k) => { fields[s.key] = textes[k]; });
      r.slots.forEach(s => {
        if (/prix|^p\d/.test(s.key)) fields[s.key] = msg.prix;
        else if (/date/.test(s.key)) fields[s.key] = "12 OCT";
        else if (/heure|^h\d/.test(s.key)) fields[s.key] = "19 H 00";
      });
      try {
        const els = buildDesignElements(r, { fields, brand: charte, w: 1080, h: 1350, hasPhoto: avecPhotos });
        const img = await renderTemplateVisual({
          elements: els, sourceFormat: { w: 1080, h: 1350 },
          photoUrl: avecPhotos ? PHOTOS[i % PHOTOS.length] : null, w: 540, h: 675,
        });
        if (img) { sortie.push(img); setVisuels([...sortie]); }
      } catch { /* une recette qui échoue ne vide pas la grille */ }
    }
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  const offre = OFFRES.find(o => o.cle === choix)!;
  const paye = (() => {
    const b = periode === "yearly" ? offre.plan.priceYearly : offre.plan.priceMonthly;
    return remise ? launchPrice(b) : b;
  })();

  /* Assez de tuiles pour REMPLIR la grille inclinée, qui déborde de l'écran.
     À 150 px de côté sur une zone de ~1100 × 1100 px, il en faut une bonne
     cinquantaine : avec quinze, la moitié basse restait vert pâle et vide.
     L'ordre est décalé d'un pas premier à chaque rang pour que la répétition
     des mêmes visuels ne saute pas aux yeux en diagonale. */
  const tuiles = visuels.length
    ? Array.from({ length: 56 }, (_, i) => visuels[(i * 3 + Math.floor(i / 7)) % visuels.length])
    : Array(56).fill("");

  return (
    <div className="pv">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="pv-sombre" aria-hidden="true">
        <div className="pv-mur">
          {tuiles.map((v, i) => (
            <div className="pv-tuile" key={i}>{v && <img src={v} alt="" />}</div>
          ))}
        </div>
      </div>

      <div className="pv-outils">
        {OUTILS.map(o => (
          <span className="pv-logo" key={o.nom} title={o.nom}>
            <LogoOutil domaine={o.domaine} nom={o.nom} />
          </span>
        ))}
        <span className="pv-total">~{TOTAL} €/mois remplacés</span>
      </div>

      <Link href="/" className="pv-marque"><img src="/icon-192.png" alt="Klip" /></Link>

      <div className="pv-gauche">
        <h1 className="pv-h1">
          {nom ? <>Les visuels de <span className="acc-hl">{nom}</span></> : <>Vos visuels sont <span className="acc-hl">prêts</span></>}
        </h1>
        <p className="pv-sub">Chacun s&apos;ouvre dans l&apos;éditeur, calque par calque. L&apos;essai ouvre tout le reste.</p>

        <div className="pv-periode">
          <button className={periode === "monthly" ? "is-on" : ""} onClick={() => setPeriode("monthly")}>Mensuel</button>
          <button className={periode === "yearly" ? "is-on" : ""} onClick={() => setPeriode("yearly")}>Annuel</button>
        </div>

        <div className="pv-offres">
          {OFFRES.map(o => {
            const b = periode === "yearly" ? o.plan.priceYearly : o.plan.priceMonthly;
            const p = remise ? launchPrice(b) : b;
            return (
              <button key={o.cle} className={"pv-offre" + (choix === o.cle ? " is-on" : "")}
                onClick={() => setChoix(o.cle)}>
                <span className="pv-vedette">{o.vedette ? "Le plus choisi" : " "}</span>
                <span className="pv-nom">{o.plan.label}</span>
                <span className="pv-pour">{o.pour}</span>
                <span className="pv-ligne-prix">
                  {remise && <span className="pv-barre">{fmt(b)} €</span>}
                  <span className="pv-prix">{fmt(p)} €</span>
                </span>
                <span className="pv-quoi">{o.quoi}</span>
              </button>
            );
          })}
        </div>

        <button className="pv-cta">Commencer mes {TRIAL_DAYS} jours</button>
        <p className="pv-note">
          <b>0 € aujourd&apos;hui.</b> Premier prélèvement de {fmt(paye)} € dans {TRIAL_DAYS} jours,
          annulable en un clic.{remise && <> Remise de lancement de {LAUNCH_OFFER.percent} %.</>}
        </p>
      </div>
    </div>
  );
}
