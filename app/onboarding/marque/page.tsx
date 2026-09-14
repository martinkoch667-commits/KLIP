"use client";

/* Dernier écran du parcours : la charte relue, sur la même page blanche.
 *
 * Une carte par élément, tout modifiable au clic. Trois règles héritées des
 * tours précédents, à ne pas défaire :
 *  · les couleurs se règlent avec le NUANCIER DE L'APP (`components/ColorPicker`)
 *    et jamais avec `<input type="color">`, qui ouvre une fenêtre du système ne
 *    connaissant ni la charte ni la pipette ;
 *  · la typo se choisit dans le VRAI catalogue (`lib/fontCatalog`, Google et
 *    Fontshare) et on doit pouvoir importer ses propres fichiers. Une famille
 *    absente du catalogue reste proposée à part : sinon le menu retombe sur la
 *    première option alphabétique et remplace la police de la marque SANS
 *    prévenir ;
 *  · les drapeaux sont dessinés, pas des emojis, qui changent d'un système à
 *    l'autre et ne prennent pas la charte.
 *
 * Le contenu ne s'arrête pas à l'aspect : le secteur, le ton et la description
 * saisis avant se relisent ici, sinon la personne n'a plus aucun moyen d'y
 * revenir.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ColorPicker from "@/components/ColorPicker";
import OnboardingShell, { MotChoisi } from "@/components/OnboardingShell";
import { FONT_CATALOG, fontCssHrefs } from "@/lib/fontCatalog";
import { groupFontFiles, registerFontFamily, type FontFamily } from "@/lib/fontFiles";
import { lireDraft, ecrireDraft, type OnbDraft } from "@/lib/onboardingDraft";

type Charte = {
  logoUrl: string | null;
  titre: string;
  texte: string;
  couleurs: string[];
  langue: string;
  description: string;
  secteur: string;
  ton: string;
};

const FAMILLES = Object.keys(FONT_CATALOG).sort();

const LANGUES = [
  { code: "fr", label: "Français", bandes: ["#0055A4", "#FFFFFF", "#EF4135"], sens: "v" },
  { code: "en", label: "English", bandes: ["#012169", "#FFFFFF", "#C8102E"], sens: "x" },
  { code: "es", label: "Español", bandes: ["#AA151B", "#F1BF00", "#AA151B"], sens: "h" },
  { code: "de", label: "Deutsch", bandes: ["#000000", "#DD0000", "#FFCE00"], sens: "h" },
  { code: "it", label: "Italiano", bandes: ["#008C45", "#F4F5F0", "#CD212A"], sens: "v" },
  { code: "pt", label: "Português", bandes: ["#046A38", "#046A38", "#DA291C"], sens: "v" },
];

const SECTEURS = ["Restaurant", "Café", "Retail", "Mode", "Beauté", "Sport", "Tech", "Autre"];
const TONS = ["Chic", "Punchy", "Minimal", "Chaleureux", "Direct", "Doux"];

const DEPART: Charte = {
  logoUrl: null, titre: "Archivo", texte: "Satoshi",
  couleurs: ["#0C2A1D", "#103A28", "#BDF2A0", "#14160F"],
  langue: "fr", description: "", secteur: "", ton: "",
};

/** Drapeau dessiné : trois bandes, coins arrondis, même grain que le reste. */
function Drapeau({ code, w = 26 }: { code: string; w?: number }) {
  const l = LANGUES.find(x => x.code === code) ?? LANGUES[0];
  return (
    <svg width={w} height={Math.round(w * 0.7)} viewBox="0 0 30 21" aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}>
      <defs><clipPath id={`dr-${code}`}><rect x="0" y="0" width="30" height="21" rx="4" /></clipPath></defs>
      <g clipPath={`url(#dr-${code})`}>
        {l.sens === "v" ? (
          <>
            <rect x="0" y="0" width="10" height="21" fill={l.bandes[0]} />
            <rect x="10" y="0" width="10" height="21" fill={l.bandes[1]} />
            <rect x="20" y="0" width="10" height="21" fill={l.bandes[2]} />
          </>
        ) : l.sens === "h" ? (
          <>
            <rect x="0" y="0" width="30" height="7" fill={l.bandes[0]} />
            <rect x="0" y="7" width="30" height="7" fill={l.bandes[1]} />
            <rect x="0" y="14" width="30" height="7" fill={l.bandes[2]} />
          </>
        ) : (
          <>
            <rect x="0" y="0" width="30" height="21" fill={l.bandes[0]} />
            <path d="M0 0 L30 21 M30 0 L0 21" stroke={l.bandes[1]} strokeWidth="5" />
            <path d="M0 0 L30 21 M30 0 L0 21" stroke={l.bandes[2]} strokeWidth="2.5" />
            <path d="M15 0 V21 M0 10.5 H30" stroke={l.bandes[1]} strokeWidth="8" />
            <path d="M15 0 V21 M0 10.5 H30" stroke={l.bandes[2]} strokeWidth="4.5" />
          </>
        )}
        <rect x="0" y="0" width="30" height="21" rx="4" fill="none" stroke="rgba(0,0,0,.12)" />
      </g>
    </svg>
  );
}

function IcCrayon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
}
function IcCroix() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>;
}

/** Les trois provenances possibles d'une police, séparées et nommées. */
function OptionsPolices({ horsCatalogue, importees }: { horsCatalogue: string[]; importees: FontFamily[] }) {
  return (
    <>
      {importees.length > 0 && (
        <optgroup label="Vos fichiers">
          {importees.map(f => <option key={f.family} value={f.family}>{f.family}</option>)}
        </optgroup>
      )}
      {horsCatalogue.length > 0 && (
        <optgroup label="Relevées sur votre site">
          {horsCatalogue.map(f => <option key={f} value={f}>{f}</option>)}
        </optgroup>
      )}
      <optgroup label="Catalogue Klip">
        {FAMILLES.map(f => <option key={f} value={f}>{f}</option>)}
      </optgroup>
    </>
  );
}

const CSS = `
  /* Cette page est plus large que les autres : elle montre une grille, pas une
     question. Le socle reste le même, seule la colonne s'élargit. */
  /* Cartes blanches à ombre verte ; au survol la carte est SÉLECTIONNÉE,
     cadre et poignées, comme un calque qu'on s'apprête à modifier. */
  .ch-grille{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:clamp(22px,3.4vh,32px);}
  .ch-carte{position:relative;display:flex;flex-direction:column;text-align:left;
    background:var(--carte);border:none;border-radius:20px;padding:16px;cursor:pointer;
    min-height:152px;font:inherit;
    box-shadow:inset 0 0 0 1px rgba(16,19,11,.06),0 18px 36px -26px var(--ombre);transition:transform .15s;}
  /* Cadre rectangulaire et poignées sur ses coins, pas un outline qui suivrait
     l'arrondi de la carte. */
  .ch-carte:hover::before{content:"";position:absolute;inset:-6px;border:2px solid var(--vio);border-radius:4px;pointer-events:none;}
  .ch-carte:hover::after{content:"";position:absolute;inset:-12px;pointer-events:none;
    background:
      radial-gradient(circle,#fff 0 4.5px,#6656D9 4.6px 6.5px,transparent 6.6px) 0 0/14px 14px no-repeat,
      radial-gradient(circle,#fff 0 4.5px,#6656D9 4.6px 6.5px,transparent 6.6px) 100% 0/14px 14px no-repeat,
      radial-gradient(circle,#fff 0 4.5px,#6656D9 4.6px 6.5px,transparent 6.6px) 0 100%/14px 14px no-repeat,
      radial-gradient(circle,#fff 0 4.5px,#6656D9 4.6px 6.5px,transparent 6.6px) 100% 100%/14px 14px no-repeat;}
  .ch-carte:hover .ch-crayon{opacity:1;}
  .ch-crayon{position:absolute;top:12px;right:12px;width:26px;height:26px;border-radius:8px;
    background:var(--vio);color:#fff;display:grid;place-items:center;opacity:0;transition:opacity .15s;
    box-shadow:0 6px 14px -6px var(--ombre);}
  .ch-nom{margin-top:auto;padding-top:12px;font-family:var(--sans);font-size:12px;
    font-weight:700;color:var(--ink-3);}
  .ch-vide{flex:1;display:flex;align-items:center;font-family:var(--sans);font-size:13px;color:var(--ink-3);}

  .ch-logo{flex:1;border-radius:13px;background:var(--creux);display:grid;place-items:center;padding:12px;overflow:hidden;}
  .ch-logo img{max-width:100%;max-height:100%;object-fit:contain;}
  .ch-typo{flex:1;display:flex;gap:14px;align-items:baseline;}
  .ch-typo-n{display:flex;gap:12px;font-family:var(--sans);font-size:10.5px;color:var(--ink-3);margin-top:6px;}
  .ch-cols{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:7px;}
  .ch-sw{border-radius:9px;min-height:34px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06);}
  .ch-lang{flex:1;display:flex;align-items:center;gap:10px;}
  .ch-lang-l{font-family:var(--sans);font-weight:700;font-size:15px;color:var(--ink);}
  .ch-txt{flex:1;font-family:var(--sans);font-size:13px;line-height:1.45;color:var(--ink-2);
    display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;}
  .ch-tags{flex:1;display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;}
  .ch-tag{background:var(--creux);border-radius:10px;padding:6px 11px;font-family:var(--sans);
    font-size:12.5px;font-weight:700;color:var(--ink-2);}
  .ch-tag.is-on{background:#DDF8CF;color:#2E6A1D;box-shadow:inset 0 0 0 1.5px #A6E68A;}

  /* Réglages dans la modale */
  .ch-lab{display:block;font-family:var(--sans);font-size:12.5px;font-weight:700;
    color:var(--ink-3);margin-bottom:7px;text-align:left;}
  .ch-sel{width:100%;box-sizing:border-box;min-height:46px;padding:0 13px;border-radius:12px;border:none;
    background:var(--sunk);color:var(--ink);font-family:var(--sans);font-size:15px;font-weight:600;
    outline:none;cursor:pointer;margin-bottom:10px;}
  .ch-apercu{background:var(--sunk);border-radius:14px;padding:16px;margin-bottom:16px;overflow:hidden;}
  .ch-depot{display:block;border-radius:14px;background:var(--sunk);padding:15px;cursor:pointer;
    font-family:var(--sans);font-size:13px;color:var(--ink-3);}
  .ch-depot:hover{background:var(--btn-soft-2);}
  .ch-depot b{display:block;color:var(--ink);font-size:14px;margin-bottom:2px;}
  .ch-ligne{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
  .ch-ligne-n{flex:1;text-align:left;font-family:var(--sans);font-size:14px;font-weight:700;color:var(--ink-2);}
  .ch-ligne-h{font-family:var(--mono);font-size:12px;color:var(--ink-3);}
  .ch-langues{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;}
  .ch-langue{display:flex;align-items:center;gap:9px;padding:11px 13px;border-radius:13px;border:none;
    cursor:pointer;background:var(--sunk);font-family:var(--sans);font-size:14px;font-weight:700;
    color:var(--ink);box-shadow:inset 0 0 0 2px transparent;}
  .ch-langue.is-on{background:#DDF8CF;color:#2E6A1D;box-shadow:inset 0 0 0 1.5px #A6E68A;}
  .ch-fermer{position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:10px;
    background:var(--sunk);border:none;cursor:pointer;display:grid;place-items:center;color:var(--ink-2);}
  .ch-fermer:hover{background:var(--btn-soft-2);color:var(--ink);}

  @media(max-width:639px){
    .ch-grille{grid-template-columns:1fr 1fr;gap:9px;margin-top:clamp(14px,3vh,24px);}
    .ch-carte{min-height:124px;padding:13px;border-radius:16px;}
    /* Au doigt il n'y a pas de survol : le crayon reste visible. */
    .ch-crayon{opacity:1;width:23px;height:23px;top:9px;right:9px;}
    .ch-langues{grid-template-columns:1fr;}
  }
`;

type Modale = null | "logo" | "typo" | "couleurs" | "langue" | "voix" | "texte";

const NOMS: Record<Exclude<Modale, null>, string> = {
  logo: "Logo", typo: "Typographie", couleurs: "Couleurs",
  langue: "Langue", voix: "Secteur et ton", texte: "Description",
};

export default function CharePage() {
  const router = useRouter();
  const [ch, setCh] = useState<Charte>(DEPART);
  const [nom, setNom] = useState("");
  const [igRelie, setIgRelie] = useState<boolean | null>(null);
  const [modale, setModale] = useState<Modale>(null);
  const [brouillon, setBrouillon] = useState<Charte>(DEPART);
  const [importees, setImportees] = useState<FontFamily[]>([]);

  // Ce que les écrans précédents ont récolté remplace les valeurs de départ.
  // Un champ absent reste vide et le dit : une carte qui affiche une valeur
  // inventée est pire qu'une carte vide.
  useEffect(() => {
    const d: OnbDraft | null = lireDraft();
    if (!d) { setIgRelie(true); return; }
    setNom(d.name ?? "");
    setIgRelie(d.igConnected !== false);
    setCh(prev => ({
      ...prev,
      logoUrl: d.logoUrl ? `/api/proxy-image?url=${encodeURIComponent(d.logoUrl)}` : null,
      titre: d.fonts?.[0] ?? prev.titre,
      texte: d.fonts?.[1] ?? prev.texte,
      couleurs: d.colors && d.colors.length >= 4 ? d.colors.slice(0, 4) : prev.couleurs,
      description: d.headline ?? d.description ?? "",
      secteur: d.sector ?? "",
      ton: d.tone ?? "",
    }));
  }, []);

  // Les polices choisies doivent être CHARGÉES pour que l'aperçu dise vrai.
  useEffect(() => {
    const familles = [ch.titre, ch.texte, brouillon.titre, brouillon.texte].filter(Boolean);
    fontCssHrefs(familles).forEach(({ id, href }) => {
      if (document.getElementById(id)) return;
      const l = document.createElement("link");
      l.id = id; l.rel = "stylesheet"; l.href = href;
      document.head.appendChild(l);
    });
  }, [ch.titre, ch.texte, brouillon.titre, brouillon.texte]);

  function ouvrir(m: Modale) { setBrouillon(ch); setModale(m); }
  function valider() {
    setCh(brouillon);
    setModale(null);
    const d = lireDraft();
    ecrireDraft({
      ...(d ?? { source: "manuel", prefilled: [] }),
      colors: brouillon.couleurs, fonts: [brouillon.titre, brouillon.texte],
      sector: brouillon.secteur, tone: brouillon.ton, headline: brouillon.description,
      // Un logo déposé ici remplace celui du site (l'aperçu du site passe par
      // le proxy et n'est pas réécrit).
      ...(brouillon.logoUrl?.startsWith("data:") ? { logoUrl: brouillon.logoUrl } : {}),
    });
  }

  async function importerPolices(fichiers: FileList | null) {
    if (!fichiers?.length) return;
    const liste = Array.from(fichiers).map(f => ({ name: f.name, url: URL.createObjectURL(f) }));
    const familles = groupFontFiles(liste);
    for (const fam of familles) await registerFontFamily(fam);
    setImportees(prev => [...prev, ...familles]);
    if (familles[0]) setBrouillon(b => ({ ...b, titre: familles[0].family }));
  }

  /* Une police relevée sur le site n'est pas forcément au catalogue. Sans cette
     liste à part, le menu ne trouve pas sa valeur, retombe sur la première
     option alphabétique, et la vraie police de la marque disparaît en silence. */
  const horsCatalogue = [ch.titre, ch.texte, brouillon.titre, brouillon.texte]
    .filter((f): f is string => !!f && !FAMILLES.includes(f) && !importees.some(i => i.family === f))
    .filter((f, i, t) => t.indexOf(f) === i);

  const langue = LANGUES.find(l => l.code === ch.langue) ?? LANGUES[0];

  return (
    <OnboardingShell largeur={620} chemin="charte" intro={
      <>
        <h1 className="ob-h1">
          {nom ? <>La charte de <MotChoisi>{nom}</MotChoisi></> : <>Votre <MotChoisi>charte</MotChoisi></>}
        </h1>
        <p className="ob-sub">
          {igRelie === false
            ? "Lue sur votre site seulement. Touchez une carte pour corriger."
            : "Touchez une carte pour corriger."}
        </p>
      </>
    } bas={
      <button className="ob-btn ob-btn-leaf" onClick={() => router.push("/onboarding/offre")}>
        Générer mes visuels
      </button>
    }>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="ch-grille">
        <button className="ch-carte" onClick={() => ouvrir("logo")}>
          <span className="ch-crayon"><IcCrayon /></span>
          {ch.logoUrl
            ? <span className="ch-logo"><img src={ch.logoUrl} alt="" /></span>
            : <span className="ch-vide">Aucun logo trouvé</span>}
          <span className="ch-nom">Logo</span>
        </button>

        <button className="ch-carte" onClick={() => ouvrir("typo")}>
          <span className="ch-crayon"><IcCrayon /></span>
          <span className="ch-typo">
            <span style={{ fontFamily: `'${ch.titre}', var(--display)`, fontWeight: 800, fontSize: 30, color: "var(--ink)", lineHeight: 1 }}>Aa</span>
            <span style={{ fontFamily: `'${ch.texte}', var(--sans)`, fontSize: 25, color: "var(--ink-2)", lineHeight: 1 }}>Aa</span>
          </span>
          <span className="ch-typo-n"><span>{ch.titre}</span><span>{ch.texte}</span></span>
          <span className="ch-nom">Typographie</span>
        </button>

        <button className="ch-carte" onClick={() => ouvrir("couleurs")}>
          <span className="ch-crayon"><IcCrayon /></span>
          <span className="ch-cols">
            {ch.couleurs.map((c, i) => <span key={i} className="ch-sw" style={{ background: c }} />)}
          </span>
          <span className="ch-nom">Couleurs</span>
        </button>

        <button className="ch-carte" onClick={() => ouvrir("voix")}>
          <span className="ch-crayon"><IcCrayon /></span>
          <span className="ch-tags">
            {ch.secteur && <span className="ch-tag is-on">{ch.secteur}</span>}
            {ch.ton && <span className="ch-tag is-on">{ch.ton}</span>}
            {!ch.secteur && !ch.ton && <span className="ch-vide">À préciser</span>}
          </span>
          <span className="ch-nom">Secteur et ton</span>
        </button>

        <button className="ch-carte" onClick={() => ouvrir("texte")}>
          <span className="ch-crayon"><IcCrayon /></span>
          {ch.description
            ? <span className="ch-txt">{ch.description}</span>
            : <span className="ch-vide">Aucune description</span>}
          <span className="ch-nom">Description</span>
        </button>

        <button className="ch-carte" onClick={() => ouvrir("langue")}>
          <span className="ch-crayon"><IcCrayon /></span>
          <span className="ch-lang">
            <Drapeau code={langue.code} w={30} />
            <span className="ch-lang-l">{langue.label}</span>
          </span>
          <span className="ch-nom">Langue</span>
        </button>
      </div>

      {modale && (
        <div className="ob-mod-bg" onClick={() => setModale(null)}>
          <div className="ob-mod" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
            style={{ position: "relative", maxWidth: modale === "typo" ? 520 : 460 }}>
            <button className="ch-fermer" onClick={() => setModale(null)} aria-label="Fermer"><IcCroix /></button>
            <h2 className="ob-mod-h" style={{ paddingRight: 40 }}>{NOMS[modale]}</h2>

            {modale === "logo" && (
              <>
                <div className="ch-apercu" style={{ padding: 24 }}>
                  {brouillon.logoUrl
                    ? <img src={brouillon.logoUrl} alt="" style={{ maxHeight: 70, maxWidth: "100%" }} />
                    : <span style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-3)" }}>Aucun logo</span>}
                </div>
                <label className="ch-depot">
                  <b>Choisir un fichier</b>PNG ou SVG, fond transparent de préférence
                  <input type="file" accept="image/*" hidden
                    onChange={e => {
                      /* Lu en data: et non en blob: : l'adresse blob meurt au
                         départ vers Stripe, et le logo choisi ici n'arrivait
                         jamais dans le client créé après le paiement. */
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 1.5 * 1024 * 1024) { alert("Logo trop lourd : 1,5 Mo au maximum."); return; }
                      const lecteur = new FileReader();
                      lecteur.onload = () => setBrouillon(b => ({ ...b, logoUrl: String(lecteur.result) }));
                      lecteur.readAsDataURL(f);
                    }} />
                </label>
                <button className="ob-btn ob-btn-leaf" style={{ marginTop: 16 }} onClick={valider}>Enregistrer</button>
              </>
            )}

            {modale === "typo" && (
              <>
                <span className="ch-lab">Titres</span>
                <select className="ch-sel" value={brouillon.titre}
                  onChange={e => setBrouillon(b => ({ ...b, titre: e.target.value }))}>
                  <OptionsPolices horsCatalogue={horsCatalogue} importees={importees} />
                </select>
                <div className="ch-apercu" style={{ fontFamily: `'${brouillon.titre}', var(--display)`, fontWeight: 800, fontSize: 27, color: "var(--ink)" }}>
                  {nom || "Votre marque"}
                </div>
                <span className="ch-lab">Texte</span>
                <select className="ch-sel" value={brouillon.texte}
                  onChange={e => setBrouillon(b => ({ ...b, texte: e.target.value }))}>
                  <OptionsPolices horsCatalogue={horsCatalogue} importees={importees} />
                </select>
                <div className="ch-apercu" style={{ fontFamily: `'${brouillon.texte}', var(--sans)`, fontSize: 15, color: "var(--ink-2)" }}>
                  Portez ce vieux whisky au juge blond qui fume.
                </div>
                <label className="ch-depot">
                  <b>Utiliser mes polices</b>.woff2, .woff, .ttf ou .otf
                  <input type="file" accept=".woff2,.woff,.ttf,.otf" multiple hidden
                    onChange={e => void importerPolices(e.target.files)} />
                </label>
                <button className="ob-btn ob-btn-leaf" style={{ marginTop: 16 }} onClick={valider}>Enregistrer</button>
              </>
            )}

            {modale === "couleurs" && (
              <>
                {brouillon.couleurs.map((c, i) => (
                  <div className="ch-ligne" key={i}>
                    <ColorPicker value={c} brandColors={brouillon.couleurs}
                      onChange={(v: string) => setBrouillon(b => {
                        const cs = [...b.couleurs]; cs[i] = v; return { ...b, couleurs: cs };
                      })} />
                    <span className="ch-ligne-n">
                      {["Principale", "Secondaire", "Accent", "Encre"][i] ?? `Couleur ${i + 1}`}
                    </span>
                    <span className="ch-ligne-h">{c}</span>
                  </div>
                ))}
                <button className="ob-btn ob-btn-leaf" style={{ marginTop: 12 }} onClick={valider}>Enregistrer</button>
              </>
            )}

            {modale === "langue" && (
              <>
                <div className="ch-langues">
                  {LANGUES.map(l => (
                    <button key={l.code} className={"ch-langue" + (brouillon.langue === l.code ? " is-on" : "")}
                      onClick={() => setBrouillon(b => ({ ...b, langue: l.code }))}>
                      <Drapeau code={l.code} /> {l.label}
                    </button>
                  ))}
                </div>
                <button className="ob-btn ob-btn-leaf" onClick={valider}>Enregistrer</button>
              </>
            )}

            {modale === "voix" && (
              <>
                <span className="ch-lab">Secteur</span>
                <div className="ob-chips" style={{ marginBottom: 18 }}>
                  {SECTEURS.map(s => (
                    <button key={s} className={"ob-chip" + (brouillon.secteur === s ? " is-on" : "")}
                      onClick={() => setBrouillon(b => ({ ...b, secteur: s }))}>{s}</button>
                  ))}
                </div>
                <span className="ch-lab">Ton</span>
                <div className="ob-chips" style={{ marginBottom: 20 }}>
                  {TONS.map(t => (
                    <button key={t} className={"ob-chip" + (brouillon.ton === t ? " is-on" : "")}
                      onClick={() => setBrouillon(b => ({ ...b, ton: t }))}>{t}</button>
                  ))}
                </div>
                <button className="ob-btn ob-btn-leaf" onClick={valider}>Enregistrer</button>
              </>
            )}

            {modale === "texte" && (
              <>
                <textarea className="ob-in ob-ta" rows={5} style={{ marginBottom: 16 }}
                  value={brouillon.description}
                  onChange={e => setBrouillon(b => ({ ...b, description: e.target.value }))}
                  placeholder="Ex : Café de spécialité dans le quartier des arts…" />
                <button className="ob-btn ob-btn-leaf" onClick={valider}>Enregistrer</button>
              </>
            )}
          </div>
        </div>
      )}
    </OnboardingShell>
  );
}
