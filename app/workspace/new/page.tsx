"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Sidebar from "@/components/Sidebar";

const FONTS = ["Inter", "Syne", "Montserrat", "Poppins", "Oswald"];
const TONES = ["Professionnel", "Inspirant", "Fun", "Luxe", "Engagé", "Minimaliste"];
const ADDRESS_STYLES = ["Tutoiement", "Vouvoiement", "Neutre"];
const DESCRIPTION_STYLES = ["Court et percutant", "Storytelling", "Informatif", "Fun", "Élégant", "Direct"];

function buildBrandVoicePrompt(tone: string, addressStyle: string, wordsToUse: string, wordsToAvoid: string): string {
  const parts: string[] = [];
  if (tone) parts.push(`Ton : ${tone}`);
  if (addressStyle && addressStyle !== "Neutre") parts.push(`Style d'adresse : ${addressStyle}`);
  if (wordsToUse.trim()) parts.push(`Mots/expressions à utiliser : ${wordsToUse.trim()}`);
  if (wordsToAvoid.trim()) parts.push(`Mots/expressions à éviter : ${wordsToAvoid.trim()}`);
  return parts.join("\n");
}

// ─── Shared field styles ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", background: "#fff", border: "1px solid rgba(13,15,10,.10)",
  borderRadius: 13, padding: "11px 16px", fontSize: 14, color: "var(--ink)",
  outline: "none", fontFamily: "var(--sans)", boxSizing: "border-box",
};
const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: "none",
};
const labelStyle: React.CSSProperties = {
  display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700,
  color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em",
  fontFamily: "var(--display)",
};
const btnPrimary: React.CSSProperties = {
  width: "100%", padding: "13px", borderRadius: 13,
  background: "#2FD79B", border: "none", color: "var(--mint-ink)",
  fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "var(--display)",
};
const btnGhost: React.CSSProperties = {
  padding: "13px", borderRadius: 13, background: "transparent",
  border: "1px solid rgba(13,15,10,.12)", color: "var(--ink-2)",
  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)",
};

export default function NewWorkspacePage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [step, setStep] = useState(1);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [tone, setTone] = useState("");
  const [addressStyle, setAddressStyle] = useState("Neutre");
  const [wordsToUse, setWordsToUse] = useState("");
  const [wordsToAvoid, setWordsToAvoid] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [descriptionStyles, setDescriptionStyles] = useState<string[]>([]);
  const [captionExamples, setCaptionExamples] = useState("");

  const [primaryColor, setPrimaryColor] = useState("#0038FF");
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF");
  const [font, setFont] = useState("Oswald");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleLogo(files: FileList | null) {
    if (!files?.[0]) return;
    setLogoFile(files[0]);
    setLogoPreview(URL.createObjectURL(files[0]));
  }

  async function createWorkspace() {
    setError(null);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      let logoUrl: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("logos").upload(path, logoFile, { upsert: true });
        if (!uploadError) {
          const { data } = supabase.storage.from("logos").getPublicUrl(path);
          logoUrl = data.publicUrl;
        }
      }

      const brandVoicePrompt = buildBrandVoicePrompt(tone, addressStyle, wordsToUse, wordsToAvoid);
      const { data, error: insertError } = await supabase.from("workspaces").insert({
        name: name.trim(), user_id: user.id, logo_url: logoUrl,
        primary_color: primaryColor, secondary_color: secondaryColor, font_family: font,
        tone: tone || null, address_style: addressStyle !== "Neutre" ? addressStyle : null,
        brand_voice_prompt: brandVoicePrompt || null, company_description: companyDescription.trim() || null,
        description_style: descriptionStyles.length > 0 ? descriptionStyles.join(", ") : null,
        caption_examples: captionExamples.trim() || null,
      }).select().single();

      if (insertError) throw insertError;
      setWorkspaceId(data.id);
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
    setLoading(false);
  }

  const stepLabels = ["Informations", "Voix de marque", "Style visuel", "Instagram"];

  function PillGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => onChange(value === opt ? "" : opt)}
            style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12.5, fontWeight: 600, border: "1.5px solid", cursor: "pointer", transition: "all 0.12s", fontFamily: "var(--sans)",
              background: value === opt ? "var(--mint)" : "var(--white)",
              borderColor: value === opt ? "var(--mint)" : "rgba(13,15,10,.12)",
              color: value === opt ? "var(--mint-ink)" : "var(--ink-2)" }}>
            {opt}
          </button>
        ))}
      </div>
    );
  }

  function MultiPillGroup({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map(opt => {
          const active = value.includes(opt);
          return (
            <button key={opt} type="button"
              onClick={() => onChange(active ? value.filter(v => v !== opt) : [...value, opt])}
              style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12.5, fontWeight: 600, border: "1.5px solid", cursor: "pointer", transition: "all 0.12s", fontFamily: "var(--sans)",
                background: active ? "var(--mint)" : "var(--white)",
                borderColor: active ? "var(--mint)" : "rgba(13,15,10,.12)",
                color: active ? "var(--mint-ink)" : "var(--ink-2)" }}>
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--canvas)", fontFamily: "var(--sans)" }}>
      <Sidebar />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, marginLeft: "var(--sb-w)" }}>

        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", padding: "16px 32px", borderBottom: "1px solid var(--line)", background: "var(--white)" }}>
          <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-3)", textDecoration: "none", fontFamily: "var(--sans)", fontWeight: 600 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Retour au dashboard
          </Link>
        </header>

        <main style={{ flex: 1, display: "flex", justifyContent: "center", padding: "48px 32px" }}>
          <div style={{ width: "100%", maxWidth: 520 }}>

            {/* Step indicator */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: 40 }}>
              {stepLabels.map((label, i) => {
                const n = i + 1;
                const done = step > n;
                const active = step === n;
                return (
                  <div key={n} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0,
                        background: done ? "var(--mint)" : active ? "var(--ink)" : "var(--line)",
                        color: done ? "var(--mint-ink)" : active ? "var(--paper)" : "var(--ink-3)",
                        fontFamily: "var(--display)" }}>
                        {done ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> : n}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: active ? "var(--ink)" : "var(--ink-3)", fontFamily: "var(--sans)" }}>{label}</span>
                    </div>
                    {i < stepLabels.length - 1 && <div style={{ margin: "0 12px", width: 24, height: 1, background: "var(--line)" }} />}
                  </div>
                );
              })}
            </div>

            {/* ── Step 1: Informations ── */}
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 28, letterSpacing: "-0.02em", color: "var(--ink)", marginBottom: 6 }}>Nouveau client</h1>
                  <p style={{ fontSize: 14, color: "var(--ink-2)" }}>Renseignez les informations de base de votre client.</p>
                </div>
                <div>
                  <label style={labelStyle}>Nom du client *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Ex. Leclerc Geispolsheim" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Logo du client</label>
                  <div onClick={() => logoInputRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 16, cursor: "pointer", padding: "12px 16px", borderRadius: 13, border: "1px solid rgba(13,15,10,.10)", background: "#fff" }}>
                    <div style={{ width: 56, height: 56, borderRadius: 12, border: "1.5px dashed rgba(13,15,10,.15)", background: "var(--sunk)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      {logoPreview
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={logoPreview} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      }
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{logoPreview ? "Changer le logo" : "Uploader un logo"}</p>
                      <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 3 }}>PNG, SVG recommandé — fond transparent</p>
                    </div>
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleLogo(e.target.files)} />
                </div>
                <button onClick={() => setStep(2)} disabled={!name.trim()}
                  style={{ ...btnPrimary, opacity: !name.trim() ? 0.4 : 1 }}>
                  Suivant →
                </button>
              </div>
            )}

            {/* ── Step 2: Voix de marque ── */}
            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 28, letterSpacing: "-0.02em", color: "var(--ink)", marginBottom: 6 }}>Voix de marque</h1>
                  <p style={{ fontSize: 14, color: "var(--ink-2)" }}>Définissez le style de communication de <strong style={{ color: "var(--ink)" }}>{name}</strong>.</p>
                </div>
                <div>
                  <label style={labelStyle}>Ton de la marque</label>
                  <PillGroup options={TONES} value={tone} onChange={setTone} />
                </div>
                <div>
                  <label style={labelStyle}>Style d&apos;adresse</label>
                  <PillGroup options={ADDRESS_STYLES} value={addressStyle} onChange={v => setAddressStyle(v || "Neutre")} />
                </div>
                <div>
                  <label style={labelStyle}>Mots / expressions à utiliser</label>
                  <textarea value={wordsToUse} onChange={e => setWordsToUse(e.target.value)}
                    placeholder="Ex. innovation, excellence, proximité…" rows={2} style={textareaStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Mots / expressions à éviter</label>
                  <textarea value={wordsToAvoid} onChange={e => setWordsToAvoid(e.target.value)}
                    placeholder="Ex. pas cher, discount, promo…" rows={2} style={textareaStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Description de l&apos;entreprise</label>
                  <textarea value={companyDescription} onChange={e => setCompanyDescription(e.target.value)}
                    placeholder="Ex. Boulangerie artisanale fondée en 1987…" rows={3} style={textareaStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Style de description</label>
                  <MultiPillGroup options={DESCRIPTION_STYLES} value={descriptionStyles} onChange={setDescriptionStyles} />
                </div>
                <div>
                  <label style={labelStyle}>Consignes pour les descriptions</label>
                  <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 8, lineHeight: 1.5 }}>
                    Décrivez le style souhaité, les formules à éviter. Plus c&apos;est précis, meilleure sera la génération.
                  </p>
                  <textarea value={captionExamples} onChange={e => setCaptionExamples(e.target.value)}
                    placeholder={'Ex. "Textes courts et punchy, toujours terminer par une question…"'}
                    rows={3} style={textareaStyle} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep(1)} style={{ ...btnGhost, flex: 1 }}>← Retour</button>
                  <button onClick={() => setStep(3)} style={{ ...btnPrimary, flex: 1, width: "auto" }}>Suivant →</button>
                </div>
                <button onClick={() => setStep(3)} style={{ width: "100%", fontSize: 12, color: "var(--ink-3)", background: "none", border: "none", cursor: "pointer", textAlign: "center", fontFamily: "var(--sans)" }}>
                  Passer cette étape
                </button>
              </div>
            )}

            {/* ── Step 3: Style visuel ── */}
            {step === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 28, letterSpacing: "-0.02em", color: "var(--ink)", marginBottom: 6 }}>Style visuel</h1>
                  <p style={{ fontSize: 14, color: "var(--ink-2)" }}>Définissez l&apos;identité visuelle de <strong style={{ color: "var(--ink)" }}>{name}</strong>.</p>
                </div>
                <div style={{ width: "100%", height: 96, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", background: primaryColor, boxShadow: "0 2px 12px rgba(13,15,10,.1)" }}>
                  <span style={{ color: secondaryColor, fontFamily: `"${font}", sans-serif`, fontWeight: "bold", fontSize: "20px", textTransform: "uppercase" }}>{name}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {[
                    { label: "Couleur primaire", value: primaryColor, onChange: setPrimaryColor },
                    { label: "Couleur secondaire", value: secondaryColor, onChange: setSecondaryColor },
                  ].map(({ label, value, onChange }) => (
                    <div key={label}>
                      <label style={labelStyle}>{label}</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid rgba(13,15,10,.10)", borderRadius: 13, padding: "8px 14px" }}>
                        <input type="color" value={value} onChange={e => onChange(e.target.value)}
                          style={{ width: 24, height: 24, borderRadius: 6, cursor: "pointer", border: "none", background: "transparent", padding: 0 }} />
                        <span style={{ fontSize: 13, color: "var(--ink)", textTransform: "uppercase", fontFamily: "var(--mono)", fontWeight: 700 }}>{value}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <label style={labelStyle}>Typographie</label>
                  <select value={font} onChange={e => setFont(e.target.value)}
                    style={{ ...inputStyle, appearance: "none" }}>
                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                {error && (
                  <p style={{ fontSize: 12, color: "var(--warn)", background: "rgba(200,115,43,.08)", border: "1px solid rgba(200,115,43,.15)", borderRadius: 8, padding: "8px 12px" }}>{error}</p>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep(2)} style={{ ...btnGhost, flex: 1 }}>← Retour</button>
                  <button onClick={createWorkspace} disabled={loading}
                    style={{ ...btnPrimary, flex: 1, width: "auto", opacity: loading ? 0.4 : 1 }}>
                    {loading ? "Création…" : "Créer le workspace"}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 4: Instagram ── */}
            {step === 4 && workspaceId && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 28, letterSpacing: "-0.02em", color: "var(--ink)", marginBottom: 6 }}>Connecter Instagram</h1>
                  <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
                    Connectez le compte Instagram Business de <strong style={{ color: "var(--ink)" }}>{name}</strong> pour publier depuis Klip.
                  </p>
                </div>
                <div style={{ padding: 24, borderRadius: 13, border: "1px solid rgba(13,15,10,.10)", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, boxShadow: "0 2px 12px rgba(13,15,10,.06)" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--display)" }}>Instagram Business</p>
                    <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4, maxWidth: 280 }}>Nécessite un compte Instagram Business lié à une page Facebook</p>
                  </div>
                  <a href={`/api/auth/meta/connect?workspaceId=${workspaceId}`}
                    style={{ width: "100%", padding: "13px", borderRadius: 13, background: "#2FD79B", color: "var(--mint-ink)", fontSize: 13, fontWeight: 700, textDecoration: "none", textAlign: "center", fontFamily: "var(--display)", display: "block" }}>
                    Connecter Instagram
                  </a>
                </div>
                <button onClick={() => router.push(`/workspace/${workspaceId}`)}
                  style={{ ...btnGhost, width: "100%" }}>
                  Passer cette étape
                </button>
                <p style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center" }}>
                  Vous pourrez connecter Instagram plus tard dans les paramètres du workspace.
                </p>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
