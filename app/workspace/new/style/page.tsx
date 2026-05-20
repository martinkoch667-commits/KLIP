"use client";

import { useState, useRef, CSSProperties } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockPosition = "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right";
type LogoPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type Font = "Inter" | "Syne" | "Montserrat" | "Oswald" | "Anton";

interface StyleState {
  // Text
  text: string;
  font: Font;
  fontSize: number;
  uppercase: boolean;
  bold: boolean;
  // Block
  blockBg: string;
  blockOpacity: number;
  blockTextColor: string;
  blockRadius: number;
  blockPosition: BlockPosition;
  // Logo
  logoUrl: string | null;
  logoPosition: LogoPosition;
  logoSize: number;
}

// ─── Position helpers ─────────────────────────────────────────────────────────

const BLOCK_POSITIONS: { value: BlockPosition; label: string }[] = [
  { value: "top-left", label: "Haut gauche" },
  { value: "top-right", label: "Haut droite" },
  { value: "center", label: "Centre" },
  { value: "bottom-left", label: "Bas gauche" },
  { value: "bottom-right", label: "Bas droite" },
];

const LOGO_POSITIONS: { value: LogoPosition; label: string }[] = [
  { value: "bottom-right", label: "Bas droite" },
  { value: "bottom-left", label: "Bas gauche" },
  { value: "top-right", label: "Haut droite" },
  { value: "top-left", label: "Haut gauche" },
];

const FONTS: Font[] = ["Inter", "Syne", "Montserrat", "Oswald", "Anton"];

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
    <h3 className="font-syne font-bold text-sm text-black mb-4 pb-2 border-b border-[#E0E0E0]">
      {children}
    </h3>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-inter font-medium text-[#888] uppercase tracking-wider mb-1.5">
      {children}
    </p>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors shrink-0 ${
        value ? "bg-black" : "bg-[#DDD]"
      }`}
    >
      <span
        className={`absolute w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function SliderField({
  label, value, min, max, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label>{label}</Label>
        <span className="text-xs font-inter text-[#888]">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-black h-1 rounded cursor-pointer"
      />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-3 bg-[#F5F5F5] border border-[#E0E0E0] rounded px-3 py-2 hover:border-black transition-colors cursor-pointer">
        <input
          type="color" value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
        />
        <span className="text-sm font-inter text-black uppercase tracking-wider">{value}</span>
      </div>
    </div>
  );
}

function SelectField<T extends string>({
  label, value, options, onChange,
}: {
  label: string; value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded px-3 py-2.5 text-sm font-inter text-black focus:border-black outline-none transition-colors appearance-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const INITIAL: StyleState = {
  text: "DU 6 AU 9 MAI, SUPER OFFRES",
  font: "Inter",
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

export default function StyleEditorPage() {
  const [s, setS] = useState<StyleState>(INITIAL);
  const logoInputRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof StyleState>(key: K, value: StyleState[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  function handleLogoUpload(files: FileList | null) {
    if (!files?.[0]) return;
    set("logoUrl", URL.createObjectURL(files[0]));
  }

  // Computed canvas styles
  const blockStyle: CSSProperties = {
    ...blockPositionStyle(s.blockPosition),
    backgroundColor: `rgba(${hexToRgb(s.blockBg)}, ${s.blockOpacity / 100})`,
    borderRadius: s.blockRadius,
    padding: "10px 16px",
  };

  const textStyle: CSSProperties = {
    fontFamily: s.font,
    fontSize: s.fontSize,
    color: s.blockTextColor,
    fontWeight: s.bold ? 700 : 400,
    textTransform: s.uppercase ? "uppercase" : "none",
    lineHeight: 1.2,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-3.5 border-b border-[#E0E0E0] bg-white shrink-0">
          <div className="flex items-center gap-3">
            <Link
              href="/workspace/new"
              className="inline-flex items-center gap-1.5 text-sm font-inter text-[#888] hover:text-black transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Nouveau client
            </Link>
            <span className="text-[#DDD]">/</span>
            <span className="text-sm font-inter font-medium text-black">Style visuel</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shrink-0">
            <span className="text-xs font-syne font-bold text-white">MK</span>
          </div>
        </header>

        {/* Two-column layout */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Left panel (45%) ── */}
          <div className="w-[45%] border-r border-[#E0E0E0] flex flex-col overflow-y-auto shrink-0">
            <div className="p-7 flex-1">
              <h2 className="font-syne font-extrabold text-xl text-black mb-7">Style visuel</h2>

              <div className="space-y-7">

                {/* Section Texte */}
                <section>
                  <SectionTitle>Texte</SectionTitle>
                  <div className="space-y-4">
                    <div>
                      <Label>Contenu du bloc</Label>
                      <textarea
                        value={s.text}
                        onChange={(e) => set("text", e.target.value)}
                        placeholder="DU 6 AU 9 MAI, SUPER OFFRES"
                        rows={2}
                        className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded px-3.5 py-2.5 text-sm font-inter text-black placeholder-[#BBB] focus:border-black outline-none transition-colors resize-none"
                      />
                    </div>

                    <SelectField
                      label="Typographie"
                      value={s.font}
                      options={FONTS.map((f) => ({ value: f, label: f }))}
                      onChange={(v) => set("font", v)}
                    />

                    <SliderField
                      label="Taille du texte"
                      value={s.fontSize}
                      min={16} max={80} unit="px"
                      onChange={(v) => set("fontSize", v)}
                    />

                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2.5">
                        <Toggle value={s.uppercase} onChange={(v) => set("uppercase", v)} />
                        <span className="text-sm font-inter text-black">Majuscules</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Toggle value={s.bold} onChange={(v) => set("bold", v)} />
                        <span className="text-sm font-inter text-black">Gras</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Section Bloc texte */}
                <section>
                  <SectionTitle>Bloc texte</SectionTitle>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <ColorField
                        label="Couleur du fond"
                        value={s.blockBg}
                        onChange={(v) => set("blockBg", v)}
                      />
                      <ColorField
                        label="Couleur du texte"
                        value={s.blockTextColor}
                        onChange={(v) => set("blockTextColor", v)}
                      />
                    </div>

                    <SliderField
                      label="Opacité du fond"
                      value={s.blockOpacity}
                      min={0} max={100} unit="%"
                      onChange={(v) => set("blockOpacity", v)}
                    />

                    <SliderField
                      label="Arrondi des coins"
                      value={s.blockRadius}
                      min={0} max={20} unit="px"
                      onChange={(v) => set("blockRadius", v)}
                    />

                    <SelectField
                      label="Position du bloc"
                      value={s.blockPosition}
                      options={BLOCK_POSITIONS}
                      onChange={(v) => set("blockPosition", v)}
                    />
                  </div>
                </section>

                {/* Section Logo */}
                <section>
                  <SectionTitle>Logo</SectionTitle>
                  <div className="space-y-4">
                    {/* Upload */}
                    <div>
                      <Label>Logo client</Label>
                      <div
                        onClick={() => logoInputRef.current?.click()}
                        className="flex items-center gap-4 cursor-pointer group"
                      >
                        <div className="w-14 h-14 rounded border-2 border-dashed border-[#E0E0E0] bg-[#F5F5F5] group-hover:border-black flex items-center justify-center overflow-hidden transition-colors shrink-0">
                          {s.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                              <path d="M9 3v12M3 9h12" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-inter text-[#555] group-hover:text-black transition-colors">
                          {s.logoUrl ? "Changer le logo" : "Uploader un logo"}
                        </span>
                      </div>
                      <input
                        ref={logoInputRef}
                        type="file" accept="image/*" className="hidden"
                        onChange={(e) => handleLogoUpload(e.target.files)}
                      />
                    </div>

                    <SelectField
                      label="Position du logo"
                      value={s.logoPosition}
                      options={LOGO_POSITIONS}
                      onChange={(v) => set("logoPosition", v)}
                    />

                    <SliderField
                      label="Taille du logo"
                      value={s.logoSize}
                      min={40} max={120} unit="px"
                      onChange={(v) => set("logoSize", v)}
                    />
                  </div>
                </section>
              </div>
            </div>

            {/* Save button */}
            <div className="sticky bottom-0 px-7 py-4 bg-white border-t border-[#E0E0E0]">
              <button className="w-full py-3 rounded bg-acid text-black text-sm font-inter font-bold hover:bg-acid/90 transition-colors">
                Sauvegarder ce style
              </button>
            </div>
          </div>

          {/* ── Right panel (55%) — Preview ── */}
          <div className="flex-1 flex items-center justify-center bg-[#F5F5F5] p-8 overflow-auto">
            <div className="flex flex-col items-center gap-4">
              <p className="text-xs font-inter text-[#AAA] uppercase tracking-wider">Aperçu — 1:1 Instagram</p>

              {/* Canvas */}
              <div
                className="relative overflow-hidden shadow-sm"
                style={{ width: 520, height: 520, flexShrink: 0 }}
              >
                {/* Background photo placeholder */}
                <div className="absolute inset-0 bg-[#CCCCCC] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 select-none pointer-events-none">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                      <rect x="2" y="7" width="36" height="27" rx="3" stroke="#AAAAAA" strokeWidth="1.5"/>
                      <circle cx="14" cy="18" r="4" stroke="#AAAAAA" strokeWidth="1.5"/>
                      <path d="M2 30l10-10 7 7 6-6 13 12" stroke="#AAAAAA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p className="text-sm font-inter text-[#AAAAAA]">Ta photo ici</p>
                  </div>
                </div>

                {/* Text block */}
                {s.text && (
                  <div style={blockStyle}>
                    <p style={textStyle}>{s.text}</p>
                  </div>
                )}

                {/* Logo */}
                <div style={logoPositionStyle(s.logoPosition, s.logoSize)}>
                  {s.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.logoUrl} alt="Logo"
                      className="w-full h-full object-contain drop-shadow-md"
                    />
                  ) : (
                    <div
                      className="w-full h-full rounded bg-white/80 border border-white/50 flex items-center justify-center"
                    >
                      <span className="text-[9px] font-inter text-[#999] text-center leading-tight px-1">
                        LOGO
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Info bar */}
              <div className="flex items-center gap-6 text-xs font-inter text-[#AAA]">
                <span>Police : <span className="text-black font-medium">{s.font}</span></span>
                <span>Taille : <span className="text-black font-medium">{s.fontSize}px</span></span>
                <span>Position : <span className="text-black font-medium">{BLOCK_POSITIONS.find(p => p.value === s.blockPosition)?.label}</span></span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
