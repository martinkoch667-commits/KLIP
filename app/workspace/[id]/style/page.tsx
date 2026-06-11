"use client";

import { useState, useRef, useEffect, CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";
import ColorPicker from "@/components/ColorPicker";

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockPosition = "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right";
type LogoPosition  = "top-left" | "top-right" | "bottom-left" | "bottom-right";
interface GFont    { family: string; category: string }

interface StyleState {
  text: string;
  font: string;           // Google family name or custom family name
  fontSize: number;
  uppercase: boolean;
  bold: boolean;
  blockBg: string;
  blockOpacity: number;
  blockTextColor: string;
  blockRadius: number;
  blockPosition: BlockPosition;
  logoUrl: string | null;
  logoPosition: LogoPosition;
  logoSize: number;
}

// ─── Fallback fonts ───────────────────────────────────────────────────────────

const FALLBACK_FONTS: GFont[] = [
  "Anton", "Archivo Black", "Barlow Condensed", "Bebas Neue",
  "DM Sans", "Exo 2", "Fjalla One", "Inter", "Josefin Sans",
  "Lato", "Merriweather", "Montserrat", "Nunito", "Oswald",
  "Outfit", "Playfair Display", "Plus Jakarta Sans", "Poppins",
  "Raleway", "Roboto Condensed", "Rubik", "Space Grotesk",
  "Syne", "Ubuntu", "Work Sans",
].map(f => ({ family: f, category: "sans-serif" }));

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOCK_POSITIONS: { value: BlockPosition; label: string }[] = [
  { value: "top-left",     label: "Haut gauche" },
  { value: "top-right",    label: "Haut droite" },
  { value: "center",       label: "Centre" },
  { value: "bottom-left",  label: "Bas gauche" },
  { value: "bottom-right", label: "Bas droite" },
];

const LOGO_POSITIONS: { value: LogoPosition; label: string }[] = [
  { value: "bottom-right", label: "Bas droite" },
  { value: "bottom-left",  label: "Bas gauche" },
  { value: "top-right",    label: "Haut droite" },
  { value: "top-left",     label: "Haut gauche" },
];

const DEFAULT_STYLE: StyleState = {
  text: "DU 6 AU 9 MAI, SUPER OFFRES",
  font: "Oswald",
  fontSize: 28,
  uppercase: true,
  bold: true,
  blockBg: "#0038FF",
  blockOpacity: 90,
  blockTextColor: "#FFFFFF",
  blockRadius: 6,
  blockPosition: "bottom-left",
  logoUrl: null,
  logoPosition: "bottom-right",
  logoSize: 64,
};

// ─── Module-level font loader ─────────────────────────────────────────────────

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

const labelStyle: CSSProperties = {
  display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700,
  color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em",
  fontFamily: "var(--display)",
};

const inputStyle: CSSProperties = {
  width: "100%", background: "var(--white)", border: "1px solid rgba(13,15,10,.10)",
  borderRadius: 9, padding: "9px 12px", fontSize: 13.5, color: "var(--ink)",
  outline: "none", fontFamily: "var(--sans)", boxSizing: "border-box",
};

// ─── Position helpers ─────────────────────────────────────────────────────────

function blockPositionStyle(pos: BlockPosition): CSSProperties {
  const base: CSSProperties = { position: "absolute", maxWidth: "80%" };
  switch (pos) {
    case "top-left":     return { ...base, top: 20, left: 20 };
    case "top-right":    return { ...base, top: 20, right: 20 };
    case "center":       return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)", maxWidth: "90%" };
    case "bottom-left":  return { ...base, bottom: 20, left: 20 };
    case "bottom-right": return { ...base, bottom: 20, right: 20 };
  }
}

function logoPositionStyle(pos: LogoPosition, size: number): CSSProperties {
  const base: CSSProperties = { position: "absolute", width: size, height: size };
  const gap = 16;
  switch (pos) {
    case "top-left":     return { ...base, top: gap, left: gap };
    case "top-right":    return { ...base, top: gap, right: gap };
    case "bottom-left":  return { ...base, bottom: gap, left: gap };
    case "bottom-right": return { ...base, bottom: gap, right: gap };
  }
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontFamily: "var(--display)", fontWeight: 800, fontSize: 13,
      color: "var(--ink)", marginBottom: 14, paddingBottom: 10,
      borderBottom: "1px solid var(--line-2)",
    }}>
      {children}
    </h3>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      style={{
        position: "relative", display: "inline-flex", alignItems: "center",
        width: 40, height: 22, borderRadius: 99, cursor: "pointer",
        background: value ? "var(--mint)" : "rgba(13,15,10,.14)",
        border: "none", transition: "background 0.15s", flexShrink: 0, padding: 0,
      }}>
      <span style={{
        position: "absolute", width: 16, height: 16, borderRadius: "50%",
        background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)",
        transition: "transform 0.15s",
        transform: value ? "translateX(20px)" : "translateX(3px)",
      }} />
    </button>
  );
}

function SliderField({ label, value, min, max, unit, onChange }: {
  label: string; value: number; min: number; max: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={labelStyle}>{label}</span>
        <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--mono)", fontWeight: 700 }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--mint)", height: 4, cursor: "pointer" }}
      />
    </div>
  );
}

function ColorField({ label, value, onChange, opacity, onOpacityChange }: {
  label: string; value: string; onChange: (v: string) => void;
  opacity?: number; onOpacityChange?: (v: number) => void;
}) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "var(--white)", border: "1px solid rgba(13,15,10,.10)",
        borderRadius: 9, padding: "8px 12px",
      }}>
        <ColorPicker value={value} onChange={onChange} opacity={opacity} onOpacityChange={onOpacityChange} />
        <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 12, color: "var(--ink)", textTransform: "uppercase" }}>
          {value}
        </span>
      </div>
    </div>
  );
}

// ─── FontPickerRow — lazy-loads the font via IntersectionObserver ─────────────

function FontPickerRow({
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
      { rootMargin: "100px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [family]);

  return (
    <button ref={ref} type="button" onClick={onSelect}
      style={{
        width: "100%", padding: "9px 12px", textAlign: "left", border: "none",
        borderBottom: "1px solid rgba(13,15,10,.04)",
        background: selected ? "var(--mint-soft)" : "transparent",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "background 0.1s",
      }}>
      <span style={{ fontFamily: `"${family}", sans-serif`, fontSize: 15, color: selected ? "var(--mint-2)" : "var(--ink)" }}>
        {family}
      </span>
      {selected && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--mint-2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      )}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkspaceStylePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [s, setS] = useState<StyleState>(DEFAULT_STYLE);
  const [workspaceName, setWorkspaceName] = useState("…");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Font picker state
  const [googleFonts, setGoogleFonts] = useState<GFont[]>([]);
  const [fontSearch, setFontSearch] = useState("");
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [fontPrimaryUrl, setFontPrimaryUrl] = useState<string | null>(null);
  const [isCustomFont, setIsCustomFont] = useState(false);
  const fontUploadRef = useRef<HTMLInputElement>(null);

  // Logo upload
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load workspace data
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("workspaces")
        .select("name, logo_url, primary_color, secondary_color, font_family, font_primary_url")
        .eq("id", id)
        .single();

      if (data) {
        setWorkspaceName(data.name ?? "…");

        // Handle custom font
        if (data.font_primary_url && data.font_family) {
          setIsCustomFont(true);
          setFontPrimaryUrl(data.font_primary_url);
          const styleId = "klip-custom-font-primary";
          if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.textContent = `@font-face { font-family: "${data.font_family}"; src: url("${data.font_primary_url}"); }`;
            document.head.appendChild(style);
          }
          setS(prev => ({
            ...prev,
            font: data.font_family,
            blockBg: data.primary_color ?? prev.blockBg,
            blockTextColor: data.secondary_color ?? prev.blockTextColor,
            logoUrl: data.logo_url ?? null,
          }));
        } else {
          // Google Font
          const fontFamily = data.font_family ?? "Oswald";
          loadGoogleFont(fontFamily);
          setS(prev => ({
            ...prev,
            font: fontFamily,
            blockBg: data.primary_color ?? prev.blockBg,
            blockTextColor: data.secondary_color ?? prev.blockTextColor,
            logoUrl: data.logo_url ?? null,
          }));
        }
      }
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  // Fetch Google Fonts catalog
  useEffect(() => {
    fetch("/api/google-fonts")
      .then(r => r.json())
      .then(data => setGoogleFonts(Array.isArray(data) ? data : FALLBACK_FONTS))
      .catch(() => setGoogleFonts(FALLBACK_FONTS));
  }, []);

  // Load font whenever it changes
  useEffect(() => {
    if (!isCustomFont) loadGoogleFont(s.font);
  }, [s.font, isCustomFont]);

  function set<K extends keyof StyleState>(key: K, value: StyleState[K]) {
    setS(prev => ({ ...prev, [key]: value }));
  }

  function handleLogoUpload(files: FileList | null) {
    if (!files?.[0]) return;
    set("logoUrl", URL.createObjectURL(files[0]));
  }

  // Custom font upload — immediate upload to Supabase + @font-face injection
  async function handleCustomFontUpload(file: File) {
    const family = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    const blobUrl = URL.createObjectURL(file);

    // Preview immediately with blob URL
    const styleId = "klip-custom-font-primary";
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) existingStyle.remove();
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `@font-face { font-family: "${family}"; src: url("${blobUrl}"); }`;
    document.head.appendChild(style);

    set("font", family);
    setIsCustomFont(true);
    setFontPrimaryUrl(null); // will be set after upload

    // Upload to Supabase Storage
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const ext = file.name.split(".").pop();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("brand-fonts").upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("brand-fonts").getPublicUrl(path);
      setFontPrimaryUrl(publicUrl);
      // Update @font-face to use the permanent URL
      const st = document.getElementById(styleId) as HTMLStyleElement | null;
      if (st) st.textContent = `@font-face { font-family: "${family}"; src: url("${publicUrl}"); }`;
    }
  }

  function handleSelectGoogleFont(family: string) {
    loadGoogleFont(family);
    set("font", family);
    setIsCustomFont(false);
    setFontPrimaryUrl(null);
    setFontPickerOpen(false);
    setFontSearch("");
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from("workspaces").update({
      font_family: s.font,
      font_primary_url: fontPrimaryUrl,
      primary_color: s.blockBg,
      secondary_color: s.blockTextColor,
    }).eq("id", id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleSaveAndContinue() {
    await handleSave();
    router.push(`/workspace/${id}`);
  }

  const fontSource = googleFonts.length > 0 ? googleFonts : FALLBACK_FONTS;
  const filteredFonts = fontSearch.trim()
    ? fontSource.filter(f => f.family.toLowerCase().includes(fontSearch.toLowerCase()))
    : fontSource.slice(0, 80);

  const blockStyle: CSSProperties = {
    ...blockPositionStyle(s.blockPosition),
    backgroundColor: `rgba(${hexToRgb(s.blockBg)}, ${s.blockOpacity / 100})`,
    borderRadius: s.blockRadius,
    padding: "10px 16px",
  };

  const textStyle: CSSProperties = {
    fontFamily: `"${s.font}", sans-serif`,
    fontSize: s.fontSize,
    color: s.blockTextColor,
    fontWeight: s.bold ? 700 : 400,
    textTransform: s.uppercase ? "uppercase" : "none",
    lineHeight: 1.2,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "var(--canvas)" }}>
        <Sidebar />
        <div style={{ marginLeft: "var(--sb-w)", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)" }}>
          Chargement…
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--canvas)" }}>
      <Sidebar />

      <div style={{ marginLeft: "var(--sb-w)", flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Topbar */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 26px", height: 64, flexShrink: 0,
          borderBottom: "1px solid var(--line)",
          background: "color-mix(in srgb, var(--canvas) 86%, transparent)",
          backdropFilter: "blur(10px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href={`/workspace/${id}/parametres`}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-3)", fontWeight: 600 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {workspaceName}
            </Link>
            <span style={{ color: "var(--line)", fontSize: 16 }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Style visuel</span>
          </div>
          {saved && (
            <span style={{ fontSize: 12, color: "var(--mint-2)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              Sauvegardé
            </span>
          )}
        </header>

        {/* Two-column layout */}
        <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

          {/* Left panel */}
          <div style={{ width: "45%", borderRight: "1px solid var(--line-2)", display: "flex", flexDirection: "column", overflowY: "auto", flexShrink: 0 }}>
            <div style={{ padding: "28px 28px 0", flex: 1 }}>
              <h2 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 22, color: "var(--ink)", marginBottom: 6, letterSpacing: "-0.02em" }}>
                Style visuel
              </h2>
              <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 28 }}>
                Identité visuelle de <strong style={{ color: "var(--ink)" }}>{workspaceName}</strong>
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

                {/* Section Texte */}
                <section>
                  <SectionTitle>Texte</SectionTitle>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <span style={labelStyle}>Contenu du bloc</span>
                      <textarea value={s.text} onChange={(e) => set("text", e.target.value)}
                        placeholder="DU 6 AU 9 MAI, SUPER OFFRES" rows={2}
                        style={{ ...inputStyle, resize: "none" }} />
                    </div>

                    {/* Font picker — combobox */}
                    <div>
                      <span style={labelStyle}>
                        Typographie
                        {isCustomFont && (
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "var(--mint-2)", textTransform: "none", letterSpacing: 0, background: "var(--mint-soft)", padding: "2px 7px", borderRadius: 99 }}>
                            CUSTOM
                          </span>
                        )}
                      </span>

                      {/* Combobox trigger / search */}
                      <div style={{ position: "relative" }}>
                        <input
                          value={fontPickerOpen ? fontSearch : s.font}
                          readOnly={!fontPickerOpen}
                          onFocus={() => { setFontPickerOpen(true); setFontSearch(""); }}
                          onBlur={() => setTimeout(() => setFontPickerOpen(false), 160)}
                          onChange={e => setFontSearch(e.target.value)}
                          style={{
                            ...inputStyle,
                            fontFamily: fontPickerOpen ? "var(--sans)" : `"${s.font}", sans-serif`,
                            cursor: fontPickerOpen ? "text" : "pointer",
                          }}
                          placeholder="Changer de police..."
                        />
                        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--ink-3)", fontSize: 10 }}>
                          {fontPickerOpen ? "▲" : "▼"}
                        </span>

                        {/* Dropdown */}
                        {fontPickerOpen && (
                          <div style={{
                            position: "absolute", zIndex: 200, top: "calc(100% + 4px)", left: 0, right: 0,
                            maxHeight: 220, overflowY: "auto",
                            background: "var(--white)", border: "1px solid rgba(13,15,10,.12)",
                            borderRadius: 9, boxShadow: "0 4px 18px rgba(0,0,0,.14)",
                          }}>
                            {filteredFonts.length === 0 ? (
                              <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--ink-3)" }}>Aucune police trouvée</div>
                            ) : (
                              filteredFonts.map(font => (
                                <FontPickerRow
                                  key={font.family}
                                  family={font.family}
                                  selected={!isCustomFont && s.font === font.family}
                                  onSelect={() => handleSelectGoogleFont(font.family)}
                                />
                              ))
                            )}
                            {!fontSearch && googleFonts.length > 80 && (
                              <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--ink-3)", borderTop: "1px solid rgba(13,15,10,.05)", textAlign: "center" }}>
                                Rechercher parmi {googleFonts.length.toLocaleString()} polices...
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Custom font upload */}
                      <button type="button"
                        onClick={() => fontUploadRef.current?.click()}
                        style={{
                          marginTop: 6, width: "100%", padding: "8px 12px", borderRadius: 9,
                          border: "1.5px dashed rgba(13,15,10,.18)", background: "transparent",
                          cursor: "pointer", fontSize: 12, color: "var(--ink-3)", fontWeight: 600,
                          display: "flex", alignItems: "center", gap: 6, transition: "all 0.12s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--mint)"; e.currentTarget.style.color = "var(--mint-2)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(13,15,10,.18)"; e.currentTarget.style.color = "var(--ink-3)"; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                        </svg>
                        {isCustomFont ? `Custom : ${s.font} — changer` : "Uploader police custom (.ttf, .otf, .woff)"}
                      </button>
                      <input ref={fontUploadRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleCustomFontUpload(f); e.target.value = ""; }}
                      />
                    </div>

                    <SliderField label="Taille du texte" value={s.fontSize} min={16} max={80} unit="px" onChange={(v) => set("fontSize", v)} />

                    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Toggle value={s.uppercase} onChange={(v) => set("uppercase", v)} />
                        <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>Majuscules</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Toggle value={s.bold} onChange={(v) => set("bold", v)} />
                        <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>Gras</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Section Bloc texte */}
                <section>
                  <SectionTitle>Bloc texte</SectionTitle>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <ColorField label="Couleur principale" value={s.blockBg} onChange={(v) => set("blockBg", v)}
                        opacity={s.blockOpacity} onOpacityChange={(v) => set("blockOpacity", v)} />
                      <ColorField label="Couleur secondaire" value={s.blockTextColor} onChange={(v) => set("blockTextColor", v)} />
                    </div>
                    <SliderField label="Arrondi des coins" value={s.blockRadius} min={0} max={20} unit="px" onChange={(v) => set("blockRadius", v)} />
                    <div>
                      <span style={labelStyle}>Position du bloc</span>
                      <select value={s.blockPosition} onChange={(e) => set("blockPosition", e.target.value as BlockPosition)}
                        style={{ ...inputStyle, cursor: "pointer", appearance: "none" as const }}>
                        {BLOCK_POSITIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                </section>

                {/* Section Logo */}
                <section>
                  <SectionTitle>Logo</SectionTitle>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <span style={labelStyle}>Logo client</span>
                      <div onClick={() => logoInputRef.current?.click()}
                        style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                        <div style={{
                          width: 52, height: 52, borderRadius: "var(--r-s)", flexShrink: 0,
                          border: "2px dashed var(--line)", background: "var(--white)",
                          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                        }}>
                          {s.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                              <path d="M9 3v12M3 9h12" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          )}
                        </div>
                        <span style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 600 }}>
                          {s.logoUrl ? "Changer le logo" : "Uploader un logo"}
                        </span>
                      </div>
                      <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }}
                        onChange={(e) => handleLogoUpload(e.target.files)} />
                    </div>

                    <div>
                      <span style={labelStyle}>Position du logo</span>
                      <select value={s.logoPosition} onChange={(e) => set("logoPosition", e.target.value as LogoPosition)}
                        style={{ ...inputStyle, cursor: "pointer", appearance: "none" as const }}>
                        {LOGO_POSITIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>

                    <SliderField label="Taille du logo" value={s.logoSize} min={40} max={120} unit="px" onChange={(v) => set("logoSize", v)} />
                  </div>
                </section>

              </div>
            </div>

            {/* Save buttons */}
            <div style={{ padding: "16px 28px", borderTop: "1px solid var(--line-2)", background: "var(--canvas)", position: "sticky", bottom: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={handleSaveAndContinue} disabled={saving}
                style={{
                  width: "100%", padding: "12px", borderRadius: 13,
                  background: "var(--mint)", border: "none", color: "var(--mint-ink)",
                  fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer",
                  fontFamily: "var(--display)", transition: "background 0.15s", opacity: saving ? 0.7 : 1,
                }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.background = "var(--mint-2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--mint)"; }}>
                {saving ? "Sauvegarde…" : "Sauvegarder et continuer →"}
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{
                  width: "100%", padding: "10px", borderRadius: 13,
                  background: "transparent", border: "1px solid rgba(13,15,10,.12)",
                  color: "var(--ink-2)", fontSize: 13, fontWeight: 600,
                  cursor: saving ? "default" : "pointer", fontFamily: "var(--sans)",
                }}>
                {saved ? "✓ Sauvegardé" : "Sauvegarder ce style"}
              </button>
            </div>
          </div>

          {/* Right panel — Preview */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sunk)", padding: 32, overflow: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <span style={labelStyle}>Aperçu — 1:1 Instagram</span>

              <div style={{ position: "relative", overflow: "hidden", width: 520, height: 520, flexShrink: 0, borderRadius: "var(--r)", boxShadow: "var(--shadow-pop)" }}>
                <div style={{ position: "absolute", inset: 0, background: "#CCCCCC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, userSelect: "none", pointerEvents: "none" }}>
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                      <rect x="2" y="7" width="36" height="27" rx="3" stroke="#AAAAAA" strokeWidth="1.5"/>
                      <circle cx="14" cy="18" r="4" stroke="#AAAAAA" strokeWidth="1.5"/>
                      <path d="M2 30l10-10 7 7 6-6 13 12" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontSize: 13, color: "#AAAAAA" }}>Ta photo ici</span>
                  </div>
                </div>

                {s.text && (
                  <div style={blockStyle}>
                    <p style={textStyle}>{s.text}</p>
                  </div>
                )}

                <div style={logoPositionStyle(s.logoPosition, s.logoSize)}>
                  {s.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.3))" }} />
                  ) : (
                    <div style={{
                      width: "100%", height: "100%", borderRadius: "var(--r-s)",
                      background: "rgba(255,255,255,.8)", border: "1px solid rgba(255,255,255,.5)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontSize: 9, color: "#999", fontFamily: "var(--mono)", fontWeight: 700, textAlign: "center", padding: "0 4px" }}>LOGO</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                {[
                  { label: "Police", value: s.font },
                  { label: "Taille", value: `${s.fontSize}px` },
                  { label: "Position", value: BLOCK_POSITIONS.find(p => p.value === s.blockPosition)?.label },
                ].map(item => (
                  <span key={item.label} style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {item.label} : <span style={{ color: "var(--ink)", fontWeight: 600 }}>{item.value}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
