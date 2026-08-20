"use client";

/* Contrôles PARTAGÉS des panneaux de réglage (KLIP).
 *
 * Le panneau TEXTE du montage et le panneau SOUS-TITRE avaient chacun leurs
 * propres contrôles : deux nuanciers, deux curseurs, deux façons de replier une
 * section. Côte à côte dans la même colonne, on avait l'impression de deux
 * logiciels cousus ensemble, et la pioche de couleur maison ne vivait que d'un
 * côté. Les commandes vivent donc ici, une seule fois, et les deux panneaux les
 * assemblent : ligne libellé + contrôle, carrés de 30 px, champs numériques
 * courts, effets rangés dans des sections repliables qu'on active à la case.
 */
import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";

export interface GFont { family: string; category: string }

/** Catalogue de polices, chargé une fois pour toute la session. */
let catalogue: GFont[] | null = null;
let catalogueEnCours: Promise<GFont[]> | null = null;
export function chargerCatalogue(): Promise<GFont[]> {
  if (catalogue) return Promise.resolve(catalogue);
  if (!catalogueEnCours) {
    catalogueEnCours = fetch("/api/google-fonts")
      .then((r) => (r.ok ? r.json() : []))
      .then((j: GFont[]) => { catalogue = Array.isArray(j) ? j : []; return catalogue; })
      .catch(() => { catalogue = []; return catalogue; });
  }
  return catalogueEnCours;
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mz-row">
      <span className="mz-row-lbl">{label}</span>
      <span className="mz-row-ctl">{children}</span>
    </div>
  );
}

export function Ico({ on, title: titre, onClick, children }: { on?: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return <button className={"mz-ico" + (on ? " on" : "")} title={titre} onClick={onClick}>{children}</button>;
}

/** Champ numérique court : la valeur exacte, quand le curseur ne suffit pas. */
export function Num({ value, min, max, step = 1, onChange, suffix }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <span style={{ position: "relative", flex: 1, minWidth: 54, display: "flex", alignItems: "center" }}>
      <input className="mz-num" type="number" value={Math.round(value * 100) / 100} min={min} max={max} step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }} />
      {suffix && <span style={{ position: "absolute", right: 8, fontSize: 10, color: "var(--ink-3)", pointerEvents: "none", fontFamily: "var(--mono)" }}>{suffix}</span>}
    </span>
  );
}

/** Section d'effet : une case pour l'allumer, un triangle pour la déplier. */
export function Fold({ name, on, onToggle, children }: { name: string; on: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="mz-fold">
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <button className={"mz-fold-chk" + (on ? " on" : "")} onClick={() => { onToggle(!on); if (!on) setOuvert(true); }} title={name}>{on ? "✓" : ""}</button>
        <button className="mz-fold-head" style={{ padding: 0 }} onClick={() => setOuvert((v) => !v)}>
          <span className="mz-fold-name">{name}</span>
          <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{ouvert ? "▲" : "▼"}</span>
        </button>
      </div>
      {ouvert && on && <div className="mz-fold-body">{children}</div>}
    </div>
  );
}

/* ─── Pioche de couleur ──────────────────────────────────────────────────────

   Elle passait par `<input type="color">`, donc par le sélecteur du SYSTÈME :
   une fenêtre grise, aux codes de macOS, ouverte au milieu d'un panneau sombre.
   Même reproche que pour la liste de qualité, et même réponse : on la dessine.

   Un carré teinte-luminosité, un rail de teintes, un champ hexadécimal. C'est le
   minimum qui permet de tomber sur une couleur précise sans quitter l'outil. */

function hexVersHsv(hex: string): { h: number; s: number; v: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return { h: 0, s: 0, v: 1 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvVersHex(h: number, s: number, v: number): string {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const o = (u: number) => Math.round((u + m) * 255).toString(16).padStart(2, "0");
  return `#${o(r)}${o(g)}${o(b)}`.toUpperCase();
}

function PiocheCouleur({ value, onChange, onClose }: { value: string; onChange: (c: string) => void; onClose: () => void }) {
  const t = useTranslations('montage');
  const [hsv, setHsv] = useState(() => hexVersHsv(value));
  const [hexTexte, setHexTexte] = useState(value.toUpperCase());
  const carreRef = useRef<HTMLDivElement>(null);
  const boiteRef = useRef<HTMLDivElement>(null);

  // Un clic à côté referme : c'est le réflexe, et la pioche ne doit pas rester
  // ouverte par-dessus le panneau.
  useEffect(() => {
    const dehors = (e: MouseEvent) => {
      if (boiteRef.current && !boiteRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, [onClose]);

  const poser = (h: number, s: number, v: number) => {
    setHsv({ h, s, v });
    const hex = hsvVersHex(h, s, v);
    setHexTexte(hex);
    onChange(hex);
  };

  const surCarre = (e: React.PointerEvent) => {
    const r = carreRef.current?.getBoundingClientRect();
    if (!r) return;
    const s = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    poser(hsv.h, s, v);
  };
  const surRail = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    poser(Math.max(0, Math.min(359.9, ((e.clientX - r.left) / r.width) * 360)), hsv.s, hsv.v);
  };

  const teintePure = hsvVersHex(hsv.h, 1, 1);
  return (
    <div className="mz-pioche" ref={boiteRef}>
      <div className="mz-pioche-carre" ref={carreRef}
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${teintePure})` }}
        onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); surCarre(e); }}
        onPointerMove={(e) => { if (e.buttons === 1) surCarre(e); }}>
        <span className="mz-pioche-point" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvVersHex(hsv.h, hsv.s, hsv.v) }} />
      </div>
      <div className="mz-pioche-rail"
        onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); surRail(e); }}
        onPointerMove={(e) => { if (e.buttons === 1) surRail(e); }}>
        <span className="mz-pioche-point" style={{ left: `${(hsv.h / 360) * 100}%`, top: "50%", background: teintePure }} />
      </div>
      <div className="mz-pioche-bas">
        <span className="mz-pioche-vu" style={{ background: hsvVersHex(hsv.h, hsv.s, hsv.v) }} />
        <input className="mz-pioche-hex" value={hexTexte} spellCheck={false} aria-label={t('customColor')}
          onChange={(e) => {
            const v = e.target.value.toUpperCase();
            setHexTexte(v);
            if (/^#[0-9A-F]{6}$/.test(v)) { setHsv(hexVersHsv(v)); onChange(v); }
          }} />
      </div>
    </div>
  );
}

/** Nuancier compact : charte d'abord, puis génériques, puis la pioche libre. */
export function Swatches({ brandColors = [], value, onPick }: { brandColors?: string[]; value: string; onPick: (c: string) => void }) {
  const t = useTranslations('montage');
  const [piocheOuverte, setPiocheOuverte] = useState(false);
  // Génériques du module vidéo : neutres + violet (l'accent du montage) + un
  // orange chaud. Le vert de la marque n'a rien à faire ici, il appartient à la photo.
  const generiques = ["#FFFFFF", "#14160F", "#1E1246", "#7A69E8", "#C9C0FF", "#F2A03D"];
  const vus = new Set<string>();
  const liste = [...brandColors, ...generiques].filter((c) => {
    const k = c.toUpperCase();
    if (vus.has(k)) return false;
    vus.add(k); return true;
  });
  return (
    <div className="mz-swrow" style={{ alignItems: "center", flexWrap: "wrap", position: "relative" }}>
      {liste.map((col, i) => (
        <button key={col} className={"mz-sw" + (value.toUpperCase() === col.toUpperCase() ? " on" : "")}
          style={{ background: col, ...(i < brandColors.length ? { boxShadow: "0 0 0 1.5px var(--vio)" } : {}) }}
          onClick={() => onPick(col)} title={i < brandColors.length ? `${col} · ${t('brandColors')}` : col} />
      ))}
      <button className="mz-sw" style={{ background: "conic-gradient(red,yellow,lime,aqua,blue,magenta,red)" }}
        title={t('customColor')} onClick={() => setPiocheOuverte((v) => !v)} />
      {/* Ancrée sur la RANGÉE, pas sur la pastille : la pastille est en bout de
          ligne, une pioche ouverte depuis elle sortait du panneau par la droite. */}
      {piocheOuverte && <PiocheCouleur value={value} onChange={onPick} onClose={() => setPiocheOuverte(false)} />}
    </div>
  );
}

export const AlignIcon = ({ k }: { k: "left" | "center" | "right" }) => {
  const lignes = k === "left" ? [14, 9, 14, 7] : k === "right" ? [14, 9, 14, 7] : [14, 10, 14, 8];
  const x = (w: number, i: number) => k === "left" ? 2 : k === "right" ? 16 - w : (16 - w) / 2;
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden>
      {lignes.map((w, i) => <rect key={i} x={x(w, i)} y={i * 3.5 + 1} width={w} height="2" rx="1" fill="currentColor" />)}
    </svg>
  );
};
