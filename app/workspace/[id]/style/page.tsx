"use client";

import { useState, useRef, useEffect, useMemo, CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";
import ColorPicker from "@/components/ColorPicker";
import NotificationBell from "@/components/NotificationBell";
import { MiniTemplatePreview, type BgStyle } from "@/components/TemplateEditor";
import { fontCssHref, CATALOG_FAMILIES } from "@/lib/fontCatalog";
import { parseFontFile, groupFontFiles, registerFontFamily, type FontFamily } from "@/lib/fontFiles";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "charte" | "templates";
interface GFont { family: string; category: string }
/** Une police importée dans la charte.
 *  `files` porte TOUTES les variantes déposées (Regular, Bold, Italic…) : la
 *  page n'en gardait qu'une, et le client perdait ses graisses au passage. */
interface CustomFont { file: File; family: string; blobUrl: string; files: File[] }
interface PostTemplate {
  id: string; workspace_id: string; name: string; format_id: string;
  background_style: BgStyle; text_zones: unknown[]; logo_placement: { x: number; y: number; width: number; height: number } | null;
  thumbnail_url: string | null; sort_order: number; created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Ces valeurs (secteur, ton) sont sauvegardées en base et utilisées dans le prompt
// IA — on garde les identifiants français, affichés traduits via les clés *Key.
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

const FORMAT_KEYS: Record<string, string> = {
  "ig-portrait": "formatPortraitLabel",
  "ig-square":   "formatSquareLabel",
  "ig-story":    "formatStoryLabel",
  "facebook":    "formatFacebookLabel",
};

// Le repli servait vingt-cinq familles Google très vues. Le catalogue maison
// passe devant : c'est lui qui décide de quoi a l'air une charte KLIP.
const FALLBACK_FONTS: GFont[] = CATALOG_FAMILIES.map(f => ({ family: f, category: "sans-serif" }));

const FONT_LIST_LIMIT = 100;

// ─── Font loader ──────────────────────────────────────────────────────────────

const _gfLoaded = new Set<string>();
// L'aperçu du sélecteur doit montrer la VRAIE police : une famille Fontshare
// demandée à Google ne renvoie rien, et la ligne s'affichait dans la police
// système — toutes les propositions se ressemblaient alors.
function loadGoogleFont(family: string) {
  if (!family || _gfLoaded.has(family)) return;
  _gfLoaded.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = fontCssHref(family);
  document.head.appendChild(link);
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelStyle: CSSProperties = {
  display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700,
  color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em",
  fontFamily: "var(--display)",
};

const inputStyle: CSSProperties = {
  width: "100%", background: "var(--white)", border: "1px solid var(--line)",
  borderRadius: "var(--r)", padding: "10px 14px", fontSize: 13.5, color: "var(--ink)",
  outline: "none", fontFamily: "var(--sans)", boxSizing: "border-box",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 24, marginBottom: 16 }}>
      <p style={{ ...labelStyle, marginBottom: 18 }}>{title}</p>
      {children}
    </div>
  );
}

function FontRow({ family, selected, onSelect }: { family: string; selected: boolean; onSelect: () => void }) {
  const t = useTranslations('workspaceStyle');
  const ref = useRef<HTMLButtonElement>(null);
  const loaded = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loaded.current) { loaded.current = true; loadGoogleFont(family); }
    }, { rootMargin: "200px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [family]);
  return (
    <button ref={ref} type="button" onClick={onSelect} style={{
      width: "100%", padding: "10px 14px", textAlign: "left", border: "none",
      borderBottom: "1px solid rgba(13,15,10,.04)",
      background: selected ? "var(--mint-soft)" : "transparent",
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
      transition: "background 0.1s",
    }}>
      <div>
        <span style={{ fontFamily: `"${family}", sans-serif`, fontSize: 17, lineHeight: 1.25, color: selected ? "var(--mint-2)" : "var(--ink)", display: "block" }}>
          {t('previewHeading')}
        </span>
        <span style={{ fontSize: 11, color: selected ? "var(--mint-2)" : "var(--ink-3)", fontFamily: "var(--sans)", fontWeight: 600 }}>{family}</span>
      </div>
      {selected && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--mint-2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 6 9 17l-5-5"/></svg>}
    </button>
  );
}

function UploadZone({ label, hint, preview, dark, onClick, onRemove }: {
  label: React.ReactNode; hint: string; preview: string | null;
  dark: boolean; onClick: () => void; onRemove: () => void;
}) {
  const t = useTranslations('workspaceStyle');
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div onClick={preview ? undefined : onClick} style={{
        border: "2px solid var(--line)", borderRadius: "var(--r-l)", padding: "18px 14px", minHeight: 90,
        background: dark ? "#1A1A1A" : "var(--white)", cursor: preview ? "default" : "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
        position: "relative", overflow: "hidden",
      }}>
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" style={{ maxHeight: 68, maxWidth: "100%", objectFit: "contain" }} />
            <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }}
              style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: "none", cursor: "pointer", color: "#fff", fontSize: 13, display: "grid", placeItems: "center" }}>×</button>
            <button type="button" onClick={onClick}
              style={{ marginTop: 4, fontSize: 12, color: dark ? "#888" : "var(--ink-3)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>{t('replace')}</button>
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? "#666" : "var(--ink-3)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            <span style={{ fontSize: 12, color: dark ? "#666" : "var(--ink-3)", textAlign: "center" }}>{hint}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StyleTemplatePage() {
  const t = useTranslations('workspaceStyle');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const SECTORS = SECTOR_KEYS.map(([value, key]) => ({ value, label: t(key) }));
  const TONES = TONE_KEYS.map(([value, labelKey, descKey]) => ({ value, label: t(labelKey), desc: t(descKey) }));
  const FORMATS: Record<string, string> = Object.fromEntries(Object.entries(FORMAT_KEYS).map(([id, key]) => [id, t(key)]));

  const [tab, setTab] = useState<Tab>("charte");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("…");

  // ── Identité ────────────────────────────────────────────────────────────────
  const [name, setName]                 = useState("");
  const [sector, setSector]             = useState("");
  const [instagram, setInstagram]       = useState("");
  const [brandDesc, setBrandDesc]       = useState("");

  // ── Voix de marque ──────────────────────────────────────────────────────────
  const [tone, setTone]                 = useState("");
  const [wordsUse, setWordsUse]         = useState("");
  const [wordsAvoid, setWordsAvoid]     = useState("");
  const [captionEx, setCaptionEx]       = useState("");

  // ── Analyse IA du style Instagram ────────────────────────────────────────────
  interface StyleAnalysis {
    postsAnalyzed: number;
    hasStats: boolean;
    summary: string;
    strengths: string[];
    improvements: string[];
    suggestedDescriptionStyle: string;
    bestCaption: string;
  }
  const [analyzing, setAnalyzing]       = useState(false);
  const [analysis, setAnalysis]         = useState<StyleAnalysis | null>(null);
  const [analysisErr, setAnalysisErr]   = useState<string | null>(null);
  const [styleApplied, setStyleApplied] = useState(false);

  async function runStyleAnalysis() {
    setAnalyzing(true); setAnalysisErr(null); setAnalysis(null); setStyleApplied(false);
    try {
      const res = await fetch("/api/instagram/analyze-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });
      const data = await res.json();
      if (!res.ok) { setAnalysisErr(data.error || t('analysisImpossible')); return; }
      setAnalysis(data as StyleAnalysis);
    } catch {
      setAnalysisErr(t('networkError'));
    } finally {
      setAnalyzing(false);
    }
  }

  async function applyStyleAnalysis() {
    if (!analysis) return;
    // Persiste directement : description_style guide la génération et n'est pas
    // écrasé par la sauvegarde manuelle (qui ne touche que brand_voice_prompt).
    try {
      await supabase.from("workspaces").update({
        description_style: analysis.suggestedDescriptionStyle || null,
        caption_examples: analysis.bestCaption || null,
      }).eq("id", id);
      if (analysis.bestCaption) setCaptionEx(analysis.bestCaption);
      setStyleApplied(true);
      setToast(t('styleAppliedToast'));
      setTimeout(() => setToast(null), 2600);
    } catch {
      setAnalysisErr(t('applyStyleError'));
    }
  }

  // ── Couleurs ────────────────────────────────────────────────────────────────
  const [colorPrimary, setColorPrimary]     = useState("#0038FF");
  const [colorSecondary, setColorSecondary] = useState("#FFFFFF");
  const [colorAccent, setColorAccent]       = useState("#BDF2A0");

  // ── Assets ──────────────────────────────────────────────────────────────────
  const logoRef      = useRef<HTMLInputElement>(null);
  const logoDarkRef  = useRef<HTMLInputElement>(null);
  const assetsRef    = useRef<HTMLInputElement>(null);
  const brandIconRef = useRef<HTMLInputElement>(null);
  const bannerRef    = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile]               = useState<File | null>(null);
  const [logoPreview, setLogoPreview]         = useState<string | null>(null);
  const [logoUrl, setLogoUrl]                 = useState<string | null>(null);
  const [bannerFile, setBannerFile]           = useState<File | null>(null);
  const [bannerPreview, setBannerPreview]     = useState<string | null>(null);
  const [bannerUrl, setBannerUrl]             = useState<string | null>(null);
  const [logoDarkFile, setLogoDarkFile]       = useState<File | null>(null);
  const [logoDarkPreview, setLogoDarkPreview] = useState<string | null>(null);
  const [logoDarkUrl, setLogoDarkUrl]         = useState<string | null>(null);
  const [assetFiles, setAssetFiles]           = useState<File[]>([]);
  const [assetPreviews, setAssetPreviews]     = useState<string[]>([]);
  const [existingAssets, setExistingAssets]   = useState<string[]>([]);
  const [brandIconFile, setBrandIconFile]     = useState<File | null>(null);
  const [brandIconPreview, setBrandIconPreview] = useState<string | null>(null);
  const [brandIconUrl, setBrandIconUrl]       = useState<string | null>(null);

  // ── Typographie ─────────────────────────────────────────────────────────────
  const [googleFonts, setGoogleFonts]             = useState<GFont[]>([]);
  const [fontsLoading, setFontsLoading]           = useState(false);
  const [fontPrimary, setFontPrimary]             = useState("Oswald");
  const [fontSecondary, setFontSecondary]         = useState("");
  const [fontSearch, setFontSearch]               = useState("");
  const [fontSearchSec, setFontSearchSec]         = useState("");
  const customPrimaryRef   = useRef<HTMLInputElement>(null);
  const customSecondaryRef = useRef<HTMLInputElement>(null);
  /** Familles déjà enregistrées pour ce client, relues pour être fusionnées et
   *  non écrasées : `brand_fonts` n'était écrit qu'à la CRÉATION du client, donc
   *  toute police importée ensuite depuis cette page était perdue. */
  const [brandFonts, setBrandFonts]           = useState<FontFamily[]>([]);
  const [customPrimary, setCustomPrimary]     = useState<CustomFont | null>(null);
  const [customSecondary, setCustomSecondary] = useState<CustomFont | null>(null);
  const activeFontPrimary   = customPrimary   ? customPrimary.family   : fontPrimary;
  const activeFontSecondary = customSecondary ? customSecondary.family : fontSecondary;

  // ── Templates ───────────────────────────────────────────────────────────────
  const [templates, setTemplates]               = useState<PostTemplate[]>([]);
  const [tplLoading, setTplLoading]             = useState(false);
  const [deleteId, setDeleteId]                 = useState<string | null>(null);

  // ── Load workspace ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("workspaces").select("*").eq("id", id).single();
      if (data) {
        setWorkspaceName(data.name ?? "…");
        setName(data.name ?? "");
        setSector(data.sector ?? "");
        setInstagram(data.instagram_username ?? "");
        setBrandDesc(data.company_description ?? "");
        setTone(data.tone ?? "");
        setWordsUse(data.words_to_use ?? "");
        setWordsAvoid(data.words_to_avoid ?? "");
        setCaptionEx(data.caption_examples ?? "");
        setColorPrimary(data.primary_color ?? "#0038FF");
        setColorSecondary(data.secondary_color ?? "#FFFFFF");
        setColorAccent(data.accent_color ?? "#BDF2A0");
        setLogoUrl(data.logo_url ?? null);
        setLogoPreview(data.logo_url ?? null);
        setBannerUrl(data.banner_url ?? null);
        setBannerPreview(data.banner_url ?? null);
        setLogoDarkUrl(data.logo_dark_url ?? null);
        setLogoDarkPreview(data.logo_dark_url ?? null);
        setBrandIconUrl(data.brand_icon_url ?? null);
        setBrandIconPreview(data.brand_icon_url ?? null);
        setExistingAssets(Array.isArray(data.brand_assets) ? data.brand_assets : []);
        // Les familles importées sont déclarées au navigateur AVANT l'aperçu :
        // sans ça, la page rendait le nom de la police du client dans la police
        // système, ce qui se lit comme « ma police n'a pas été enregistrée ».
        const famsEnBase = Array.isArray(data.brand_fonts) ? (data.brand_fonts as FontFamily[]) : [];
        setBrandFonts(famsEnBase);
        for (const fam of famsEnBase) {
          if (fam?.family && Array.isArray(fam.variants) && fam.variants.length) registerFontFamily(fam);
        }
        const famillesImportees = new Set(famsEnBase.map(f => f.family));
        if (data.font_family) setFontPrimary(data.font_family);
        if (data.font_secondary) setFontSecondary(data.font_secondary);
        // Une police importée n'existe pas chez Google : la demander produisait
        // un 404 à chaque ouverture de la page.
        if (data.font_family && !data.font_primary_url && !famillesImportees.has(data.font_family)) loadGoogleFont(data.font_family);
        if (data.font_secondary && !data.font_secondary_url && !famillesImportees.has(data.font_secondary)) loadGoogleFont(data.font_secondary);
        if (data.font_primary_url && data.font_family) {
          const styleId = "klip-custom-font-primary";
          if (!document.getElementById(styleId)) {
            const s = document.createElement("style"); s.id = styleId;
            s.textContent = `@font-face { font-family: "${data.font_family}"; src: url("${data.font_primary_url}"); }`;
            document.head.appendChild(s);
          }
          setCustomPrimary({ file: new File([], ""), family: data.font_family, blobUrl: data.font_primary_url, files: [] });
        }
        if (data.font_secondary_url && data.font_secondary) {
          const styleId = "klip-custom-font-secondary";
          if (!document.getElementById(styleId)) {
            const s = document.createElement("style"); s.id = styleId;
            s.textContent = `@font-face { font-family: "${data.font_secondary}"; src: url("${data.font_secondary_url}"); }`;
            document.head.appendChild(s);
          }
          setCustomSecondary({ file: new File([], ""), family: data.font_secondary, blobUrl: data.font_secondary_url, files: [] });
        }
      }
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  // ── Load templates when tab switches ────────────────────────────────────────
  useEffect(() => {
    if (tab !== "templates") return;
    setTplLoading(true);
    fetch(`/api/templates?workspaceId=${id}`)
      .then(r => r.json())
      .then(d => setTemplates(d.templates ?? []))
      .catch(() => {})
      .finally(() => setTplLoading(false));
  }, [tab, id]);

  // ── Load Google Fonts ────────────────────────────────────────────────────────
  useEffect(() => {
    if (googleFonts.length > 0) return;
    setFontsLoading(true);
    fetch("/api/google-fonts")
      .then(r => r.json())
      .then(d => setGoogleFonts(Array.isArray(d) ? d : FALLBACK_FONTS))
      .catch(() => setGoogleFonts(FALLBACK_FONTS))
      .finally(() => setFontsLoading(false));
  }, [googleFonts.length]);

  // ── Load active fonts on change ──────────────────────────────────────────────
  useEffect(() => { if (!customPrimary) loadGoogleFont(fontPrimary); }, [fontPrimary, customPrimary]);
  useEffect(() => { if (fontSecondary && !customSecondary) loadGoogleFont(fontSecondary); }, [fontSecondary, customSecondary]);

  // ── Font lists ───────────────────────────────────────────────────────────────
  const fontSource = googleFonts.length > 0 ? googleFonts : FALLBACK_FONTS;
  const filteredFonts = useMemo(() => {
    const q = fontSearch.trim().toLowerCase();
    return q ? fontSource.filter(f => f.family.toLowerCase().includes(q)) : fontSource.slice(0, FONT_LIST_LIMIT);
  }, [fontSource, fontSearch]);
  const filteredFontsSec = useMemo(() => {
    const q = fontSearchSec.trim().toLowerCase();
    const base = fontSource.filter(f => f.family !== activeFontPrimary);
    return q ? base.filter(f => f.family.toLowerCase().includes(q)) : base.slice(0, FONT_LIST_LIMIT);
  }, [fontSource, fontSearchSec, activeFontPrimary]);

  // ── File upload helper ───────────────────────────────────────────────────────
  //
  // Les échecs étaient renvoyés en `null` et personne ne les lisait : un fichier
  // de police refusé par le stockage (type MIME inconnu, quota, règle d'accès)
  // faisait enregistrer la charte SANS sa police, et l'écran annonçait quand
  // même « charte mise à jour ». D'où l'impression que l'enregistrement ne
  // marche pas alors qu'il marche : c'est le fichier qui n'est jamais parti.
  const echecsTeleversement = useRef<string[]>([]);
  async function uploadFile(file: File, bucket: string): Promise<string | null> {
    if (!file.size) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { echecsTeleversement.current.push(`${file.name} : session expirée`); return null; }
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) {
      console.error(`[charte] téléversement refusé (${bucket}/${file.name})`, error);
      echecsTeleversement.current.push(`${file.name} : ${error.message}`);
      return null;
    }
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  // ── Custom font handler ──────────────────────────────────────────────────────
  // UNE FAMILLE ARRIVE EN PLUSIEURS FICHIERS.
  //
  // La page n'acceptait qu'un fichier par rôle et déduisait la famille du nom
  // complet : « Obviously-Bold.otf » devenait la famille « Obviously Bold ».
  // Le client perdait toutes ses graisses, et la police importée ne portait pas
  // le même nom que celle enregistrée à la création du client — d'où
  // l'impression qu'elle « n'arrivait pas » dans l'éditeur.
  //
  // Même lecture qu'à la création : on analyse chaque nom de fichier, on en tire
  // la famille et la graisse, et on garde le lot entier.
  function handleCustomFont(fileList: FileList, target: "primary" | "secondary") {
    const files = Array.from(fileList);
    if (!files.length) return;
    // La famille est celle qui revient le plus souvent dans le lot : déposer
    // huit fichiers d'une même police ne doit pas en faire huit familles.
    const compte = new Map<string, number>();
    for (const f of files) {
      const fam = parseFontFile(f.name).family;
      compte.set(fam, (compte.get(fam) ?? 0) + 1);
    }
    const family = Array.from(compte.entries()).sort((a, b) => b[1] - a[1])[0][0];
    // L'aperçu se fait sur la variante la plus proche du Regular.
    const apercu = files.slice().sort((a, b) =>
      Math.abs(parseFontFile(a.name).weight - 400) - Math.abs(parseFontFile(b.name).weight - 400))[0];
    const blobUrl = URL.createObjectURL(apercu);
    const styleId = `klip-custom-font-${target}`;
    document.getElementById(styleId)?.remove();
    const s = document.createElement("style"); s.id = styleId;
    s.textContent = `@font-face { font-family: "${family}"; src: url("${blobUrl}"); }`;
    document.head.appendChild(s);
    const valeur: CustomFont = { file: apercu, family, blobUrl, files };
    if (target === "primary") setCustomPrimary(valeur);
    else setCustomSecondary(valeur);
  }

  // ── Toast ────────────────────────────────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // ── Save charte ──────────────────────────────────────────────────────────────
  async function handleSaveCharte() {
    setSaving(true);
    echecsTeleversement.current = [];
    try {
      await fetch("/api/ensure-buckets", { method: "POST" }).catch(() => {});

      let finalLogoUrl      = logoUrl;
      let finalLogoDarkUrl  = logoDarkUrl;
      let finalBrandIconUrl = brandIconUrl;
      let finalFontPrimaryUrl: string | null = null;
      let finalFontSecondaryUrl: string | null = null;

      let finalBannerUrl = bannerUrl;
      if (logoFile)      finalLogoUrl      = await uploadFile(logoFile,      "brand-assets");
      if (logoDarkFile)  finalLogoDarkUrl  = await uploadFile(logoDarkFile,  "brand-assets");
      if (brandIconFile) finalBrandIconUrl = await uploadFile(brandIconFile, "brand-assets");
      if (bannerFile)    finalBannerUrl    = await uploadFile(bannerFile,    "brand-assets");

      const newAssetUrls: string[] = [];
      for (const f of assetFiles) { const u = await uploadFile(f, "brand-assets"); if (u) newAssetUrls.push(u); }

      if (customPrimary?.file?.size)   finalFontPrimaryUrl   = await uploadFile(customPrimary.file, "brand-fonts");
      if (customSecondary?.file?.size) finalFontSecondaryUrl = await uploadFile(customSecondary.file, "brand-fonts");

      // LES FAMILLES ENTIÈRES, ENFIN ENREGISTRÉES.
      //
      // `brand_fonts` n'était écrit qu'au moment de créer le client. Modifier la
      // charte ensuite ne mettait à jour que `font_family` et son unique fichier :
      // l'éditeur continuait donc à proposer les familles du premier jour, et la
      // police fraîchement importée n'apparaissait jamais dans ses graisses.
      // C'est le défaut rapporté — « j'ai changé la typo de la charte, l'éditeur
      // n'a pas suivi ».
      //
      // On fusionne par NOM de famille : réimporter un Bold manquant complète la
      // famille au lieu de la remplacer, et les polices des autres charges du
      // compte ne sont jamais touchées.
      const nouvellesFamilles: FontFamily[] = [];
      for (const lot of [customPrimary?.files ?? [], customSecondary?.files ?? []]) {
        if (!lot.length) continue;
        const televerses: { name: string; url: string }[] = [];
        for (const f of lot) {
          const u = await uploadFile(f, "brand-fonts");
          if (u) televerses.push({ name: f.name, url: u });
        }
        if (televerses.length) nouvellesFamilles.push(...groupFontFiles(televerses));
      }
      let famillesFinales = brandFonts;
      if (nouvellesFamilles.length) {
        const parNom = new Map(brandFonts.map(f => [f.family, f]));
        for (const nf of nouvellesFamilles) {
          const deja = parNom.get(nf.family);
          if (!deja) { parNom.set(nf.family, nf); continue; }
          // Fusion des variantes : une graisse déjà connue garde son URL.
          const vues = new Set(deja.variants.map(v => `${v.weight}-${v.italic}`));
          const ajout = nf.variants.filter(v => !vues.has(`${v.weight}-${v.italic}`));
          parNom.set(nf.family, { family: nf.family, variants: [...deja.variants, ...ajout].sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic)) });
        }
        famillesFinales = Array.from(parNom.values());
        setBrandFonts(famillesFinales);
      }

      const voiceParts: string[] = [];
      if (tone)              voiceParts.push(`Ton : ${tone}`);
      if (wordsUse.trim())   voiceParts.push(`Mots à utiliser : ${wordsUse.trim()}`);
      if (wordsAvoid.trim()) voiceParts.push(`Mots à ne jamais utiliser : ${wordsAvoid.trim()}`);
      if (captionEx.trim())  voiceParts.push(`Exemple de caption : ${captionEx.trim()}`);

      const updates: Record<string, unknown> = {
        name:                name.trim() || workspaceName,
        sector:              sector || null,
        instagram_username:  instagram.replace(/^@/, "").trim() || null,
        company_description: brandDesc.trim() || null,
        tone:                tone || null,
        words_to_use:        wordsUse.trim() || null,
        words_to_avoid:      wordsAvoid.trim() || null,
        caption_examples:    captionEx.trim() || null,
        brand_voice_prompt:  voiceParts.join("\n") || null,
        primary_color:   colorPrimary,
        secondary_color: colorSecondary,
        accent_color:    colorAccent,
        logo_url:        finalLogoUrl,
        banner_url:      finalBannerUrl,
        logo_dark_url:   finalLogoDarkUrl,
        brand_assets:    [...existingAssets, ...newAssetUrls],
        brand_icon_url:  finalBrandIconUrl,
        font_family:     activeFontPrimary,
        font_secondary:  activeFontSecondary || null,
      };
      if (finalFontPrimaryUrl)   updates.font_primary_url   = finalFontPrimaryUrl;
      if (finalFontSecondaryUrl) updates.font_secondary_url = finalFontSecondaryUrl;
      if (nouvellesFamilles.length) updates.brand_fonts = famillesFinales;

      // L'ENREGISTREMENT DOIT DIRE LA VÉRITÉ.
      //
      // Le résultat de l'`update` n'était jamais lu, et il n'y avait pas de
      // `catch` : une règle d'accès qui refuse, une colonne absente, une session
      // expirée — dans tous les cas le code enchaînait sur « Charte mise à jour ✓ »
      // et la personne repartait en croyant avoir enregistré. C'est la raison
      // pour laquelle ce défaut a pu durer : l'application affirmait le contraire
      // de ce qui s'était passé.
      let { error: errUpdate } = await supabase.from("workspaces").update(updates).eq("id", id);

      // `brand_fonts` (migration 017) peut manquer sur une base qui n'a pas été
      // migrée. Sans ce repli, une colonne absente ferait échouer TOUT
      // l'enregistrement — couleurs et textes compris — pour une histoire de
      // graisses. On réessaie sans elle et on le dit.
      let famillesPerdues = false;
      if (errUpdate && /brand_fonts/i.test(`${errUpdate.message} ${errUpdate.details ?? ""}`)) {
        console.error("[charte] colonne brand_fonts absente : migration 017 non appliquée", errUpdate);
        const sansFamilles = { ...updates };
        delete sansFamilles.brand_fonts;
        ({ error: errUpdate } = await supabase.from("workspaces").update(sansFamilles).eq("id", id));
        famillesPerdues = !errUpdate;
      }

      if (errUpdate) {
        console.error("[charte] enregistrement refusé", errUpdate);
        showToast(`Enregistrement refusé : ${errUpdate.message}`);
        return;
      }

      // Sync state
      setWorkspaceName(name.trim() || workspaceName);
      if (finalLogoUrl !== logoUrl)             { setLogoUrl(finalLogoUrl); setLogoPreview(finalLogoUrl); setLogoFile(null); }
      if (finalBannerUrl !== bannerUrl)         { setBannerUrl(finalBannerUrl); setBannerPreview(finalBannerUrl); setBannerFile(null); }
      if (finalLogoDarkUrl !== logoDarkUrl)     { setLogoDarkUrl(finalLogoDarkUrl); setLogoDarkPreview(finalLogoDarkUrl); setLogoDarkFile(null); }
      if (finalBrandIconUrl !== brandIconUrl)   { setBrandIconUrl(finalBrandIconUrl); setBrandIconPreview(finalBrandIconUrl); setBrandIconFile(null); }
      if (newAssetUrls.length) { setExistingAssets(p => [...p, ...newAssetUrls]); setAssetFiles([]); setAssetPreviews([]); }

      if (echecsTeleversement.current.length) {
        showToast(`Charte enregistrée, mais ${echecsTeleversement.current.length} fichier(s) refusé(s) : ${echecsTeleversement.current[0]}`);
      } else if (famillesPerdues) {
        showToast("Charte enregistrée, mais les graisses n'ont pas pu l'être : la base n'a pas la colonne brand_fonts.");
      } else {
        showToast(t('charteUpdatedToast'));
      }
    } catch (e) {
      console.error("[charte] erreur pendant l'enregistrement", e);
      showToast(`Erreur pendant l'enregistrement : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  // ── Template save ────────────────────────────────────────────────────────────
  // ── Template delete ──────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteId) return;
    await fetch(`/api/templates/${deleteId}`, { method: "DELETE" });
    setTemplates(prev => prev.filter(tpl => tpl.id !== deleteId));
    setDeleteId(null);
    showToast(t('templateDeletedToast'));
  }

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--canvas)" }}>
      <Sidebar />
      <div style={{ marginLeft: "var(--sb-w)", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)" }}>
        {t('loading')}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--canvas)" }}>
      <Sidebar />

      <div style={{ marginLeft: "var(--sb-w)", flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a href={`/workspace/${id}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-3)", fontWeight: 600, textDecoration: "none" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
              {workspaceName}
            </a>
            <span style={{ color: "var(--line)", fontSize: 16 }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t('pageTitle')}</span>
          </div>
          <div className="ws-topbar-nav" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <NotificationBell />
          </div>
        </header>

        {/* Scroll container */}
        <div className="scroll">
          <div className="page" style={{ maxWidth: 860 }}>

            {/* Page title */}
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 26, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 4 }}>
                {t('pageTitle')}
              </h1>
              <p style={{ fontSize: 13.5, color: "var(--ink-2)" }}>{t('pageSubtitle', { name: workspaceName })}</p>
            </div>

            {/* Tab selector */}
            <div style={{ display: "inline-flex", background: "var(--sunk)", borderRadius: 10, padding: 3, marginBottom: 28, border: "1px solid var(--line)" }}>
              {(["charte", "templates"] as Tab[]).map(tabKey => (
                <button key={tabKey} onClick={() => setTab(tabKey)} style={{
                  padding: "7px 20px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontFamily: "var(--sans)", fontWeight: 500, fontSize: 13.5, transition: "all .15s",
                  background: tab === tabKey ? "var(--white)" : "transparent",
                  color: tab === tabKey ? "var(--ink)" : "var(--ink-3)",
                  boxShadow: tab === tabKey ? "0 1px 4px rgba(13,15,10,.1)" : "none",
                }}>
                  {tabKey === "charte" ? t('tabCharte') : t('tabTemplates')}
                </button>
              ))}
            </div>

            {/* ── TAB 1 : CHARTE ─────────────────────────────────────────────── */}
            {tab === "charte" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

                {/* Section Identité */}
                <SectionCard title={t('sectionIdentity')}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label style={labelStyle}>{t('clientNameLabel')}</label>
                      <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder={t('clientNamePlaceholder')} />
                    </div>
                    <div>
                      <label style={labelStyle}>{t('sectorLabel')}</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {SECTORS.map(s => (
                          <button key={s.value} type="button" onClick={() => setSector(sector === s.value ? "" : s.value)} style={{
                            padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                            border: "1.5px solid", cursor: "pointer", transition: "all .12s",
                            background: sector === s.value ? "var(--leaf)" : "var(--white)",
                            borderColor: sector === s.value ? "var(--leaf)" : "var(--line)",
                            color: sector === s.value ? "var(--mint-ink)" : "var(--ink-2)",
                          }}>{s.label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>{t('igHandleLabel')}</label>
                      <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", fontWeight: 700, fontSize: 14, pointerEvents: "none" }}>@</span>
                        <input style={{ ...inputStyle, paddingLeft: 30 }} value={instagram} onChange={e => setInstagram(e.target.value.replace(/^@/, ""))} placeholder="nomdubrand" />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>{t('brandDescLabel')}</label>
                      <textarea style={{ ...inputStyle, resize: "none", minHeight: 90, lineHeight: 1.6 }} value={brandDesc} onChange={e => setBrandDesc(e.target.value)} placeholder={t('brandDescPlaceholder')} rows={3} />
                    </div>
                  </div>
                </SectionCard>

                {/* Section Voix de marque */}
                <SectionCard title={t('sectionVoice')}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                      <label style={labelStyle}>{t('toneLabel')}</label>
                      <div className="ws-new-3col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        {TONES.map(tn => {
                          const active = tone === tn.value;
                          return (
                            <button key={tn.value} type="button" onClick={() => setTone(tone === tn.value ? "" : tn.value)} style={{
                              padding: "12px 14px", borderRadius: 12, textAlign: "left",
                              border: `1.5px solid ${active ? "var(--leaf)" : "var(--line)"}`,
                              background: active ? "var(--mint-soft)" : "var(--white)",
                              cursor: "pointer", transition: "all .15s",
                            }}>
                              <div style={{ fontWeight: 700, fontSize: 13.5, color: active ? "var(--mint-2)" : "var(--ink)", marginBottom: 3 }}>{tn.label}</div>
                              <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.4 }}>{tn.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="ws-upload-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <label style={labelStyle}>{t('wordsUseLabel')}</label>
                        <input style={inputStyle} value={wordsUse} onChange={e => setWordsUse(e.target.value)} placeholder={t('wordsUsePlaceholder')} />
                        <span style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4, display: "block" }}>{t('commaSeparated')}</span>
                      </div>
                      <div>
                        <label style={labelStyle}>{t('wordsAvoidLabel')}</label>
                        <input style={inputStyle} value={wordsAvoid} onChange={e => setWordsAvoid(e.target.value)} placeholder={t('wordsAvoidPlaceholder')} />
                        <span style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4, display: "block" }}>{t('commaSeparated')}</span>
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>{t('captionApprovedLabel')}</label>
                      <textarea style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }} value={captionEx} onChange={e => setCaptionEx(e.target.value)} placeholder={t('captionApprovedPlaceholder')} rows={3} />
                    </div>
                  </div>
                </SectionCard>

                {/* Section Analyse IA du style Instagram */}
                <SectionCard title={t('sectionAiAnalysis')}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
                      {t('aiAnalysisDesc')}
                    </p>

                    {!analysis && (
                      <button type="button" className="btn btn-dark" onClick={runStyleAnalysis} disabled={analyzing} style={{ alignSelf: "flex-start" }}>
                        {analyzing ? t('analyzing') : t('analyzeButton')}
                      </button>
                    )}

                    {analysisErr && (
                      <div style={{ fontSize: 12.5, color: "var(--warn)", background: "var(--warn-soft)", padding: "10px 12px", borderRadius: 10 }}>
                        {analysisErr}
                      </div>
                    )}

                    {analysis && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>
                          {t('postsAnalyzed', { count: analysis.postsAnalyzed })}{analysis.hasStats ? ` · ${t('engagementIncluded')}` : ""}
                        </div>

                        {analysis.summary && (
                          <div style={{ background: "var(--sunk)", borderRadius: 12, padding: "14px 16px" }}>
                            <div style={{ ...labelStyle, marginBottom: 6 }}>{t('editorialLineLabel')}</div>
                            <p style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.6, margin: 0 }}>{analysis.summary}</p>
                          </div>
                        )}

                        <div className="ws-upload-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                          {analysis.strengths.length > 0 && (
                            <div>
                              <div style={{ ...labelStyle, marginBottom: 8, color: "var(--mint-2)" }}>{t('strengthsLabel')}</div>
                              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                                {analysis.strengths.map((s, i) => (
                                  <li key={i} style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5, display: "flex", gap: 8 }}>
                                    <span style={{ color: "var(--mint-2)", flexShrink: 0 }}>✓</span>{s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {analysis.improvements.length > 0 && (
                            <div>
                              <div style={{ ...labelStyle, marginBottom: 8, color: "var(--warn)" }}>{t('improvementsLabel')}</div>
                              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                                {analysis.improvements.map((s, i) => (
                                  <li key={i} style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5, display: "flex", gap: 8 }}>
                                    <span style={{ color: "var(--warn)", flexShrink: 0 }}>→</span>{s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {analysis.suggestedDescriptionStyle && (
                          <div style={{ border: "1.5px solid var(--leaf)", background: "var(--mint-soft)", borderRadius: 12, padding: "14px 16px" }}>
                            <div style={{ ...labelStyle, marginBottom: 6, color: "var(--mint-2)" }}>{t('suggestedStyleLabel')}</div>
                            <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6, margin: 0 }}>{analysis.suggestedDescriptionStyle}</p>
                          </div>
                        )}

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                          <button type="button" className="btn btn-primary" onClick={applyStyleAnalysis} disabled={styleApplied}>
                            {styleApplied ? t('styleAppliedBtn') : t('applyStyle')}
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => { setAnalysis(null); setStyleApplied(false); }}>
                            {t('keepCurrentStyle')}
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={runStyleAnalysis} disabled={analyzing} style={{ marginLeft: "auto" }}>
                            {analyzing ? "…" : t('relaunchAnalysis')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* Section Couleurs */}
                <SectionCard title={t('sectionColors')}>
                  <div className="ws-new-3col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    {[
                      { label: t('colorPrimary'),  value: colorPrimary,   onChange: setColorPrimary },
                      { label: t('colorSecondary'),  value: colorSecondary, onChange: setColorSecondary },
                      { label: t('colorAccent'),      value: colorAccent,    onChange: setColorAccent },
                    ].map(col => (
                      <div key={col.label} style={{ background: "var(--sunk)", borderRadius: "var(--r-l)", padding: "14px 16px", border: "1px solid var(--line)" }}>
                        <span style={{ ...labelStyle, marginBottom: 12 }}>{col.label}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <ColorPicker value={col.value} onChange={col.onChange} />
                          <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 12, color: "var(--ink)", textTransform: "uppercase" }}>{col.value}</span>
                        </div>
                        <div style={{ width: "100%", height: 6, borderRadius: 99, marginTop: 10, background: col.value, boxShadow: "inset 0 0 0 1px rgba(13,15,10,.08)" }} />
                      </div>
                    ))}
                  </div>
                </SectionCard>

                {/* Section Assets */}
                <SectionCard title={t('sectionAssets')}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {/* Brand icon */}
                    <div>
                      <label style={labelStyle}>{t('brandIconLabel')}</label>
                      <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10 }}>{t('brandIconHint')}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 56, height: 56, borderRadius: 12, border: "1.5px solid var(--line)", background: "var(--sunk)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {brandIconPreview
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={brandIconPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                          }
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" onClick={() => brandIconRef.current?.click()} className="btn btn-ghost btn-sm">
                            {brandIconPreview ? t('replace') : t('choose')}
                          </button>
                          {brandIconPreview && (
                            <button type="button" onClick={() => { setBrandIconFile(null); setBrandIconPreview(null); setBrandIconUrl(null); }} className="btn btn-ghost btn-sm" style={{ color: "var(--warn)" }}>{t('remove')}</button>
                          )}
                        </div>
                      </div>
                      <input ref={brandIconRef} type="file" accept=".png,.jpg,.jpeg,.svg" style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) { setBrandIconFile(f); setBrandIconPreview(URL.createObjectURL(f)); } }} />
                    </div>

                    <div className="ws-upload-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <UploadZone label={t('logoMainLabel')} hint={t('logoMainHint')} preview={logoPreview} dark={false}
                        onClick={() => logoRef.current?.click()}
                        onRemove={() => { setLogoFile(null); setLogoPreview(logoUrl); }} />
                      <input ref={logoRef} type="file" accept=".png,.svg,.jpg,.jpeg" style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); } }} />

                      <UploadZone label={t('logoVariantLabel')} hint={t('logoVariantHint')} preview={logoDarkPreview} dark={true}
                        onClick={() => logoDarkRef.current?.click()}
                        onRemove={() => { setLogoDarkFile(null); setLogoDarkPreview(logoDarkUrl); }} />
                      <input ref={logoDarkRef} type="file" accept=".png,.svg,.jpg,.jpeg" style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) { setLogoDarkFile(f); setLogoDarkPreview(URL.createObjectURL(f)); } }} />

                      <div style={{ gridColumn: "1 / -1" }}>
                        <UploadZone label={t('bannerLabel')} hint={t('bannerHint')} preview={bannerPreview} dark={false}
                          onClick={() => bannerRef.current?.click()}
                          onRemove={() => { setBannerFile(null); setBannerPreview(bannerUrl); }} />
                        <input ref={bannerRef} type="file" accept=".png,.jpg,.jpeg,.webp" style={{ display: "none" }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) { setBannerFile(f); setBannerPreview(URL.createObjectURL(f)); } }} />
                      </div>
                    </div>

                    {/* Additional assets */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>
                          {t('extraAssetsLabel')}{" "}
                          <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— {existingAssets.length + assetFiles.length}/5</span>
                        </label>
                        {(existingAssets.length + assetFiles.length) < 5 && (
                          <button type="button" onClick={() => assetsRef.current?.click()} style={{ fontSize: 12, fontWeight: 700, color: "var(--mint-2)", background: "none", border: "none", cursor: "pointer" }}>+ {t('add')}</button>
                        )}
                      </div>
                      <input ref={assetsRef} type="file" accept=".png,.svg,.jpg,.jpeg" multiple style={{ display: "none" }}
                        onChange={e => {
                          const files = Array.from(e.target.files ?? []);
                          const slots = 5 - existingAssets.length - assetFiles.length;
                          const added = files.slice(0, Math.max(0, slots));
                          setAssetFiles(p => [...p, ...added]);
                          setAssetPreviews(p => [...p, ...added.map(f => URL.createObjectURL(f))]);
                          e.target.value = "";
                        }} />
                      {(existingAssets.length + assetPreviews.length) > 0 ? (
                        <div className="ws-new-5col" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                          {existingAssets.map((url, i) => (
                            <div key={`ex-${i}`} style={{ position: "relative" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "contain", borderRadius: 10, background: "var(--sunk)", padding: 6, display: "block" }} />
                              <button type="button" onClick={() => setExistingAssets(p => p.filter((_, j) => j !== i))}
                                style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.55)", border: "none", cursor: "pointer", color: "#fff", fontSize: 12, display: "grid", placeItems: "center" }}>×</button>
                            </div>
                          ))}
                          {assetPreviews.map((url, i) => (
                            <div key={`new-${i}`} style={{ position: "relative" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "contain", borderRadius: 10, background: "var(--sunk)", padding: 6, display: "block" }} />
                              <button type="button" onClick={() => { setAssetFiles(p => p.filter((_, j) => j !== i)); setAssetPreviews(p => p.filter((_, j) => j !== i)); }}
                                style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.55)", border: "none", cursor: "pointer", color: "#fff", fontSize: 12, display: "grid", placeItems: "center" }}>×</button>
                            </div>
                          ))}
                          {(existingAssets.length + assetFiles.length) < 5 && (
                            <div onClick={() => assetsRef.current?.click()} style={{ aspectRatio: "1", borderRadius: 10, border: "2px solid var(--line)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-3)", fontSize: 22 }}>+</div>
                          )}
                        </div>
                      ) : (
                        <div onClick={() => assetsRef.current?.click()} style={{ border: "2px solid var(--line)", borderRadius: "var(--r-l)", padding: 18, background: "var(--white)", cursor: "pointer", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--ink-3)", fontSize: 13 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                          {t('extraAssetsHint')}
                        </div>
                      )}
                    </div>
                  </div>
                </SectionCard>

                {/* Section Typographie */}
                <SectionCard title={t('sectionTypography')}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

                    {/* Police principale */}
                    <div>
                      <label style={labelStyle}>{t('primaryFontLabel')}</label>
                      {customPrimary && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, marginBottom: 10, background: "var(--mint-soft)", border: "1px solid var(--leaf)" }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mint-2)", display: "block" }}>{t('customFontActive')}</span>
                            <span style={{ fontFamily: `"${customPrimary.family}", sans-serif`, fontSize: 16, color: "var(--ink)" }}>{customPrimary.family}</span>
                          </div>
                          <button type="button" onClick={() => setCustomPrimary(null)} style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer" }}>{t('removeFontShort')}</button>
                        </div>
                      )}
                      <input style={{ ...inputStyle, marginBottom: 6 }} value={fontSearch} onChange={e => setFontSearch(e.target.value)} placeholder={t('searchFontPlaceholder')} />
                      <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--line)", borderRadius: "var(--r-l)", background: "var(--white)" }}>
                        {fontsLoading ? (
                          <div style={{ padding: "16px", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>{t('loading')}</div>
                        ) : filteredFonts.length === 0 ? (
                          <div style={{ padding: "14px", fontSize: 13, color: "var(--ink-3)" }}>{t('noFontFound')}</div>
                        ) : filteredFonts.map(font => (
                          <FontRow key={font.family} family={font.family} selected={!customPrimary && fontPrimary === font.family}
                            onSelect={() => { setFontPrimary(font.family); setCustomPrimary(null); }} />
                        ))}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0" }}>
                        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                        <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>{t('or')}</span>
                        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                      </div>
                      <button type="button" onClick={() => customPrimaryRef.current?.click()} style={{
                        width: "100%", padding: "10px 16px", borderRadius: "var(--r-l)", border: "1.5px solid var(--line)", background: "transparent",
                        cursor: "pointer", fontSize: 13, color: "var(--ink-2)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .15s",
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--leaf)"; e.currentTarget.style.color = "var(--mint-2)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.color = "var(--ink-2)"; }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                        {t('uploadCustomFont')}
                      </button>
                      <input ref={customPrimaryRef} type="file" accept=".ttf,.otf,.woff,.woff2" multiple style={{ display: "none" }}
                        onChange={e => { const fs = e.target.files; if (fs?.length) handleCustomFont(fs, "primary"); e.target.value = ""; }} />
                    </div>

                    {/* Police secondaire */}
                    <div>
                      <label style={labelStyle}>{t('secondaryFontLabel')} <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 10, color: "var(--ink-3)" }}>{t('optional')}</span></label>
                      {customSecondary && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, marginBottom: 10, background: "var(--mint-soft)", border: "1px solid var(--leaf)" }}>
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mint-2)", display: "block" }}>{t('customFontActive')}</span>
                            <span style={{ fontFamily: `"${customSecondary.family}", sans-serif`, fontSize: 16, color: "var(--ink)" }}>{customSecondary.family}</span>
                          </div>
                          <button type="button" onClick={() => setCustomSecondary(null)} style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer" }}>{t('removeFontShort')}</button>
                        </div>
                      )}
                      <input style={{ ...inputStyle, marginBottom: 6 }} value={fontSearchSec} onChange={e => setFontSearchSec(e.target.value)} placeholder={t('searchSecondaryFontPlaceholder')} />
                      <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--line)", borderRadius: "var(--r-l)", background: "var(--white)" }}>
                        {filteredFontsSec.map(font => (
                          <FontRow key={font.family} family={font.family} selected={!customSecondary && fontSecondary === font.family}
                            onSelect={() => { setFontSecondary(font.family); setCustomSecondary(null); }} />
                        ))}
                      </div>
                      <button type="button" onClick={() => customSecondaryRef.current?.click()} style={{
                        marginTop: 8, width: "100%", padding: "10px 16px", borderRadius: "var(--r-l)", border: "1.5px solid var(--line)", background: "transparent",
                        cursor: "pointer", fontSize: 13, color: "var(--ink-2)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .15s",
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--leaf)"; e.currentTarget.style.color = "var(--mint-2)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.color = "var(--ink-2)"; }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                        {t('uploadCustomFont')}
                      </button>
                      <input ref={customSecondaryRef} type="file" accept=".ttf,.otf,.woff,.woff2" multiple style={{ display: "none" }}
                        onChange={e => { const fs = e.target.files; if (fs?.length) handleCustomFont(fs, "secondary"); e.target.value = ""; }} />
                    </div>

                    {/* Live preview */}
                    <div className="card" style={{ padding: "20px 24px" }}>
                      <span style={{ ...labelStyle, marginBottom: 12, display: "block" }}>{t('previewLabel', { font: activeFontPrimary })}</span>
                      <p style={{ fontFamily: `"${activeFontPrimary}", sans-serif`, fontSize: 28, fontWeight: 700, color: "var(--ink)", lineHeight: 1.15, margin: 0 }}>
                        {t('previewHeading')}
                      </p>
                      <p style={{ fontFamily: `"${activeFontPrimary}", sans-serif`, fontSize: 14, color: "var(--ink-2)", margin: "10px 0 0", lineHeight: 1.6 }}>
                        {t('previewBody')}
                      </p>
                      {activeFontSecondary && (
                        <p style={{ fontFamily: `"${activeFontSecondary}", sans-serif`, fontSize: 14, color: "var(--ink-3)", margin: "8px 0 0", lineHeight: 1.6, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                          {t('secondaryFontPreview', { font: activeFontSecondary })}
                        </p>
                      )}
                    </div>
                  </div>
                </SectionCard>

                {/* Save button */}
                <div style={{ paddingTop: 8 }}>
                  <button onClick={handleSaveCharte} disabled={saving} style={{
                    padding: "13px 32px", borderRadius: 13, border: "none",
                    background: saving ? "var(--sunk)" : "var(--leaf)",
                    color: saving ? "var(--ink-3)" : "var(--mint-ink)",
                    fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                    fontFamily: "var(--display)", transition: "all .15s",
                  }}>
                    {saving ? t('saving') : t('saveCharte')}
                  </button>
                </div>

              </div>
            )}

            {/* ── TAB 2 : TEMPLATES ──────────────────────────────────────────── */}
            {tab === "templates" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div>
                    <h2 style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 18, color: "var(--ink)", margin: 0 }}>{t('tabTemplates')}</h2>
                    <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 3 }}>{t('templatesForClient', { count: templates.length, name: workspaceName })}</p>
                  </div>
                  <button onClick={() => router.push(`/workspace/${id}/template-editor/new`)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 13, border: "none", background: "var(--leaf)", color: "var(--mint-ink)", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "var(--display)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    {t('newTemplateBtn')}
                  </button>
                </div>

                {tplLoading ? (
                  <div style={{ padding: "48px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>{t('loading')}</div>
                ) : templates.length === 0 ? (
                  <div style={{ padding: "60px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--sunk)", display: "grid", placeItems: "center" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{t('noTemplateYet')}</p>
                      <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "4px 0 0" }}>{t('noTemplateHint')}</p>
                    </div>
                    <button onClick={() => router.push(`/workspace/${id}/template-editor/new`)}
                      style={{ marginTop: 4, padding: "10px 22px", borderRadius: 12, border: "none", background: "var(--leaf)", color: "var(--mint-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      {t('createTemplateBtn')}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                    {templates.map(tpl => {
                      const fmtLabel = FORMATS[tpl.format_id] ?? tpl.format_id;
                      const zonesCount = Array.isArray(tpl.text_zones) ? tpl.text_zones.length : 0;
                      return (
                        <div key={tpl.id} className="card" style={{ overflow: "hidden", padding: 0 }}>
                          {/* Thumbnail */}
                          <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", background: "var(--sunk)" }}>
                            {tpl.thumbnail_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={tpl.thumbnail_url} alt={tpl.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <MiniTemplatePreview bg={tpl.background_style} name={tpl.name} formatId={tpl.format_id} zonesCount={zonesCount} />
                              </div>
                            )}
                          </div>
                          {/* Info */}
                          <div style={{ padding: "14px 16px" }}>
                            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tpl.name}</p>
                            <p style={{ fontSize: 12, color: "var(--ink-3)", margin: "3px 0 0" }}>{fmtLabel} · {t('elementsCount', { count: zonesCount })}</p>
                            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                              <button onClick={() => router.push(`/workspace/${id}/template-editor/${tpl.id}`)}
                                style={{ flex: 1, padding: "8px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--white)", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                {t('modify')}
                              </button>
                              <button onClick={() => setDeleteId(tpl.id)}
                                style={{ padding: "8px 12px", borderRadius: 9, border: "1px solid var(--line)", background: "var(--white)", cursor: "pointer", color: "#EF4444", display: "flex", alignItems: "center" }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Template editor modal ──────────────────────────────────────────────── */}
      {/* ── Delete confirm dialog ─────────────────────────────────────────────── */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(13,15,10,.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--white)", borderRadius: "var(--r-l)", boxShadow: "var(--shadow-pop)", padding: "28px 32px", maxWidth: 380, width: "90vw", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "#FEE2E2", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </div>
            <h3 style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 17, color: "var(--ink)", margin: "0 0 8px" }}>{t('deleteTemplateTitle')}</h3>
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 24px", lineHeight: 1.5 }}>{t('deleteTemplateDesc')}</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "10px", borderRadius: 11, border: "1px solid var(--line)", background: "var(--white)", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{t('cancel')}</button>
              <button onClick={confirmDelete} style={{ flex: 1, padding: "10px", borderRadius: 11, border: "none", background: "#EF4444", color: "#fff", cursor: "pointer", fontSize: 13.5, fontWeight: 700 }}>{t('delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "var(--forest)", color: "var(--cream)", borderRadius: 12,
          padding: "11px 20px", fontSize: 13.5, fontWeight: 600, fontFamily: "var(--sans)",
          boxShadow: "var(--shadow-pop)", display: "flex", alignItems: "center", gap: 8,
          zIndex: 1100, whiteSpace: "nowrap",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          {toast}
        </div>
      )}
    </div>
  );
}
