"use client";

import { useState, useRef, useEffect, useMemo, CSSProperties, Fragment } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";
import ColorPicker from "@/components/ColorPicker";
import {
  effectiveSubStyle, charterSubPresets, DEFAULT_SUB_POS, SUB_LENGTHS, DEFAULT_WORDS_PER_CAPTION, type SubCustom,
} from "@/app/workspace/[id]/montage/[postId]/constants";
import SubtitleStyleEditor, { SubtitlePreviewChip, SubtitlePreviewStage } from "@/components/SubtitleStyleEditor";
import { parseFontFile, groupFontFiles, type FontFamily } from "@/lib/fontFiles";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GFont { family: string; category: string }
interface CustomFont { file: File; family: string; blobUrl: string; variantsCount: number }

// ─── Fallback font list (used if API unavailable) ─────────────────────────────

const FALLBACK_FONTS: GFont[] = [
  "Anton", "Archivo Black", "Barlow Condensed", "Bebas Neue",
  "DM Sans", "Exo 2", "Fjalla One", "Inter", "Josefin Sans",
  "Lato", "Merriweather", "Montserrat", "Nunito", "Oswald",
  "Outfit", "Playfair Display", "Plus Jakarta Sans", "Poppins",
  "Raleway", "Roboto Condensed", "Rubik", "Space Grotesk",
  "Syne", "Ubuntu", "Work Sans",
].map(f => ({ family: f, category: "sans-serif" }));

// ─── Other constants ──────────────────────────────────────────────────────────

// Ces valeurs (nom du secteur, ton) sont sauvegardées en base et utilisées dans
// le prompt IA — on garde donc les libellés français comme identifiants internes
// stables, et on affiche leur traduction via les clés *Key ci-dessous.
const SECTOR_KEYS = [
  ["Restaurant", "sectorRestaurant"], ["Café", "sectorCafe"], ["Retail", "sectorRetail"],
  ["Mode", "sectorMode"], ["Beauté", "sectorBeaute"], ["Sport", "sectorSport"],
  ["Tech", "sectorTech"], ["Autre", "sectorAutre"],
] as const;

const TONE_KEYS = [
  ["Chic", "toneChicLabel", "toneChicDesc"],
  ["Punchy", "tonePunchyLabel", "tonePunchyDesc"],
  ["Minimal", "toneMinimalLabel", "toneMinimalDesc"],
  ["Chaleureux", "toneChaleureuxLabel", "toneChaleureuxDesc"],
  ["Direct", "toneDirectLabel", "toneDirectDesc"],
  ["Doux", "toneDouxLabel", "toneDouxDesc"],
] as const;

const FONT_LIST_LIMIT = 100; // shown by default (top 100 by popularity)

// ─── Module-level font loader (avoids duplicate <link> tags) ──────────────────

const _gfLoaded = new Set<string>();

function loadGoogleFont(family: string) {
  if (_gfLoaded.has(family)) return;
  _gfLoaded.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}&display=swap`;
  document.head.appendChild(link);
}

// ─── Shared styles ────────────────────────────────────────────────────────────

// Champs du parcours : aplat, sans filet, comme partout ailleurs dans le produit.
const inputStyle: CSSProperties = {
  width: "100%", background: "var(--sunk)", border: "none",
  borderRadius: 13, padding: "12px 16px", fontSize: 14.5, color: "var(--ink)",
  outline: "none", fontFamily: "var(--sans)", boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  display: "block", marginBottom: 7, fontSize: 10.5, fontWeight: 800,
  color: "var(--mint-2)", textTransform: "uppercase", letterSpacing: "0.13em",
  fontFamily: "var(--sans)",
};

// Aperçu fidèle d'un sous-titre : on résout le style comme le montage
// (effectiveSubStyle = style de base + surcharges), le 2e mot représente le mot
// actif surligné (couleur `hi`). Rendu sur fond sombre, comme sur une vidéo.
function SubChip({ styleId, custom, size = 15, words = ["Vos", "clips"] }: {
  styleId: string; custom?: SubCustom; size?: number; words?: [string, string] | string[];
}) {
  const s = effectiveSubStyle(styleId, custom);
  const hasBg = s.bg && s.bg !== "transparent";
  const chip: CSSProperties = {
    display: "inline-block", maxWidth: "100%",
    fontFamily: s.font ? `'${s.font}', var(--display)` : "var(--display)",
    fontWeight: s.weight,
    fontStyle: s.italic ? "italic" : "normal",
    textTransform: s.uppercase ? "uppercase" : "none",
    fontSize: size, lineHeight: 1.15, letterSpacing: "-0.01em", color: s.fg,
    padding: s.pill ? "4px 11px" : hasBg ? "3px 7px" : "2px 0",
    borderRadius: s.pill ? 999 : hasBg ? 4 : 0,
    background: s.bg,
    ...(s.stroke ? { WebkitTextStroke: `0.9px ${s.stroke}`, paintOrder: "stroke", textShadow: "0 1px 2px rgba(0,0,0,.5)" } : {}),
  };
  return <span style={chip}>{words[0]} <span style={{ color: s.hi }}>{words[1]}</span></span>;
}

// ─── FontRow — lazy-loads the font via IntersectionObserver ───────────────────

function FontRow({
  family, selected, onSelect,
}: { family: string; selected: boolean; onSelect: () => void }) {
  const t = useTranslations('workspaceNew');
  const ref = useRef<HTMLButtonElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loaded.current) {
          loaded.current = true;
          loadGoogleFont(family);
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [family]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onSelect}
      style={{
        width: "100%", padding: "12px 16px", textAlign: "left", border: "none",
        borderBottom: "1px solid rgba(13,15,10,.04)",
        background: selected ? "var(--mint-soft)" : "transparent",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "background 0.1s",
      }}
    >
      <div>
        <span style={{
          fontFamily: `"${family}", sans-serif`, fontSize: 18, lineHeight: 1.25,
          color: selected ? "var(--mint-2)" : "var(--ink)", display: "block",
        }}>
          {t('previewHeading')}
        </span>
        <span style={{
          fontSize: 11, color: selected ? "var(--mint-2)" : "var(--ink-3)",
          fontFamily: "var(--sans)", fontWeight: 600,
        }}>
          {family}
        </span>
      </div>
      {selected && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mint-2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      )}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewWorkspacePage() {
  const t = useTranslations('workspaceNew');
  const router = useRouter();
  const supabase = createClientComponentClient();

  const STEP_LABELS = [t('step1'), t('step2'), t('step3'), t('step4'), t('step5')];
  const SECTORS = SECTOR_KEYS.map(([value, key]) => ({ value, label: t(key) }));
  const TONES = TONE_KEYS.map(([value, labelKey, descKey]) => ({ value, label: t(labelKey), desc: t(descKey) }));

  // On commence par l'écran du lien : c'est le raccourci, il mérite toute la
  // page. Les cinq étapes classiques ne démarrent qu'ensuite.
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Infos de base
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  // Analyse du site : on préremplit, on ne décide pas. Rien n'est verrouillé,
  // tout reste modifiable — c'est un point de départ, pas un verdict.
  const [website, setWebsite] = useState("");
  const [siteBusy, setSiteBusy] = useState(false);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [siteFilled, setSiteFilled] = useState<string[] | null>(null);
  const [siteFonts, setSiteFonts] = useState<string[]>([]);
  // L'écran d'entrée se joue en trois temps : on demande, on cherche, on relit.
  const [sitePhase, setSitePhase] = useState<"ask" | "searching" | "result">("ask");
  const [siteStepIdx, setSiteStepIdx] = useState(0);
  const [siteLogo, setSiteLogo] = useState<string | null>(null);
  // L'analyse du site trouve aussi une icône (favicon, apple-touch-icon). Elle
  // était renvoyée par brandFromSite et jetée sans être lue.
  const [siteIcon, setSiteIcon] = useState<string | null>(null);
  // Une police repérée sur un site n'existe pas forcément dans le catalogue :
  // il faut le dire plutôt que de laisser croire qu'elle a été appliquée.
  const [siteFontMatched, setSiteFontMatched] = useState(false);

  // Step 2 — Voix de marque
  const [tone, setTone] = useState("");
  // Six tons préréglés ne couvrent pas toutes les marques : on peut en ajouter.
  // Ils vivent à côté des préréglages et se choisissent de la même façon.
  const [customTones, setCustomTones] = useState<string[]>([]);
  const [newTone, setNewTone] = useState("");
  const [wordsToUse, setWordsToUse] = useState("");
  const [wordsToAvoid, setWordsToAvoid] = useState("");
  const [captionExample, setCaptionExample] = useState("");

  // Step 3 — Identité visuelle
  const [primaryColor, setPrimaryColor] = useState("#0038FF");
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF");
  const [accentColor, setAccentColor] = useState("#BDF2A0");
  // Template de sous-titres du client (utilisé par défaut dans les montages vidéo).
  // Choisi à l'étape 5, une fois les COULEURS (étape 3) et la TYPO (étape 4) connues.
  const [subtitleStyleId, setSubtitleStyleId] = useState("bold-white");
  const [subtitleCustom, setSubtitleCustom] = useState<SubCustom>({});
  const [subPresetId, setSubPresetId] = useState<string | null>("charte"); // preset charte actif
  const [subAdvanced, setSubAdvanced] = useState(false); // panneau de personnalisation ouvert
  // Mots max par bloc de sous-titre — même réglage que l'éditeur de montage
  // (SUB_LENGTHS), pour que l'aperçu montre fidèlement comment le texte
  // s'affichera réellement (par blocs, pas en une phrase entière figée).
  const [subMaxWords, setSubMaxWords] = useState(DEFAULT_WORDS_PER_CAPTION);
  // Position des sous-titres dans le cadre (%), réglée au doigt sur l'aperçu vidéo.
  const [subPos, setSubPos] = useState<{ x: number; y: number }>(DEFAULT_SUB_POS);
  const logoRef = useRef<HTMLInputElement>(null);
  const logoDarkRef = useRef<HTMLInputElement>(null);
  const assetsRef = useRef<HTMLInputElement>(null);
  const brandIconRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoDarkFile, setLogoDarkFile] = useState<File | null>(null);
  const [logoDarkPreview, setLogoDarkPreview] = useState<string | null>(null);
  const [assetFiles, setAssetFiles] = useState<File[]>([]);
  const [assetPreviews, setAssetPreviews] = useState<string[]>([]);
  const [brandIconFile, setBrandIconFile] = useState<File | null>(null);
  const [brandIconPreview, setBrandIconPreview] = useState<string | null>(null);

  // Step 4 — Typographie (Google Fonts)
  const [googleFonts, setGoogleFonts] = useState<GFont[]>([]);
  const [fontsLoading, setFontsLoading] = useState(false);
  const [fontPrimary, setFontPrimary] = useState("Oswald");
  const [fontSecondary, setFontSecondary] = useState("");
  const [fontSearch, setFontSearch] = useState("");
  const [fontSearchSecondary, setFontSearchSecondary] = useState("");

  // Step 4 — Custom fonts
  const customPrimaryRef = useRef<HTMLInputElement>(null);
  const customSecondaryRef = useRef<HTMLInputElement>(null);
  // On garde TOUS les fichiers sélectionnés pour chaque emplacement (une
  // famille arrive en plusieurs fichiers — Light, Regular, Bold…). L'ancien
  // code ne retenait qu'un seul fichier « représentant » par emplacement : à
  // chaque nouvelle sélection, le lot précédent était perdu — on ne pouvait
  // importer qu'une graisse à la fois. `customPrimary`/`customSecondary` sont
  // maintenant DÉRIVÉS de ces listes (cf. plus bas), jamais écrasés.
  const [customPrimaryFiles, setCustomPrimaryFiles] = useState<File[]>([]);
  const [customSecondaryFiles, setCustomSecondaryFiles] = useState<File[]>([]);
  // Familles complètes importées (plusieurs fichiers = plusieurs graisses).
  const [fontFiles, setFontFiles] = useState<File[]>([]);

  // Famille + représentant (le poids le plus proche de 400, pour l'aperçu et
  // le champ legacy font_primary_url) dérivés de la liste de fichiers. Le nom
  // de famille vient de `parseFontFile` — la MÊME fonction que celle qui
  // groupe les variantes à l'enregistrement — pour ne jamais afficher un nom
  // différent de celui réellement utilisé.
  function deriveCustomFont(files: File[]): CustomFont | null {
    if (files.length === 0) return null;
    const family = parseFontFile(files[0].name).family;
    const rep = [...files].sort((a, b) =>
      Math.abs(parseFontFile(a.name).weight - 400) - Math.abs(parseFontFile(b.name).weight - 400))[0];
    return { file: rep, family, blobUrl: URL.createObjectURL(rep), variantsCount: files.length };
  }
  const customPrimary = useMemo(() => deriveCustomFont(customPrimaryFiles), [customPrimaryFiles]);
  const customSecondary = useMemo(() => deriveCustomFont(customSecondaryFiles), [customSecondaryFiles]);
  function setCustomPrimary(v: null) { setCustomPrimaryFiles([]); void v; }
  function setCustomSecondary(v: null) { setCustomSecondaryFiles([]); void v; }

  // Active font names (custom overrides Google selection)
  const activeFontPrimary = customPrimary ? customPrimary.family : fontPrimary;
  const activeFontSecondary = customSecondary ? customSecondary.family : fontSecondary;

  // Libellés de l'éditeur de sous-titres (partagé avec l'éditeur de montage).
  const tse = useTranslations('subtitleEditor');
  // Libellés « longueur des sous-titres » — réutilise les traductions déjà
  // faites pour l'éditeur de montage (mêmes 6 langues), pas de doublon à créer.
  const tc = useTranslations('montageConstants');
  const SUB_LENGTH_KEY: Record<number, string> = { 1: "one", 2: "two", 3: "three", 4: "four", 6: "six", 99: "sentence" };
  const subEditorLabels = useMemo(() => ({
    basic: tse('basic'), font: tse('font'), brandFont: tse('brandFont'), system: tse('system'),
    serif: tse('serif'), mono: tse('mono'), size: tse('size'), style: tse('style'), case: tse('case'),
    align: tse('align'), letterSpacing: tse('letterSpacing'), lineHeight: tse('lineHeight'),
    colors: tse('colors'), text: tse('text'), highlight: tse('highlight'),
    background: tse('background'), none: tse('none'), opacity: tse('opacity'), radius: tse('radius'), pill: tse('pill'),
    stroke: tse('stroke'), thickness: tse('thickness'),
    shadow: tse('shadow'), blur: tse('blur'), offsetX: tse('offsetX'), offsetY: tse('offsetY'),
    glow: tse('glow'), intensity: tse('intensity'),
    transform: tse('transform'), rotation: tse('rotation'),
    anim: tse('anim'), animWords: tse('animWords'), animNone: tse('animNone'),
    layout: tse('layout'), boxWidth: tse('boxWidth'), lines: tse('lines'),
    oneLine: tse('oneLine'), twoLines: tse('twoLines'), threeLines: tse('threeLines'),
            bgWidth: tse('bgWidth'), bgHeight: tse('bgHeight'), spread: tse('spread'),
            tabBasic: tse('tabBasic'), tabBubble: tse('tabBubble'), tabEffects: tse('tabEffects'), curve: tse('curve'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Templates de sous-titres dérivés de la charte (couleurs + police déjà choisies).
  const subPresets = useMemo(
    () => charterSubPresets({ primary: primaryColor, secondary: secondaryColor, accent: accentColor, font: activeFontPrimary }),
    [primaryColor, secondaryColor, accentColor, activeFontPrimary],
  );

  // Le glisser-placer du sous-titre vit désormais dans SubtitlePreviewStage,
  // partagé avec l'éditeur de montage.

  // Applique un preset de la charte (et mémorise lequel est actif).
  function applySubPreset(p: { id: string; styleId: string; custom: SubCustom }) {
    setSubPresetId(p.id);
    setSubtitleStyleId(p.styleId);
    setSubtitleCustom(p.custom);
  }

  // Tant que l'utilisateur n'a rien personnalisé, le preset suit les couleurs/polices
  // s'il les modifie en revenant en arrière dans l'assistant.
  useEffect(() => {
    if (!subPresetId) return;
    const p = subPresets.find((x) => x.id === subPresetId);
    if (p) { setSubtitleStyleId(p.styleId); setSubtitleCustom(p.custom); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subPresets]);

  // Step 5 — Templates. Ils se créent désormais dans le VRAI éditeur (celui
  // qu'utilisent tous les clients), pas dans une maquette à part : il fallait
  // donc le client réellement en base AVANT d'y entrer. On le crée dès qu'on
  // atteint l'étape 5 (avec tout ce que les étapes 1-4 ont rempli), et les
  // boutons de cette étape naviguent vers l'éditeur réel / le tableau de bord.
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string | null>(null);
  const [templateCount, setTemplateCount] = useState(0);

  // Ce que le serveur fait, dans l'ordre. On l'annonce au fil de l'eau plutôt
  // que de laisser un bouton tourner dans le vide : l'attente devient lisible.
  const SITE_STEPS = [
    "Ouverture de la page",
    "Lecture des feuilles de style",
    "Extraction des couleurs de marque",
    "Repérage des typographies",
    "Lecture du positionnement et du ton",
  ];

  // Lit le site de la marque et remplit ce qui peut l'être. Les champs déjà
  // saisis à la main ne sont jamais écrasés : si quelqu'un a pris la peine
  // d'écrire, sa version gagne.
  const analyzeWebsite = async () => {
    const url = website.trim();
    if (!url || siteBusy) return;
    setSiteBusy(true);
    setSiteError(null);
    setSiteFilled(null);
    setSitePhase("searching");
    setSiteStepIdx(0);
    // Les étapes défilent pendant que la requête est en vol ; la dernière ne se
    // referme qu'à l'arrivée de la réponse, jamais avant.
    const ticker = setInterval(() => {
      setSiteStepIdx(i => Math.min(i + 1, SITE_STEPS.length - 2));
    }, 900);
    try {
      const res = await fetch("/api/brand/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const d = await res.json();
      if (!res.ok) { setSiteError(d?.error ?? "Analyse impossible."); setSitePhase("ask"); return; }
      if (d.logoUrl) setSiteLogo(d.logoUrl);
      if (d.iconUrl) setSiteIcon(d.iconUrl);

      const filled: string[] = [];
      if (d.name && !name.trim()) { setName(d.name); filled.push("nom"); }
      if (d.description && !brandDescription.trim()) { setBrandDescription(d.description); filled.push("description"); }
      if (d.sector && !sector) {
        // Le modèle rend un secteur en clair : on le rattache à la liste, sinon « Autre ».
        const guess = d.sector.toLowerCase();
        const hit = SECTORS.find(x => guess.includes(x.value.toLowerCase()) || x.label.toLowerCase().includes(guess));
        setSector(hit ? hit.value : "Autre");
        filled.push("secteur");
      }
      if (d.tone && !tone) {
        const guess = String(d.tone).toLowerCase();
        const hit = TONES.find(x => guess.includes(x.value.toLowerCase()));
        if (hit) { setTone(hit.value); filled.push("ton"); }
      }
      if (Array.isArray(d.wordsToUse) && d.wordsToUse.length && !wordsToUse.trim()) {
        setWordsToUse(d.wordsToUse.join(", ")); filled.push("mots à privilégier");
      }
      if (Array.isArray(d.wordsToAvoid) && d.wordsToAvoid.length && !wordsToAvoid.trim()) {
        setWordsToAvoid(d.wordsToAvoid.join(", ")); filled.push("mots à éviter");
      }
      if (Array.isArray(d.colors) && d.colors.length) {
        setPrimaryColor(d.colors[0]);
        if (d.colors[1]) setSecondaryColor(d.colors[1]);
        if (d.colors[2]) setAccentColor(d.colors[2]);
        filled.push(d.colors.length > 1 ? "couleurs" : "couleur principale");
      }
      if (Array.isArray(d.fonts) && d.fonts.length) {
        setSiteFonts(d.fonts);
        // La police du site n'existe pas forcément dans le catalogue : on ne
        // l'applique que si on la retrouve, et on l'affiche dans tous les cas.
        const pool = googleFonts.length ? googleFonts : FALLBACK_FONTS;
        const match = d.fonts
          .map((f: string) => pool.find(g => g.family.toLowerCase() === String(f).toLowerCase()))
          .find(Boolean);
        setSiteFontMatched(!!match);
        if (match) { setFontPrimary(match.family); filled.push("typographie"); }
      }
      setSiteFilled(filled);
      setSiteStepIdx(SITE_STEPS.length);
      setSitePhase("result");
    } catch {
      setSiteError("Analyse impossible. Vérifiez l'adresse et réessayez.");
      setSitePhase("ask");
    } finally {
      clearInterval(ticker);
      setSiteBusy(false);
    }
  };

  // Fetch Google Fonts catalog on step 4 mount
  useEffect(() => {
    if (step !== 4) return;
    if (googleFonts.length > 0) return;
    setFontsLoading(true);
    fetch("/api/google-fonts")
      .then(r => r.json())
      .then(data => setGoogleFonts(Array.isArray(data) ? data : FALLBACK_FONTS))
      .catch(() => setGoogleFonts(FALLBACK_FONTS))
      .finally(() => setFontsLoading(false));
  }, [step, googleFonts.length]);

  // Pre-load primary font for preview card whenever it changes
  useEffect(() => {
    if (step === 4 && !customPrimary && fontPrimary) loadGoogleFont(fontPrimary);
  }, [step, fontPrimary, customPrimary]);

  // ── Filtered font lists ───────────────────────────────────────────────────

  const fontSource = googleFonts.length > 0 ? googleFonts : FALLBACK_FONTS;

  const filteredFonts = useMemo(() => {
    const q = fontSearch.trim().toLowerCase();
    if (!q) return fontSource.slice(0, FONT_LIST_LIMIT);
    return fontSource.filter(f => f.family.toLowerCase().includes(q));
  }, [fontSource, fontSearch]);

  const filteredFontsSecondary = useMemo(() => {
    const q = fontSearchSecondary.trim().toLowerCase();
    const base = fontSource.filter(f => f.family !== activeFontPrimary);
    if (!q) return base.slice(0, FONT_LIST_LIMIT);
    return base.filter(f => f.family.toLowerCase().includes(q));
  }, [fontSource, fontSearchSecondary, activeFontPrimary]);

  // ── Custom font handler ───────────────────────────────────────────────────

  // Import d'une FAMILLE : on accepte plusieurs fichiers d'un coup (et
  // plusieurs sélections successives — chaque appel VIENT S'AJOUTER aux
  // fichiers déjà choisis pour cet emplacement, il ne les remplace pas). On
  // déduit la graisse et l'italique de chaque nom, et on déclare tout au
  // navigateur pour que l'aperçu montre les vraies graisses.
  function handleFontFamilyFiles(files: File[], target: "primary" | "secondary") {
    if (files.length === 0) return;
    setFontFiles(prev => [...prev, ...files]);
    for (const f of files) {
      const { family, weight, italic } = parseFontFile(f.name);
      const blobUrl = URL.createObjectURL(f);
      const style = document.createElement("style");
      style.textContent = `@font-face { font-family: "${family}"; src: url("${blobUrl}"); font-weight: ${weight}; font-style: ${italic ? "italic" : "normal"}; }`;
      document.head.appendChild(style);
    }
    const setFiles = target === "primary" ? setCustomPrimaryFiles : setCustomSecondaryFiles;
    setFiles(prev => [...prev, ...files]);
  }

  // ── File upload helpers ───────────────────────────────────────────────────

  // Rapatrie une image TROUVÉE SUR LE SITE du client dans notre Storage.
  //
  // Le logo était détecté à l'analyse, affiché à l'écran… puis jeté : seul un
  // fichier téléversé à la main finissait en base. L'utilisateur voyait donc son
  // logo pendant l'onboarding et se retrouvait sans logo à l'arrivée.
  //
  // On passe par /api/proxy-image : même origine, donc pas de CORS, et c'est déjà
  // le chemin utilisé partout ailleurs pour lire les images distantes.
  async function importRemoteImage(url: string, bucket: string, userId: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
      if (!res.ok) return null;
      const blob = await res.blob();
      // Un logo de plusieurs mégaoctets est presque toujours une erreur de
      // détection (photo d'ambiance prise pour un logo) : on ne l'importe pas.
      if (!blob.type.startsWith('image/') || blob.size > 3 * 1024 * 1024) return null;
      const ext = blob.type.includes('svg') ? 'svg' : blob.type.includes('png') ? 'png' : 'jpg';
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: blob.type });
      if (error) { console.warn('[importRemoteImage] envoi impossible :', error.message); return null; }
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    } catch (err) {
      console.warn('[importRemoteImage] échec :', err);
      return null;
    }
  }

  async function uploadFile(file: File, bucket: string, userId: string): Promise<string | null> {
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, file);
      if (uploadErr) {
        console.error(`Upload [${bucket}] "${file.name}":`, uploadErr.message);
        return null;
      }
      return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    } catch (err) {
      console.error(`Upload [${bucket}] "${file.name}" unexpected:`, err);
      return null;
    }
  }

  // ── Create workspace ──────────────────────────────────────────────────────

  // Crée le client en base dès la première visite de l'étape 5 (une seule
  // fois : appels suivants renvoient l'id déjà obtenu). C'est ce qui permet
  // d'ouvrir ensuite le VRAI éditeur de templates — celui de toute l'app,
  // pas une maquette à part — puisqu'il lui faut un workspace réel pour
  // écrire ses lignes dans post_templates.
  async function ensureWorkspaceCreated(): Promise<string | null> {
    if (createdWorkspaceId) return createdWorkspaceId;
    setError(null);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return null; }

      // Ensure Supabase Storage buckets exist (created server-side with service role)
      try {
        await fetch("/api/ensure-buckets", { method: "POST" });
      } catch (err) {
        console.warn("[ensure-buckets] could not reach API:", err);
      }

      // Brand asset uploads (each wrapped independently)
      let logoUrl: string | null = null;
      let logoDarkUrl: string | null = null;
      let brandIconUrl: string | null = null;
      const assetUrls: string[] = [];
      if (logoFile)      logoUrl      = await uploadFile(logoFile,      "brand-assets", user.id);
      if (logoDarkFile)  logoDarkUrl  = await uploadFile(logoDarkFile,  "brand-assets", user.id);
      if (brandIconFile) brandIconUrl = await uploadFile(brandIconFile, "brand-assets", user.id);
      // Rien de téléversé mais quelque chose de trouvé sur le site : on le prend.
      // Un fichier choisi à la main prime toujours — l'automatique ne remplace
      // jamais un choix explicite, il comble une absence.
      if (!logoUrl && siteLogo)      logoUrl      = await importRemoteImage(siteLogo, "brand-assets", user.id);
      if (!brandIconUrl && siteIcon) brandIconUrl = await importRemoteImage(siteIcon, "brand-assets", user.id);
      for (const f of assetFiles) {
        const url = await uploadFile(f, "brand-assets", user.id);
        if (url) assetUrls.push(url);
      }

      // Custom font uploads (each wrapped independently)
      let fontPrimaryUrl: string | null = null;
      let fontSecondaryUrl: string | null = null;
      if (customPrimary) {
        fontPrimaryUrl   = await uploadFile(customPrimary.file,   "brand-fonts", user.id);
      }
      if (customSecondary) {
        fontSecondaryUrl = await uploadFile(customSecondary.file, "brand-fonts", user.id);
      }

      // Familles complètes : on téléverse CHAQUE variante et on les regroupe.
      // C'est ce qui permet à l'éditeur de proposer ensuite toutes les graisses.
      let brandFonts: FontFamily[] = [];
      if (fontFiles.length > 0) {
        const uploaded: { name: string; url: string }[] = [];
        for (const f of fontFiles) {
          const url = await uploadFile(f, "brand-fonts", user.id);
          if (url) uploaded.push({ name: f.name, url });
        }
        brandFonts = groupFontFiles(uploaded);
      }

      // Legacy brand_voice_prompt for backward compat
      const voiceParts: string[] = [];
      if (tone)                  voiceParts.push(`Ton : ${tone}`);
      if (wordsToUse.trim())     voiceParts.push(`Mots à utiliser : ${wordsToUse.trim()}`);
      if (wordsToAvoid.trim())   voiceParts.push(`Mots à ne jamais utiliser : ${wordsToAvoid.trim()}`);
      if (captionExample.trim()) voiceParts.push(`Exemple de caption : ${captionExample.trim()}`);

      // ── Server-side insert (logs errors to Vercel, bypasses RLS) ──────────
      const res = await fetch("/api/workspace/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          // Step 1
          sector: sector || null,
          instagram_username: instagramHandle.replace(/^@/, "").trim() || null,
          company_description: brandDescription.trim() || null,
          // Step 2
          tone: tone || null,
          words_to_use: wordsToUse.trim() || null,
          words_to_avoid: wordsToAvoid.trim() || null,
          caption_examples: captionExample.trim() || null,
          brand_voice_prompt: voiceParts.join("\n") || null,
          // Step 3
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          subtitle_style_id: subtitleStyleId,
          subtitle_custom: subtitleCustom,
          subtitle_pos: subPos,
          subtitle_max_words: subMaxWords,
          logo_url: logoUrl,
          logo_dark_url: logoDarkUrl,
          brand_assets: assetUrls,
          brand_icon_url: brandIconUrl,
          // Step 4
          font_family: activeFontPrimary,
          font_primary_url: fontPrimaryUrl,
          font_secondary: activeFontSecondary || null,
          font_secondary_url: fontSecondaryUrl,
          brand_fonts: brandFonts,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.workspace) {
        console.error("[ensureWorkspaceCreated] API error:", json);
        throw new Error(json.error || json.hint || t('errorApiFallback'));
      }
      const data = json.workspace;
      setCreatedWorkspaceId(data.id);
      setLoading(false);
      return data.id as string;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('errorGeneric');
      console.error("[ensureWorkspaceCreated] caught:", e);
      setError(msg);
      setLoading(false);
      return null;
    }
  }

  // Étape 5 : le client existe dès qu'on l'atteint (cf. useEffect plus bas).
  // « Créer un template » saute directement dans le vrai éditeur ; « Terminer »
  // rejoint le tableau de bord — les deux s'assurent d'abord que la création a
  // fini, au cas où l'utilisateur cliquerait avant la fin de l'appel réseau.
  async function goCreateTemplate() {
    const id = await ensureWorkspaceCreated();
    if (id) router.push(`/workspace/${id}/template-editor/new`);
  }
  async function finishOnboarding() {
    const id = await ensureWorkspaceCreated();
    if (id) router.push(`/workspace/${id}?welcome=true`);
  }

  // Le client est créé dès l'arrivée sur l'étape 5, avec tout ce que les
  // étapes précédentes ont rempli — c'est ce qui permet au bouton « Créer un
  // template » d'ouvrir tout de suite le vrai éditeur.
  useEffect(() => {
    if (step === 5 && !createdWorkspaceId && !loading) {
      void ensureWorkspaceCreated();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Combien de templates ce client a-t-il déjà (utile si l'utilisateur revient
  // sur l'étape après un aller-retour dans le vrai éditeur, onglet précédent).
  useEffect(() => {
    if (!createdWorkspaceId) return;
    let cancelled = false;
    supabase.from("post_templates").select("id", { count: "exact", head: true })
      .eq("workspace_id", createdWorkspaceId)
      .then(({ count }) => { if (!cancelled) setTemplateCount(count ?? 0); });
    return () => { cancelled = true; };
  }, [createdWorkspaceId, supabase]);

  const canContinue = step === 1 ? name.trim().length > 0 : true;

  // ── Écran d'entrée ────────────────────────────────────────────────────────
  // Trois temps sur la même page : on demande le lien, on montre la recherche,
  // on présente ce qui a été trouvé. Le cadre de l'application reste en place —
  // barre latérale et barre haute — pour qu'on sache toujours où l'on est.
  if (step === 0) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#FFFFFF" }}>
        {/* La pastille de signalement recouvrait les actions de cet écran. */}
        <Sidebar hideBeta />
        <div className="wsx" style={{ marginLeft: "var(--sb-w)" }}>
          <div className="wsx-body">
            <div className="wsx-inner">

              {/* ── 1. On demande ─────────────────────────────────────────── */}
              {sitePhase === "ask" && (
                <>
                  <h1 className="wsx-h1">
                    La charte, à partir<br />du <span className="acc-hl">site</span>.
                  </h1>
                  <p className="wsx-sub">
                    Collez l&apos;adresse du site de la marque. On y lit ses couleurs, sa
                    typographie et sa façon de parler, puis on remplit sa fiche —
                    vous n&apos;aurez plus qu&apos;à corriger ce qui ne va pas.
                  </p>
                  <div className="wsx-field">
                    <input
                      className="wsx-input"
                      value={website}
                      onChange={e => { setWebsite(e.target.value); setSiteError(null); }}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void analyzeWebsite(); } }}
                      placeholder="smashy-burger.fr"
                      inputMode="url"
                      autoFocus
                      aria-label="Adresse du site de la marque"
                    />
                    <button type="button" className="wsx-go" onClick={() => void analyzeWebsite()} disabled={!website.trim()}>
                      Analyser
                    </button>
                  </div>
                  {siteError
                    ? <p className="wsx-err">{siteError}</p>
                    : <p className="wsx-note">Rien à installer. On lit la page publique, c&apos;est tout.</p>}
                  <div className="wsx-skip">
                    <button type="button" onClick={() => setStep(1)}>Passer, je remplis à la main</button>
                    <span className="wsx-rule" />
                  </div>
                </>
              )}

              {/* ── 2. On cherche ─────────────────────────────────────────── */}
              {sitePhase === "searching" && (
                <>
                  <h1 className="wsx-h1 wsx-h1-sm">
                    On lit <span className="acc-hl">{website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                  </h1>
                  <p className="wsx-sub">Quelques secondes, le temps de parcourir la page.</p>
                  <ol className="wsx-steps">
                    {SITE_STEPS.map((label, i) => {
                      const state = i < siteStepIdx ? "done" : i === siteStepIdx ? "now" : "wait";
                      return (
                        <li key={label} className={`wsx-step is-${state}`}>
                          <span className="wsx-step-dot">
                            {state === "done" && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M4 12.5l5 5 11-11" /></svg>
                            )}
                          </span>
                          {label}
                        </li>
                      );
                    })}
                  </ol>
                </>
              )}

              {/* ── 3. On relit ───────────────────────────────────────────── */}
              {sitePhase === "result" && (
                <>
                  <h1 className="wsx-h1 wsx-h1-sm">
                    Voilà ce qu&apos;on a <span className="acc-hl">trouvé</span>.
                  </h1>
                  <p className="wsx-sub">
                    Une lecture automatique se trompe parfois : relisez, corrigez sur place.
                    Ce que vous validez ici devient la charte de la marque.
                  </p>

                  <div className="wsx-cards">
                    <div className="wsx-card wsx-card-wide">
                      <span className="wsx-card-t">Nom de la marque</span>
                      <input className="wsx-in" value={name} onChange={e => setName(e.target.value)} placeholder="Nom de la marque" />
                    </div>

                    <div className="wsx-card">
                      <span className="wsx-card-t">Logo</span>
                      {siteLogo ? (
                        <div className="wsx-logo">
                          {/* Passé par le proxy : beaucoup de sites refusent l'affichage direct. */}
                          <img src={`/api/proxy-image?url=${encodeURIComponent(siteLogo)}`} alt="" />
                        </div>
                      ) : (
                        <p className="wsx-empty">Aucun logo identifié avec certitude. Vous l&apos;ajouterez à l&apos;étape identité visuelle.</p>
                      )}
                    </div>

                    <div className="wsx-card">
                      <span className="wsx-card-t">Couleurs</span>
                      {/* Le nuancier de l'application, pas celui du système : mêmes
                          teintes de charte, pipette et réglage fin, comme dans l'éditeur. */}
                      <div className="wsx-cols">
                        {([["Principale", primaryColor, setPrimaryColor],
                           ["Secondaire", secondaryColor, setSecondaryColor],
                           ["Accent", accentColor, setAccentColor]] as const).map(([lbl, val, set]) => (
                          <div key={lbl} className="wsx-col">
                            <ColorPicker value={val} onChange={set} brandColors={[primaryColor, secondaryColor, accentColor]} />
                            <span className="wsx-col-l">{lbl}</span>
                            <span className="wsx-col-h">{val.toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="wsx-card wsx-card-wide">
                      <span className="wsx-card-t">Typographie</span>
                      {siteFontMatched ? (
                        <>
                          <p className="wsx-font" style={{ fontFamily: `"${activeFontPrimary}", sans-serif` }}>{activeFontPrimary}</p>
                          <p className="wsx-empty">Trouvée sur le site et disponible ici.</p>
                        </>
                      ) : siteFonts.length > 0 ? (
                        <>
                          <p className="wsx-font" style={{ fontFamily: `"${activeFontPrimary}", sans-serif` }}>{activeFontPrimary}</p>
                          <p className="wsx-empty">
                            Repérées sur le site : {siteFonts.join(", ")} — aucune ne figure dans notre
                            catalogue. Vous choisirez la plus proche, ou importerez le fichier de police,
                            à l&apos;étape typographie. En attendant, {activeFontPrimary} sert de base.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="wsx-font" style={{ fontFamily: `"${activeFontPrimary}", sans-serif` }}>{activeFontPrimary}</p>
                          <p className="wsx-empty">
                            Ce site ne déclare pas ses polices de façon lisible — c&apos;est fréquent.
                            Vous la choisirez, ou importerez son fichier, à l&apos;étape typographie.
                          </p>
                        </>
                      )}
                    </div>

                    <div className="wsx-card wsx-card-wide">
                      <span className="wsx-card-t">Ce que fait la marque</span>
                      <textarea className="wsx-in wsx-ta" value={brandDescription} onChange={e => setBrandDescription(e.target.value)} rows={3} placeholder="En deux phrases" />
                    </div>

                    <div className="wsx-card wsx-card-wide">
                      <span className="wsx-card-t">Secteur</span>
                      <div className="wsx-chips">
                        {SECTORS.map(sc => (
                          <button key={sc.value} type="button" onClick={() => setSector(sector === sc.value ? "" : sc.value)}
                            className={"wsx-chip" + (sector === sc.value ? " is-on" : "")}>
                            {sc.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(wordsToUse || wordsToAvoid) && (
                      <div className="wsx-card wsx-card-wide">
                        <span className="wsx-card-t">Vocabulaire</span>
                        <input className="wsx-in" value={wordsToUse} onChange={e => setWordsToUse(e.target.value)} placeholder="Mots à privilégier" />
                        <input className="wsx-in" style={{ marginTop: 8 }} value={wordsToAvoid} onChange={e => setWordsToAvoid(e.target.value)} placeholder="Mots à éviter" />
                      </div>
                    )}
                  </div>

                  <div className="wsx-actions">
                    <button type="button" className="wsx-go" onClick={() => setStep(1)}>Continuer</button>
                    <button type="button" className="wsx-again" onClick={() => { setSitePhase("ask"); setSiteFilled(null); }}>
                      Analyser un autre site
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh",
      // Fond blanc franc : c'est le premier écran que voit un nouveau client,
      // il doit respirer. La structure vient des rythmes et des filets, pas d'un
      // fond teinté.
      background: "#FFFFFF" }}>
      {/* Masquée sur tout le parcours de création : la pastille se posait sur la
          barre d'actions du bas et empêchait de cliquer « Continuer ». */}
      <Sidebar hideBeta />

      <div className="ws-new-shell" style={{ marginLeft: "var(--sb-w)", flex: 1, display: "grid", gridTemplateColumns: "minmax(0,1fr)" }}>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* ── Progress header ───────────────────────────────────────────────── */}
        <header className="ws-new-header" style={{ padding: "28px 40px 0", flexShrink: 0 }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            {/* Eyebrow + compteur : on situe où l'on en est avant de lire le titre. */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".14em", color: "var(--mint-2)", fontFamily: "var(--sans)" }}>
                Nouveau client
              </span>
              <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" }}>
                {step} / {STEP_LABELS.length}
              </span>
            </div>

            {/* Barre segmentée : plus graphique qu'une file de ronds reliés, et on
                lit l'avancement d'un coup d'œil plutôt qu'en comptant les cercles. */}
            <div className="ws-new-stepper-full" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ display: "flex", gap: 5 }}>
                {STEP_LABELS.map((_, i) => {
                  const n = i + 1;
                  return (
                    <span key={n} style={{ flex: 1, height: 5, borderRadius: 99, transition: "background .25s",
                      background: n < step ? "var(--leaf)" : n === step ? "var(--forest)" : "rgba(12,42,29,.12)" }} />
                  );
                })}
              </div>
              <div className="ws-new-step-labels" style={{ display: "flex", gap: 5 }}>
                {STEP_LABELS.map((label, i) => {
                  const n = i + 1;
                  const active = n === step;
                  return (
                    <span key={n} style={{ flex: 1, fontSize: 11, fontWeight: active ? 800 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      color: active ? "var(--ink)" : n < step ? "var(--ink-2)" : "var(--ink-3)" }}>{label}</span>
                  );
                })}
              </div>
            </div>

            {/* Mobile stepper — compact circles + active label */}
            <div className="ws-new-stepper-mobile" style={{ display: "none", alignItems: "center", gap: 4 }}>
              {STEP_LABELS.map((label, i) => {
                const n = i + 1;
                const active = n === step;
                const done = n < step;
                return (
                  <Fragment key={n}>
                    {i > 0 && (
                      <div style={{ width: 14, height: 2, background: done ? "var(--leaf)" : "var(--line)", flexShrink: 0, borderRadius: 2 }} />
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: active ? 6 : 0 }}>
                      <div style={{
                        width: active ? 36 : 28, height: active ? 36 : 28, borderRadius: "50%",
                        background: done ? "var(--leaf)" : active ? "var(--forest)" : "var(--sunk)",
                        color: done ? "var(--mint-ink)" : active ? "#fff" : "var(--ink-3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 800, flexShrink: 0, transition: "all .2s",
                      }}>
                        {done
                          ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          : n}
                      </div>
                      {active && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap" }}>{label}</span>
                      )}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
        </header>

        {/* ── Step content ──────────────────────────────────────────────────── */}
        <main className="ws-new-main" style={{ flex: 1, overflowY: "auto", padding: "0 40px" }}>
          <div style={{ maxWidth: 680, margin: "0 auto", paddingTop: 40, paddingBottom: 120 }}>

            {/* ─── STEP 1 — Infos de base ─── */}
            {step === 1 && (
              <div key="step1" className="screen-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <h1 className="ws-new-step-title" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 30, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 8 }}>
                    {t('step1Title')}
                  </h1>
                  <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                    {t('step1Subtitle')}
                  </p>
                </div>

                <div>
                  <label style={labelStyle}>{t('clientNameLabel')}</label>
                  <input
                    style={inputStyle}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t('clientNamePlaceholder')}
                  />
                </div>

                <div>
                  <label style={labelStyle}>{t('sectorLabel')}</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {SECTORS.map(s => (
                      <button
                        key={s.value} type="button"
                        onClick={() => setSector(sector === s.value ? "" : s.value)}
                        className={"wsn-chip" + (sector === s.value ? " is-on" : "")}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>{t('igHandleLabel')} <OptLabel /></label>
                  <div style={{ position: "relative" }}>
                    <span className="ws-new-at" style={{
                      position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                      color: "var(--ink-3)", fontWeight: 700, fontSize: 14, pointerEvents: "none", lineHeight: 1,
                    }}>@</span>
                    <input
                      style={{ ...inputStyle, paddingLeft: 32 }}
                      value={instagramHandle}
                      onChange={e => setInstagramHandle(e.target.value.replace(/^@/, ""))}
                      placeholder="nomdubrand"
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>{t('brandDescLabel')}</label>
                  <textarea
                    style={{ ...inputStyle, resize: "none", minHeight: 90, lineHeight: 1.6 }}
                    value={brandDescription}
                    onChange={e => setBrandDescription(e.target.value)}
                    placeholder={t('brandDescPlaceholder')}
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* ─── STEP 2 — Voix de marque ─── */}
            {step === 2 && (
              <div key="step2" className="screen-in" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                <div>
                  <h1 className="ws-new-step-title" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 30, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 8 }}>
                    {t('step2Title')}
                  </h1>
                  <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                    {t('step2Subtitle')}
                  </p>
                </div>

                <div>
                  <label style={labelStyle}>{t('toneLabel')}</label>
                  <div className="ws-new-3col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {TONES.map(tn => {
                      const active = tone === tn.value;
                      return (
                        <button
                          key={tn.value} type="button"
                          onClick={() => setTone(tone === tn.value ? "" : tn.value)}
                          style={{
                            padding: "14px 14px", borderRadius: 13, textAlign: "left",
                            border: "none",
                            boxShadow: active ? "inset 0 0 0 2px var(--leaf-ink)" : "none",
                            background: active ? "var(--leaf-soft)" : "var(--white)",
                            cursor: "pointer", transition: "all 0.15s",
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 14, color: active ? "var(--leaf-ink)" : "var(--ink)", marginBottom: 4 }}>
                            {tn.label}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.4 }}>
                            {tn.desc}
                          </div>
                        </button>
                      );
                    })}
                    {/* Tons ajoutés à la main : même case, sans description. */}
                    {customTones.map(ct => {
                      const active = tone === ct;
                      return (
                        <div key={ct} style={{ position: "relative" }}>
                          <button
                            type="button"
                            onClick={() => setTone(tone === ct ? "" : ct)}
                            style={{
                              width: "100%", padding: "14px 14px", borderRadius: 13, textAlign: "left",
                              border: "none",
                            boxShadow: active ? "inset 0 0 0 2px var(--leaf-ink)" : "none",
                              background: active ? "var(--leaf-soft)" : "var(--white)",
                              cursor: "pointer", transition: "all 0.15s",
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: 14, color: active ? "var(--leaf-ink)" : "var(--ink)", marginBottom: 4 }}>
                              {ct}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.4 }}>{t('toneCustomTag')}</div>
                          </button>
                          <button
                            type="button"
                            title={t('remove')}
                            onClick={() => { setCustomTones(prev => prev.filter(x => x !== ct)); if (tone === ct) setTone(""); }}
                            style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: "50%", background: "var(--sunk)", color: "var(--ink-3)", border: "none", cursor: "pointer", fontSize: 12, lineHeight: 1, display: "grid", placeItems: "center" }}
                          >×</button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Ajout d'un ton maison */}
                  <div style={{ display: "flex", gap: 8, marginTop: 10, maxWidth: 420 }}>
                    <input
                      value={newTone}
                      onChange={e => setNewTone(e.target.value)}
                      onKeyDown={e => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const v = newTone.trim();
                        if (!v) return;
                        if (![...TONES.map(x => x.value), ...customTones].some(x => x.toLowerCase() === v.toLowerCase())) {
                          setCustomTones(prev => [...prev, v]);
                        }
                        setTone(v);
                        setNewTone("");
                      }}
                      placeholder={t('toneAddPh')}
                      className="input"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={!newTone.trim()}
                      onClick={() => {
                        const v = newTone.trim();
                        if (!v) return;
                        if (![...TONES.map(x => x.value), ...customTones].some(x => x.toLowerCase() === v.toLowerCase())) {
                          setCustomTones(prev => [...prev, v]);
                        }
                        setTone(v);
                        setNewTone("");
                      }}
                      style={{ flexShrink: 0, opacity: newTone.trim() ? 1 : 0.45 }}
                    >
                      {t('add')}
                    </button>
                  </div>
                </div>

                <div className="ws-upload-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>{t('wordsUseLabel')} <OptLabel /></label>
                    <input
                      style={inputStyle}
                      value={wordsToUse}
                      onChange={e => setWordsToUse(e.target.value)}
                      placeholder={t('wordsUsePlaceholder')}
                    />
                    <span style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 5, display: "block" }}>
                      {t('commaSeparated')}
                    </span>
                  </div>
                  <div>
                    <label style={labelStyle}>{t('wordsAvoidLabel')} <OptLabel /></label>
                    <input
                      style={inputStyle}
                      value={wordsToAvoid}
                      onChange={e => setWordsToAvoid(e.target.value)}
                      placeholder={t('wordsAvoidPlaceholder')}
                    />
                    <span style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 5, display: "block" }}>
                      {t('commaSeparated')}
                    </span>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>{t('captionExampleLabel')} <OptLabel /></label>
                  <textarea
                    style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }}
                    value={captionExample}
                    onChange={e => setCaptionExample(e.target.value)}
                    placeholder={t('captionExamplePlaceholder')}
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* ─── STEP 3 — Identité visuelle ─── */}
            {step === 3 && (
              <div key="step3" className="screen-in" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                <div>
                  <h1 className="ws-new-step-title" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 30, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 8 }}>
                    {t('step3Title')}
                  </h1>
                  <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                    {t('step3Subtitle')}
                  </p>
                </div>

                {/* Colors */}
                <div>
                  <label style={labelStyle}>{t('brandColorsLabel')}</label>
                  <div className="ws-new-3col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    {[
                      { label: t('colorPrimary'), value: primaryColor, onChange: setPrimaryColor },
                      { label: t('colorSecondary'), value: secondaryColor, onChange: setSecondaryColor },
                      { label: t('colorAccent'), value: accentColor, onChange: setAccentColor },
                    ].map(col => (
                      <div key={col.label} className="card" style={{ padding: "14px 16px" }}>
                        <span style={{ ...labelStyle, marginBottom: 12, display: "block" }}>{col.label}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <ColorPicker value={col.value} onChange={col.onChange} />
                          <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 12, color: "var(--ink)", textTransform: "uppercase" }}>
                            {col.value}
                          </span>
                        </div>
                        <div style={{
                          width: "100%", height: 6, borderRadius: 99, marginTop: 12,
                          background: col.value, boxShadow: "inset 0 0 0 1px rgba(13,15,10,.08)",
                        }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Brand icon */}
                <div>
                  <label style={labelStyle}>{t('brandIconLabel')} <OptLabel /></label>
                  <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10 }}>{t('brandIconHint')}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 12, background: "var(--sunk)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {brandIconPreview
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={brandIconPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      }
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => brandIconRef.current?.click()} className="btn btn-ghost btn-sm">
                        {brandIconPreview ? t('replace') : t('chooseImage')}
                      </button>
                      {brandIconPreview && (
                        <button type="button" onClick={() => { setBrandIconFile(null); setBrandIconPreview(null); }} className="btn btn-ghost btn-sm" style={{ color: "var(--warn)" }}>{t('remove')}</button>
                      )}
                    </div>
                  </div>
                  <input ref={brandIconRef} type="file" accept=".png,.jpg,.jpeg,.svg" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setBrandIconFile(f); setBrandIconPreview(URL.createObjectURL(f)); } }}
                  />
                </div>

                {/* Logos */}
                <div>
                  <label style={labelStyle}>{t('logosLabel')}</label>
                  <div className="ws-upload-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {/* Le logo trouvé sur le site s'affiche ici tant que rien n'a
                        été téléversé : il était détecté puis invisible à cette
                        étape, et l'utilisateur croyait n'avoir aucun logo.
                        « Retirer » l'écarte aussi de l'enregistrement. */}
                    <UploadZone
                      label={t('logoMainLabel')}
                      hint={siteLogo && !logoPreview ? t('logoFromSite') : t('logoMainHint')}
                      preview={logoPreview ?? (siteLogo ? `/api/proxy-image?url=${encodeURIComponent(siteLogo)}` : null)}
                      dark={false}
                      onClick={() => logoRef.current?.click()}
                      onRemove={() => { setLogoFile(null); setLogoPreview(null); setSiteLogo(null); }}
                    />
                    <input ref={logoRef} type="file" accept=".png,.svg,.jpg,.jpeg" style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); } }}
                    />

                    <UploadZone
                      label={<>{t('logoVariantLabel')} <OptLabel /></>}
                      hint={t('logoVariantHint')}
                      preview={logoDarkPreview}
                      dark={true}
                      onClick={() => logoDarkRef.current?.click()}
                      onRemove={() => { setLogoDarkFile(null); setLogoDarkPreview(null); }}
                    />
                    <input ref={logoDarkRef} type="file" accept=".png,.svg,.jpg,.jpeg" style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) { setLogoDarkFile(f); setLogoDarkPreview(URL.createObjectURL(f)); } }}
                    />
                  </div>
                </div>

                {/* Brand assets */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>
                      {t('extraAssetsLabel')} <OptLabel />{" "}
                      <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--ink-3)" }}>— {assetFiles.length}/5</span>
                    </label>
                    {assetFiles.length < 5 && (
                      <button type="button" onClick={() => assetsRef.current?.click()}
                        style={{ fontSize: 12, fontWeight: 700, color: "var(--mint-2)", background: "none", border: "none", cursor: "pointer" }}>
                        + {t('add')}
                      </button>
                    )}
                  </div>
                  <input ref={assetsRef} type="file" accept=".png,.svg,.jpg,.jpeg" multiple style={{ display: "none" }}
                    onChange={e => {
                      const files = Array.from(e.target.files ?? []);
                      const added = files.slice(0, 5 - assetFiles.length);
                      setAssetFiles(prev => [...prev, ...added]);
                      setAssetPreviews(prev => [...prev, ...added.map(f => URL.createObjectURL(f))]);
                      e.target.value = "";
                    }}
                  />
                  {assetPreviews.length > 0 ? (
                    <div className="ws-new-5col" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                      {assetPreviews.map((url, i) => (
                        <div key={i} style={{ position: "relative" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "contain", borderRadius: 10, background: "var(--sunk)", padding: 6, display: "block" }} />
                          <button type="button"
                            onClick={() => { setAssetFiles(f => f.filter((_, j) => j !== i)); setAssetPreviews(p => p.filter((_, j) => j !== i)); }}
                            style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.55)", border: "none", cursor: "pointer", color: "#fff", fontSize: 12, display: "grid", placeItems: "center" }}>
                            ×
                          </button>
                        </div>
                      ))}
                      {assetFiles.length < 5 && (
                        <div onClick={() => assetsRef.current?.click()}
                          style={{ aspectRatio: "1", borderRadius: 10, border: "2px solid var(--line)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-3)", fontSize: 22 }}>
                          +
                        </div>
                      )}
                    </div>
                  ) : (
                    <div onClick={() => assetsRef.current?.click()}
                      style={{ border: "2px solid var(--line)", borderRadius: 13, padding: 20, background: "var(--white)", cursor: "pointer", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--ink-3)", fontSize: 13 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                      </svg>
                      {t('extraAssetsHint')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── STEP 4 — Typographie ─── */}
            {step === 4 && (
              <div key="step4" className="screen-in" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                <div>
                  <h1 className="ws-new-step-title" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 30, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 8 }}>
                    {t('step4Title')}
                  </h1>
                  <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                    {t('step4Subtitle')}{" "}
                    {googleFonts.length > 0 && (
                      <span style={{ color: "var(--ink-3)" }}>{t('fontsAvailable', { count: googleFonts.length })}</span>
                    )}
                  </p>
                </div>

                {/* ── Police principale ─────────────────────────────────── */}
                <div>
                  <label style={labelStyle}>{t('primaryFontLabel')}</label>

                  {/* Custom font banner */}
                  {customPrimary && (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: 10, marginBottom: 10,
                      background: "var(--mint-soft)", border: "1px solid var(--leaf)",
                    }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mint-2)", display: "block" }}>
                          {t('customFontActive')}
                        </span>
                        <span style={{ fontFamily: `"${customPrimary.family}", sans-serif`, fontSize: 16, color: "var(--ink)" }}>
                          {customPrimary.family}
                        </span>
                        {/* Confirme que TOUS les fichiers sélectionnés ont bien
                            été pris en compte — pas juste le dernier. */}
                        <span style={{ fontSize: 11.5, color: "var(--ink-3)", display: "block", marginTop: 1 }}>
                          {t('customFontVariants', { count: customPrimary.variantsCount })}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button type="button"
                          onClick={() => customPrimaryRef.current?.click()}
                          style={{ fontSize: 12, fontWeight: 700, color: "var(--mint-2)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
                          {t('addMoreWeights')}
                        </button>
                        <button type="button"
                          onClick={() => setCustomPrimary(null)}
                          style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
                          {t('removeFont')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Search */}
                  <input
                    style={{ ...inputStyle, marginBottom: 6 }}
                    value={fontSearch}
                    onChange={e => setFontSearch(e.target.value)}
                    placeholder={t('searchFontPlaceholder')}
                    autoFocus
                  />

                  {/* Font list */}
                  <div style={{
                    maxHeight: 300, overflowY: "auto",
                    border: "none", borderRadius: 13,
                    background: "var(--white)",
                  }}>
                    {fontsLoading ? (
                      <div style={{ padding: "18px 16px", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>
                        {t('loadingCatalog')}
                      </div>
                    ) : filteredFonts.length === 0 ? (
                      <div style={{ padding: "16px 14px", fontSize: 13, color: "var(--ink-3)" }}>
                        {t('noFontFound')}
                      </div>
                    ) : (
                      <>
                        {filteredFonts.map(font => (
                          <FontRow
                            key={font.family}
                            family={font.family}
                            selected={!customPrimary && fontPrimary === font.family}
                            onSelect={() => { setFontPrimary(font.family); setCustomPrimary(null); }}
                          />
                        ))}
                        {!fontSearch && googleFonts.length > FONT_LIST_LIMIT && (
                          <div style={{ padding: "10px 16px", fontSize: 12, color: "var(--ink-3)", borderTop: "1px solid rgba(13,15,10,.05)", textAlign: "center" }}>
                            {t('moreOthersSearch', { count: googleFonts.length - FONT_LIST_LIMIT })}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
                    <div style={{ flex: 1, height: 1, background: "var(--line-2)" }} />
                    <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>{t('or')}</span>
                    <div style={{ flex: 1, height: 1, background: "var(--line-2)" }} />
                  </div>

                  {/* Custom font upload */}
                  <button type="button"
                    onClick={() => customPrimaryRef.current?.click()}
                    style={{
                      width: "100%", padding: "11px 16px", borderRadius: 13,
                      border: "none", background: "var(--btn-soft)",
                      cursor: "pointer", fontSize: 13, color: "var(--ink-2)", fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: "border-color 0.15s, color 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--leaf)"; e.currentTarget.style.color = "var(--mint-2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(13,15,10,.20)"; e.currentTarget.style.color = "var(--ink-2)"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                    {t('uploadCustomFont')}
                  </button>
                  <input ref={customPrimaryRef} type="file" accept=".ttf,.otf,.woff,.woff2" multiple style={{ display: "none" }}
                    onChange={e => { handleFontFamilyFiles(Array.from(e.target.files ?? []), "primary"); e.target.value = ""; }}
                  />
                </div>

                {/* ── Live preview card ─────────────────────────────────── */}
                <div className="card" style={{ padding: "24px 28px" }}>
                  <span style={{ ...labelStyle, display: "block", marginBottom: 16 }}>
                    {t('previewLabel', { font: customPrimary ? customPrimary.family : fontPrimary })}
                  </span>
                  <p style={{
                    fontFamily: `"${activeFontPrimary}", sans-serif`,
                    fontSize: 32, fontWeight: 700, color: "var(--ink)",
                    lineHeight: 1.15, margin: 0,
                  }}>
                    {t('previewHeading')}
                  </p>
                  <p style={{
                    fontFamily: `"${activeFontPrimary}", sans-serif`,
                    fontSize: 14, color: "var(--ink-2)", margin: "12px 0 0", lineHeight: 1.6,
                  }}>
                    {t('previewBody')}
                  </p>
                  {activeFontSecondary && (
                    <p style={{
                      fontFamily: `"${activeFontSecondary}", sans-serif`,
                      fontSize: 14, color: "var(--ink-3)", margin: "8px 0 0", lineHeight: 1.6,
                      borderTop: "1px solid var(--line-2)", paddingTop: 8,
                    }}>
                      {t('secondaryFontPreview', { font: activeFontSecondary })}
                    </p>
                  )}
                </div>

                {/* ── Police secondaire ─────────────────────────────────── */}
                <div>
                  <label style={labelStyle}>{t('secondaryFontLabel')} <OptLabel /></label>

                  {/* Custom secondary banner */}
                  {customSecondary && (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: 10, marginBottom: 10,
                      background: "var(--mint-soft)", border: "1px solid var(--leaf)",
                    }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mint-2)", display: "block" }}>{t('customFontLabel')}</span>
                        <span style={{ fontFamily: `"${customSecondary.family}", sans-serif`, fontSize: 16, color: "var(--ink)" }}>
                          {customSecondary.family}
                        </span>
                        <span style={{ fontSize: 11.5, color: "var(--ink-3)", display: "block", marginTop: 1 }}>
                          {t('customFontVariants', { count: customSecondary.variantsCount })}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button type="button"
                          onClick={() => customSecondaryRef.current?.click()}
                          style={{ fontSize: 12, fontWeight: 700, color: "var(--mint-2)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
                          {t('addMoreWeights')}
                        </button>
                        <button type="button" onClick={() => setCustomSecondary(null)}
                          style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
                          {t('removeFont')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Search */}
                  <input
                    style={{ ...inputStyle, marginBottom: 6 }}
                    value={fontSearchSecondary}
                    onChange={e => setFontSearchSecondary(e.target.value)}
                    placeholder={t('searchSecondaryFontPlaceholder')}
                  />

                  {/* Font list */}
                  <div style={{
                    maxHeight: 220, overflowY: "auto",
                    border: "none", borderRadius: 13, background: "var(--white)",
                  }}>
                    {/* "Aucune" option */}
                    <button type="button"
                      onClick={() => { setFontSecondary(""); setCustomSecondary(null); }}
                      style={{
                        width: "100%", padding: "10px 16px", textAlign: "left", border: "none",
                        borderBottom: "1px solid rgba(13,15,10,.05)",
                        background: !fontSecondary && !customSecondary ? "var(--mint-soft)" : "transparent",
                        cursor: "pointer", fontSize: 13, fontWeight: 600,
                        color: !fontSecondary && !customSecondary ? "var(--mint-2)" : "var(--ink-3)",
                      }}>
                      {t('none')}
                    </button>
                    {filteredFontsSecondary.map(font => (
                      <FontRow
                        key={font.family}
                        family={font.family}
                        selected={!customSecondary && fontSecondary === font.family}
                        onSelect={() => { setFontSecondary(font.family); setCustomSecondary(null); }}
                      />
                    ))}
                    {!fontSearchSecondary && googleFonts.length > FONT_LIST_LIMIT && (
                      <div style={{ padding: "10px 16px", fontSize: 12, color: "var(--ink-3)", textAlign: "center" }}>
                        {t('moreOthersRefine', { count: googleFonts.length - FONT_LIST_LIMIT })}
                      </div>
                    )}
                  </div>

                  {/* Custom secondary upload */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
                    <div style={{ flex: 1, height: 1, background: "var(--line-2)" }} />
                    <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>{t('or')}</span>
                    <div style={{ flex: 1, height: 1, background: "var(--line-2)" }} />
                  </div>
                  <button type="button"
                    onClick={() => customSecondaryRef.current?.click()}
                    style={{
                      width: "100%", padding: "11px 16px", borderRadius: 13,
                      border: "none", background: "var(--btn-soft)",
                      cursor: "pointer", fontSize: 13, color: "var(--ink-2)", fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: "border-color 0.15s, color 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--leaf)"; e.currentTarget.style.color = "var(--mint-2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(13,15,10,.20)"; e.currentTarget.style.color = "var(--ink-2)"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                    {t('uploadCustomFont')}
                  </button>
                  <input ref={customSecondaryRef} type="file" accept=".ttf,.otf,.woff,.woff2" multiple style={{ display: "none" }}
                    onChange={e => { handleFontFamilyFiles(Array.from(e.target.files ?? []), "secondary"); e.target.value = ""; }}
                  />
                </div>

                {error && (
                  <div style={{
                    padding: "12px 16px", borderRadius: "var(--r-s)",
                    background: "var(--warn-soft)", border: "1px solid rgba(200,115,43,.25)",
                    color: "var(--warn)", fontSize: 13, fontWeight: 600,
                  }}>
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* ─── STEP 5 — Templates ─── */}
            {step === 5 && (
              <div key="step5" className="screen-in" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                <div>
                  <h1 className="ws-new-step-title" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 30, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 8 }}>
                    {t('step5Title')}
                  </h1>
                  <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                    {t('step5Subtitle', { name: name || t('thisClientFallback') })}{" "}
                    <span style={{ color: "var(--ink-3)" }}>{t('optionalStep')}</span>
                  </p>
                </div>

                {/* ── Template de sous-titres — dérivé de la charte (couleurs + typo) ── */}
                <div>
                  <label style={labelStyle}>{t('subtitleTemplateLabel')}</label>
                  <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 12 }}>{t('subtitleTemplateHint')}</p>

                  {/* Propositions à la charte */}
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
                    {subPresets.map((p) => {
                      const active = subPresetId === p.id;
                      return (
                        <button type="button" key={p.id} onClick={() => applySubPreset(p)}
                          style={{ flexShrink: 0, width: 150, textAlign: "left", padding: 0, borderRadius: 12, overflow: "hidden", cursor: "pointer",
                            border: "none", background: "var(--sunk)",
                            boxShadow: active ? "inset 0 0 0 2px var(--leaf-ink)" : "none", transition: "box-shadow .15s" }}>
                          <div style={{ height: 78, background: "linear-gradient(135deg,#242a20,#0b110a)", display: "grid", placeItems: "center", padding: 8 }}>
                            <SubChip styleId={p.styleId} custom={p.custom} />
                          </div>
                          <div style={{ padding: "8px 10px" }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{t(`subPresetName.${p.id}`)}</div>
                            <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{t(`subPresetHint.${p.id}`)}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Personnalisation libre (comme dans l'éditeur de montage) */}
                  <button type="button" onClick={() => setSubAdvanced(v => !v)}
                    style={{ marginTop: 10, background: "none", border: "none", padding: 0, cursor: "pointer",
                      fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ transform: subAdvanced ? "rotate(90deg)" : "none", transition: "transform .15s", display: "inline-flex" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </span>
                    {t('subCustomizeToggle')}
                  </button>

                  {subAdvanced && (
                    <div className="card sub-editor-grid" style={{ marginTop: 12, padding: 16, display: "grid", gridTemplateColumns: "minmax(0,240px) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
                      {/* Aperçu « comme sur la vidéo » — on juge la lisibilité et on place le texte */}
                      <div>
                        <span style={{ ...labelStyle, marginBottom: 8 }}>{t('subPreviewLabel')}</span>
                        <SubtitlePreviewStage
                          styleId={subtitleStyleId}
                          custom={subtitleCustom}
                          pos={subPos}
                          onPosChange={setSubPos}
                          onScaleChange={(scale) => { setSubPresetId(null); setSubtitleCustom((c) => ({ ...c, scale })); }}
                          maxWords={subMaxWords}
                          editableTextLabel={t('subTextPlaceholder')}
                          fontSize={14}
                        />
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
                          <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: 0, lineHeight: 1.4 }}>{t('subPreviewHint')}</p>
                          <button type="button" onClick={() => setSubPos(DEFAULT_SUB_POS)} className="btn btn-ghost btn-sm" style={{ flexShrink: 0, fontSize: 11 }}>
                            {t('subPosReset')}
                          </button>
                        </div>

                        {/* Longueur des sous-titres — combien de mots apparaissent à la
                            fois, exactement comme dans l'éditeur de montage. */}
                        <div style={{ marginTop: 14 }}>
                          <span style={{ ...labelStyle, marginBottom: 6 }}>{t('subLengthLabel')}</span>
                          <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "0 0 8px" }}>{t('subLengthHint')}</p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {SUB_LENGTHS.map((l) => (
                              <button type="button" key={l.words} onClick={() => setSubMaxWords(l.words)}
                                className={subMaxWords === l.words ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
                                style={{ fontSize: 11, padding: "4px 9px" }}>
                                {tc(`subLength.${SUB_LENGTH_KEY[l.words] ?? "four"}`)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Tous les réglages — composant partagé avec l'éditeur de montage */}
                      <div>
                        <SubtitleStyleEditor
                          styleId={subtitleStyleId}
                          custom={subtitleCustom}
                          onChange={(next) => { setSubPresetId(null); setSubtitleCustom(next); }}
                          brandFont={activeFontPrimary}
                          labels={subEditorLabels}
                        />
                        <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "14px 0 0" }}>{t('subCustomizeNote')}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Création de template — le VRAI éditeur, celui de toute
                    l'app (rail + panneau Canva, modèles, IA), pas une
                    maquette à part. Un nouveau template y arrive déjà avec
                    photo, voile et deux blocs de texte à la couleur et à la
                    police du client. */}
                <div style={{ border: "2px solid rgba(13,15,10,.15)", borderRadius: 16, padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(13,15,10,.05)", display: "grid", placeItems: "center" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px" }}>
                      {templateCount > 0 ? t('templatesSavedNote', { count: templateCount }) : t('noTemplateYet')}
                    </p>
                    <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0 }}>
                      {t('noTemplateHint')}
                    </p>
                  </div>
                  <button
                    onClick={goCreateTemplate}
                    disabled={loading}
                    style={{
                      padding: "11px 28px", borderRadius: 13, background: "var(--ink)",
                      border: "none", color: "var(--paper)", fontSize: 14, fontWeight: 700,
                      cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1,
                      fontFamily: "var(--display)", transition: "opacity 0.15s",
                    }}
                  >
                    {templateCount > 0 ? t('add') : t('createTemplate')}
                  </button>
                </div>

                {error && (
                  <div style={{ padding: "12px 16px", borderRadius: "var(--r-s)", background: "var(--warn-soft)", border: "1px solid rgba(200,115,43,.25)", color: "var(--warn)", fontSize: 13, fontWeight: 600 }}>
                    {error}
                  </div>
                )}
              </div>
            )}

          </div>
        </main>

        {/* ── Navigation footer ─────────────────────────────────────────────── */}
        <footer className="ws-new-footer" style={{
          position: "fixed", bottom: 0,
          left: "var(--sb-w)", right: 0,
          background: "color-mix(in srgb, var(--canvas) 92%, transparent)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid var(--line-2)",
          padding: "16px 40px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          zIndex: 50,
        }}>
          <div className="ws-new-footer-left">
            {step > 0 && (
              <button type="button" onClick={() => setStep(s => s - 1)}
                style={{
                  padding: "10px 20px", borderRadius: 13,
                  border: "none", background: "var(--btn-soft)", color: "var(--ink-2)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>
                {t('back')}
              </button>
            )}
          </div>

          <div className="ws-new-footer-right" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="ws-new-footer-count" style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--mono)", fontWeight: 700 }}>
              {step} / {STEP_LABELS.length}
            </span>

            {/* Step 5: skip link */}
            {step === 5 && templateCount === 0 && (
              <button type="button" onClick={finishOnboarding} disabled={loading}
                style={{ padding: "8px 16px", borderRadius: 10, background: "transparent", border: "none", color: "var(--ink-3)", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
                {t('skipStep')}
              </button>
            )}

            {step < 5 ? (
              <button type="button" onClick={() => setStep(s => s + 1)} disabled={!canContinue}
                className="ws-new-footer-btn"
                style={{
                  padding: "11px 30px", borderRadius: 13,
                  background: canContinue ? "var(--leaf)" : "var(--sunk)",
                  border: "none",
                  color: canContinue ? "var(--mint-ink)" : "var(--ink-3)",
                  fontSize: 14, fontWeight: 700,
                  cursor: canContinue ? "pointer" : "not-allowed",
                  fontFamily: "var(--display)", transition: "all 0.15s",
                }}>
                {t('continueBtn')}
              </button>
            ) : (
              <button type="button" onClick={finishOnboarding} disabled={loading}
                className="ws-new-footer-btn"
                style={{
                  padding: "11px 30px", borderRadius: 13,
                  background: "var(--leaf)", border: "none",
                  color: "var(--mint-ink)", fontSize: 14, fontWeight: 700,
                  cursor: loading ? "default" : "pointer",
                  fontFamily: "var(--display)", transition: "all 0.15s",
                  opacity: loading ? 0.7 : 1,
                }}>
                {loading ? t('creating') : createdWorkspaceId ? t('finishBtn') : t('createWorkspaceBtn')}
              </button>
            )}
          </div>
        </footer>
        </div>

        {/* Plateau de composition : la marque du client s'assemble à mesure qu'on
            remplit. C'est ce qui fait passer l'écran du formulaire à l'outil. */}

        {/* ── Mobile back button — fixed top-left ───────────────────────────── */}
        {step > 1 && (
          <button
            type="button"
            className="ws-new-back-mobile"
            onClick={() => setStep(s => s - 1)}
            style={{
              display: "none", position: "fixed", top: 12, left: 12, zIndex: 200,
              padding: "8px 14px", borderRadius: 10,
              background: "var(--white)", border: "1px solid var(--line)",
              fontSize: 13, fontWeight: 600, color: "var(--ink-2)", cursor: "pointer",
              alignItems: "center", gap: 4,
              boxShadow: "0 2px 8px rgba(13,15,10,.08)",
            }}
          >
            {t('back')}
          </button>
        )}

      </div>
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function OptLabel() {
  return (
    <span style={{ fontWeight: 400, textTransform: "none" as const, letterSpacing: 0, color: "var(--ink-3)", fontSize: 10 }}>
      {" "}(optionnel)
    </span>
  );
}

function UploadZone({
  label, hint, preview, dark, onClick, onRemove,
}: {
  label: React.ReactNode;
  hint: string;
  preview: string | null;
  dark: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div
        onClick={preview ? undefined : onClick}
        style={{
          border: "2px solid var(--line)", borderRadius: 13,
          padding: "18px 14px", minHeight: 100,
          background: dark ? "#1A1A1A" : "var(--white)",
          cursor: preview ? "default" : "pointer",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 8,
          position: "relative", overflow: "hidden",
        }}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" style={{ maxHeight: 68, maxWidth: "100%", objectFit: "contain" }} />
            <button type="button"
              onClick={e => { e.stopPropagation(); onRemove(); }}
              style={{
                position: "absolute", top: 8, right: 8,
                width: 22, height: 22, borderRadius: "50%",
                background: "rgba(0,0,0,.5)", border: "none",
                cursor: "pointer", color: "#fff", fontSize: 13,
                display: "grid", placeItems: "center",
              }}>
              ×
            </button>
          </>
        ) : (
          <>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dark ? "#666" : "var(--ink-3)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            <span style={{ fontSize: 12, color: dark ? "#666" : "var(--ink-3)", textAlign: "center" }}>{hint}</span>
          </>
        )}
      </div>
    </div>
  );
}
