"use client";

/* components/PanneauImage.tsx — les deux panneaux de retouche d'une image.
 *
 * Sortis de l'éditeur pour deux raisons : ils y pesaient quatre cents lignes
 * de plus, et surtout ils ne se regardaient qu'en ouvrant un projet. Ici, ils
 * se montent seuls (cf. /banc-image).
 *
 * Le type d'entrée est STRUCTUREL : le panneau n'a besoin que de la source et
 * des réglages, pas de tout le calque de l'éditeur.
 */

import React from "react";
import { PictoOutil } from "./PictosOutils";

export type ImageRetouchable = {
  id: string;
  src: string;
  adjBrightness?: number; adjContrast?: number; adjSaturation?: number; adjWarmth?: number; adjTint?: number; adjBlur?: number;
  adjHighlights?: number; adjShadows?: number; adjWhites?: number; adjBlacks?: number;
  adjVibrance?: number; adjClarity?: number; adjVignette?: number; adjSharpen?: number; adjInvert?: boolean;
};

export const PHOTO_FILTER_PRESETS: { id: string; name: string; values: Partial<Record<'adjBrightness' | 'adjContrast' | 'adjSaturation' | 'adjWarmth' | 'adjTint', number>> }[] = [
  { id: 'none',   name: 'Aucun',      values: {} },
  { id: 'chaud',  name: 'Chaud',      values: { adjWarmth: 30, adjSaturation: 15, adjContrast: 4 } },
  { id: 'doux',   name: 'Doux',       values: { adjBrightness: 5, adjContrast: -4, adjSaturation: -8 } },
  { id: 'froid',  name: 'Froid',      values: { adjWarmth: -25, adjSaturation: 5, adjBrightness: 2 } },
  { id: 'argent', name: 'Argentique', values: { adjWarmth: 20, adjSaturation: -15, adjContrast: 8 } },
  { id: 'nb',     name: 'N&B',        values: { adjSaturation: -100, adjContrast: 10 } },
];

/**
 * Panneau « Ajuster » d'une image, repris de Canva : balance des blancs,
 * lumière, couleur, matière. Chaque curseur agit sur une plage précise, pas
 * sur l'image entière, et tous sont branchés sur le même filtre en un
 * passage (cf. AdjustFilter).
 */
export function PanneauAjuster({ sel, onUpdate, onClose }: { sel: ImageRetouchable; onUpdate: (patch: Partial<ImageRetouchable>) => void; onClose: () => void }) {
  const u = (patch: Partial<ImageRetouchable>) => onUpdate(patch);
  const [auto, setAuto] = React.useState(false);

  const REGLAGES = { adjBrightness: 0, adjContrast: 0, adjSaturation: 0, adjWarmth: 0, adjTint: 0,
    adjHighlights: 0, adjShadows: 0, adjWhites: 0, adjBlacks: 0,
    adjVibrance: 0, adjClarity: 0, adjVignette: 0, adjSharpen: 0, adjInvert: false } as Partial<ImageRetouchable>;
  const touche = (Object.keys(REGLAGES) as (keyof ImageRetouchable)[]).some(k => !!sel[k]);

  /**
   * Ajustement automatique : on LIT vraiment l'image. L'histogramme dit où
   * commencent et où finissent les tons utilisés ; on étire cette plage.
   * Une image déjà correcte ne bouge donc presque pas, contrairement à un
   * préréglage appliqué à l'aveugle.
   */
  const ajusterAuto = async () => {
    setAuto(true);
    try {
      const img = await new Promise<HTMLImageElement | null>(res => {
        const el = new window.Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => res(el); el.onerror = () => res(null);
        el.src = sel.src;
      });
      if (!img) { u({ adjContrast: 8, adjVibrance: 12 }); return; }
      const cv = document.createElement('canvas');
      const l = Math.min(240, img.naturalWidth || 240);
      const h = Math.max(1, Math.round((img.naturalHeight || 240) * (l / (img.naturalWidth || 240))));
      cv.width = l; cv.height = h;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      if (!ctx) { u({ adjContrast: 8, adjVibrance: 12 }); return; }
      ctx.drawImage(img, 0, 0, l, h);
      const d = ctx.getImageData(0, 0, l, h).data;
      const hist = new Array(256).fill(0);
      let somme = 0, satMoy = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const lum = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        hist[lum]++; somme += lum; n++;
        const max = Math.max(d[i], d[i + 1], d[i + 2]), min = Math.min(d[i], d[i + 1], d[i + 2]);
        satMoy += max <= 0 ? 0 : (max - min) / max;
      }
      const seuil = n * 0.004;   // on ignore les 0,4 % extrêmes : un reflet ne fait pas la loi
      let bas = 0, haut = 255, cumul = 0;
      for (let v = 0; v < 256; v++) { cumul += hist[v]; if (cumul > seuil) { bas = v; break; } }
      cumul = 0;
      for (let v = 255; v >= 0; v--) { cumul += hist[v]; if (cumul > seuil) { haut = v; break; } }
      const etendue = Math.max(1, haut - bas);
      const moyenne = somme / n;
      u({
        adjContrast: Math.round(Math.max(0, Math.min(40, (255 / etendue - 1) * 55))),
        adjBrightness: Math.round(Math.max(-18, Math.min(18, (128 - moyenne) * 0.14))),
        adjBlacks: bas > 24 ? -Math.round(Math.min(18, (bas - 24) * 0.35)) : 0,
        adjWhites: haut < 232 ? Math.round(Math.min(18, (232 - haut) * 0.35)) : 0,
        adjVibrance: Math.round(Math.max(0, Math.min(22, (0.32 - satMoy / n) * 90))),
      });
    } catch {
      u({ adjContrast: 8, adjVibrance: 12 });
    } finally {
      setAuto(false);
    }
  };

  const curseur = (label: string, k: keyof ImageRetouchable, min = -100, max = 100) => {
    const val = (sel[k] as number) || 0;
    return (
      <div key={String(k)} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>{label}</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11, color: 'var(--ink-3)', minWidth: 30, textAlign: 'right' }}>{val > 0 && min < 0 ? '+' : ''}{val}</span>
        </div>
        <input type="range" min={min} max={max} step={1} value={val} className="ed-range"
          onChange={e => u({ [k]: parseInt(e.target.value) } as Partial<ImageRetouchable>)}
          style={{ width: '100%' }} />
      </div>
    );
  };
  const titre = (t: string) => (
    <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: '18px 0 10px' }}>{t}</p>
  );

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h3 className="h-title" style={{ fontSize: 17 }}>Ajuster</h3>
        <button onClick={onClose} title="Fermer"
          style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      <button onClick={() => { void ajusterAuto(); }} disabled={auto}
        style={{ width: '100%', height: 44, marginBottom: 4, borderRadius: 12, border: 'none', cursor: auto ? 'default' : 'pointer',
          background: 'var(--leaf-ink, #1E3317)', color: 'var(--leaf, #BDF2A0)', fontSize: 13.5, fontWeight: 800, fontFamily: 'var(--sans)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.1 5.9L20 10l-5.9 2.1L12 18l-2.1-5.9L4 10l5.9-2.1z"/></svg>
        {auto ? 'Analyse…' : 'Ajuster automatiquement'}
      </button>

      {titre('Balance des blancs')}
      {curseur('Température', 'adjWarmth')}
      {curseur('Teinte', 'adjTint')}

      {titre('Lumière')}
      {curseur('Luminosité', 'adjBrightness')}
      {curseur('Contraste', 'adjContrast')}
      {curseur('Tons clairs', 'adjHighlights')}
      {curseur('Ombres', 'adjShadows')}
      {curseur('Blancs', 'adjWhites')}
      {curseur('Noirs', 'adjBlacks')}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 0 10px' }}>
        <p style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: 0 }}>Couleur</p>
        <button onClick={() => u({ adjInvert: !sel.adjInvert })}
          style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>
          Inverser
          <span style={{ width: 30, height: 18, borderRadius: 99, background: sel.adjInvert ? 'var(--ink)' : 'var(--line)', position: 'relative', transition: 'background .15s' }}>
            <span style={{ position: 'absolute', top: 2, left: sel.adjInvert ? 14 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
          </span>
        </button>
      </div>
      {curseur('Éclat', 'adjVibrance')}
      {curseur('Saturation', 'adjSaturation')}

      {titre('Matière')}
      {curseur('Netteté', 'adjSharpen', 0, 100)}
      {curseur('Clarté', 'adjClarity')}
      {curseur('Vignettage', 'adjVignette', 0, 100)}
      {curseur('Flou', 'adjBlur', 0, 40)}

      <button onClick={() => u(REGLAGES)} disabled={!touche}
        style={{ width: '100%', height: 40, marginTop: 10, borderRadius: 12, border: 'none', background: 'var(--sunk)',
          color: touche ? 'var(--ink-2)' : 'var(--ink-3)', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--sans)', cursor: touche ? 'pointer' : 'default' }}>
        Réinitialiser les ajustements
      </button>
    </div>
  );
}

/**
 * Panneau « Modifier l'image », repris de Canva : des pastilles rondes en
 * grille, des sections courtes, et chaque outil qui demande une consigne
 * s'ouvre en sous-panneau au lieu d'empiler des champs dans la liste.
 *
 * Les outils de réinvention et le transfert de style ne sont qu'une consigne
 * différente envoyée au MÊME moteur d'image : autant le dire au lieu
 * d'inventer cinq technologies.
 */
// L'image témoin des aperçus. Recadrée au carré et son papier ramené au blanc
// pur : sur un panneau blanc, un fond à 249 se lit comme une tuile grise.
const APERCU_STYLE = '/apercu-style.png';

const STYLES_TRANSFERT: { id: string; nom: string; apercu: string; invite: string }[] = [
  { id: 'gravure', nom: 'Gravure', apercu: 'grayscale(1) contrast(1.9) brightness(1.05)', invite: 'gravure ancienne au burin, noir et blanc, hachures fines' },
  { id: 'aquarelle', nom: 'Aquarelle', apercu: 'saturate(1.5) contrast(.82) brightness(1.12) blur(.4px)', invite: 'peinture à l’aquarelle, lavis, bords humides' },
  { id: 'papier', nom: 'Papier découpé', apercu: 'saturate(1.7) contrast(1.35)', invite: 'papier découpé en couches, ombres portées douces' },
  { id: 'esquisse', nom: 'Esquisse', apercu: 'grayscale(1) brightness(1.25) contrast(1.5)', invite: 'esquisse au crayon graphite sur papier' },
  { id: 'popart', nom: 'Pop art', apercu: 'saturate(2.4) contrast(1.6) hue-rotate(-12deg)', invite: 'pop art sérigraphié, aplats francs, trame de points' },
  { id: 'risographie', nom: 'Risographie', apercu: 'saturate(1.8) hue-rotate(20deg) contrast(1.25)', invite: 'risographie deux encres, grain, léger décalage des couches' },
  { id: 'huile', nom: 'Peinture', apercu: 'saturate(1.35) contrast(1.15) sepia(.18)', invite: 'peinture à l’huile, touches visibles, matière épaisse' },
  { id: 'neon', nom: 'Néon', apercu: 'saturate(1.9) hue-rotate(-30deg) brightness(.86) contrast(1.4)', invite: 'photographie éclairée au néon, ambiance nocturne, reflets colorés' },
];

export function PanneauOutils({ sel, busy, erreur, onAjuster, onRecadrer, onDetourer, onCapturer, onRetoucher, onFiltre, onClose }: {
  sel: ImageRetouchable;
  busy: string | null;
  erreur: string | null;
  onAjuster: () => void;
  onRecadrer?: () => void;
  onDetourer?: () => void;
  onCapturer: () => void;
  onRetoucher: (invite: string, cle: string) => void;
  onFiltre: (valeurs: Partial<ImageRetouchable>) => void;
  onClose: () => void;
}) {
  type Consigne = { cle: string; titre: string; aide: string; exemple: string; invite: (v: string) => string };
  const CONSIGNES: Consigne[] = [
    { cle: 'fond', titre: 'Générer l’arrière-plan', aide: 'Le sujet reste, le décor change.', exemple: 'un mur de béton clair',
      invite: v => `Garde EXACTEMENT le sujet principal de cette image, sa pose, ses couleurs et sa netteté, et remplace uniquement l'arrière-plan par : ${v}. Lumière cohérente avec le sujet, aucun texte ajouté.` },
    { cle: 'edition', titre: 'Édition magique', aide: 'Décrivez la modification voulue.', exemple: 'ajoute de la vapeur au-dessus du plat',
      invite: v => `Modifie cette image : ${v}. Garde le cadrage, le style et le reste de l'image identiques, sans ajouter de texte.` },
    { cle: 'gomme', titre: 'Gomme magique', aide: 'Nommez ce qui doit disparaître.', exemple: 'la poubelle au fond à droite',
      invite: v => `Supprime de cette image : ${v}. Reconstitue l'arrière-plan à cet endroit de façon invisible. Ne change rien d'autre, n'ajoute aucun texte.` },
  ];
  const [ouvert, setOuvert] = React.useState<Consigne | null>(null);
  const [texte, setTexte] = React.useState('');

  const Pastille = ({ nom, outil, onClick, enCours }: {
    nom: string; outil: string; onClick?: () => void; enCours?: boolean;
  }) => (
    <button onClick={onClick} disabled={!onClick || !!busy} title={nom}
      style={{ border: 'none', background: 'none', padding: 0, cursor: onClick && !busy ? 'pointer' : 'default',
        display: 'grid', gap: 7, justifyItems: 'center', opacity: busy && !enCours ? .5 : 1 }}
      onMouseEnter={e => { const t = e.currentTarget.firstElementChild as HTMLElement; if (t && onClick && !busy) t.style.transform = 'translateY(-2px) scale(1.04)'; }}
      onMouseLeave={e => { const t = e.currentTarget.firstElementChild as HTMLElement; if (t) t.style.transform = 'none'; }}>
      <PictoOutil outil={outil} style={{ transition: 'transform .14s',
        ...(enCours ? { animation: 'klipPulse 1.1s ease-in-out infinite' } : {}) }} />
      <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ink-2)', textAlign: 'center', lineHeight: 1.2 }}>{nom}</span>
    </button>
  );

  const entete = (titre: string, retour?: () => void) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      {retour && (
        <button onClick={retour} title="Retour"
          style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: 'var(--sunk)', color: 'var(--ink)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7"/></svg>
        </button>
      )}
      <h3 className="h-title" style={{ fontSize: 17, margin: 0 }}>{titre}</h3>
      <button onClick={onClose} title="Fermer"
        style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
  );
  const section = (t: string) => (
    <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', margin: '20px 0 11px', letterSpacing: '-0.01em' }}>{t}</p>
  );

  // ── Sous-panneau d'une consigne ────────────────────────────────────────
  if (ouvert) {
    const pret = texte.trim().length > 2 && !busy;
    return (
      <div style={{ padding: 18 }}>
        {entete(ouvert.titre, () => { setOuvert(null); setTexte(''); })}
        <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 12px', lineHeight: 1.5 }}>{ouvert.aide}</p>
        <textarea value={texte} onChange={e => setTexte(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && pret) { e.preventDefault(); onRetoucher(ouvert.invite(texte.trim()), ouvert.cle); } }}
          placeholder={ouvert.exemple} rows={3}
          style={{ width: '100%', padding: '11px 12px', borderRadius: 12, border: 'none', background: 'var(--sunk)', color: 'var(--ink)',
            fontSize: 12.5, fontFamily: 'var(--sans)', outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }} />
        <button onClick={() => pret && onRetoucher(ouvert.invite(texte.trim()), ouvert.cle)} disabled={!pret}
          style={{ width: '100%', height: 44, marginTop: 10, borderRadius: 12, border: 'none', cursor: pret ? 'pointer' : 'default',
            background: pret ? 'var(--leaf-ink, #1E3317)' : 'var(--line)', color: pret ? 'var(--leaf, #BDF2A0)' : 'var(--ink-3)',
            fontSize: 13.5, fontWeight: 800, fontFamily: 'var(--sans)' }}>
          {busy === ouvert.cle ? 'En cours…' : 'Appliquer'}
        </button>
        {erreur && <p style={{ fontSize: 11.5, color: '#C4452F', margin: '12px 0 0', lineHeight: 1.45 }}>{erreur}</p>}
        <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '14px 0 0', lineHeight: 1.45 }}>
          L&apos;image repart au modèle : comptez une dizaine de secondes, et une image sur votre quota du jour.
        </p>
      </div>
    );
  }

  // ── Panneau principal ──────────────────────────────────────────────────
  return (
    <div style={{ padding: 18 }}>
      <style>{`@keyframes klipPulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
      {entete('Modifier l’image')}

      {section('Outils')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        <Pastille nom="Ajuster" outil="ajuster" onClick={onAjuster} />
        {onRecadrer && (
          <Pastille nom="Recadrer" outil="recadrer" onClick={onRecadrer} />
        )}
        {onDetourer && (
          <Pastille nom="Effacer le fond" outil="fond" onClick={onDetourer} enCours={busy === 'detour'} />
        )}
        <Pastille nom="Capture magique" outil="capture" onClick={onCapturer} enCours={busy === 'capture'} />
        <Pastille nom="Générer le fond" outil="generer" onClick={() => setOuvert(CONSIGNES[0])} enCours={busy === 'fond'} />
        <Pastille nom="Édition magique" outil="edition" onClick={() => setOuvert(CONSIGNES[1])} enCours={busy === 'edition'} />
        <Pastille nom="Gomme magique" outil="gomme" onClick={() => setOuvert(CONSIGNES[2])} enCours={busy === 'gomme'} />
      </div>

      {section('Transfert de style')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {STYLES_TRANSFERT.map(st => (
          <button key={st.id} onClick={() => onRetoucher(
            `Redessine cette image dans le style suivant : ${st.invite}. Garde le sujet, le cadrage et la composition identiques, sans ajouter de texte.`, `style-${st.id}`)}
            disabled={!!busy} title={st.nom}
            style={{ border: 'none', background: 'none', padding: 0, cursor: busy ? 'default' : 'pointer', display: 'grid', gap: 6, justifyItems: 'center', opacity: busy && busy !== `style-${st.id}` ? .5 : 1 }}>
            <span style={{ width: '100%', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: '#fff', display: 'block',
              ...(busy === `style-${st.id}` ? { animation: 'klipPulse 1.1s ease-in-out infinite' } : {}) }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={APERCU_STYLE} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: st.apercu }} />
            </span>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ink-2)', textAlign: 'center', lineHeight: 1.2 }}>{st.nom}</span>
          </button>
        ))}
      </div>

      {section('Filtres')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {PHOTO_FILTER_PRESETS.map(f => {
          const actif = (['adjBrightness', 'adjContrast', 'adjSaturation', 'adjWarmth', 'adjTint'] as const)
            .every(k => ((sel[k] as number) || 0) === ((f.values as Record<string, number>)[k] ?? 0));
          return (
            <button key={f.id} onClick={() => onFiltre({ adjBrightness: 0, adjContrast: 0, adjSaturation: 0, adjWarmth: 0, adjTint: 0, ...f.values })}
              title={f.name}
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'grid', gap: 6, justifyItems: 'center' }}>
              {/* Même image témoin que le transfert de style : les deux rangées
                  se lisent d'un coup, au lieu d'alterner photo et exemple. */}
              <span style={{ width: '100%', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: '#fff',
                boxShadow: actif ? 'inset 0 0 0 2px var(--leaf-ink, #1E3317)' : 'none', display: 'block' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={APERCU_STYLE} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                  filter: `brightness(${1 + ((f.values as Record<string, number>).adjBrightness ?? 0) / 180})`
                    + ` contrast(${1 + ((f.values as Record<string, number>).adjContrast ?? 0) / 160})`
                    + ` saturate(${1 + ((f.values as Record<string, number>).adjSaturation ?? 0) / 100})`
                    + ` sepia(${Math.max(0, ((f.values as Record<string, number>).adjWarmth ?? 0)) / 260})` }} />
              </span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: actif ? 'var(--ink)' : 'var(--ink-2)', textAlign: 'center' }}>{f.name}</span>
            </button>
          );
        })}
      </div>

      {erreur && <p style={{ fontSize: 11.5, color: '#C4452F', margin: '16px 0 0', lineHeight: 1.45 }}>{erreur}</p>}
    </div>
  );
}

