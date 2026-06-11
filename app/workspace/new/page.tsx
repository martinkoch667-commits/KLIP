"use client";

import { useState, useRef, useEffect, useMemo, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";
import ColorPicker from "@/components/ColorPicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GFont { family: string; category: string }
interface CustomFont { file: File; family: string; blobUrl: string }

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

const SECTORS = ["Restaurant", "Café", "Retail", "Mode", "Beauté", "Sport", "Tech", "Autre"];

const TONES = [
  { value: "Chic",       desc: "Élégant, raffiné, haut de gamme" },
  { value: "Punchy",     desc: "Direct, percutant, accrocheur" },
  { value: "Minimal",    desc: "Épuré, sobre, essentiel" },
  { value: "Chaleureux", desc: "Proche, humain, convivial" },
  { value: "Direct",     desc: "Clair, sans détour, efficace" },
  { value: "Doux",       desc: "Délicat, rassurant, bienveillant" },
];

const STEP_LABELS = ["Infos de base", "Voix de marque", "Identité visuelle", "Typographie"];
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

const inputStyle: CSSProperties = {
  width: "100%", background: "#fff", border: "1px solid rgba(13,15,10,.10)",
  borderRadius: 13, padding: "11px 16px", fontSize: 14, color: "var(--ink)",
  outline: "none", fontFamily: "var(--sans)", boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700,
  color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em",
  fontFamily: "var(--display)",
};

// ─── FontRow — lazy-loads the font via IntersectionObserver ───────────────────

function FontRow({
  family, selected, onSelect,
}: { family: string; selected: boolean; onSelect: () => void }) {
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
          Bonjour, voici votre marque
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
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Infos de base
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [brandDescription, setBrandDescription] = useState("");

  // Step 2 — Voix de marque
  const [tone, setTone] = useState("");
  const [wordsToUse, setWordsToUse] = useState("");
  const [wordsToAvoid, setWordsToAvoid] = useState("");
  const [captionExample, setCaptionExample] = useState("");

  // Step 3 — Identité visuelle
  const [primaryColor, setPrimaryColor] = useState("#0038FF");
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF");
  const [accentColor, setAccentColor] = useState("#C8F135");
  const logoRef = useRef<HTMLInputElement>(null);
  const logoDarkRef = useRef<HTMLInputElement>(null);
  const assetsRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoDarkFile, setLogoDarkFile] = useState<File | null>(null);
  const [logoDarkPreview, setLogoDarkPreview] = useState<string | null>(null);
  const [assetFiles, setAssetFiles] = useState<File[]>([]);
  const [assetPreviews, setAssetPreviews] = useState<string[]>([]);

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
  const [customPrimary, setCustomPrimary] = useState<CustomFont | null>(null);
  const [customSecondary, setCustomSecondary] = useState<CustomFont | null>(null);

  // Active font names (custom overrides Google selection)
  const activeFontPrimary = customPrimary ? customPrimary.family : fontPrimary;
  const activeFontSecondary = customSecondary ? customSecondary.family : fontSecondary;

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

  function handleCustomFont(file: File, target: "primary" | "secondary") {
    const family = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    const blobUrl = URL.createObjectURL(file);

    // Inject @font-face for preview
    const styleId = `klip-custom-font-${target}`;
    const existing = document.getElementById(styleId);
    if (existing) existing.remove();
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `@font-face { font-family: "${family}"; src: url("${blobUrl}"); }`;
    document.head.appendChild(style);

    const font: CustomFont = { file, family, blobUrl };
    if (target === "primary") setCustomPrimary(font);
    else setCustomSecondary(font);
  }

  // ── File upload helpers ───────────────────────────────────────────────────

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

  async function createWorkspace() {
    setError(null);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // Ensure Supabase Storage buckets exist (created server-side with service role)
      try {
        await fetch("/api/ensure-buckets", { method: "POST" });
      } catch (err) {
        console.warn("[ensure-buckets] could not reach API:", err);
      }

      // Brand asset uploads (each wrapped independently)
      let logoUrl: string | null = null;
      let logoDarkUrl: string | null = null;
      const assetUrls: string[] = [];
      if (logoFile)     logoUrl     = await uploadFile(logoFile,     "brand-assets", user.id);
      if (logoDarkFile) logoDarkUrl = await uploadFile(logoDarkFile, "brand-assets", user.id);
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

      // Legacy brand_voice_prompt for backward compat
      const voiceParts: string[] = [];
      if (tone)                  voiceParts.push(`Ton : ${tone}`);
      if (wordsToUse.trim())     voiceParts.push(`Mots à utiliser : ${wordsToUse.trim()}`);
      if (wordsToAvoid.trim())   voiceParts.push(`Mots à ne jamais utiliser : ${wordsToAvoid.trim()}`);
      if (captionExample.trim()) voiceParts.push(`Exemple de caption : ${captionExample.trim()}`);

      const { data, error: insertErr } = await supabase.from("workspaces").insert({
        user_id: user.id,
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
        logo_url: logoUrl,
        logo_dark_url: logoDarkUrl,
        brand_assets: assetUrls,
        // Step 4
        font_family: activeFontPrimary,
        font_primary_url: fontPrimaryUrl,
        font_secondary: activeFontSecondary || null,
        font_secondary_url: fontSecondaryUrl,
      }).select().single();

      if (insertErr || !data) {
        console.error("[createWorkspace] insert error:", {
          message: insertErr?.message,
          code: insertErr?.code,
          details: insertErr?.details,
          hint: insertErr?.hint,
          full: insertErr,
        });
        throw insertErr ?? new Error("Workspace non créé — réponse vide");
      }
      router.push(`/workspace/${data.id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur lors de la création.";
      console.error("[createWorkspace] caught:", e);
      setError(msg);
    }
    setLoading(false);
  }

  const canContinue = step === 1 ? name.trim().length > 0 : true;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--canvas)" }}>
      <Sidebar />

      <div style={{ marginLeft: "var(--sb-w)", flex: 1, display: "flex", flexDirection: "column" }}>

        {/* ── Progress header ───────────────────────────────────────────────── */}
        <header style={{ padding: "28px 40px 0", flexShrink: 0 }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              {STEP_LABELS.map((label, i) => {
                const n = i + 1;
                const active = n === step;
                const done = n < step;
                return (
                  <div key={n} style={{ display: "flex", alignItems: "flex-start", flex: i < 3 ? 1 : "none" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%",
                        background: done ? "var(--mint)" : active ? "var(--ink)" : "var(--sunk)",
                        display: "grid", placeItems: "center",
                        fontSize: 13, fontWeight: 800,
                        color: done ? "var(--mint-ink)" : active ? "var(--paper)" : "var(--ink-3)",
                        fontFamily: "var(--mono)", transition: "all 0.2s",
                      }}>
                        {done ? "✓" : n}
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                        color: active ? "var(--ink)" : done ? "var(--ink-2)" : "var(--ink-3)",
                      }}>
                        {label}
                      </span>
                    </div>
                    {i < 3 && (
                      <div style={{
                        flex: 1, height: 2, marginTop: 16, marginLeft: 8, marginRight: 8,
                        background: done ? "var(--mint)" : "var(--line-2)",
                        transition: "background 0.3s",
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </header>

        {/* ── Step content ──────────────────────────────────────────────────── */}
        <main style={{ flex: 1, overflowY: "auto", padding: "0 40px" }}>
          <div style={{ maxWidth: 680, margin: "0 auto", paddingTop: 40, paddingBottom: 120 }}>

            {/* ─── STEP 1 — Infos de base ─── */}
            {step === 1 && (
              <div key="step1" className="screen-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 30, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 8 }}>
                    Infos de base
                  </h1>
                  <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                    Présentez-nous votre client en quelques mots.
                  </p>
                </div>

                <div>
                  <label style={labelStyle}>Nom du client *</label>
                  <input
                    style={inputStyle}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Café Lumière, Studio Nova..."
                    autoFocus
                  />
                </div>

                <div>
                  <label style={labelStyle}>Secteur d'activité</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {SECTORS.map(s => (
                      <button
                        key={s} type="button"
                        onClick={() => setSector(sector === s ? "" : s)}
                        style={{
                          padding: "8px 18px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                          border: "1.5px solid", cursor: "pointer", transition: "all 0.12s",
                          background: sector === s ? "var(--mint)" : "var(--white)",
                          borderColor: sector === s ? "var(--mint)" : "rgba(13,15,10,.12)",
                          color: sector === s ? "var(--mint-ink)" : "var(--ink-2)",
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Handle Instagram <OptLabel /></label>
                  <div style={{ position: "relative" }}>
                    <span style={{
                      position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                      color: "var(--ink-3)", fontWeight: 700, fontSize: 14, pointerEvents: "none",
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
                  <label style={labelStyle}>Description de la marque</label>
                  <textarea
                    style={{ ...inputStyle, resize: "none", minHeight: 90, lineHeight: 1.6 }}
                    value={brandDescription}
                    onChange={e => setBrandDescription(e.target.value)}
                    placeholder="Ex: Café de spécialité dans le quartier des arts, connu pour son ambiance chaleureuse et ses recettes maison..."
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* ─── STEP 2 — Voix de marque ─── */}
            {step === 2 && (
              <div key="step2" className="screen-in" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 30, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 8 }}>
                    Voix de marque
                  </h1>
                  <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                    Comment cette marque parle à son audience ?
                  </p>
                </div>

                <div>
                  <label style={labelStyle}>Ton de communication</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {TONES.map(t => {
                      const active = tone === t.value;
                      return (
                        <button
                          key={t.value} type="button"
                          onClick={() => setTone(tone === t.value ? "" : t.value)}
                          style={{
                            padding: "14px 14px", borderRadius: 13, textAlign: "left",
                            border: `1.5px solid ${active ? "var(--mint)" : "rgba(13,15,10,.10)"}`,
                            background: active ? "var(--mint-soft)" : "var(--white)",
                            cursor: "pointer", transition: "all 0.15s",
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 14, color: active ? "var(--mint-2)" : "var(--ink)", marginBottom: 4 }}>
                            {t.value}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.4 }}>
                            {t.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Mots à utiliser souvent <OptLabel /></label>
                    <input
                      style={inputStyle}
                      value={wordsToUse}
                      onChange={e => setWordsToUse(e.target.value)}
                      placeholder="artisanal, local, saison..."
                    />
                    <span style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 5, display: "block" }}>
                      Séparés par des virgules
                    </span>
                  </div>
                  <div>
                    <label style={labelStyle}>Mots à ne jamais utiliser <OptLabel /></label>
                    <input
                      style={inputStyle}
                      value={wordsToAvoid}
                      onChange={e => setWordsToAvoid(e.target.value)}
                      placeholder="pas cher, promo, discount..."
                    />
                    <span style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 5, display: "block" }}>
                      Séparés par des virgules
                    </span>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Exemple de caption qu'ils aiment <OptLabel /></label>
                  <textarea
                    style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }}
                    value={captionExample}
                    onChange={e => setCaptionExample(e.target.value)}
                    placeholder="Collez ici une caption Instagram existante que le client apprécie — l'IA s'en inspirera..."
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* ─── STEP 3 — Identité visuelle ─── */}
            {step === 3 && (
              <div key="step3" className="screen-in" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 30, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 8 }}>
                    Identité visuelle
                  </h1>
                  <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                    Couleurs, logos et assets graphiques de la marque.
                  </p>
                </div>

                {/* Colors */}
                <div>
                  <label style={labelStyle}>Couleurs de marque</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    {[
                      { label: "Principale", value: primaryColor, onChange: setPrimaryColor },
                      { label: "Secondaire", value: secondaryColor, onChange: setSecondaryColor },
                      { label: "Accent", value: accentColor, onChange: setAccentColor },
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

                {/* Logos */}
                <div>
                  <label style={labelStyle}>Logos</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <UploadZone
                      label="Logo principal"
                      hint="PNG, SVG recommandé"
                      preview={logoPreview}
                      dark={false}
                      onClick={() => logoRef.current?.click()}
                      onRemove={() => { setLogoFile(null); setLogoPreview(null); }}
                    />
                    <input ref={logoRef} type="file" accept=".png,.svg,.jpg,.jpeg" style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); } }}
                    />

                    <UploadZone
                      label={<>Logo variante <OptLabel /></>}
                      hint="Blanc ou noir sur fond inversé"
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
                      Assets supplémentaires <OptLabel />{" "}
                      <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--ink-3)" }}>— {assetFiles.length}/5</span>
                    </label>
                    {assetFiles.length < 5 && (
                      <button type="button" onClick={() => assetsRef.current?.click()}
                        style={{ fontSize: 12, fontWeight: 700, color: "var(--mint-2)", background: "none", border: "none", cursor: "pointer" }}>
                        + Ajouter
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
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
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
                          style={{ aspectRatio: "1", borderRadius: 10, border: "2px dashed var(--line)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-3)", fontSize: 22 }}>
                          +
                        </div>
                      )}
                    </div>
                  ) : (
                    <div onClick={() => assetsRef.current?.click()}
                      style={{ border: "2px dashed var(--line)", borderRadius: 13, padding: 20, background: "var(--white)", cursor: "pointer", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--ink-3)", fontSize: 13 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                      </svg>
                      Icônes, textures, éléments graphiques... (PNG, SVG)
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── STEP 4 — Typographie ─── */}
            {step === 4 && (
              <div key="step4" className="screen-in" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 30, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 8 }}>
                    Typographie
                  </h1>
                  <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                    Les polices utilisées dans les visuels de ce client.{" "}
                    {googleFonts.length > 0 && (
                      <span style={{ color: "var(--ink-3)" }}>{googleFonts.length.toLocaleString()} polices disponibles.</span>
                    )}
                  </p>
                </div>

                {/* ── Police principale ─────────────────────────────────── */}
                <div>
                  <label style={labelStyle}>Police principale</label>

                  {/* Custom font banner */}
                  {customPrimary && (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: 10, marginBottom: 10,
                      background: "var(--mint-soft)", border: "1px solid var(--mint)",
                    }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mint-2)", display: "block" }}>
                          Police custom active
                        </span>
                        <span style={{ fontFamily: `"${customPrimary.family}", sans-serif`, fontSize: 16, color: "var(--ink)" }}>
                          {customPrimary.family}
                        </span>
                      </div>
                      <button type="button"
                        onClick={() => setCustomPrimary(null)}
                        style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
                        × Retirer
                      </button>
                    </div>
                  )}

                  {/* Search */}
                  <input
                    style={{ ...inputStyle, marginBottom: 6 }}
                    value={fontSearch}
                    onChange={e => setFontSearch(e.target.value)}
                    placeholder="Rechercher une police Google Fonts..."
                    autoFocus
                  />

                  {/* Font list */}
                  <div style={{
                    maxHeight: 300, overflowY: "auto",
                    border: "1px solid rgba(13,15,10,.08)", borderRadius: 13,
                    background: "var(--white)",
                  }}>
                    {fontsLoading ? (
                      <div style={{ padding: "18px 16px", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>
                        Chargement du catalogue...
                      </div>
                    ) : filteredFonts.length === 0 ? (
                      <div style={{ padding: "16px 14px", fontSize: 13, color: "var(--ink-3)" }}>
                        Aucune police trouvée
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
                            + {(googleFonts.length - FONT_LIST_LIMIT).toLocaleString()} autres — affiner avec la recherche
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
                    <div style={{ flex: 1, height: 1, background: "var(--line-2)" }} />
                    <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>ou</span>
                    <div style={{ flex: 1, height: 1, background: "var(--line-2)" }} />
                  </div>

                  {/* Custom font upload */}
                  <button type="button"
                    onClick={() => customPrimaryRef.current?.click()}
                    style={{
                      width: "100%", padding: "11px 16px", borderRadius: 13,
                      border: "1.5px dashed rgba(13,15,10,.20)", background: "transparent",
                      cursor: "pointer", fontSize: 13, color: "var(--ink-2)", fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: "border-color 0.15s, color 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--mint)"; e.currentTarget.style.color = "var(--mint-2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(13,15,10,.20)"; e.currentTarget.style.color = "var(--ink-2)"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                    Uploader une police custom (.ttf, .otf, .woff, .woff2)
                  </button>
                  <input ref={customPrimaryRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleCustomFont(f, "primary"); e.target.value = ""; }}
                  />
                </div>

                {/* ── Live preview card ─────────────────────────────────── */}
                <div className="card" style={{ padding: "24px 28px" }}>
                  <span style={{ ...labelStyle, display: "block", marginBottom: 16 }}>
                    Aperçu — {customPrimary ? customPrimary.family : fontPrimary}
                  </span>
                  <p style={{
                    fontFamily: `"${activeFontPrimary}", sans-serif`,
                    fontSize: 32, fontWeight: 700, color: "var(--ink)",
                    lineHeight: 1.15, margin: 0,
                  }}>
                    Bonjour, voici votre marque
                  </p>
                  <p style={{
                    fontFamily: `"${activeFontPrimary}", sans-serif`,
                    fontSize: 14, color: "var(--ink-2)", margin: "12px 0 0", lineHeight: 1.6,
                  }}>
                    Texte courant — corps de texte en taille normale
                  </p>
                  {activeFontSecondary && (
                    <p style={{
                      fontFamily: `"${activeFontSecondary}", sans-serif`,
                      fontSize: 14, color: "var(--ink-3)", margin: "8px 0 0", lineHeight: 1.6,
                      borderTop: "1px solid var(--line-2)", paddingTop: 8,
                    }}>
                      Police secondaire : {activeFontSecondary}
                    </p>
                  )}
                </div>

                {/* ── Police secondaire ─────────────────────────────────── */}
                <div>
                  <label style={labelStyle}>Police secondaire <OptLabel /></label>

                  {/* Custom secondary banner */}
                  {customSecondary && (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: 10, marginBottom: 10,
                      background: "var(--mint-soft)", border: "1px solid var(--mint)",
                    }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--mint-2)", display: "block" }}>Police custom</span>
                        <span style={{ fontFamily: `"${customSecondary.family}", sans-serif`, fontSize: 16, color: "var(--ink)" }}>
                          {customSecondary.family}
                        </span>
                      </div>
                      <button type="button" onClick={() => setCustomSecondary(null)}
                        style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
                        × Retirer
                      </button>
                    </div>
                  )}

                  {/* Search */}
                  <input
                    style={{ ...inputStyle, marginBottom: 6 }}
                    value={fontSearchSecondary}
                    onChange={e => setFontSearchSecondary(e.target.value)}
                    placeholder="Rechercher une police secondaire..."
                  />

                  {/* Font list */}
                  <div style={{
                    maxHeight: 220, overflowY: "auto",
                    border: "1px solid rgba(13,15,10,.08)", borderRadius: 13, background: "var(--white)",
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
                      Aucune
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
                        + {(googleFonts.length - FONT_LIST_LIMIT).toLocaleString()} autres — rechercher pour affiner
                      </div>
                    )}
                  </div>

                  {/* Custom secondary upload */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
                    <div style={{ flex: 1, height: 1, background: "var(--line-2)" }} />
                    <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>ou</span>
                    <div style={{ flex: 1, height: 1, background: "var(--line-2)" }} />
                  </div>
                  <button type="button"
                    onClick={() => customSecondaryRef.current?.click()}
                    style={{
                      width: "100%", padding: "11px 16px", borderRadius: 13,
                      border: "1.5px dashed rgba(13,15,10,.20)", background: "transparent",
                      cursor: "pointer", fontSize: 13, color: "var(--ink-2)", fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: "border-color 0.15s, color 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--mint)"; e.currentTarget.style.color = "var(--mint-2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(13,15,10,.20)"; e.currentTarget.style.color = "var(--ink-2)"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                    Uploader une police custom (.ttf, .otf, .woff, .woff2)
                  </button>
                  <input ref={customSecondaryRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleCustomFont(f, "secondary"); e.target.value = ""; }}
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

          </div>
        </main>

        {/* ── Navigation footer ─────────────────────────────────────────────── */}
        <footer style={{
          position: "fixed", bottom: 0,
          left: "var(--sb-w)", right: 0,
          background: "color-mix(in srgb, var(--canvas) 92%, transparent)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid var(--line-2)",
          padding: "16px 40px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          zIndex: 50,
        }}>
          <div>
            {step > 1 && (
              <button type="button" onClick={() => setStep(s => s - 1)}
                style={{
                  padding: "10px 20px", borderRadius: 13, background: "transparent",
                  border: "1px solid rgba(13,15,10,.12)", color: "var(--ink-2)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>
                ← Retour
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--mono)", fontWeight: 700 }}>
              {step} / {STEP_LABELS.length}
            </span>
            {step < 4 ? (
              <button type="button" onClick={() => setStep(s => s + 1)} disabled={!canContinue}
                style={{
                  padding: "11px 30px", borderRadius: 13,
                  background: canContinue ? "var(--ink)" : "var(--sunk)",
                  border: "none",
                  color: canContinue ? "var(--paper)" : "var(--ink-3)",
                  fontSize: 14, fontWeight: 700,
                  cursor: canContinue ? "pointer" : "not-allowed",
                  fontFamily: "var(--display)", transition: "all 0.15s",
                }}>
                Continuer →
              </button>
            ) : (
              <button type="button" onClick={createWorkspace} disabled={loading}
                style={{
                  padding: "11px 30px", borderRadius: 13,
                  background: "var(--mint)", border: "none",
                  color: "var(--mint-ink)", fontSize: 14, fontWeight: 700,
                  cursor: loading ? "default" : "pointer",
                  fontFamily: "var(--display)", transition: "all 0.15s",
                  opacity: loading ? 0.7 : 1,
                }}>
                {loading ? "Création en cours…" : "Créer l'espace client →"}
              </button>
            )}
          </div>
        </footer>

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
          border: "2px dashed var(--line)", borderRadius: 13,
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
