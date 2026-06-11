"use client";

import { useState, useRef, useEffect, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";
import ColorPicker from "@/components/ColorPicker";

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTORS = ["Restaurant", "Café", "Retail", "Mode", "Beauté", "Sport", "Tech", "Autre"];

const TONES = [
  { value: "Chic",       desc: "Élégant, raffiné, haut de gamme" },
  { value: "Punchy",     desc: "Direct, percutant, accrocheur" },
  { value: "Minimal",    desc: "Épuré, sobre, essentiel" },
  { value: "Chaleureux", desc: "Proche, humain, convivial" },
  { value: "Direct",     desc: "Clair, sans détour, efficace" },
  { value: "Doux",       desc: "Délicat, rassurant, bienveillant" },
];

const FONTS = [
  "Anton", "Archivo Black", "Barlow Condensed", "Bebas Neue",
  "DM Sans", "Exo 2", "Fjalla One", "Inter", "Josefin Sans",
  "Lato", "Merriweather", "Montserrat", "Nunito", "Oswald",
  "Outfit", "Playfair Display", "Plus Jakarta Sans", "Poppins",
  "Raleway", "Roboto Condensed", "Rubik", "Space Grotesk",
  "Syne", "Ubuntu", "Work Sans",
];

const STEP_LABELS = ["Infos de base", "Voix de marque", "Identité visuelle", "Typographie"];

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

  // Step 4 — Typographie
  const [fontPrimary, setFontPrimary] = useState("Oswald");
  const [fontSecondary, setFontSecondary] = useState("");
  const [fontSearch, setFontSearch] = useState("");

  // Load Google Fonts for preview in step 4
  useEffect(() => {
    if (step !== 4) return;
    const families = FONTS.map(f => f.replace(/ /g, "+")).join("|");
    const id = "gf-all-preview";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
      document.head.appendChild(link);
    }
  }, [step]);

  // ── File upload helper ───────────────────────────────────────────────────────

  async function uploadFile(file: File, userId: string): Promise<string | null> {
    const ext = file.name.split(".").pop();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("brand-assets")
      .upload(path, file);
    if (uploadErr) { console.error("Upload:", uploadErr); return null; }
    return supabase.storage.from("brand-assets").getPublicUrl(path).data.publicUrl;
  }

  // ── Create workspace ─────────────────────────────────────────────────────────

  async function createWorkspace() {
    setError(null);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      let logoUrl: string | null = null;
      let logoDarkUrl: string | null = null;
      const assetUrls: string[] = [];

      if (logoFile)     logoUrl     = await uploadFile(logoFile, user.id);
      if (logoDarkFile) logoDarkUrl = await uploadFile(logoDarkFile, user.id);
      for (const f of assetFiles) {
        const url = await uploadFile(f, user.id);
        if (url) assetUrls.push(url);
      }

      // Build legacy brand_voice_prompt for backward compat with AI generation
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
        font_family: fontPrimary,
        font_secondary: fontSecondary || null,
      }).select().single();

      if (insertErr) throw insertErr;
      router.push(`/workspace/${data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la création.");
    }
    setLoading(false);
  }

  const canContinue = step === 1 ? name.trim().length > 0 : true;
  const filteredFonts = FONTS.filter(f =>
    f.toLowerCase().includes(fontSearch.toLowerCase())
  );

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
                      <div
                        key={col.label}
                        className="card"
                        style={{ padding: "14px 16px" }}
                      >
                        <span style={{ ...labelStyle, marginBottom: 12, display: "block" }}>{col.label}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <ColorPicker value={col.value} onChange={col.onChange} />
                          <span style={{
                            fontFamily: "var(--mono)", fontWeight: 700, fontSize: 12,
                            color: "var(--ink)", textTransform: "uppercase",
                          }}>
                            {col.value}
                          </span>
                        </div>
                        <div style={{
                          width: "100%", height: 6, borderRadius: 99, marginTop: 12,
                          background: col.value,
                          boxShadow: "inset 0 0 0 1px rgba(13,15,10,.08)",
                        }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Logos */}
                <div>
                  <label style={labelStyle}>Logos</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

                    {/* Logo principal */}
                    <UploadZone
                      label="Logo principal"
                      hint="PNG, SVG recommandé"
                      preview={logoPreview}
                      dark={false}
                      onClick={() => logoRef.current?.click()}
                      onRemove={() => { setLogoFile(null); setLogoPreview(null); }}
                    />
                    <input
                      ref={logoRef} type="file" accept=".png,.svg,.jpg,.jpeg"
                      style={{ display: "none" }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); }
                      }}
                    />

                    {/* Logo variante */}
                    <UploadZone
                      label={<>Logo variante <OptLabel /></>}
                      hint="Blanc ou noir sur fond inversé"
                      preview={logoDarkPreview}
                      dark={true}
                      onClick={() => logoDarkRef.current?.click()}
                      onRemove={() => { setLogoDarkFile(null); setLogoDarkPreview(null); }}
                    />
                    <input
                      ref={logoDarkRef} type="file" accept=".png,.svg,.jpg,.jpeg"
                      style={{ display: "none" }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) { setLogoDarkFile(f); setLogoDarkPreview(URL.createObjectURL(f)); }
                      }}
                    />
                  </div>
                </div>

                {/* Brand assets */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>
                      Assets supplémentaires <OptLabel /> <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--ink-3)" }}>— {assetFiles.length}/5</span>
                    </label>
                    {assetFiles.length < 5 && (
                      <button type="button" onClick={() => assetsRef.current?.click()}
                        style={{ fontSize: 12, fontWeight: 700, color: "var(--mint-2)", background: "none", border: "none", cursor: "pointer" }}>
                        + Ajouter
                      </button>
                    )}
                  </div>
                  <input
                    ref={assetsRef} type="file" accept=".png,.svg,.jpg,.jpeg" multiple
                    style={{ display: "none" }}
                    onChange={e => {
                      const files = Array.from(e.target.files ?? []);
                      const remaining = 5 - assetFiles.length;
                      const added = files.slice(0, remaining);
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
                          <button
                            type="button"
                            onClick={() => {
                              setAssetFiles(f => f.filter((_, j) => j !== i));
                              setAssetPreviews(p => p.filter((_, j) => j !== i));
                            }}
                            style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,.55)", border: "none", cursor: "pointer", color: "#fff", fontSize: 12, display: "grid", placeItems: "center" }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {assetFiles.length < 5 && (
                        <div
                          onClick={() => assetsRef.current?.click()}
                          style={{ aspectRatio: "1", borderRadius: 10, border: "2px dashed var(--line)", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-3)", fontSize: 22 }}
                        >
                          +
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => assetsRef.current?.click()}
                      style={{
                        border: "2px dashed var(--line)", borderRadius: 13, padding: 20,
                        background: "var(--white)", cursor: "pointer", textAlign: "center",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        gap: 8, color: "var(--ink-3)", fontSize: 13,
                      }}
                    >
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
              <div key="step4" className="screen-in" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 30, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 8 }}>
                    Typographie
                  </h1>
                  <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                    Les polices utilisées dans les visuels de ce client.
                  </p>
                </div>

                {/* Police principale */}
                <div>
                  <label style={labelStyle}>Police principale</label>
                  <input
                    style={{ ...inputStyle, marginBottom: 8 }}
                    value={fontSearch}
                    onChange={e => setFontSearch(e.target.value)}
                    placeholder="Rechercher une police Google Fonts..."
                    autoFocus
                  />
                  <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid rgba(13,15,10,.08)", borderRadius: 13, background: "var(--white)" }}>
                    {filteredFonts.length === 0 && (
                      <div style={{ padding: "16px 14px", fontSize: 13, color: "var(--ink-3)" }}>Aucune police trouvée</div>
                    )}
                    {filteredFonts.map(font => {
                      const active = fontPrimary === font;
                      return (
                        <button
                          key={font} type="button"
                          onClick={() => setFontPrimary(font)}
                          style={{
                            width: "100%", padding: "10px 14px", textAlign: "left", border: "none",
                            background: active ? "var(--mint-soft)" : "transparent",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                            borderBottom: "1px solid rgba(13,15,10,.05)",
                          }}
                        >
                          <span style={{ fontFamily: `"${font}", sans-serif`, fontSize: 16, color: active ? "var(--mint-2)" : "var(--ink)" }}>
                            {font}
                          </span>
                          {active && <span style={{ fontSize: 11, color: "var(--mint-2)", fontWeight: 800 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preview */}
                {fontPrimary && (
                  <div className="card" style={{ padding: "20px 24px" }}>
                    <span style={{ ...labelStyle, display: "block", marginBottom: 14 }}>Aperçu — {fontPrimary}</span>
                    <p style={{ fontFamily: `"${fontPrimary}", sans-serif`, fontSize: 30, fontWeight: 700, color: "var(--ink)", lineHeight: 1.15, margin: 0 }}>
                      Bonjour, voici votre marque
                    </p>
                    <p style={{ fontFamily: `"${fontPrimary}", sans-serif`, fontSize: 14, color: "var(--ink-2)", margin: "10px 0 0", lineHeight: 1.6 }}>
                      Texte courant — corps de texte en taille normale
                    </p>
                  </div>
                )}

                {/* Police secondaire */}
                <div>
                  <label style={labelStyle}>Police secondaire <OptLabel /></label>
                  <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid rgba(13,15,10,.08)", borderRadius: 13, background: "var(--white)" }}>
                    <button type="button"
                      onClick={() => setFontSecondary("")}
                      style={{ width: "100%", padding: "10px 14px", textAlign: "left", border: "none", borderBottom: "1px solid rgba(13,15,10,.05)", background: !fontSecondary ? "var(--mint-soft)" : "transparent", cursor: "pointer", fontSize: 13, color: !fontSecondary ? "var(--mint-2)" : "var(--ink-3)", fontWeight: !fontSecondary ? 700 : 400 }}>
                      Aucune
                    </button>
                    {FONTS.filter(f => f !== fontPrimary).map(font => {
                      const active = fontSecondary === font;
                      return (
                        <button
                          key={font} type="button"
                          onClick={() => setFontSecondary(font)}
                          style={{
                            width: "100%", padding: "10px 14px", textAlign: "left", border: "none",
                            background: active ? "var(--mint-soft)" : "transparent",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                            borderBottom: "1px solid rgba(13,15,10,.05)",
                          }}
                        >
                          <span style={{ fontFamily: `"${font}", sans-serif`, fontSize: 16, color: active ? "var(--mint-2)" : "var(--ink)" }}>
                            {font}
                          </span>
                          {active && <span style={{ fontSize: 11, color: "var(--mint-2)", fontWeight: 800 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
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
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                style={{
                  padding: "10px 20px", borderRadius: 13, background: "transparent",
                  border: "1px solid rgba(13,15,10,.12)", color: "var(--ink-2)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                ← Retour
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--mono)", fontWeight: 700 }}>
              {step} / {STEP_LABELS.length}
            </span>
            {step < 4 ? (
              <button
                type="button"
                onClick={() => { setStep(s => s + 1); }}
                disabled={!canContinue}
                style={{
                  padding: "11px 30px", borderRadius: 13,
                  background: canContinue ? "var(--ink)" : "var(--sunk)",
                  border: "none",
                  color: canContinue ? "var(--paper)" : "var(--ink-3)",
                  fontSize: 14, fontWeight: 700,
                  cursor: canContinue ? "pointer" : "not-allowed",
                  fontFamily: "var(--display)", transition: "all 0.15s",
                }}
              >
                Continuer →
              </button>
            ) : (
              <button
                type="button"
                onClick={createWorkspace}
                disabled={loading}
                style={{
                  padding: "11px 30px", borderRadius: 13,
                  background: "var(--mint)", border: "none",
                  color: "var(--mint-ink)", fontSize: 14, fontWeight: 700,
                  cursor: loading ? "default" : "pointer",
                  fontFamily: "var(--display)", transition: "all 0.15s",
                  opacity: loading ? 0.7 : 1,
                }}
              >
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
            <img
              src={preview} alt=""
              style={{ maxHeight: 68, maxWidth: "100%", objectFit: "contain" }}
            />
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove(); }}
              style={{
                position: "absolute", top: 8, right: 8,
                width: 22, height: 22, borderRadius: "50%",
                background: "rgba(0,0,0,.5)", border: "none",
                cursor: "pointer", color: "#fff", fontSize: 13,
                display: "grid", placeItems: "center",
              }}
            >
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
