"use client";

/* Étape 5 du parcours « nouveau client » : deux ateliers, pas une coulée.
 *
 * Le reproche portait sur la lecture : les réglages de sous-titres et la
 * création des templates visuels se suivaient sans rien qui dise où finissait
 * l'un et où commençait l'autre, dans une colonne trop étroite pour un panneau
 * d'éditeur (le nuancier se repliait sur deux rangées, les réglages tombaient
 * en file indienne). Rien n'a changé côté fonctions : ce sont les mêmes
 * préréglages, le même éditeur partagé, le même bouton de création. Ils sont
 * simplement posés dans deux blocs numérotés, et le panneau de personnalisation
 * déborde la colonne de lecture pour retrouver la largeur d'un vrai éditeur.
 */

import React, { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  effectiveSubStyle, DEFAULT_SUB_POS, SUB_LENGTHS, type SubCustom,
} from "@/app/workspace/[id]/montage/[postId]/constants";
import SubtitleStyleEditor, { SubtitlePreviewStage } from "@/components/SubtitleStyleEditor";

// Libellés « longueur des sous-titres » : mêmes traductions que l'éditeur de
// montage (six langues), pas de doublon à créer.
const SUB_LENGTH_KEY: Record<number, string> = { 1: "one", 2: "two", 3: "three", 4: "four", 6: "six", 99: "sentence" };

// Aperçu fidèle d'un sous-titre : on résout le style comme le montage
// (effectiveSubStyle = style de base + surcharges), le 2e mot représente le mot
// actif surligné (couleur `hi`). Rendu sur fond sombre, comme sur une vidéo.
export function SubChip({ styleId, custom, size = 15, words = ["Vos", "clips"] }: {
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

export interface SubPreset { id: string; styleId: string; custom: SubCustom }

export default function Step5Templates({
  clientName,
  subPresets, subPresetId, onPickPreset,
  advanced, onToggleAdvanced,
  styleId, custom, onCustomChange,
  pos, onPosChange,
  maxWords, onMaxWordsChange,
  brandFont, brandColors,
  templateCount, onCreateTemplate, loading, error,
}: {
  clientName: string;
  subPresets: SubPreset[];
  subPresetId: string | null;
  onPickPreset: (p: SubPreset) => void;
  advanced: boolean;
  onToggleAdvanced: () => void;
  styleId: string;
  custom: SubCustom;
  /** Toute retouche manuelle décroche du préréglage : c'est l'appelant qui le sait. */
  onCustomChange: (next: SubCustom) => void;
  pos: { x: number; y: number };
  onPosChange: (p: { x: number; y: number }) => void;
  maxWords: number;
  onMaxWordsChange: (w: number) => void;
  brandFont?: string | null;
  brandColors: string[];
  templateCount: number;
  onCreateTemplate: () => void;
  loading: boolean;
  error: string | null;
}) {
  const t = useTranslations("workspaceNew");
  const tc = useTranslations("montageConstants");

  return (
    <div key="step5" className="screen-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 className="ws-new-step-title" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 30, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 8 }}>
          {t('step5Title')}
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-2)" }}>
          {t('step5Subtitle', { name: clientName || t('thisClientFallback') })}{" "}
          <span style={{ color: "var(--ink-3)" }}>{t('optionalStep')}</span>
        </p>
      </div>

      {/* ── 1 · Sous-titres, dérivés de la charte (couleurs + typo) ─────────── */}
      <section className={"wsn-t5-block" + (advanced ? " wsn-t5-wide" : "")}>
        <div className="wsn-t5-head">
          <span className="wsn-t5-num">1</span>
          <div style={{ minWidth: 0 }}>
            <h2 className="wsn-t5-title">{t('subtitleTemplateLabel')}</h2>
            <p className="wsn-t5-desc">{t('subtitleTemplateHint')}</p>
          </div>
        </div>

        {/* Propositions à la charte */}
        <div className="wsn-t5-presets">
          {subPresets.map((p) => {
            const active = subPresetId === p.id;
            return (
              <button type="button" key={p.id} onClick={() => onPickPreset(p)}
                className={"wsn-t5-preset" + (active ? " is-on" : "")}>
                <span className="wsn-t5-preset-thumb">
                  <SubChip styleId={p.styleId} custom={p.custom} />
                  {active && (
                    <span className="wsn-t5-preset-tick">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </span>
                  )}
                </span>
                <span className="wsn-t5-preset-body">
                  <span className="wsn-t5-preset-name">{t(`subPresetName.${p.id}`)}</span>
                  <span className="wsn-t5-preset-hint">{t(`subPresetHint.${p.id}`)}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Personnalisation libre (le panneau de l'éditeur de montage) */}
        <button type="button" onClick={onToggleAdvanced}
          className={"wsn-t5-toggle" + (advanced ? " is-on" : "")}
          aria-expanded={advanced}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          {t('subCustomizeToggle')}
        </button>

        {advanced && (
          <div className="wsn-t5-editor">
            {/* Aperçu « comme sur la vidéo » : on juge la lisibilité et on place le texte */}
            <div className="wsn-t5-preview">
              {/* Le « Recentrer » monte sur la ligne du libellé : en pied de
                  cadre il écrasait la consigne de glisser-déposer. */}
              <div className="wsn-t5-sublabel-row">
                <span className="wsn-t5-sublabel" style={{ marginBottom: 0 }}>{t('subPreviewLabel')}</span>
                <button type="button" onClick={() => onPosChange(DEFAULT_SUB_POS)} className="wsn-chip" style={{ padding: "4px 11px", fontSize: 11 }}>
                  {t('subPosReset')}
                </button>
              </div>
              <SubtitlePreviewStage
                styleId={styleId}
                custom={custom}
                pos={pos}
                onPosChange={onPosChange}
                onScaleChange={(scale) => onCustomChange({ ...custom, scale })}
                maxWords={maxWords}
                editableTextLabel={t('subTextPlaceholder')}
                fontSize={14}
              />
              <p className="wsn-t5-hint" style={{ margin: "8px 0 0" }}>{t('subPreviewHint')}</p>

              {/* Longueur des sous-titres : combien de mots apparaissent à la
                  fois, exactement comme dans l'éditeur de montage. */}
              <div className="wsn-t5-len">
                <span className="wsn-t5-sublabel">{t('subLengthLabel')}</span>
                <p className="wsn-t5-hint" style={{ margin: "0 0 8px" }}>{t('subLengthHint')}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {SUB_LENGTHS.map((l) => (
                    <button type="button" key={l.words} onClick={() => onMaxWordsChange(l.words)}
                      className={"wsn-chip" + (maxWords === l.words ? " is-on" : "")}
                      style={{ padding: "5px 11px", fontSize: 11.5 }}>
                      {tc(`subLength.${SUB_LENGTH_KEY[l.words] ?? "four"}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tous les réglages, composant partagé avec l'éditeur de montage */}
            <div style={{ minWidth: 0 }}>
              <div className="wsn-t5-settings">
                <SubtitleStyleEditor
                  styleId={styleId}
                  custom={custom}
                  onChange={onCustomChange}
                  brandFont={brandFont}
                  brandColors={brandColors}
                />
              </div>
              <p className="wsn-t5-hint" style={{ margin: "10px 0 0" }}>{t('subCustomizeNote')}</p>
            </div>
          </div>
        )}
      </section>

      {/* ── 2 · Templates visuels : le VRAI éditeur, celui de toute l'app
             (rail + panneau Canva, modèles, IA), pas une maquette à part. Un
             nouveau template y arrive déjà avec photo, voile et deux blocs de
             texte à la couleur et à la police du client. ─────────────────── */}
      <section className="wsn-t5-block">
        <div className="wsn-t5-head">
          <span className="wsn-t5-num">2</span>
          <div style={{ minWidth: 0 }}>
            <h2 className="wsn-t5-title">{t('visualTemplateLabel')}</h2>
            <p className="wsn-t5-desc">{t('visualTemplateHint')}</p>
          </div>
        </div>

        <div className="wsn-t5-empty">
          <span className="wsn-t5-empty-ico">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>
            </svg>
          </span>
          <div>
            <p style={{ fontSize: 14.5, fontWeight: 800, color: "var(--ink)", margin: "0 0 3px" }}>
              {templateCount > 0 ? t('templatesSavedNote', { count: templateCount }) : t('noTemplateYet')}
            </p>
            <p className="wsn-t5-hint" style={{ margin: 0 }}>{t('noTemplateHint')}</p>
          </div>
          <button type="button" onClick={onCreateTemplate} disabled={loading} className="btn btn-dark">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            {templateCount > 0 ? t('add') : t('createTemplate')}
          </button>
        </div>
      </section>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "var(--r-s)", background: "var(--warn-soft)", border: "1px solid rgba(200,115,43,.25)", color: "var(--warn)", fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}
    </div>
  );
}
