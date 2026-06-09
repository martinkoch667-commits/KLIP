"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import VoiceButton from "@/components/VoiceButton";

const MOCK_CLIENTS: Record<string, { name: string; initials: string }> = {
  leclerc: { name: "Leclerc Geispolsheim", initials: "LG" },
  boulangerie: { name: "Boulangerie Martin", initials: "BM" },
  sport2000: { name: "Sport 2000", initials: "S2" },
};

export default function EditorPage() {
  const params = useParams();
  const id = params.id as string;
  const client = MOCK_CLIENTS[id] ?? { name: id, initials: id.slice(0, 2).toUpperCase() };

  const [photo, setPhoto] = useState<string | null>(null);
  const [mainText, setMainText] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [textPosition, setTextPosition] = useState(80); // % from top
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhoto(files: FileList | null) {
    if (!files?.[0]) return;
    setPhoto(URL.createObjectURL(files[0]));
  }

  async function generateDescription() {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1200));
    const samples = [
      `🛒 Découvrez nos offres exceptionnelles cette semaine chez ${client.name} ! Des promotions incroyables vous attendent en magasin. Ne manquez pas cette opportunité unique de faire de bonnes affaires. #Promo #BonPlan`,
      `✨ Nouveau produit disponible dès maintenant chez ${client.name}. Venez le découvrir en boutique et profitez d'une expérience unique. Nous vous attendons ! #Nouveauté #Qualité`,
      `💚 Chez ${client.name}, votre satisfaction est notre priorité. Retrouvez toute notre sélection et laissez-vous surprendre. À très vite ! #ServiceClient #Excellence`,
    ];
    setDescription(samples[Math.floor(Math.random() * samples.length)]);
    setGenerating(false);
  }

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-3.5 border-b border-[#E0E0E0] bg-white">
          <div className="flex items-center gap-3">
            <Link
              href={`/workspace/${id}`}
              className="inline-flex items-center gap-1.5 text-sm font-inter text-[#888] hover:text-black transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {client.name}
            </Link>
            <span className="text-[#DDD]">/</span>
            <span className="text-sm font-inter font-medium text-black">Éditeur visuel</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shrink-0">
            <span className="text-xs font-syne font-bold text-white">MK</span>
          </div>
        </header>

        {/* Two-column editor */}
        <div className="flex flex-1 min-h-0">
          {/* Left — 40% — Canvas */}
          <div className="w-[40%] border-r border-[#E0E0E0] bg-[#F5F5F5] flex flex-col items-center justify-center p-6 gap-4">
            <div
              className="relative w-full max-w-xs aspect-square rounded overflow-hidden border border-[#E0E0E0] bg-white cursor-pointer"
              onClick={() => !photo && fileInputRef.current?.click()}
            >
              {photo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt="" className="w-full h-full object-cover" />

                  {/* Text overlay */}
                  {(mainText || subtitle) && (
                    <div
                      className="absolute left-0 right-0 px-4 py-3 bg-black/50"
                      style={{ top: `${textPosition}%`, transform: "translateY(-50%)" }}
                    >
                      {mainText && (
                        <p className="font-syne font-bold text-white text-sm leading-tight">
                          {mainText}
                        </p>
                      )}
                      {subtitle && (
                        <p className="font-inter text-white/80 text-xs mt-0.5">{subtitle}</p>
                      )}
                    </div>
                  )}

                  {/* Change photo btn */}
                  <button
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded bg-black/60 text-white text-xs font-inter hover:bg-black/80 transition-colors"
                  >
                    Changer
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                    <rect x="2" y="6" width="32" height="24" rx="3" stroke="#CCCCCC" strokeWidth="1.5"/>
                    <circle cx="12" cy="16" r="4" stroke="#CCCCCC" strokeWidth="1.5"/>
                    <path d="M2 26l8-8 6 6 5-5 10 9" stroke="#CCCCCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p className="text-sm font-inter text-[#AAA]">Clique pour importer une photo</p>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhoto(e.target.files)}
            />

            <p className="text-xs font-inter text-[#AAA] text-center">
              Format carré recommandé · 1080 × 1080 px
            </p>
          </div>

          {/* Right — 60% — Controls */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            <div className="flex-1 p-8 space-y-6">
              <div>
                <h2 className="font-syne font-bold text-base text-black mb-5">Contenu du visuel</h2>

                {/* Texte principal */}
                <div className="space-y-4">
                  <div>
                    <label className="block mb-1.5 text-xs font-inter font-medium text-[#888] uppercase tracking-wider">
                      Texte principal
                    </label>
                    <input
                      type="text"
                      value={mainText}
                      onChange={(e) => setMainText(e.target.value)}
                      placeholder="Ex. Soldes d'été — jusqu'à -50%"
                      className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded px-3.5 py-2.5 text-sm font-inter text-black placeholder-[#BBB] focus:border-black outline-none transition-colors"
                    />
                  </div>

                  {/* Sous-titre */}
                  <div>
                    <label className="block mb-1.5 text-xs font-inter font-medium text-[#888] uppercase tracking-wider">
                      Sous-titre
                    </label>
                    <input
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="Ex. Offre valable jusqu'au 31 juillet"
                      className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded px-3.5 py-2.5 text-sm font-inter text-black placeholder-[#BBB] focus:border-black outline-none transition-colors"
                    />
                  </div>

                  {/* Position slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-inter font-medium text-[#888] uppercase tracking-wider">
                        Position du texte
                      </label>
                      <span className="text-xs font-inter text-[#888]">{textPosition}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={90}
                      value={textPosition}
                      onChange={(e) => setTextPosition(Number(e.target.value))}
                      className="w-full accent-black h-1 rounded"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-xs font-inter text-[#CCC]">Haut</span>
                      <span className="text-xs font-inter text-[#CCC]">Bas</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Séparateur */}
              <div className="border-t border-[#E0E0E0]" />

              {/* Description générée */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-syne font-bold text-base text-black">Description</h2>
                  <button
                    onClick={generateDescription}
                    disabled={generating}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded bg-acid text-black text-xs font-inter font-bold hover:bg-acid/90 disabled:opacity-50 transition-colors"
                  >
                    {generating ? (
                      <>
                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 6"/>
                        </svg>
                        Génération…
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                          <path d="M6 1l1.2 3.6L11 6 7.2 7.4 6 11 4.8 7.4 1 6l3.8-1.4L6 1z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                        </svg>
                        Générer la description
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="La description générée apparaîtra ici. Cliquez sur « Générer » pour créer automatiquement une légende adaptée au style du client."
                  rows={5}
                  className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded px-3.5 py-3 text-sm font-inter text-black placeholder-[#BBB] focus:border-black outline-none transition-colors resize-none"
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                  <VoiceButton value={description} onChange={setDescription} />
                </div>

                {description && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-inter text-[#AAA]">
                      {description.length} caractères
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(description)}
                      className="text-xs font-inter text-[#888] hover:text-black transition-colors"
                    >
                      Copier
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="border-t border-[#E0E0E0] px-8 py-4 flex items-center gap-3 bg-white">
              <button className="flex-1 py-2.5 rounded bg-black text-white text-sm font-inter font-bold hover:bg-black/80 transition-colors">
                Planifier ce post
              </button>
              <button className="px-5 py-2.5 rounded border border-[#E0E0E0] bg-[#F5F5F5] text-black text-sm font-inter font-medium hover:border-black transition-colors">
                Enregistrer en brouillon
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
